import { Router, Response } from 'express';
import multer from 'multer';
import xml2js from 'xml2js';
import fs from 'fs';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({ dest: 'uploads/' });

function safeGet(obj: unknown, ...keys: (string | number)[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

function firstVal(val: unknown): string {
  if (Array.isArray(val)) return String(val[0] ?? '');
  return String(val ?? '');
}

// POST /api/nfe/import
router.post('/import', authenticate, authorize('admin', 'manager', 'operator'), upload.single('xml'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'Arquivo XML é obrigatório' });
    return;
  }

  const filePath = req.file.path;
  try {
    const xmlContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = await xml2js.parseStringPromise(xmlContent, { explicitArray: true });

    const nfeProc = parsed.nfeProc || parsed;
    const NFe = safeGet(nfeProc, 'NFe', 0) || safeGet(parsed, 'NFe', 0) || nfeProc.NFe?.[0];
    const infNFe = safeGet(NFe, 'infNFe', 0) as Record<string, unknown>;

    if (!infNFe) {
      res.status(400).json({ success: false, error: 'XML de NF-e inválido' });
      return;
    }

    const ide = (infNFe.ide as unknown[])[0] as Record<string, unknown>;
    const emit = (infNFe.emit as unknown[])[0] as Record<string, unknown>;
    const total = (infNFe.total as unknown[])[0] as Record<string, unknown>;
    const ICMSTot = (total.ICMSTot as unknown[])[0] as Record<string, unknown>;

    const chNFe = firstVal((infNFe as Record<string, unknown>)['$'] ? ((infNFe as Record<string, unknown>)['$'] as Record<string, unknown>).Id : '') || '';
    const key = chNFe.replace('NFe', '');
    const nNF = firstVal(ide.nNF);
    const serie = firstVal(ide.serie);
    const dhEmi = firstVal(ide.dhEmi);
    const xNome = firstVal(emit.xNome);
    const cnpjEmit = firstVal((emit as Record<string, unknown>).CNPJ);
    const vNF = parseFloat(firstVal(ICMSTot.vNF));

    const det = infNFe.det as unknown[];

    const existingNfe = await prisma.nFe.findUnique({ where: { key } });
    if (existingNfe) {
      res.status(409).json({ success: false, error: 'NF-e já importada', data: existingNfe });
      return;
    }

    const items: {
      description: string;
      ean13: string | null;
      quantity: number;
      unitValue: number;
      totalValue: number;
      cfop: string | null;
      cst: string | null;
      productId: string | null;
    }[] = [];

    for (const detItem of (det || [])) {
      const d = detItem as Record<string, unknown>;
      const prod = ((d.prod as unknown[])[0]) as Record<string, unknown>;
      const imposto = d.imposto ? ((d.imposto as unknown[])[0]) as Record<string, unknown> : null;

      const description = firstVal(prod.xProd);
      const ean13Raw = firstVal(prod.cEAN);
      const ean13 = ean13Raw && ean13Raw !== 'SEM GTIN' ? ean13Raw : null;
      const quantity = parseFloat(firstVal(prod.qCom));
      const unitValue = parseFloat(firstVal(prod.vUnCom));
      const totalValue = parseFloat(firstVal(prod.vProd));
      const cfop = firstVal(prod.CFOP) || null;

      let cst: string | null = null;
      if (imposto) {
        const icms = imposto.ICMS ? ((imposto.ICMS as unknown[])[0]) as Record<string, unknown> : null;
        if (icms) {
          const icmsKeys = Object.keys(icms);
          if (icmsKeys.length > 0) {
            const icmsGroup = ((icms[icmsKeys[0]] as unknown[])[0]) as Record<string, unknown>;
            cst = firstVal(icmsGroup.CST || icmsGroup.CSOSN) || null;
          }
        }
      }

      let productId: string | null = null;
      if (ean13) {
        const product = await prisma.product.findUnique({ where: { ean13 } });
        if (product) productId = product.id;
      }

      items.push({ description, ean13, quantity, unitValue, totalValue, cfop, cst, productId });
    }

    const nfe = await prisma.nFe.create({
      data: {
        key,
        number: nNF,
        series: serie,
        issuerName: xNome,
        issuerCnpj: cnpjEmit,
        totalValue: isNaN(vNF) ? 0 : vNF,
        issueDate: dhEmi ? new Date(dhEmi) : new Date(),
        status: 'pending',
        xmlContent,
        items: {
          create: items,
        },
      },
      include: { items: true },
    });

    res.status(201).json({ success: true, data: nfe });
  } catch (err) {
    console.error('NFe import error:', err);
    res.status(500).json({ success: false, error: 'Erro ao importar NF-e' });
  } finally {
    fs.unlinkSync(filePath);
  }
});

// GET /api/nfe
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const { status } = req.query;

    const where: Record<string, unknown> = {};
    if (status) where.status = status as string;

    const [nfes, total] = await Promise.all([
      prisma.nFe.findMany({
        skip,
        take: limit,
        where,
        include: { _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.nFe.count({ where }),
    ]);

    res.json({ success: true, data: nfes, total, page, limit });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar NF-es' });
  }
});

// GET /api/nfe/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nfe = await prisma.nFe.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });
    if (!nfe) {
      res.status(404).json({ success: false, error: 'NF-e não encontrada' });
      return;
    }
    res.json({ success: true, data: nfe });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar NF-e' });
  }
});

// POST /api/nfe/:id/process
router.post('/:id/process', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { warehouseId } = req.body;
    if (!warehouseId) {
      res.status(400).json({ success: false, error: 'warehouseId é obrigatório' });
      return;
    }

    const nfe = await prisma.nFe.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });

    if (!nfe) {
      res.status(404).json({ success: false, error: 'NF-e não encontrada' });
      return;
    }

    if (nfe.status === 'processed') {
      res.status(409).json({ success: false, error: 'NF-e já processada' });
      return;
    }

    const movements = await prisma.$transaction(async (tx) => {
      const createdMovements = [];

      for (const item of nfe.items) {
        if (!item.productId) continue;

        const existing = await tx.stockBalance.findFirst({
          where: { productId: item.productId, warehouseId, batchId: null },
        });

        if (existing) {
          await tx.stockBalance.update({
            where: { id: existing.id },
            data: { quantity: { increment: item.quantity } },
          });
        } else {
          await tx.stockBalance.create({
            data: { productId: item.productId, warehouseId, quantity: item.quantity, batchId: null },
          });
        }

        const movement = await tx.stockMovement.create({
          data: {
            type: 'entry',
            productId: item.productId,
            warehouseId,
            quantity: item.quantity,
            unitCost: item.unitValue,
            totalCost: item.totalValue,
            referenceType: 'nfe',
            referenceId: nfe.id,
            notes: `NF-e ${nfe.number} - ${item.description}`,
            userId: req.user!.id,
          },
        });
        createdMovements.push(movement);
      }

      await tx.nFe.update({
        where: { id: nfe.id },
        data: { status: 'processed' },
      });

      return createdMovements;
    });

    res.json({ success: true, data: { movements, message: `${movements.length} movimentações criadas` } });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao processar NF-e' });
  }
});

export default router;

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/labels/product/:id
router.get('/product/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: { select: { id: true, name: true } },
        balances: {
          include: { warehouse: { select: { id: true, name: true, code: true } } },
        },
      },
    });

    if (!product) {
      res.status(404).json({ success: false, error: 'Produto não encontrado' });
      return;
    }

    const totalStock = product.balances.reduce((sum, b) => sum + b.quantity, 0);

    const labelData = {
      id: product.id,
      name: product.name,
      sku: product.sku,
      ean13: product.ean13,
      barcodeData: product.ean13 || product.sku,
      unit: product.unit,
      price: product.price,
      category: product.category?.name || null,
      totalStock,
      warehouses: product.balances.map((b) => ({
        warehouseName: b.warehouse.name,
        warehouseCode: b.warehouse.code,
        quantity: b.quantity,
      })),
    };

    res.json({ success: true, data: labelData });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao gerar dados da etiqueta' });
  }
});

// POST /api/labels/generate
router.post('/generate', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({ success: false, error: 'productIds deve ser um array não vazio' });
      return;
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        category: { select: { id: true, name: true } },
        balances: {
          include: { warehouse: { select: { id: true, name: true, code: true } } },
        },
      },
    });

    const labels = products.map((product) => {
      const totalStock = product.balances.reduce((sum, b) => sum + b.quantity, 0);
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        ean13: product.ean13,
        barcodeData: product.ean13 || product.sku,
        unit: product.unit,
        price: product.price,
        category: product.category?.name || null,
        totalStock,
        warehouses: product.balances.map((b) => ({
          warehouseName: b.warehouse.name,
          warehouseCode: b.warehouse.code,
          quantity: b.quantity,
        })),
      };
    });

    res.json({ success: true, data: labels, total: labels.length });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao gerar etiquetas' });
  }
});

export default router;

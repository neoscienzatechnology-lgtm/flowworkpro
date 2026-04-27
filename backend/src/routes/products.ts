import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/products
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const { search, categoryId, active } = req.query;

    const where: Record<string, unknown> = {};
    if (active !== undefined) where.active = active === 'true';
    if (categoryId) where.categoryId = categoryId as string;
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { sku: { contains: search as string } },
        { ean13: { contains: search as string } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        skip,
        take: limit,
        where,
        include: {
          category: { select: { id: true, name: true } },
          balances: { select: { quantity: true, warehouseId: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ success: true, data: products, total, page, limit });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar produtos' });
  }
});

// GET /api/products/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        balances: {
          include: {
            warehouse: { select: { id: true, name: true, code: true } },
            batch: true,
          },
        },
        batches: true,
      },
    });
    if (!product) {
      res.status(404).json({ success: false, error: 'Produto não encontrado' });
      return;
    }
    res.json({ success: true, data: product });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar produto' });
  }
});

// POST /api/products
router.post('/', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, ean13, unit, minStock, cost, price, categoryId, active } = req.body;
    let { sku } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Nome é obrigatório' });
      return;
    }

    if (!sku) {
      sku = `PROD-${Date.now()}`;
    }

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        description,
        ean13: ean13 || null,
        unit: unit || 'UN',
        minStock: minStock || 0,
        cost: cost || 0,
        price: price || 0,
        categoryId: categoryId || null,
        active: active !== undefined ? active : true,
      },
      include: { category: { select: { id: true, name: true } } },
    });

    res.status(201).json({ success: true, data: product });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao criar produto' });
  }
});

// PUT /api/products/:id
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sku, name, description, ean13, unit, minStock, cost, price, categoryId, active } = req.body;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(sku !== undefined && { sku }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(ean13 !== undefined && { ean13 }),
        ...(unit !== undefined && { unit }),
        ...(minStock !== undefined && { minStock }),
        ...(cost !== undefined && { cost }),
        ...(price !== undefined && { price }),
        ...(categoryId !== undefined && { categoryId }),
        ...(active !== undefined && { active }),
      },
      include: { category: { select: { id: true, name: true } } },
    });

    res.json({ success: true, data: product });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao atualizar produto' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { active: false },
    });
    res.json({ success: true, data: { message: 'Produto desativado com sucesso' } });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao desativar produto' });
  }
});

export default router;

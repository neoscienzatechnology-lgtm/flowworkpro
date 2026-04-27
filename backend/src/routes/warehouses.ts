import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/warehouses
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const activeOnly = req.query.active !== 'false';

    const where = activeOnly ? { active: true } : {};

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        skip,
        take: limit,
        where,
        orderBy: { name: 'asc' },
      }),
      prisma.warehouse.count({ where }),
    ]);

    res.json({ success: true, data: warehouses, total, page, limit });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar depósitos' });
  }
});

// GET /api/warehouses/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { balances: true, movements: true } } },
    });
    if (!warehouse) {
      res.status(404).json({ success: false, error: 'Depósito não encontrado' });
      return;
    }
    res.json({ success: true, data: warehouse });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar depósito' });
  }
});

// POST /api/warehouses
router.post('/', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, address } = req.body;
    if (!name || !code) {
      res.status(400).json({ success: false, error: 'Nome e código são obrigatórios' });
      return;
    }

    const warehouse = await prisma.warehouse.create({
      data: { name, code, address },
    });
    res.status(201).json({ success: true, data: warehouse });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao criar depósito' });
  }
});

// PUT /api/warehouses/:id
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, address, active } = req.body;
    const warehouse = await prisma.warehouse.update({
      where: { id: req.params.id },
      data: { name, code, address, active },
    });
    res.json({ success: true, data: warehouse });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao atualizar depósito' });
  }
});

// DELETE /api/warehouses/:id
router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.warehouse.update({
      where: { id: req.params.id },
      data: { active: false },
    });
    res.json({ success: true, data: { message: 'Depósito desativado com sucesso' } });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao desativar depósito' });
  }
});

export default router;

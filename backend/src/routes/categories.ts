import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/categories
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        skip,
        take: limit,
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.category.count(),
    ]);

    res.json({ success: true, data: categories, total, page, limit });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar categorias' });
  }
});

// GET /api/categories/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) {
      res.status(404).json({ success: false, error: 'Categoria não encontrada' });
      return;
    }
    res.json({ success: true, data: category });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar categoria' });
  }
});

// POST /api/categories
router.post('/', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'Nome é obrigatório' });
      return;
    }

    const category = await prisma.category.create({
      data: { name, description },
    });
    res.status(201).json({ success: true, data: category });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao criar categoria' });
  }
});

// PUT /api/categories/:id
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name, description },
    });
    res.json({ success: true, data: category });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao atualizar categoria' });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: 'Categoria removida com sucesso' } });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao remover categoria' });
  }
});

export default router;

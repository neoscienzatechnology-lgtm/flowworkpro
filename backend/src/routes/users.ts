import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/users
router.get('/', authorize('admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.count(),
    ]);

    res.json({ success: true, data: users, total, page, limit });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// GET /api/users/:id
router.get('/:id', authorize('admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, updatedAt: true },
    });
    if (!user) {
      res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// POST /api/users
router.post(
  '/',
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('Nome obrigatório'),
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('Senha mínima 6 caracteres'),
    body('role').isIn(['admin', 'manager', 'operator', 'viewer']).withMessage('Role inválida'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: errors.array()[0].msg });
      return;
    }

    const { name, email, password, role } = req.body as {
      name: string;
      email: string;
      password: string;
      role: string;
    };

    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ success: false, error: 'Email já cadastrado' });
        return;
      }

      const hashed = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { name, email, password: hashed, role },
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      });

      res.status(201).json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  }
);

// PUT /api/users/:id
router.put(
  '/:id',
  authorize('admin'),
  [
    body('name').optional().notEmpty().withMessage('Nome não pode ser vazio'),
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('password').optional().isLength({ min: 6 }).withMessage('Senha mínima 6 caracteres'),
    body('role').optional().isIn(['admin', 'manager', 'operator', 'viewer']).withMessage('Role inválida'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: errors.array()[0].msg });
      return;
    }

    const { name, email, password, role, active } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      active?: boolean;
    };

    try {
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (role !== undefined) updateData.role = role;
      if (active !== undefined) updateData.active = active;
      if (password !== undefined) updateData.password = await bcrypt.hash(password, 12);

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: updateData,
        select: { id: true, name: true, email: true, role: true, active: true, updatedAt: true },
      });

      res.json({ success: true, data: user });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2025') {
        res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        return;
      }
      res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  }
);

// DELETE /api/users/:id
router.delete('/:id', authorize('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.params.id === req.user!.id) {
      res.status(400).json({ success: false, error: 'Não é possível excluir o próprio usuário' });
      return;
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: 'Usuário excluído com sucesso' } });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      return;
    }
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

export default router;

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.post('/harnesses', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sku, internalCode, name, description, unit, cost, price, categoryId, location } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Nome do chicote e obrigatorio' });
      return;
    }

    const harness = await prisma.product.create({
      data: {
        sku: sku || `CH-${Date.now()}`,
        internalCode: internalCode || null,
        name,
        description: description || null,
        unit: unit || 'UN',
        cost: cost || 0,
        price: price || 0,
        categoryId: categoryId || null,
        location: location || null,
        type: 'harness',
        active: true,
      },
    });

    res.status(201).json({ success: true, data: harness });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao criar chicote para BOM' });
  }
});

// GET /api/bom/:harnessId â€” get full BOM for a harness
router.get('/:harnessId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { harnessId } = req.params;

    const harness = await prisma.product.findUnique({
      where: { id: harnessId },
      select: { id: true, sku: true, name: true, type: true },
    });

    if (!harness) {
      res.status(404).json({ success: false, error: 'Produto nÃ£o encontrado' });
      return;
    }

    if (harness.type !== 'harness') {
      res.status(400).json({ success: false, error: 'Produto nÃ£o Ã© um chicote' });
      return;
    }

    const items = await prisma.bomItem.findMany({
      where: { harnessId },
      include: {
        component: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            cost: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: { harness, items } });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar BOM' });
  }
});

// POST /api/bom/:harnessId/items â€” add/update item
router.post('/:harnessId/items', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { harnessId } = req.params;
    const { componentId, quantity, notes } = req.body;

    if (!componentId || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, error: 'componentId e quantity (>0) sÃ£o obrigatÃ³rios' });
      return;
    }

    const harness = await prisma.product.findUnique({ where: { id: harnessId } });
    if (!harness || harness.type !== 'harness') {
      res.status(404).json({ success: false, error: 'Chicote nÃ£o encontrado' });
      return;
    }

    if (harnessId === componentId) {
      res.status(400).json({ success: false, error: 'Um chicote nÃ£o pode referenciar a si mesmo' });
      return;
    }

    const component = await prisma.product.findUnique({ where: { id: componentId } });
    if (!component) {
      res.status(404).json({ success: false, error: 'Componente nÃ£o encontrado' });
      return;
    }

    const item = await prisma.bomItem.upsert({
      where: { harnessId_componentId: { harnessId, componentId } },
      update: { quantity, notes: notes ?? undefined },
      create: { harnessId, componentId, quantity, notes: notes ?? null },
      include: {
        component: { select: { id: true, sku: true, name: true, unit: true } },
      },
    });

    res.status(201).json({ success: true, data: item });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao adicionar item ao BOM' });
  }
});

// PUT /api/bom/:harnessId/items/:itemId â€” update quantity/notes
router.put('/:harnessId/items/:itemId', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { harnessId, itemId } = req.params;
    const { quantity, notes } = req.body;

    const existing = await prisma.bomItem.findFirst({
      where: { id: itemId, harnessId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Item de BOM nÃ£o encontrado' });
      return;
    }

    const item = await prisma.bomItem.update({
      where: { id: itemId },
      data: {
        ...(quantity !== undefined && { quantity }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        component: { select: { id: true, sku: true, name: true, unit: true } },
      },
    });

    res.json({ success: true, data: item });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao atualizar item do BOM' });
  }
});

// DELETE /api/bom/:harnessId/items/:itemId â€” remove item
router.delete('/:harnessId/items/:itemId', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { harnessId, itemId } = req.params;

    const existing = await prisma.bomItem.findFirst({
      where: { id: itemId, harnessId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Item de BOM nÃ£o encontrado' });
      return;
    }

    await prisma.bomItem.delete({ where: { id: itemId } });

    res.json({ success: true, data: { message: 'Item removido do BOM' } });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao remover item do BOM' });
  }
});

// GET /api/bom/:harnessId/feasibility?quantity=1&warehouseId= â€” check stock feasibility
router.get('/:harnessId/feasibility', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { harnessId } = req.params;
    const quantity = parseFloat(req.query.quantity as string) || 1;
    const warehouseId = req.query.warehouseId as string | undefined;

    const harness = await prisma.product.findUnique({ where: { id: harnessId } });
    if (!harness || harness.type !== 'harness') {
      res.status(404).json({ success: false, error: 'Chicote nÃ£o encontrado' });
      return;
    }

    const bomItems = await prisma.bomItem.findMany({
      where: { harnessId },
      include: {
        component: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            balances: {
              where: warehouseId ? { warehouseId } : {},
              select: { quantity: true, warehouseId: true },
            },
          },
        },
      },
    });

    const feasibility = bomItems.map((item) => {
      const required = item.quantity * quantity;
      const available = item.component.balances.reduce((sum, b) => sum + b.quantity, 0);
      return {
        componentId: item.componentId,
        sku: item.component.sku,
        name: item.component.name,
        unit: item.component.unit,
        required,
        available,
        sufficient: available >= required,
      };
    });

    const allSufficient = feasibility.every((f) => f.sufficient);

    res.json({ success: true, data: { feasibility, allSufficient } });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao verificar viabilidade' });
  }
});

export default router;


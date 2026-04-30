import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper: upsert stock balance
async function upsertBalance(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  productId: string,
  warehouseId: string,
  quantityDelta: number
) {
  const existing = await tx.stockBalance.findFirst({
    where: { productId, warehouseId, batchId: null },
  });

  if (existing) {
    await tx.stockBalance.update({
      where: { id: existing.id },
      data: { quantity: { increment: quantityDelta } },
    });
  } else {
    await tx.stockBalance.create({
      data: { productId, warehouseId, batchId: null, quantity: quantityDelta },
    });
  }
}

// GET /api/assembly — list orders (paginated, filterable)
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const { status, harnessId } = req.query;

    const where: Record<string, unknown> = {};
    if (status) where.status = status as string;
    if (harnessId) where.harnessId = harnessId as string;

    const [orders, total] = await Promise.all([
      prisma.assemblyOrder.findMany({
        skip,
        take: limit,
        where,
        include: {
          harness: { select: { id: true, sku: true, name: true, unit: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.assemblyOrder.count({ where }),
    ]);

    res.json({ success: true, data: orders, total, page, limit });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar ordens de montagem' });
  }
});

// GET /api/assembly/:id — detail with items
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await prisma.assemblyOrder.findUnique({
      where: { id: req.params.id },
      include: {
        harness: { select: { id: true, sku: true, name: true, unit: true } },
        user: { select: { id: true, name: true } },
        items: {
          include: {
            component: { select: { id: true, sku: true, name: true, unit: true } },
          },
        },
      },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Ordem de montagem não encontrada' });
      return;
    }

    res.json({ success: true, data: order });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar ordem de montagem' });
  }
});

// POST /api/assembly — create order
router.post('/', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { harnessId, warehouseId, quantity, notes } = req.body;

    if (!harnessId || !warehouseId || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, error: 'harnessId, warehouseId e quantity (>0) são obrigatórios' });
      return;
    }

    const harness = await prisma.product.findUnique({ where: { id: harnessId } });
    if (!harness || harness.type !== 'harness') {
      res.status(404).json({ success: false, error: 'Chicote não encontrado' });
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
              where: { warehouseId },
              select: { quantity: true },
            },
          },
        },
      },
    });

    if (bomItems.length === 0) {
      res.status(400).json({ success: false, error: 'Chicote não possui BOM definido' });
      return;
    }

    // Generate order code: OM-YYYYMMDD-seq
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const todayCount = await prisma.assemblyOrder.count({
      where: {
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
    });
    const seq = String(todayCount + 1).padStart(3, '0');
    const code = `OM-${dateStr}-${seq}`;

    // Check feasibility (warn but allow)
    const feasibilityWarnings: string[] = [];
    for (const item of bomItems) {
      const required = item.quantity * quantity;
      const available = item.component.balances.reduce((s, b) => s + b.quantity, 0);
      if (available < required) {
        feasibilityWarnings.push(
          `${item.component.sku} ${item.component.name}: necessário ${required} ${item.component.unit}, disponível ${available}`
        );
      }
    }

    // Create order + items in transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.assemblyOrder.create({
        data: {
          code,
          harnessId,
          warehouseId,
          quantity,
          notes: notes ?? null,
          userId: req.user!.id,
          items: {
            create: bomItems.map((item) => ({
              componentId: item.componentId,
              requiredQty: item.quantity * quantity,
              consumedQty: 0,
              sourceWarehouseId: warehouseId,
            })),
          },
        },
        include: {
          harness: { select: { id: true, sku: true, name: true, unit: true } },
          user: { select: { id: true, name: true } },
          items: {
            include: {
              component: { select: { id: true, sku: true, name: true, unit: true } },
            },
          },
        },
      });
      return newOrder;
    });

    res.status(201).json({
      success: true,
      data: order,
      warnings: feasibilityWarnings.length > 0 ? feasibilityWarnings : undefined,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao criar ordem de montagem' });
  }
});

// POST /api/assembly/:id/execute — execute order
router.post('/:id/execute', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await prisma.assemblyOrder.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Ordem de montagem não encontrada' });
      return;
    }

    if (order.status !== 'pending') {
      res.status(400).json({ success: false, error: `Ordem não pode ser executada (status: ${order.status})` });
      return;
    }

    // Check stock for all components before transacting
    const missing: string[] = [];
    for (const item of order.items) {
      const srcWarehouseId = item.sourceWarehouseId || order.warehouseId;
      const balance = await prisma.stockBalance.findFirst({
        where: { productId: item.componentId, warehouseId: srcWarehouseId, batchId: null },
        include: { product: { select: { sku: true, name: true, unit: true } } },
      });

      const available = balance ? balance.quantity : 0;
      if (available < item.requiredQty) {
        missing.push(
          `${balance?.product.sku ?? item.componentId}: necessário ${item.requiredQty}, disponível ${available}`
        );
      }
    }

    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Estoque insuficiente para executar a ordem',
        missing,
      });
      return;
    }

    // Execute in a transaction
    const completed = await prisma.$transaction(async (tx) => {
      // 1. Consume each component
      for (const item of order.items) {
        const srcWarehouseId = item.sourceWarehouseId || order.warehouseId;

        // Deduct stock
        const balance = await tx.stockBalance.findFirst({
          where: { productId: item.componentId, warehouseId: srcWarehouseId, batchId: null },
        });
        await tx.stockBalance.update({
          where: { id: balance!.id },
          data: { quantity: { decrement: item.requiredQty } },
        });

        // Exit movement for component
        await tx.stockMovement.create({
          data: {
            type: 'exit',
            productId: item.componentId,
            warehouseId: srcWarehouseId,
            quantity: item.requiredQty,
            referenceType: 'assembly',
            referenceId: order.id,
            notes: `Consumo OM ${order.code}`,
            userId: req.user!.id,
          },
        });

        // Update consumedQty
        await tx.assemblyOrderItem.update({
          where: { id: item.id },
          data: { consumedQty: item.requiredQty },
        });
      }

      // 2. Entry movement for finished harness
      await upsertBalance(tx, order.harnessId, order.warehouseId, order.quantity);
      await tx.stockMovement.create({
        data: {
          type: 'entry',
          productId: order.harnessId,
          warehouseId: order.warehouseId,
          quantity: order.quantity,
          referenceType: 'assembly',
          referenceId: order.id,
          notes: `Produção OM ${order.code}`,
          userId: req.user!.id,
        },
      });

      // 3. Complete the order
      const updated = await tx.assemblyOrder.update({
        where: { id: order.id },
        data: { status: 'completed', completedAt: new Date() },
        include: {
          harness: { select: { id: true, sku: true, name: true, unit: true } },
          user: { select: { id: true, name: true } },
          items: {
            include: {
              component: { select: { id: true, sku: true, name: true, unit: true } },
            },
          },
        },
      });
      return updated;
    });

    res.json({ success: true, data: completed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao executar ordem de montagem';
    res.status(500).json({ success: false, error: msg });
  }
});

// POST /api/assembly/:id/cancel — cancel order
router.post('/:id/cancel', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await prisma.assemblyOrder.findUnique({ where: { id: req.params.id } });

    if (!order) {
      res.status(404).json({ success: false, error: 'Ordem de montagem não encontrada' });
      return;
    }

    if (order.status !== 'pending') {
      res.status(400).json({ success: false, error: `Apenas ordens pendentes podem ser canceladas (status: ${order.status})` });
      return;
    }

    const updated = await prisma.assemblyOrder.update({
      where: { id: order.id },
      data: { status: 'cancelled' },
      include: {
        harness: { select: { id: true, sku: true, name: true } },
      },
    });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao cancelar ordem de montagem' });
  }
});

export default router;

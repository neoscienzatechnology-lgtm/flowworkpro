import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

async function upsertBalance(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  productId: string,
  warehouseId: string,
  batchId: string | null,
  quantityDelta: number
) {
  const existing = await tx.stockBalance.findFirst({
    where: {
      productId,
      warehouseId,
      batchId: batchId ?? null,
    },
  });

  if (existing) {
    await tx.stockBalance.update({
      where: { id: existing.id },
      data: { quantity: { increment: quantityDelta } },
    });
  } else {
    await tx.stockBalance.create({
      data: {
        productId,
        warehouseId,
        batchId: batchId ?? null,
        quantity: quantityDelta,
      },
    });
  }
}

// POST /api/movements/entry
router.post('/entry', authenticate, authorize('admin', 'manager', 'operator'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, warehouseId, batchId, quantity, unitCost, notes, referenceType, referenceId } = req.body;

    if (!productId || !warehouseId || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, error: 'productId, warehouseId e quantity (>0) são obrigatórios' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      await upsertBalance(tx, productId, warehouseId, batchId || null, quantity);

      const movement = await tx.stockMovement.create({
        data: {
          type: 'entry',
          productId,
          warehouseId,
          batchId: batchId || null,
          quantity,
          unitCost: unitCost || null,
          totalCost: unitCost ? unitCost * quantity : null,
          referenceType: referenceType || 'manual',
          referenceId: referenceId || null,
          notes: notes || null,
          userId: req.user!.id,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
        },
      });
      return movement;
    });

    res.status(201).json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao registrar entrada' });
  }
});

// POST /api/movements/exit
router.post('/exit', authenticate, authorize('admin', 'manager', 'operator'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, warehouseId, batchId, quantity, unitCost, notes, referenceType, referenceId } = req.body;

    if (!productId || !warehouseId || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, error: 'productId, warehouseId e quantity (>0) são obrigatórios' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const balance = await tx.stockBalance.findFirst({
        where: { productId, warehouseId, batchId: batchId || null },
      });

      if (!balance || balance.quantity < quantity) {
        throw new Error('Saldo insuficiente para realizar a saída');
      }

      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: { decrement: quantity } },
      });

      const movement = await tx.stockMovement.create({
        data: {
          type: 'exit',
          productId,
          warehouseId,
          batchId: batchId || null,
          quantity,
          unitCost: unitCost || null,
          totalCost: unitCost ? unitCost * quantity : null,
          referenceType: referenceType || 'manual',
          referenceId: referenceId || null,
          notes: notes || null,
          userId: req.user!.id,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
        },
      });
      return movement;
    });

    res.status(201).json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao registrar saída';
    res.status(400).json({ success: false, error: msg });
  }
});

// POST /api/movements/transfer
router.post('/transfer', authenticate, authorize('admin', 'manager', 'operator'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, fromWarehouseId, toWarehouseId, batchId, quantity, notes } = req.body;

    if (!productId || !fromWarehouseId || !toWarehouseId || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, error: 'productId, fromWarehouseId, toWarehouseId e quantity são obrigatórios' });
      return;
    }

    if (fromWarehouseId === toWarehouseId) {
      res.status(400).json({ success: false, error: 'Depósitos de origem e destino devem ser diferentes' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const balance = await tx.stockBalance.findFirst({
        where: { productId, warehouseId: fromWarehouseId, batchId: batchId || null },
      });

      if (!balance || balance.quantity < quantity) {
        throw new Error('Saldo insuficiente no depósito de origem');
      }

      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: { decrement: quantity } },
      });

      await upsertBalance(tx, productId, toWarehouseId, batchId || null, quantity);

      const movement = await tx.stockMovement.create({
        data: {
          type: 'transfer',
          productId,
          warehouseId: fromWarehouseId,
          toWarehouseId,
          batchId: batchId || null,
          quantity,
          notes: notes || null,
          userId: req.user!.id,
          referenceType: 'manual',
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
        },
      });
      return movement;
    });

    res.status(201).json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao realizar transferência';
    res.status(400).json({ success: false, error: msg });
  }
});

// POST /api/movements/adjustment
router.post('/adjustment', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, warehouseId, batchId, newQuantity, notes } = req.body;

    if (!productId || !warehouseId || newQuantity === undefined) {
      res.status(400).json({ success: false, error: 'productId, warehouseId e newQuantity são obrigatórios' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const balance = await tx.stockBalance.findFirst({
        where: { productId, warehouseId, batchId: batchId || null },
      });

      const currentQty = balance ? balance.quantity : 0;
      const delta = newQuantity - currentQty;

      if (balance) {
        await tx.stockBalance.update({
          where: { id: balance.id },
          data: { quantity: newQuantity },
        });
      } else {
        await tx.stockBalance.create({
          data: { productId, warehouseId, batchId: batchId || null, quantity: newQuantity },
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          type: 'adjustment',
          productId,
          warehouseId,
          batchId: batchId || null,
          quantity: delta,
          notes: notes || `Ajuste de estoque: ${currentQty} -> ${newQuantity}`,
          userId: req.user!.id,
          referenceType: 'adjustment',
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
        },
      });
      return movement;
    });

    res.status(201).json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao ajustar estoque' });
  }
});

// GET /api/movements
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const { productId, warehouseId, type, dateFrom, dateTo } = req.query;

    const where: Record<string, unknown> = {};
    if (productId) where.productId = productId as string;
    if (warehouseId) where.warehouseId = warehouseId as string;
    if (type) where.type = type as string;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom && { gte: new Date(dateFrom as string) }),
        ...(dateTo && { lte: new Date(dateTo as string) }),
      };
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        skip,
        take: limit,
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          batch: { select: { id: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.json({ success: true, data: movements, total, page, limit });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar movimentações' });
  }
});

export default router;

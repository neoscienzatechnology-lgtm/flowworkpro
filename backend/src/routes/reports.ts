import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/reports/abc-curve
router.get('/abc-curve', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { warehouseId } = req.query;

    const where: Record<string, unknown> = {};
    if (warehouseId) where.warehouseId = warehouseId as string;

    const balances = await prisma.stockBalance.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, cost: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });

    // Group by product
    const productMap = new Map<string, { product: { id: string; name: string; sku: string; cost: number }; totalQty: number; totalValue: number }>();
    for (const b of balances) {
      const existing = productMap.get(b.productId);
      const value = b.quantity * b.product.cost;
      if (existing) {
        existing.totalQty += b.quantity;
        existing.totalValue += value;
      } else {
        productMap.set(b.productId, {
          product: b.product,
          totalQty: b.quantity,
          totalValue: value,
        });
      }
    }

    const items = Array.from(productMap.values()).sort((a, b) => b.totalValue - a.totalValue);
    const grandTotal = items.reduce((sum, i) => sum + i.totalValue, 0);

    let cumulative = 0;
    const result = items.map((item, idx) => {
      cumulative += item.totalValue;
      const cumulativePct = grandTotal > 0 ? (cumulative / grandTotal) * 100 : 0;
      const itemPct = grandTotal > 0 ? (item.totalValue / grandTotal) * 100 : 0;

      let curve: string;
      if (cumulativePct <= 80) curve = 'A';
      else if (cumulativePct <= 95) curve = 'B';
      else curve = 'C';

      return {
        rank: idx + 1,
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        totalQuantity: item.totalQty,
        totalValue: item.totalValue,
        percentageOfTotal: itemPct,
        cumulativePercentage: cumulativePct,
        curve,
      };
    });

    res.json({ success: true, data: result, total: result.length });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao gerar curva ABC' });
  }
});

// GET /api/reports/fefo
router.get('/fefo', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { warehouseId } = req.query;
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      batch: {
        expiryDate: {
          not: null,
          lte: in30Days,
          gte: now,
        },
      },
      quantity: { gt: 0 },
    };
    if (warehouseId) where.warehouseId = warehouseId as string;

    const balances = await prisma.stockBalance.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true } },
        batch: true,
      },
      orderBy: { batch: { expiryDate: 'asc' } },
    });

    res.json({ success: true, data: balances, total: balances.length });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao gerar relatório FEFO' });
  }
});

// GET /api/reports/stock-rotation
router.get('/stock-rotation', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { warehouseId, days } = req.query;
    const periodDays = parseInt(days as string) || 30;
    const dateFrom = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const movWhere: Record<string, unknown> = {
      createdAt: { gte: dateFrom },
    };
    if (warehouseId) movWhere.warehouseId = warehouseId as string;

    const movements = await prisma.stockMovement.findMany({
      where: movWhere,
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
    });

    const rotationMap = new Map<string, { product: { id: string; name: string; sku: string }; entries: number; exits: number; transfers: number; adjustments: number }>();

    for (const mov of movements) {
      const existing = rotationMap.get(mov.productId);
      if (!existing) {
        rotationMap.set(mov.productId, {
          product: mov.product,
          entries: 0,
          exits: 0,
          transfers: 0,
          adjustments: 0,
        });
      }
      const entry = rotationMap.get(mov.productId)!;
      if (mov.type === 'entry') entry.entries += mov.quantity;
      else if (mov.type === 'exit') entry.exits += mov.quantity;
      else if (mov.type === 'transfer') entry.transfers += mov.quantity;
      else if (mov.type === 'adjustment') entry.adjustments += mov.quantity;
    }

    const result = Array.from(rotationMap.values()).map((r) => ({
      ...r,
      totalMovements: r.entries + r.exits + r.transfers + Math.abs(r.adjustments),
    })).sort((a, b) => b.totalMovements - a.totalMovements);

    res.json({ success: true, data: result, total: result.length, periodDays });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao calcular giro de estoque' });
  }
});

// GET /api/reports/kpis
router.get('/kpis', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { warehouseId } = req.query;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const balanceWhere: Record<string, unknown> = {};
    if (warehouseId) balanceWhere.warehouseId = warehouseId as string;

    const [
      totalProducts,
      balances,
      movementsThisMonth,
      pendingNFes,
    ] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.stockBalance.findMany({
        where: balanceWhere,
        include: { product: { select: { cost: true, minStock: true } } },
      }),
      prisma.stockMovement.count({ where: { createdAt: { gte: startOfMonth }, ...(warehouseId ? { warehouseId: warehouseId as string } : {}) } }),
      prisma.nFe.count({ where: { status: 'pending' } }),
    ]);

    const totalValue = balances.reduce((sum, b) => sum + b.quantity * b.product.cost, 0);

    // Group by product+warehouse to find low stock
    const stockByProduct = new Map<string, { quantity: number; minStock: number }>();
    for (const b of balances) {
      const key = `${b.productId}-${b.warehouseId}`;
      const existing = stockByProduct.get(key);
      if (existing) {
        existing.quantity += b.quantity;
      } else {
        stockByProduct.set(key, { quantity: b.quantity, minStock: b.product.minStock });
      }
    }
    const lowStockCount = Array.from(stockByProduct.values()).filter((s) => s.quantity <= s.minStock).length;

    res.json({
      success: true,
      data: {
        totalProducts,
        totalStockValue: totalValue,
        lowStockCount,
        movementsThisMonth,
        pendingNFes,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao calcular KPIs' });
  }
});

export default router;

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/alerts
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unread !== 'false';

    const where: Record<string, unknown> = {};
    if (unreadOnly) where.read = false;

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        skip,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.alert.count({ where }),
    ]);

    res.json({ success: true, data: alerts, total, page, limit });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao buscar alertas' });
  }
});

// PUT /api/alerts/:id/read
router.put('/:id/read', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json({ success: true, data: alert });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao marcar alerta como lido' });
  }
});

// POST /api/alerts/check
router.post('/check', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Check min stock
    const products = await prisma.product.findMany({
      where: { active: true },
      include: { balances: true },
    });

    const newAlerts: { productId: string; warehouseId: string; type: string; message: string }[] = [];

    for (const product of products) {
      const warehouseQtyMap = new Map<string, number>();
      for (const balance of product.balances) {
        const current = warehouseQtyMap.get(balance.warehouseId) || 0;
        warehouseQtyMap.set(balance.warehouseId, current + balance.quantity);
      }

      for (const [warehouseId, qty] of warehouseQtyMap.entries()) {
        if (qty <= product.minStock) {
          const existingAlert = await prisma.alert.findFirst({
            where: { productId: product.id, warehouseId, type: 'min_stock', read: false },
          });
          if (!existingAlert) {
            newAlerts.push({
              productId: product.id,
              warehouseId,
              type: 'min_stock',
              message: `Estoque mínimo atingido para ${product.name}: ${qty} ${product.unit} (mínimo: ${product.minStock})`,
            });
          }
        }
      }
    }

    // Check expiry
    const nearExpiryBalances = await prisma.stockBalance.findMany({
      where: {
        quantity: { gt: 0 },
        batch: {
          expiryDate: { not: null, lte: in30Days, gte: now },
        },
      },
      include: {
        product: { select: { id: true, name: true } },
        batch: { select: { id: true, code: true, expiryDate: true } },
      },
    });

    for (const balance of nearExpiryBalances) {
      if (!balance.batch?.expiryDate) continue;
      const daysLeft = Math.ceil((balance.batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const existingAlert = await prisma.alert.findFirst({
        where: { productId: balance.productId, warehouseId: balance.warehouseId, type: 'expiry', read: false },
      });
      if (!existingAlert) {
        newAlerts.push({
          productId: balance.productId,
          warehouseId: balance.warehouseId,
          type: 'expiry',
          message: `Lote ${balance.batch.code} de ${balance.product.name} vence em ${daysLeft} dias`,
        });
      }
    }

    if (newAlerts.length > 0) {
      await prisma.alert.createMany({ data: newAlerts });
    }

    res.json({ success: true, data: { alertsCreated: newAlerts.length, alerts: newAlerts } });
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao verificar alertas' });
  }
});

export default router;

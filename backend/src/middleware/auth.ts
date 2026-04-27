import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'estoque-secret-key-2025';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Token não fornecido' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: string;
      name: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id, active: true },
      select: { id: true, email: true, role: true, name: true, active: true },
    });

    if (!user) {
      res.status(401).json({ success: false, error: 'Usuário não encontrado ou inativo' });
      return;
    }

    req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Não autenticado' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Acesso negado. Permissão insuficiente.' });
      return;
    }
    next();
  };
};

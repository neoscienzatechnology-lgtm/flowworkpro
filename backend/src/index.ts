import path from 'path';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = process.env.PORT || 3001;

// Serve frontend static files in local dev
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(require('express').static(frontendDist));
app.get('/{*splat}', (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`API disponível em: http://localhost:${PORT}/api`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

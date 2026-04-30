import { onRequest } from 'firebase-functions/v2/https';
import dotenv from 'dotenv';
dotenv.config();

import app from './app';

export const api = onRequest({ region: 'southamerica-east1', memory: '512MiB', timeoutSeconds: 60 }, app);

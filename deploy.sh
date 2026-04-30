#!/bin/bash
set -e

echo "🔨 Build do frontend..."
cd frontend && npm run build && cd ..

echo "🔨 Build do backend..."
cd backend && npm run build && cd ..

echo "🚀 Deploy para Firebase..."
firebase deploy

echo "✅ Deploy concluído!"

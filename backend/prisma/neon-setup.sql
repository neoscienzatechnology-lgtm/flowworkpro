-- ============================================================
-- FlowWork Pro — Schema PostgreSQL (Neon)
-- Cole este script inteiro no SQL Editor do Neon e execute
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS "User" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "name"      TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "password"  TEXT NOT NULL,
    "role"      TEXT NOT NULL DEFAULT 'operator',
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Company
CREATE TABLE IF NOT EXISTS "Company" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "name"      TEXT NOT NULL,
    "cnpj"      TEXT NOT NULL,
    "taxRegime" TEXT NOT NULL,
    "state"     TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "Company_cnpj_key" ON "Company"("cnpj");

-- Category
CREATE TABLE IF NOT EXISTS "Category" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_key" ON "Category"("name");

-- Warehouse
CREATE TABLE IF NOT EXISTS "Warehouse" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "name"      TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "address"   TEXT,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "Warehouse_code_key" ON "Warehouse"("code");

-- Product
CREATE TABLE IF NOT EXISTS "Product" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "sku"         TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "ean13"       TEXT,
    "unit"        TEXT NOT NULL DEFAULT 'UN',
    "minStock"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "type"        TEXT NOT NULL DEFAULT 'component',
    "categoryId"  TEXT REFERENCES "Category"("id") ON DELETE SET NULL,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_key"   ON "Product"("sku");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_ean13_key" ON "Product"("ean13");

-- Batch
CREATE TABLE IF NOT EXISTS "Batch" (
    "id"                TEXT NOT NULL PRIMARY KEY,
    "code"              TEXT NOT NULL,
    "productId"         TEXT NOT NULL REFERENCES "Product"("id"),
    "expiryDate"        TIMESTAMPTZ,
    "manufacturingDate" TIMESTAMPTZ,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "Batch_code_productId_key" ON "Batch"("code","productId");

-- StockBalance
CREATE TABLE IF NOT EXISTS "StockBalance" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "productId"   TEXT NOT NULL REFERENCES "Product"("id"),
    "warehouseId" TEXT NOT NULL REFERENCES "Warehouse"("id"),
    "batchId"     TEXT REFERENCES "Batch"("id") ON DELETE SET NULL,
    "quantity"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "StockBalance_productId_warehouseId_batchId_key"
    ON "StockBalance"("productId","warehouseId","batchId");

-- StockMovement
CREATE TABLE IF NOT EXISTS "StockMovement" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "type"          TEXT NOT NULL,
    "productId"     TEXT NOT NULL REFERENCES "Product"("id"),
    "warehouseId"   TEXT NOT NULL REFERENCES "Warehouse"("id"),
    "toWarehouseId" TEXT REFERENCES "Warehouse"("id") ON DELETE SET NULL,
    "batchId"       TEXT REFERENCES "Batch"("id") ON DELETE SET NULL,
    "quantity"      DOUBLE PRECISION NOT NULL,
    "unitCost"      DOUBLE PRECISION,
    "totalCost"     DOUBLE PRECISION,
    "referenceType" TEXT,
    "referenceId"   TEXT,
    "notes"         TEXT,
    "userId"        TEXT NOT NULL REFERENCES "User"("id"),
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NFe
CREATE TABLE IF NOT EXISTS "NFe" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "key"        TEXT NOT NULL,
    "number"     TEXT NOT NULL,
    "series"     TEXT NOT NULL,
    "issuerName" TEXT NOT NULL,
    "issuerCnpj" TEXT NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "issueDate"  TIMESTAMPTZ NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'pending',
    "xmlContent" TEXT NOT NULL,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "NFe_key_key" ON "NFe"("key");

-- NFeItem
CREATE TABLE IF NOT EXISTS "NFeItem" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "nfeId"       TEXT NOT NULL REFERENCES "NFe"("id"),
    "productId"   TEXT REFERENCES "Product"("id") ON DELETE SET NULL,
    "description" TEXT NOT NULL,
    "ean13"       TEXT,
    "quantity"    DOUBLE PRECISION NOT NULL,
    "unitValue"   DOUBLE PRECISION NOT NULL,
    "totalValue"  DOUBLE PRECISION NOT NULL,
    "cfop"        TEXT,
    "cst"         TEXT
);

-- Alert
CREATE TABLE IF NOT EXISTS "Alert" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "productId"   TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "message"     TEXT NOT NULL,
    "read"        BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BomItem
CREATE TABLE IF NOT EXISTS "BomItem" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "harnessId"   TEXT NOT NULL REFERENCES "Product"("id"),
    "componentId" TEXT NOT NULL REFERENCES "Product"("id"),
    "quantity"    DOUBLE PRECISION NOT NULL,
    "notes"       TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "BomItem_harnessId_componentId_key"
    ON "BomItem"("harnessId","componentId");

-- AssemblyOrder
CREATE TABLE IF NOT EXISTS "AssemblyOrder" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "code"        TEXT NOT NULL,
    "harnessId"   TEXT NOT NULL REFERENCES "Product"("id"),
    "warehouseId" TEXT NOT NULL,
    "quantity"    DOUBLE PRECISION NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "notes"       TEXT,
    "userId"      TEXT NOT NULL REFERENCES "User"("id"),
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "completedAt" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "AssemblyOrder_code_key" ON "AssemblyOrder"("code");

-- AssemblyOrderItem
CREATE TABLE IF NOT EXISTS "AssemblyOrderItem" (
    "id"                TEXT NOT NULL PRIMARY KEY,
    "orderId"           TEXT NOT NULL REFERENCES "AssemblyOrder"("id"),
    "componentId"       TEXT NOT NULL REFERENCES "Product"("id"),
    "requiredQty"       DOUBLE PRECISION NOT NULL,
    "consumedQty"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceWarehouseId" TEXT
);

-- Prisma migrations table (para o prisma migrate deploy reconhecer)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT NOT NULL PRIMARY KEY,
    "checksum"              TEXT NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "applied_steps_count"   INT NOT NULL DEFAULT 0
);

SELECT 'Schema criado com sucesso!' AS resultado;

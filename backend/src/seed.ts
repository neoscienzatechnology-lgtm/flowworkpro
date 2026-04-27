import bcrypt from 'bcryptjs';
import prisma from './lib/prisma';

async function main() {
  console.log('Iniciando seed do banco de dados...');

  // Users
  const adminPass = await bcrypt.hash('admin123', 10);
  const gestorPass = await bcrypt.hash('gestor123', 10);
  const opPass = await bcrypt.hash('op123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@estoque.com' },
    update: {},
    create: { name: 'Administrador', email: 'admin@estoque.com', password: adminPass, role: 'admin' },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'gestor@estoque.com' },
    update: {},
    create: { name: 'Gestor de Estoque', email: 'gestor@estoque.com', password: gestorPass, role: 'manager' },
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operador@estoque.com' },
    update: {},
    create: { name: 'Operador de Estoque', email: 'operador@estoque.com', password: opPass, role: 'operator' },
  });

  console.log('Usuários criados:', admin.email, manager.email, operator.email);

  // Company
  await prisma.company.upsert({
    where: { cnpj: '12345678000190' },
    update: {},
    create: {
      name: 'Empresa Demo Ltda',
      cnpj: '12345678000190',
      taxRegime: 'Simples Nacional',
      state: 'SP',
    },
  });

  console.log('Empresa criada');

  // Categories
  const eletronicos = await prisma.category.upsert({
    where: { name: 'Eletrônicos' },
    update: {},
    create: { name: 'Eletrônicos', description: 'Produtos eletrônicos e tecnologia' },
  });

  const alimentos = await prisma.category.upsert({
    where: { name: 'Alimentos' },
    update: {},
    create: { name: 'Alimentos', description: 'Alimentos e bebidas' },
  });

  const higiene = await prisma.category.upsert({
    where: { name: 'Higiene' },
    update: {},
    create: { name: 'Higiene', description: 'Produtos de higiene pessoal' },
  });

  console.log('Categorias criadas');

  // Warehouses
  const depCentral = await prisma.warehouse.upsert({
    where: { code: 'DEP-001' },
    update: {},
    create: {
      name: 'Depósito Central',
      code: 'DEP-001',
      address: 'Rua Principal, 100 - São Paulo, SP',
    },
  });

  const filialSP = await prisma.warehouse.upsert({
    where: { code: 'FIL-SP' },
    update: {},
    create: {
      name: 'Filial SP',
      code: 'FIL-SP',
      address: 'Av. Paulista, 1000 - São Paulo, SP',
    },
  });

  console.log('Depósitos criados');

  // Products
  const productsData = [
    { sku: 'ELET-001', name: 'Smartphone Samsung Galaxy A54', ean13: '7891234567890', unit: 'UN', minStock: 5, cost: 850, price: 1299, categoryId: eletronicos.id },
    { sku: 'ELET-002', name: 'Notebook Dell Inspiron 15', ean13: '7891234567891', unit: 'UN', minStock: 2, cost: 2500, price: 3799, categoryId: eletronicos.id },
    { sku: 'ELET-003', name: 'Fone de Ouvido Bluetooth JBL', ean13: '7891234567892', unit: 'UN', minStock: 10, cost: 120, price: 249, categoryId: eletronicos.id },
    { sku: 'ALIM-001', name: 'Arroz Agulhinha 5kg', ean13: '7891234567893', unit: 'PCT', minStock: 50, cost: 18, price: 28.90, categoryId: alimentos.id },
    { sku: 'ALIM-002', name: 'Feijão Carioca 1kg', ean13: '7891234567894', unit: 'PCT', minStock: 30, cost: 6.50, price: 9.90, categoryId: alimentos.id },
    { sku: 'ALIM-003', name: 'Azeite Extra Virgem 500ml', ean13: '7891234567895', unit: 'UN', minStock: 20, cost: 22, price: 38.90, categoryId: alimentos.id },
    { sku: 'ALIM-004', name: 'Macarrão Espaguete 500g', ean13: '7891234567896', unit: 'PCT', minStock: 40, cost: 4.50, price: 7.50, categoryId: alimentos.id },
    { sku: 'HIG-001', name: 'Shampoo Pantene 400ml', ean13: '7891234567897', unit: 'UN', minStock: 15, cost: 12, price: 22.90, categoryId: higiene.id },
    { sku: 'HIG-002', name: 'Sabonete Dove 90g', ean13: '7891234567898', unit: 'UN', minStock: 30, cost: 3.50, price: 6.90, categoryId: higiene.id },
    { sku: 'HIG-003', name: 'Creme Dental Colgate 90g', ean13: '7891234567899', unit: 'UN', minStock: 20, cost: 4, price: 7.50, categoryId: higiene.id },
  ];

  const createdProducts: Array<{ id: string; sku: string; name: string }> = [];
  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    });
    createdProducts.push(product);
  }

  console.log(`${createdProducts.length} produtos criados`);

  // Initial stock movements and balances
  const initialStock = [
    { productIdx: 0, warehouseId: depCentral.id, quantity: 25, unitCost: 850 },
    { productIdx: 1, warehouseId: depCentral.id, quantity: 8, unitCost: 2500 },
    { productIdx: 2, warehouseId: depCentral.id, quantity: 45, unitCost: 120 },
    { productIdx: 3, warehouseId: depCentral.id, quantity: 200, unitCost: 18 },
    { productIdx: 4, warehouseId: depCentral.id, quantity: 150, unitCost: 6.50 },
    { productIdx: 5, warehouseId: depCentral.id, quantity: 60, unitCost: 22 },
    { productIdx: 6, warehouseId: depCentral.id, quantity: 180, unitCost: 4.50 },
    { productIdx: 7, warehouseId: depCentral.id, quantity: 80, unitCost: 12 },
    { productIdx: 8, warehouseId: depCentral.id, quantity: 120, unitCost: 3.50 },
    { productIdx: 9, warehouseId: depCentral.id, quantity: 100, unitCost: 4 },
    { productIdx: 0, warehouseId: filialSP.id, quantity: 10, unitCost: 850 },
    { productIdx: 2, warehouseId: filialSP.id, quantity: 20, unitCost: 120 },
    { productIdx: 3, warehouseId: filialSP.id, quantity: 80, unitCost: 18 },
    { productIdx: 7, warehouseId: filialSP.id, quantity: 30, unitCost: 12 },
    { productIdx: 8, warehouseId: filialSP.id, quantity: 50, unitCost: 3.50 },
  ];

  for (const stock of initialStock) {
    const product = createdProducts[stock.productIdx];

    // Check if movement already exists
    const existingMovement = await prisma.stockMovement.findFirst({
      where: {
        productId: product.id,
        warehouseId: stock.warehouseId,
        type: 'entry',
        referenceType: 'manual',
        notes: 'Estoque inicial (seed)',
      },
    });

    if (!existingMovement) {
      await prisma.$transaction(async (tx) => {
        const existingBalance = await tx.stockBalance.findFirst({
          where: { productId: product.id, warehouseId: stock.warehouseId, batchId: null },
        });

        if (existingBalance) {
          await tx.stockBalance.update({
            where: { id: existingBalance.id },
            data: { quantity: { increment: stock.quantity } },
          });
        } else {
          await tx.stockBalance.create({
            data: {
              productId: product.id,
              warehouseId: stock.warehouseId,
              batchId: null,
              quantity: stock.quantity,
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            type: 'entry',
            productId: product.id,
            warehouseId: stock.warehouseId,
            quantity: stock.quantity,
            unitCost: stock.unitCost,
            totalCost: stock.unitCost * stock.quantity,
            referenceType: 'manual',
            notes: 'Estoque inicial (seed)',
            userId: admin.id,
          },
        });
      });
    }
  }

  console.log('Estoque inicial criado');
  console.log('\nSeed concluído com sucesso!');
  console.log('\nCredenciais de acesso:');
  console.log('  Admin: admin@estoque.com / admin123');
  console.log('  Gestor: gestor@estoque.com / gestor123');
  console.log('  Operador: operador@estoque.com / op123');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

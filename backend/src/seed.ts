import bcrypt from 'bcryptjs';
import prisma from './lib/prisma';

async function upsertBalance(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  productId: string,
  warehouseId: string,
  quantity: number,
  unitCost: number,
  userId: string,
  notes: string
) {
  const existing = await tx.stockBalance.findFirst({
    where: { productId, warehouseId, batchId: null },
  });
  if (existing) {
    await tx.stockBalance.update({
      where: { id: existing.id },
      data: { quantity: { increment: quantity } },
    });
  } else {
    await tx.stockBalance.create({
      data: { productId, warehouseId, batchId: null, quantity },
    });
  }
  await tx.stockMovement.create({
    data: {
      type: 'entry',
      productId,
      warehouseId,
      quantity,
      unitCost,
      totalCost: unitCost * quantity,
      referenceType: 'manual',
      notes,
      userId,
    },
  });
}

async function main() {
  console.log('Iniciando seed — Sistema de Chicote Elétrico...');

  // ── Users ──────────────────────────────────────────────────────────────────
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
    create: { name: 'Gestor de Produção', email: 'gestor@estoque.com', password: gestorPass, role: 'manager' },
  });
  await prisma.user.upsert({
    where: { email: 'operador@estoque.com' },
    update: {},
    create: { name: 'Operador de Almoxarifado', email: 'operador@estoque.com', password: opPass, role: 'operator' },
  });
  console.log('✓ Usuários criados');

  // ── Company ────────────────────────────────────────────────────────────────
  await prisma.company.upsert({
    where: { cnpj: '98765432000110' },
    update: {},
    create: {
      name: 'HarnessTech Indústria Ltda',
      cnpj: '98765432000110',
      taxRegime: 'Simples Nacional',
      state: 'SP',
    },
  });
  console.log('✓ Empresa criada');

  // ── Warehouses ─────────────────────────────────────────────────────────────
  const almox = await prisma.warehouse.upsert({
    where: { code: 'ALM-001' },
    update: {},
    create: { name: 'Almoxarifado Central', code: 'ALM-001', address: 'Rua Industrial, 200 - São Paulo, SP' },
  });
  const producao = await prisma.warehouse.upsert({
    where: { code: 'PROD-01' },
    update: {},
    create: { name: 'Linha de Produção', code: 'PROD-01', address: 'Rua Industrial, 200 - Bloco B - São Paulo, SP' },
  });
  await prisma.warehouse.upsert({
    where: { code: 'EXP-01' },
    update: {},
    create: { name: 'Expedição', code: 'EXP-01', address: 'Rua Industrial, 200 - Bloco C - São Paulo, SP' },
  });
  console.log('✓ Depósitos criados');

  // ── Categories ─────────────────────────────────────────────────────────────
  const catFios = await prisma.category.upsert({
    where: { name: 'Fios e Cabos' },
    update: {},
    create: { name: 'Fios e Cabos', description: 'Fios elétricos por bitola e cor' },
  });
  const catTerminais = await prisma.category.upsert({
    where: { name: 'Terminais' },
    update: {},
    create: { name: 'Terminais', description: 'Terminais elétricos de crimpagem' },
  });
  const catConectores = await prisma.category.upsert({
    where: { name: 'Conectores' },
    update: {},
    create: { name: 'Conectores', description: 'Conectores e housings' },
  });
  const catProtecao = await prisma.category.upsert({
    where: { name: 'Proteção e Acabamento' },
    update: {},
    create: { name: 'Proteção e Acabamento', description: 'Corrugado, fita, abraçadeiras, termocontrátil' },
  });
  const catChicotes = await prisma.category.upsert({
    where: { name: 'Chicotes Montados' },
    update: {},
    create: { name: 'Chicotes Montados', description: 'Chicotes elétricos prontos para expedição' },
  });
  console.log('✓ Categorias criadas');

  // ── Products — components ──────────────────────────────────────────────────
  const componentsData = [
    // Fios e Cabos
    { sku: 'FIO-05-VM', name: 'Fio 0,5mm² Vermelho', ean13: '7891234500001', unit: 'm', minStock: 100, cost: 0.85, price: 1.20, categoryId: catFios.id, type: 'component' },
    { sku: 'FIO-05-PT', name: 'Fio 0,5mm² Preto',    ean13: '7891234500002', unit: 'm', minStock: 100, cost: 0.85, price: 1.20, categoryId: catFios.id, type: 'component' },
    { sku: 'FIO-05-AZ', name: 'Fio 0,5mm² Azul',     ean13: '7891234500003', unit: 'm', minStock: 50,  cost: 0.85, price: 1.20, categoryId: catFios.id, type: 'component' },
    { sku: 'FIO-10-VE', name: 'Fio 1,0mm² Verde',    ean13: '7891234500004', unit: 'm', minStock: 50,  cost: 1.20, price: 1.80, categoryId: catFios.id, type: 'component' },
    { sku: 'FIO-15-AV', name: 'Fio 1,5mm² Amarelo/Verde', ean13: '7891234500005', unit: 'm', minStock: 30, cost: 1.60, price: 2.40, categoryId: catFios.id, type: 'component' },
    { sku: 'FIO-25-VM', name: 'Fio 2,5mm² Vermelho', ean13: '7891234500006', unit: 'm', minStock: 20,  cost: 2.80, price: 4.20, categoryId: catFios.id, type: 'component' },
    // Terminais
    { sku: 'TRM-F05',    name: 'Terminal Fêmea AMP 0,5mm²', ean13: '7891234500010', unit: 'UN', minStock: 500, cost: 0.28, price: 0.55, categoryId: catTerminais.id, type: 'component' },
    { sku: 'TRM-M05',    name: 'Terminal Macho AMP 0,5mm²', ean13: '7891234500011', unit: 'UN', minStock: 500, cost: 0.28, price: 0.55, categoryId: catTerminais.id, type: 'component' },
    { sku: 'TRM-OLH-M6', name: 'Terminal Olhal M6',         ean13: '7891234500012', unit: 'UN', minStock: 200, cost: 0.45, price: 0.90, categoryId: catTerminais.id, type: 'component' },
    { sku: 'TRM-GAR-M4', name: 'Terminal Garfo M4',         ean13: '7891234500013', unit: 'UN', minStock: 200, cost: 0.38, price: 0.75, categoryId: catTerminais.id, type: 'component' },
    // Conectores
    { sku: 'CON-2VF', name: 'Conector 2 Vias Fêmea', ean13: '7891234500020', unit: 'UN', minStock: 100, cost: 1.80, price: 3.20, categoryId: catConectores.id, type: 'component' },
    { sku: 'CON-2VM', name: 'Conector 2 Vias Macho', ean13: '7891234500021', unit: 'UN', minStock: 100, cost: 1.80, price: 3.20, categoryId: catConectores.id, type: 'component' },
    { sku: 'CON-4VF', name: 'Conector 4 Vias Fêmea', ean13: '7891234500022', unit: 'UN', minStock: 100, cost: 2.50, price: 4.50, categoryId: catConectores.id, type: 'component' },
    { sku: 'CON-4VM', name: 'Conector 4 Vias Macho', ean13: '7891234500023', unit: 'UN', minStock: 100, cost: 2.50, price: 4.50, categoryId: catConectores.id, type: 'component' },
    { sku: 'CON-6VF', name: 'Conector 6 Vias Fêmea', ean13: '7891234500024', unit: 'UN', minStock: 50,  cost: 3.20, price: 5.80, categoryId: catConectores.id, type: 'component' },
    // Proteção e Acabamento
    { sku: 'CORR-10', name: 'Corrugado 10mm',          ean13: '7891234500030', unit: 'm',  minStock: 50,  cost: 0.45, price: 0.90, categoryId: catProtecao.id, type: 'component' },
    { sku: 'CORR-16', name: 'Corrugado 16mm',          ean13: '7891234500031', unit: 'm',  minStock: 30,  cost: 0.75, price: 1.40, categoryId: catProtecao.id, type: 'component' },
    { sku: 'FTA-PVC', name: 'Fita Isolante PVC 19mm',  ean13: '7891234500032', unit: 'UN', minStock: 20,  cost: 3.50, price: 6.00, categoryId: catProtecao.id, type: 'component' },
    { sku: 'ABR-100', name: 'Abraçadeira Nylon 100mm', ean13: '7891234500033', unit: 'UN', minStock: 500, cost: 0.08, price: 0.15, categoryId: catProtecao.id, type: 'component' },
    { sku: 'THM-05',  name: 'Tubo Termocontrátil 5mm', ean13: '7891234500034', unit: 'm',  minStock: 20,  cost: 0.65, price: 1.20, categoryId: catProtecao.id, type: 'component' },
  ];

  const components: Record<string, string> = {};
  for (const p of componentsData) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { type: 'component' },
      create: p,
    });
    components[p.sku] = prod.id;
  }
  console.log(`✓ ${componentsData.length} componentes criados`);

  // ── Products — harnesses ───────────────────────────────────────────────────
  const harnessesData = [
    { sku: 'CHC-MOT-4V',  name: 'Chicote Motor 4 Vias',          ean13: '7891234500100', unit: 'UN', minStock: 10, cost: 0, price: 45.00, categoryId: catChicotes.id, type: 'harness' },
    { sku: 'CHC-PAI-INS', name: 'Chicote Painel Instrumento',    ean13: '7891234500101', unit: 'UN', minStock: 5,  cost: 0, price: 78.00, categoryId: catChicotes.id, type: 'harness' },
    { sku: 'CHC-ILU-TRS', name: 'Chicote Iluminação Traseira',   ean13: '7891234500102', unit: 'UN', minStock: 8,  cost: 0, price: 32.00, categoryId: catChicotes.id, type: 'harness' },
  ];

  const harnesses: Record<string, string> = {};
  for (const h of harnessesData) {
    const prod = await prisma.product.upsert({
      where: { sku: h.sku },
      update: { type: 'harness' },
      create: h,
    });
    harnesses[h.sku] = prod.id;
  }
  console.log(`✓ ${harnessesData.length} chicotes criados`);

  // ── Initial stock in Almoxarifado Central ──────────────────────────────────
  const initialStock: Array<{ sku: string; qty: number; cost: number }> = [
    { sku: 'FIO-05-VM', qty: 500,  cost: 0.85 },
    { sku: 'FIO-05-PT', qty: 400,  cost: 0.85 },
    { sku: 'FIO-05-AZ', qty: 200,  cost: 0.85 },
    { sku: 'FIO-10-VE', qty: 150,  cost: 1.20 },
    { sku: 'FIO-15-AV', qty: 80,   cost: 1.60 },
    { sku: 'FIO-25-VM', qty: 50,   cost: 2.80 },
    { sku: 'TRM-F05',    qty: 1000, cost: 0.28 },
    { sku: 'TRM-M05',    qty: 800,  cost: 0.28 },
    { sku: 'TRM-OLH-M6', qty: 400,  cost: 0.45 },
    { sku: 'TRM-GAR-M4', qty: 300,  cost: 0.38 },
    { sku: 'CON-2VF', qty: 200, cost: 1.80 },
    { sku: 'CON-2VM', qty: 200, cost: 1.80 },
    { sku: 'CON-4VF', qty: 150, cost: 2.50 },
    { sku: 'CON-4VM', qty: 150, cost: 2.50 },
    { sku: 'CON-6VF', qty: 80,  cost: 3.20 },
    { sku: 'CORR-10', qty: 100, cost: 0.45 },
    { sku: 'CORR-16', qty: 60,  cost: 0.75 },
    { sku: 'FTA-PVC', qty: 30,  cost: 3.50 },
    { sku: 'ABR-100', qty: 1000, cost: 0.08 },
    { sku: 'THM-05',  qty: 40,  cost: 0.65 },
  ];

  for (const s of initialStock) {
    const productId = components[s.sku];
    const already = await prisma.stockMovement.findFirst({
      where: { productId, warehouseId: almox.id, notes: 'Estoque inicial (seed)' },
    });
    if (!already) {
      await prisma.$transaction((tx) =>
        upsertBalance(tx, productId, almox.id, s.qty, s.cost, admin.id, 'Estoque inicial (seed)')
      );
    }
  }
  console.log('✓ Estoque inicial criado no Almoxarifado Central');

  // ── BOMs ───────────────────────────────────────────────────────────────────
  type BomEntry = { sku: string; qty: number; notes?: string };

  const bomDefinitions: Array<{ harnessSku: string; items: BomEntry[] }> = [
    {
      harnessSku: 'CHC-MOT-4V',
      items: [
        { sku: 'FIO-05-VM', qty: 1.5, notes: 'Alimentação +12V' },
        { sku: 'FIO-05-PT', qty: 1.5, notes: 'GND' },
        { sku: 'FIO-10-VE', qty: 0.5, notes: 'Sinal sensor' },
        { sku: 'TRM-F05',    qty: 4 },
        { sku: 'TRM-M05',    qty: 4 },
        { sku: 'CON-4VF', qty: 1 },
        { sku: 'CON-4VM', qty: 1 },
        { sku: 'CORR-10', qty: 0.3 },
        { sku: 'ABR-100', qty: 3 },
      ],
    },
    {
      harnessSku: 'CHC-PAI-INS',
      items: [
        { sku: 'FIO-05-VM', qty: 3.0, notes: '+12V painel' },
        { sku: 'FIO-05-PT', qty: 2.5, notes: 'GND painel' },
        { sku: 'FIO-05-AZ', qty: 2.0, notes: 'Iluminação' },
        { sku: 'FIO-10-VE', qty: 1.0, notes: 'CAN Bus' },
        { sku: 'TRM-F05',    qty: 12 },
        { sku: 'TRM-M05',    qty: 8 },
        { sku: 'TRM-OLH-M6', qty: 4, notes: 'Aterramento chassi' },
        { sku: 'CON-6VF', qty: 1 },
        { sku: 'CON-4VF', qty: 2 },
        { sku: 'CORR-10', qty: 0.5 },
        { sku: 'CORR-16', qty: 0.3 },
        { sku: 'FTA-PVC', qty: 0.5 },
        { sku: 'ABR-100', qty: 8 },
        { sku: 'THM-05',  qty: 0.5, notes: 'Isolação pontas' },
      ],
    },
    {
      harnessSku: 'CHC-ILU-TRS',
      items: [
        { sku: 'FIO-05-VM', qty: 2.0, notes: '+12V luzes' },
        { sku: 'FIO-05-PT', qty: 1.0, notes: 'GND' },
        { sku: 'TRM-F05',    qty: 4 },
        { sku: 'TRM-M05',    qty: 4 },
        { sku: 'CON-2VF', qty: 2 },
        { sku: 'CON-2VM', qty: 2 },
        { sku: 'CORR-10', qty: 0.4 },
        { sku: 'ABR-100', qty: 4 },
      ],
    },
  ];

  for (const def of bomDefinitions) {
    const harnessId = harnesses[def.harnessSku];
    for (const item of def.items) {
      const componentId = components[item.sku];
      await prisma.bomItem.upsert({
        where: { harnessId_componentId: { harnessId, componentId } },
        update: { quantity: item.qty, notes: item.notes ?? null },
        create: { harnessId, componentId, quantity: item.qty, notes: item.notes ?? null },
      });
    }
  }
  console.log('✓ BOMs criados para os 3 chicotes');

  // ── Assembly Orders (completed history) ────────────────────────────────────
  // Order 1: CHC-MOT-4V x5 — completed
  const existingOM1 = await prisma.assemblyOrder.findFirst({ where: { code: 'OM-20260101-001' } });
  if (!existingOM1) {
    const motBom = bomDefinitions.find((b) => b.harnessSku === 'CHC-MOT-4V')!;
    const qty1 = 5;

    await prisma.$transaction(async (tx) => {
      const order = await tx.assemblyOrder.create({
        data: {
          code: 'OM-20260101-001',
          harnessId: harnesses['CHC-MOT-4V'],
          warehouseId: producao.id,
          quantity: qty1,
          status: 'completed',
          notes: 'Primeiro lote de produção',
          userId: manager.id,
          completedAt: new Date('2026-01-15T14:00:00Z'),
          items: {
            create: motBom.items.map((item) => ({
              componentId: components[item.sku],
              requiredQty: item.qty * qty1,
              consumedQty: item.qty * qty1,
              sourceWarehouseId: almox.id,
            })),
          },
        },
      });

      // Consume components
      for (const item of motBom.items) {
        const bal = await tx.stockBalance.findFirst({
          where: { productId: components[item.sku], warehouseId: almox.id, batchId: null },
        });
        if (bal) {
          await tx.stockBalance.update({
            where: { id: bal.id },
            data: { quantity: { decrement: item.qty * qty1 } },
          });
        }
        await tx.stockMovement.create({
          data: {
            type: 'exit',
            productId: components[item.sku],
            warehouseId: almox.id,
            quantity: item.qty * qty1,
            referenceType: 'assembly',
            referenceId: order.id,
            notes: `Consumo OM ${order.code}`,
            userId: manager.id,
          },
        });
      }

      // Add harness to stock
      await tx.stockBalance.create({
        data: { productId: harnesses['CHC-MOT-4V'], warehouseId: producao.id, batchId: null, quantity: qty1 },
      });
      await tx.stockMovement.create({
        data: {
          type: 'entry',
          productId: harnesses['CHC-MOT-4V'],
          warehouseId: producao.id,
          quantity: qty1,
          referenceType: 'assembly',
          referenceId: order.id,
          notes: `Produção OM ${order.code}`,
          userId: manager.id,
        },
      });
    });
  }

  // Order 2: CHC-ILU-TRS x3 — completed
  const existingOM2 = await prisma.assemblyOrder.findFirst({ where: { code: 'OM-20260115-001' } });
  if (!existingOM2) {
    const iluBom = bomDefinitions.find((b) => b.harnessSku === 'CHC-ILU-TRS')!;
    const qty2 = 3;

    await prisma.$transaction(async (tx) => {
      const order = await tx.assemblyOrder.create({
        data: {
          code: 'OM-20260115-001',
          harnessId: harnesses['CHC-ILU-TRS'],
          warehouseId: producao.id,
          quantity: qty2,
          status: 'completed',
          notes: 'Pedido urgente cliente XYZ',
          userId: manager.id,
          completedAt: new Date('2026-01-20T10:30:00Z'),
          items: {
            create: iluBom.items.map((item) => ({
              componentId: components[item.sku],
              requiredQty: item.qty * qty2,
              consumedQty: item.qty * qty2,
              sourceWarehouseId: almox.id,
            })),
          },
        },
      });

      for (const item of iluBom.items) {
        const bal = await tx.stockBalance.findFirst({
          where: { productId: components[item.sku], warehouseId: almox.id, batchId: null },
        });
        if (bal) {
          await tx.stockBalance.update({
            where: { id: bal.id },
            data: { quantity: { decrement: item.qty * qty2 } },
          });
        }
        await tx.stockMovement.create({
          data: {
            type: 'exit',
            productId: components[item.sku],
            warehouseId: almox.id,
            quantity: item.qty * qty2,
            referenceType: 'assembly',
            referenceId: order.id,
            notes: `Consumo OM ${order.code}`,
            userId: manager.id,
          },
        });
      }

      await tx.stockBalance.create({
        data: { productId: harnesses['CHC-ILU-TRS'], warehouseId: producao.id, batchId: null, quantity: qty2 },
      });
      await tx.stockMovement.create({
        data: {
          type: 'entry',
          productId: harnesses['CHC-ILU-TRS'],
          warehouseId: producao.id,
          quantity: qty2,
          referenceType: 'assembly',
          referenceId: order.id,
          notes: `Produção OM ${order.code}`,
          userId: manager.id,
        },
      });
    });
  }

  // Pending order
  const existingOM3 = await prisma.assemblyOrder.findFirst({ where: { code: 'OM-20260420-001' } });
  if (!existingOM3) {
    const paiBom = bomDefinitions.find((b) => b.harnessSku === 'CHC-PAI-INS')!;
    const qty3 = 10;
    await prisma.assemblyOrder.create({
      data: {
        code: 'OM-20260420-001',
        harnessId: harnesses['CHC-PAI-INS'],
        warehouseId: producao.id,
        quantity: qty3,
        status: 'pending',
        notes: 'Produção planejada — aguardando liberação',
        userId: manager.id,
        items: {
          create: paiBom.items.map((item) => ({
            componentId: components[item.sku],
            requiredQty: item.qty * qty3,
            consumedQty: 0,
            sourceWarehouseId: almox.id,
          })),
        },
      },
    });
  }

  console.log('✓ Ordens de montagem criadas (2 concluídas, 1 pendente)');

  console.log('\n✅ Seed concluído com sucesso!');
  console.log('\nCredenciais de acesso:');
  console.log('  Admin:    admin@estoque.com   / admin123');
  console.log('  Gestor:   gestor@estoque.com  / gestor123');
  console.log('  Operador: operador@estoque.com / op123');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

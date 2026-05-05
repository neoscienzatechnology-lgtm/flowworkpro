-- ============================================================
-- FlowWork Pro — Seed PostgreSQL (Neon)
-- Execute APÓS o neon-setup.sql
-- ============================================================

-- Usuários
INSERT INTO "User" ("id","name","email","password","role") VALUES
  ('usr_admin',  'Administrador',          'admin@estoque.com',    '$2b$10$j63DOhZ8AHegDWSOv9L7iusMew16PJHgnZqzEIf8La1WHqY4zn/Nm', 'admin'),
  ('usr_gestor', 'Gestor de Produção',     'gestor@estoque.com',   '$2b$10$jEBqEtHxhIei1Pb4iSPnQe0eRtd9anKDyfjbxX5W.pnkopvlWXBUO', 'manager'),
  ('usr_op',     'Operador de Almoxarifado','operador@estoque.com','$2b$10$4W3rgg.xhowx1I.c2uruau2vNyKep3SplMssVlQxJDaxQgeSYVbtu', 'operator')
ON CONFLICT ("id") DO NOTHING;

-- Empresa
INSERT INTO "Company" ("id","name","cnpj","taxRegime","state") VALUES
  ('cmp_001','HarnessTech Indústria Ltda','98765432000110','Simples Nacional','SP')
ON CONFLICT ("id") DO NOTHING;

-- Categorias
INSERT INTO "Category" ("id","name","description") VALUES
  ('cat_fios',     'Fios e Cabos',           'Fios elétricos por bitola e cor'),
  ('cat_term',     'Terminais',              'Terminais elétricos de crimpagem'),
  ('cat_con',      'Conectores',             'Conectores e housings'),
  ('cat_prot',     'Proteção e Acabamento',  'Corrugado, fita, abraçadeiras, termocontrátil'),
  ('cat_chic',     'Chicotes Montados',      'Chicotes elétricos prontos para expedição')
ON CONFLICT ("id") DO NOTHING;

-- Depósitos
INSERT INTO "Warehouse" ("id","name","code","address") VALUES
  ('wh_almox',  'Almoxarifado Central', 'ALM-001', 'Rua Industrial, 200 - São Paulo, SP'),
  ('wh_prod',   'Linha de Produção',    'PROD-01', 'Rua Industrial, 200 - Bloco B - São Paulo, SP'),
  ('wh_exp',    'Expedição',            'EXP-01',  'Rua Industrial, 200 - Bloco C - São Paulo, SP')
ON CONFLICT ("id") DO NOTHING;

-- Produtos — Componentes
INSERT INTO "Product" ("id","sku","name","ean13","unit","minStock","cost","price","type","categoryId") VALUES
  ('p_fio05vm', 'FIO-05-VM', 'Fio 0,5mm² Vermelho',       '7891234500001','m', 100, 0.85, 1.20,'component','cat_fios'),
  ('p_fio05pt', 'FIO-05-PT', 'Fio 0,5mm² Preto',          '7891234500002','m', 100, 0.85, 1.20,'component','cat_fios'),
  ('p_fio05az', 'FIO-05-AZ', 'Fio 0,5mm² Azul',           '7891234500003','m',  50, 0.85, 1.20,'component','cat_fios'),
  ('p_fio10ve', 'FIO-10-VE', 'Fio 1,0mm² Verde',          '7891234500004','m',  50, 1.20, 1.80,'component','cat_fios'),
  ('p_fio15av', 'FIO-15-AV', 'Fio 1,5mm² Amarelo/Verde',  '7891234500005','m',  30, 1.60, 2.40,'component','cat_fios'),
  ('p_fio25vm', 'FIO-25-VM', 'Fio 2,5mm² Vermelho',       '7891234500006','m',  20, 2.80, 4.20,'component','cat_fios'),
  ('p_trmf05',  'TRM-F05',   'Terminal Fêmea AMP 0,5mm²', '7891234500010','UN',500, 0.28, 0.55,'component','cat_term'),
  ('p_trmm05',  'TRM-M05',   'Terminal Macho AMP 0,5mm²', '7891234500011','UN',500, 0.28, 0.55,'component','cat_term'),
  ('p_trmolhm6','TRM-OLH-M6','Terminal Olhal M6',         '7891234500012','UN',200, 0.45, 0.90,'component','cat_term'),
  ('p_trmgarm4','TRM-GAR-M4','Terminal Garfo M4',         '7891234500013','UN',200, 0.38, 0.75,'component','cat_term'),
  ('p_con2vf',  'CON-2VF',   'Conector 2 Vias Fêmea',     '7891234500020','UN',100, 1.80, 3.20,'component','cat_con'),
  ('p_con2vm',  'CON-2VM',   'Conector 2 Vias Macho',     '7891234500021','UN',100, 1.80, 3.20,'component','cat_con'),
  ('p_con4vf',  'CON-4VF',   'Conector 4 Vias Fêmea',     '7891234500022','UN',100, 2.50, 4.50,'component','cat_con'),
  ('p_con4vm',  'CON-4VM',   'Conector 4 Vias Macho',     '7891234500023','UN',100, 2.50, 4.50,'component','cat_con'),
  ('p_con6vf',  'CON-6VF',   'Conector 6 Vias Fêmea',     '7891234500024','UN', 50, 3.20, 5.80,'component','cat_con'),
  ('p_corr10',  'CORR-10',   'Corrugado 10mm',            '7891234500030','m',  50, 0.45, 0.90,'component','cat_prot'),
  ('p_corr16',  'CORR-16',   'Corrugado 16mm',            '7891234500031','m',  30, 0.75, 1.40,'component','cat_prot'),
  ('p_ftapvc',  'FTA-PVC',   'Fita Isolante PVC 19mm',    '7891234500032','UN', 20, 3.50, 6.00,'component','cat_prot'),
  ('p_abr100',  'ABR-100',   'Abraçadeira Nylon 100mm',   '7891234500033','UN',500, 0.08, 0.15,'component','cat_prot'),
  ('p_thm05',   'THM-05',    'Tubo Termocontrátil 5mm',   '7891234500034','m',  20, 0.65, 1.20,'component','cat_prot')
ON CONFLICT ("id") DO NOTHING;

-- Produtos — Chicotes
INSERT INTO "Product" ("id","sku","name","ean13","unit","minStock","cost","price","type","categoryId") VALUES
  ('p_chcmot4v', 'CHC-MOT-4V',  'Chicote Motor 4 Vias',       '7891234500100','UN',10, 0, 45.00,'harness','cat_chic'),
  ('p_chcpains', 'CHC-PAI-INS', 'Chicote Painel Instrumento', '7891234500101','UN', 5, 0, 78.00,'harness','cat_chic'),
  ('p_chcilutrs','CHC-ILU-TRS', 'Chicote Iluminação Traseira','7891234500102','UN', 8, 0, 32.00,'harness','cat_chic')
ON CONFLICT ("id") DO NOTHING;

-- Estoque inicial (Almoxarifado Central)
INSERT INTO "StockMovement" ("id","type","productId","warehouseId","quantity","unitCost","totalCost","referenceType","notes","userId") VALUES
  ('mv001','entry','p_fio05vm','wh_almox',500,0.85,425,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv002','entry','p_fio05pt','wh_almox',400,0.85,340,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv003','entry','p_fio05az','wh_almox',200,0.85,170,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv004','entry','p_fio10ve','wh_almox',150,1.20,180,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv005','entry','p_fio15av','wh_almox', 80,1.60,128,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv006','entry','p_fio25vm','wh_almox', 50,2.80,140,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv007','entry','p_trmf05' ,'wh_almox',1000,0.28,280,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv008','entry','p_trmm05' ,'wh_almox', 800,0.28,224,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv009','entry','p_trmolhm6','wh_almox',400,0.45,180,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv010','entry','p_trmgarm4','wh_almox',300,0.38,114,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv011','entry','p_con2vf','wh_almox',200,1.80,360,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv012','entry','p_con2vm','wh_almox',200,1.80,360,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv013','entry','p_con4vf','wh_almox',150,2.50,375,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv014','entry','p_con4vm','wh_almox',150,2.50,375,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv015','entry','p_con6vf','wh_almox', 80,3.20,256,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv016','entry','p_corr10','wh_almox',100,0.45, 45,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv017','entry','p_corr16','wh_almox', 60,0.75, 45,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv018','entry','p_ftapvc','wh_almox', 30,3.50,105,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv019','entry','p_abr100','wh_almox',1000,0.08, 80,'manual','Estoque inicial (seed)','usr_admin'),
  ('mv020','entry','p_thm05' ,'wh_almox', 40,0.65, 26,'manual','Estoque inicial (seed)','usr_admin')
ON CONFLICT ("id") DO NOTHING;

-- Saldos de estoque
INSERT INTO "StockBalance" ("id","productId","warehouseId","quantity") VALUES
  ('sb001','p_fio05vm','wh_almox',500),('sb002','p_fio05pt','wh_almox',400),
  ('sb003','p_fio05az','wh_almox',200),('sb004','p_fio10ve','wh_almox',150),
  ('sb005','p_fio15av','wh_almox', 80),('sb006','p_fio25vm','wh_almox', 50),
  ('sb007','p_trmf05' ,'wh_almox',1000),('sb008','p_trmm05','wh_almox',800),
  ('sb009','p_trmolhm6','wh_almox',400),('sb010','p_trmgarm4','wh_almox',300),
  ('sb011','p_con2vf','wh_almox',200),('sb012','p_con2vm','wh_almox',200),
  ('sb013','p_con4vf','wh_almox',150),('sb014','p_con4vm','wh_almox',150),
  ('sb015','p_con6vf','wh_almox', 80),('sb016','p_corr10','wh_almox',100),
  ('sb017','p_corr16','wh_almox', 60),('sb018','p_ftapvc','wh_almox', 30),
  ('sb019','p_abr100','wh_almox',1000),('sb020','p_thm05','wh_almox', 40)
ON CONFLICT ("id") DO NOTHING;

-- BOM — Chicote Motor 4 Vias
INSERT INTO "BomItem" ("id","harnessId","componentId","quantity","notes") VALUES
  ('bom_mot_01','p_chcmot4v','p_fio05vm',1.5,'Alimentação +12V'),
  ('bom_mot_02','p_chcmot4v','p_fio05pt',1.5,'GND'),
  ('bom_mot_03','p_chcmot4v','p_fio10ve',0.5,'Sinal sensor'),
  ('bom_mot_04','p_chcmot4v','p_trmf05', 4,  NULL),
  ('bom_mot_05','p_chcmot4v','p_trmm05', 4,  NULL),
  ('bom_mot_06','p_chcmot4v','p_con4vf', 1,  NULL),
  ('bom_mot_07','p_chcmot4v','p_con4vm', 1,  NULL),
  ('bom_mot_08','p_chcmot4v','p_corr10', 0.3,NULL),
  ('bom_mot_09','p_chcmot4v','p_abr100', 3,  NULL)
ON CONFLICT ("id") DO NOTHING;

-- BOM — Chicote Painel Instrumento
INSERT INTO "BomItem" ("id","harnessId","componentId","quantity","notes") VALUES
  ('bom_pai_01','p_chcpains','p_fio05vm', 3.0,'12V painel'),
  ('bom_pai_02','p_chcpains','p_fio05pt', 2.5,'GND painel'),
  ('bom_pai_03','p_chcpains','p_fio05az', 2.0,'Iluminação'),
  ('bom_pai_04','p_chcpains','p_fio10ve', 1.0,'CAN Bus'),
  ('bom_pai_05','p_chcpains','p_trmf05',  12, NULL),
  ('bom_pai_06','p_chcpains','p_trmm05',   8, NULL),
  ('bom_pai_07','p_chcpains','p_trmolhm6', 4,'Aterramento chassi'),
  ('bom_pai_08','p_chcpains','p_con6vf',   1, NULL),
  ('bom_pai_09','p_chcpains','p_con4vf',   2, NULL),
  ('bom_pai_10','p_chcpains','p_corr10',  0.5,NULL),
  ('bom_pai_11','p_chcpains','p_corr16',  0.3,NULL),
  ('bom_pai_12','p_chcpains','p_ftapvc',  0.5,NULL),
  ('bom_pai_13','p_chcpains','p_abr100',   8, NULL),
  ('bom_pai_14','p_chcpains','p_thm05',   0.5,'Isolação pontas')
ON CONFLICT ("id") DO NOTHING;

-- BOM — Chicote Iluminação Traseira
INSERT INTO "BomItem" ("id","harnessId","componentId","quantity","notes") VALUES
  ('bom_ilu_01','p_chcilutrs','p_fio05vm',2.0,'12V luzes'),
  ('bom_ilu_02','p_chcilutrs','p_fio05pt',1.0,'GND'),
  ('bom_ilu_03','p_chcilutrs','p_trmf05', 4,  NULL),
  ('bom_ilu_04','p_chcilutrs','p_trmm05', 4,  NULL),
  ('bom_ilu_05','p_chcilutrs','p_con2vf', 2,  NULL),
  ('bom_ilu_06','p_chcilutrs','p_con2vm', 2,  NULL),
  ('bom_ilu_07','p_chcilutrs','p_corr10', 0.4,NULL),
  ('bom_ilu_08','p_chcilutrs','p_abr100', 4,  NULL)
ON CONFLICT ("id") DO NOTHING;

SELECT 'Seed concluído! 3 usuários, 23 produtos, 3 BOMs, 20 movimentações de estoque.' AS resultado;

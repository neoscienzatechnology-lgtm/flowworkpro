import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { formatDate } from '../lib/utils';
import Badge from '../components/Badge';
import Pagination from '../components/Pagination';

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface Movement {
  id: string;
  type: 'entry' | 'exit' | 'transfer' | 'adjustment';
  product?: Product;
  warehouse?: Warehouse;
  toWarehouse?: Warehouse;
  quantity: number;
  reference?: string;
  notes?: string;
  createdAt: string;
  user?: { name: string };
}

const movementTypes = [
  { value: 'entry', label: 'Entrada', color: 'success' as const },
  { value: 'exit', label: 'Saída', color: 'error' as const },
  { value: 'transfer', label: 'Transferência', color: 'info' as const },
  { value: 'adjustment', label: 'Ajuste', color: 'warning' as const },
];

const movementTypeLabel: Record<string, string> = {
  entry: 'Entrada',
  exit: 'Saída',
  transfer: 'Transferência',
  adjustment: 'Ajuste',
};

const movementTypeBadge: Record<string, 'success' | 'error' | 'info' | 'warning'> = {
  entry: 'success',
  exit: 'error',
  transfer: 'info',
  adjustment: 'warning',
};

// Form schemas
const entrySchema = z.object({
  productId: z.string().min(1, 'Produto obrigatório'),
  warehouseId: z.string().min(1, 'Depósito obrigatório'),
  quantity: z.coerce.number().positive('Quantidade deve ser positiva'),
  unitCost: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

const exitSchema = z.object({
  productId: z.string().min(1, 'Produto obrigatório'),
  warehouseId: z.string().min(1, 'Depósito obrigatório'),
  quantity: z.coerce.number().positive('Quantidade deve ser positiva'),
  notes: z.string().optional(),
});

const transferSchema = z.object({
  productId: z.string().min(1, 'Produto obrigatório'),
  fromWarehouseId: z.string().min(1, 'Depósito origem obrigatório'),
  toWarehouseId: z.string().min(1, 'Depósito destino obrigatório'),
  quantity: z.coerce.number().positive('Quantidade deve ser positiva'),
  notes: z.string().optional(),
});

const adjustmentSchema = z.object({
  productId: z.string().min(1, 'Produto obrigatório'),
  warehouseId: z.string().min(1, 'Depósito obrigatório'),
  quantity: z.coerce.number(),
  notes: z.string().optional(),
});

function SelectField({ label, required, children, error }: { label: string; required?: boolean; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && ' *'}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function NewMovementTab({ products, warehouses }: { products: Product[]; warehouses: Warehouse[] }) {
  const { success, error } = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState<'entry' | 'exit' | 'transfer' | 'adjustment'>('entry');
  const [done, setDone] = useState(false);

  const entryForm = useForm({ resolver: zodResolver(entrySchema), defaultValues: { productId: '', warehouseId: '', quantity: 1, unitCost: 0, notes: '' } });
  const exitForm = useForm({ resolver: zodResolver(exitSchema), defaultValues: { productId: '', warehouseId: '', quantity: 1, notes: '' } });
  const transferForm = useForm({ resolver: zodResolver(transferSchema), defaultValues: { productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: 1, notes: '' } });
  const adjustForm = useForm({ resolver: zodResolver(adjustmentSchema), defaultValues: { productId: '', warehouseId: '', quantity: 0, notes: '' } });

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return api.post(`/movements/${type}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movements'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });
      success('Movimentação registrada com sucesso!');
      setDone(true);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao registrar movimentação';
      error(msg);
    },
  });

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <p className="text-lg font-semibold text-gray-900">Movimentação Registrada!</p>
        <button onClick={() => { setDone(false); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          Nova Movimentação
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Type selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Movimentação</label>
        <div className="grid grid-cols-4 gap-2">
          {movementTypes.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value as typeof type)}
              className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                type === t.value
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entry form */}
      {type === 'entry' && (
        <form onSubmit={entryForm.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <SelectField label="Produto" required error={entryForm.formState.errors.productId?.message}>
            <select {...entryForm.register('productId')} className={inputClass}>
              <option value="">Selecionar produto...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </SelectField>
          <SelectField label="Depósito Destino" required error={entryForm.formState.errors.warehouseId?.message}>
            <select {...entryForm.register('warehouseId')} className={inputClass}>
              <option value="">Selecionar depósito...</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </SelectField>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Quantidade" required error={entryForm.formState.errors.quantity?.message}>
              <input {...entryForm.register('quantity')} type="number" min="0.001" step="0.001" className={inputClass} />
            </SelectField>
            <SelectField label="Custo Unitário (R$)">
              <input {...entryForm.register('unitCost')} type="number" min="0" step="0.01" className={inputClass} />
            </SelectField>
          </div>
          <SelectField label="Observações">
            <textarea {...entryForm.register('notes')} rows={2} className={`${inputClass} resize-none`} />
          </SelectField>
          <button type="submit" disabled={mutation.isPending} className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {mutation.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Registrar Entrada
          </button>
        </form>
      )}

      {/* Exit form */}
      {type === 'exit' && (
        <form onSubmit={exitForm.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <SelectField label="Produto" required error={exitForm.formState.errors.productId?.message}>
            <select {...exitForm.register('productId')} className={inputClass}>
              <option value="">Selecionar produto...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </SelectField>
          <SelectField label="Depósito Origem" required error={exitForm.formState.errors.warehouseId?.message}>
            <select {...exitForm.register('warehouseId')} className={inputClass}>
              <option value="">Selecionar depósito...</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </SelectField>
          <SelectField label="Quantidade" required error={exitForm.formState.errors.quantity?.message}>
            <input {...exitForm.register('quantity')} type="number" min="0.001" step="0.001" className={inputClass} />
          </SelectField>
          <SelectField label="Observações">
            <textarea {...exitForm.register('notes')} rows={2} className={`${inputClass} resize-none`} />
          </SelectField>
          <button type="submit" disabled={mutation.isPending} className="w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {mutation.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Registrar Saída
          </button>
        </form>
      )}

      {/* Transfer form */}
      {type === 'transfer' && (
        <form onSubmit={transferForm.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <SelectField label="Produto" required error={transferForm.formState.errors.productId?.message}>
            <select {...transferForm.register('productId')} className={inputClass}>
              <option value="">Selecionar produto...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </SelectField>
          <SelectField label="Depósito Origem" required error={transferForm.formState.errors.fromWarehouseId?.message}>
            <select {...transferForm.register('fromWarehouseId')} className={inputClass}>
              <option value="">Selecionar depósito...</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </SelectField>
          <SelectField label="Depósito Destino" required error={transferForm.formState.errors.toWarehouseId?.message}>
            <select {...transferForm.register('toWarehouseId')} className={inputClass}>
              <option value="">Selecionar depósito...</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </SelectField>
          <SelectField label="Quantidade" required error={transferForm.formState.errors.quantity?.message}>
            <input {...transferForm.register('quantity')} type="number" min="0.001" step="0.001" className={inputClass} />
          </SelectField>
          <SelectField label="Observações">
            <textarea {...transferForm.register('notes')} rows={2} className={`${inputClass} resize-none`} />
          </SelectField>
          <button type="submit" disabled={mutation.isPending} className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {mutation.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Registrar Transferência
          </button>
        </form>
      )}

      {/* Adjustment form */}
      {type === 'adjustment' && (
        <form onSubmit={adjustForm.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <SelectField label="Produto" required error={adjustForm.formState.errors.productId?.message}>
            <select {...adjustForm.register('productId')} className={inputClass}>
              <option value="">Selecionar produto...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </SelectField>
          <SelectField label="Depósito" required error={adjustForm.formState.errors.warehouseId?.message}>
            <select {...adjustForm.register('warehouseId')} className={inputClass}>
              <option value="">Selecionar depósito...</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </SelectField>
          <SelectField label="Quantidade (pode ser negativa)" required error={adjustForm.formState.errors.quantity?.message}>
            <input {...adjustForm.register('quantity')} type="number" step="0.001" className={inputClass} />
          </SelectField>
          <SelectField label="Observações">
            <textarea {...adjustForm.register('notes')} rows={2} className={`${inputClass} resize-none`} />
          </SelectField>
          <button type="submit" disabled={mutation.isPending} className="w-full py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {mutation.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Registrar Ajuste
          </button>
        </form>
      )}
    </div>
  );
}

export default function MovementsPage() {
  const [activeTab, setActiveTab] = useState<'history' | 'new'>('history');
  const [filterType, setFilterType] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['movements', filterType, filterSearch, filterDateFrom, filterDateTo, page],
    queryFn: async () => {
      const res = await api.get('/movements', {
        params: {
          type: filterType || undefined,
          search: filterSearch || undefined,
          dateFrom: filterDateFrom || undefined,
          dateTo: filterDateTo || undefined,
          page,
          limit,
        },
      });
      return res.data;
    },
    enabled: activeTab === 'history',
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { limit: 1000 } });
      return res.data.data as Product[];
    },
    enabled: activeTab === 'new',
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses');
      return res.data.data as Warehouse[];
    },
  });

  const movements: Movement[] = movementsData?.data ?? [];
  const total = movementsData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['history', 'new'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {tab === 'history' ? 'Histórico' : 'Nova Movimentação'}
          </button>
        ))}
      </div>

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select
                  value={filterType}
                  onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  {movementTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
                <input
                  value={filterSearch}
                  onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
                  placeholder="Produto, referência..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Data de</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Data até</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Data', 'Tipo', 'Produto', 'Depósito', 'Qtd', 'Referência', 'Usuário'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-gray-200 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                        Nenhuma movimentação encontrada
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(m.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={movementTypeBadge[m.type] || 'gray'}>
                            {movementTypeLabel[m.type] || m.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[180px] truncate">{m.product?.name ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {m.warehouse?.name ?? '-'}
                          {m.toWarehouse && <span className="text-gray-400"> → {m.toWarehouse.name}</span>}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          <span className={m.type === 'exit' ? 'text-red-600' : m.type === 'entry' ? 'text-green-600' : 'text-gray-900'}>
                            {m.type === 'exit' ? '-' : m.type === 'entry' ? '+' : ''}{m.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{m.reference ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{m.user?.name ?? '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} limit={limit} />
          </div>
        </div>
      )}

      {/* New movement tab */}
      {activeTab === 'new' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <NewMovementTab
            products={productsData ?? []}
            warehouses={warehousesData ?? []}
          />
        </div>
      )}
    </div>
  );
}

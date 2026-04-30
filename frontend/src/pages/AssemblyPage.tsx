import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Play, X, CheckCircle, XCircle } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { formatDateTime } from '../lib/utils';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Badge from '../components/Badge';
import Pagination from '../components/Pagination';
import { useAuth } from '../lib/auth';

interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

interface AssemblyItem {
  id: string;
  componentId: string;
  requiredQty: number;
  consumedQty?: number;
  component: {
    id: string;
    sku: string;
    name: string;
    unit: string;
  };
}

interface AssemblyOrder {
  id: string;
  code: string;
  harnessId: string;
  warehouseId: string;
  quantity: number;
  notes?: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  harness: { id: string; sku: string; name: string };
  warehouse: { id: string; code: string; name: string };
  items?: AssemblyItem[];
}

interface FeasibilityItem {
  componentId: string;
  sku: string;
  name: string;
  unit: string;
  required: number;
  available: number;
  sufficient: boolean;
}

function statusBadge(status: AssemblyOrder['status']) {
  switch (status) {
    case 'pending':
      return <Badge variant="warning">Pendente</Badge>;
    case 'completed':
      return <Badge variant="success">Concluída</Badge>;
    case 'cancelled':
      return <Badge variant="gray">Cancelada</Badge>;
  }
}

function DetailModal({ order, onClose }: { order: AssemblyOrder; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['assembly-detail', order.id],
    queryFn: async () => {
      const res = await api.get(`/assembly/${order.id}`);
      return res.data.data as AssemblyOrder;
    },
  });

  const detail = data ?? order;

  return (
    <Modal isOpen={true} onClose={onClose} title={`Ordem de Montagem — ${order.code}`} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Chicote:</span>
            <span className="ml-2 font-medium text-gray-900">{order.harness.name}</span>
          </div>
          <div>
            <span className="text-gray-500">Depósito:</span>
            <span className="ml-2 font-medium text-gray-900">{order.warehouse.name}</span>
          </div>
          <div>
            <span className="text-gray-500">Quantidade:</span>
            <span className="ml-2 font-medium text-gray-900">
              {order.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Status:</span>
            <span className="ml-2">{statusBadge(order.status)}</span>
          </div>
          <div>
            <span className="text-gray-500">Criada em:</span>
            <span className="ml-2 text-gray-900">{formatDateTime(order.createdAt)}</span>
          </div>
          {order.completedAt && (
            <div>
              <span className="text-gray-500">Concluída em:</span>
              <span className="ml-2 text-gray-900">{formatDateTime(order.completedAt)}</span>
            </div>
          )}
          {order.notes && (
            <div className="col-span-2">
              <span className="text-gray-500">Notas:</span>
              <span className="ml-2 text-gray-900">{order.notes}</span>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Componentes</h4>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['SKU', 'Componente', 'Unidade', 'Qtd Necessária', 'Qtd Consumida'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(detail.items ?? []).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-gray-500">{item.component.sku}</td>
                      <td className="px-4 py-2 text-gray-900">{item.component.name}</td>
                      <td className="px-4 py-2 text-gray-600">{item.component.unit}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {item.requiredQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {item.consumedQty != null
                          ? item.consumedQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {(detail.items ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">
                        Nenhum item registrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function NewOrderTab({
  warehouses,
  harnesses,
  onSuccess,
}: {
  warehouses: Warehouse[];
  harnesses: Product[];
  onSuccess: () => void;
}) {
  const { success, error } = useToast();
  const qc = useQueryClient();

  const [harnessId, setHarnessId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [runFeas, setRunFeas] = useState(false);

  const { data: feasData, isLoading: feasLoading, refetch: refetchFeas } = useQuery({
    queryKey: ['new-order-feas', harnessId, quantity, warehouseId],
    queryFn: async () => {
      const res = await api.get(`/bom/${harnessId}/feasibility`, {
        params: {
          quantity: parseFloat(quantity) || 1,
          warehouseId: warehouseId || undefined,
        },
      });
      return res.data.data as { feasibility: FeasibilityItem[]; allSufficient: boolean };
    },
    enabled: runFeas && !!harnessId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return api.post('/assembly', {
        harnessId,
        warehouseId,
        quantity: parseFloat(quantity),
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assembly'] });
      success('Ordem de montagem criada com sucesso!');
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Erro ao criar ordem de montagem';
      error(msg);
    },
  });

  const handleVerify = () => {
    setRunFeas(true);
    setTimeout(() => refetchFeas(), 50);
  };

  const canSubmit = !!harnessId && !!warehouseId && parseFloat(quantity) >= 1;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Chicote *</label>
        <select
          value={harnessId}
          onChange={(e) => {
            setHarnessId(e.target.value);
            setRunFeas(false);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione um chicote</option>
          {harnesses.map((h) => (
            <option key={h.id} value={h.id}>
              {h.sku} — {h.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Depósito Destino *</label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione um depósito</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Observações opcionais"
        />
      </div>

      {/* Feasibility */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">Verificar Viabilidade</h4>
          <button
            type="button"
            disabled={!harnessId || feasLoading}
            onClick={handleVerify}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            {feasLoading && (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Verificar
          </button>
        </div>

        {runFeas && feasData && (
          <div className="space-y-2">
            {feasData.allSufficient ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-green-800 text-xs font-medium">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Produzir {parseFloat(quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} unidade(s) é VIÁVEL
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs font-medium">
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                INVIÁVEL —{' '}
                {feasData.feasibility.filter((f) => !f.sufficient).length} componente(s) insuficiente(s)
              </div>
            )}
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full text-xs divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['SKU', 'Componente', 'Necessário', 'Disponível', ''].map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-gray-500 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {feasData.feasibility.map((f) => (
                    <tr key={f.componentId} className={f.sufficient ? 'bg-green-50' : 'bg-red-50'}>
                      <td className="px-3 py-1.5 font-mono text-gray-500">{f.sku}</td>
                      <td className="px-3 py-1.5 text-gray-900">{f.name}</td>
                      <td className="px-3 py-1.5 font-medium">
                        {f.required.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {f.unit}
                      </td>
                      <td className="px-3 py-1.5 font-medium">
                        {f.available.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {f.unit}
                      </td>
                      <td className="px-3 py-1.5">
                        {f.sufficient ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="pt-2">
        <button
          type="button"
          disabled={!canSubmit || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
        >
          {createMutation.isPending && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          Criar Ordem de Montagem
        </button>
      </div>
    </div>
  );
}

export default function AssemblyPage() {
  const { user } = useAuth();
  const canWrite = ['admin', 'manager'].includes(user?.role ?? '');
  const { success, error } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'orders' | 'new'>('orders');
  const [statusFilter, setStatusFilter] = useState('');
  const [harnessFilter, setHarnessFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [detailOrder, setDetailOrder] = useState<AssemblyOrder | null>(null);
  const [executeOrder, setExecuteOrder] = useState<AssemblyOrder | null>(null);
  const [cancelOrder, setCancelOrder] = useState<AssemblyOrder | null>(null);

  // Fetch harnesses for filter
  const { data: harnessesData } = useQuery({
    queryKey: ['harnesses'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { type: 'harness', limit: 100 } });
      return res.data;
    },
  });

  const harnesses: Product[] = harnessesData?.data ?? [];

  // Fetch warehouses
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses');
      return res.data.data as Warehouse[];
    },
  });

  const warehouses: Warehouse[] = warehousesData ?? [];

  // Fetch assembly orders
  const { data: assemblyData, isLoading } = useQuery({
    queryKey: ['assembly', statusFilter, harnessFilter, page],
    queryFn: async () => {
      const res = await api.get('/assembly', {
        params: {
          status: statusFilter || undefined,
          harnessId: harnessFilter || undefined,
          page,
          limit,
        },
      });
      return res.data;
    },
    enabled: activeTab === 'orders',
  });

  const orders: AssemblyOrder[] = assemblyData?.data ?? [];
  const total = assemblyData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const executeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/assembly/${id}/execute`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assembly'] });
      success('Ordem executada com sucesso! Estoque consumido.');
      setExecuteOrder(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Erro ao executar ordem';
      error(msg);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/assembly/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assembly'] });
      success('Ordem cancelada.');
      setCancelOrder(null);
    },
    onError: () => error('Erro ao cancelar ordem'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ordens de Montagem</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie as ordens de montagem de chicotes elétricos</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {[
            { id: 'orders', label: 'Ordens' },
            { id: 'new', label: 'Nova Ordem' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'orders' | 'new')}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Ordens tab */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Status</option>
              <option value="pending">Pendente</option>
              <option value="completed">Concluída</option>
              <option value="cancelled">Cancelada</option>
            </select>
            <select
              value={harnessFilter}
              onChange={(e) => { setHarnessFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Chicotes</option>
              {harnesses.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Código', 'Chicote', 'Qtd', 'Depósito', 'Status', 'Data Criação', 'Data Conclusão', 'Ações'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-gray-200 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">
                        Nenhuma ordem de montagem encontrada
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-gray-700">{order.code}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[160px] truncate">
                          {order.harness?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          {order.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {order.warehouse?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">{statusBadge(order.status)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {formatDateTime(order.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {order.completedAt ? formatDateTime(order.completedAt) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setDetailOrder(order)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ver detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {order.status === 'pending' && canWrite && (
                              <>
                                <button
                                  onClick={() => setExecuteOrder(order)}
                                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Executar ordem"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setCancelOrder(order)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Cancelar ordem"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              total={total}
              limit={limit}
            />
          </div>
        </div>
      )}

      {/* Nova Ordem tab */}
      {activeTab === 'new' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <NewOrderTab
            warehouses={warehouses}
            harnesses={harnesses}
            onSuccess={() => {
              setActiveTab('orders');
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Detail modal */}
      {detailOrder && (
        <DetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
      )}

      {/* Execute confirm */}
      <ConfirmDialog
        isOpen={!!executeOrder}
        onClose={() => setExecuteOrder(null)}
        onConfirm={() => executeOrder && executeMutation.mutate(executeOrder.id)}
        title="Executar Ordem de Montagem"
        message={`Confirmar execução da ${executeOrder?.code}? Isso consumirá os componentes necessários do estoque para produzir ${executeOrder?.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} unidade(s) de ${executeOrder?.harness?.name}.`}
        confirmLabel="Executar"
        isLoading={executeMutation.isPending}
      />

      {/* Cancel confirm */}
      <ConfirmDialog
        isOpen={!!cancelOrder}
        onClose={() => setCancelOrder(null)}
        onConfirm={() => cancelOrder && cancelMutation.mutate(cancelOrder.id)}
        title="Cancelar Ordem de Montagem"
        message={`Tem certeza que deseja cancelar a ordem ${cancelOrder?.code}?`}
        confirmLabel="Cancelar Ordem"
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}

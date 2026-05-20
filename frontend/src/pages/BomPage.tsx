import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, CheckCircle, XCircle, ClipboardList } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { formatCurrency, formatQuantity } from '../lib/utils';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Badge from '../components/Badge';
import { useAuth } from '../lib/auth';

interface Product {
  id: string;
  sku: string;
  internalCode?: string;
  name: string;
  unit: string;
  cost: number;
  price: number;
  type: 'component' | 'harness';
}

function CreateHarnessModal({ onClose }: { onClose: () => void }) {
  const { success, error } = useToast();
  const qc = useQueryClient();
  const [sku, setSku] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [location, setLocation] = useState('');

  const mutation = useMutation({
    mutationFn: async () =>
      api.post('/bom/harnesses', {
        sku: sku || undefined,
        internalCode: internalCode || undefined,
        name,
        price: parseFloat(price) || 0,
        location: location || undefined,
        unit: 'UN',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['harnesses'] });
      success('Chicote criado. Agora adicione os componentes da BOM.');
      onClose();
    },
    onError: () => error('Erro ao criar chicote'),
  });

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Modal isOpen={true} onClose={onClose} title="Novo Chicote / Produto para BOM" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
            <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputClass} placeholder="Gerado se vazio" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CÃ³digo interno</label>
            <input value={internalCode} onChange={(e) => setInternalCode(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do chicote *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PreÃ§o de venda (R$)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="0.01" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LocalizaÃ§Ã£o</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Cancelar</button>
          <button type="button" disabled={!name || mutation.isPending} onClick={() => mutation.mutate()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">Criar Chicote</button>
        </div>
      </div>
    </Modal>
  );
}

interface BomItem {
  id: string;
  componentId: string;
  quantity: number;
  notes?: string;
  component: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    cost: number;
  };
}

interface BomData {
  harness: Product;
  items: BomItem[];
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

interface Warehouse {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

function AddItemModal({
  harnessId,
  onClose,
}: {
  harnessId: string;
  onClose: () => void;
}) {
  const { success, error } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedComponent, setSelectedComponent] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: searchData } = useQuery({
    queryKey: ['component-search', search],
    queryFn: async () => {
      if (!search.trim()) return { data: [] };
      const res = await api.get('/products', {
        params: { type: 'component', search: search.trim(), limit: 20 },
      });
      return res.data;
    },
    enabled: !!search.trim(),
  });

  const components: Product[] = searchData?.data ?? [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedComponent) throw new Error('Selecione um componente');
      return api.post(`/bom/${harnessId}/items`, {
        componentId: selectedComponent.id,
        quantity: parseFloat(quantity),
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bom', harnessId] });
      success('Componente adicionado Ã  BOM!');
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Erro ao adicionar componente';
      error(msg);
    },
  });

  return (
    <Modal isOpen={true} onClose={onClose} title="Adicionar Componente Ã  BOM" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Componente *</label>
          <div className="relative" ref={dropdownRef}>
            <input
              type="text"
              value={selectedComponent ? `${selectedComponent.sku} â€” ${selectedComponent.name}` : search}
              onChange={(e) => {
                setSelectedComponent(null);
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Buscar por nome ou SKU..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showDropdown && search.trim() && components.length > 0 && !selectedComponent && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {components.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                    onMouseDown={() => {
                      setSelectedComponent(c);
                      setShowDropdown(false);
                    }}
                  >
                    <span className="font-mono text-gray-500 mr-2">{c.sku}</span>
                    <span className="text-gray-900">{c.name}</span>
                    <span className="text-gray-400 ml-2">({c.unit})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ObservaÃ§Ãµes opcionais"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedComponent || !quantity || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
          >
            {mutation.isPending && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Adicionar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditItemModal({
  harnessId,
  item,
  onClose,
}: {
  harnessId: string;
  item: BomItem;
  onClose: () => void;
}) {
  const { success, error } = useToast();
  const qc = useQueryClient();
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [notes, setNotes] = useState(item.notes ?? '');

  const mutation = useMutation({
    mutationFn: async () => {
      return api.put(`/bom/${harnessId}/items/${item.id}`, {
        quantity: parseFloat(quantity),
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bom', harnessId] });
      success('Item da BOM atualizado!');
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Erro ao atualizar item';
      error(msg);
    },
  });

  return (
    <Modal isOpen={true} onClose={onClose} title="Editar Item da BOM" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Componente</label>
          <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
            <span className="font-mono text-gray-500 mr-2">{item.component.sku}</span>
            {item.component.name}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!quantity || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
          >
            {mutation.isPending && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function BomPage() {
  const { user } = useAuth();
  const canWrite = ['admin', 'manager'].includes(user?.role ?? '');
  const { success, error } = useToast();
  const qc = useQueryClient();

  const [selectedHarnessId, setSelectedHarnessId] = useState<string | null>(null);
  const [showCreateHarnessModal, setShowCreateHarnessModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<BomItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<BomItem | null>(null);

  // Feasibility state
  const [feasQty, setFeasQty] = useState('1');
  const [feasWarehouseId, setFeasWarehouseId] = useState('');
  const [runFeasibility, setRunFeasibility] = useState(false);

  // Fetch harnesses
  const { data: harnessesData, isLoading: harnessesLoading } = useQuery({
    queryKey: ['harnesses'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { type: 'harness', limit: 100 } });
      return res.data;
    },
  });

  const harnesses: Product[] = harnessesData?.data ?? [];

  // Fetch BOM for selected harness
  const { data: bomData, isLoading: bomLoading } = useQuery({
    queryKey: ['bom', selectedHarnessId],
    queryFn: async () => {
      const res = await api.get(`/bom/${selectedHarnessId}`);
      return res.data.data as BomData;
    },
    enabled: !!selectedHarnessId,
  });

  // Fetch warehouses
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses');
      return res.data.data as Warehouse[];
    },
  });

  const warehouses: Warehouse[] = warehousesData ?? [];

  // Feasibility
  const { data: feasibilityData, isLoading: feasLoading, refetch: refetchFeas } = useQuery({
    queryKey: ['feasibility', selectedHarnessId, feasQty, feasWarehouseId],
    queryFn: async () => {
      const res = await api.get(`/bom/${selectedHarnessId}/feasibility`, {
        params: {
          quantity: parseFloat(feasQty) || 1,
          warehouseId: feasWarehouseId || undefined,
        },
      });
      return res.data.data as { feasibility: FeasibilityItem[]; allSufficient: boolean };
    },
    enabled: runFeasibility && !!selectedHarnessId,
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.delete(`/bom/${selectedHarnessId}/items/${itemId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bom', selectedHarnessId] });
      success('Item removido da BOM!');
      setDeleteItem(null);
    },
    onError: () => error('Erro ao remover item'),
  });

  const bom = bomData;
  const items: BomItem[] = bom?.items ?? [];

  const totalBomCost = items.reduce((acc, item) => acc + item.quantity * item.component.cost, 0);

  const handleVerifyFeasibility = () => {
    setRunFeasibility(true);
    setTimeout(() => refetchFeas(), 50);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900">BOM - Lista de Materiais</h1><p className="text-sm text-gray-500 mt-1">Gerencie a estrutura de materiais dos chicotes eletricos</p></div>{canWrite && (<button onClick={() => setShowCreateHarnessModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"><Plus className="w-4 h-4" />Novo Chicote</button>)}</div><div className="flex flex-col xl:flex-row gap-6 min-h-[calc(100vh-190px)]">
        {/* Left panel â€” harness list */}
        <div className="w-full xl:w-[360px] flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Chicotes ({harnesses.length})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {harnessesLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : harnesses.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Nenhum chicote cadastrado
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {harnesses.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setSelectedHarnessId(h.id);
                      setRunFeasibility(false);
                    }}
                    className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                      selectedHarnessId === h.id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-gray-500">{h.sku}</p>
                        <p className="text-sm font-medium text-gray-900 whitespace-normal break-words">{h.name}</p>
                      </div>
                      <p className="text-xs text-gray-500 whitespace-nowrap">
                        {formatCurrency(h.price)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel â€” BOM */}
        <div className="flex-1 min-w-0 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {!selectedHarnessId ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-3">
              <ClipboardList className="w-12 h-12 text-gray-200" />
              <p className="text-sm">Selecione um chicote para ver a BOM</p>
            </div>
          ) : bomLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-y-auto">
              {/* BOM header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-start justify-between gap-4 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="green">Chicote</Badge>
                    <span className="font-mono text-xs text-gray-500">{bom?.harness.sku}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{bom?.harness.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    PreÃ§o: {formatCurrency(bom?.harness.price ?? 0)}
                  </p>
                </div>
                {canWrite && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap flex-shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Componente
                  </button>
                )}
              </div>

              {/* BOM items table */}
              <div className="flex-1 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {['SKU', 'Componente', 'Quantidade', 'Unidade', 'Custo Unit.', 'Custo Total', 'Notas', 'AÃ§Ãµes'].map((h) => (
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
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                          Nenhum componente na BOM. {canWrite && 'Clique em "Adicionar Componente" para comeÃ§ar.'}
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-500">{item.component.sku}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.component.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {formatQuantity(item.quantity)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.component.unit}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(item.component.cost)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {formatCurrency(item.quantity * item.component.cost)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[140px] truncate">
                            {item.notes ?? '-'}
                          </td>
                          <td className="px-4 py-3">
                            {canWrite && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setEditItem(item)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteItem(item)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remover"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer â€” total cost */}
              {items.length > 0 && (
                <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <div className="flex items-center justify-end gap-4">
                    <span className="text-sm font-medium text-gray-700">Custo Total da BOM:</span>
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(totalBomCost)}</span>
                  </div>
                </div>
              )}

              {/* Feasibility section */}
              <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Verificar Viabilidade</h4>
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Quantidade a produzir</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={feasQty}
                      onChange={(e) => setFeasQty(e.target.value)}
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">DepÃ³sito (opcional)</label>
                    <select
                      value={feasWarehouseId}
                      onChange={(e) => setFeasWarehouseId(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos os depÃ³sitos</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleVerifyFeasibility}
                    disabled={feasLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2 disabled:opacity-60"
                  >
                    {feasLoading && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    Verificar Viabilidade
                  </button>
                </div>

                {runFeasibility && feasibilityData && (
                  <div className="space-y-3">
                    {/* Banner */}
                    {feasibilityData.allSufficient ? (
                      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm font-medium">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        Produzir {formatQuantity(parseFloat(feasQty))} unidade(s) Ã© VIÃVEL
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm font-medium">
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        INVIÃVEL â€”{' '}
                        {feasibilityData.feasibility.filter((f) => !f.sufficient).length} componente(s)
                        insuficiente(s)
                      </div>
                    )}

                    {/* Feasibility table */}
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {['SKU', 'Componente', 'Unidade', 'NecessÃ¡rio', 'DisponÃ­vel', 'SituaÃ§Ã£o'].map((h) => (
                              <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {feasibilityData.feasibility.map((f) => (
                            <tr
                              key={f.componentId}
                              className={f.sufficient ? 'bg-green-50' : 'bg-red-50'}
                            >
                              <td className="px-3 py-2 font-mono text-gray-500">{f.sku}</td>
                              <td className="px-3 py-2 text-gray-900">{f.name}</td>
                              <td className="px-3 py-2 text-gray-600">{f.unit}</td>
                              <td className="px-3 py-2 font-medium text-gray-900">
                                {formatQuantity(f.required)}
                              </td>
                              <td className="px-3 py-2 font-medium text-gray-900">
                                {formatQuantity(f.available)}
                              </td>
                              <td className="px-3 py-2">
                                {f.sufficient ? (
                                  <Badge variant="success">Suficiente</Badge>
                                ) : (
                                  <Badge variant="error">Insuficiente</Badge>
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
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateHarnessModal && (
        <CreateHarnessModal onClose={() => setShowCreateHarnessModal(false)} />
      )}

      {showAddModal && selectedHarnessId && (
        <AddItemModal harnessId={selectedHarnessId} onClose={() => setShowAddModal(false)} />
      )}

      {editItem && selectedHarnessId && (
        <EditItemModal
          harnessId={selectedHarnessId}
          item={editItem}
          onClose={() => setEditItem(null)}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteItem && deleteItemMutation.mutate(deleteItem.id)}
        title="Remover Componente da BOM"
        message={`Deseja remover "${deleteItem?.component.name}" da BOM? Esta aÃ§Ã£o nÃ£o pode ser desfeita.`}
        confirmLabel="Remover"
        isLoading={deleteItemMutation.isPending}
      />
    </div>
  );
}



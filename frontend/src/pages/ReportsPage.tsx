import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  DollarSign,
  AlertTriangle,
  ArrowLeftRight,
  FileText,
} from 'lucide-react';
import api from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import Badge from '../components/Badge';

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

function KpiTab() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['kpis', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get('/reports/kpis', { params: { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined } });
      return res.data.data;
    },
  });

  const kpis = [
    { label: 'Total de Produtos', value: data?.totalProducts ?? 0, icon: Package, color: 'bg-blue-600' },
    { label: 'Valor Total em Estoque', value: formatCurrency(data?.totalStockValue ?? 0), icon: DollarSign, color: 'bg-green-600' },
    { label: 'Produtos com Estoque Baixo', value: data?.lowStockProducts ?? 0, icon: AlertTriangle, color: 'bg-yellow-500' },
    { label: 'Movimentações no Período', value: data?.monthlyMovements ?? 0, icon: ArrowLeftRight, color: 'bg-purple-600' },
    { label: 'NF-e Pendentes', value: data?.pendingNFe ?? 0, icon: FileText, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data de</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data até</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 rounded-xl mb-4" />
              <div className="h-8 bg-gray-200 rounded mb-2 w-2/3" />
              <div className="h-4 bg-gray-100 rounded" />
            </div>
          ))
        ) : (
          kpis.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
              <div className="text-gray-500">{label}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AbcCurveTab({ warehouses }: { warehouses: Warehouse[] }) {
  const [warehouseId, setWarehouseId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['abc-curve', warehouseId],
    queryFn: async () => {
      const res = await api.get('/reports/abc-curve', {
        params: { warehouseId: warehouseId || undefined },
      });
      return res.data.data as {
        id: string;
        name: string;
        sku: string;
        totalQty: number;
        totalValue: number;
        class: string;
        percentTotal: number;
      }[];
    },
  });

  const products = data ?? [];
  const classCounts = { A: 0, B: 0, C: 0 };
  products.forEach((p) => { if (p.class in classCounts) classCounts[p.class as 'A' | 'B' | 'C']++; });

  const abcVariant: Record<string, 'green' | 'blue' | 'gray'> = { A: 'green', B: 'blue', C: 'gray' };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Depósito</label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Depósitos</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(['A', 'B', 'C'] as const).map((cls) => (
          <div key={cls} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
            <Badge variant={abcVariant[cls]} className="text-lg px-4 py-1">Classe {cls}</Badge>
            <p className="text-2xl font-bold text-gray-900 mt-3">{classCounts[cls]}</p>
            <p className="text-sm text-gray-500">produtos</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Produto', 'SKU', 'Saldo Qtd', 'Valor Total', 'Classe ABC', '% do Total'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">Sem dados</td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.totalQty}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(p.totalValue)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={abcVariant[p.class] ?? 'gray'}>Classe {p.class}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{(p.percentTotal ?? 0).toFixed(2)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FefoTab({ warehouses }: { warehouses: Warehouse[] }) {
  const [warehouseId, setWarehouseId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['fefo', warehouseId],
    queryFn: async () => {
      const res = await api.get('/reports/fefo', {
        params: { warehouseId: warehouseId || undefined },
      });
      return res.data.data as {
        id: string;
        product: { name: string };
        lot: string;
        warehouse: { name: string };
        quantity: number;
        expiryDate: string;
        daysToExpire: number;
      }[];
    },
  });

  const items = data ?? [];

  const daysColor = (days: number) => {
    if (days < 7) return 'text-red-600 bg-red-50';
    if (days < 30) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Depósito</label>
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os Depósitos</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Produto', 'Lote', 'Depósito', 'Qtd', 'Data Vencimento', 'Dias até Vencer'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Nenhum lote com vencimento registrado
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.product?.name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{item.lot}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.warehouse?.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(item.expiryDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${daysColor(item.daysToExpire)}`}>
                        {item.daysToExpire < 0 ? 'Vencido' : `${item.daysToExpire} dias`}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RotationTab() {
  const [period, setPeriod] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ['stock-rotation', period],
    queryFn: async () => {
      const res = await api.get('/reports/stock-rotation', { params: { days: period } });
      return res.data.data as {
        id: string;
        name: string;
        sku: string;
        entries: number;
        exits: number;
        rotation: number;
      }[];
    },
  });

  const products = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Período</label>
        <div className="flex gap-2">
          {[7, 15, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                period === d
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Produto', 'SKU', 'Entradas', 'Saídas', 'Giro (Rotação)'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">Sem dados para o período</td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3 text-sm text-green-700 font-medium">+{p.entries}</td>
                    <td className="px-4 py-3 text-sm text-red-700 font-medium">-{p.exits}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min((p.rotation / 10) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{(p.rotation ?? 0).toFixed(2)}x</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'kpis', label: 'KPIs' },
  { id: 'abc', label: 'Curva ABC' },
  { id: 'fefo', label: 'FEFO (Validade)' },
  { id: 'rotation', label: 'Giro de Estoque' },
] as const;

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'kpis' | 'abc' | 'fefo' | 'rotation'>('kpis');

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses');
      return res.data.data as Warehouse[];
    },
  });

  const warehouses = warehousesData ?? [];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'kpis' && <KpiTab />}
      {activeTab === 'abc' && <AbcCurveTab warehouses={warehouses} />}
      {activeTab === 'fefo' && <FefoTab warehouses={warehouses} />}
      {activeTab === 'rotation' && <RotationTab />}
    </div>
  );
}

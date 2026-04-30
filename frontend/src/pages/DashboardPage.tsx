import { useQuery } from '@tanstack/react-query';
import {
  Package,
  DollarSign,
  AlertTriangle,
  ArrowLeftRight,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import api from '../lib/api';
import { formatCurrency } from '../lib/utils';

interface KPIs {
  totalProducts?: number;
  totalStockValue?: number;
  lowStockProducts?: number;
  monthlyMovements?: number;
  pendingNFe?: number;
  movementsByType?: { type: string; count: number }[];
  abcCurve?: { class: string; count: number }[];
  topProducts?: { id: string; name: string; sku: string; stockValue: number; totalStock: number }[];
}

const ABC_COLORS = { A: '#22c55e', B: '#3b82f6', C: '#9ca3af' };
const MOVEMENT_COLORS: Record<string, string> = {
  entry: '#22c55e',
  exit: '#ef4444',
  transfer: '#3b82f6',
  adjustment: '#f59e0b',
};

const movementTypeLabel: Record<string, string> = {
  entry: 'Entrada',
  exit: 'Saída',
  transfer: 'Transferência',
  adjustment: 'Ajuste',
};

function KPICard({
  title,
  value,
  icon: Icon,
  color,
  warning,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  warning?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl p-6 shadow-sm border ${warning ? 'border-yellow-200' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {warning && <AlertCircle className="w-5 h-5 text-yellow-500" />}
      </div>
      <div className={`text-2xl font-bold ${warning ? 'text-yellow-600' : 'text-gray-900'} mb-1`}>
        {value}
      </div>
      <div className="text-sm text-gray-500">{title}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: async () => {
      const res = await api.get('/reports/kpis');
      return res.data.data as KPIs;
    },
  });

  const { data: alertsData } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await api.get('/alerts');
      return res.data.data as { id: string; type: string; message: string; read: boolean }[];
    },
  });

  const { data: abcData } = useQuery({
    queryKey: ['abc-curve'],
    queryFn: async () => {
      const res = await api.get('/reports/abc-curve');
      return res.data.data as { class: string; count?: number }[];
    },
  });

  const unreadAlerts = alertsData?.filter((a) => !a.read) ?? [];

  const abcChartData = ['A', 'B', 'C'].map((cls) => ({
    name: `Classe ${cls}`,
    value: abcData?.filter((p) => p.class === cls).length ?? 0,
    color: ABC_COLORS[cls as keyof typeof ABC_COLORS],
  })).filter((d) => d.value > 0);

  const movementsChartData = (kpiData?.movementsByType ?? []).map((m) => ({
    name: movementTypeLabel[m.type] || m.type,
    count: m.count,
    fill: MOVEMENT_COLORS[m.type] || '#9ca3af',
  }));

  return (
    <div className="space-y-6">
      {/* Unread alerts */}
      {unreadAlerts.length > 0 && (
        <div className="space-y-2">
          {unreadAlerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl"
            >
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800 flex-1">{alert.message}</p>
              <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full capitalize">
                {alert.type === 'min_stock' ? 'Estoque Mínimo' : 'Validade'}
              </span>
            </div>
          ))}
          {unreadAlerts.length > 3 && (
            <p className="text-sm text-yellow-700 text-center">
              + {unreadAlerts.length - 3} alertas não lidos
            </p>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpiLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-lg mb-4" />
              <div className="h-7 bg-gray-200 rounded mb-2 w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-full" />
            </div>
          ))
        ) : (
          <>
            <KPICard
              title="Total de Produtos"
              value={kpiData?.totalProducts ?? 0}
              icon={Package}
              color="bg-blue-600"
            />
            <KPICard
              title="Valor Total em Estoque"
              value={formatCurrency(kpiData?.totalStockValue ?? 0)}
              icon={DollarSign}
              color="bg-green-600"
            />
            <KPICard
              title="Produtos com Estoque Baixo"
              value={kpiData?.lowStockProducts ?? 0}
              icon={AlertTriangle}
              color={(kpiData?.lowStockProducts ?? 0) > 0 ? 'bg-yellow-500' : 'bg-gray-400'}
              warning={(kpiData?.lowStockProducts ?? 0) > 0}
            />
            <KPICard
              title="Movimentações no Mês"
              value={kpiData?.monthlyMovements ?? 0}
              icon={ArrowLeftRight}
              color="bg-purple-600"
            />
            <KPICard
              title="NF-e Pendentes"
              value={kpiData?.pendingNFe ?? 0}
              icon={FileText}
              color={(kpiData?.pendingNFe ?? 0) > 0 ? 'bg-orange-500' : 'bg-gray-400'}
              warning={(kpiData?.pendingNFe ?? 0) > 0}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart - movements by type */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Movimentações do Mês por Tipo</h3>
          {movementsChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Nenhuma movimentação este mês
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={movementsChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [value, 'Quantidade']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {movementsChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart - ABC curve */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Distribuição Curva ABC</h3>
          {abcChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Sem dados de curva ABC
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={abcChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {abcChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top products table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Top 10 Produtos por Valor em Estoque</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Estoque</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {kpiLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (kpiData?.topProducts ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                (kpiData?.topProducts ?? []).slice(0, 10).map((product, idx) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{product.sku}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{product.totalStock}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(product.stockValue)}
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

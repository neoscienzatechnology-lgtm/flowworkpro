import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, Check, RefreshCw, Bell } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { formatDateTime } from '../lib/utils';
import Badge from '../components/Badge';

interface Alert {
  id: string;
  type: 'min_stock' | 'expiry';
  message: string;
  read: boolean;
  createdAt: string;
  product?: { name: string; sku: string };
}

const alertConfig = {
  min_stock: {
    label: 'Estoque Mínimo',
    variant: 'error' as const,
    icon: AlertTriangle,
    bg: 'bg-red-50 border-red-200',
    iconColor: 'text-red-600',
  },
  expiry: {
    label: 'Validade',
    variant: 'warning' as const,
    icon: Clock,
    bg: 'bg-orange-50 border-orange-200',
    iconColor: 'text-orange-600',
  },
};

export default function AlertsPage() {
  const { success, error } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await api.get('/alerts');
      return res.data.data as Alert[];
    },
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.put(`/alerts/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alerts-unread-count'] });
    },
  });

  const checkMutation = useMutation({
    mutationFn: () => api.post('/alerts/check'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alerts-unread-count'] });
      success('Verificação concluída!');
    },
    onError: () => error('Erro ao verificar estoque'),
  });

  const alerts = data ?? [];
  const unread = alerts.filter((a) => !a.read);
  const read = alerts.filter((a) => a.read);

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {unread.length > 0 && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
              {unread.length} não lido{unread.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => checkMutation.mutate()}
          disabled={checkMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${checkMutation.isPending ? 'animate-spin' : ''}`} />
          Verificar Estoque
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 animate-pulse h-20" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Bell className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-gray-600 font-medium">Nenhum alerta</p>
          <p className="text-gray-400 text-sm">Todos os produtos estão com estoque adequado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Unread alerts */}
          {unread.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                Não Lidos ({unread.length})
              </h3>
              <div className="space-y-3">
                {unread.map((alert) => {
                  const config = alertConfig[alert.type] ?? alertConfig.min_stock;
                  const Icon = config.icon;
                  return (
                    <div
                      key={alert.id}
                      className={`flex items-start gap-4 p-4 border rounded-xl ${config.bg}`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 ${config.iconColor}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={config.variant}>{config.label}</Badge>
                          {alert.product && (
                            <span className="text-xs text-gray-500 font-mono">{alert.product.sku}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800">{alert.message}</p>
                        {alert.product && (
                          <p className="text-xs text-gray-500 mt-1">{alert.product.name}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">{formatDateTime(alert.createdAt)}</p>
                      </div>
                      <button
                        onClick={() => markReadMutation.mutate(alert.id)}
                        disabled={markReadMutation.isPending}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Marcar como lido
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Read alerts */}
          {read.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                Lidos ({read.length})
              </h3>
              <div className="space-y-2">
                {read.map((alert) => {
                  const config = alertConfig[alert.type] ?? alertConfig.min_stock;
                  const Icon = config.icon;
                  return (
                    <div
                      key={alert.id}
                      className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl bg-white opacity-60"
                    >
                      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 text-gray-400`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="gray">{config.label}</Badge>
                        </div>
                        <p className="text-sm text-gray-600">{alert.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDateTime(alert.createdAt)}</p>
                      </div>
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

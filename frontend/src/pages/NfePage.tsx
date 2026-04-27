import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, X, CheckCircle, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { formatCurrency, formatDate } from '../lib/utils';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

interface NfeItem {
  id: string;
  productId?: string;
  product?: { name: string; sku: string };
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  ncm?: string;
  matched?: boolean;
}

interface Nfe {
  id: string;
  number: string;
  series?: string;
  issuerName: string;
  issuerCnpj: string;
  totalValue: number;
  issueDate: string;
  status: 'pending' | 'processed' | 'error';
  items?: NfeItem[];
  errorMessage?: string;
}

const statusBadge: Record<string, { variant: 'warning' | 'success' | 'error'; label: string }> = {
  pending: { variant: 'warning', label: 'Pendente' },
  processed: { variant: 'success', label: 'Processada' },
  error: { variant: 'error', label: 'Erro' },
};

function NfeDetailModal({ nfe, onClose }: { nfe: Nfe; onClose: () => void }) {
  const { success, error } = useToast();
  const qc = useQueryClient();

  const { data: detailData, isLoading } = useQuery({
    queryKey: ['nfe', nfe.id],
    queryFn: async () => {
      const res = await api.get(`/nfe/${nfe.id}`);
      return res.data.data as Nfe;
    },
  });

  const processMutation = useMutation({
    mutationFn: () => api.post(`/nfe/${nfe.id}/process`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nfe'] });
      qc.invalidateQueries({ queryKey: ['nfe', nfe.id] });
      success('NF-e processada com sucesso!');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao processar NF-e';
      error(msg);
    },
  });

  const detail = detailData ?? nfe;

  return (
    <Modal isOpen={true} onClose={onClose} title={`NF-e ${nfe.number} - Série ${nfe.series ?? '1'}`} size="xl">
      <div className="space-y-4">
        {/* Header info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
          <div>
            <p className="text-xs text-gray-500">Emitente</p>
            <p className="font-medium text-gray-900">{detail.issuerName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">CNPJ</p>
            <p className="font-medium text-gray-900">{detail.issuerCnpj}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Data de Emissão</p>
            <p className="font-medium text-gray-900">{formatDate(detail.issueDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Valor Total</p>
            <p className="font-bold text-gray-900 text-lg">{formatCurrency(detail.totalValue)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <Badge variant={statusBadge[detail.status]?.variant ?? 'gray'}>
              {statusBadge[detail.status]?.label ?? detail.status}
            </Badge>
          </div>
        </div>

        {detail.errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {detail.errorMessage}
          </div>
        )}

        {/* Items */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Itens da NF-e</h4>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Descrição</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Produto Vinculado</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qtd</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Preço Unit.</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(detail.items ?? []).map((item) => (
                    <tr key={item.id} className={`${item.matched ? 'bg-green-50' : ''}`}>
                      <td className="px-3 py-2 text-sm text-gray-700">{item.description}</td>
                      <td className="px-3 py-2 text-sm">
                        {item.product ? (
                          <span className="text-green-700 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {item.product.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 flex items-center gap-1">
                            <X className="w-3 h-3" />
                            Não vinculado
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-right text-gray-700">{item.quantity}</td>
                      <td className="px-3 py-2 text-sm text-right text-gray-700">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-sm text-right font-medium text-gray-900">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {detail.status === 'pending' && (
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-60"
            >
              {processMutation.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Processar NF-e
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function NfePage() {
  const { success, error } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedNfe, setSelectedNfe] = useState<Nfe | null>(null);
  const [importResult, setImportResult] = useState<{
    message: string;
    matched: number;
    unmatched: number;
  } | null>(null);

  const { data: nfesData, isLoading } = useQuery({
    queryKey: ['nfe'],
    queryFn: async () => {
      const res = await api.get('/nfe');
      return res.data.data as Nfe[];
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/nfe/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['nfe'] });
      setImportResult({
        message: data.data?.message || 'NF-e importada com sucesso!',
        matched: data.data?.matchedItems ?? 0,
        unmatched: data.data?.unmatchedItems ?? 0,
      });
      success('NF-e importada com sucesso!');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao importar NF-e';
      error(msg);
    },
  });

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.xml')) {
      error('Apenas arquivos XML são aceitos');
      return;
    }
    setImportResult(null);
    importMutation.mutate(file);
  };

  const nfes = nfesData ?? [];

  return (
    <div className="space-y-8">
      {/* Import section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Importar NF-e</h3>
          <p className="text-sm text-gray-500 mt-0.5">Faça upload do arquivo XML da Nota Fiscal Eletrônica</p>
        </div>
        <div className="p-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            } ${importMutation.isPending ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
            {importMutation.isPending ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-600 text-sm">Importando NF-e...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
                  <Upload className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <p className="text-gray-700 font-medium">Arraste o arquivo XML aqui</p>
                  <p className="text-gray-400 text-sm mt-1">ou clique para selecionar</p>
                </div>
                <p className="text-xs text-gray-400">Apenas arquivos .xml</p>
              </div>
            )}
          </div>

          {importResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="font-medium text-green-800">{importResult.message}</p>
              </div>
              <div className="flex gap-6 text-sm">
                <span className="text-green-700">
                  Itens vinculados: <strong>{importResult.matched}</strong>
                </span>
                <span className={importResult.unmatched > 0 ? 'text-yellow-700' : 'text-gray-500'}>
                  Não vinculados: <strong>{importResult.unmatched}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NF-e list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">NF-es Importadas</h3>
          <span className="text-sm text-gray-500">{nfes.length} nota(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Número', 'Série', 'Emitente', 'CNPJ', 'Valor Total', 'Data Emissão', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : nfes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    Nenhuma NF-e importada
                  </td>
                </tr>
              ) : (
                nfes.map((nfe) => {
                  const status = statusBadge[nfe.status] ?? { variant: 'gray' as const, label: nfe.status };
                  return (
                    <tr
                      key={nfe.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedNfe(nfe)}
                    >
                      <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{nfe.number}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{nfe.series ?? '1'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-[180px] truncate">{nfe.issuerName}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-500">{nfe.issuerCnpj}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(nfe.totalValue)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(nfe.issueDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {nfe.status === 'pending' && <Clock className="w-3.5 h-3.5 text-yellow-500" />}
                          {nfe.status === 'processed' && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                          {nfe.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-600" />}
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedNfe && (
        <NfeDetailModal nfe={selectedNfe} onClose={() => setSelectedNfe(null)} />
      )}
    </div>
  );
}

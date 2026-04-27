import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Badge from '../components/Badge';

interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  active: boolean;
}

const warehouseSchema = z.object({
  code: z.string().min(1, 'Código obrigatório'),
  name: z.string().min(1, 'Nome obrigatório'),
  address: z.string().optional(),
  active: z.boolean(),
});

type WarehouseForm = z.infer<typeof warehouseSchema>;

function WarehouseModal({ warehouse, onClose }: { warehouse: Warehouse | null; onClose: () => void }) {
  const { success, error } = useToast();
  const qc = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<WarehouseForm>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: warehouse
      ? { code: warehouse.code, name: warehouse.name, address: warehouse.address ?? '', active: warehouse.active }
      : { code: '', name: '', address: '', active: true },
  });

  const mutation = useMutation({
    mutationFn: async (data: WarehouseForm) => {
      if (warehouse) return api.put(`/warehouses/${warehouse.id}`, data);
      return api.post('/warehouses', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      success(warehouse ? 'Depósito atualizado!' : 'Depósito criado!');
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao salvar depósito';
      error(msg);
    },
  });

  return (
    <Modal isOpen={true} onClose={onClose} title={warehouse ? 'Editar Depósito' : 'Novo Depósito'} size="sm">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
          <input
            {...register('code')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: DEP01"
          />
          {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
          <input
            {...register('name')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
          <textarea
            {...register('address')}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <input {...register('active')} type="checkbox" id="active" className="w-4 h-4 rounded text-blue-600" />
          <label htmlFor="active" className="text-sm font-medium text-gray-700">Depósito ativo</label>
        </div>
        <div className="flex gap-3 justify-end pt-2 border-t border-gray-200">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
          >
            {mutation.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {warehouse ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function WarehousesPage() {
  const { success, error } = useToast();
  const qc = useQueryClient();
  const [editWarehouse, setEditWarehouse] = useState<Warehouse | null | 'new'>('new');
  const [deleteWarehouse, setDeleteWarehouse] = useState<Warehouse | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await api.get('/warehouses');
      return res.data.data as Warehouse[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/warehouses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      success('Depósito excluído!');
      setDeleteWarehouse(null);
    },
    onError: () => error('Erro ao excluir depósito'),
  });

  const warehouses = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setEditWarehouse(null)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Novo Depósito
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endereço</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : warehouses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">
                    Nenhum depósito cadastrado
                  </td>
                </tr>
              ) : (
                warehouses.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{w.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{w.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{w.address ?? '-'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={w.active ? 'success' : 'gray'}>
                        {w.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditWarehouse(w)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteWarehouse(w)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editWarehouse !== 'new' && (
        <WarehouseModal warehouse={editWarehouse} onClose={() => setEditWarehouse('new')} />
      )}

      <ConfirmDialog
        isOpen={!!deleteWarehouse}
        onClose={() => setDeleteWarehouse(null)}
        onConfirm={() => deleteWarehouse && deleteMutation.mutate(deleteWarehouse.id)}
        title="Excluir Depósito"
        message={`Tem certeza que deseja excluir o depósito "${deleteWarehouse?.name}"?`}
        confirmLabel="Excluir"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

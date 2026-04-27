import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Badge from '../components/Badge';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  active: boolean;
}

const userSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().optional(),
  role: z.enum(['admin', 'manager', 'operator', 'viewer']),
  active: z.boolean(),
});

type UserForm = z.infer<typeof userSchema>;

const roleConfig: Record<string, { label: string; variant: 'error' | 'info' | 'success' | 'gray' }> = {
  admin: { label: 'Administrador', variant: 'error' },
  manager: { label: 'Gerente', variant: 'info' },
  operator: { label: 'Operador', variant: 'success' },
  viewer: { label: 'Visualizador', variant: 'gray' },
};

function UserModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { success, error } = useToast();
  const qc = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: user
      ? { name: user.name, email: user.email, role: user.role, active: user.active, password: '' }
      : { name: '', email: '', role: 'operator', active: true, password: '' },
  });

  const mutation = useMutation({
    mutationFn: async (data: UserForm) => {
      const payload = { ...data, password: data.password || undefined };
      if (user) return api.put(`/users/${user.id}`, payload);
      return api.post('/users', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      success(user ? 'Usuário atualizado!' : 'Usuário criado!');
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao salvar usuário';
      error(msg);
    },
  });

  return (
    <Modal isOpen={true} onClose={onClose} title={user ? 'Editar Usuário' : 'Novo Usuário'} size="sm">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
          <input
            {...register('name')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
          <input
            {...register('email')}
            type="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Senha {user ? '(deixe em branco para manter)' : '*'}
          </label>
          <input
            {...register('password')}
            type="password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Perfil *</label>
          <select
            {...register('role')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="admin">Administrador</option>
            <option value="manager">Gerente</option>
            <option value="operator">Operador</option>
            <option value="viewer">Visualizador</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <input {...register('active')} type="checkbox" id="active" className="w-4 h-4 rounded text-blue-600" />
          <label htmlFor="active" className="text-sm font-medium text-gray-700">Usuário ativo</label>
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
            {user ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { success, error } = useToast();
  const qc = useQueryClient();
  const [editUser, setEditUser] = useState<User | null | 'new'>('new');
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  // Admin-only guard
  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <ShieldCheck className="w-16 h-16 text-gray-300" />
        <p className="text-gray-500 text-lg font-medium">Acesso Restrito</p>
        <p className="text-gray-400 text-sm">Apenas administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data.data as User[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      success('Usuário excluído!');
      setDeleteUser(null);
    },
    onError: () => error('Erro ao excluir usuário'),
  });

  const users = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setEditUser(null)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">E-mail</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Perfil</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">
                    Nenhum usuário cadastrado
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const role = roleConfig[u.role] ?? { label: u.role, variant: 'gray' as const };
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-semibold flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={role.variant}>{role.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.active ? 'success' : 'gray'}>
                          {u.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditUser(u)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => setDeleteUser(u)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editUser !== 'new' && (
        <UserModal user={editUser} onClose={() => setEditUser('new')} />
      )}

      <ConfirmDialog
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
        title="Excluir Usuário"
        message={`Tem certeza que deseja excluir o usuário "${deleteUser?.name}"?`}
        confirmLabel="Excluir"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

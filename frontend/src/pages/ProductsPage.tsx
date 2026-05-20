import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Box, FileImage, FileText, Plus, Pencil, Trash2, Tag, Search } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../lib/toast';
import { formatCurrency, formatQuantity } from '../lib/utils';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Badge from '../components/Badge';
import Pagination from '../components/Pagination';
import { useAuth } from '../lib/auth';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  internalCode?: string;
  name: string;
  description?: string;
  categoryId?: string;
  category?: Category;
  ean13?: string;
  unit: string;
  location?: string;
  realImageUrl?: string;
  cadFileUrl?: string;
  model3dUrl?: string;
  stepFileUrl?: string;
  minStock: number;
  cost: number;
  price: number;
  active: boolean;
  totalStock?: number;
  type?: 'component' | 'harness';
}

interface ProductForm {
  sku: string;
  internalCode?: string;
  name: string;
  description?: string;
  categoryId?: string;
  ean13?: string;
  unit: string;
  location?: string;
  realImageUrl?: string;
  cadFileUrl?: string;
  model3dUrl?: string;
  stepFileUrl?: string;
  minStock: number;
  cost: number;
  price: number;
  active: boolean;
  type: 'component' | 'harness';
}

const productSchema = z.object({
  sku: z.string().min(1, 'SKU obrigatÃ³rio'),
  internalCode: z.string().optional(),
  name: z.string().min(1, 'Nome obrigatÃ³rio'),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  ean13: z.string().optional(),
  unit: z.string().min(1, 'Unidade obrigatÃ³ria'),
  location: z.string().optional(),
  realImageUrl: z.string().optional(),
  cadFileUrl: z.string().optional(),
  model3dUrl: z.string().optional(),
  stepFileUrl: z.string().optional(),
  minStock: z.coerce.number().min(0, 'MÃ­nimo 0'),
  cost: z.coerce.number().min(0, 'MÃ­nimo 0'),
  price: z.coerce.number().min(0, 'MÃ­nimo 0'),
  active: z.boolean(),
  type: z.enum(['component', 'harness']),
});

const UNITS = ['UN', 'KG', 'L', 'M', 'CX', 'PC', 'PAR', 'DZ', 'M2', 'M3'];

function LabelModal({ product, onClose }: { product: Product; onClose: () => void }) {
  return (
    <Modal isOpen={true} onClose={onClose} title="Etiqueta do Produto" size="md">
      <div className="space-y-4">
        <div className="border border-gray-200 rounded-xl p-6 bg-white">
          <div className="text-center space-y-3">
            <h3 className="font-bold text-lg text-gray-900">{product.name}</h3>
            <p className="text-sm text-gray-500">SKU: {product.sku}</p>

            {product.ean13 && (
              <div className="my-4">
                <p className="text-xs text-gray-400 mb-2">CÃ³digo de Barras EAN-13</p>
                <div className="font-mono text-xl font-bold tracking-widest bg-gray-50 p-3 rounded-lg border border-gray-200">
                  {product.ean13}
                </div>
                <div className="flex justify-center gap-0.5 mt-2">
                  {product.ean13.split('').map((digit, i) => (
                    <div
                      key={i}
                      className="bg-gray-800"
                      style={{
                        width: '2px',
                        height: `${parseInt(digit) * 3 + 20}px`,
                        marginRight: i === 0 || i === 6 || i === 12 ? '4px' : '0px',
                      }}
                    />
                  ))}
                </div>
                <p className="font-mono text-sm text-center mt-1">{product.ean13}</p>
              </div>
            )}

            <div className="text-left space-y-1 text-sm border-t border-gray-100 pt-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Unidade:</span>
                <span className="font-medium">{product.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">PreÃ§o:</span>
                <span className="font-medium">{formatCurrency(product.price)}</span>
              </div>
              {product.category && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Categoria:</span>
                  <span className="font-medium">{product.category.name}</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <p className="text-xs text-gray-400">QR Code Data</p>
              <p className="font-mono text-xs bg-gray-50 p-2 rounded border border-gray-200 break-all">
                {JSON.stringify({ id: product.id, sku: product.sku, name: product.name, ean13: product.ean13 })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Fechar
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Tag className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProductModal({
  product,
  onClose,
  categories,
}: {
  product: Product | null;
  onClose: () => void;
  categories: Category[];
}) {
  const { success, error } = useToast();
  const qc = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema) as Resolver<ProductForm>,
    defaultValues: product
        ? {
          sku: product.sku,
          internalCode: product.internalCode ?? '',
          name: product.name,
          description: product.description ?? '',
          categoryId: product.categoryId ?? '',
          ean13: product.ean13 ?? '',
          unit: product.unit,
          location: product.location ?? '',
          realImageUrl: product.realImageUrl ?? '',
          cadFileUrl: product.cadFileUrl ?? '',
          model3dUrl: product.model3dUrl ?? '',
          stepFileUrl: product.stepFileUrl ?? '',
          minStock: product.minStock,
          cost: product.cost,
          price: product.price,
          active: product.active,
          type: product.type ?? 'component',
        }
      : { sku: '', internalCode: '', name: '', unit: 'UN', location: '', realImageUrl: '', cadFileUrl: '', model3dUrl: '', stepFileUrl: '', minStock: 0, cost: 0, price: 0, active: true, type: 'component' },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProductForm) => {
      const payload = {
        ...data,
        categoryId: data.categoryId || undefined,
        ean13: data.ean13 || undefined,
        internalCode: data.internalCode || undefined,
      };
      if (product) {
        return api.put(`/products/${product.id}`, payload);
      }
      return api.post('/products', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      success(product ? 'Produto atualizado com sucesso!' : 'Produto criado com sucesso!');
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao salvar produto';
      error(msg);
    },
  });

  return (
    <Modal isOpen={true} onClose={onClose} title={product ? 'Editar Produto' : 'Novo Produto'} size="lg">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
            <input
              {...register('sku')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.sku && <p className="mt-1 text-xs text-red-600">{errors.sku.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código Interno</label>
            <input
              {...register('internalCode')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex.: INT-001"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">EAN-13</label>
            <input
              {...register('ean13')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0000000000000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Localização</label>
            <input
              {...register('location')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Rua, prateleira, gaveta..."
            />
          </div>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">DescriÃ§Ã£o</label>
          <textarea
            {...register('description')}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Arquivos técnicos e imagens</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imagem real do produto</label>
              <input {...register('realImageUrl')} placeholder="URL da imagem" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diagrama CAD</label>
              <input {...register('cadFileUrl')} placeholder="URL do arquivo CAD/desenho" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preview 3D (GLB/GLTF)</label>
              <input {...register('model3dUrl')} placeholder="URL do modelo 3D para visualização" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo STEP/STP</label>
              <input {...register('stepFileUrl')} placeholder="URL do arquivo técnico .step/.stp" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <p className="text-xs text-gray-500">Arquivos STEP ficam disponíveis para download; preview 3D no navegador usa GLB/GLTF.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              {...register('categoryId')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
            <select
              {...register('unit')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {errors.unit && <p className="mt-1 text-xs text-red-600">{errors.unit.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estoque MÃ­nimo</label>
            <input
              {...register('minStock')}
              type="number"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.minStock && <p className="mt-1 text-xs text-red-600">{errors.minStock.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custo (R$)</label>
            <input
              {...register('cost')}
              type="number"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.cost && <p className="mt-1 text-xs text-red-600">{errors.cost.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PreÃ§o (R$)</label>
            <input
              {...register('price')}
              type="number"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                {...register('type')}
                type="radio"
                value="component"
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Componente</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                {...register('type')}
                type="radio"
                value="harness"
                className="w-4 h-4 text-green-600"
              />
              <span className="text-sm text-gray-700">Chicote</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            {...register('active')}
            type="checkbox"
            id="active"
            className="w-4 h-4 rounded text-blue-600"
          />
          <label htmlFor="active" className="text-sm font-medium text-gray-700">Produto ativo</label>
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
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
          >
            {mutation.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {product ? 'Salvar' : 'Criar Produto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProductsPage() {
  const { success, error } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canWrite = ['admin', 'manager'].includes(user?.role ?? '');
  const canDelete = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editProduct, setEditProduct] = useState<Product | null | 'new'>('new');
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const limit = 20;

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', search, categoryId, typeFilter, page],
    queryFn: async () => {
      const res = await api.get('/products', {
        params: {
          search,
          categoryId: categoryId || undefined,
          type: typeFilter || undefined,
          page,
          limit,
        },
      });
      return res.data;
    },
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data.data as Category[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      success('Produto excluÃ­do com sucesso!');
      setDeleteProduct(null);
    },
    onError: () => error('Erro ao excluir produto'),
  });

  const products: Product[] = productsData?.data ?? [];
  const total = productsData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const categories: Category[] = categoriesData ?? [];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 flex-1 max-w-2xl flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar por nome, SKU, código interno ou EAN..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            <option value="component">Componente</option>
            <option value="harness">Chicote</option>
          </select>
          <select
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas Categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {canWrite && (
          <button
            onClick={() => setEditProduct(null)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Novo Produto
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['SKU', 'Cód. Interno', 'Tipo', 'Nome', 'Localização', 'Categoria', 'EAN-13', 'Arquivos', 'Unid.', 'Estoque', 'Mín.', 'Custo', 'Preço', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 15 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-12 text-center text-gray-400 text-sm">
                    Nenhum produto encontrado
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{product.sku}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{product.internalCode || '-'}</td>
                    <td className="px-4 py-3">
                      {product.type === 'harness' ? (
                        <Badge variant="green">Chicote</Badge>
                      ) : (
                        <Badge variant="blue">Componente</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate">{product.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] whitespace-normal break-words">{product.location || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{product.category?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">{product.ean13 ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {product.realImageUrl && <a href={product.realImageUrl} target="_blank" rel="noreferrer" title="Imagem real" className="p-1 text-blue-600 hover:bg-blue-50 rounded"><FileImage className="w-4 h-4" /></a>}
                        {product.cadFileUrl && <a href={product.cadFileUrl} target="_blank" rel="noreferrer" title="Diagrama CAD" className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><FileText className="w-4 h-4" /></a>}
                        {(product.model3dUrl || product.stepFileUrl) && <a href={product.model3dUrl || product.stepFileUrl} target="_blank" rel="noreferrer" title={product.model3dUrl ? 'Modelo 3D' : 'Arquivo STEP'} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Box className="w-4 h-4" /></a>}
                        {!product.realImageUrl && !product.cadFileUrl && !product.model3dUrl && !product.stepFileUrl && <span className="text-sm text-gray-400">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{product.unit}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      <span className={`${(product.totalStock ?? 0) <= product.minStock ? 'text-yellow-600 font-bold' : ''}`}>
                        {formatQuantity(product.totalStock)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatQuantity(product.minStock)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(product.cost)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(product.price)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={product.active ? 'success' : 'gray'}>
                        {product.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {canWrite && (
                          <>
                        <button
                          onClick={() => setEditProduct(product)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setLabelProduct(product)}
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Etiqueta"
                        >
                          <Tag className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => setDeleteProduct(product)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                          </>
                        )}
                        {!canWrite && <span className="text-xs text-gray-400">Somente leitura</span>}
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

      {/* Product modal */}
      {editProduct !== 'new' && (
        <ProductModal
          product={editProduct}
          onClose={() => setEditProduct('new')}
          categories={categories}
        />
      )}

      {/* Label modal */}
      {labelProduct && (
        <LabelModal product={labelProduct} onClose={() => setLabelProduct(null)} />
      )}

      {/* Delete dialog */}
      <ConfirmDialog
        isOpen={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        onConfirm={() => deleteProduct && deleteMutation.mutate(deleteProduct.id)}
        title="Excluir Produto"
        message={`Tem certeza que deseja excluir o produto "${deleteProduct?.name}"? Esta aÃ§Ã£o nÃ£o pode ser desfeita.`}
        confirmLabel="Excluir"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}


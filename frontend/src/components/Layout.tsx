import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Tag,
  Warehouse,
  ArrowLeftRight,
  FileText,
  BarChart3,
  Bell,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ClipboardList,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/products', icon: Package, label: 'Produtos' },
  { to: '/categories', icon: Tag, label: 'Categorias' },
  { to: '/warehouses', icon: Warehouse, label: 'Depósitos' },
  { to: '/movements', icon: ArrowLeftRight, label: 'Movimentações' },
  { to: '/bom', icon: ClipboardList, label: 'BOM' },
  { to: '/assembly', icon: Wrench, label: 'Montagem' },
  { to: '/nfe', icon: FileText, label: 'NF-e' },
  { to: '/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/alerts', icon: Bell, label: 'Alertas' },
];

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/products': 'Produtos',
  '/categories': 'Categorias',
  '/warehouses': 'Depósitos',
  '/movements': 'Movimentações',
  '/bom': 'BOM — Lista de Materiais',
  '/assembly': 'Ordens de Montagem',
  '/nfe': 'NF-e',
  '/reports': 'Relatórios',
  '/alerts': 'Alertas',
  '/users': 'Usuários',
};

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    operator: 'Operador',
    viewer: 'Visualizador',
  };
  return labels[role] || role;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: alertsData } = useQuery({
    queryKey: ['alerts-unread-count'],
    queryFn: async () => {
      const res = await api.get('/alerts');
      return res.data;
    },
    refetchInterval: 60000,
  });

  const unreadCount = alertsData?.data?.filter((a: { read: boolean }) => !a.read).length ?? 0;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentTitle = pageTitles[location.pathname] || 'FlowWork Pro';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-blue-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">FlowWork Pro</h1>
            <p className="text-blue-200 text-xs">Controle de Estoque</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-blue-300 group-hover:text-white'}`} />
                <span className="flex-1">{label}</span>
                {label === 'Alertas' && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {isActive && <ChevronRight className="w-4 h-4 text-white/60" />}
              </>
            )}
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <NavLink
            to="/users"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Users className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-blue-300 group-hover:text-white'}`} />
                <span className="flex-1">Usuários</span>
                {isActive && <ChevronRight className="w-4 h-4 text-white/60" />}
              </>
            )}
          </NavLink>
        )}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-blue-700">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-blue-300 text-xs truncate">{roleLabel(user?.role || '')}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-blue-100 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-blue-700 shadow-xl transform transition-transform duration-300 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="absolute top-4 right-4">
          <button onClick={() => setSidebarOpen(false)} className="text-blue-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-blue-700 shadow-xl flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">{currentTitle}</h2>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <NavLink to="/alerts" className="relative text-gray-500 hover:text-blue-600">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </NavLink>
            )}
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

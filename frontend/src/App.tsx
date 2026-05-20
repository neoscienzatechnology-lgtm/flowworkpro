import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import WarehousesPage from './pages/WarehousesPage';
import MovementsPage from './pages/MovementsPage';
import NfePage from './pages/NfePage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import AlertsPage from './pages/AlertsPage';
import BomPage from './pages/BomPage';
import AssemblyPage from './pages/AssemblyPage';
import LoadingSpinner from './components/LoadingSpinner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="categories" element={<RoleRoute roles={['admin', 'manager']}><CategoriesPage /></RoleRoute>} />
        <Route path="warehouses" element={<RoleRoute roles={['admin', 'manager', 'operator']}><WarehousesPage /></RoleRoute>} />
        <Route path="movements" element={<RoleRoute roles={['admin', 'manager', 'operator']}><MovementsPage /></RoleRoute>} />
        <Route path="bom" element={<BomPage />} />
        <Route path="assembly" element={<RoleRoute roles={['admin', 'manager', 'operator']}><AssemblyPage /></RoleRoute>} />
        <Route path="nfe" element={<RoleRoute roles={['admin', 'manager', 'operator']}><NfePage /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute roles={['admin', 'manager', 'viewer']}><ReportsPage /></RoleRoute>} />
        <Route path="users" element={<RoleRoute roles={['admin']}><UsersPage /></RoleRoute>} />
        <Route path="alerts" element={<RoleRoute roles={['admin', 'manager', 'operator']}><AlertsPage /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

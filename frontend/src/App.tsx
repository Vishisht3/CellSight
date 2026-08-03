import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import FleetDashboard from './pages/FleetDashboard';
import AssetDetail from './pages/AssetDetail';
import SupplyChainDashboard from './pages/SupplyChainDashboard';
import TraceView from './pages/TraceView';
import AlertsPage from './pages/AlertsPage';
import CorrelationPage from './pages/CorrelationPage';
import ReadinessPage from './pages/ReadinessPage';
import MaintenancePage from './pages/MaintenancePage';
import LoadingSpinner from './components/ui/LoadingSpinner';
import type { UserRole } from './types';

// ── Route guards ──────────────────────────────────────────────────────────────

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  if (isLoading) return <LoadingSpinner fullPage size="lg" label="Loading…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !hasRole(...allowedRoles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner fullPage size="lg" label="Loading…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'supply_chain_manager') return <Navigate to="/supply-chain" replace />;
  return <Navigate to="/fleet" replace />;
}

// ── Routes ────────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"  element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Shell wraps all authenticated pages */}
      <Route element={<AppShell />}>

        {/* ── Fleet operations ── */}
        <Route path="/fleet" element={
          <ProtectedRoute allowedRoles={['fleet_manager', 'admin']}>
            <FleetDashboard />
          </ProtectedRoute>
        } />
        <Route path="/fleet/:id" element={
          <ProtectedRoute allowedRoles={['fleet_manager', 'admin']}>
            <AssetDetail />
          </ProtectedRoute>
        } />

        {/* ── EV readiness / procurement ── */}
        <Route path="/readiness" element={
          <ProtectedRoute allowedRoles={['fleet_manager', 'admin']}>
            <ReadinessPage />
          </ProtectedRoute>
        } />

        {/* ── Maintenance ops ── */}
        <Route path="/maintenance" element={
          <ProtectedRoute allowedRoles={['fleet_manager', 'admin']}>
            <MaintenancePage />
          </ProtectedRoute>
        } />

        {/* ── Supplier quality and traceability ── */}
        <Route path="/supply-chain" element={
          <ProtectedRoute allowedRoles={['supply_chain_manager', 'admin']}>
            <SupplyChainDashboard />
          </ProtectedRoute>
        } />
        <Route path="/supply-chain/trace/:assetId" element={
          <ProtectedRoute allowedRoles={['supply_chain_manager', 'fleet_manager', 'admin']}>
            <TraceView />
          </ProtectedRoute>
        } />

        {/* ── Alerts (all authenticated) ── */}
        <Route path="/alerts" element={
          <ProtectedRoute>
            <AlertsPage />
          </ProtectedRoute>
        } />

        {/* ── Field-to-source investigations ── */}
        <Route path="/correlation" element={
          <ProtectedRoute allowedRoles={['supply_chain_manager', 'fleet_manager', 'admin']}>
            <CorrelationPage />
          </ProtectedRoute>
        } />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

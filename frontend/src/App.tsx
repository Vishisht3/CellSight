import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import FleetDashboard from './pages/FleetDashboard';
import AssetDetail from './pages/AssetDetail';
import SupplyChainDashboard from './pages/SupplyChainDashboard';
import TraceView from './pages/TraceView';
import AlertsPage from './pages/AlertsPage';
import CorrelationPage from './pages/CorrelationPage';
import ReadinessPage from './pages/ReadinessPage';
import MaintenancePage from './pages/MaintenancePage';
import ArchitecturePage from './pages/ArchitecturePage';
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

/** Redirect authenticated users to their role's default page */
function RootRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/architecture" replace />;
  if (user?.role === 'supply_chain_manager') return <Navigate to="/supply-chain" replace />;
  return <Navigate to="/fleet" replace />;
}

// ── Routes ────────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* Public — no auth needed */}
      <Route path="/login" element={<LoginPage />} />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Shell wraps all inner pages */}
      <Route element={<AppShell />}>

        {/* ── Guest-accessible (architecture overview) ── */}
        <Route path="/architecture" element={<ArchitecturePage />} />

        {/* ── Fleet operations ── */}
        <Route path="/fleet" element={
          <ProtectedRoute allowedRoles={['fleet_manager']}>
            <FleetDashboard />
          </ProtectedRoute>
        } />
        <Route path="/fleet/:id" element={
          <ProtectedRoute allowedRoles={['fleet_manager']}>
            <AssetDetail />
          </ProtectedRoute>
        } />

        {/* ── EV readiness / procurement ── */}
        <Route path="/readiness" element={
          <ProtectedRoute allowedRoles={['fleet_manager']}>
            <ReadinessPage />
          </ProtectedRoute>
        } />

        {/* ── Maintenance ops ── */}
        <Route path="/maintenance" element={
          <ProtectedRoute allowedRoles={['fleet_manager']}>
            <MaintenancePage />
          </ProtectedRoute>
        } />

        {/* ── Supplier quality and traceability ── */}
        <Route path="/supply-chain" element={
          <ProtectedRoute allowedRoles={['supply_chain_manager']}>
            <SupplyChainDashboard />
          </ProtectedRoute>
        } />
        <Route path="/supply-chain/trace/:assetId" element={
          <ProtectedRoute allowedRoles={['supply_chain_manager','fleet_manager']}>
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
          <ProtectedRoute allowedRoles={['supply_chain_manager','fleet_manager']}>
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

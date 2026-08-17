import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AppShell from './components/layout/AppShell';
import DemoSwitcher from './components/ui/DemoSwitcher';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ProfilePage from './pages/ProfilePage';
import RegisterDataPage from './pages/RegisterDataPage';
import FleetDashboard from './pages/FleetDashboard';
import AssetDetail from './pages/AssetDetail';
import SupplyChainDashboard from './pages/SupplyChainDashboard';
import TraceView from './pages/TraceView';
import AlertsPage from './pages/AlertsPage';
import CorrelationPage from './pages/CorrelationPage';
import ReadinessPage from './pages/ReadinessPage';
import MaintenancePage from './pages/MaintenancePage';
import QualityIntelligencePage from './pages/QualityIntelligencePage';
import NetZeroDashboard from './pages/NetZeroDashboard';
import LandingPage from './pages/LandingPage';
import NotFoundPage from './pages/NotFoundPage';
import ThankYouPage from './pages/ThankYouPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { useAnalytics } from './hooks/useAnalytics';
import type { UserRole } from './types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  if (isLoading) return <LoadingSpinner fullPage size="lg" label="Loading..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !hasRole(...allowedRoles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner fullPage size="lg" label="Loading..." />;
  if (!isAuthenticated) return <LandingPage />;
  if (user?.role === 'supply_chain_manager') return <Navigate to="/supply-chain" replace />;
  return <Navigate to="/fleet" replace />;
}

function AppRoutes() {
  useAnalytics();
  return (
    <>
      <Routes>
      {/* Public pages */}
      <Route path="/login"  element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/enquiry/thank-you" element={<ThankYouPage />} />

      {/* Root -- landing for guests, dashboard redirect for authenticated */}
      <Route path="/" element={<RootRedirect />} />

      {/* Shell wraps all authenticated pages */}
      <Route element={<AppShell />}>

        {/* Fleet operations */}
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

        {/* EV readiness */}
        <Route path="/readiness" element={
          <ProtectedRoute allowedRoles={['fleet_manager', 'admin']}>
            <ReadinessPage />
          </ProtectedRoute>
        } />

        {/* Maintenance ops */}
        <Route path="/maintenance" element={
          <ProtectedRoute allowedRoles={['fleet_manager', 'admin']}>
            <MaintenancePage />
          </ProtectedRoute>
        } />

        {/* Supply chain */}
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

        {/* Alerts */}
        <Route path="/alerts" element={
          <ProtectedRoute>
            <AlertsPage />
          </ProtectedRoute>
        } />

        {/* Data registration */}
        <Route path="/register" element={
          <ProtectedRoute>
            <RegisterDataPage />
          </ProtectedRoute>
        } />

        {/* Profile */}
        <Route path="/profile" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />

        {/* Correlation */}
        <Route path="/correlation" element={
          <ProtectedRoute allowedRoles={['supply_chain_manager', 'fleet_manager', 'admin']}>
            <CorrelationPage />
          </ProtectedRoute>
        } />

        {/* Quality Intelligence (QMS) */}
        <Route path="/quality" element={
          <ProtectedRoute allowedRoles={['supply_chain_manager', 'admin']}>
            <QualityIntelligencePage />
          </ProtectedRoute>
        } />

        {/* Net Zero Dashboard */}
        <Route path="/net-zero" element={
          <ProtectedRoute allowedRoles={['fleet_manager', 'admin']}>
            <NetZeroDashboard />
          </ProtectedRoute>
        } />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    <DemoSwitcher />
    </>
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
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Truck, Activity, AlertTriangle, Clock, CheckCircle, TrendingDown } from 'lucide-react';
import { apmApi } from '../services/api';
import type { Asset, FleetSummary } from '../types';
import Navbar from '../components/layout/Navbar';
import PageContainer from '../components/ui/PageContainer';
import StatCard from '../components/ui/StatCard';
import { AssetStatusBadge } from '../components/ui/StatusBadge';
import SohGauge from '../components/ui/SohGauge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorBanner from '../components/ui/ErrorBanner';
import EmptyState from '../components/ui/EmptyState';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { formatRul, formatDateTime, assetTypeLabel } from '../utils/format';

type StatusFilter = 'all' | 'healthy' | 'watch' | 'critical' | 'data_stale';

export default function FleetDashboard() {
  const navigate = useNavigate();
  const [assets,      setAssets]      = useState<Asset[]>([]);
  const [summary,     setSummary]     = useState<FleetSummary | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [statusFilter,setStatusFilter]= useState<StatusFilter>('all');
  const [typeFilter,  setTypeFilter]  = useState('');
  const [refreshing,  setRefreshing]  = useState(false);

  useDocumentMeta({ title: 'Fleet Health Dashboard', description: 'Monitor real-time battery health, SoH trends, and predictive maintenance alerts across your entire industrial EV fleet.' });

  const load = useCallback(async () => {
    try {
      const data = await apmApi.getAssets(
        statusFilter !== 'all'
          ? { status: statusFilter, type: typeFilter || undefined }
          : { type: typeFilter || undefined }
      );
      setAssets(data.assets);
      setSummary(data.summary);
      setError('');
    } catch {
      setError('Failed to load fleet data. Make sure the API server is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const STATUS_TABS: { value: StatusFilter; label: string }[] = [
    { value: 'all',       label: 'All' },
    { value: 'healthy',   label: 'Healthy' },
    { value: 'watch',     label: 'Watch' },
    { value: 'critical',  label: 'Critical' },
    { value: 'data_stale',label: 'Stale' },
  ];

  return (
    <>
      <Navbar
        title="Fleet APM  -  Battery Health Monitor"
        subtitle="Real-time state-of-health and predictive maintenance across all deployed assets"
        alertCount={summary?.openAlerts}
        onRefresh={() => { setRefreshing(true); load(); }}
        refreshing={refreshing}
      />
      <PageContainer>
        {error && <ErrorBanner message={error} />}

        {/* KPI row */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            <StatCard label="Total Assets"  value={summary.totalAssets}   icon={<Truck size={16}/>} />
            <StatCard label="Healthy"        value={summary.healthyAssets}  icon={<CheckCircle size={16}/>} variant="success" />
            <StatCard label="Watch"          value={summary.watchAssets}    icon={<Activity size={16}/>}    variant="warning" />
            <StatCard label="Critical"       value={summary.criticalAssets} icon={<AlertTriangle size={16}/>} variant="danger" />
            <StatCard label="Data Stale"     value={summary.staleAssets}    icon={<Clock size={16}/>} />
            <StatCard
              label="Fleet Avg SoH"
              value={summary.avgSoh != null ? `${Number(summary.avgSoh).toFixed(1)}%` : ' - '}
              icon={<TrendingDown size={16}/>}
              variant={Number(summary.avgSoh) >= 85 ? 'success' : Number(summary.avgSoh) >= 80 ? 'warning' : 'danger'}
              subValue="State of Health"
            />
          </div>
        )}

        {/* Filter toolbar + table */}
        <div className="win-panel" style={{ overflow: 'hidden' }}>
          {/* toolbar */}
          <div style={{
            background: 'linear-gradient(to bottom, #e8f0fb, #d0dff0)',
            borderBottom: '1px solid #7f9db9',
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            {/* Status tabs */}
            <div style={{ display: 'flex', gap: 2 }}>
              {STATUS_TABS.map(tab => {
                const active = statusFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    style={{
                      padding: '2px 10px',
                      fontSize: 11,
                      fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
                      cursor: 'pointer',
                      border: '1px solid #7f9db9',
                      borderRadius: '3px 3px 0 0',
                      borderBottom: active ? '1px solid #f0f4f8' : '1px solid #7f9db9',
                      background: active ? '#f0f4f8' : 'linear-gradient(to bottom, #e8f0fb, #c8d8ef)',
                      color: active ? '#0a246a' : '#4a4a4a',
                      fontWeight: active ? 'bold' : 'normal',
                      marginBottom: active ? -1 : 0,
                      zIndex: active ? 1 : 0,
                      position: 'relative',
                    }}
                  >
                    {tab.label}
                    {tab.value !== 'all' && summary && (
                      <span style={{ marginLeft: 4, fontSize: 10, color: '#6a6a9a' }}>
                        {tab.value === 'healthy'   && `(${summary.healthyAssets})`}
                        {tab.value === 'watch'     && `(${summary.watchAssets})`}
                        {tab.value === 'critical'  && `(${summary.criticalAssets})`}
                        {tab.value === 'data_stale'&& `(${summary.staleAssets})`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Type filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              <label style={{ fontSize: 11, color: '#4a4a4a' }}>Asset type:</label>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                style={{ fontSize: 11, padding: '1px 4px' }}
              >
                <option value="">All types</option>
                <option value="freight_truck">Freight Truck</option>
                <option value="mining_vehicle">Mining Vehicle</option>
                <option value="forklift">Forklift</option>
                <option value="construction_equipment">Construction Equip.</option>
              </select>
            </div>
          </div>

          {/* table */}
          {loading ? (
            <LoadingSpinner fullPage label="Loading fleet data..." />
          ) : assets.length === 0 && statusFilter === 'all' && !typeFilter ? (
            <EmptyState
              icon={Truck}
              title="No assets registered yet"
              description="Register your first asset to start monitoring battery health."
              action={
                <button className="win-btn win-btn-primary" onClick={() => navigate('/register')}>
                  + Register Asset
                </button>
              }
            />
          ) : assets.length === 0 ? (
            <EmptyState icon={Truck} title="No assets found" description="Try a different filter." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Asset Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th style={{ minWidth: 160 }}>State of Health</th>
                    <th>Est. RUL</th>
                    <th>Cycles</th>
                    <th>Last Telemetry</th>
                  <th>Trace</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map(asset => (
                    <tr
                      key={asset.id}
                      onClick={() => navigate(`/fleet/${asset.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 'bold', color: '#0a246a' }}>
                        <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>{asset.name}</span>
                      </td>
                      <td>{assetTypeLabel[asset.assetType] ?? asset.assetType}</td>
                      <td><AssetStatusBadge status={asset.status} /></td>
                      <td><SohGauge value={asset.currentSoh} /></td>
                      <td style={{ fontFamily: 'Courier New, monospace', fontSize: 11 }}>
                        {formatRul(asset.predictedRulDays, asset.predictedRulCycles)}
                      </td>
                      <td style={{ fontFamily: 'Courier New, monospace', fontSize: 11 }}>
                        {asset.totalCycles.toLocaleString()}
                      </td>
                      <td style={{ fontSize: 11, color: '#6a6a6a' }}>
                        {asset.lastTelemetryAt ? formatDateTime(asset.lastTelemetryAt) : ' - '}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <Link to={'/supply-chain/trace/' + asset.id} style={{ fontSize: 10, color: '#316ac5' }}>Trace</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* status bar */}
          <div style={{
            background: 'linear-gradient(to bottom, #d0d8e8, #b8c8de)',
            borderTop: '1px solid #7f9db9',
            padding: '3px 10px',
            fontSize: 11,
            color: '#4a4a4a',
          }}>
            {assets.length} record{assets.length !== 1 ? 's' : ''} displayed
          </div>
        </div>
      </PageContainer>
    </>
  );
}

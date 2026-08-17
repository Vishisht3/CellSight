import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { PackageSearch, ShieldAlert, ShieldCheck, Globe, AlertTriangle } from 'lucide-react';
import { supplyChainApi } from '../services/api';
import type { Supplier, SupplyChainSummary } from '../types';
import Navbar from '../components/layout/Navbar';
import PageContainer from '../components/ui/PageContainer';
import StatCard from '../components/ui/StatCard';
import { RiskBadge } from '../components/ui/StatusBadge';
import RiskBar from '../components/ui/RiskBar';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorBanner from '../components/ui/ErrorBanner';
import EmptyState from '../components/ui/EmptyState';
import { tierLabel } from '../utils/format';

type TierFilter = 'all' | 'tier_1' | 'tier_2' | 'tier_3';

export default function SupplyChainDashboard() {
  const navigate = useNavigate();
  const [suppliers,   setSuppliers]   = useState<Supplier[]>([]);
  const [summary,     setSummary]     = useState<SupplyChainSummary | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [tierFilter,  setTierFilter]  = useState<TierFilter>('all');
  const [highRisk,    setHighRisk]    = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  useDocumentMeta({ title: 'Supplier Portal', description: 'Monitor supplier risk scores, material traceability, and compliance across your EV battery supply chain.' });

  const load = useCallback(async () => {
    try {
      const [sd, sum] = await Promise.all([
        supplyChainApi.getSuppliers({ tier: tierFilter !== 'all' ? tierFilter : undefined, highRiskOnly: highRisk || undefined }),
        supplyChainApi.getDashboard(),
      ]);
      setSuppliers(sd.suppliers);
      setSummary(sum);
      setError('');
    } catch {
      setError('Failed to load supply chain data.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [tierFilter, highRisk]);

  useEffect(() => { load(); }, [load]);

  const TIER_TABS: { value: TierFilter; label: string }[] = [
    { value: 'all',    label: 'All Tiers' },
    { value: 'tier_1', label: 'Tier 1  -  Direct' },
    { value: 'tier_2', label: 'Tier 2  -  Cell Mfg' },
    { value: 'tier_3', label: 'Tier 3  -  Raw Material' },
  ];

  return (
    <>
      <Navbar
        title="Supply Chain Risk & Traceability"
        subtitle="Multi-tier supplier risk monitoring, material traceability, and compliance tracking"
        onRefresh={() => { setRefreshing(true); load(); }}
        refreshing={refreshing}
      />
      <PageContainer>
        {error && <ErrorBanner message={error} />}

        {/* KPIs */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <StatCard label="Total Suppliers"    value={summary.totalSuppliers}    icon={<PackageSearch size={16}/>} />
            <StatCard label="High Risk Suppliers" value={summary.highRiskSuppliers} icon={<ShieldAlert size={16}/>}
              variant={summary.highRiskSuppliers > 0 ? 'danger' : 'success'} />
            <StatCard label="Avg Risk Score"
              value={summary.avgRiskScore != null ? Number(summary.avgRiskScore).toFixed(0) : ' - '}
              icon={<AlertTriangle size={16}/>}
              variant={Number(summary.avgRiskScore) >= 60 ? 'danger' : Number(summary.avgRiskScore) >= 35 ? 'warning' : 'success'}
              subValue="out of 100" />
            <StatCard label="Material Lots" value={summary.totalMaterialLots} icon={<ShieldCheck size={16}/>}
              variant="info"
              subValue={`${summary.traceabilityStats?.assetsWithFullTrace ?? 0} assets fully traced`} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <Link to="/correlation" style={{ fontSize: 12, color: '#316ac5' }}>View Field Correlations →</Link>
        </div>

        {/* Traceability coverage */}
        {summary?.traceabilityStats && (
          <div className="win-panel" style={{ padding: 10 }}>
            <div style={{ fontWeight: 'bold', fontSize: 11, color: '#0a246a', marginBottom: 6 }}>
              Traceability Coverage  - &nbsp;
              <span style={{ fontWeight: 'normal', color: '#4a4a4a' }}>
                {summary.traceabilityStats.assetsWithFullTrace} of {summary.traceabilityStats.totalAssets} assets fully traced to raw materials
              </span>
            </div>
            <RiskBar
              value={summary.traceabilityStats.totalAssets > 0
                ? summary.traceabilityStats.assetsWithFullTrace / summary.traceabilityStats.totalAssets : 0}
              showPercent
            />
          </div>
        )}

        {/* Supplier table */}
        <div className="win-panel" style={{ overflow: 'hidden' }}>
          {/* toolbar */}
          <div style={{
            background: 'linear-gradient(to bottom, #e8f0fb, #d0dff0)',
            borderBottom: '1px solid #7f9db9',
            padding: '5px 10px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {TIER_TABS.map(t => {
                const active = tierFilter === t.value;
                return (
                  <button key={t.value} onClick={() => setTierFilter(t.value)} style={{
                    padding: '2px 10px', fontSize: 11, cursor: 'pointer',
                    border: '1px solid #7f9db9', borderRadius: '3px 3px 0 0',
                    borderBottom: active ? '1px solid #f0f4f8' : '1px solid #7f9db9',
                    background: active ? '#f0f4f8' : 'linear-gradient(to bottom,#e8f0fb,#c8d8ef)',
                    color: active ? '#0a246a' : '#4a4a4a', fontWeight: active ? 'bold' : 'normal',
                    fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
                    marginBottom: active ? -1 : 0, position: 'relative', zIndex: active ? 1 : 0,
                  }}>{t.label}</button>
                );
              })}
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, cursor:'pointer', marginLeft:'auto' }}>
              <input type="checkbox" checked={highRisk} onChange={e => setHighRisk(e.target.checked)} />
              High risk only
            </label>
          </div>

          {loading ? (
            <LoadingSpinner fullPage label="Loading suppliersâ€¦" />
          ) : suppliers.length === 0 && tierFilter === 'all' && !highRisk ? (
            <EmptyState
              icon={PackageSearch}
              title="No suppliers registered yet"
              description="Register your first supplier to start tracking supply chain risk and material traceability."
              action={
                <button className="win-btn win-btn-primary" onClick={() => navigate('/register')}>
                  + Register Supplier
                </button>
              }
            />
          ) : suppliers.length === 0 ? (
            <EmptyState icon={PackageSearch} title="No suppliers found" description="Adjust your filters." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Supplier Name</th>
                    <th>Tier</th>
                    <th>Country</th>
                    <th>Risk Score</th>
                    <th style={{ minWidth: 200 }}>Risk Breakdown</th>
                    <th>Certification Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(s => (
                    <tr key={s.id} onClick={() => navigate(`/supply-chain/supplier/${s.id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 'bold', color: '#0a246a' }}>
                        <span style={{ textDecoration: 'underline' }}>{s.name}</span>
                      </td>
                      <td>{tierLabel[s.tier]}</td>
                      <td>
                        <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <Globe size={10} style={{ color:'#4a6a9a' }} />{s.country}
                        </span>
                      </td>
                      <td><RiskBadge score={s.riskScore} /></td>
                      <td>
                        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                          <RiskBar value={s.concentrationRisk} label="Concentration" />
                          <RiskBar value={s.geopoliticalRisk}  label="Geopolitical"  />
                          <RiskBar value={s.qualityRisk}       label="Quality"       />
                          <RiskBar value={s.complianceRisk}    label="Compliance"    />
                        </div>
                      </td>
                      <td>
                        {s.certificationExpiry ? (
                          <span style={{
                            color: new Date(s.certificationExpiry) < new Date() ? '#c00000' : '#1a1a1a',
                            fontWeight: new Date(s.certificationExpiry) < new Date() ? 'bold' : 'normal',
                          }}>
                            {new Date(s.certificationExpiry) < new Date() ? 'âš  EXPIRED  -  ' : ''}
                            {new Date(s.certificationExpiry).toLocaleDateString()}
                          </span>
                        ) : (
                          <span style={{ color:'#c00000', fontWeight:'bold' }}>MISSING</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ background:'linear-gradient(to bottom,#d0d8e8,#b8c8de)', borderTop:'1px solid #7f9db9', padding:'3px 10px', fontSize:11, color:'#4a4a4a' }}>
            {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} displayed
          </div>
        </div>
      </PageContainer>
    </>
  );
}

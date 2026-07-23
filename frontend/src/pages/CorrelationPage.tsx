import { useState, useEffect } from 'react';
import { GitMerge, TrendingUp, Zap } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { correlationApi } from '../services/api';
import type { BatchCorrelation, SupplierCorrelation } from '../types';
import Navbar from '../components/layout/Navbar';
import PageContainer from '../components/ui/PageContainer';
import StatCard from '../components/ui/StatCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorBanner from '../components/ui/ErrorBanner';
import EmptyState from '../components/ui/EmptyState';

type ActiveTab = 'suppliers' | 'batches';

function barColor(pct: number) {
  if (pct > 20) return '#c00000';
  if (pct > 10) return '#b87000';
  if (pct < -5) return '#2a8a2a';
  return '#316ac5';
}

export default function CorrelationPage() {
  const [batchCorr,   setBatchCorr]   = useState<BatchCorrelation[]>([]);
  const [supplierCorr,setSupplierCorr]= useState<SupplierCorrelation[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [running,     setRunning]     = useState(false);
  const [error,       setError]       = useState('');
  const [tab,         setTab]         = useState<ActiveTab>('suppliers');
  const [insight,     setInsight]     = useState<string | null>(null);

  const load = async () => {
    try {
      const [b, s] = await Promise.all([
        correlationApi.getBatchCorrelations(),
        correlationApi.getSupplierCorrelations(),
      ]);
      setBatchCorr(b); setSupplierCorr(s); setError('');
    } catch { setError('Failed to load correlation data.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  async function runAnalysis() {
    setRunning(true);
    try {
      const r = await correlationApi.runAnalysis();
      setInsight(`Analysis complete — ${r.insightsGenerated} new insight${r.insightsGenerated !== 1 ? 's' : ''} generated across ${r.batchesAnalyzed} batches and ${r.suppliersAnalyzed} suppliers.`);
      await load();
    } catch { setError('Analysis failed.'); }
    finally { setRunning(false); }
  }

  const rows  = tab === 'batches' ? batchCorr : supplierCorr;
  const idKey = tab === 'batches' ? 'cellBatchId' : 'supplierId';
  const nKey  = tab === 'batches' ? 'batchNumber' : 'supplierName';

  const chartData = [...rows]
    .sort((a, b) => Math.abs(b.deviationPercent) - Math.abs(a.deviationPercent))
    .slice(0, 10)
    .map(r => ({ name: (r as any)[nKey] as string, deviation: +r.deviationPercent.toFixed(1) }));

  const flagged = rows.filter(r => r.deviationPercent > 20).length;
  const watch   = rows.filter(r => r.deviationPercent > 10 && r.deviationPercent <= 20).length;

  return (
    <>
      <Navbar
        title="Field-to-Source Correlation"
        subtitle="Links field battery degradation back to cell batches and material suppliers"
        actions={
          <button onClick={runAnalysis} disabled={running}
            className="win-btn win-btn-primary" style={{ fontSize: 11 }}>
            <Zap size={11} />
            {running ? 'Running analysis…' : 'Run Correlation Analysis'}
          </button>
        }
      />
      <PageContainer>
        {error && <ErrorBanner message={error} />}

        {insight && (
          <div style={{
            background: '#cce5ff', border: '1px solid #7fb3e0', borderRadius: 3,
            padding: '6px 12px', fontSize: 12, color: '#004085',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Zap size={13} /> {insight}
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <StatCard label="Total Analysed"       value={rows.length}  icon={<GitMerge size={16}/>}
            subValue={tab === 'batches' ? 'cell batches' : 'suppliers'} />
          <StatCard label="Flagged (>20% faster)" value={flagged}       icon={<TrendingUp size={16}/>}
            variant={flagged > 0 ? 'danger' : 'success'} />
          <StatCard label="On Watch (10–20%)"      value={watch}         icon={<TrendingUp size={16}/>}
            variant={watch > 0 ? 'warning' : 'success'} />
        </div>

        {/* Chart */}
        {!loading && chartData.length > 0 && (
          <div className="win-panel" style={{ overflow: 'hidden' }}>
            <div className="win-section-header">
              Degradation Deviation vs Fleet Average — Top 10 {tab === 'batches' ? 'Batches' : 'Suppliers'}
            </div>
            <div style={{ padding: 12 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 44, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d0dce8" vertical={false} />
                  <XAxis dataKey="name"
                    tick={{ fontSize: 9, fill: '#4a4a4a', fontFamily: 'Tahoma' }}
                    tickLine={false} axisLine={false}
                    angle={-35} textAnchor="end" interval={0} />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#4a4a4a', fontFamily: 'Tahoma' }}
                    tickLine={false} axisLine={false} unit="%" width={36} />
                  <Tooltip
                    formatter={(v: number) => [`${v > 0 ? '+' : ''}${v}%`, 'Deviation vs fleet avg']}
                    contentStyle={{ fontSize: 11, fontFamily: 'Tahoma', border: '1px solid #7f9db9', borderRadius: 2 }}
                  />
                  <ReferenceLine y={0}  stroke="#7f9db9" />
                  <ReferenceLine y={20} stroke="#c00000" strokeDasharray="4 3"
                    label={{ value: 'Flag (>20%)', fill: '#c00000', fontSize: 9, position: 'insideTopRight', fontFamily: 'Tahoma' }} />
                  <ReferenceLine y={10} stroke="#b87000" strokeDasharray="4 3"
                    label={{ value: 'Watch (>10%)', fill: '#b87000', fontSize: 9, position: 'insideTopRight', fontFamily: 'Tahoma' }} />
                  <Bar dataKey="deviation" maxBarSize={32} radius={[2, 2, 0, 0]}>
                    {chartData.map(entry => (
                      <Cell key={entry.name} fill={barColor(entry.deviation)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="win-panel" style={{ overflow: 'hidden' }}>
          <div style={{
            background: 'linear-gradient(to bottom,#e8f0fb,#d0dff0)',
            borderBottom: '1px solid #7f9db9', padding: '5px 10px',
            display: 'flex', gap: 2,
          }}>
            {(['suppliers', 'batches'] as ActiveTab[]).map(t => {
              const active = tab === t;
              return (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '2px 10px', fontSize: 11, cursor: 'pointer',
                  border: '1px solid #7f9db9', borderRadius: '3px 3px 0 0',
                  borderBottom: active ? '1px solid #f0f4f8' : '1px solid #7f9db9',
                  background: active ? '#f0f4f8' : 'linear-gradient(to bottom,#e8f0fb,#c8d8ef)',
                  color: active ? '#0a246a' : '#4a4a4a', fontWeight: active ? 'bold' : 'normal',
                  fontFamily: 'Tahoma,Arial,sans-serif',
                  marginBottom: active ? -1 : 0, position: 'relative', zIndex: active ? 1 : 0,
                }}>
                  {t === 'suppliers' ? 'Suppliers' : 'Cell Batches'}
                </button>
              );
            })}
          </div>

          {loading ? (
            <LoadingSpinner fullPage label="Calculating correlations…" />
          ) : rows.length === 0 ? (
            <EmptyState icon={GitMerge} title="No correlation data"
              description="Run the analysis above, or seed more demo data." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>{tab === 'batches' ? 'Batch' : 'Supplier'}</th>
                    <th>Assets</th>
                    <th>Avg Degradation / day</th>
                    <th>Fleet Average / day</th>
                    <th>Deviation</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const name = (row as any)[nKey] as string;
                    const dev  = row.deviationPercent;
                    const devColor = dev > 20 ? '#c00000' : dev > 10 ? '#b87000' : dev < -5 ? '#2a8a2a' : '#4a4a4a';
                    return (
                      <tr key={(row as any)[idKey]}>
                        <td style={{ fontWeight: 'bold', color: '#0a246a' }}>{name}</td>
                        <td style={{ fontFamily: 'Courier New,monospace', textAlign: 'right' }}>{row.sampleSize}</td>
                        <td style={{ fontFamily: 'Courier New,monospace', textAlign: 'right' }}>
                          {(row.avgDegradationRate * 100).toFixed(4)}%
                        </td>
                        <td style={{ fontFamily: 'Courier New,monospace', textAlign: 'right', color: '#6a6a6a' }}>
                          {(row.fleetAvgDegradationRate * 100).toFixed(4)}%
                        </td>
                        <td>
                          <span style={{
                            fontWeight: 'bold', color: devColor, fontSize: 11,
                            fontFamily: 'Courier New,monospace',
                          }}>
                            {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 60, height: 10, background: 'linear-gradient(to bottom,#d0d0d0,#f0f0f0)', border: '1px inset #a0a0a0', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${row.confidence * 100}%`, height: '100%', background: '#316ac5' }} />
                            </div>
                            <span style={{ fontSize: 10, fontFamily: 'Courier New,monospace', color: '#4a4a4a' }}>
                              {(row.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ background: 'linear-gradient(to bottom,#d0d8e8,#b8c8de)', borderTop: '1px solid #7f9db9', padding: '3px 10px', fontSize: 11, color: '#4a4a4a' }}>
            {rows.length} {tab === 'batches' ? 'batch' : 'supplier'}{rows.length !== 1 ? 'es' : ''} analysed
          </div>
        </div>
      </PageContainer>
    </>
  );
}

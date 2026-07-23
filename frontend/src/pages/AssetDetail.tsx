import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Battery, Activity, Zap, Thermometer, Info, RefreshCw } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { apmApi } from '../services/api';
import type { Asset, SohHistory, TelemetryData, Alert } from '../types';
import Navbar from '../components/layout/Navbar';
import PageContainer from '../components/ui/PageContainer';
import StatCard from '../components/ui/StatCard';
import { AssetStatusBadge, SeverityBadge, AlertStatusBadge } from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorBanner from '../components/ui/ErrorBanner';
import { formatRulFull, formatDateTime, formatRelative, assetTypeLabel, alertTypeLabel } from '../utils/format';

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fffff0', border: '1px solid #7f9db9', borderRadius: 2,
      padding: '4px 8px', fontSize: 11, boxShadow: '2px 2px 4px rgba(0,0,0,0.2)',
    }}>
      <div style={{ color: '#4a4a4a', marginBottom: 2 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 'bold' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}{unit ?? ''}
        </div>
      ))}
    </div>
  );
}

type ChartKey = 'soh' | 'temp' | 'soc' | 'voltage';

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [asset,      setAsset]      = useState<Asset | null>(null);
  const [sohHistory, setSohHistory] = useState<SohHistory[]>([]);
  const [telemetry,  setTelemetry]  = useState<TelemetryData[]>([]);
  const [alerts,     setAlerts]     = useState<Alert[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [activeChart,setActiveChart]= useState<ChartKey>('soh');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [detail, tele] = await Promise.all([
        apmApi.getAsset(id),
        apmApi.getTelemetry(id, 150),
      ]);
      setAsset(detail.asset);
      setSohHistory([...detail.sohHistory].reverse());
      setTelemetry([...tele].reverse());
      setAlerts(detail.alerts);
      setError('');
    } catch {
      setError('Failed to load asset data.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner fullPage size="lg" label="Loading asset…" />;
  if (!asset)  return <div style={{ padding: 16, color: '#721c24' }}>{error || 'Asset not found.'}</div>;

  const sohData = sohHistory.map(h => ({
    date: format(parseISO(h.computedAt), 'MM/dd'),
    SoH: +h.sohValue.toFixed(2),
  }));

  const step = Math.max(1, Math.floor(telemetry.length / 80));
  const telData = telemetry.filter((_, i) => i % step === 0).map(t => ({
    date: format(parseISO(t.timestamp), 'MM/dd HH:mm'),
    Temperature: +t.temperature.toFixed(1),
    SoC: +t.stateOfCharge.toFixed(1),
    Voltage: +t.voltage.toFixed(1),
  }));

  const CHARTS: Record<ChartKey, {
    label: string; data: any[];
    lines: { key: string; color: string; unit: string }[];
    refs: { y: number; color: string; label: string }[];
    domain?: [number, number];
  }> = {
    soh:     { label: 'State of Health',   data: sohData, lines: [{ key:'SoH',         color:'#316ac5', unit:'%'  }], refs: [{ y:85,color:'#b87000',label:'Warn'},{y:80,color:'#c00000',label:'Crit'}], domain:[70,102] },
    temp:    { label: 'Temperature (°C)',  data: telData, lines: [{ key:'Temperature',  color:'#c00000', unit:'°C' }], refs: [{ y:45,color:'#c00000',label:'Max'},{y:-10,color:'#316ac5',label:'Min'}], domain:undefined },
    soc:     { label: 'State of Charge',   data: telData, lines: [{ key:'SoC',          color:'#2a8a2a', unit:'%'  }], refs: [{ y:80,color:'#b87000',label:'Opt max'},{y:20,color:'#b87000',label:'Opt min'}], domain:[0,105] },
    voltage: { label: 'Voltage (V)',        data: telData, lines: [{ key:'Voltage',      color:'#6030a0', unit:'V'  }], refs: [], domain:undefined },
  };
  const chart = CHARTS[activeChart];

  return (
    <>
      <Navbar
        title={`Asset Detail — ${asset.name}`}
        subtitle={`${assetTypeLabel[asset.assetType] ?? asset.assetType} · Battery pack ${asset.batteryPackId.slice(0,8)}…`}
        alertCount={alerts.filter(a => a.status === 'open').length}
        actions={
          <button onClick={() => navigate('/fleet')} className="win-btn" style={{ fontSize: 11 }}>
            <ArrowLeft size={11} /> Back to Fleet
          </button>
        }
      />
      <PageContainer>
        {error && <ErrorBanner message={error} />}

        {/* Info strip */}
        <div style={{
          background: 'linear-gradient(to right, #dce6f5, #eaf2fb)',
          border: '1px solid #7f9db9',
          borderRadius: 3,
          padding: '5px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          fontSize: 11,
        }}>
          <AssetStatusBadge status={asset.status} />
          {asset.lastTelemetryAt && (
            <span style={{ color: '#4a4a4a' }}>Last telemetry: <b>{formatRelative(asset.lastTelemetryAt)}</b></span>
          )}
          <Link to={`/supply-chain/trace/${asset.id}`} style={{ marginLeft: 'auto', fontSize: 11 }}>
            View supply chain trace »
          </Link>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <StatCard
            label="State of Health"
            value={asset.currentSoh != null ? `${asset.currentSoh.toFixed(1)}%` : '—'}
            subValue={asset.sohConfidence != null ? `Confidence: ${(asset.sohConfidence*100).toFixed(0)}%` : undefined}
            icon={<Battery size={16}/>}
            variant={asset.currentSoh == null ? 'default' : asset.currentSoh >= 85 ? 'success' : asset.currentSoh >= 80 ? 'warning' : 'danger'}
          />
          <StatCard
            label="Remaining Useful Life"
            value={formatRulFull(asset.predictedRulDays, asset.predictedRulCycles).split('/')[0].trim()}
            subValue={asset.predictedRulCycles != null ? `${asset.predictedRulCycles.toLocaleString()} cycles` : undefined}
            icon={<Activity size={16}/>}
            variant={asset.predictedRulDays == null ? 'default' : asset.predictedRulDays > 180 ? 'success' : asset.predictedRulDays > 30 ? 'warning' : 'danger'}
          />
          <StatCard
            label="Total Charge Cycles"
            value={asset.totalCycles.toLocaleString()}
            icon={<Zap size={16}/>}
          />
          <StatCard
            label="Open Alerts"
            value={alerts.filter(a => a.status === 'open').length}
            icon={<Thermometer size={16}/>}
            variant={alerts.filter(a => a.status === 'open').length > 0 ? 'warning' : 'success'}
          />
        </div>

        {/* Chart panel */}
        <div className="win-panel" style={{ overflow: 'hidden' }}>
          <div className="win-section-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Telemetry &amp; Health Charts</span>
            <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
              {(Object.keys(CHARTS) as ChartKey[]).map(k => (
                <button
                  key={k}
                  onClick={() => setActiveChart(k)}
                  className={activeChart === k ? 'win-btn win-btn-primary' : 'win-btn'}
                  style={{ padding: '1px 8px', fontSize: 10 }}
                >
                  {CHARTS[k].label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: 12 }}>
            {chart.data.length === 0 ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height: 200, fontSize:12, color:'#6a6a6a', gap: 6 }}>
                <Info size={14}/> Insufficient data to render chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chart.data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d0dce8" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6a6a6a', fontFamily: 'Tahoma' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: '#6a6a6a', fontFamily: 'Tahoma' }} tickLine={false} axisLine={false} domain={chart.domain} width={36} />
                  <Tooltip content={<ChartTooltip unit={chart.lines[0]?.unit} />} />
                  {chart.refs.map(r => (
                    <ReferenceLine key={r.label} y={r.y} stroke={r.color} strokeDasharray="4 3"
                      label={{ value: r.label, fill: r.color, fontSize: 9, position: 'insideTopRight', fontFamily: 'Tahoma' }} />
                  ))}
                  {chart.lines.map(l => (
                    <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="win-panel" style={{ overflow: 'hidden' }}>
          <div className="win-section-header">Maintenance Alerts</div>
          {alerts.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: '#6a6a6a' }}>No alerts for this asset.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Alert</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id}>
                    <td style={{ maxWidth: 320 }}>
                      <div style={{ fontWeight: 'bold' }}>{a.title}</div>
                      <div style={{ fontSize: 10, color: '#6a6a6a', marginTop: 1 }}>{a.description.slice(0, 120)}{a.description.length > 120 ? '…' : ''}</div>
                    </td>
                    <td>{alertTypeLabel[a.type]}</td>
                    <td><SeverityBadge severity={a.severity} /></td>
                    <td><AlertStatusBadge status={a.status} /></td>
                    <td style={{ fontSize: 10, color: '#6a6a6a', whiteSpace: 'nowrap' }}>{formatDateTime(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Telemetry table */}
        <div className="win-panel" style={{ overflow: 'hidden' }}>
          <div className="win-section-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Recent Telemetry (last 20 readings)</span>
            <button onClick={load} className="win-btn" style={{ marginLeft: 'auto', padding: '1px 8px', fontSize: 10 }}>
              <RefreshCw size={10} /> Refresh
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 11 }}>
              <thead>
                <tr>
                  {['Timestamp','Voltage (V)','Current (A)','Temp (°C)','SoC (%)','Cycles'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...telemetry].reverse().slice(0, 20).map(t => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap', color: '#4a4a4a' }}>{formatDateTime(t.timestamp)}</td>
                    <td style={{ fontFamily: 'Courier New, monospace' }}>{t.voltage.toFixed(1)}</td>
                    <td style={{ fontFamily: 'Courier New, monospace' }}>{t.current.toFixed(1)}</td>
                    <td style={{
                      fontFamily: 'Courier New, monospace',
                      fontWeight: (t.temperature > 45 || t.temperature < -10) ? 'bold' : 'normal',
                      color: (t.temperature > 45 || t.temperature < -10) ? '#c00000' : 'inherit',
                    }}>{t.temperature.toFixed(1)}</td>
                    <td style={{ fontFamily: 'Courier New, monospace' }}>{t.stateOfCharge.toFixed(1)}</td>
                    <td style={{ fontFamily: 'Courier New, monospace' }}>{t.cycleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: 'linear-gradient(to bottom, #d0d8e8, #b8c8de)', borderTop: '1px solid #7f9db9', padding: '3px 10px', fontSize: 11, color: '#4a4a4a' }}>
            Showing 20 of {telemetry.length} total readings
          </div>
        </div>
      </PageContainer>
    </>
  );
}

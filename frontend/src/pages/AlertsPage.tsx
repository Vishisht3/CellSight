import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { Bell, CheckCircle, XCircle, Filter } from 'lucide-react';
import { alertsApi } from '../services/api';
import type { Alert, AlertCounts, AlertStatus, AlertSourceAgent } from '../types';
import Navbar from '../components/layout/Navbar';
import PageContainer from '../components/ui/PageContainer';
import StatCard from '../components/ui/StatCard';
import { SeverityBadge, AlertStatusBadge } from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorBanner from '../components/ui/ErrorBanner';
import EmptyState from '../components/ui/EmptyState';
import { formatRelative, alertTypeLabel, sourceAgentLabel } from '../utils/format';

type StatusTab = 'all' | AlertStatus;

const AGENT_BG: Record<AlertSourceAgent, string> = {
  apm:          '#cce5ff',
  supply_chain: '#e2d9f3',
  correlation:  '#fff3cd',
};
const AGENT_BORDER: Record<AlertSourceAgent, string> = {
  apm:          '#7fb3e0',
  supply_chain: '#9f86c0',
  correlation:  '#f0ad4e',
};
const AGENT_COLOR: Record<AlertSourceAgent, string> = {
  apm:          '#004085',
  supply_chain: '#4b2d80',
  correlation:  '#856404',
};

export default function AlertsPage() {
  const [alerts,     setAlerts]     = useState<Alert[]>([]);
  const [counts,     setCounts]     = useState<AlertCounts | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [statusTab,  setStatusTab]  = useState<StatusTab>('open');
  const [agentFilter,setAgentFilter]= useState('');
  const [actionId,   setActionId]   = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useDocumentMeta({ title: 'Alerts', description: 'Monitor and manage battery health, supplier quality, and field correlation alerts for your industrial EV fleet.' });

  const load = useCallback(async () => {
    try {
      const data = await alertsApi.getAlerts({
        status: statusTab !== 'all' ? statusTab : undefined,
        sourceAgent: agentFilter || undefined,
        limit: 200,
      });
      setAlerts(data.alerts);
      setCounts(data.counts);
      setError('');
    } catch { setError('Failed to load alerts.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [statusTab, agentFilter]);

  useEffect(() => { load(); }, [load]);

  async function ack(id: string) {
    setActionId(id);
    try { await alertsApi.acknowledge(id); await load(); }
    catch { setError('Failed to acknowledge.'); }
    finally { setActionId(null); }
  }
  async function resolve(id: string) {
    setActionId(id);
    try { await alertsApi.resolve(id); await load(); }
    catch { setError('Failed to resolve.'); }
    finally { setActionId(null); }
  }

  const TABS: { value: StatusTab; label: string; count?: number }[] = [
    { value:'all',          label:'All',          count: counts?.total },
    { value:'open',         label:'Open',         count: counts?.open },
    { value:'acknowledged', label:'Acknowledged', count: counts?.acknowledged },
    { value:'resolved',     label:'Resolved',     count: counts?.resolved },
  ];

  return (
    <>
      <Navbar
        title="Open Issues"
        subtitle="Battery health, supplier quality, and field-claim items that need follow-up"
        alertCount={counts?.open}
        onRefresh={() => { setRefreshing(true); load(); }}
        refreshing={refreshing}
      />
      <PageContainer>
        {error && <ErrorBanner message={error} />}

        {counts && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
            <StatCard label="Open"         value={counts.open}         icon={<Bell size={16}/>}        variant={counts.open > 0 ? 'danger' : 'success'} />
            <StatCard label="Acknowledged" value={counts.acknowledged} icon={<Filter size={16}/>}      variant="warning" />
            <StatCard label="Resolved"     value={counts.resolved}     icon={<CheckCircle size={16}/>} variant="success" />
            <StatCard label="Total"        value={counts.total}        icon={<Bell size={16}/>} />
          </div>
        )}

        <div className="win-panel" style={{ overflow:'hidden' }}>
          {/* toolbar */}
          <div style={{
            background:'linear-gradient(to bottom,#e8f0fb,#d0dff0)',
            borderBottom:'1px solid #7f9db9',
            padding:'5px 10px',
            display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
          }}>
            <div style={{ display:'flex', gap:2 }}>
              {TABS.map(t => {
                const active = statusTab === t.value;
                return (
                  <button key={t.value} onClick={() => setStatusTab(t.value)} style={{
                    padding:'2px 10px', fontSize:11, cursor:'pointer',
                    border:'1px solid #7f9db9', borderRadius:'3px 3px 0 0',
                    borderBottom: active ? '1px solid #f0f4f8' : '1px solid #7f9db9',
                    background: active ? '#f0f4f8' : 'linear-gradient(to bottom,#e8f0fb,#c8d8ef)',
                    color: active ? '#0a246a' : '#4a4a4a', fontWeight: active ? 'bold' : 'normal',
                    fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
                    marginBottom: active ? -1 : 0, position:'relative', zIndex: active ? 1 : 0,
                  }}>
                    {t.label}{t.count != null ? ` (${t.count})` : ''}
                  </button>
                );
              })}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:4, marginLeft:'auto' }}>
              <label style={{ fontSize:11, color:'#4a4a4a' }}>Source area:</label>
              <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} style={{ fontSize:11, padding:'1px 4px' }}>
                <option value="">All sources</option>
                <option value="apm">Fleet health</option>
                <option value="supply_chain">Supplier quality</option>
                <option value="correlation">Field claims</option>
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner fullPage label="Loading alertsâ€¦" />
          ) : alerts.length === 0 ? (
            <EmptyState icon={Bell} title="No alerts found" description="Adjust filters or check back later." />
          ) : (
            <table style={{ width:'100%', fontSize:11 }}>
              <thead>
                <tr>
                  <th style={{ width:4 }}></th>
                  <th>Alert</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Age</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => {
                  const sevColor = alert.severity === 'critical' ? '#c00000' : alert.severity === 'warning' ? '#b87000' : '#316ac5';
                  return (
                    <tr key={alert.id}>
                      <td style={{ padding:0, width:4, background:sevColor }}></td>
                      <td style={{ maxWidth:320 }}>
                        <div style={{ fontWeight:'bold', color:'#0a246a' }}>{alert.title}</div>
                        <div style={{ fontSize:10, color:'#6a6a6a', marginTop:1 }}>{alert.description.slice(0,100)}{alert.description.length>100?'...':''}</div>
                        {alert.assetId && (<Link to={'/fleet/' + alert.assetId} style={{ fontSize:10, color:'#316ac5', display:'block', marginTop:2 }}>View asset &rarr;</Link>)}
                        {alert.supplierId && (<Link to="/supply-chain" style={{ fontSize:10, color:'#316ac5', display:'block', marginTop:2 }}>View supplier &rarr;</Link>)}
                      </td>
                      <td>{alertTypeLabel[alert.type]}</td>
                      <td>
                        <span style={{
                          background: AGENT_BG[alert.sourceAgent],
                          border: `1px solid ${AGENT_BORDER[alert.sourceAgent]}`,
                          color: AGENT_COLOR[alert.sourceAgent],
                          padding:'1px 5px', borderRadius:2, fontSize:10,
                        }}>
                          {sourceAgentLabel[alert.sourceAgent]}
                        </span>
                      </td>
                      <td><SeverityBadge severity={alert.severity} /></td>
                      <td><AlertStatusBadge status={alert.status} /></td>
                      <td style={{ whiteSpace:'nowrap', color:'#6a6a6a' }}>{formatRelative(alert.createdAt)}</td>
                      <td>
                        {alert.status !== 'resolved' && (
                          <div style={{ display:'flex', gap:4 }}>
                            {alert.status === 'open' && (
                              <button onClick={() => ack(alert.id)} disabled={actionId === alert.id}
                                className="win-btn" style={{ padding:'1px 6px', fontSize:10 }}>
                                <Filter size={9}/> Ack
                              </button>
                            )}
                            <button onClick={() => resolve(alert.id)} disabled={actionId === alert.id}
                              className="win-btn" style={{ padding:'1px 6px', fontSize:10, color:'#155724', borderColor:'#82c891' }}>
                              <CheckCircle size={9}/> Resolve
                            </button>
                          </div>
                        )}
                        {alert.status === 'resolved' && (
                          <XCircle size={13} style={{ color:'#aaa' }} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={{ background:'linear-gradient(to bottom,#d0d8e8,#b8c8de)', borderTop:'1px solid #7f9db9', padding:'3px 10px', fontSize:11, color:'#4a4a4a' }}>
            {alerts.length} alert{alerts.length!==1?'s':''} displayed
          </div>
        </div>
      </PageContainer>
    </>
  );
}

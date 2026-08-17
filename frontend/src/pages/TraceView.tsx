import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Layers, Box, Factory, AlertCircle } from 'lucide-react';
import { supplyChainApi } from '../services/api';
import type { AssetTrace } from '../types';
import Navbar from '../components/layout/Navbar';
import Breadcrumb from '../components/ui/Breadcrumb';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import PageContainer from '../components/ui/PageContainer';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorBanner from '../components/ui/ErrorBanner';
import { RiskBadge } from '../components/ui/StatusBadge';
import { formatDate, tierLabel, materialLabel } from '../utils/format';

function TraceRow({ icon, tier, title, meta, last }: {
  icon: React.ReactNode; tier: string; title: string; meta: string[]; last?: boolean;
}) {
  return (
    <tr>
      <td style={{ verticalAlign:'top', textAlign:'center', width:44, padding:'6px 4px', background:'transparent', border:'none' }}>
        <div style={{
          width:36, height:36, borderRadius:3, margin:'0 auto',
          background:'linear-gradient(to bottom, #dce6f5, #b8cfe8)',
          border:'1px solid #7f9db9',
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#316ac5',
        }}>{icon}</div>
        {!last && (
          <div style={{ width:2, height:24, background:'#b8cfe8', margin:'0 auto', borderLeft:'2px dashed #7f9db9' }} />
        )}
      </td>
      <td style={{ verticalAlign:'top', padding:'6px 8px', background:'transparent', border:'none' }}>
        <div style={{ fontSize:9, fontWeight:'bold', textTransform:'uppercase', letterSpacing:1, color:'#4a6a9a', marginBottom:2 }}>{tier}</div>
        <div style={{ fontSize:12, fontWeight:'bold', color:'#0a246a', marginBottom:3 }}>{title}</div>
        {meta.map((m,i) => <div key={i} style={{ fontSize:11, color:'#4a4a4a' }}>{m}</div>)}
      </td>
    </tr>
  );
}

export default function TraceView() {
  useDocumentMeta({ title: 'Pack Trace', description: 'Trace any battery pack back through its full supply chain: manufacturer, cell batch, and raw material lots.' });
  const { assetId } = useParams<{ assetId: string }>();
  const navigate    = useNavigate();
  const [trace,   setTrace]   = useState<AssetTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!assetId) return;
    supplyChainApi.traceAsset(assetId)
      .then(t => { setTrace(t); setError(''); })
      .catch(() => setError('Could not load trace. Check the asset ID or API connection.'))
      .finally(() => setLoading(false));
  }, [assetId]);

  return (
    <>
      <Navbar
        title="Supply Chain Trace"
        subtitle="Full upstream chain: raw material â†’ cell batch â†’ battery pack â†’ deployed asset"
        actions={
          <button onClick={() => navigate(-1)} className="win-btn" style={{ fontSize:11 }}>
            <ArrowLeft size={11}/> Back
          </button>
        }
      />
      <Breadcrumb items={[{ label: 'Supplier Portal', href: '/supply-chain' }, { label: 'Trace' }, { label: assetId ?? 'Asset' }]} />
      <PageContainer>
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <LoadingSpinner fullPage size="lg" label="Loading traceâ€¦" />
        ) : !trace ? (
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#721c24', padding:16 }}>
            <AlertCircle size={14}/> No trace data found for this asset.
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:10 }}>

            {/* Chain */}
            <div className="win-panel" style={{ overflow:'hidden' }}>
              <div className="win-section-header">Full Upstream Supply Chain</div>
              <div style={{ padding:'8px 4px' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <tbody>
                    <TraceRow
                      icon={<Package size={16}/>}
                      tier="Deployed Asset"
                      title={trace.asset.name}
                      meta={[
                        `Type: ${trace.asset.assetType.replace(/_/g,' ')}`,
                        `Status: ${trace.asset.status}`,
                        trace.asset.currentSoh != null ? `State of Health: ${trace.asset.currentSoh.toFixed(1)}%` : 'SoH: Insufficient data',
                      ]}
                    />
                    <TraceRow
                      icon={<Box size={16}/>}
                      tier="Battery Pack"
                      title={trace.batteryPack.packNumber}
                      meta={[
                        `Capacity: ${trace.batteryPack.capacity.toFixed(0)} kWh`,
                        `Assembly date: ${formatDate(trace.batteryPack.assemblyDate)}`,
                      ]}
                    />
                    <TraceRow
                      icon={<Layers size={16}/>}
                      tier="Cell Batch"
                      title={trace.cellBatch.batchNumber}
                      meta={[
                        `Quantity: ${trace.cellBatch.quantity.toLocaleString()} cells`,
                        `Production date: ${formatDate(trace.cellBatch.productionDate)}`,
                      ]}
                    />
                    <TraceRow
                      icon={<Factory size={16}/>}
                      tier="Cell Manufacturer"
                      title={trace.manufacturer.name}
                      meta={[
                        `Country: ${trace.manufacturer.country}  Â·  ${tierLabel[trace.manufacturer.tier]}`,
                        `Composite risk score: ${trace.manufacturer.riskScore.toFixed(0)} / 100`,
                      ]}
                      last
                    />
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

              {/* Material lots */}
              <div className="win-panel" style={{ overflow:'hidden' }}>
                <div className="win-section-header">Raw Material Lots ({trace.materialLots.length})</div>
                {trace.materialLots.length === 0 ? (
                  <div style={{ padding:12, fontSize:11, color:'#6a6a6a' }}>No material lots linked to this batch.</div>
                ) : (
                  <div style={{ maxHeight:280, overflowY:'auto' }}>
                    <table style={{ width:'100%', fontSize:11 }}>
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Lot</th>
                          <th>Supplier</th>
                          <th>Quality</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trace.materialLots.map(lot => {
                          const outOfSpec = lot.qualityScore != null && lot.specificationMin != null && lot.qualityScore < lot.specificationMin;
                          return (
                            <tr key={lot.id}>
                              <td style={{ textTransform:'capitalize', fontWeight:'bold' }}>
                                {materialLabel[lot.materialType] ?? lot.materialType}
                              </td>
                              <td style={{ fontFamily:'Courier New,monospace', fontSize:10 }}>{lot.lotNumber}</td>
                              <td>{lot.supplier.name} ({lot.supplier.country})</td>
                              <td style={{ color: outOfSpec ? '#c00000' : '#155724', fontWeight:'bold' }}>
                                {lot.qualityScore != null ? `${outOfSpec?'âš  ':'âœ“ '}${lot.qualityScore.toFixed(1)}` : ' - '}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Manufacturer risk */}
              <div className="win-panel" style={{ overflow:'hidden' }}>
                <div className="win-section-header">Manufacturer Risk Breakdown</div>
                <div style={{ padding:'8px 10px', display:'flex', flexDirection:'column', gap:6 }}>
                  {[
                    { label:'Concentration', value:trace.manufacturer.concentrationRisk },
                    { label:'Geopolitical',  value:trace.manufacturer.geopoliticalRisk },
                    { label:'Quality',       value:trace.manufacturer.qualityRisk },
                    { label:'Compliance',    value:trace.manufacturer.complianceRisk },
                  ].map(r => (
                    <div key={r.label}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}>
                        <span style={{ color:'#4a4a4a' }}>{r.label}</span>
                        <span style={{ fontWeight:'bold', color: r.value>=0.6?'#c00000':r.value>=0.3?'#b87000':'#155724' }}>
                          {(r.value*100).toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ height:10, background:'linear-gradient(to bottom,#d0d0d0,#f0f0f0)', border:'1px inset #a0a0a0', borderRadius:2, overflow:'hidden' }}>
                        <div style={{
                          width:`${Math.min(100,r.value*100)}%`, height:'100%',
                          background: r.value>=0.6?'#c00000':r.value>=0.3?'#b87000':'#2a8a2a',
                          transition:'width 0.4s',
                        }}/>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop:4 }}>
                    <RiskBadge score={trace.manufacturer.riskScore} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </>
  );
}

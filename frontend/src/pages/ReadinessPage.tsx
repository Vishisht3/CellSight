import { useState } from 'react';
import { Map, CheckCircle, AlertTriangle, TrendingUp, Zap, ChevronRight } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import PageContainer from '../components/ui/PageContainer';
import StatCard from '../components/ui/StatCard';

// ── Synthetic readiness data (no backend needed – procurement intelligence) ──

interface VehicleReadiness {
  id: string;
  name: string;
  type: string;
  currentFuel: string;
  annualKm: number;
  avgPayloadT: number;
  dailyDwellHours: number;
  readinessScore: number;   // 0-100
  readinessTier: 'Ready' | 'Near Ready' | 'Needs Review' | 'Not Suitable';
  recommendedEV: string;
  oem: string;
  listPriceK: number;
  deliveryLeadWeeks: number;
  estAnnualSavingsK: number;
  co2ReductionT: number;
  blockers: string[];
  confidence: number;
}

const VEHICLES: VehicleReadiness[] = [
  { id:'v1', name:'FreightLiner-001', type:'Freight Truck', currentFuel:'Diesel', annualKm:95000, avgPayloadT:18, dailyDwellHours:7, readinessScore:92, readinessTier:'Ready', recommendedEV:'Volvo FH Electric', oem:'Volvo Trucks', listPriceK:380, deliveryLeadWeeks:18, estAnnualSavingsK:28, co2ReductionT:54, blockers:[], confidence:0.94 },
  { id:'v2', name:'FreightLiner-002', type:'Freight Truck', currentFuel:'Diesel', annualKm:88000, avgPayloadT:16, dailyDwellHours:8, readinessScore:89, readinessTier:'Ready', recommendedEV:'DAF CF Electric', oem:'DAF Trucks', listPriceK:355, deliveryLeadWeeks:22, estAnnualSavingsK:24, co2ReductionT:49, blockers:[], confidence:0.91 },
  { id:'v3', name:'Haul-Truck-A1', type:'Mining Vehicle', currentFuel:'Diesel', annualKm:42000, avgPayloadT:90, dailyDwellHours:4, readinessScore:61, readinessTier:'Near Ready', recommendedEV:'Komatsu 930E EV', oem:'Komatsu', listPriceK:3400, deliveryLeadWeeks:52, estAnnualSavingsK:310, co2ReductionT:210, blockers:['Charging infrastructure capacity','Shift pattern optimisation required'], confidence:0.72 },
  { id:'v4', name:'Haul-Truck-A2', type:'Mining Vehicle', currentFuel:'Diesel', annualKm:39000, avgPayloadT:88, dailyDwellHours:4, readinessScore:58, readinessTier:'Near Ready', recommendedEV:'Komatsu 930E EV', oem:'Komatsu', listPriceK:3400, deliveryLeadWeeks:52, estAnnualSavingsK:295, co2ReductionT:200, blockers:['Charging infrastructure capacity'], confidence:0.70 },
  { id:'v5', name:'Forklift-FL01', type:'Forklift', currentFuel:'LPG', annualKm:12000, avgPayloadT:3, dailyDwellHours:12, readinessScore:97, readinessTier:'Ready', recommendedEV:'Toyota 8FBMT Electric', oem:'Toyota Industries', listPriceK:48, deliveryLeadWeeks:8, estAnnualSavingsK:9, co2ReductionT:8, blockers:[], confidence:0.97 },
  { id:'v6', name:'Forklift-FL02', type:'Forklift', currentFuel:'LPG', annualKm:11500, avgPayloadT:3, dailyDwellHours:12, readinessScore:96, readinessTier:'Ready', recommendedEV:'Toyota 8FBMT Electric', oem:'Toyota Industries', listPriceK:48, deliveryLeadWeeks:8, estAnnualSavingsK:9, co2ReductionT:7, blockers:[], confidence:0.96 },
  { id:'v7', name:'Forklift-FL03', type:'Forklift', currentFuel:'LPG', annualKm:13000, avgPayloadT:4, dailyDwellHours:10, readinessScore:94, readinessTier:'Ready', recommendedEV:'Crown FC 5200 Series', oem:'Crown Equipment', listPriceK:52, deliveryLeadWeeks:10, estAnnualSavingsK:10, co2ReductionT:8, blockers:[], confidence:0.95 },
  { id:'v8', name:'Excavator-EX1', type:'Construction', currentFuel:'Diesel', annualKm:8000, avgPayloadT:0, dailyDwellHours:6, readinessScore:44, readinessTier:'Needs Review', recommendedEV:'Volvo EC230 Electric', oem:'Volvo CE', listPriceK:520, deliveryLeadWeeks:40, estAnnualSavingsK:18, co2ReductionT:22, blockers:['Limited OEM range availability','Site grid capacity unknown','Heavy-duty duty-cycle analysis required'], confidence:0.55 },
  { id:'v9', name:'Excavator-EX2', type:'Construction', currentFuel:'Diesel', annualKm:7500, avgPayloadT:0, dailyDwellHours:5, readinessScore:42, readinessTier:'Needs Review', recommendedEV:'Volvo EC230 Electric', oem:'Volvo CE', listPriceK:520, deliveryLeadWeeks:40, estAnnualSavingsK:16, co2ReductionT:20, blockers:['Limited OEM range availability','Site grid capacity unknown'], confidence:0.52 },
  { id:'v10', name:'Loader-LD1', type:'Construction', currentFuel:'Diesel', annualKm:15000, avgPayloadT:0, dailyDwellHours:5, readinessScore:36, readinessTier:'Not Suitable', recommendedEV:'N/A — No commercial option', oem:'—', listPriceK:0, deliveryLeadWeeks:0, estAnnualSavingsK:0, co2ReductionT:12, blockers:['No commercially available EV equivalent at required power rating','Grid reinforcement cost prohibitive at current energy prices'], confidence:0.38 },
];

const TIER_COLOR: Record<VehicleReadiness['readinessTier'], string> = {
  'Ready':        '#155724',
  'Near Ready':   '#856404',
  'Needs Review': '#721c24',
  'Not Suitable': '#383d41',
};
const TIER_BG: Record<VehicleReadiness['readinessTier'], string> = {
  'Ready':        '#d4edda',
  'Near Ready':   '#fff3cd',
  'Needs Review': '#f8d7da',
  'Not Suitable': '#e2e3e5',
};
const TIER_BORDER: Record<VehicleReadiness['readinessTier'], string> = {
  'Ready':        '#82c891',
  'Near Ready':   '#f0ad4e',
  'Needs Review': '#e07070',
  'Not Suitable': '#adb5bd',
};

function ReadinessBadge({ tier }: { tier: VehicleReadiness['readinessTier'] }) {
  return (
    <span style={{
      background: TIER_BG[tier], border: `1px solid ${TIER_BORDER[tier]}`,
      color: TIER_COLOR[tier], padding: '1px 6px', borderRadius: 2, fontSize: 10,
      fontWeight: 'bold',
    }}>{tier}</span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#2a8a2a' : score >= 55 ? '#b87000' : '#c00000';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
      <div style={{ flex: 1, height: 12, background: 'linear-gradient(to bottom,#d0d0d0,#f0f0f0)', border: '1px inset #a0a0a0', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: `linear-gradient(to bottom,${color}aa,${color}ff)`, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 'bold', color, minWidth: 28, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

export default function ReadinessPage() {
  const [selected, setSelected] = useState<VehicleReadiness | null>(null);
  const [tierFilter, setTierFilter] = useState<string>('all');

  const ready      = VEHICLES.filter(v => v.readinessTier === 'Ready').length;
  const nearReady  = VEHICLES.filter(v => v.readinessTier === 'Near Ready').length;
  const needsReview= VEHICLES.filter(v => v.readinessTier === 'Needs Review').length;
  const notSuitable= VEHICLES.filter(v => v.readinessTier === 'Not Suitable').length;
  const totalSavings = VEHICLES.reduce((s, v) => s + v.estAnnualSavingsK, 0);
  const totalCO2     = VEHICLES.reduce((s, v) => s + v.co2ReductionT, 0);

  const displayed = tierFilter === 'all'
    ? VEHICLES
    : VEHICLES.filter(v => v.readinessTier === tierFilter);

  const TIERS = ['all', 'Ready', 'Near Ready', 'Needs Review', 'Not Suitable'];

  return (
    <>
      <Navbar
        title="Fleet Electrification Readiness & Procurement Intelligence"
        subtitle="Transition readiness scoring, OEM procurement recommendations, and ROI analysis per asset"
      />
      <PageContainer>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
          <StatCard label="Ready Now"        value={ready}           icon={<CheckCircle size={16}/>} variant="success" />
          <StatCard label="Near Ready"        value={nearReady}       icon={<TrendingUp size={16}/>}  variant="warning" />
          <StatCard label="Needs Review"      value={needsReview}     icon={<AlertTriangle size={16}/>} variant="danger" />
          <StatCard label="Not Suitable"      value={notSuitable}     icon={<Map size={16}/>} />
          <StatCard label="Est. Annual Saving" value={`£${totalSavings}k`} icon={<Zap size={16}/>} variant="success" subValue="all assets combined" />
          <StatCard label="CO₂ Reduction"     value={`${totalCO2}t`} icon={<TrendingUp size={16}/>}  variant="info"    subValue="tonnes / year" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: 10 }}>
          {/* Table */}
          <div className="win-panel" style={{ overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{
              background: 'linear-gradient(to bottom,#e8f0fb,#d0dff0)',
              borderBottom: '1px solid #7f9db9',
              padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 2,
            }}>
              {TIERS.map(t => {
                const active = tierFilter === t;
                return (
                  <button key={t} onClick={() => setTierFilter(t)} style={{
                    padding: '2px 10px', fontSize: 11, cursor: 'pointer',
                    border: '1px solid #7f9db9', borderRadius: '3px 3px 0 0',
                    borderBottom: active ? '1px solid #f0f4f8' : '1px solid #7f9db9',
                    background: active ? '#f0f4f8' : 'linear-gradient(to bottom,#e8f0fb,#c8d8ef)',
                    color: active ? '#0a246a' : '#4a4a4a', fontWeight: active ? 'bold' : 'normal',
                    fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
                    marginBottom: active ? -1 : 0, position: 'relative', zIndex: active ? 1 : 0,
                  }}>{t === 'all' ? 'All' : t}</button>
                );
              })}
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6a6a6a' }}>
                Click a row to view procurement recommendation →
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Readiness Score</th>
                    <th>Tier</th>
                    <th>Recommended EV</th>
                    <th>OEM</th>
                    <th>List Price</th>
                    <th>Lead Time</th>
                    <th>Annual Saving</th>
                    <th>CO₂ Saved</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(v => (
                    <tr key={v.id}
                      onClick={() => setSelected(selected?.id === v.id ? null : v)}
                      style={{
                        cursor: 'pointer',
                        outline: selected?.id === v.id ? '2px solid #316ac5' : 'none',
                        outlineOffset: -2,
                      }}
                    >
                      <td style={{ fontWeight: 'bold', color: '#0a246a' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {selected?.id === v.id && <ChevronRight size={10} style={{ color: '#316ac5' }} />}
                          {v.name}
                        </span>
                      </td>
                      <td>{v.type}</td>
                      <td style={{ minWidth: 140 }}><ScoreBar score={v.readinessScore} /></td>
                      <td><ReadinessBadge tier={v.readinessTier} /></td>
                      <td style={{ fontSize: 10 }}>{v.recommendedEV}</td>
                      <td>{v.oem}</td>
                      <td style={{ fontFamily: 'Courier New,monospace', textAlign: 'right' }}>
                        {v.listPriceK > 0 ? `£${v.listPriceK.toLocaleString()}k` : '—'}
                      </td>
                      <td style={{ fontFamily: 'Courier New,monospace', textAlign: 'right' }}>
                        {v.deliveryLeadWeeks > 0 ? `${v.deliveryLeadWeeks}w` : '—'}
                      </td>
                      <td style={{ fontFamily: 'Courier New,monospace', textAlign: 'right', color: '#155724', fontWeight: 'bold' }}>
                        {v.estAnnualSavingsK > 0 ? `£${v.estAnnualSavingsK}k` : '—'}
                      </td>
                      <td style={{ fontFamily: 'Courier New,monospace', textAlign: 'right', color: '#004085' }}>
                        {v.co2ReductionT > 0 ? `${v.co2ReductionT}t` : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 40, height: 8, background: '#e0e0e0', borderRadius: 2, overflow: 'hidden', border: '1px solid #aaa' }}>
                            <div style={{ width: `${v.confidence * 100}%`, height: '100%', background: v.confidence >= 0.8 ? '#2a8a2a' : v.confidence >= 0.6 ? '#b87000' : '#c00000' }} />
                          </div>
                          <span style={{ fontSize: 10, fontFamily: 'Courier New,monospace' }}>{(v.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: 'linear-gradient(to bottom,#d0d8e8,#b8c8de)', borderTop: '1px solid #7f9db9', padding: '3px 10px', fontSize: 11, color: '#4a4a4a' }}>
              {displayed.length} asset{displayed.length !== 1 ? 's' : ''} displayed
            </div>
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Procurement card */}
              <div className="win-panel" style={{ overflow: 'hidden' }}>
                <div className="win-section-header">
                  Procurement Recommendation — {selected.name}
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <tbody>
                      {[
                        ['Recommended EV', selected.recommendedEV],
                        ['OEM',           selected.oem],
                        ['List Price',    selected.listPriceK > 0 ? `£${selected.listPriceK.toLocaleString()}k` : 'N/A'],
                        ['Delivery Lead', selected.deliveryLeadWeeks > 0 ? `${selected.deliveryLeadWeeks} weeks` : 'N/A'],
                        ['Readiness Score', `${selected.readinessScore} / 100`],
                        ['Confidence',    `${(selected.confidence*100).toFixed(0)}%`],
                      ].map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ fontWeight: 'bold', color: '#4a4a4a', paddingRight: 8, border: '1px solid #c0cfe0', background: 'linear-gradient(to right,#e8f0fb,#f4f8fd)', width: '42%', padding: '4px 8px' }}>{k}</td>
                          <td style={{ border: '1px solid #c0cfe0', padding: '4px 8px', background: '#fff' }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ROI card */}
              <div className="win-panel" style={{ overflow: 'hidden' }}>
                <div className="win-section-header">Return on Investment</div>
                <div style={{ padding: '10px 12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <tbody>
                      {[
                        ['Annual Fuel/Energy Saving', selected.estAnnualSavingsK > 0 ? `£${selected.estAnnualSavingsK}k / year` : 'N/A'],
                        ['CO₂ Reduction',             selected.co2ReductionT > 0 ? `${selected.co2ReductionT} t / year` : 'N/A'],
                        ['Simple Payback',             selected.listPriceK > 0 && selected.estAnnualSavingsK > 0
                          ? `~${(selected.listPriceK / selected.estAnnualSavingsK).toFixed(1)} years` : 'N/A'],
                        ['Annual km',                  selected.annualKm.toLocaleString()],
                        ['Avg Payload',                `${selected.avgPayloadT} t`],
                        ['Daily Dwell',                `${selected.dailyDwellHours} h (charging window)`],
                      ].map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ fontWeight: 'bold', color: '#4a4a4a', border: '1px solid #c0cfe0', background: 'linear-gradient(to right,#e8f0fb,#f4f8fd)', width: '52%', padding: '4px 8px' }}>{k}</td>
                          <td style={{ border: '1px solid #c0cfe0', padding: '4px 8px', background: '#fff', fontFamily: 'Courier New,monospace' }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Blockers */}
              {selected.blockers.length > 0 && (
                <div className="win-panel" style={{ overflow: 'hidden' }}>
                  <div className="win-section-header" style={{ color: '#721c24', background: 'linear-gradient(to right,#f8d7da,#fce8e8 60%,#fddada 100%)' }}>
                    ⚠ Transition Blockers ({selected.blockers.length})
                  </div>
                  <ul style={{ margin: 0, padding: '8px 12px 8px 28px', fontSize: 11 }}>
                    {selected.blockers.map((b, i) => <li key={i} style={{ color: '#721c24', marginBottom: 3 }}>{b}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}

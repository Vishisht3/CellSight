import { useState } from 'react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { Wrench, Clock, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import PageContainer from '../components/ui/PageContainer';
import StatCard from '../components/ui/StatCard';

// â”€â”€ Synthetic maintenance schedule data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface MaintenanceJob {
  id: string;
  assetId: string;
  assetName: string;
  jobType: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  scheduledDate: string;
  estimatedHours: number;
  technicianSlot: string;
  status: 'Overdue' | 'Due Today' | 'Upcoming' | 'In Progress' | 'Complete';
  description: string;
  chargingImpact: boolean;
  shift: 'Day' | 'Night' | 'Any';
}

interface ShiftCapacity {
  shift: string;
  start: string;
  end: string;
  techsAvailable: number;
  techsAllocated: number;
  chargeSlotsAvailable: number;
  chargeSlotsAllocated: number;
}

const JOBS: MaintenanceJob[] = [
  { id:'j1',  assetId:'a1', assetName:'Riverton Linehaul 104', jobType:'Battery Thermal System Inspection', priority:'Critical', scheduledDate:'2026-07-22', estimatedHours:3, technicianSlot:'Tech A  -  Bay 2', status:'Due Today',  description:'Coolant loop pressure check, pump inspection, thermal sensor calibration. Flagged by thermal event alert.',    chargingImpact:true,  shift:'Day'   },
  { id:'j2',  assetId:'a2', assetName:'Mariposa Quarry Hauler 07',   jobType:'SoH Diagnostic & Cell Balancing',  priority:'High',     scheduledDate:'2026-07-22', estimatedHours:4, technicianSlot:'Tech B  -  Bay 1', status:'Due Today',  description:'SoH below 82%. Full diagnostic, BMS recalibration, passive cell balancing cycle.',                         chargingImpact:true,  shift:'Day'   },
  { id:'j3',  assetId:'a3', assetName:'North Yard Excavator 4',   jobType:'Predictive: Charge Pattern Review', priority:'Medium',   scheduledDate:'2026-07-22', estimatedHours:1, technicianSlot:'Tech C  -  Bay 3', status:'In Progress',description:'Software update to restrict charging to the 20â€“80% SoC window from the fleet health review.',                  chargingImpact:false, shift:'Day'   },
  { id:'j4',  assetId:'a4', assetName:'Riverton Linehaul 126', jobType:'Routine 500-Cycle Service',         priority:'Low',      scheduledDate:'2026-07-23', estimatedHours:2, technicianSlot:'Tech A  -  Bay 2', status:'Upcoming',  description:'Standard 500-cycle inspection: contact cleaning, connector torque check, firmware update.',                chargingImpact:false, shift:'Any'   },
  { id:'j5',  assetId:'a5', assetName:'Dock Door Forklift 21',    jobType:'RUL Threshold  -  Battery Swap Prep', priority:'Critical', scheduledDate:'2026-07-23', estimatedHours:6, technicianSlot:'Tech B  -  Bay 1', status:'Upcoming',  description:'Remaining Useful Life â‰¤ 7 days. Prepare replacement pack PACK-CELL-LGES-0623-02, schedule swap window.',             chargingImpact:true,  shift:'Night' },
  { id:'j6',  assetId:'a6', assetName:'Mariposa Quarry Hauler 18',   jobType:'Charging Infrastructure Check',     priority:'Medium',   scheduledDate:'2026-07-24', estimatedHours:2, technicianSlot:'Tech C  -  Bay 3', status:'Upcoming',  description:'Verify 150 kW charge point calibration, connector wear, load-balancing relay test.',                        chargingImpact:true,  shift:'Day'   },
  { id:'j7',  assetId:'a7', assetName:'Dock Door Forklift 03',    jobType:'Routine 500-Cycle Service',         priority:'Low',      scheduledDate:'2026-07-21', estimatedHours:2, technicianSlot:'Tech A  -  Bay 2', status:'Overdue',   description:'Service window missed. Rescheduled  -  contact cleaning and connector torque overdue.',                      chargingImpact:false, shift:'Any'   },
  { id:'j8',  assetId:'a8', assetName:'Riverton Linehaul 117', jobType:'Thermal Event Follow-up',           priority:'High',     scheduledDate:'2026-07-24', estimatedHours:3, technicianSlot:'Tech B  -  Bay 1', status:'Upcoming',  description:'Post-event inspection following 52°C excursion logged 2026-07-20. Coolant, sensors, BMS log review.',     chargingImpact:true,  shift:'Day'   },
  { id:'j9',  assetId:'a9', assetName:'Aggregate Loader 6',       jobType:'Annual Safety Certification',       priority:'High',     scheduledDate:'2026-07-25', estimatedHours:4, technicianSlot:'Tech A  -  Bay 2', status:'Upcoming',  description:'Annual statutory inspection required by HSE. Includes insulation resistance test, earth bonding verification.',chargingImpact:false, shift:'Day'   },
  { id:'j10', assetId:'a10',assetName:'Mariposa Quarry Hauler 31',jobType:'SoH Diagnostic',                   priority:'Medium',   scheduledDate:'2026-07-26', estimatedHours:3, technicianSlot:'Tech C  -  Bay 3', status:'Upcoming',  description:'Routine SoH diagnostic at 350 cycles. Compare against degradation baseline.',                             chargingImpact:true,  shift:'Any'   },
];

const CAPACITY: ShiftCapacity[] = [
  { shift:'Day Shift',   start:'06:00', end:'14:00', techsAvailable:3, techsAllocated:3, chargeSlotsAvailable:8, chargeSlotsAllocated:6 },
  { shift:'Afternoon',   start:'14:00', end:'22:00', techsAvailable:2, techsAllocated:1, chargeSlotsAvailable:8, chargeSlotsAllocated:3 },
  { shift:'Night Shift', start:'22:00', end:'06:00', techsAvailable:1, techsAllocated:1, chargeSlotsAvailable:8, chargeSlotsAllocated:7 },
];

const PRIORITY_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  Critical: { bg:'#f8d7da', border:'#e07070', color:'#721c24' },
  High:     { bg:'#fff3cd', border:'#f0ad4e', color:'#856404' },
  Medium:   { bg:'#cce5ff', border:'#7fb3e0', color:'#004085' },
  Low:      { bg:'#e2e3e5', border:'#adb5bd', color:'#383d41' },
};

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  Overdue:     { bg:'#f8d7da', border:'#e07070', color:'#721c24' },
  'Due Today': { bg:'#fff3cd', border:'#f0ad4e', color:'#856404' },
  'In Progress':{ bg:'#cce5ff', border:'#7fb3e0', color:'#004085' },
  Upcoming:    { bg:'#d4edda', border:'#82c891', color:'#155724' },
  Complete:    { bg:'#e2e3e5', border:'#adb5bd', color:'#383d41' },
};

function PillBadge({ label, style }: { label: string; style: { bg: string; border: string; color: string } }) {
  return (
    <span style={{
      background: style.bg, border: `1px solid ${style.border}`,
      color: style.color, padding: '1px 6px', borderRadius: 2,
      fontSize: 10, fontWeight: 'bold', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function CapBar({ used, total, color }: { used: number; total: number; color: string }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 10, background: 'linear-gradient(to bottom,#d0d0d0,#f0f0f0)', border: '1px inset #a0a0a0', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: 'Courier New,monospace', color: '#4a4a4a', minWidth: 36 }}>
        {used}/{total}
      </span>
    </div>
  );
}

export default function MaintenancePage() {
  useDocumentMeta({ title: 'Work Orders' });
  const [selected,    setSelected]    = useState<MaintenanceJob | null>(null);
  const [statusFilter,setStatusFilter]= useState('all');
  const [prioFilter,  setPrioFilter]  = useState('all');

  const overdue   = JOBS.filter(j => j.status === 'Overdue').length;
  const dueToday  = JOBS.filter(j => j.status === 'Due Today').length;
  const inProg    = JOBS.filter(j => j.status === 'In Progress').length;
  const upcoming  = JOBS.filter(j => j.status === 'Upcoming').length;
  const chargingImpact = JOBS.filter(j => j.chargingImpact).length;

  const displayed = JOBS.filter(j =>
    (statusFilter === 'all' || j.status === statusFilter) &&
    (prioFilter   === 'all' || j.priority === prioFilter)
  );

  const STATUS_TABS = ['all','Overdue','Due Today','In Progress','Upcoming','Complete'];
  const PRIO_TABS   = ['all','Critical','High','Medium','Low'];

  return (
    <>
      <Navbar
        title="Maintenance Operations Optimiser"
        subtitle="Scheduled maintenance, charging infrastructure uptime, and workshop capacity planning"
      />
      <PageContainer>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
          <StatCard label="Overdue"            value={overdue}       icon={<AlertTriangle size={16}/>} variant={overdue > 0 ? 'danger' : 'success'} />
          <StatCard label="Due Today"           value={dueToday}      icon={<Clock size={16}/>}         variant={dueToday > 0 ? 'warning' : 'success'} />
          <StatCard label="In Progress"         value={inProg}        icon={<Wrench size={16}/>}        variant="info" />
          <StatCard label="Upcoming (7 days)"   value={upcoming}      icon={<CheckCircle size={16}/>}   variant="success" />
          <StatCard label="Charging Impacted"   value={chargingImpact} icon={<Zap size={16}/>}          variant="warning" subValue="jobs affect charge slots" />
        </div>

        {/* Shift capacity */}
        <div className="win-panel" style={{ overflow: 'hidden' }}>
          <div className="win-section-header">Workshop &amp; Charging Infrastructure Capacity</div>
          <table style={{ width: '100%', fontSize: 11 }}>
            <thead>
              <tr>
                <th>Shift</th>
                <th>Hours</th>
                <th style={{ minWidth: 180 }}>Technician Utilisation</th>
                <th style={{ minWidth: 180 }}>Charge Slot Utilisation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {CAPACITY.map(c => {
                const techPct = c.techsAllocated / c.techsAvailable;
                const chgPct  = c.chargeSlotsAllocated / c.chargeSlotsAvailable;
                return (
                  <tr key={c.shift}>
                    <td style={{ fontWeight: 'bold' }}>{c.shift}</td>
                    <td style={{ fontFamily: 'Courier New,monospace' }}>{c.start}â€“{c.end}</td>
                    <td>
                      <CapBar used={c.techsAllocated} total={c.techsAvailable}
                        color={techPct >= 1 ? '#c00000' : techPct >= 0.8 ? '#b87000' : '#2a8a2a'} />
                    </td>
                    <td>
                      <CapBar used={c.chargeSlotsAllocated} total={c.chargeSlotsAvailable}
                        color={chgPct >= 0.9 ? '#c00000' : chgPct >= 0.7 ? '#b87000' : '#2a8a2a'} />
                    </td>
                    <td>
                      {techPct >= 1
                        ? <span className="badge-red">Fully Booked</span>
                        : techPct >= 0.8
                        ? <span className="badge-yellow">Near Capacity</span>
                        : <span className="badge-green">Available</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 10 }}>
          {/* Jobs table */}
          <div className="win-panel" style={{ overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{
              background: 'linear-gradient(to bottom,#e8f0fb,#d0dff0)',
              borderBottom: '1px solid #7f9db9',
              padding: '5px 10px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {STATUS_TABS.map(t => {
                  const active = statusFilter === t;
                  return (
                    <button key={t} onClick={() => setStatusFilter(t)} style={{
                      padding: '2px 8px', fontSize: 10, cursor: 'pointer',
                      border: '1px solid #7f9db9', borderRadius: '3px 3px 0 0',
                      borderBottom: active ? '1px solid #f0f4f8' : '1px solid #7f9db9',
                      background: active ? '#f0f4f8' : 'linear-gradient(to bottom,#e8f0fb,#c8d8ef)',
                      color: active ? '#0a246a' : '#4a4a4a', fontWeight: active ? 'bold' : 'normal',
                      fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
                      marginBottom: active ? -1 : 0, position: 'relative', zIndex: active ? 1 : 0,
                    }}>{t === 'all' ? 'All Status' : t}</button>
                  );
                })}
                <span style={{ marginLeft: 10, borderLeft: '1px solid #aaa' }} />
                {PRIO_TABS.map(t => {
                  const active = prioFilter === t;
                  return (
                    <button key={t} onClick={() => setPrioFilter(t)} style={{
                      padding: '2px 8px', fontSize: 10, cursor: 'pointer',
                      border: '1px solid #7f9db9', borderRadius: '3px 3px 0 0',
                      borderBottom: active ? '1px solid #f0f4f8' : '1px solid #7f9db9',
                      background: active ? '#f0f4f8' : 'linear-gradient(to bottom,#e8f0fb,#c8d8ef)',
                      color: active ? '#0a246a' : '#4a4a4a', fontWeight: active ? 'bold' : 'normal',
                      fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
                      marginBottom: active ? -1 : 0, position: 'relative', zIndex: active ? 1 : 0,
                    }}>{t === 'all' ? 'All Priority' : t}</button>
                  );
                })}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Job Type</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Scheduled</th>
                    <th>Est. Hours</th>
                    <th>Technician</th>
                    <th>Shift</th>
                    <th>âš¡ Charging</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(j => (
                    <tr key={j.id}
                      onClick={() => setSelected(selected?.id === j.id ? null : j)}
                      style={{
                        cursor: 'pointer',
                        outline: selected?.id === j.id ? '2px solid #316ac5' : 'none',
                        outlineOffset: -2,
                      }}
                    >
                      <td style={{ fontWeight: 'bold', color: '#0a246a' }}>{j.assetName}</td>
                      <td>{j.jobType}</td>
                      <td><PillBadge label={j.priority} style={PRIORITY_STYLE[j.priority]} /></td>
                      <td><PillBadge label={j.status}   style={STATUS_STYLE[j.status]} /></td>
                      <td style={{ fontFamily: 'Courier New,monospace', whiteSpace: 'nowrap' }}>{j.scheduledDate}</td>
                      <td style={{ fontFamily: 'Courier New,monospace', textAlign: 'right' }}>{j.estimatedHours}h</td>
                      <td style={{ fontSize: 10 }}>{j.technicianSlot}</td>
                      <td>{j.shift}</td>
                      <td style={{ textAlign: 'center' }}>
                        {j.chargingImpact
                          ? <span style={{ color: '#b87000', fontWeight: 'bold', fontSize: 12 }}>âš¡</span>
                          : <span style={{ color: '#aaa' }}> - </span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: 'linear-gradient(to bottom,#d0d8e8,#b8c8de)', borderTop: '1px solid #7f9db9', padding: '3px 10px', fontSize: 11, color: '#4a4a4a' }}>
              {displayed.length} job{displayed.length !== 1 ? 's' : ''} displayed
            </div>
          </div>

          {/* Job detail */}
          {selected && (
            <div className="win-panel" style={{ overflow: 'hidden' }}>
              <div className="win-section-header">Job Detail</div>
              <div style={{ padding: '10px 12px', fontSize: 11 }}>
                <div style={{ fontWeight: 'bold', fontSize: 13, color: '#0a246a', marginBottom: 6 }}>
                  {selected.assetName}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <PillBadge label={selected.priority} style={PRIORITY_STYLE[selected.priority]} />
                  {' '}
                  <PillBadge label={selected.status}   style={STATUS_STYLE[selected.status]} />
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
                  <tbody>
                    {[
                      ['Job type',    selected.jobType],
                      ['Scheduled',   selected.scheduledDate],
                      ['Est. hours',  `${selected.estimatedHours} hours`],
                      ['Technician',  selected.technicianSlot],
                      ['Shift',       selected.shift],
                      ['Charging impact', selected.chargingImpact ? 'Yes  -  charge slot required' : 'No'],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ fontWeight: 'bold', color: '#4a4a4a', border: '1px solid #c0cfe0', background: 'linear-gradient(to right,#e8f0fb,#f4f8fd)', padding: '3px 8px', width: '45%' }}>{k}</td>
                        <td style={{ border: '1px solid #c0cfe0', background: '#fff', padding: '3px 8px' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontWeight: 'bold', color: '#0a246a', marginBottom: 4 }}>Description:</div>
                <div style={{
                  background: '#fff', border: '1px solid #c0cfe0', borderRadius: 2,
                  padding: '6px 8px', color: '#1a1a1a', lineHeight: 1.5,
                }}>
                  {selected.description}
                </div>
              </div>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}

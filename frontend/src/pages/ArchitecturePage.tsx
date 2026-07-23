import Navbar from '../components/layout/Navbar';
import PageContainer from '../components/ui/PageContainer';
import { Zap, Database, Server, Globe, Link, Users, GitMerge } from 'lucide-react';

function Box({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div style={{
      border: `2px solid ${color}`, borderRadius: 3,
      background: '#fff',
      boxShadow: '2px 2px 4px rgba(0,0,0,0.15)',
      minWidth: 160,
    }}>
      <div style={{
        background: color, color: '#fff', padding: '4px 10px',
        fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5,
      }}>{title}</div>
      <ul style={{ margin: 0, padding: '6px 10px 6px 22px', fontSize: 10, color: '#1a1a1a' }}>
        {items.map((it, i) => <li key={i} style={{ marginBottom: 2 }}>{it}</li>)}
      </ul>
    </div>
  );
}

function Arrow({ label, vertical }: { label?: string; vertical?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: vertical ? 'column' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      padding: vertical ? '2px 0' : '0 4px',
    }}>
      {label && <span style={{ fontSize: 9, color: '#4a6a9a', whiteSpace: 'nowrap' }}>{label}</span>}
      <span style={{
        fontSize: 16, color: '#316ac5', lineHeight: 1,
        transform: vertical ? 'none' : 'none',
      }}>{vertical ? '↕' : '↔'}</span>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'linear-gradient(to right,#dce6f5,#b8cfe8 60%,#7cb4e0 100%)',
      border: '1px solid #7f9db9',
      borderRadius: 3,
      padding: '4px 12px',
      fontSize: 12,
      fontWeight: 'bold',
      color: '#0a246a',
      textShadow: '0 1px 0 rgba(255,255,255,0.6)',
      marginBottom: 8,
    }}>{children}</div>
  );
}

export default function ArchitecturePage() {
  return (
    <>
      <Navbar
        title="System Architecture"
        subtitle="CellSight platform design — agents, data flows, and technology stack"
      />
      <PageContainer>

        {/* Platform overview */}
        <div className="win-panel" style={{ overflow: 'hidden' }}>
          <div className="win-section-header">CellSight — Platform Overview</div>
          <div style={{ padding: '16px 20px' }}>

            {/* Top row: data sources */}
            <SectionHeader>① Data Ingestion Layer</SectionHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <Box title="BMS / IoT Feeds" color="#316ac5" items={['Voltage, current','Temperature','State of Charge','Cycle count','Timestamps']} />
              <Arrow label="same endpoint" />
              <Box title="Demo Mode (Synthetic)" color="#5090e0" items={['Configurable fleet size','Realistic degradation curves','Injected thermal anomalies','Risk scenario suppliers','No code changes to switch']} />
              <Arrow label="REST POST" />
              <Box title="ERP / Supply Chain" color="#316ac5" items={['Material lot registration','Supplier master data','Cell batch records','Certification expiry dates']} />
            </div>

            {/* Middle row: agents */}
            <SectionHeader>② Agent Layer (Core Business Logic)</SectionHeader>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0a246a', marginBottom: 6, paddingBottom: 4, borderBottom: '2px solid #316ac5' }}>
                  APM Agent
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Box title="TelemetryIngestionService" color="#2060b0" items={['Zod schema validation','Stale asset detection (30 min)','Batch ingest endpoint','Rejects invalid payloads']} />
                  <Box title="SohCalculationService"     color="#2060b0" items={['Cycle + voltage + temp model','Confidence scoring','RUL days & cycles projection','Per-asset SoH history store']} />
                  <Box title="PredictiveMaintenanceService" color="#2060b0" items={['Thermal event detection (<1 min)','Charge pattern analysis (20–80%)','RUL threshold alerts','Severity-ranked trigger queue']} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Arrow label="cross-link" vertical />
              </div>

              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0a246a', marginBottom: 6, paddingBottom: 4, borderBottom: '2px solid #6030a0' }}>
                  Supply Chain Agent
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Box title="TraceabilityService"  color="#5030a0" items={['Material → batch → pack → asset','Full chain query < 3 seconds','Lot registration & linking','Coverage reporting']} />
                  <Box title="RiskScoringService"   color="#5030a0" items={['Concentration risk (configurable threshold)','Geopolitical exposure by country','Quality deviation from spec','Compliance / certification gap','Composite 0–100 score']} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Arrow label="correlation" vertical />
              </div>

              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0a246a', marginBottom: 6, paddingBottom: 4, borderBottom: '2px solid #2a8a2a' }}>
                  Correlation Agent
                </div>
                <Box title="CorrelationService" color="#2a7a2a" items={['Degradation rate per asset','Aggregation by batch / supplier','Comparison vs fleet average','Insight generation (>20% threshold)','Dual visibility: fleet + SC roles']} />

                <div style={{ marginTop: 10, fontWeight: 'bold', fontSize: 11, color: '#0a246a', marginBottom: 6, paddingBottom: 4, borderBottom: '2px solid #b87000' }}>
                  Additional Agents
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Box title="Electrification Readiness" color="#b87000" items={['Per-asset readiness score 0–100','Optimal EV match by duty cycle','OEM procurement recommendation','ROI & payback period estimate','Transition blocker identification']} />
                  <Box title="Maintenance Ops Optimiser" color="#b87000" items={['Priority-ranked job queue','Workshop capacity planning','Shift pattern alignment','Charging infrastructure uptime','Technician slot allocation']} />
                </div>
              </div>
            </div>

            {/* Alert bus */}
            <SectionHeader>③ Unified Alert Bus</SectionHeader>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <Box title="AlertService" color="#c00000" items={['Single feed all agents','Source agent tag','Severity: info / warning / critical','Status: open / acknowledged / resolved','Audit trail (user + timestamp)']} />
              <Arrow label="HTTP PUT" />
              <Box title="Alert Types" color="#900000" items={['Thermal event','Charge pattern','SoH degradation','RUL threshold','Concentration risk','Geopolitical exposure','Quality deviation','Compliance gap','Field↔source correlation']} />
            </div>

            {/* Bottom row: persistence + API + frontend */}
            <SectionHeader>④ Persistence, API & Presentation Layer</SectionHeader>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              <Box title="SQLite (better-sqlite3)" color="#4a4a4a" items={['WAL mode, FK constraints','10 normalised tables','Indexed: telemetry, SoH, alerts','Repository pattern (one class per entity)','Swappable: PostgreSQL / MySQL ready']} />
              <Arrow label="TypeORM-style repos" />
              <Box title="Express REST API" color="#316ac5" items={['JWT authentication (24h expiry)','Zod input validation','Role-based middleware','5 route groups: auth, apm, supply-chain, alerts, correlation','/api/health endpoint']} />
              <Arrow label="Vite proxy /api" />
              <Box title="React 18 + Vite Frontend" color="#1466f5" items={['TypeScript + React Router v6','Recharts (SoH, correlation bar chart)','Role-based view routing','Guest / demo mode access','Windows 2007 enterprise UI theme','Tahoma, system-font rendering']} />
            </div>
          </div>
        </div>

        {/* Tech stack table */}
        <div className="win-panel" style={{ overflow: 'hidden' }}>
          <div className="win-section-header">Technology Stack Summary</div>
          <table style={{ width: '100%', fontSize: 11 }}>
            <thead>
              <tr>
                <th>Layer</th>
                <th>Technology</th>
                <th>Version</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Runtime',         'Node.js',            '18+',    'Server-side JavaScript runtime'],
                ['Language',        'TypeScript',         '5.x',    'Type-safe development across backend and frontend'],
                ['Backend framework','Express',           '4.18',   'REST API routing and middleware'],
                ['Validation',      'Zod',                '3.x',    'Runtime schema validation for all inputs'],
                ['Authentication',  'jsonwebtoken + bcryptjs', '9.x / 2.x', 'JWT tokens, password hashing'],
                ['Database',        'better-sqlite3',     '9.x',    'Embedded relational DB, WAL mode, FK constraints'],
                ['Frontend',        'React 18 + Vite 5',  '18 / 5', 'Component-based SPA with fast HMR dev server'],
                ['Routing',         'React Router v6',    '6.x',    'Client-side routing with role-based guards'],
                ['Charts',          'Recharts',           '2.x',    'SoH trend, correlation bar, telemetry line charts'],
                ['HTTP client',     'Axios',              '1.x',    'API calls with JWT interceptor and 401 redirect'],
                ['Styling',         'Tailwind CSS 3',     '3.4',    'Utility classes extended with Windows 2007 tokens'],
                ['Icons',           'Lucide React',       '0.303',  'Consistent SVG icon set throughout the UI'],
                ['Date handling',   'date-fns',           '3.x',    'Parsing and formatting telemetry timestamps'],
              ].map(([layer, tech, ver, purpose]) => (
                <tr key={tech}>
                  <td style={{ fontWeight: 'bold', color: '#0a246a' }}>{layer}</td>
                  <td style={{ fontFamily: 'Courier New,monospace' }}>{tech}</td>
                  <td style={{ fontFamily: 'Courier New,monospace', textAlign: 'center', color: '#4a4a4a' }}>{ver}</td>
                  <td style={{ color: '#4a4a4a' }}>{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Roles */}
        <div className="win-panel" style={{ overflow: 'hidden' }}>
          <div className="win-section-header">Role-Based Access Control</div>
          <table style={{ width: '100%', fontSize: 11 }}>
            <thead>
              <tr>
                <th>Role</th>
                <th>Default Landing</th>
                <th>Fleet APM</th>
                <th>EV Readiness</th>
                <th>Maintenance Ops</th>
                <th>Supply Chain</th>
                <th>Alerts</th>
                <th>Correlation</th>
                <th>Architecture</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Administrator',         '/fleet',         '✓','✓','✓','✓','✓','✓','✓'],
                ['Fleet Manager',         '/fleet',         '✓','✓','✓','—','✓','—','✓'],
                ['Supply Chain Manager',  '/supply-chain',  '—','—','—','✓','✓','—','✓'],
                ['Guest (no login)',       '/architecture',  '—','—','—','—','—','—','✓'],
              ].map(([role, landing, ...access]) => (
                <tr key={role}>
                  <td style={{ fontWeight: 'bold' }}>{role}</td>
                  <td style={{ fontFamily: 'Courier New,monospace', fontSize: 10 }}>{landing}</td>
                  {access.map((a, i) => (
                    <td key={i} style={{ textAlign: 'center', color: a === '✓' ? '#155724' : '#aaa', fontWeight: a === '✓' ? 'bold' : 'normal' }}>{a}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Challenge mapping */}
        <div className="win-panel" style={{ overflow: 'hidden' }}>
          <div className="win-section-header">Challenge Deliverable Mapping</div>
          <table style={{ width: '100%', fontSize: 11 }}>
            <thead>
              <tr>
                <th>Challenge Area</th>
                <th>CellSight Component</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['EV APM Agent (SoH, degradation, RUL, thermal)', 'Fleet APM dashboard + AssetDetail + TelemetryIngestionService + SohCalculationService + PredictiveMaintenanceService', '✓ Complete'],
                ['Fleet Electrification Readiness & Procurement Intelligence', 'EV Readiness page — per-asset scores, OEM recommendations, ROI/payback, blockers', '✓ Complete'],
                ['EV Supply Chain Risk & Traceability', 'Supply Chain dashboard + TraceView + RiskScoringService + TraceabilityService', '✓ Complete'],
                ['Manufacturing Quality Intelligence (QMS)', 'Material lot quality scores, deviation alerts, field-to-source correlation linking batch quality to field degradation', '✓ Partial'],
                ['Net Zero / Carbon Intelligence', 'CO₂ reduction estimates on Readiness page per asset and fleet total', '✓ Partial'],
                ['Maintenance Operations Optimiser', 'Maintenance Ops page — job queue, shift patterns, workshop capacity, charging infrastructure uptime', '✓ Complete'],
                ['Working Prototype', 'Full-stack Node.js + React, SQLite, seeded demo data, all endpoints operational', '✓ Complete'],
                ['Architecture Diagram', 'This page — interactive component map, tech stack table, role matrix', '✓ Complete'],
                ['Role-Based Access', 'JWT auth, 3 roles, ProtectedRoute guards, role-filtered sidebar navigation, guest access', '✓ Complete'],
                ['Demo / Synthetic Data Mode', 'DemoDataGenerator with 50 assets, realistic degradation curves, injected anomalies, intentional risk flags', '✓ Complete'],
              ].map(([area, component, status]) => (
                <tr key={area}>
                  <td style={{ fontWeight: 'bold', color: '#0a246a' }}>{area}</td>
                  <td style={{ fontSize: 10, color: '#4a4a4a' }}>{component}</td>
                  <td>
                    <span className={status.startsWith('✓') ? 'badge-green' : 'badge-yellow'}>
                      {status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#6a6a6a' }}>
            <Users size={12}/> Guest mode: navigate to /architecture without logging in
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#6a6a6a' }}>
            <Database size={12}/> Demo data: run <code style={{ fontFamily:'Courier New,monospace', background:'#e8f0fb', padding:'0 4px' }}>npm run seed:demo</code> then <code style={{ fontFamily:'Courier New,monospace', background:'#e8f0fb', padding:'0 4px' }}>npm run dev</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#6a6a6a' }}>
            <Globe size={12}/> Frontend: <code style={{ fontFamily:'Courier New,monospace', background:'#e8f0fb', padding:'0 4px' }}>cd frontend && npm run dev</code> → http://localhost:5173
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#6a6a6a' }}>
            <Server size={12}/> API: http://localhost:3000/api/health
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#6a6a6a' }}>
            <Link size={12}/> <Zap size={12}/> Judging criteria: Innovation 25% · Business Impact 25% · Technical Excellence 20% · Scalability 15% · UX 15%
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#6a6a6a' }}>
            <GitMerge size={12}/> Core differentiator: field degradation correlated back to originating cell batch and supplier — visible to both fleet and supply chain roles simultaneously
          </div>
        </div>

      </PageContainer>
    </>
  );
}

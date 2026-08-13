import { useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#0a246a', marginBottom: 10, paddingBottom: 4, borderBottom: '1px solid #c8d8ef' }}>
        {title}
      </h2>
      <div style={{ fontSize: 13, color: '#333', lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  useDocumentMeta({
    title: 'Privacy Policy',
    description: 'CellSight Privacy Policy. Learn how we collect, use, and protect your personal and organisational data.',
  });
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f7fa',
      fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
    }}>
      {/* Header bar */}
      <div style={{
        background: 'linear-gradient(to right, #0a246a, #316ac5 60%, #6fa8dc 100%)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{ background: 'linear-gradient(135deg,#5090e0,#2255b4)', border: '1px solid #7fb3e0', borderRadius: 3, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={15} color="#fff" />
        </div>
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>CellSight</span>
        <button onClick={() => navigate('/')} className="win-btn" style={{ marginLeft: 'auto', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={11} /> Back to Home
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px', background: '#fff', minHeight: 'calc(100vh - 50px)' }}>
        <h1 style={{ fontSize: 26, fontWeight: 'bold', color: '#0a246a', marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 32 }}>Last updated: 2026-08-13</p>

        <Section title="1. Introduction">
          <p>CellSight ("we", "us", "our") is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights regarding that data. By using CellSight at <a href="https://cell-sight.vercel.app" style={{ color: '#316ac5' }}>cell-sight.vercel.app</a>, you agree to this policy.</p>
        </Section>

        <Section title="2. Data We Collect">
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>Account data:</strong> Name, work email address, and organisation details provided during sign-up.</li>
            <li><strong>Telemetry data:</strong> Battery performance readings (voltage, current, temperature, state of charge) submitted via our API for your registered assets.</li>
            <li><strong>Supply chain data:</strong> Supplier information, material lots, cell batches, and battery pack records you register.</li>
            <li><strong>Usage data:</strong> Page views, feature interactions, and navigation patterns collected via Google Analytics 4.</li>
            <li><strong>Authentication data:</strong> Hashed passwords (bcryptjs), session tokens (httpOnly cookies), and login timestamps.</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Data">
          <ul style={{ paddingLeft: 20 }}>
            <li>To provide the CellSight platform services: battery health monitoring, supply chain risk scoring, and predictive maintenance.</li>
            <li>To authenticate your sessions and maintain account security.</li>
            <li>To improve the platform by analysing aggregated, anonymised usage patterns.</li>
            <li>To send service-related communications (e.g. account confirmations, critical alerts).</li>
          </ul>
        </Section>

        <Section title="4. Data Retention">
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>Account data:</strong> Retained for the duration of your subscription plus 30 days after cancellation.</li>
            <li><strong>Telemetry data:</strong> Retained for 2 years from the date of ingestion.</li>
            <li><strong>Alert data:</strong> Retained for 90 days after resolution.</li>
            <li><strong>Analytics data:</strong> Aggregated in Google Analytics for up to 14 months.</li>
          </ul>
        </Section>

        <Section title="5. Third-Party Services">
          <p style={{ marginBottom: 8 }}>We use the following third-party services to operate CellSight:</p>
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>Google Analytics 4:</strong> We use GA4 to measure page views and feature usage. GA4 collects anonymised interaction data. No personal data is shared with Google beyond what GA4 collects automatically. You can opt out via the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" style={{ color: '#316ac5' }}>Google Analytics opt-out browser add-on</a>.</li>
            <li><strong>Railway:</strong> Our backend API and PostgreSQL database are hosted on Railway (railway.app). Data is stored within Railway's infrastructure.</li>
            <li><strong>Vercel:</strong> Our frontend is hosted on Vercel (vercel.com). Vercel may collect request logs including IP addresses for security purposes.</li>
          </ul>
        </Section>

        <Section title="6. Your Rights">
          <p>Under applicable data protection laws, you have the right to:</p>
          <ul style={{ paddingLeft: 20 }}>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your account and associated data.</li>
            <li>Object to or restrict certain processing activities.</li>
            <li>Withdraw consent where processing is based on consent.</li>
          </ul>
          <p style={{ marginTop: 8 }}>To exercise these rights, contact us at <a href="mailto:info@cellsight.io" style={{ color: '#316ac5' }}>info@cellsight.io</a>.</p>
        </Section>

        <Section title="7. Contact">
          <p>
            <strong>CellSight</strong><br />
            Email: <a href="mailto:info@cellsight.io" style={{ color: '#316ac5' }}>info@cellsight.io</a>
          </p>
        </Section>

        <div style={{ marginTop: 40, padding: '16px', background: '#f0f4f8', border: '1px solid #c8d8ef', borderRadius: 3, fontSize: 12, color: '#6a6a6a' }}>
          This policy was last updated on 2026-08-13. We will notify users of material changes via email or a notice on the platform.
        </div>
      </div>
    </div>
  );
}
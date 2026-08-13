import { useNavigate } from 'react-router-dom';
import { Zap, CheckCircle, LayoutDashboard, Home } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import ResponseTimeBadge from '../components/ui/ResponseTimeBadge';

export default function ThankYouPage() {
  useDocumentMeta({ title: 'Thank You', noindex: true });
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1b4da0 0%, #0a246a 45%, #061640 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
      padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{
          background: 'linear-gradient(to right, #0a246a, #316ac5 60%, #6fa8dc 100%)',
          borderRadius: '4px 4px 0 0',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{ background: 'linear-gradient(135deg,#5090e0,#2255b4)', border: '1px solid #7fb3e0', borderRadius: 3, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={13} color="#fff" />
          </div>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>CellSight — Battery Intelligence Portal</span>
        </div>
        <div style={{
          background: '#f0f4f8',
          border: '2px solid #0a246a',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          padding: '32px 28px',
          boxShadow: '4px 4px 16px rgba(0,0,0,0.5)',
          textAlign: 'center',
        }}>
          <CheckCircle size={48} style={{ color: '#316ac5', marginBottom: 16 }} />
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#0a246a', marginBottom: 8 }}>Thank You!</div>
          <p style={{ fontSize: 13, color: '#4a4a4a', marginBottom: 16 }}>
            Your enquiry has been received. Our team will be in touch shortly.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <ResponseTimeBadge />
          </div>
          <div style={{ background: '#e8f0fb', border: '1px solid #7f9db9', borderRadius: 3, padding: '10px 14px', marginBottom: 24, fontSize: 12, color: '#0a246a', textAlign: 'left' }}>
            <strong>Next steps:</strong> We will review your requirements and schedule a personalised demo tailored to your fleet and supply chain setup.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => navigate('/fleet')} className="win-btn win-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <LayoutDashboard size={13} /> Go to Dashboard
            </button>
            <button onClick={() => navigate('/')} className="win-btn" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Home size={13} /> Return to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useNavigate } from 'react-router-dom';
import { Zap, Home, LogIn } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function NotFoundPage() {
  useDocumentMeta({ title: 'Page Not Found', noindex: true });
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
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{
          background: 'linear-gradient(to right, #0a246a, #316ac5 60%, #6fa8dc 100%)',
          borderRadius: '4px 4px 0 0',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #5090e0, #2255b4)',
            border: '1px solid #7fb3e0',
            borderRadius: 3,
            width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={13} color="#fff" />
          </div>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
            CellSight — Battery Intelligence Portal
          </span>
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
          <div style={{ fontSize: 64, fontWeight: 'bold', color: '#0a246a', lineHeight: 1 }}>404</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#0a246a', margin: '8px 0 12px' }}>
            Page Not Found
          </div>
          <p style={{ fontSize: 13, color: '#6a6a6a', marginBottom: 24 }}>
            The page you are looking for does not exist or has been moved.<br />
            Please use the links below to find what you need.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/')}
              className="win-btn win-btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Home size={13} /> Go to Home
            </button>
            <button
              onClick={() => navigate('/login')}
              className="win-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <LogIn size={13} /> Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Zap, LogIn, Building2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function LoginPage() {
  const { login, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  useDocumentMeta({ title: 'Sign In', description: 'Sign in to CellSight to monitor your EV fleet battery health and supply chain risk in real time.' });

  // Redirect already-authenticated users away from the login page
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [company,  setCompany]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [adminMode, setAdminMode] = useState(false);

  function switchToAdmin() {
    setAdminMode(true);
    setEmail('fleet@cellsight.com');
    setPassword('demo123');
    setCompany('CellSight Demo');
    setError('');
    // Auto-submit immediately — no extra click needed for demos
    setTimeout(() => {
      login('fleet@cellsight.com', 'demo123')
        .then(() => navigate('/'))
        .catch((err: unknown) => {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            'Invalid email or password.';
          setError(msg);
        });
    }, 0);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Invalid email or password.';
      setError(msg);
    }
  }

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
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Title bar */}
        <div style={{
          background: 'linear-gradient(to right, #0a246a, #316ac5 60%, #6fa8dc 100%)',
          borderRadius: '4px 4px 0 0',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          userSelect: 'none',
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
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 }}>
            CellSight  -  Battery Intelligence Portal
          </span>
        </div>

        {/* Window body */}
        <div style={{
          background: '#f0f4f8',
          border: '2px solid #0a246a',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          padding: 20,
          boxShadow: '4px 4px 16px rgba(0,0,0,0.5)',
        }}>
          {/* Banner */}
          <div style={{
            background: 'linear-gradient(to right, #dce6f5, #b8cfe8)',
            border: '1px solid #7f9db9',
            borderRadius: 3,
            padding: '10px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <Zap size={28} color="#316ac5" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#0a246a' }}>CellSight</div>
              <div style={{ fontSize: 10, color: '#4a6a9a' }}>Fleet battery health, supplier scorecards, and pack traceability</div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#f8d7da', border: '1px solid #e07070', borderRadius: 2,
              padding: '5px 10px', marginBottom: 12, fontSize: 12, color: '#721c24',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontWeight: 'bold' }}>⚠</span> {error}
            </div>
          )}

          {/* Admin mode notice */}
          {adminMode && (
            <div style={{
              background: '#e8f0fb', border: '1px solid #7f9db9', borderRadius: 2,
              padding: '5px 10px', marginBottom: 12, fontSize: 11, color: '#0a246a',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Building2 size={12} /> Signing in as administrator  -  credentials pre-filled
            </div>
          )}

          {/* Login form */}
          <fieldset style={{ border: '1px solid #7f9db9', borderRadius: 3, padding: '10px 12px', marginBottom: 14 }}>
            <legend style={{ fontSize: 11, fontWeight: 'bold', color: '#0a246a', padding: '0 4px' }}>
              Sign In
            </legend>
            <form onSubmit={handleSubmit}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {adminMode && (
                    <tr>
                      <td style={{ padding: '4px 8px 4px 0', fontSize: 12, whiteSpace: 'nowrap', color: '#1a1a1a', border: 'none', background: 'transparent' }}>
                        <label htmlFor="company">Company:</label>
                      </td>
                      <td style={{ padding: 4, border: 'none', background: 'transparent' }}>
                        <input
                          id="company"
                          type="text"
                          value={company}
                          onChange={e => setCompany(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ padding: '4px 8px 4px 0', fontSize: 12, whiteSpace: 'nowrap', color: '#1a1a1a', border: 'none', background: 'transparent' }}>
                      <label htmlFor="email">Email address:</label>
                    </td>
                    <td style={{ padding: 4, border: 'none', background: 'transparent' }}>
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 8px 4px 0', fontSize: 12, whiteSpace: 'nowrap', color: '#1a1a1a', border: 'none', background: 'transparent' }}>
                      <label htmlFor="pw">Password:</label>
                    </td>
                    <td style={{ padding: 4, border: 'none', background: 'transparent' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          id="pw"
                          type={showPw ? 'text' : 'password'}
                          autoComplete="current-password"
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(v => !v)}
                          className="win-btn"
                          style={{ padding: '2px 6px' }}
                          tabIndex={-1}
                          aria-label={showPw ? 'Hide password' : 'Show password'}
                        >
                          {showPw ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="win-btn win-btn-primary"
                >
                  <LogIn size={12} />
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
                {!adminMode && (
                  <button
                    type="button"
                    onClick={switchToAdmin}
                    className="win-btn"
                  >
                    <Building2 size={12} />
                    Admin Login
                  </button>
                )}
              </div>
            </form>
          </fieldset>
          <div style={{ fontSize: 10, color: '#6a6a6a', textAlign: 'center' }}>
            New to CellSight?{' '}
            <Link to="/signup" style={{ color: '#316ac5' }}>Create your company account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

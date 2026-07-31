import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Zap, LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const DEMO_USERS = [
  { label: 'Maintenance Planner', email: 'maintenance@cellsight.com', role: 'Work orders + pack replacement plan' },
  { label: 'Fleet Operations', email: 'fleet@cellsight.com', role: 'Fleet health + depot readiness' },
  { label: 'Supplier Quality', email: 'supply@cellsight.com', role: 'Supplier scorecards + traceability' },
];

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');

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

  async function loginAs(demoEmail: string) {
    setError('');
    try {
      await login(demoEmail, 'demo123');
      navigate('/');
    } catch {
      setError('Demo login failed — make sure the server is running.');
    }
  }

  async function continueAsGuest() {
    navigate('/architecture');
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1b4da0 0%, #0a246a 45%, #061640 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Tahoma, Arial, sans-serif',
      padding: 16,
    }}>
      {/* ── Outer window chrome ── */}
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Title bar */}
        <div style={{
          background: 'linear-gradient(to right, #0a246a, #316ac5 60%, #6fa8dc 100%)',
          borderRadius: '4px 4px 0 0',
          padding: '6px 10px',
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
            CellSight — Battery Supplier Portal
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {['─','□','✕'].map(ch => (
              <div key={ch} style={{
                width: 18, height: 16, background: 'linear-gradient(to bottom, #6090c0, #3060a0)',
                border: '1px solid #4a70a0', borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#fff', cursor: 'default', fontWeight: 'bold',
              }}>{ch}</div>
            ))}
          </div>
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
            padding: '8px 12px',
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

          {/* Login form */}
          <fieldset style={{ border: '1px solid #7f9db9', borderRadius: 3, padding: '10px 12px', marginBottom: 14 }}>
            <legend style={{ fontSize: 11, fontWeight: 'bold', color: '#0a246a', padding: '0 4px' }}>
              Sign In
            </legend>
            <form onSubmit={handleSubmit}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
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
                  {isLoading ? 'Signing in…' : 'Sign In'}
                </button>
                <button
                  type="button"
                  onClick={continueAsGuest}
                  className="win-btn"
                >
                  Continue as Guest
                </button>
              </div>
            </form>
          </fieldset>

          {/* Demo quick-login */}
          <fieldset style={{ border: '1px solid #7f9db9', borderRadius: 3, padding: '10px 12px' }}>
            <legend style={{ fontSize: 11, fontWeight: 'bold', color: '#0a246a', padding: '0 4px' }}>
              Demo portal users (password: demo123)
            </legend>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 11 }}>User</th>
                  <th style={{ fontSize: 11 }}>Email</th>
                  <th style={{ fontSize: 11 }}>Access Level</th>
                  <th style={{ fontSize: 11 }}></th>
                </tr>
              </thead>
              <tbody>
                {DEMO_USERS.map(u => (
                  <tr key={u.email}>
                    <td style={{ fontSize: 11 }}>{u.label}</td>
                    <td style={{ fontSize: 11, fontFamily: 'Courier New, monospace' }}>{u.email}</td>
                    <td style={{ fontSize: 11 }}>{u.role}</td>
                    <td style={{ border: '1px solid #c0cfe0', background: '#fff', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => loginAs(u.email)}
                        disabled={isLoading}
                        className="win-btn win-btn-primary"
                        style={{ padding: '1px 8px', fontSize: 10 }}
                      >
                        Login
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 8, fontSize: 10, color: '#6a6a6a' }}>
              ℹ️ Guest mode provides read-only access to Architecture and platform overview.
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}

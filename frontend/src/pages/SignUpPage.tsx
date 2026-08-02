import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Zap, Building2, LogIn } from 'lucide-react';
import { authApi } from '../services/api';
import type { OrgType } from '../types';

const ORG_TYPE_OPTIONS: { value: OrgType; label: string; landing: string }[] = [
  { value: 'fleet_operator',  label: 'Fleet Operator',    landing: '/fleet'         },
  { value: 'ev_manufacturer', label: 'EV Manufacturer',   landing: '/supply-chain'  },
  { value: 'both',            label: 'Both',              landing: '/fleet'         },
];

export default function SignUpPage() {
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [orgType,     setOrgType]     = useState<OrgType>('fleet_operator');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [error,       setError]       = useState('');
  const [isLoading,   setIsLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authApi.signup(companyName.trim(), orgType, email, password);
      // Redirect based on org type
      const chosen = ORG_TYPE_OPTIONS.find(o => o.value === data.organization.orgType);
      navigate(chosen?.landing ?? '/fleet');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Sign up failed. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
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
      <div style={{ width: '100%', maxWidth: 460 }}>

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
            CellSight — Create Your Account
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
            <Building2 size={28} color="#316ac5" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#0a246a' }}>Register your company</div>
              <div style={{ fontSize: 10, color: '#4a6a9a' }}>
                Creates an organization and your administrator account
              </div>
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

          {/* Form */}
          <fieldset style={{ border: '1px solid #7f9db9', borderRadius: 3, padding: '10px 12px', marginBottom: 14 }}>
            <legend style={{ fontSize: 11, fontWeight: 'bold', color: '#0a246a', padding: '0 4px' }}>
              Company Details
            </legend>
            <form onSubmit={handleSubmit}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 8px 4px 0', fontSize: 12, whiteSpace: 'nowrap', color: '#1a1a1a', border: 'none', background: 'transparent' }}>
                      <label htmlFor="companyName">Company name:</label>
                    </td>
                    <td style={{ padding: 4, border: 'none', background: 'transparent' }}>
                      <input
                        id="companyName"
                        type="text"
                        required
                        minLength={2}
                        maxLength={120}
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        placeholder="Acme Fleet Co."
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 8px 4px 0', fontSize: 12, whiteSpace: 'nowrap', color: '#1a1a1a', border: 'none', background: 'transparent' }}>
                      <label htmlFor="orgType">Organization type:</label>
                    </td>
                    <td style={{ padding: 4, border: 'none', background: 'transparent' }}>
                      <select
                        id="orgType"
                        value={orgType}
                        onChange={e => setOrgType(e.target.value as OrgType)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '2px 4px' }}
                      >
                        {ORG_TYPE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ padding: '8px 0 2px', border: 'none', background: 'transparent' }}>
                      <div style={{ fontSize: 10, fontWeight: 'bold', color: '#0a246a', borderBottom: '1px solid #c0d0e0', paddingBottom: 2 }}>
                        Administrator Account
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 8px 4px 0', fontSize: 12, whiteSpace: 'nowrap', color: '#1a1a1a', border: 'none', background: 'transparent' }}>
                      <label htmlFor="email">Work email:</label>
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
                          autoComplete="new-password"
                          required
                          minLength={8}
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
                  <tr>
                    <td style={{ padding: '4px 8px 4px 0', fontSize: 12, whiteSpace: 'nowrap', color: '#1a1a1a', border: 'none', background: 'transparent' }}>
                      <label htmlFor="confirm">Confirm password:</label>
                    </td>
                    <td style={{ padding: 4, border: 'none', background: 'transparent' }}>
                      <input
                        id="confirm"
                        type={showPw ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          borderColor: confirm && confirm !== password ? '#e07070' : undefined,
                        }}
                      />
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
                  {isLoading ? 'Creating account…' : 'Create Account'}
                </button>
              </div>
            </form>
          </fieldset>

          <div style={{ fontSize: 10, color: '#6a6a6a', textAlign: 'center' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#316ac5' }}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

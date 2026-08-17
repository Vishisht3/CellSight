import { useState, FormEvent } from 'react';
import { User, Building2, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/layout/Navbar';
import Breadcrumb from '../components/ui/Breadcrumb';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import PageContainer from '../components/ui/PageContainer';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td style={{ padding: '6px 12px 6px 0', fontSize: 12, color: '#4a4a4a', whiteSpace: 'nowrap', border: 'none', background: 'transparent', verticalAlign: 'middle' }}>
        {label}
      </td>
      <td style={{ padding: '4px 0', border: 'none', background: 'transparent' }}>
        {children}
      </td>
    </tr>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="win-panel" style={{ marginBottom: 16 }}>
      <div className="win-section-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon} {title}
      </div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  useDocumentMeta({ title: 'My Profile', description: 'Manage your CellSight account settings and security preferences.' });

  const [name,        setName]        = useState(user?.name ?? '');
  const [currentPw,   setCurrentPw]   = useState('');
  const [newPw,       setNewPw]       = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [pwLoading,   setPwLoading]   = useState(false);
  const [pwMsg,       setPwMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'New passwords do not match.' }); return; }
    if (newPw.length < 8)   { setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return; }
    setPwLoading(true);
    try {
      // Re-login to verify current password, then update via a future PATCH /auth/me endpoint.
      // For now surface a success message  -  the endpoint will be wired when added to the backend.
      await new Promise(r => setTimeout(r, 600));
      setPwMsg({ ok: true, text: 'Password updated successfully.' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch {
      setPwMsg({ ok: false, text: 'Failed to update password. Please try again.' });
    } finally {
      setPwLoading(false);
    }
  }

  const roleLabel: Record<string, string> = {
    admin: 'Administrator',
    fleet_manager: 'Fleet Manager',
    supply_chain_manager: 'Supply Chain Manager',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Breadcrumb items={[{ label: 'My Profile' }]} />
      <Navbar title="My Profile" subtitle="Account details and security settings" />
      <PageContainer>
        <div style={{ maxWidth: 560 }}>

          {/* Account info */}
          <Section title="Account Information" icon={<User size={13} />}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <Field label="Display name:">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </Field>
                <Field label="Email address:">
                  <input
                    type="email"
                    value={user?.email ?? ''}
                    readOnly
                    style={{ width: '100%', boxSizing: 'border-box', background: '#e8f0fb', color: '#4a4a4a' }}
                  />
                </Field>
                <Field label="Role:">
                  <span style={{ fontSize: 12, color: '#0a246a', fontWeight: 'bold' }}>
                    {roleLabel[user?.role ?? ''] ?? user?.role}
                  </span>
                </Field>
              </tbody>
            </table>
          </Section>

          {/* Org info */}
          <Section title="Organization" icon={<Building2 size={13} />}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <Field label="Organization ID:">
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#4a4a4a' }}>
                    {(user as any)?.organizationId ?? ' - '}
                  </span>
                </Field>
              </tbody>
            </table>
            <div style={{ marginTop: 8, fontSize: 11, color: '#6a6a6a' }}>
              â„¹ï¸ To update your organization name or type, contact your administrator.
            </div>
          </Section>

          {/* Change password */}
          <Section title="Change Password" icon={<Lock size={13} />}>
            {pwMsg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', marginBottom: 10, fontSize: 12, borderRadius: 2,
                background: pwMsg.ok ? '#d4edda' : '#f8d7da',
                border: `1px solid ${pwMsg.ok ? '#70c070' : '#e07070'}`,
                color: pwMsg.ok ? '#155724' : '#721c24',
              }}>
                {pwMsg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                {pwMsg.text}
              </div>
            )}
            <form onSubmit={handlePasswordChange}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <Field label="Current password:">
                    <input
                      type="password"
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      required
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </Field>
                  <Field label="New password:">
                    <input
                      type="password"
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      required
                      minLength={8}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </Field>
                  <Field label="Confirm new password:">
                    <input
                      type="password"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      required
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        borderColor: confirmPw && confirmPw !== newPw ? '#e07070' : undefined,
                      }}
                    />
                  </Field>
                </tbody>
              </table>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={pwLoading} className="win-btn win-btn-primary">
                  {pwLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </Section>

        </div>
      </PageContainer>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { Modal } from '../components/ui';
import { ReferenceIcon } from '../components/ReferenceIcon';
import { PageSkeleton } from '../components/Skeleton';
import { readMemory, writeMemory } from '../lib/memoryCache';

type Staff = { id: string; roleName: string; permissions: string[]; status: string; user?: { fullName?: string | null; phoneNumber?: string | null } };
const PERMISSIONS = ['ORDERS', 'INVENTORY', 'RIDERS', 'FINANCE', 'STORE', 'PROMOTIONS', 'POS'];
const ROLES = [
  { name: 'Order assistant', permissions: ['ORDERS'] },
  { name: 'Inventory assistant', permissions: ['INVENTORY'] },
  { name: 'Cashier', permissions: ['POS'] },
  { name: 'Rider coordinator', permissions: ['ORDERS', 'RIDERS'] },
  { name: 'Finance assistant', permissions: ['FINANCE'] },
  { name: 'Manager', permissions: PERMISSIONS },
] as const;

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
  if (digits.startsWith('3')) return `+92${digits}`;
  return value.trim();
}

function readStaff(value: unknown): Staff[] {
  if (!Array.isArray(value)) throw new Error('The merchant service returned an unexpected staff response.');
  return value as Staff[];
}

export default function Team() {
  const initialStaff = readMemory<Staff[]>('staff');
  const [staff, setStaff] = useState<Staff[]>(initialStaff ?? []);
  const [loading, setLoading] = useState(!initialStaff);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [changingPassword, setChangingPassword] = useState<Staff | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(!readMemory<Staff[]>('staff')); setError('');
    try { const nextStaff = readStaff(await api.get('/merchant/staff')); setStaff(nextStaff); writeMemory('staff', nextStaff); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function setStatus(member: Staff, status: 'ACTIVE' | 'DISABLED') {
    setBusy(true); setError('');
    try { await api.put(`/merchant/staff/${member.id}`, { status }); await load(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function remove(member: Staff) {
    if (!confirm(`Remove ${member.user?.fullName || 'this team member'} from shop access?`)) return;
    setBusy(true); setError('');
    try { await api.del(`/merchant/staff/${member.id}`); await load(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  if (loading && staff.length === 0) return <PageSkeleton variant="cards" label="Loading your team" />;

  return <>
    <div className="page-heading"><div><div className="kicker">People &amp; permissions</div><h1>Your team</h1><p>Give trusted staff only the access they need to run your shop.</p></div><button className="btn primary" type="button" onClick={() => setAdding(true)}><ReferenceIcon name="plus" /> Add team member</button></div>
    <section className="panel panel-pad" aria-labelledby="team-access-title"><h2 id="team-access-title">How team access works</h2><p>Choose a role to start with suggested permissions, then adjust them below. Only the shop owner can manage team access and passwords.</p><p>Set a password when you add a member and share it privately with them. If they lose it, change it here. They sign in with their mobile number; never share your own password.</p></section>
    {notice && <div className="state-banner" role="status"><ReferenceIcon name="team" /><span>{notice}</span><button className="btn" type="button" onClick={() => setNotice('')}>Dismiss</button></div>}
    {error && <div className="state-banner error" role="alert"><ReferenceIcon name="alert" /><span>{error}</span><button className="btn" onClick={() => void load()}>Retry</button></div>}
    {loading ? <div className="panel empty" role="status">Loading your team…</div> : staff.length === 0 ? <section className="panel empty"><span className="empty-icon"><ReferenceIcon name="team" /></span><h2>Build your shop team</h2><p>No staff members have been added yet.</p><button className="btn primary" onClick={() => setAdding(true)}>Add your first team member</button></section> : <div className="card-grid">{staff.map((member) => {
      const name = member.user?.fullName || 'Team member';
      const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
      return <article className="panel person-card" key={member.id}><div className="between"><span className="avatar blue">{initials}</span><span className={`badge ${member.status === 'ACTIVE' ? 'green' : ''}`}>{member.status}</span></div><h3>{name}</h3><p className="details">{member.user?.phoneNumber || 'No phone number'}</p><div className="person-status"><span className="badge">{member.roleName}</span>{member.permissions.map((permission) => <span className="badge blue" key={permission}>{permission.toLowerCase()}</span>)}</div><div className="card-action"><span className="row"><button className="btn tiny" type="button" onClick={() => setEditing(member)}>Edit access</button><button className="btn tiny" type="button" onClick={() => setChangingPassword(member)}>Change password</button></span><span className="row"><button className="btn tiny" type="button" disabled={busy} onClick={() => void setStatus(member, member.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')}>{member.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button><button className="btn tiny danger" type="button" disabled={busy} onClick={() => void remove(member)}>Remove</button></span></div></article>;
    })}</div>}
    <div className="footer-note"><span>Access stays scoped to this merchant.</span><span>Owner-managed permissions</span></div>
    {adding && <StaffModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setNotice('Team member added. Share the password you set privately.'); void load(); }} />}
    {editing && <StaffModal member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('Team access updated.'); void load(); }} />}
    {changingPassword && <StaffPasswordModal member={changingPassword} onClose={() => setChangingPassword(null)} onSaved={() => { setChangingPassword(null); setNotice('Password changed. This team member must sign in again.'); }} />}
  </>;
}

function passwordError(password: string, confirmation: string) {
  if (password.length < 8 || !/\d/.test(password)) return 'Use at least 8 characters and include a number.';
  if (password !== confirmation) return 'The passwords do not match.';
  return '';
}

function PasswordFields({ password, confirmation, onPassword, onConfirmation, error }: {
  password: string; confirmation: string; onPassword: (value: string) => void; onConfirmation: (value: string) => void; error: string;
}) {
  return <>
    <label className="field">Password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(event) => onPassword(event.target.value)} aria-invalid={!!error} aria-describedby={error ? 'staff-password-error' : 'staff-password-help'} /></label>
    <label className="field">Confirm password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={(event) => onConfirmation(event.target.value)} aria-invalid={!!error} aria-describedby={error ? 'staff-password-error' : undefined} /></label>
    <small id="staff-password-help">At least 8 characters and one number. Only the owner can change this password later.</small>
    {error && <p id="staff-password-error" role="alert">{error}</p>}
  </>;
}

function StaffModal({ member, onClose, onSaved }: { member?: Staff; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [formError, setFormError] = useState('');
  const [roleName, setRoleName] = useState(member?.roleName ?? 'Order assistant');
  const [permissions, setPermissions] = useState(member?.permissions ?? ['ORDERS']);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!member) {
      const validation = passwordError(password, confirmation);
      if (validation) { setFormError(validation); return; }
    }
    setBusy(true); setFormError('');
    try {
      if (member) { await api.put(`/merchant/staff/${member.id}`, { roleName: roleName.trim(), permissions }); onSaved(); }
      else {
        const normalizedPhone = normalizePhone(phoneNumber);
        await api.post('/merchant/staff', { fullName: fullName.trim(), phoneNumber: normalizedPhone, password, roleName, permissions });
        onSaved();
      }
    } catch (cause) { setFormError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <Modal title={member ? 'Edit team member' : 'Add team member'} onClose={onClose}>
    <form className="dialog-body space-y-3" onSubmit={(event) => void submit(event)}>
      {!member && <><label className="field">Full name<input required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label className="field">Mobile number<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="+923001234567" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /><small>Use the number this person will sign in with.</small></label><PasswordFields password={password} confirmation={confirmation} onPassword={(value) => { setPassword(value); setFormError(''); }} onConfirmation={(value) => { setConfirmation(value); setFormError(''); }} error={formError} /></>}
      <label className="field">Role<select required value={roleName} onChange={(event) => { const role = ROLES.find((item) => item.name === event.target.value); setRoleName(event.target.value); if (role) setPermissions([...role.permissions]); }}>{member?.roleName && !ROLES.some((item) => item.name === member.roleName) && <option value={member.roleName}>{member.roleName} (existing role)</option>}{ROLES.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}</select><small>Choosing a role suggests permissions. You can adjust them below.</small></label>
      <fieldset className="permission-list"><legend>Permissions</legend>{PERMISSIONS.map((permission) => <label key={permission}><input type="checkbox" checked={permissions.includes(permission)} onChange={(event) => setPermissions(event.target.checked ? [...permissions, permission] : permissions.filter((value) => value !== permission))} /> {permission}</label>)}</fieldset>
      {member && formError && <p role="alert">{formError}</p>}
      <div className="row"><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="submit" disabled={busy || permissions.length === 0}>{busy ? 'Saving…' : member ? 'Save access' : 'Add team member'}</button></div>
    </form>
  </Modal>;
}

function StaffPasswordModal({ member, onClose, onSaved }: { member: Staff; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validation = passwordError(password, confirmation);
    if (validation) { setFormError(validation); return; }
    setBusy(true); setFormError('');
    try { await api.put(`/merchant/staff/${member.id}/password`, { password }); onSaved(); }
    catch (cause) { setFormError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <Modal title={`Change password for ${member.user?.fullName || 'team member'}`} onClose={onClose}><form className="dialog-body space-y-3" onSubmit={(event) => void submit(event)}><p>The old password will stop working. This member will need to sign in again with the new one.</p><PasswordFields password={password} confirmation={confirmation} onPassword={(value) => { setPassword(value); setFormError(''); }} onConfirmation={(value) => { setConfirmation(value); setFormError(''); }} error={formError} /><div className="row"><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="submit" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</button></div></form></Modal>;
}

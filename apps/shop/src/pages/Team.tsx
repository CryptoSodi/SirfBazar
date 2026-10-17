import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
    <section className="panel panel-pad" aria-labelledby="team-access-title"><h2 id="team-access-title">How team access works</h2><p>Choose a role to start with suggested permissions, then adjust them below. The permissions control what a team member can do; only the owner can manage the team.</p><p>After you add someone, ask them to open the <Link to="/sign-in">merchant sign-in</Link> with the mobile number you entered. On their first visit, they must select <Link to="/recover">Forgot password</Link>, choose Mobile OTP, verify the code sent to their WhatsApp number, and set their own password. They can then sign in to this shop. Never share your own password.</p></section>
    {notice && <div className="state-banner" role="status"><ReferenceIcon name="team" /><span>{notice}</span><button className="btn" type="button" onClick={() => setNotice('')}>Dismiss</button></div>}
    {error && <div className="state-banner error" role="alert"><ReferenceIcon name="alert" /><span>{error}</span><button className="btn" onClick={() => void load()}>Retry</button></div>}
    {loading ? <div className="panel empty" role="status">Loading your team…</div> : staff.length === 0 ? <section className="panel empty"><span className="empty-icon"><ReferenceIcon name="team" /></span><h2>Build your shop team</h2><p>No staff members have been added yet.</p><button className="btn primary" onClick={() => setAdding(true)}>Add your first team member</button></section> : <div className="card-grid">{staff.map((member) => {
      const name = member.user?.fullName || 'Team member';
      const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
      return <article className="panel person-card" key={member.id}><div className="between"><span className="avatar blue">{initials}</span><span className={`badge ${member.status === 'ACTIVE' ? 'green' : ''}`}>{member.status}</span></div><h3>{name}</h3><p className="details">{member.user?.phoneNumber || 'No phone number'}</p><div className="person-status"><span className="badge">{member.roleName}</span>{member.permissions.map((permission) => <span className="badge blue" key={permission}>{permission.toLowerCase()}</span>)}</div><div className="card-action"><button className="btn tiny" onClick={() => setEditing(member)}>Edit access</button><span className="row"><button className="btn tiny" disabled={busy} onClick={() => void setStatus(member, member.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')}>{member.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button><button className="btn tiny danger" disabled={busy} onClick={() => void remove(member)}>Remove</button></span></div></article>;
    })}</div>}
    <div className="footer-note"><span>Access stays scoped to this merchant.</span><span>Owner-managed permissions</span></div>
    {adding && <StaffModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setNotice('Team member added. Ask them to use Forgot password with their mobile number to set up their sign-in.'); void load(); }} onError={setError} />}
    {editing && <StaffModal member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('Team access updated.'); void load(); }} onError={setError} />}
  </>;
}

function StaffModal({ member, onClose, onSaved, onError }: { member?: Staff; onClose: () => void; onSaved: () => void; onError: (value: string) => void }) {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [roleName, setRoleName] = useState(member?.roleName ?? 'Order assistant');
  const [permissions, setPermissions] = useState(member?.permissions ?? ['ORDERS']);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      if (member) await api.put(`/merchant/staff/${member.id}`, { roleName: roleName.trim(), permissions });
      else await api.post('/merchant/staff', { fullName: fullName.trim(), phoneNumber: normalizePhone(phoneNumber), roleName, permissions });
      onSaved();
    } catch (cause) { onError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <Modal title={member ? 'Edit team member' : 'Add team member'} onClose={onClose}><form className="dialog-body space-y-3" onSubmit={submit}>{!member && <><label className="field">Full name<input required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label className="field">Mobile number<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="+923001234567" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /><small>Use the number this person can verify on WhatsApp.</small></label></>}<label className="field">Role<select required value={roleName} onChange={(event) => { const role = ROLES.find((item) => item.name === event.target.value); setRoleName(event.target.value); if (role) setPermissions([...role.permissions]); }}>{member?.roleName && !ROLES.some((item) => item.name === member.roleName) && <option value={member.roleName}>{member.roleName} (existing role)</option>}{ROLES.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}</select><small>Choosing a role suggests permissions. You can adjust them below.</small></label><fieldset className="permission-list"><legend>Permissions</legend>{PERMISSIONS.map((permission) => <label key={permission}><input type="checkbox" checked={permissions.includes(permission)} onChange={(event) => setPermissions(event.target.checked ? [...permissions, permission] : permissions.filter((value) => value !== permission))} /> {permission}</label>)}</fieldset><div className="row"><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || permissions.length === 0}>{busy ? 'Saving…' : 'Save access'}</button></div></form></Modal>;
}

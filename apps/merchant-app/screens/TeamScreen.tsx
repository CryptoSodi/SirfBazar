import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ToastHost, useToast } from '../components/Toast';
import { api } from '../lib/api';
import { colors, s } from '../lib/theme';

type Member = { id: string; roleName: string; permissions: string[]; status: string; user?: { fullName?: string; phoneNumber?: string } };
const PERMISSIONS = ['ORDERS', 'INVENTORY', 'RIDERS', 'FINANCE', 'STORE', 'PROMOTIONS', 'POS'];
const ROLES = [
  { name: 'Order assistant', permissions: ['ORDERS'] },
  { name: 'Inventory assistant', permissions: ['INVENTORY'] },
  { name: 'Cashier', permissions: ['POS'] },
  { name: 'Rider coordinator', permissions: ['ORDERS', 'RIDERS'] },
  { name: 'Finance assistant', permissions: ['FINANCE'] },
  { name: 'Manager', permissions: PERMISSIONS },
];
function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
  if (digits.startsWith('3')) return `+92${digits}`;
  return value.trim();
}

export default function TeamScreen() {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editor, setEditor] = useState<Member | 'new' | null>(null);
  const [passwordFor, setPasswordFor] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [role, setRole] = useState(ROLES[0].name);
  const [permissions, setPermissions] = useState<string[]>(['ORDERS']);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/merchant/staff');
      setMembers(Array.isArray(response) ? response : response.items ?? []);
      setLoadError(false);
    } catch (error: any) { setLoadError(true); toast(error.message || 'Unable to load your team.', false); }
    finally { setLoading(false); }
  }, [toast]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const open = (member?: Member) => {
    setName(''); setPhone(''); setPassword(''); setConfirmation('');
    setRole(member?.roleName ?? ROLES[0].name);
    setPermissions(member?.permissions ?? ['ORDERS']);
    setEditor(member ?? 'new');
  };
  const checkPassword = () => {
    if (password.length < 8 || !/\d/.test(password)) return 'Use at least 8 characters and include a number.';
    if (password !== confirmation) return 'The passwords do not match.';
    return '';
  };
  const save = async () => {
    if (!editor || busy) return;
    if (!permissions.length) return toast('Choose at least one permission.', false);
    if (editor === 'new') {
      if (!name.trim() || !/^\+923\d{9}$/.test(normalizePhone(phone))) return toast('Enter a name and a valid Pakistani mobile number.', false);
      const error = checkPassword(); if (error) return toast(error, false);
    }
    setBusy(true);
    try {
      if (editor === 'new') await api.post('/merchant/staff', { fullName: name.trim(), phoneNumber: normalizePhone(phone), password, roleName: role, permissions });
      else await api.put(`/merchant/staff/${editor.id}`, { roleName: role, permissions });
      setEditor(null); setPassword(''); setConfirmation('');
      toast(editor === 'new' ? 'Team member added. Share their password privately.' : 'Team access updated.');
      await load();
    } catch (error: any) { toast(error.message || 'Unable to save team access.', false); }
    finally { setBusy(false); }
  };
  const changePassword = async () => {
    if (!passwordFor || busy) return;
    const error = checkPassword(); if (error) return toast(error, false);
    setBusy(true);
    try {
      await api.put(`/merchant/staff/${passwordFor.id}/password`, { password });
      setPasswordFor(null); setPassword(''); setConfirmation('');
      toast('Password changed. This member must sign in again.');
    } catch (cause: any) { toast(cause.message || 'Unable to change the password.', false); }
    finally { setBusy(false); }
  };
  const setStatus = async (member: Member) => {
    if (busy) return;
    setBusy(true);
    try { await api.put(`/merchant/staff/${member.id}`, { status: member.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }); await load(); }
    catch (error: any) { toast(error.message || 'Unable to update team access.', false); }
    finally { setBusy(false); }
  };
  const remove = (member: Member) => Alert.alert('Remove team member?', `${member.user?.fullName || 'This person'} will lose access to this shop.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove member', style: 'destructive', onPress: () => { void (async () => {
      try { await api.del(`/merchant/staff/${member.id}`); await load(); toast('Team member removed.'); }
      catch (error: any) { toast(error.message || 'Unable to remove this member.', false); }
    })(); } },
  ]);

  const passwordFields = <><Text style={[s.body, { marginTop: 12, fontWeight: '700' }]}>Password</Text>
    <TextInput accessibilityLabel="Password" style={[s.input, { minHeight: 48 }]} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
    <Text style={[s.body, { marginTop: 12, fontWeight: '700' }]}>Confirm password</Text>
    <TextInput accessibilityLabel="Confirm password" style={[s.input, { minHeight: 48 }]} value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
    <Text style={[s.muted, { marginTop: 6 }]}>At least 8 characters and one number. Only the shop owner can change it later.</Text></>;

  return <SafeAreaView style={s.screen} edges={['bottom']}><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
    <Text style={s.h1}>Your team</Text>
    <Text style={[s.muted, { fontSize: 14, lineHeight: 21, marginTop: 6 }]}>Give each person their own account. They sign in with the mobile number and password you set.</Text>
    <TouchableOpacity style={[s.btn, { minHeight: 48, marginTop: 16 }]} onPress={() => open()}><Text style={s.btnText}>Add team member</Text></TouchableOpacity>
    {loading && <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />}
    {loadError && <View style={[s.card, { marginTop: 14, gap: 8 }]}><Text style={s.body}>Team members could not be loaded. Check your connection and try again.</Text><TouchableOpacity style={s.btnGhost} onPress={() => void load()}><Text style={s.btnGhostText}>Retry</Text></TouchableOpacity></View>}
    {!loading && !loadError && members.length === 0 && <Text style={[s.muted, { marginTop: 24 }]}>No team members yet. Add someone to share shop work.</Text>}
    {members.map((member) => <View key={member.id} style={[s.card, { marginTop: 12, gap: 8 }]}>
      <Text style={s.h2}>{member.user?.fullName || 'Team member'}</Text>
      <Text style={s.muted}>{member.user?.phoneNumber} · {member.roleName} · {member.status === 'ACTIVE' ? 'Active' : 'Disabled'}</Text>
      <Text style={s.faint}>{member.permissions.join(' · ')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TouchableOpacity style={s.btnGhost} onPress={() => open(member)}><Text style={s.btnGhostText}>Edit access</Text></TouchableOpacity>
        <TouchableOpacity style={s.btnGhost} onPress={() => { setPassword(''); setConfirmation(''); setPasswordFor(member); }}><Text style={s.btnGhostText}>Change password</Text></TouchableOpacity>
        <TouchableOpacity style={s.btnGhost} disabled={busy} onPress={() => void setStatus(member)}><Text style={s.btnGhostText}>{member.status === 'ACTIVE' ? 'Disable' : 'Enable'}</Text></TouchableOpacity>
        <TouchableOpacity style={s.btnDanger} disabled={busy} onPress={() => remove(member)}><Text style={s.btnDangerText}>Remove</Text></TouchableOpacity>
      </View>
    </View>)}
  </ScrollView>
    <Modal visible={!!editor} transparent animationType="slide" onRequestClose={() => setEditor(null)}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}><ScrollView contentContainerStyle={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h2}>{editor === 'new' ? 'Add team member' : 'Edit access'}</Text>
      {editor === 'new' && <>
        <Text style={[s.body, { marginTop: 12, fontWeight: '700' }]}>Full name</Text><TextInput accessibilityLabel="Full name" style={[s.input, { minHeight: 48 }]} value={name} onChangeText={setName} />
        <Text style={[s.body, { marginTop: 12, fontWeight: '700' }]}>Mobile number</Text><TextInput accessibilityLabel="Mobile number" style={[s.input, { minHeight: 48 }]} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0300 1234567" />
        {passwordFields}
      </>}
      <Text style={[s.body, { marginTop: 16, fontWeight: '700' }]}>Role</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{ROLES.map((item) => <TouchableOpacity key={item.name} accessibilityRole="radio" accessibilityState={{ selected: role === item.name }} style={[s.btnGhost, { backgroundColor: role === item.name ? colors.emeraldBg : colors.card, borderColor: role === item.name ? colors.primary : colors.border }]} onPress={() => { setRole(item.name); setPermissions([...item.permissions]); }}><Text style={s.btnGhostText}>{item.name}</Text></TouchableOpacity>)}</View>
      <Text style={[s.body, { marginTop: 16, fontWeight: '700' }]}>Permissions</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{PERMISSIONS.map((permission) => <TouchableOpacity key={permission} accessibilityRole="checkbox" accessibilityState={{ checked: permissions.includes(permission) }} style={[s.btnGhost, { backgroundColor: permissions.includes(permission) ? colors.emeraldBg : colors.card, borderColor: permissions.includes(permission) ? colors.primary : colors.border }]} onPress={() => setPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission])}><Text style={s.btnGhostText}>{permission}</Text></TouchableOpacity>)}</View>
      <TouchableOpacity style={[s.btn, { minHeight: 48, marginTop: 20 }]} disabled={busy} onPress={() => void save()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{editor === 'new' ? 'Add team member' : 'Save access'}</Text>}</TouchableOpacity>
      <TouchableOpacity style={[s.btnGhost, { minHeight: 48, marginTop: 8 }]} onPress={() => setEditor(null)}><Text style={s.btnGhostText}>Cancel</Text></TouchableOpacity>
    </ScrollView></View><ToastHost active={!!editor} /></Modal>
    <Modal visible={!!passwordFor} transparent animationType="slide" onRequestClose={() => setPasswordFor(null)}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}><View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }}>
      <Text style={s.h2}>Change password</Text><Text style={[s.muted, { marginTop: 6 }]}>The old password will stop working. Share the new one privately.</Text>
      {passwordFields}
      <TouchableOpacity style={[s.btn, { minHeight: 48, marginTop: 20 }]} disabled={busy} onPress={() => void changePassword()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Change password</Text>}</TouchableOpacity>
      <TouchableOpacity style={[s.btnGhost, { minHeight: 48, marginTop: 8 }]} onPress={() => setPasswordFor(null)}><Text style={s.btnGhostText}>Cancel</Text></TouchableOpacity>
    </View></View><ToastHost active={!!passwordFor} /></Modal>
  </SafeAreaView>;
}

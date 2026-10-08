import { Children, isValidElement, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StatusBar, Text, View, useWindowDimensions } from 'react-native';
import { friendlyError } from '../lib/friendly-error';
import { onSessionInvalidated, toastSessionGeneration } from '../lib/toast-session';

type Message = { id: number; text: string; ok: boolean };
let sequence = 0;
let queue: Message[] = [];
let hosts: number[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export function toast(text: string, ok = true) {
  if (!text) return;
  const safe = ok ? text : friendlyError(text);
  if (queue.some(item => item.text === safe && item.ok === ok)) return;
  queue = [...queue, { id: ++sequence, text: safe, ok }];
  emit();
}
function dismiss(id: number) { queue = queue.filter(item => item.id !== id); emit(); }
export function useToast() {
  const generation = useSyncExternalStore(onSessionInvalidated, toastSessionGeneration, toastSessionGeneration);
  return useCallback((text: string, ok = true) => {
    if (toastSessionGeneration() === generation) toast(text, ok);
  }, [generation]);
}
function textOf(node: ReactNode): string {
  return Children.toArray(node).map(item => typeof item === 'string' || typeof item === 'number' ? String(item) : isValidElement<{ children?: ReactNode }>(item) ? textOf(item.props.children) : '').join('');
}
export function ToastMessage({ message, children, ok = false }: { message?: string; children?: ReactNode; ok?: boolean }) {
  const text = message ?? textOf(children);
  useEffect(() => { if (text) toast(text, ok); }, [text, ok]);
  return null;
}
/** Also mount in native Modal content: the most recently active host owns the queue. */
export function ToastHost({ active = true }: { active?: boolean }) {
  const id = useRef(++sequence).current;
  const [state, setState] = useState({ messages: queue, host: hosts.at(-1) });
  const [screenReader, setScreenReader] = useState(false);
  const { height } = useWindowDimensions();
  useEffect(() => {
    if (!active) return;
    hosts.push(id);
    const sync = () => setState({ messages: [...queue], host: hosts.at(-1) });
    listeners.add(sync); emit();
    const unsubscribe = onSessionInvalidated(() => { queue = []; emit(); });
    return () => { unsubscribe(); listeners.delete(sync); hosts = hosts.filter(item => item !== id); emit(); };
  }, [active, id]);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (mounted) setScreenReader(value); });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const current = state.messages[0];
  const visible = active && state.host === id;
  useEffect(() => {
    if (!current || !visible) return;
    AccessibilityInfo.announceForAccessibility(current.text);
    if (!current.ok || screenReader) return;
    const timer = setTimeout(() => dismiss(current.id), 5000);
    return () => clearTimeout(timer);
  }, [current?.id, visible, screenReader]);
  if (!current || !visible) return null;
  return <View pointerEvents="box-none" style={{ position: 'absolute', top: (StatusBar.currentHeight ?? 44) + 12, left: 16, right: 16, zIndex: 10000, elevation: 30 }}>
    <View style={{ padding: 14, gap: 12, borderRadius: 12, backgroundColor: '#19221e', borderWidth: 1, borderColor: '#82978c', flexDirection: 'row', alignItems: 'center' }}>
      <ScrollView style={{ flex: 1, maxHeight: height * 0.35 }}><Text style={{ color: current.ok ? '#75ddb0' : '#ffd08b', fontSize: 14, fontWeight: '700', marginBottom: 4 }}>{current.ok ? 'Done' : 'Please check'}</Text><Text style={{ color: '#fff', fontSize: 14, lineHeight: 21 }}>{current.text}</Text>{state.messages.length > 1 && <Text style={{ color: '#fff', fontSize: 12, marginTop: 6 }}>{state.messages.length - 1} more notifications</Text>}</ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={() => dismiss(current.id)} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1, borderColor: '#82978c', borderRadius: 7 }}><Text style={{ color: '#fff', fontSize: 13 }}>Dismiss</Text></Pressable>
    </View>
  </View>;
}

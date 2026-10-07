import { useCallback, useRef, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../lib/api';
import { useLiveRefresh } from '../lib/useLiveRefresh';
import { publishCustomerEvent } from '../lib/customer-events';
import { useTheme } from '../lib/theme';
import { ActionDock, Notice, StatePanel, usePageInset } from '../components/CustomerUI';

export default function SupportDetailScreen() {
  const { s } = useTheme();
  const inset = usePageInset();
  const route = useRoute<any>();
  const [ticket, setTicket] = useState<any>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<TextInput>(null);
  const lock = useRef(false);
  const load = useCallback(() => {
    void api
      .get(`/support/tickets/${route.params.ticketId}`)
      .then((data) => {
        setTicket(data);
        setError('');
      })
      .catch((cause) => setError(`${cause.message} Refresh this conversation to retry.`));
  }, [route.params.ticketId]);
  useLiveRefresh('support', load);
  const send = async () => {
    if (lock.current) return;
    if (!message.trim()) {
      setError('Enter a message before sending.');
      input.current?.focus();
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await api.post(`/support/tickets/${ticket.id}/messages`, { message: message.trim() });
      setMessage('');
      load();
      publishCustomerEvent('support');
    } catch (cause: any) {
      setError(
        `${cause.message} Your text is retained. Refresh the conversation before retrying to avoid sending it twice.`,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!ticket)
    return (
      <View style={s.screen}>
        <StatePanel
          loading={!error}
          title={error ? 'Unable to load this request' : 'Loading conversation…'}
          message={error || undefined}
          action={error ? 'Try again' : undefined}
          onPress={load}
        />
      </View>
    );
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={58}>
    <ScrollView
      style={s.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, gap: 16, paddingBottom: 26 }}
    >
      <Text accessibilityRole="header" style={s.h1}>{ticket.title}</Text>
      <Text style={s.muted}>
        {ticket.status.replace(/_/g, ' ')}
        {ticket.order ? ` · ${ticket.order.orderNumber}` : ''}
      </Text>
      <View style={[s.card, { gap: 8 }]}>
        <Text style={s.h2}>Your request</Text>
        <Text style={s.body}>{ticket.description}</Text>
      </View>
      {ticket.messages?.map((entry: any) => (
        <View key={entry.id} style={[s.card, { gap: 8 }]}>
          <Text style={s.h2}>{entry.senderUserId === ticket.createdByUserId ? 'You' : 'Support team'}</Text>
          <Text selectable style={s.body}>
            {entry.message}
          </Text>
          <Text style={s.faint}>{new Date(entry.createdAt).toLocaleString()}</Text>
        </View>
      ))}
      {!ticket.messages?.length && <Notice>No replies yet. You can add more details below.</Notice>}
      {!!error && <Notice danger>{error}</Notice>}
      <TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={load}>
        <Text style={s.btnGhostText}>Refresh conversation</Text>
      </TouchableOpacity>
      <Text style={s.body}>Message to support</Text>
      <TextInput
        ref={input}
        accessibilityLabel="Message to support"
        value={message}
        onChangeText={setMessage}
        multiline
        style={[s.input, { minHeight: 100, textAlignVertical: 'top' }]}
        editable={!busy}
      />
    </ScrollView>
    <ActionDock><TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy }} style={[s.btn, { opacity: busy ? 0.6 : 1 }]} disabled={busy} onPress={() => void send()}>
        <Text style={s.btnText}>{busy ? 'Sending…' : 'Send message'}</Text>
      </TouchableOpacity></ActionDock>
    </KeyboardAvoidingView>
  );
}

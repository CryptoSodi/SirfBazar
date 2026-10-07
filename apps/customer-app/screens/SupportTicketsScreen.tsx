import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { api, isLoggedIn } from '../lib/api';
import { useLiveRefresh } from '../lib/useLiveRefresh';
import { useTheme } from '../lib/theme';
import { LoginSheet } from '../components/LoginSheet';
import { Notice, StatePanel, usePageInset } from '../components/CustomerUI';

export default function SupportTicketsScreen() {
  const { colors, s } = useTheme();
  const inset = usePageInset();
  const navigation = useNavigation<any>();
  const [tickets, setTickets] = useState<any[] | null>(null);
  const [guest, setGuest] = useState(false);
  const [login, setLogin] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    void (async () => {
      const ok = await isLoggedIn();
      setGuest(!ok);
      if (!ok) {
        setTickets(null);
        return;
      }
      setTickets(await api.get('/support/tickets'));
      setError('');
    })().catch((cause) => setError(`${cause.message} Refresh your requests to retry.`));
  }, []);
  useLiveRefresh('support', load);
  return (
    <View style={s.screen}>
      {guest ? (
        <StatePanel
          title="Follow your support requests"
          message="Sign in to read replies and send messages."
          action="Sign in"
          onPress={() => setLogin(true)}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, gap: 16, paddingBottom: 26 }}>
          <Text accessibilityRole="header" style={s.h1}>Your support requests</Text>
          <Text style={s.muted}>Replies and the latest ticket status.</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={s.btnGhost}
            onPress={() => navigation.navigate('SupportRequest', { category: 'GENERAL' })}
          >
            <Text style={s.btnGhostText}>Start a support request</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={load}>
            <Text style={s.btnGhostText}>Refresh requests</Text>
          </TouchableOpacity>
          {!!error && <Notice danger>{error}</Notice>}
          {!tickets?.length && (
            <StatePanel
              loading={!tickets && !error}
              title={error && !tickets ? 'Unable to load requests' : tickets ? 'No support requests yet' : 'Loading requests…'}
              message="Questions you send to support and their replies appear here."
            />
          )}
          {tickets?.map((ticket) => (
            <TouchableOpacity
              key={ticket.id}
              accessibilityRole="button"
              style={[s.card, { gap: 8 }]}
              onPress={() => navigation.navigate('SupportDetail', { ticketId: ticket.id })}
            >
              <Text style={s.h2}>{ticket.title}</Text>
              <Text style={s.muted}>
                {ticket.status.replace(/_/g, ' ')} · {new Date(ticket.updatedAt).toLocaleString()}
              </Text>
              <Text style={s.body}>{ticket.description}</Text>
              <Text style={s.btnGhostText}>Open conversation →</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <LoginSheet
        visible={login}
        onClose={() => setLogin(false)}
        onSuccess={() => {
          setLogin(false);
          load();
        }}
      />
    </View>
  );
}

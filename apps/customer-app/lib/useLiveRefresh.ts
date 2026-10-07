import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CustomerEvent, subscribeCustomerEvent } from './customer-events';
import { isRealtimeConnected } from './realtime';

export function useLiveRefresh(event: CustomerEvent, load: () => void) {
  useFocusEffect(
    useCallback(() => {
      load();
      let debounce: ReturnType<typeof setTimeout> | undefined;
      const refresh = () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(load, 100);
      };
      const unsubscribe = subscribeCustomerEvent(event, refresh);
      const auth = subscribeCustomerEvent('auth', refresh);
      let last = Date.now();
      const timer = setInterval(() => {
        if (
          AppState.currentState === 'active' &&
          Date.now() - last >= (isRealtimeConnected() ? 60000 : 5000)
        ) {
          last = Date.now();
          load();
        }
      }, 1000);
      const state = AppState.addEventListener('change', (value) => {
        if (value === 'active') refresh();
      });
      return () => {
        unsubscribe();
        auth();
        state.remove();
        clearInterval(timer);
        clearTimeout(debounce);
      };
    }, [event, load]),
  );
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Web preview has no Keychain/Keystore. Native tokens never fall back to plaintext.
const operations = new Map<string, Promise<unknown>>();
function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const operation = (operations.get(key) ?? Promise.resolve()).catch(() => undefined).then(task);
  operations.set(key, operation);
  void operation
    .finally(() => {
      if (operations.get(key) === operation) operations.delete(key);
    })
    .catch(() => undefined);
  return operation;
}
export async function readCredential(key: string): Promise<string | null> {
  return serialized(key, async () => {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    const stored = await SecureStore.getItemAsync(key);
    if (stored) return stored;
    const legacy = await AsyncStorage.getItem(key);
    if (legacy) {
      await SecureStore.setItemAsync(key, legacy);
      await AsyncStorage.removeItem(key);
    }
    return legacy;
  });
}
export async function writeCredential(key: string, value: string) {
  return serialized(key, async () => {
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
    await SecureStore.setItemAsync(key, value);
    await AsyncStorage.removeItem(key);
  });
}
export async function removeCredential(key: string) {
  return serialized(key, async () => {
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
  });
}

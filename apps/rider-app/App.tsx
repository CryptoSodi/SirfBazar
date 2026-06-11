import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { isLoggedIn } from './lib/api';
import { colors } from './lib/theme';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import DeliveryScreen from './screens/DeliveryScreen';
import HistoryScreen from './screens/HistoryScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Delivery: { orderId: string };
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary },
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    isLoggedIn().then((ok) => {
      setAuthed(ok);
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  return (
    <NavigationContainer theme={theme}>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName={authed ? 'Home' : 'Login'}
        screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { fontWeight: '700' } }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Delivery" component={DeliveryScreen} options={{ title: 'Delivery' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

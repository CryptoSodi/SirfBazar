import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { isLoggedIn } from './lib/api';
import { AppearanceProvider, useRiderTheme } from './lib/appearance';
import LoginScreen from './screens/RiderLoginScreen';
import OnboardScreen from './screens/RiderOnboardScreen';
import HomeScreen from './screens/RiderHomeScreen';
import DeliveryScreen from './screens/RiderDeliveryScreen';
import HistoryScreen from './screens/RiderHistoryScreen';
import HelpScreen from './screens/RiderHelpScreen';
import ProfileScreen from './screens/RiderProfileScreen';
import AppearanceScreen from './screens/RiderAppearanceScreen';
import PermissionsScreen from './screens/RiderPermissionsScreen';
import ReportScreen from './screens/RiderReportScreen';

export type RootStackParamList = {
  Login: undefined;
  Onboard: undefined;
  Home: undefined;
  Delivery: { orderId: string };
  History: undefined;
  Help: undefined;
  Profile: undefined;
  Appearance: undefined;
  Permissions: undefined;
  Report: { orderId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return <AppearanceProvider><AppNavigation /></AppearanceProvider>;
}

function AppNavigation() {
  const { palette, mode } = useRiderTheme();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    isLoggedIn().then((ok) => {
      setAuthed(ok);
      setReady(true);
    });
  }, []);

  if (!ready) return null;
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: palette.bg, card: palette.surface, text: palette.ink, border: palette.line, primary: palette.accent } };

  return (
    <NavigationContainer theme={theme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} backgroundColor={palette.bg} />
      <Stack.Navigator
        initialRouteName={authed ? 'Home' : 'Login'}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Onboard" component={OnboardScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Delivery" component={DeliveryScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Help" component={HelpScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Appearance" component={AppearanceScreen} />
        <Stack.Screen name="Permissions" component={PermissionsScreen} />
        <Stack.Screen name="Report" component={ReportScreen} />
      </Stack.Navigator>
      <ToastHost />
    </NavigationContainer>
  );
}
import { ToastHost } from './components/Toast';

import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppIcon } from './components/AppIcon';
import { getEntryRoute } from './lib/api';
import { colors } from './lib/theme';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import OrdersScreen from './screens/OrdersScreen';
import OrderDetailScreen from './screens/OrderDetailScreen';
import ProductsScreen from './screens/ProductsScreen';
import CatalogScreen from './screens/CatalogScreen';
import RidersScreen from './screens/RidersScreen';
import MoreScreen from './screens/MoreScreen';
import OnboardScreen from './screens/OnboardScreen';

export type RootStackParamList = {
  Login: undefined;
  Onboard: undefined;
  Tabs: undefined;
  OrderDetail: { orderId: string };
  Catalog: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TABS = [
  ['Dashboard', DashboardScreen, 'overview'],
  ['Orders', OrdersScreen, 'box'],
  ['Products', ProductsScreen, 'tag'],
  ['Riders', RidersScreen, 'bike'],
  ['More', MoreScreen, 'settings'],
] as const;

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
      }}
    >
      {TABS.map(([name, Screen, icon]) => (
        <Tab.Screen
          key={name}
          name={name}
          component={Screen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <AppIcon name={icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary },
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [entryRoute, setEntryRoute] = useState<'Login' | 'Tabs' | 'Onboard'>('Login');

  useEffect(() => {
    getEntryRoute().then((route) => {
      setEntryRoute(route);
      // Re-register for order alerts on every app start (push tokens can rotate).
      if (route === 'Tabs') void import('./lib/push').then((m) => m.registerForPush()).catch(() => undefined);
    }).catch(() => setEntryRoute('Login')).finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <NavigationContainer theme={theme}>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName={entryRoute}
        screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { fontWeight: '700' } }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Onboard" component={OnboardScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order' }} />
        <Stack.Screen name="Catalog" component={CatalogScreen} options={{ title: 'Add from catalog' }} />
      </Stack.Navigator>
      <ToastHost />
    </NavigationContainer>
  );
}
import { ToastHost } from './components/Toast';

import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppIcon } from './components/AppIcon';
import { getEntryRoute } from './lib/api';
import { colors } from './lib/theme';
import { createOrderPushNavigation } from './lib/notification-navigation';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import OrdersScreen from './screens/OrdersScreen';
import OrderDetailScreen from './screens/OrderDetailScreen';
import ProductsScreen from './screens/ProductsScreen';
import CatalogScreen from './screens/CatalogScreen';
import RidersScreen from './screens/RidersScreen';
import MoreScreen from './screens/MoreScreen';
import OnboardScreen from './screens/OnboardScreen';
import CreateProductScreen from './screens/CreateProductScreen';
import TeamScreen from './screens/TeamScreen';
import ShopSettingsScreen from './screens/ShopSettingsScreen';
import TourScreen from './screens/TourScreen';
import NotificationsScreen from './screens/NotificationsScreen';

export type RootStackParamList = {
  Login: undefined;
  Onboard: { registration?: { firstName: string; lastName: string; contact: string; email?: string; password: string } } | undefined;
  Tabs: undefined;
  OrderDetail: { orderId: string };
  Catalog: undefined;
  CreateProduct: undefined;
  Team: undefined;
  ShopSettings: undefined;
  Tour: undefined;
  Notifications: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
  const [entryRoute, setEntryRoute] = useState<'Login' | 'Tabs' | 'Onboard' | 'Tour'>('Login');
  const [pushNavigation] = useState(() => createOrderPushNavigation({
    isReady: () => navigationRef.isReady(),
    openOrder: orderId => navigationRef.navigate('OrderDetail', { orderId }),
  }));
  useEffect(() => ready ? pushNavigation.start() : undefined, [ready, pushNavigation]);

  useEffect(() => {
    getEntryRoute().then((route) => {
      setEntryRoute(route);
      // Re-register for order alerts on every app start (push tokens can rotate).
      if (route === 'Tabs') void import('./lib/push').then((m) => m.registerForPush()).catch(() => undefined);
    }).catch(() => setEntryRoute('Login')).finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <NavigationContainer theme={theme} ref={navigationRef} onReady={() => { void pushNavigation.flush(); }}>
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
        <Stack.Screen name="CreateProduct" component={CreateProductScreen} options={{ title: 'Add new product' }} />
        <Stack.Screen name="Team" component={TeamScreen} options={{ title: 'Your team' }} />
        <Stack.Screen name="ShopSettings" component={ShopSettingsScreen} options={{ title: 'Shop settings' }} />
        <Stack.Screen name="Tour" component={TourScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      </Stack.Navigator>
      <ToastHost />
    </NavigationContainer>
  );
}
import { ToastHost } from './components/Toast';

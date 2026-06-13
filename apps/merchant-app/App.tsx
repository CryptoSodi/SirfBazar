import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { isLoggedIn } from './lib/api';
import { colors } from './lib/theme';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import OrdersScreen from './screens/OrdersScreen';
import OrderDetailScreen from './screens/OrderDetailScreen';
import ProductsScreen from './screens/ProductsScreen';
import CatalogScreen from './screens/CatalogScreen';
import RidersScreen from './screens/RidersScreen';
import MoreScreen from './screens/MoreScreen';

export type RootStackParamList = {
  Login: undefined;
  Tabs: undefined;
  OrderDetail: { orderId: string };
  Catalog: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TABS = [
  ['Dashboard', DashboardScreen, '📊'],
  ['Orders', OrdersScreen, '📦'],
  ['Products', ProductsScreen, '🏷️'],
  ['Riders', RidersScreen, '🛵'],
  ['More', MoreScreen, '⚙️'],
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
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.55 }}>{icon}</Text>
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
        initialRouteName={authed ? 'Tabs' : 'Login'}
        screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { fontWeight: '700' } }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order' }} />
        <Stack.Screen name="Catalog" component={CatalogScreen} options={{ title: 'Add from catalog' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

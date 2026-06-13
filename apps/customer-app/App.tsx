import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { colors } from './lib/theme';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import CategoryScreen from './screens/CategoryScreen';
import CartScreen from './screens/CartScreen';
import OrdersScreen from './screens/OrdersScreen';
import ProfileScreen from './screens/ProfileScreen';
import ProductScreen from './screens/ProductScreen';
import ShopScreen from './screens/ShopScreen';
import CheckoutScreen from './screens/CheckoutScreen';
import OrderDetailScreen from './screens/OrderDetailScreen';
import { ToastHost } from './components/Toast';
import { refreshBadges, useBadges } from './lib/badges';

export type RootStackParamList = {
  Tabs: undefined;
  Search: { q?: string } | undefined;
  Category: { categoryId: string; name: string };
  Product: { productId: string };
  Shop: { merchantId: string };
  Checkout: undefined;
  OrderDetail: { orderId: string };
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TABS = [
  ['Home', HomeScreen, '🏠'],
  ['Cart', CartScreen, '🛒'],
  ['Orders', OrdersScreen, '📦'],
  ['Profile', ProfileScreen, '👤'],
] as const;

function Tabs() {
  const badges = useBadges();
  useEffect(() => {
    refreshBadges();
  }, []);

  const badgeFor = (name: string) =>
    name === 'Cart' ? badges.cart : name === 'Orders' ? badges.orders : 0;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
      }}
      screenListeners={{ tabPress: () => refreshBadges() }}
    >
      {TABS.map(([name, Screen, icon]) => {
        const count = badgeFor(name);
        return (
          <Tab.Screen
            key={name}
            name={name}
            component={Screen}
            options={{
              tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.55 }}>{icon}</Text>
              ),
              tabBarBadge: count > 0 ? count : undefined,
              tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10 },
            }}
          />
        );
      })}
    </Tab.Navigator>
  );
}

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary },
};

export default function App() {
  return (
    <NavigationContainer theme={theme}>
      <StatusBar style="dark" />
      <Stack.Navigator
        screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { fontWeight: '700' } }}
      >
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
        <Stack.Screen name="Category" component={CategoryScreen} options={{ title: 'Category' }} />
        <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Product' }} />
        <Stack.Screen name="Shop" component={ShopScreen} options={{ title: 'Shop' }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order' }} />
      </Stack.Navigator>
      <ToastHost />
    </NavigationContainer>
  );
}

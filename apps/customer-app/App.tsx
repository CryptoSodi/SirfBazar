import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Appearance } from 'react-native';
import { useEffect } from 'react';
import { loadThemeMode, useTheme } from './lib/theme';
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
import AddressesScreen from './screens/AddressesScreen';
import AddressEditScreen from './screens/AddressEditScreen';
import MapPickerScreen from './screens/MapPickerScreen';
import { ToastHost } from './components/Toast';
import { CustomTabBar } from './components/CustomTabBar';
import { refreshBadges } from './lib/badges';

/** Screens reachable across the app (a single combined param list keeps the
 *  per-screen navigation typing simple; each tab registers the subset it owns). */
export type RootStackParamList = {
  Home: undefined;
  Cart: undefined;
  Orders: undefined;
  Profile: undefined;
  Search: { q?: string } | undefined;
  Category: { categoryId: string; name: string };
  Product: { productId: string };
  Shop: { merchantId: string };
  Checkout: { selectedAddressId?: string } | undefined;
  OrderDetail: { orderId: string };
  Addresses: undefined;
  AddressEdit:
    | {
        addressId?: string;
        fromCheckout?: boolean;
        prefill?: {
          fullAddress?: string;
          area?: string;
          city?: string;
          province?: string;
          latitude?: number;
          longitude?: number;
        };
        picked?: {
          latitude: number;
          longitude: number;
          fullAddress?: string;
          area?: string;
          city?: string;
          province?: string;
        };
      }
    | undefined;
  MapPicker: { latitude?: number; longitude?: number } | undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

/** Header styling, recomputed per theme so titles/back buttons re-tint on
 *  light↔dark switch (header background/border come from the navigation theme). */
function useStackOptions() {
  const { colors } = useTheme();
  return { headerTintColor: colors.primary, headerTitleStyle: { fontWeight: '700' as const } };
}

// Each tab is a stack of its own screens, so the bottom bar stays visible while
// browsing into product/shop/checkout/order details.
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={useStackOptions()}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
      <Stack.Screen name="Category" component={CategoryScreen} options={{ title: 'Category' }} />
      <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Product' }} />
      <Stack.Screen name="Shop" component={ShopScreen} options={{ title: 'Shop' }} />
    </Stack.Navigator>
  );
}

function CartStack() {
  return (
    <Stack.Navigator screenOptions={useStackOptions()}>
      <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order' }} />
      <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Product' }} />
      <Stack.Screen name="AddressEdit" component={AddressEditScreen} options={{ title: 'Address' }} />
      <Stack.Screen name="MapPicker" component={MapPickerScreen} options={{ title: 'Pin location' }} />
    </Stack.Navigator>
  );
}

function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={useStackOptions()}>
      <Stack.Screen name="Orders" component={OrdersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order' }} />
      <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Product' }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={useStackOptions()}>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Addresses" component={AddressesScreen} options={{ title: 'Saved addresses' }} />
      <Stack.Screen name="AddressEdit" component={AddressEditScreen} options={{ title: 'Address' }} />
      <Stack.Screen name="MapPicker" component={MapPickerScreen} options={{ title: 'Pin location' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const { colors, isDark, mode } = useTheme();

  useEffect(() => {
    loadThemeMode();
    refreshBadges();
  }, []);

  // Force the native appearance to match the chosen mode, so system chrome
  // (the window background behind transparent areas, status bar, etc.) follows
  // it too — not just our JS theme. 'system' (null) defers back to the OS.
  useEffect(() => {
    Appearance.setColorScheme(mode === 'system' ? null : mode);
  }, [mode]);

  // Drive react-navigation's theme from our palette so headers, screen
  // backgrounds and the like follow light/dark automatically.
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
      notification: colors.danger,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
        screenListeners={{ tabPress: () => refreshBadges() }}
      >
        <Tab.Screen name="HomeTab" component={HomeStack} />
        <Tab.Screen name="CartTab" component={CartStack} />
        <Tab.Screen name="OrdersTab" component={OrdersStack} />
        <Tab.Screen name="ProfileTab" component={ProfileStack} />
      </Tab.Navigator>
      <ToastHost />
    </NavigationContainer>
  );
}

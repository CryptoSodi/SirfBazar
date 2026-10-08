import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Appearance, Platform } from 'react-native';
import { useEffect } from 'react';
import { getAuthVersion, getUser, isLoggedIn } from './lib/api';
import { loadThemeMode, useTheme } from './lib/theme';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import CategoryScreen from './screens/CategoryScreen';
import BrowseScreen from './screens/BrowseScreen';
import GlobalCatalogScreen from './screens/GlobalCatalogScreen';
import HelpScreen from './screens/HelpScreen';
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
import DeliveryLocationScreen from './screens/DeliveryLocationScreen';
import { ToastHost } from './components/Toast';
import { CustomTabBar } from './components/CustomTabBar';
import { refreshBadges } from './lib/badges';
import { ScreenHeader } from './components/CustomerUI';
import NotificationsScreen from './screens/NotificationsScreen';
import SupportTicketsScreen from './screens/SupportTicketsScreen';
import SupportDetailScreen from './screens/SupportDetailScreen';
import ProfileEditScreen from './screens/ProfileEditScreen';
import AppearanceScreen from './screens/AppearanceScreen';
import SupportRequestScreen from './screens/SupportRequestScreen';
import OrderSentScreen, { PaymentPendingScreen } from './screens/OrderSentScreen';
import ReplacementScreen from './screens/ReplacementScreen';
import RatingScreen from './screens/RatingScreen';
import ShopsScreen from './screens/ShopsScreen';
import { startCustomerRealtime } from './lib/realtime';
import { notificationDestination } from './lib/customer-flow';
import { subscribeCustomerEvent } from './lib/customer-events';

const navigationRef = createNavigationContainerRef<any>();
let pendingNotification: { destination: NonNullable<ReturnType<typeof notificationDestination>>; userId: string; generation: number } | null = null;
async function openPendingNotification() {
  const pending = pendingNotification;
  if (!navigationRef.isReady() || !pending) return;
  const user = await getUser();
  if (getAuthVersion() !== pending.generation || user?.id !== pending.userId || !(await isLoggedIn())) {
    if (pendingNotification === pending) pendingNotification = null;
    return;
  }
  // Another auth/ready callback may have consumed or replaced the notification.
  if (pendingNotification !== pending || getAuthVersion() !== pending.generation) return;
  pendingNotification = null;
  const destination = pending.destination;
  navigationRef.navigate(destination.screen === 'SupportDetail' ? 'ProfileTab' : 'OrdersTab', {
    screen: destination.screen,
    params: destination.screen === 'SupportDetail' ? { ticketId: destination.ticketId } : { orderId: destination.orderId },
  });
}

/** Screens reachable across the app (a single combined param list keeps the
 *  per-screen navigation typing simple; each tab registers the subset it owns). */
export type RootStackParamList = {
  Home: undefined;
  DeliveryLocation: undefined;
  Notifications: undefined;
  SupportTickets: undefined;
  SupportDetail: { ticketId: string };
  ProfileEdit: { deleteAccount?: boolean } | undefined;
  Appearance: undefined;
  SupportRequest: { orderId?: string; orderLabel?: string; category?: 'ORDER' | 'PAYMENT' | 'GENERAL' } | undefined;
  Shops: undefined;
  Browse: undefined;
  GlobalCatalog: undefined;
  Cart: undefined;
  Orders: undefined;
  Profile: undefined;
  Search: { q?: string } | undefined;
  Category: { categoryId: string; name: string };
  Product: { productId: string; merchantProductId?: string };
  Help: { orderId?: string } | undefined;
  Shop: { merchantId: string };
  Checkout: { selectedAddressId?: string; picked?: { latitude: number; longitude: number; fullAddress?: string; area?: string; city?: string; province?: string } } | undefined;
  OrderDetail: { orderId: string; mode?: 'tracking' | 'details' };
  OrderSent: { orderId: string };
  Replacement: { orderId: string; originalItemId: string };
  PaymentPending: { orderId: string };
  Rating: { orderId: string };
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
  MapPicker: { latitude?: number; longitude?: number; browsing?: boolean; returnTo?: 'Checkout' | 'AddressEdit'; fullAddress?: string; city?: string } | undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

/** Header styling, recomputed per theme so titles/back buttons re-tint on
 *  light↔dark switch (header background/border come from the navigation theme). */
function useStackOptions() {
  const { colors } = useTheme();
  return {
    headerTintColor: colors.text,
    header: ({ navigation, options, route }: any) => (
      <ScreenHeader
        navigation={navigation}
        title={options.title ?? route.name}
        back={!['Cart', 'Orders', 'Profile'].includes(route.name)}
      />
    ),
  };
}

// Preserve each tab's stack; CustomTabBar is hidden on detail/checkout routes.
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={useStackOptions()}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Browse" component={BrowseScreen} options={{ title: 'Shop by category' }} />
      <Stack.Screen name="GlobalCatalog" component={GlobalCatalogScreen} options={{ title: 'Global catalogue' }} />
      <Stack.Screen name="Shops" component={ShopsScreen} options={{ title: 'Local shops' }} />
      <Stack.Screen name="DeliveryLocation" component={DeliveryLocationScreen} options={{ title: 'Delivery location' }} />
      <Stack.Screen name="MapPicker" component={MapPickerScreen} options={{ title: 'Choose location' }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
      <Stack.Screen name="Category" component={CategoryScreen} options={{ title: 'Categories' }} />
      <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Product details' }} />
      <Stack.Screen name="Shop" component={ShopScreen} options={{ title: 'Shop' }} />
    </Stack.Navigator>
  );
}

function CartStack() {
  return (
    <Stack.Navigator screenOptions={useStackOptions()}>
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Basket' }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
      <Stack.Screen name="OrderSent" component={OrderSentScreen} options={{ title: 'Order sent' }} />
      <Stack.Screen name="PaymentPending" component={PaymentPendingScreen} options={{ title: 'Payment pending' }} />
      <Stack.Screen name="Replacement" component={ReplacementScreen} options={{ title: 'Review a replacement' }} />
      <Stack.Screen name="Rating" component={RatingScreen} options={{ title: 'Rate delivered order' }} />
      <Stack.Screen name="SupportRequest" component={SupportRequestScreen} options={{ title: 'Report an order issue' }} />
      <Stack.Screen name="Help" component={HelpScreen} options={{ title: 'Help & support' }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Track order' }} />
      <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Product details' }} />
      <Stack.Screen name="Shop" component={ShopScreen} options={{ title: 'Shop' }} />
      <Stack.Screen name="AddressEdit" component={AddressEditScreen} options={{ title: 'Address' }} />
      <Stack.Screen name="MapPicker" component={MapPickerScreen} options={{ title: 'Pin location' }} />
    </Stack.Navigator>
  );
}

function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={useStackOptions()}>
      <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: 'My orders' }} />
      <Stack.Screen name="PaymentPending" component={PaymentPendingScreen} options={{ title: 'Payment pending' }} />
      <Stack.Screen name="OrderSent" component={OrderSentScreen} options={{ title: 'Order sent' }} />
      <Stack.Screen name="Replacement" component={ReplacementScreen} options={{ title: 'Review a replacement' }} />
      <Stack.Screen name="Rating" component={RatingScreen} options={{ title: 'Rate delivered order' }} />
      <Stack.Screen name="SupportRequest" component={SupportRequestScreen} options={{ title: 'Report an order issue' }} />
      <Stack.Screen name="Help" component={HelpScreen} options={{ title: 'Help & support' }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Track order' }} />
      <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Product details' }} />
      <Stack.Screen name="Shop" component={ShopScreen} options={{ title: 'Shop' }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={useStackOptions()}>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} options={{ title: 'Appearance' }} />
      <Stack.Screen name="SupportRequest" component={SupportRequestScreen} options={{ title: 'Report an issue' }} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ title: 'Profile details' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Order updates' }} />
      <Stack.Screen name="SupportTickets" component={SupportTicketsScreen} options={{ title: 'Support requests' }} />
      <Stack.Screen name="SupportDetail" component={SupportDetailScreen} options={{ title: 'Support conversation' }} />
      <Stack.Screen name="Help" component={HelpScreen} options={{ title: 'Help & support' }} />
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
    // Re-register for order alerts on every app start (push tokens can rotate).
    isLoggedIn().then((ok) => {
      if (ok) void import('./lib/push').then((m) => m.registerForPush()).catch(() => undefined);
    });
  }, []);
  useEffect(() => startCustomerRealtime(), []);
  useEffect(() => {
    const unsubscribe = subscribeCustomerEvent('auth', () => { void openPendingNotification(); void refreshBadges(); });
    if (Platform.OS === 'web') return unsubscribe;
    let disposed = false;
    let remove: (() => void) | undefined;
    void import('expo-notifications').then(async (notifications) => {
      const receive = async (response: any) => {
        const data = response.notification.request.content.data;
        const generation = getAuthVersion();
        const { canReceivePush } = await import('./lib/push');
        if (!await canReceivePush(data) || generation !== getAuthVersion()) return;
        const destination = notificationDestination(data);
        const user = await getUser();
        if (!destination || !user?.id || generation !== getAuthVersion()) return;
        pendingNotification = { destination, userId: user.id, generation };
        if (pendingNotification) {
          void openPendingNotification();
          if (navigationRef.isReady()) void isLoggedIn().then((ok) => {
            if (!ok) navigationRef.navigate('OrdersTab', { screen: 'Orders' });
          });
        }
      };
      if (disposed) return;
      const subscription = notifications.addNotificationResponseReceivedListener(receive);
      remove = () => subscription.remove();
      const initial = await notifications.getLastNotificationResponseAsync();
      if (initial && !disposed) { await receive(initial); await notifications.clearLastNotificationResponseAsync(); }
    }).catch(() => undefined);
    return () => { disposed = true; remove?.(); unsubscribe(); };
  }, []);

  // Force the native appearance to match the chosen mode, so system chrome
  // (the window background behind transparent areas, status bar, etc.) follows
  // it too — not just our JS theme. 'system' (null) defers back to the OS.
  useEffect(() => {
    if (Platform.OS !== 'web') Appearance.setColorScheme(mode === 'system' ? null : mode);
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
    <NavigationContainer ref={navigationRef} onReady={() => void openPendingNotification()} theme={navTheme}>
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

import { RouteProp, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../App';
import { CatalogScreen } from '../components/CatalogScreen';
export default function ShopScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Shop'>>();
  return <CatalogScreen merchantId={route.params.merchantId} />;
}

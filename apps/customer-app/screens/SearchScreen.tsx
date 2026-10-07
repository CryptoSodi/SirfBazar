import { RouteProp, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../App';
import { CatalogScreen } from '../components/CatalogScreen';
export default function SearchScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Search'>>();
  return <CatalogScreen initialQuery={route.params?.q} />;
}

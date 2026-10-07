import { RouteProp, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../App';
import { CatalogScreen } from '../components/CatalogScreen';
export default function CategoryScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Category'>>();
  return <CatalogScreen initialCategory={route.params.categoryId} />;
}

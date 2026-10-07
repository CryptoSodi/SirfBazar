import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useRiderTheme } from '../lib/appearance';

/** Decorative route artwork from the supplied rider reference, not a GPS route. */
export function RiderMapArtwork() {
  const { palette } = useRiderTheme();
  return <Svg width="100%" height="100%" viewBox="0 0 350 245" preserveAspectRatio="xMidYMid slice" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Rect x="0" y="0" width="350" height="245" fill={palette.map} />
    <Rect x="12" y="18" width="72" height="69" rx="14" fill={palette.mapBlock} />
    <Rect x="213" y="20" width="105" height="72" rx="14" fill={palette.mapBlock} />
    <Rect x="13" y="137" width="88" height="76" rx="13" fill={palette.mapBlock} />
    <Rect x="128" y="142" width="37" height="100" rx="12" fill={palette.mapBlock} />
    <Rect x="232" y="142" width="104" height="60" rx="14" fill={palette.mapBlock} />
    <Path d="M99 0 V245 M190 0 V245 M323 0 V245 M0 105 H350 M0 229 H350" stroke={palette.mapRoad} strokeWidth="13" />
    <Path d="M102 105 L111 245" stroke={palette.mapRoad} strokeWidth="12" />
    <Path d="M70 158 V105 H193 V187 H265" fill="none" stroke={palette.action} strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
    <Circle cx="70" cy="158" r="12" fill={palette.surface} stroke={palette.action} strokeWidth="3" />
    <Circle cx="70" cy="158" r="4" fill={palette.action} />
    <Rect x="250" y="172" width="32" height="31" rx="10" fill={palette.action} />
    <Path d="M258 190 L266 182 L274 190 V198 H258 Z" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round" />
  </Svg>;
}

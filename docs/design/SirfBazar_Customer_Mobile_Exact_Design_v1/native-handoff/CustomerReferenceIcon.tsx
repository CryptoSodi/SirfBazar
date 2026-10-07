/** Exact reference glyphs; optional adapter for the existing react-native-svg dependency.
 * This source was not compiled in a native app in the design environment.
 * Accessibility names belong on the native parent Pressable/Text context.
 */
import React from 'react';
import { SvgXml } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';
const paths = {
  "arrow": "<path d=\"m9 5 7 7-7 7M4 12h12\"/>",
  "back": "<path d=\"m14 5-7 7 7 7M7 12h13\"/>",
  "chevron": "<path d=\"m9 5 7 7-7 7\"/>",
  "check": "<path d=\"m5 12 4 4L19 6\"/>",
  "box": "<path d=\"m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8M7.5 5.5l9 5v4\"/>",
  "pin": "<path d=\"M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z\"/><circle cx=\"12\" cy=\"10\" r=\"2.5\"/>",
  "phone": "<path d=\"m7 3 3 5-2 2a14 14 0 0 0 6 6l2-2 5 3-1 4C10 23 1 14 3 4z\"/>",
  "route": "<path d=\"m3 10 18-7-7 18-3-8z\"/>",
  "shop": "<path d=\"M4 10v11h16V10M3 4h18l1 6a3 3 0 0 1-5 2 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-2zM10 21v-6h5v6M8 4l-1 6M16 4l1 6M12 4v6\"/>",
  "bell": "<path d=\"M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4\"/>",
  "history": "<path d=\"M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2\"/>",
  "help": "<path d=\"M4 13v-2a8 8 0 0 1 16 0v2M4 11H2v7h4v-7zm16 0h2v7h-4v-7zM20 18c0 3-3 3-6 3\"/>",
  "user": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21v-2a8 8 0 0 1 16 0v2\"/>",
  "cash": "<rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"3\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M5 9h1m12 6h1\"/>",
  "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1\"/>",
  "moon": "<path d=\"M21 14A9 9 0 0 1 10 3a9 9 0 1 0 11 11Z\"/>",
  "system": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M12 17v4m-5 0h10\"/>",
  "lock": "<rect x=\"4\" y=\"10\" width=\"16\" height=\"11\" rx=\"3\"/><path d=\"M8 10V7a4 4 0 0 1 8 0v3M12 14v3\"/>",
  "info": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v6m0-11v1\"/>",
  "close": "<path d=\"m6 6 12 12M18 6 6 18\"/>",
  "warning": "<path d=\"m12 3 10 18H2zM12 9v5m0 3v1\"/>",
  "wifi": "<path d=\"M2 7a16 16 0 0 1 20 0M5 11a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0\"/><circle cx=\"12\" cy=\"19\" r=\"1\"/>",
  "search": "<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"m16 16 5 5\"/>",
  "shield": "<path d=\"M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z\"/><path d=\"m8 12 3 3 5-6\"/>",
  "logout": "<path d=\"M9 3H4v18h5m6-14 5 5-5 5m-6-5h11\"/>",
  "location": "<circle cx=\"12\" cy=\"12\" r=\"7\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M12 1v4m0 14v4M1 12h4m14 0h4\"/>",
  "refresh": "<path d=\"M20 8a8 8 0 1 0 0 8M20 3v5h-5\"/>",
  "camera": "<path d=\"M8 5 10 2h4l2 3h5v16H3V5z\"/><circle cx=\"12\" cy=\"13\" r=\"4\"/>",
  "bike": "<circle cx=\"5\" cy=\"17\" r=\"4\"/><circle cx=\"19\" cy=\"17\" r=\"4\"/><path d=\"m5 17 5-8 4 8h5l-3-9h-3M8 5h5M9 9H5\"/>",
  "file": "<path d=\"M5 2h10l4 4v16H5zM15 2v5h4M8 12h8m-8 4h6\"/>",
  "message": "<path d=\"M3 3h18v14H8l-5 4zM7 7h10M7 11h7\"/>",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><ellipse cx=\"12\" cy=\"12\" rx=\"4\" ry=\"9\"/><path d=\"M3 12h18\"/>",
  "up": "<path d=\"m6 13 6-6 6 6m-6-6v14\"/>",
  "home": "<path d=\"m3 10 9-7 9 7v10H4V10m5 10v-7h6v7\"/>",
  "basket": "<path d=\"M3 8h18l-2 12H5L3 8ZM8 8l4-6 4 6M9 12v4m6-4v4\"/>",
  "grid": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"2\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"2\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"2\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"2\"/>",
  "receipt": "<path d=\"m5 3 3 2 4-2 4 2 3-2v18l-3-2-4 2-4-2-3 2ZM8 9h8M8 13h5M8 17h8\"/>",
  "card": "<rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"3\"/><path d=\"M2 9h20M6 15h4\"/>",
  "sliders": "<path d=\"M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-5 0v6\"/>",
  "ticket": "<path d=\"M3 7V4h18v6a2 2 0 0 0 0 4v6H3v-6a2 2 0 0 0 0-4V7Z\"/><path d=\"M15 5v2m0 3v2m0 3v2\"/>",
  "plus": "<path d=\"M12 5v14M5 12h14\"/>",
  "minus": "<path d=\"M5 12h14\"/>",
  "filter": "<path d=\"M4 6h16M7 12h10m-7 6h4\"/>",
  "bag": "<rect x=\"4\" y=\"6\" width=\"16\" height=\"15\" rx=\"3\"/><path d=\"M8 7V5a4 4 0 0 1 8 0v2\"/>",
  "star": "<path d=\"m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z\"/>",
  "edit": "<path d=\"m14 4 6 6-10 10H4v-6L14 4Zm-2 2 6 6\"/>",
  "trash": "<path d=\"M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7\"/>"
} as const;
export type CustomerIconName = keyof typeof paths;
type Props = { name:CustomerIconName; size?:number; color?:string; strokeWidth?:number; style?:StyleProp<ViewStyle> };
const entities: Record<string, string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'};
const attr = (value:string) => value.replace(/[&<>"']/g,c=>entities[c]);
export function CustomerReferenceIcon({name,size=22,color='#071F18',strokeWidth=1.7,style}:Props) {
 const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" color="${attr(color)}" stroke="${attr(color)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
 return <SvgXml xml={xml} width={size} height={size} style={style} />;
}

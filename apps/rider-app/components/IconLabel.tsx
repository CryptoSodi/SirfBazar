import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TextProps, ViewStyle } from 'react-native';
import { AppIcon, type AppIconName } from './AppIcon';

// Keep SVGs outside Text so Android and iOS lay out and wrap labels consistently.
export function IconLabel({ icon, style, children, ...props }: PropsWithChildren<TextProps & { icon: AppIconName }>) {
  const flat = StyleSheet.flatten(style) ?? {};
  const { margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, flex, flexShrink, alignSelf, ...textStyle } = flat;
  const layout: ViewStyle = { margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, flex, flexShrink: flexShrink ?? 1, alignSelf };
  return <View style={[layout, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
    <AppIcon name={icon} size={Math.max(16, Number(flat.fontSize ?? 16))} color={typeof flat.color === 'string' ? flat.color : '#071F18'} />
    <Text {...props} style={[textStyle, { flexShrink: 1 }]}>{children}</Text>
  </View>;
}

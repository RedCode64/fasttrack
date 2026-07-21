import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { colors, fonts, spacing } from "@/theme";

import { Icon, type IconName } from "./Icon";

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly icon?: IconName;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({ label, onPress, icon, disabled, style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles.primary,
        disabled === true && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={colors.white} strokeWidth={2.2} /> : null}
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress, icon, disabled, style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles.ghost,
        disabled === true && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={colors.ink} /> : null}
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: spacing.buttonRadius,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  primaryText: {
    color: colors.white,
    fontSize: 13.5,
    fontFamily: fonts.sans700,
  },
  ghost: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderButton,
  },
  ghostText: {
    color: colors.ink,
    fontSize: 13.5,
    fontFamily: fonts.sans700,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
});

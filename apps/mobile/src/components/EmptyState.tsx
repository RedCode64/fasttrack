import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme";

import { Icon, type IconName } from "./ui/Icon";

export function EmptyState({
  icon,
  title,
  hint,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly hint: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Icon name={icon} size={22} color={colors.faint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 6,
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 15,
    fontFamily: fonts.sans700,
    color: colors.ink,
  },
  hint: {
    fontSize: 12.5,
    fontFamily: fonts.sans500,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
  },
});

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { FREE_CLIENT_CAP, FREE_DOCUMENT_CAP, type CapState } from "@/lib/gating";
import { colors, fonts, spacing } from "@/theme";

import { Icon } from "./Icon";

/**
 * Tells a free user where they stand against a cap *before* they fill in a
 * form, so hitting the paywall is never a surprise at the final tap. Purely
 * presentational — the gate itself stays in `lib/gating.ts`.
 */

type CapKind = "client" | "document";

export interface CapNoticeProps {
  readonly state: CapState;
  readonly kind: CapKind;
  readonly style?: StyleProp<ViewStyle>;
}

const CAPS: Record<CapKind, number> = {
  client: FREE_CLIENT_CAP,
  document: FREE_DOCUMENT_CAP,
};

function message(state: CapState, kind: CapKind): string | null {
  if (state === "last") return `This is your last free ${kind}.`;
  if (state === "reached") {
    return `You've used all ${CAPS[kind]} free ${kind}s. Pro removes the limit.`;
  }
  return null;
}

export function CapNotice({ state, kind, style }: CapNoticeProps) {
  const text = message(state, kind);
  if (text === null) return null;

  const reached = state === "reached";
  const tint = reached ? colors.accent : colors.amber;

  return (
    <View
      style={[styles.base, reached ? styles.reached : styles.last, style]}
      accessibilityRole="alert"
    >
      <Icon name={reached ? "bolt" : "alert"} size={15} color={tint} strokeWidth={2.2} />
      <Text style={[styles.text, { color: tint }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 18,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: spacing.cardRadiusSm,
    borderWidth: 1,
  },
  last: {
    backgroundColor: colors.amberWash,
    borderColor: "rgba(242,179,80,0.3)",
  },
  reached: {
    backgroundColor: colors.accentWash,
    borderColor: "rgba(123,108,240,0.35)",
  },
  text: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: fonts.sans600,
    lineHeight: 17,
  },
});

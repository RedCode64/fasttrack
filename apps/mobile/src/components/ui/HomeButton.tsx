import { useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { colors } from "@/theme";

/**
 * Circular header button that jumps straight back to the Home dashboard, so a
 * user deep in a push flow (e.g. estimate → line item) doesn't have to tap Back
 * repeatedly. Sits beside the Back button and matches its 34px circle styling.
 */
export function HomeButton() {
  const router = useRouter();

  const goHome = () => {
    // Unwind any pushed screens back to the tab group, then select Home (index).
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.navigate("/(tabs)");
  };

  return (
    <Pressable
      style={styles.button}
      onPress={goHome}
      accessibilityRole="button"
      accessibilityLabel="Go to home"
      hitSlop={6}
    >
      <Icon name="home" size={18} color={colors.slate} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderCircle,
    alignItems: "center",
    justifyContent: "center",
  },
});

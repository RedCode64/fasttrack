import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { colors, fonts } from "@/theme";

function tabIcon(name: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon name={name} size={23} color={String(color)} strokeWidth={focused ? 2.1 : 1.8} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.screenBg },
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.92)",
          borderTopColor: colors.borderCircle,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontFamily: fonts.sans600,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: tabIcon("home") }} />
      <Tabs.Screen
        name="estimates"
        options={{ title: "Estimates", tabBarIcon: tabIcon("doc") }}
      />
      <Tabs.Screen
        name="invoices"
        options={{ title: "Invoices", tabBarIcon: tabIcon("receipt") }}
      />
      <Tabs.Screen
        name="expenses"
        options={{ title: "Expenses", tabBarIcon: tabIcon("wallet") }}
      />
    </Tabs>
  );
}

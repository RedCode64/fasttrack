import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";

import { DbProvider, useDb } from "@/db/DbProvider";
import { SubscriptionProvider } from "@/subscriptions/SubscriptionProvider";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();

/** Redirects into onboarding until an org exists, and out of it once one does. */
function OnboardingGate({ children }: { readonly children: ReactNode }) {
  const { org } = useDb();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inOnboarding = segments[0] === "onboarding";
    if (!org && !inOnboarding) {
      router.replace("/onboarding");
    } else if (org && inOnboarding) {
      router.replace("/(tabs)");
    }
  }, [org, segments, router]);

  return children;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <DbProvider>
      <SubscriptionProvider>
        <OnboardingGate>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.screenBg },
            }}
          />
        </OnboardingGate>
      </SubscriptionProvider>
    </DbProvider>
  );
}

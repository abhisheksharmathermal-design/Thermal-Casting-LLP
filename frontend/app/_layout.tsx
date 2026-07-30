import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/auth";

LogBox.ignoreAllLogs(true);

// Swallow any unhandled promise rejections from icon-font CDN timeouts,
// keeps Expo Go's LogBox from showing an "Uncaught Error 6000ms timeout".
if (typeof global !== "undefined") {
  // @ts-ignore
  const anyGlobal: any = global;
  if (!anyGlobal.__unhandledRejectionsGuarded) {
    anyGlobal.__unhandledRejectionsGuarded = true;
    if (typeof anyGlobal.HermesInternal?.enablePromiseRejectionTracker === "function") {
      anyGlobal.HermesInternal.enablePromiseRejectionTracker({
        allRejections: true,
        onUnhandled: (_id: number, err: any) => {
          if (String(err?.message || err).includes("timeout exceeded")) return;
          console.warn("Unhandled promise:", err);
        },
      });
    }
  }
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded] = useIconFonts();

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  // Render the app immediately — never wait for icon-font CDN.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#F4F5F6" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F4F5F6" } }} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

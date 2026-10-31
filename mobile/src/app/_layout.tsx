import { NotoSansJP_400Regular } from "@expo-google-fonts/noto-sans-jp/400Regular";
import { NotoSansJP_700Bold } from "@expo-google-fonts/noto-sans-jp/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityWatcher } from "@/lib/activity";
import { SessionProvider, useSession } from "@/lib/session";
import { color } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync();

function Root() {
  const { ready, t } = useSession();
  const [fontsLoaded, fontError] = useFonts({ NotoSansJP_400Regular, NotoSansJP_700Bold });
  const done = ready && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (done) void SplashScreen.hideAsync();
  }, [done]);
  if (!done) return null;
  return (
    <>
      <StatusBar style="dark" />
      <ActivityWatcher />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg }, headerTintColor: color.blue, headerShadowVisible: false, headerStyle: { backgroundColor: color.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="show" options={{ presentation: "fullScreenModal", animation: "fade" }} />
        <Stack.Screen name="wallet-preview" options={{ presentation: "modal" }} />
        <Stack.Screen name="presenter" options={{ presentation: "modal" }} />
        <Stack.Screen name="emergency-preview" options={{ presentation: "modal" }} />
        <Stack.Screen name="item/[kind]" options={{ presentation: "modal" }} />
        <Stack.Screen name="basics" options={{ presentation: "modal" }} />
        <Stack.Screen name="setup" options={{ gestureEnabled: false }} />
        <Stack.Screen name="details" options={{ presentation: "modal" }} />
        <Stack.Screen name="insurance" options={{ presentation: "modal" }} />
        <Stack.Screen name="trip" options={{ presentation: "modal" }} />
        <Stack.Screen name="record/[id]" options={{ headerShown: true, title: t.records, headerBackTitle: t.records }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

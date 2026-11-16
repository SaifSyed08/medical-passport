import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { View, type ColorValue } from "react-native";
import { useActivity } from "@/lib/activity";
import { useSession } from "@/lib/session";
import { color } from "@/lib/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

// Outline when idle; filled on a soft blue pill for the tab you're on, so the current tab reads at a glance.
const icon = (idle: IconName, active: IconName) =>
  function TabIcon({ color: c, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <View
        importantForAccessibility="no-hide-descendants"
        style={{ width: 52, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: focused ? color.selectedBg : "transparent" }}
      >
        <Ionicons name={focused ? active : idle} size={21} color={c as string} />
      </View>
    );
  };

export default function TabsLayout() {
  const { signedIn, me, t } = useSession();
  const { unread, pending } = useActivity();
  if (!signedIn) return <Redirect href="/login" />;
  // A blank profile picks a name, date of birth and destination before seeing the card.
  if (me?.traveler.needsSetup) return <Redirect href="/setup" />;
  // The access log lives inside Privacy, so its new entries count toward that tab's badge.
  const alerts = pending + unread;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.blue,
        tabBarInactiveTintColor: "#7c8791",
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopWidth: 0,
          minHeight: 66,
          paddingTop: 8,
          shadowColor: color.ink,
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -3 },
          elevation: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500", marginTop: 3 },
        tabBarItemStyle: { minHeight: 50 },
        tabBarBadgeStyle: { backgroundColor: color.errorText, color: "white", fontSize: 11 },
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabCard, tabBarIcon: icon("card-outline", "card"), tabBarAccessibilityLabel: t.tabCard }} />
      <Tabs.Screen name="health" options={{ title: t.tabHealth, tabBarIcon: icon("heart-outline", "heart"), tabBarAccessibilityLabel: t.tabHealth }} />
      <Tabs.Screen name="medicines" options={{ title: t.tabMedicines, tabBarIcon: icon("medkit-outline", "medkit"), tabBarAccessibilityLabel: t.medTitle }} />
      <Tabs.Screen name="interpreter" options={{ title: t.tabInterpreter, tabBarIcon: icon("chatbubbles-outline", "chatbubbles"), tabBarAccessibilityLabel: t.interpreterTitle }} />
      <Tabs.Screen name="records" options={{ title: t.tabRecords, tabBarIcon: icon("folder-open-outline", "folder-open"), tabBarAccessibilityLabel: t.tabRecords }} />
      <Tabs.Screen
        name="privacy"
        options={{
          title: t.tabPrivacy,
          tabBarIcon: icon("shield-checkmark-outline", "shield-checkmark"),
          tabBarBadge: alerts || undefined,
          tabBarAccessibilityLabel: alerts ? `${t.tabPrivacy}, ${pending ? `${pending} ${t.pending}` : ""}${pending && unread ? ", " : ""}${unread ? `${unread} ${t.accessLogNew}` : ""}` : t.tabPrivacy,
        }}
      />
    </Tabs>
  );
}

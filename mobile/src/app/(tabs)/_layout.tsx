import { Redirect, Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { useActivity } from "@/lib/activity";
import { useSession } from "@/lib/session";
import { color } from "@/lib/theme";

// Simple text glyphs keep the bundle free of an icon font.
const icon = (glyph: string) =>
  function TabIcon({ color: c }: { color: ColorValue }) {
    return <Text style={{ color: c, fontSize: 20, lineHeight: 24 }} importantForAccessibility="no">{glyph}</Text>;
  };

export default function TabsLayout() {
  const { signedIn, t } = useSession();
  const { unread, pending } = useActivity();
  if (!signedIn) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.blue,
        tabBarInactiveTintColor: "#8a9298",
        tabBarStyle: { backgroundColor: "#fbfbf9", borderTopColor: color.line, minHeight: 60 },
        tabBarLabelStyle: { fontSize: 12 },
        tabBarItemStyle: { minHeight: 48 },
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabCard, tabBarIcon: icon("▭"), tabBarAccessibilityLabel: t.tabCard }} />
      <Tabs.Screen name="health" options={{ title: t.tabHealth, tabBarIcon: icon("✚"), tabBarAccessibilityLabel: t.tabHealth }} />
      <Tabs.Screen name="records" options={{ title: t.tabRecords, tabBarIcon: icon("❏"), tabBarAccessibilityLabel: t.tabRecords }} />
      <Tabs.Screen
        name="privacy"
        options={{ title: t.tabPrivacy, tabBarIcon: icon("◐"), tabBarBadge: pending || undefined, tabBarAccessibilityLabel: pending ? `${t.tabPrivacy}, ${pending} ${t.pending}` : t.tabPrivacy }}
      />
      <Tabs.Screen
        name="activity"
        options={{ title: t.tabActivity, tabBarIcon: icon("◷"), tabBarBadge: unread || undefined, tabBarAccessibilityLabel: unread ? `${t.tabActivity}, ${unread} new` : t.tabActivity }}
      />
    </Tabs>
  );
}

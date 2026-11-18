import { Redirect, Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { Icon, type IconName } from "@/components/icons";
import { useActivity } from "@/lib/activity";
import { useSession } from "@/lib/session";
import { color } from "@/lib/theme";

// One thin outline per tab; the tab you're on turns blue, icon and label together.
const icon = (name: IconName) =>
  function TabIcon({ color: c }: { color: ColorValue }) {
    return <Icon name={name} color={c as string} size={23} />;
  };

// The web app's tab labels: 12px, semibold, bold on the tab you're on.
function TabLabel({ focused, color: c, children }: { focused: boolean; color: string; children: string }) {
  return (
    <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ color: c, fontSize: 12, fontWeight: focused ? "700" : "600", marginTop: 2 }}>
      {children}
    </Text>
  );
}

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
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: { backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.line, minHeight: 64, paddingTop: 6, elevation: 0, shadowOpacity: 0 },
        tabBarItemStyle: { minHeight: 50 },
        tabBarLabel: ({ focused, color: c, children }) => <TabLabel focused={focused} color={c as string}>{children}</TabLabel>,
        tabBarBadgeStyle: { backgroundColor: color.errorText, color: "white", fontSize: 11 },
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabCard, tabBarIcon: icon("card"), tabBarAccessibilityLabel: t.tabCard }} />
      <Tabs.Screen name="health" options={{ title: t.tabHealth, tabBarIcon: icon("health"), tabBarAccessibilityLabel: t.tabHealth }} />
      <Tabs.Screen name="medicines" options={{ title: t.tabMedicines, tabBarIcon: icon("medicines"), tabBarAccessibilityLabel: t.medTitle }} />
      <Tabs.Screen name="interpreter" options={{ title: t.tabInterpreter, tabBarIcon: icon("interpret"), tabBarAccessibilityLabel: t.interpreterTitle }} />
      <Tabs.Screen name="records" options={{ title: t.tabRecords, tabBarIcon: icon("records"), tabBarAccessibilityLabel: t.tabRecords }} />
      <Tabs.Screen
        name="privacy"
        options={{
          title: t.tabPrivacy,
          tabBarIcon: icon("privacy"),
          tabBarBadge: alerts || undefined,
          tabBarAccessibilityLabel: alerts ? `${t.tabPrivacy}, ${pending ? `${pending} ${t.pending}` : ""}${pending && unread ? ", " : ""}${unread ? `${unread} ${t.accessLogNew}` : ""}` : t.tabPrivacy,
        }}
      />
    </Tabs>
  );
}

import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { Alert, Platform } from "react-native";

/** Plain yes/no dialog. */
export function ask(title: string, message: string, ok: string, cancel: string, destructive = false): Promise<boolean> {
  // Alert.alert is a no-op on react-native-web (the web build is only a dev preview).
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise(resolve =>
    Alert.alert(title, message, [
      { text: cancel, style: "cancel", onPress: () => resolve(false) },
      { text: ok, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}

/**
 * Biometric confirmation for sensitive actions (replace card, approve/deny access).
 * Falls back to the device passcode; if the device has no biometrics enrolled (common on
 * simulators), falls back to a plain confirmation dialog so the demo still works.
 */
export async function confirmWithBiometrics(reason: string, fallbackCancel: string): Promise<boolean> {
  // expo-local-authentication has no web implementation; the web preview uses the tap fallback.
  const [hasHardware, enrolled] =
    Platform.OS === "web" ? [false, false] : await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]).catch(() => [false, false]);
  let ok: boolean | null = null;
  if (hasHardware && enrolled) {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: fallbackCancel });
    // Face ID isn't available inside Expo Go on iOS; that comes back as an error other than a
    // cancel or failed match, so fall through to the tap confirmation below.
    if (r.success) ok = true;
    else if (["user_cancel", "system_cancel", "app_cancel", "authentication_failed", "lockout"].includes(r.error)) ok = false;
  }
  if (ok === null) {
    ok = await ask(reason, "Biometrics aren't available here (for example in Expo Go on iOS), so this demo asks for a tap instead.", "Confirm", fallbackCancel);
  }
  void Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  return ok;
}

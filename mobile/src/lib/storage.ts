// Secure storage on devices (Keychain / Keystore via expo-secure-store).
// The web build is only a development preview; there values live in memory for the tab's lifetime.
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const memory = new Map<string, string>();
const web = Platform.OS === "web";

export const storage = {
  get: (key: string): Promise<string | null> => (web ? Promise.resolve(memory.get(key) ?? null) : SecureStore.getItemAsync(key)),
  set: (key: string, value: string): Promise<void> => (web ? Promise.resolve(void memory.set(key, value)) : SecureStore.setItemAsync(key, value)),
  remove: (key: string): Promise<void> => (web ? Promise.resolve(void memory.delete(key)) : SecureStore.deleteItemAsync(key)),
};

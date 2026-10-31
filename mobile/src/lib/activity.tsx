// Polls /api/v1/notifications while the app is open and signed in. New clinician activity raises a
// local notification ("Dr. Tanaka at Tokyo General viewed your emergency profile"). No push service.
import * as Notifications from "expo-notifications";
import { useEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import type { AccessEvent, AccessRequest } from "@shared/tessera";
import { api } from "./api";
import { useSession } from "./session";

const POLL_MS = 10_000;

type State = { unread: number; pending: number; lastSeq: number; baseline: boolean };
let state: State = { unread: 0, pending: 0, lastSeq: 0, baseline: false };
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  subs.forEach(s => s());
};
const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => subs.delete(fn);
};

export function useActivity() {
  return useSyncExternalStore(subscribe, () => state);
}
export const markActivityRead = () => set({ unread: 0 });
export const resetActivity = () => set({ unread: 0, pending: 0, lastSeq: 0, baseline: false });

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

async function ensurePermission() {
  if (Platform.OS === "android") {
    // AndroidImportance is re-exported via `export *` from a .types module, which import/namespace can't follow.
    // eslint-disable-next-line import/namespace
    await Notifications.setNotificationChannelAsync("access", { name: "Card access", importance: Notifications.AndroidImportance.HIGH });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Fetch once; exported so screens can refresh right after an action. */
export async function pollActivity(notify: boolean, title: string) {
  const r = await api<{ events: AccessEvent[]; pending: AccessRequest[] }>(`/notifications?after=${state.lastSeq}`);
  const fresh = r.events.filter(e => !e.seeded);
  const maxSeq = Math.max(state.lastSeq, ...r.events.map(e => e.seq));
  if (!state.baseline) {
    // First poll after sign-in only sets the baseline; history isn't re-announced.
    set({ lastSeq: maxSeq, pending: r.pending.length, baseline: true });
    return;
  }
  set({ lastSeq: maxSeq, pending: r.pending.length, unread: state.unread + fresh.length });
  if (notify) {
    // Oldest first, at most three banners per poll.
    for (const e of [...fresh].reverse().slice(-3)) {
      await Notifications.scheduleNotificationAsync({ content: { title, body: e.message }, trigger: null }).catch(() => {});
    }
  }
}

export function ActivityWatcher() {
  const { signedIn, t } = useSession();
  useEffect(() => {
    if (!signedIn) {
      resetActivity();
      return;
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    let allowed = false;
    const tick = () => void pollActivity(allowed, t.notifTitle).catch(() => {});
    ensurePermission().then(ok => (allowed = ok)).catch(() => {}).finally(tick);
    const start = () => {
      clearInterval(timer);
      timer = setInterval(tick, POLL_MS);
    };
    start();
    const sub = AppState.addEventListener("change", s => {
      if (s === "active") {
        tick();
        start();
      } else clearInterval(timer);
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [signedIn, t.notifTitle]);
  return null;
}

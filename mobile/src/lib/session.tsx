import { Directory, File, Paths } from "expo-file-system";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Me } from "@shared/tessera";
import { api, setToken, setUnauthorizedHandler } from "./api";
import { clearCache } from "./cache";
import { strings, type AppLanguage, type Strings } from "./i18n";
import { storage } from "./storage";

const TOKEN_KEY = "tessera.token";
const UI_LANG_KEY = "tessera.uiLang";
// Only the card URL (a random link, no PII) is kept on the device so the QR still shows offline.
export const CARD_KEY = "tessera.card";

/** Removes documents downloaded for viewing (record/[id]) so nothing patient-related stays on disk. */
function clearDownloadedFiles() {
  try {
    for (const entry of new Directory(Paths.cache).list()) if (entry instanceof File && entry.name.startsWith("tessera-")) entry.delete();
  } catch {
    // Best effort.
  }
}

type Session = {
  ready: boolean;
  signedIn: boolean;
  me: Me | null;
  setMe: (m: Me) => void;
  uiLang: AppLanguage;
  setUiLang: (l: AppLanguage) => void;
  t: Strings;
  /** "jordan-rivera" = the sample traveler; "blank" = a fresh empty profile. */
  signIn: (code: "jordan-rivera" | "blank") => Promise<void>;
  refreshMe: () => Promise<Me>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [uiLang, setUiLangState] = useState<AppLanguage>("en");

  const signOut = useCallback(async () => {
    api("/auth/logout", { method: "POST", body: {} }).catch(() => {});
    setToken(null);
    clearCache();
    clearDownloadedFiles();
    setMe(null);
    setSignedIn(false);
    await Promise.all([storage.remove(TOKEN_KEY), storage.remove(CARD_KEY)]);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    (async () => {
      const [stored, lang] = await Promise.all([storage.get(TOKEN_KEY), storage.get(UI_LANG_KEY)]);
      if (lang === "ja" || lang === "en") setUiLangState(lang);
      if (stored) {
        setToken(stored);
        setSignedIn(true);
        api<Me>("/me").then(setMe).catch(() => {});
      }
      setReady(true);
    })();
  }, [signOut]);

  const signIn = useCallback(async (code: "jordan-rivera" | "blank") => {
    clearCache();
    const { token } = await api<{ token: string; expires: string }>("/auth/demo-login", { body: { code } });
    setToken(token);
    await storage.set(TOKEN_KEY, token);
    setMe(await api<Me>("/me"));
    setSignedIn(true);
  }, []);

  const refreshMe = useCallback(async () => {
    const m = await api<Me>("/me");
    setMe(m);
    return m;
  }, []);

  const setUiLang = useCallback((l: AppLanguage) => {
    setUiLangState(l);
    storage.set(UI_LANG_KEY, l).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ ready, signedIn, me, setMe, uiLang, setUiLang, t: strings[uiLang], signIn, signOut, refreshMe }),
    [ready, signedIn, me, uiLang, setUiLang, signIn, signOut, refreshMe],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}

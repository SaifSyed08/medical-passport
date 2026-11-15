// Document scans that run in the background: the OCR takes a while, so a scan keeps going while the traveler uses
// the app. Records shows its progress ("Reading page 1 of 3") and "Ready to review" when it is done.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Suggestion } from "@shared/autofill";
import { ApiError } from "./api";
import { pollScan, startScan } from "./autofill";
import { useSession } from "./session";

export type Scan =
  | { status: "reading"; page: number; pages: number }
  | { status: "ready"; suggestions: Suggestion[] }
  | { status: "error"; error: ApiError };

const POLL_MS = 1200;
const GIVE_UP_MS = 5 * 60 * 1000;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const asError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(0, String(e), "offline"));

type Scans = { scans: Record<string, Scan>; start: (recordId: string) => void; clear: (recordId: string) => void };
const ScanContext = createContext<Scans | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const { signedIn } = useSession();
  const [scans, setScans] = useState<Record<string, Scan>>({});
  const running = useRef(new Set<string>());
  // Bumped on sign-out so scans still polling for the previous traveler stop and never write into the next one's state.
  const epoch = useRef(0);

  const put = useCallback((recordId: string, scan: Scan) => setScans(s => ({ ...s, [recordId]: scan })), []);
  const clear = useCallback((recordId: string) => setScans(({ [recordId]: _gone, ...rest }) => rest), []);

  const start = useCallback(
    (recordId: string) => {
      if (running.current.has(recordId)) return;
      running.current.add(recordId);
      const mine = epoch.current;
      const alive = () => epoch.current === mine;
      put(recordId, { status: "reading", page: 0, pages: 0 });
      void (async () => {
        try {
          const first = await startScan(recordId);
          if ("suggestions" in first) {
            if (alive()) put(recordId, { status: "ready", suggestions: first.suggestions });
            return;
          }
          const giveUp = Date.now() + GIVE_UP_MS;
          while (alive() && Date.now() < giveUp) {
            await sleep(POLL_MS);
            if (!alive()) return;
            const next = await pollScan(recordId, first.jobId);
            if (!alive()) return;
            put(recordId, next.status === "done" ? { status: "ready", suggestions: next.suggestions } : next);
            if (next.status === "done") return;
          }
          if (alive()) put(recordId, { status: "error", error: new ApiError(0, "The scan took too long", "offline") });
        } catch (e) {
          if (alive()) put(recordId, { status: "error", error: asError(e) });
        } finally {
          running.current.delete(recordId);
        }
      })();
    },
    [put],
  );

  // On sign-out, drop the previous traveler's scans (state, reset while rendering) and stop their polling (refs).
  const [wasSignedIn, setWasSignedIn] = useState(signedIn);
  if (signedIn !== wasSignedIn) {
    setWasSignedIn(signedIn);
    if (!signedIn) setScans({});
  }
  useEffect(() => {
    if (signedIn) return;
    epoch.current += 1;
    running.current.clear();
  }, [signedIn]);

  const value = useMemo(() => ({ scans, start, clear }), [scans, start, clear]);
  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScans(): Scans {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScans must be used inside ScanProvider");
  return ctx;
}

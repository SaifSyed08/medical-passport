// Half-duplex: the mic is paused while the phone speaks, and comes back a moment after the last line ends.

type Pausable = { pause: (reason: string) => void; resume: (reason: string) => void };

export const RESUME_TAIL_MS = 300;

/**
 * Returns the Player's onBusy handler plus a cancel() for unmount.
 * Back-to-back lines start in the same tick the previous one ended, so the pending resume
 * must be cancelled, or the mic reopens halfway through the second line and translates the phone itself.
 */
export function halfDuplex(getMic: () => Pausable | null, tailMs = RESUME_TAIL_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onBusy = (busy: boolean) => {
    const mic = getMic();
    if (!mic) return;
    clearTimeout(timer);
    timer = undefined;
    if (busy) mic.pause("speaking");
    // A short tail so the end of our own speech isn't picked up as a new utterance.
    else timer = setTimeout(() => mic.resume("speaking"), tailMs);
  };
  return { onBusy, cancel: () => clearTimeout(timer) };
}

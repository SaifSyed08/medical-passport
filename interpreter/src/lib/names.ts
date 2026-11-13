const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

/** "ibuprofen" vs "ibuprofeno", "amoxicillin" vs "amoxicilina": a swap would only add noise. */
export function nearlySame(a: string, b: string) {
  const x = fold(a);
  const y = fold(b);
  if (!x || !y) return false;
  if (x === y) return true;
  let p = 0;
  while (p < x.length && p < y.length && x[p] === y[p]) p++;
  return p >= 6 && p >= Math.min(x.length, y.length) - 3;
}

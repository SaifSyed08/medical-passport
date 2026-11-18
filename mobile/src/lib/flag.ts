/** A country's flag emoji from its two-letter code ("JP" → 🇯🇵); empty for anything else. */
export const flag = (code?: string | null) =>
  code && /^[A-Za-z]{2}$/.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map(ch => 0x1f1a5 + ch.charCodeAt(0))) : "";

// How to say a medicine name written in a script the traveler can't read: カロナール reads "karonāru" for
// someone from the US, Tylenol reads "タイレノール" for someone from Japan. The native text stays (that's what
// the pharmacist reads); the reading goes under it, in the script of the traveler's home country.
// Hand-written readings cover the curated Japanese names; anything else is asked of the model once and cached.

/** The script people in a country read. Countries not listed read the Latin alphabet. */
const SCRIPT = {
  JP: "ja", CN: "zh", TW: "zh", HK: "zh", KR: "ko", NP: "deva", TH: "th",
  RU: "cyrl", UA: "cyrl", BG: "cyrl", RS: "cyrl", BY: "cyrl", KZ: "cyrl",
  GR: "el", IL: "he", SA: "ar", AE: "ar", EG: "ar", JO: "ar", MA: "ar", QA: "ar", KW: "ar", IR: "ar",
};
const LETTERS = {
  latn: /\p{Script=Latin}/u, ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]/u, zh: /\p{Script=Han}/u,
  ko: /\p{Script=Hangul}/u, deva: /\p{Script=Devanagari}/u, th: /\p{Script=Thai}/u, cyrl: /\p{Script=Cyrillic}/u,
  el: /\p{Script=Greek}/u, he: /\p{Script=Hebrew}/u, ar: /\p{Script=Arabic}/u,
};
const SCRIPT_NAME = {
  latn: "the Latin alphabet, as a simple romanization an English speaker can say (Hepburn for Japanese, long vowels with macrons)",
  ja: "Japanese katakana", zh: "Chinese characters (the usual Chinese transliteration)", ko: "Korean Hangul", deva: "Devanagari",
  th: "Thai script", cyrl: "Cyrillic", el: "the Greek alphabet", he: "the Hebrew alphabet", ar: "Arabic script",
};

export const scriptOf = (country) => SCRIPT[String(country || "").toUpperCase()] || "latn";

/** True when the text has letters the reader of `script` can't read. */
export function needsReading(text, script) {
  const re = LETTERS[script] || LETTERS.latn;
  return [...String(text || "")].some((ch) => /\p{L}/u.test(ch) && !re.test(ch) && ch !== "µ");
}

/** Checked by hand. Latin readings of the curated Japanese names in drugs.mjs. */
export const CURATED_READINGS = {
  "サルブタモール": "sarubutamōru", "サルタノールインヘラー": "sarutanōru inherā",
  "メトホルミン": "metohorumin", "メトグルコ": "metoguruko",
  "ロサルタン": "rosarutan", "ニューロタン": "nyūrotan",
  "アスピリン": "asupirin", "バイアスピリン": "bai-asupirin",
  "アモキシシリン": "amokishishirin", "サワシリン": "sawashirin", "パセトシン": "pasetoshin",
  "セフトリアキソン": "sefutoriakison", "ロセフィン": "rosefin",
  "アセトアミノフェン": "asetoaminofen", "カロナール": "karonāru", "タイレノールA": "tairenōru A",
  "イブプロフェン": "ibupurofen", "ブルフェン": "burufen", "イブ": "ibu",
  "インスリン グラルギン": "insurin gurarugin", "ランタス": "rantasu",
  "インスリン リスプロ": "insurin risupuro", "ヒューマログ": "hyūmarogu",
  "グルカゴン点鼻粉末剤": "gurukagon tenbi funmatsuzai", "バクスミー": "bakusumī",
  "アドレナリン自己注射薬": "adorenarin jiko chūshayaku", "エピペン": "epipen",
};

export const READINGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["readings"],
  properties: {
    readings: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["text", "reading"], properties: { text: { type: "string" }, reading: { type: "string" } } },
    },
  },
};

export function readingsPrompt(script) {
  return `Each line is a medicine name as printed in a pharmacy. Write how it is pronounced, in ${SCRIPT_NAME[script] || SCRIPT_NAME.latn}, so a traveler who reads only that script can say it aloud to a pharmacist. Transliterate the sound; do not translate the meaning. Keep numbers and units as they are. Copy each input exactly into "text" and return the lines in input order.`;
}

/**
 * Adds `local_reading` (for local_name) and `local_brands_reading` (one per brand) to each equivalent. A part that
 * the traveler can already read gets "". `ask(texts, script)` returns readings in order; it is skipped when null
 * (on the phone) and a failure only means fewer readings. Returns the items and whether the cache gained anything.
 */
export async function addReadings(items, home, { cache, ask }) {
  const script = scriptOf(home);
  const key = (t) => `${script}:${t}`;
  const known = (t) => cache[key(t)] || (script === "latn" ? CURATED_READINGS[t] : "") || "";
  const texts = [...new Set(items.flatMap((e) => [e.local_name, ...(e.local_brands || [])]).filter((t) => t && needsReading(t, script)))];
  const missing = texts.filter((t) => !known(t));
  let added = false;
  if (missing.length && ask) {
    try {
      const got = await ask(missing, script);
      missing.forEach((t, i) => {
        const r = typeof got?.[i] === "string" ? got[i].trim().slice(0, 200) : "";
        // A "reading" still in the unreadable script is no help.
        if (r && r !== t && !needsReading(r, script)) {
          cache[key(t)] = r;
          added = true;
        }
      });
    } catch {
      /* readings are extra: the names still show without them */
    }
  }
  const read = (t) => (t && needsReading(t, script) ? known(t) : "");
  return {
    items: items.map((e) => ({ ...e, local_reading: read(e.local_name), local_brands_reading: (e.local_brands || []).map(read) })),
    added,
  };
}

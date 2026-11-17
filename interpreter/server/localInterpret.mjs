// Private mode's interpreter step without a language model: what an offline phone translator does.
//   1. language (and so speaker) from the script and common words;
//   2. medicine names found, misheard spellings fixed, against the patient's list and the curated table,
//      including names written in Devanagari ("एस्थालिन" is Asthalin);
//   3. each name swapped for a placeholder, the line translated by NLLB-200 (server/local/sidecar.py), and the
//      placeholder replaced by the name the listener uses ("albuterol (Asthalin)" for a US clinician).
// Returns the same shape the cloud interpreter returns, so /api/interpret post-processes both the same way.
import { CURATED, findCurated, norm } from "./drugs.mjs";
import { translateLocal } from "./local.mjs";
import { FAMILIES, fixHeard } from "./families.mjs";

/* ---------------------------------------------------------------- language */

const SCRIPT_LANGS = [
  [/[ऀ-ॿ]/, ["ne", "hi"]],
  [/[぀-ヿ]/, ["ja"]],
  [/[가-힯]/, ["ko"]],
  [/[一-鿿]/, ["ja", "zh"]],
  [/[؀-ۿ]/, ["ar", "ur", "fa"]],
  [/[Ѐ-ӿ]/, ["ru", "uk"]],
  [/[ঀ-৿]/, ["bn"]],
];
const COMMON = {
  en: /\b(the|and|you|your|i|i'm|is|are|to|of|for|with|this|that|it|have|take|let's|we|my|me|on|in|at|before|after|every|what|how)\b/g,
  es: /\b(el|la|los|las|de|que|y|en|un|una|por|para|con|es|al|del|mi|me|tomo|tengo|está|muy|pero|doctor|gracias|qué|cómo|día|hace)\b|[ñ¿¡áéíóú]/g,
  fr: /\b(le|la|les|de|des|et|je|vous|est|pour|avec|une|un|pas|que)\b/g,
  pt: /\b(o|a|os|as|de|que|e|em|um|uma|para|com|não|eu|você)\b|[ãõç]/g,
  de: /\b(der|die|das|und|ich|sie|ist|nicht|mit|für|ein|eine|zu)\b|[äöüß]/g,
};

export function detectLanguage(text, patientLang, doctorLang) {
  const pair = [patientLang, doctorLang];
  for (const [re, langs] of SCRIPT_LANGS) {
    if (!re.test(text)) continue;
    return pair.find((l) => langs.includes(l)) || langs[0];
  }
  // Latin script: whichever of the two languages its common words look like.
  const t = text.toLowerCase();
  const score = (l) => (COMMON[l] ? (t.match(COMMON[l]) || []).length : 0);
  const latin = pair.filter((l) => !SCRIPT_LANGS.some(([, ls]) => ls.includes(l)));
  if (latin.length === 1) return latin[0];
  if (latin.length === 0) return patientLang;
  return score(patientLang) > score(doctorLang) ? patientLang : doctorLang;
}

/* ---------------------------------------------------------------- spelling-insensitive name matching */

// Devanagari to rough Latin, enough to compare a transliterated brand with its Latin spelling.
const DV_CONS = { क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n", ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n", प: "p", फ: "f", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h", ळ: "l" };
const DV_VOW = { अ: "a", आ: "a", इ: "i", ई: "i", उ: "u", ऊ: "u", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au", ऑ: "o" };
const DV_MATRA = { "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o" };
function romanizeDevanagari(s) {
  let out = "";
  const ch = [...s];
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (DV_CONS[c]) {
      out += DV_CONS[c];
      const next = ch[i + 1] === "़" ? ch[i + 2] : ch[i + 1];
      // Inherent "a" unless a vowel sign or virama follows; dropped at the end of a word, as it's spoken.
      if (!(next in DV_MATRA) && next !== "्" && next !== undefined && /[ऀ-ॿ]/.test(next)) out += "a";
    } else if (DV_VOW[c]) out += DV_VOW[c];
    else if (DV_MATRA[c]) out += DV_MATRA[c];
    else if (c === "ं" || c === "ँ") out += "n";
    else if (c === "ः") out += "h";
    else if (!/[ऀ-ॿ]/.test(c)) out += c;
  }
  return out;
}

// Katakana to rough Latin, so a misheard drug name in Japanese (アモチシシリン) still matches アモキシシリン.
const KANA = Object.fromEntries(
  ("ア:a イ:i ウ:u エ:e オ:o カ:ka キ:ki ク:ku ケ:ke コ:ko サ:sa シ:shi ス:su セ:se ソ:so タ:ta チ:chi ツ:tsu テ:te ト:to " +
    "ナ:na ニ:ni ヌ:nu ネ:ne ノ:no ハ:ha ヒ:hi フ:fu ヘ:he ホ:ho マ:ma ミ:mi ム:mu メ:me モ:mo ヤ:ya ユ:yu ヨ:yo ラ:ra リ:ri " +
    "ル:ru レ:re ロ:ro ワ:wa ヲ:o ン:n ガ:ga ギ:gi グ:gu ゲ:ge ゴ:go ザ:za ジ:ji ズ:zu ゼ:ze ゾ:zo ダ:da ヂ:ji ヅ:zu デ:de ド:do " +
    "バ:ba ビ:bi ブ:bu ベ:be ボ:bo パ:pa ピ:pi プ:pu ペ:pe ポ:po ヴ:vu ャ:ya ュ:yu ョ:yo ァ:a ィ:i ゥ:u ェ:e ォ:o ッ: ー:")
    .split(" ")
    .map((p) => p.split(":")),
);
const romanizeKatakana = (s) => [...s].map((c) => (c in KANA ? KANA[c] : c)).join("");

// Sounds that spelling hides: "Glucofaje" ~ "Glucophage", "Cosar" ~ "Cozaar", "budekort" ~ "Budecort".
function fold(s) {
  // Romanize first: Devanagari vowel signs are combining marks, which the accent strip would delete.
  return romanizeKatakana(romanizeDevanagari(String(s))).normalize("NFKD").replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/ph/g, "f")
    .replace(/(?<=[aeiou])h/g, "")
    .replace(/([kgtdbcjp])h/g, "$1")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/q/g, "k")
    .replace(/x/g, "ks")
    .replace(/z/g, "s")
    .replace(/j/g, "g")
    .replace(/[wv]/g, "b")
    .replace(/y/g, "i")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/(.)\1+/g, "$1")
    .replace(/^[ae](?=s)/, "a");
}

function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/* ---------------------------------------------------------------- medicine names */

const stripDose = (s) => String(s || "").replace(/\s+\d+(\.\d+)?\s*(mg|mcg|µg|g|ml)\b.*$/i, "").replace(/\s*\(.*\)\s*$/, "").trim();

// A patient's medicine by its brand first: "Flexon (ibuprofen + paracetamol)" is the combination, not paracetamol.
const curatedFor = (m) => findCurated(stripDose(m.name)) || findCurated(m.generic) || findCurated(`${m.name} ${m.generic}`);

/** Every name a medicine might be said by: the patient's own list first, then the curated table. */
function nameBook(meds) {
  const book = [];
  const push = (name, entry, med, family = "") => {
    const n = stripDose(name);
    if (n.length >= 4 && !book.some((b) => b.name.toLowerCase() === n.toLowerCase())) book.push({ name: n, entry, med, family, own: Boolean(med), folded: fold(n) });
  };
  for (const m of meds) {
    const entry = curatedFor(m);
    push(m.name, entry, m);
    // "Ventolin inhalador", "Asthalin inhaler": people say the first word.
    const first = stripDose(m.name).split(/\s+/)[0];
    if (first.length >= 5) push(first, entry, m);
    push(String(m.generic || "").split(/[\s+]/)[0], entry, m);
  }
  for (const e of CURATED) {
    const med = meds.find((m) => curatedFor(m) === e) || null;
    push(e.generic.replace(/\s*\(.*\)$/, ""), e, med);
    for (const c of Object.values(e.by)) {
      push(c.name, e, med);
      for (const b of c.brands || []) {
        push(b, e, med);
        const first = b.split(/\s+/)[0];
        if (first.length >= 5 && first !== b) push(first, e, med);
      }
    }
  }
  // Medicines in the risky families the record rules know (diclofenac, ketorolac...), Latin spellings only.
  // Not contrast: "contrast" is an ordinary word the translator should translate.
  for (const [family, words] of Object.entries(FAMILIES)) if (family !== "contrast") for (const w of words) if (/^([a-z]{6,}|[゠-ヿ]{4,})$/.test(w)) push(w, findCurated(w), null, family);
  return book;
}

// A run of katakana is a word of its own: Japanese has no spaces ("アモキシシリンを出します").
const WORD = /[゠-ヿ]+|[\p{L}\p{N}](?:(?![゠-ヿ])[\p{L}\p{M}\p{N}'’-])*/gu;
// Ordinary words a loose match could mistake for a medicine.
const NOT_MEDS = new Set(["inhaler", "inhalador", "insulin", "insulina", "tablets", "tableta", "pastilla", "morning", "mañana"].map(fold));

/** Medicine mentions in `text`: [{start, end, surface, name, entry, med}], left to right, no overlaps. */
export function findMentions(text, meds) {
  const book = nameBook(meds);
  const found = [];
  const taken = (s, e) => found.some((f) => s < f.end && e > f.start);
  // Exact names first, longest first ("ProAir HFA" before "ProAir").
  for (const b of [...book].sort((x, y) => y.name.length - x.name.length)) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${b.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?(?![\\p{L}\\p{N}])`, "giu");
    for (const m of text.matchAll(re)) {
      if (!taken(m.index, m.index + m[0].length)) found.push({ start: m.index, end: m.index + m[0].length, surface: m[0], name: b.name, entry: b.entry, med: b.med, family: b.family });
    }
  }
  // Then near-spellings, one or two words long: what speech recognition does to brand names.
  const words = [...text.matchAll(WORD)].map((m) => ({ s: m.index, e: m.index + m[0].length, w: m[0] }));
  for (let i = 0; i < words.length; i++) {
    // One word first, so a match doesn't swallow its neighbour ("glucofaje dos").
    for (const span of [1, 2]) {
      const ws = words.slice(i, i + span);
      if (ws.length < span) continue;
      // A two-word name is two real words ("Neo Melubrina"), not a name plus "y" or "म".
      if (span > 1 && ws.some((w) => fold(w.w).length < 3)) continue;
      const s = ws[0].s;
      const e = ws[ws.length - 1].e;
      if (taken(s, e)) continue;
      const f = fold(text.slice(s, e));
      if (f.length < 4 || NOT_MEDS.has(f)) continue;
      let best = null;
      for (const b of book) {
        // Loose matches only against the patient's own medicines and longer names: "dolor" is not "Dolo".
        if (!b.own && b.folded.length < 6) continue;
        if (b.folded.length < 4 || Math.abs(b.folded.length - f.length) > 3) continue;
        const d = lev(f, b.folded);
        const ratio = d / Math.max(f.length, b.folded.length);
        if (ratio <= (Math.max(f.length, b.folded.length) < 7 ? 0.2 : 0.25) && (!best || ratio < best.ratio)) best = { b, ratio };
      }
      if (best) {
        found.push({ start: s, end: e, surface: text.slice(s, e), name: best.b.name, entry: best.b.entry, med: best.b.med, family: best.b.family });
        break;
      }
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/** How the listener should hear a medicine: their local name, with the speaker's in brackets when it differs. */
function labelFor(m, { home, local, listener }) {
  const e = m.entry;
  if (!e) return m.name;
  const there = listener === "clinician" ? e.by[local] : e.by[home];
  if (!there) return m.name;
  const target = there.unavailable ? e.generic.replace(/\s*\(.*\)$/, "") : there.name;
  if (!target || norm(target) === norm(m.name)) return m.name;
  return `${target} (${m.name})`;
}

/* ---------------------------------------------------------------- terms machine translation gets wrong */

// A few everyday medical words the translation model mistranslates, handled like medicine names. Per spoken
// language, then per listener language. ("दम" is what Nepali speakers call asthma; NLLB reads it as breath.)
const GLOSSARY = {
  ne: [
    { re: /सि[टत][िी]\s?स्क्यान/u, to: { en: "CT scan", es: "tomografía", ja: "CT検査" } },
    { re: /(?<![ऀ-ॿ])दम(?![ऀ-ॿ])/u, to: { en: "asthma", es: "asma", ja: "喘息" } }],
};

/* ---------------------------------------------------------------- the step */

export async function interpretLocal({ text, patientLang, doctorLang, home, local, forced, meds }) {
  const language = detectLanguage(text, patientLang, doctorLang);
  let speaker = forced || (language === doctorLang && language !== patientLang ? "clinician" : "patient");
  const from = speaker === "clinician" ? doctorLang : patientLang;
  const to = speaker === "clinician" ? patientLang : doctorLang;
  const listener = speaker === "patient" ? "clinician" : "patient";

  // Cleaned: the heard line with medicine names spelled properly.
  text = fixHeard(text);
  const mentions = findMentions(text, meds);
  let cleaned = "";
  let at = 0;
  for (const m of mentions) {
    cleaned += text.slice(at, m.start);
    m.cStart = cleaned.length;
    cleaned += m.name;
    at = m.end;
  }
  cleaned = (cleaned + text.slice(at)).trim();

  // Placeholders the translation model copies through untouched: X1, X2...
  const slots = [];
  let masked = "";
  at = 0;
  const kept = [];
  for (const m of mentions) {
    masked += cleaned.slice(at, m.cStart);
    // A family word in its own script (ペニシリン) is a word the translator knows; a Latin drug name is kept.
    if (!m.entry && !m.med && !/^[A-Za-z]/.test(m.name)) {
      kept.push({ m, label: "" });
      masked += m.name;
      at = m.cStart + m.name.length;
      continue;
    }
    slots.push({ label: labelFor(m, { home, local, listener }), m });
    masked += `X${slots.length}`;
    at = m.cStart + m.name.length;
  }
  masked += cleaned.slice(at);
  for (const g of GLOSSARY[from] || []) {
    if (g.to[to] && g.re.test(masked)) {
      slots.push({ label: g.to[to], glossary: true });
      masked = masked.replace(g.re, `X${slots.length}`);
    }
  }

  // One sentence at a time translates more faithfully than a run-on paragraph.
  const sentences = masked.split(/(?<=[.!?।。？！])\s*/u).filter((s) => /[\p{L}\p{N}]/u.test(s));
  const { texts } = await translateLocal(sentences.length ? sentences : [masked], from, to);
  let translation = texts.join(to === "ja" || to === "zh" ? "" : " ").trim();
  let ok = true;
  slots.forEach((s, i) => {
    // The translator may pluralize a placeholder ("X1s"); the label stands as it is.
    const re = new RegExp(`X\\s?${i + 1}(?!\\d)(?:s\\b)?`);
    if (re.test(translation)) translation = translation.replace(re, s.label);
    else ok = false;
  });
  if (!ok) {
    // The model dropped a placeholder: translate the plain line instead; the route still localizes the names.
    const plain = await translateLocal([cleaned], from, to);
    translation = plain.texts[0] || translation;
  }

  const drugs = [...slots.filter((s) => !s.glossary), ...kept]
    .map(({ label, m }) => ({
      mentioned: m.name,
      translated: ok && label ? label : "",
      generic: m.entry?.generic || stripDose(m.med?.generic || m.name),
      home_name: "",
      local_name: "",
      status: "uncertain",
      note_listener: "",
      note_doctor: "",
      med_id: m.med?.id || "",
    }));
  return { language, speaker, cleaned, translation, drugs };
}

export { fold, romanizeDevanagari };

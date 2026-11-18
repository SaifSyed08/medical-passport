// Risky medicine families, by the words that name a member, in the four demo languages. Lowercase.
// Used by the record rules (server/rules.mjs) and the medicine-name finder (server/localInterpret.mjs).
// Matched as substrings of the lowercased line (so "amoxicilina" also catches "amoxicilina-clavulanato").
export const FAMILIES = {
  penicillin: [
    "penicillin", "penicilina", "amoxicillin", "amoxicilina", "ampicillin", "ampicilina", "augmentin", "amoxil", "dicloxacillin", "piperacillin",
    "ペニシリン", "アモキシシリン", "アンピシリン", "サワシリン", "オーグメンチン",
    "पेनिसिलिन", "एमोक्सिसिलिन", "अमोक्सिसिलिन", "एम्पिसिलिन",
  ],
  nsaid: [
    "nsaid", "aine", "ibuprofen", "diclofenac", "ketorolac", "naproxen", "aspirin", "aspirina", "acetilsalicílico", "acetylsalicylic", "meloxicam",
    "celecoxib", "indomethacin", "indometacina", "advil", "motrin", "voltaren", "toradol", "aleve", "flexon", "loxoprofen",
    "イブプロフェン", "ジクロフェナク", "ケトロラク", "ナプロキセン", "アスピリン", "ロキソニン", "ロキソプロフェン", "ボルタレン", "セレコックス",
    "आइबुप्रोफेन", "इबुप्रोफेन", "आईबुप्रोफेन", "डाइक्लोफेनाक", "डिक्लोफेनाक", "डाईक्लोफेनाक", "केटोरोलाक", "एस्पिरिन", "नेप्रोक्सेन", "फ्लेक्सन",
  ],
  contrast: [
    "contrast", "contraste", "iodinated", "yodado", "dye", "gadolinium", "gadolinio",
    "造影剤", "造影ct", "造影",
    "कन्ट्रास्ट", "कन्ट्राष्ट", "डाइ", "डाई",
  ],
};

// Fixes for what speech recognition does to a few medical words, applied before anything reads the line.
// Each one needs its context, so an ordinary word is never rewritten on its own.
const FIXES = [
  // "दम छ" (I have asthma) run together.
  [/दमछ/gu, "दम छ"],
  // "डाइ" (dye) heard as "दाइ" (elder brother), but only right after a scan: "स्क्यानको दाइले" is the dye.
  [/(स्क्यान\S*\s+)दा(इ|ई)/gu, "$1डा$2"],
];
export const fixHeard = (text) => FIXES.reduce((t, [re, to]) => t.replace(re, to), String(text || ""));

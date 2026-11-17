export const LANGS: Record<string, { name: string; native: string }> = {
  en: { name: "English", native: "English" },
  es: { name: "Spanish", native: "Español" },
  ne: { name: "Nepali", native: "नेपाली" },
  ja: { name: "Japanese", native: "日本語" },
  fr: { name: "French", native: "Français" },
  de: { name: "German", native: "Deutsch" },
  it: { name: "Italian", native: "Italiano" },
  pt: { name: "Portuguese", native: "Português" },
  zh: { name: "Chinese", native: "中文" },
  ko: { name: "Korean", native: "한국어" },
  hi: { name: "Hindi", native: "हिन्दी" },
  ur: { name: "Urdu", native: "اردو" },
  ar: { name: "Arabic", native: "العربية" },
  vi: { name: "Vietnamese", native: "Tiếng Việt" },
  ru: { name: "Russian", native: "Русский" },
  tl: { name: "Tagalog", native: "Tagalog" },
  tr: { name: "Turkish", native: "Türkçe" },
  fa: { name: "Persian", native: "فارسی" },
};

export const COUNTRIES: Record<string, { name: string; flag: string }> = {
  US: { name: "United States", flag: "🇺🇸" },
  NP: { name: "Nepal", flag: "🇳🇵" },
  MX: { name: "Mexico", flag: "🇲🇽" },
  JP: { name: "Japan", flag: "🇯🇵" },
  GB: { name: "United Kingdom", flag: "🇬🇧" },
  IN: { name: "India", flag: "🇮🇳" },
  PK: { name: "Pakistan", flag: "🇵🇰" },
  ES: { name: "Spain", flag: "🇪🇸" },
  FR: { name: "France", flag: "🇫🇷" },
  DE: { name: "Germany", flag: "🇩🇪" },
  IT: { name: "Italy", flag: "🇮🇹" },
  BR: { name: "Brazil", flag: "🇧🇷" },
  CN: { name: "China", flag: "🇨🇳" },
  KR: { name: "South Korea", flag: "🇰🇷" },
  CA: { name: "Canada", flag: "🇨🇦" },
  PH: { name: "Philippines", flag: "🇵🇭" },
  VN: { name: "Vietnam", flag: "🇻🇳" },
  TR: { name: "Turkey", flag: "🇹🇷" },
  AU: { name: "Australia", flag: "🇦🇺" },
};

export const RTL = new Set(["ar", "ur", "fa"]);
export const langName = (c: string) => LANGS[c]?.name || c;
export const langNative = (c: string) => LANGS[c]?.native || c;
// Countries outside COUNTRIES (e.g. AR, CR from the Tessera app) still get their full English name.
let regionNames: Intl.DisplayNames | null = null;
try {
  regionNames = new Intl.DisplayNames(["en"], { type: "region" });
} catch {
  /* very old engines: fall back to the code */
}
const regionName = (c: string) => {
  try {
    return regionNames?.of(c.toUpperCase()) || c;
  } catch {
    return c;
  }
};
export const country = (c: string) => COUNTRIES[c] || { name: regionName(c), flag: "🏳️" };
export const dir = (lang: string) => (RTL.has(lang) ? "rtl" : "ltr");

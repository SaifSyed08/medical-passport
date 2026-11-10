// Curated cross-country medication names for the demo drugs.
// Hand-checked for the demo, not a clinical reference: brand availability changes, and
// local naming never implies interchangeability. Anything not in here falls back to the
// model and is labelled "AI suggestion" in the app.
//
// `unavailable: true` means the medicine is not approved / not sold in that country.

export const CURATED = [
  {
    key: "metamizole",
    generic: "metamizole (dipyrone)",
    by: {
      MX: { name: "metamizol sódico", brands: ["Neo-Melubrina"], strength: "500 mg tablets" },
      US: {
        unavailable: true,
        name: "metamizole (dipyrone)",
        brands: [],
        note: "Not approved in the US (withdrawn in 1977 over agranulocytosis risk). Closest options: acetaminophen (Tylenol) or ibuprofen (Advil, Motrin).",
      },
    },
  },
  {
    key: "salbutamol",
    generic: "salbutamol (albuterol)",
    by: {
      MX: { name: "salbutamol", brands: ["Ventolin"], strength: "100 mcg per puff" },
      US: {
        name: "albuterol",
        brands: ["Ventolin HFA", "Proventil HFA", "ProAir HFA"],
        strength: "90 mcg per puff",
        note: "Same medicine under its US name. US inhalers state the dose leaving the mouthpiece (90 mcg); Mexico and Japan state the valve dose (100 mcg).",
      },
      JP: { name: "サルブタモール", brands: ["サルタノールインヘラー"], strength: "100 µg/噴霧", note: "Same medicine; called salbutamol in Japan (albuterol in the US)." },
      GB: { name: "salbutamol", brands: ["Ventolin Evohaler"], strength: "100 mcg per puff" },
    },
  },
  {
    key: "metformin",
    generic: "metformin",
    by: {
      MX: { name: "metformina", brands: ["Glucophage", "Dabex"] },
      US: { name: "metformin", brands: ["Glucophage"], note: "Same medicine. Dose limits apply when eGFR is below 45; avoid below 30." },
      JP: { name: "メトホルミン", brands: ["メトグルコ"] },
    },
  },
  {
    key: "losartan",
    generic: "losartan",
    by: {
      MX: { name: "losartán", brands: ["Cozaar"] },
      US: { name: "losartan", brands: ["Cozaar"] },
      JP: { name: "ロサルタン", brands: ["ニューロタン"] },
    },
  },
  {
    key: "aspirin-low",
    generic: "aspirin (low dose)",
    by: {
      MX: { name: "ácido acetilsalicílico", brands: ["Aspirina Protect"], strength: "100 mg" },
      US: {
        name: "aspirin (low dose)",
        brands: ["Bayer Low Dose", "Ecotrin"],
        strength: "81 mg",
        note: "Same medicine. Low-dose tablets are 81 mg in the US versus 100 mg in Mexico.",
        strengthDiffers: true,
      },
      JP: { name: "アスピリン", brands: ["バイアスピリン"], strength: "100 mg" },
    },
  },
  {
    key: "amoxicillin",
    generic: "amoxicillin",
    cls: "penicillin",
    by: {
      US: { name: "amoxicillin", brands: ["Amoxil"] },
      MX: { name: "amoxicilina", brands: ["Amoxil"] },
      JP: { name: "アモキシシリン", brands: ["サワシリン", "パセトシン"] },
      GB: { name: "amoxicillin", brands: ["Amoxil"] },
    },
  },
  {
    key: "ceftriaxone",
    generic: "ceftriaxone",
    cls: "cephalosporin",
    by: {
      US: { name: "ceftriaxone", brands: ["Rocephin"] },
      MX: { name: "ceftriaxona", brands: ["Rocephin"] },
      JP: { name: "セフトリアキソン", brands: ["ロセフィン"] },
    },
  },
  {
    key: "tmp-smx",
    generic: "trimethoprim-sulfamethoxazole",
    cls: "sulfonamide",
    by: {
      US: { name: "trimethoprim-sulfamethoxazole", brands: ["Bactrim"] },
      MX: { name: "trimetoprima con sulfametoxazol", brands: ["Bactrim"] },
    },
  },
  {
    key: "acetaminophen",
    generic: "acetaminophen (paracetamol)",
    by: {
      US: { name: "acetaminophen", brands: ["Tylenol"] },
      MX: { name: "paracetamol", brands: ["Tempra", "Tylenol"] },
      JP: { name: "アセトアミノフェン", brands: ["カロナール", "タイレノールA"] },
      GB: { name: "paracetamol", brands: ["Panadol", "Calpol"] },
      IN: { name: "paracetamol", brands: ["Crocin", "Dolo 650"] },
    },
  },
  {
    key: "ibuprofen",
    generic: "ibuprofen",
    by: {
      US: { name: "ibuprofen", brands: ["Advil", "Motrin"] },
      MX: { name: "ibuprofeno", brands: ["Advil", "Motrin"] },
      JP: { name: "イブプロフェン", brands: ["ブルフェン", "イブ"] },
      GB: { name: "ibuprofen", brands: ["Nurofen"] },
    },
  },
  {
    key: "hyoscine-butylbromide",
    generic: "hyoscine butylbromide",
    by: {
      MX: { name: "butilhioscina", brands: ["Buscapina"] },
      US: {
        unavailable: true,
        name: "hyoscine butylbromide",
        brands: [],
        note: "Not sold in the US. For cramping, US clinicians typically use dicyclomine (Bentyl), prescription only.",
      },
    },
  },
  {
    key: "insulin-glargine",
    generic: "insulin glargine",
    by: {
      US: { name: "insulin glargine", brands: ["Lantus", "Basaglar"] },
      JP: { name: "インスリン グラルギン", brands: ["ランタス"] },
      MX: { name: "insulina glargina", brands: ["Lantus"] },
    },
  },
  {
    key: "insulin-lispro",
    generic: "insulin lispro",
    by: {
      US: { name: "insulin lispro", brands: ["Humalog"] },
      JP: { name: "インスリン リスプロ", brands: ["ヒューマログ"] },
      MX: { name: "insulina lispro", brands: ["Humalog"] },
    },
  },
  {
    key: "glucagon-nasal",
    generic: "glucagon nasal powder",
    by: {
      US: { name: "glucagon nasal powder", brands: ["Baqsimi"] },
      JP: { name: "グルカゴン点鼻粉末剤", brands: ["バクスミー"] },
    },
  },
  {
    key: "epinephrine-autoinjector",
    generic: "epinephrine auto-injector",
    by: {
      US: { name: "epinephrine auto-injector", brands: ["EpiPen"] },
      MX: { name: "adrenalina autoinyectable", brands: ["EpiPen"] },
      JP: { name: "アドレナリン自己注射薬", brands: ["エピペン"] },
    },
  },
];

export function norm(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function namesOf(entry) {
  const out = [entry.key, entry.generic];
  for (const c of Object.values(entry.by)) out.push(c.name, ...(c.brands || []));
  return out.map(norm).filter((n) => n.length >= 3);
}

const INDEX = CURATED.map((e) => ({ e, names: namesOf(e) }));

/** Find the curated entry for a free-text medication name ("Ventolin inhalador", "albuterol", "Neo-Melubrina 500 mg"). */
export function findCurated(text) {
  const n = norm(text);
  if (!n) return null;
  let best = null;
  for (const { e, names } of INDEX) {
    for (const name of names) {
      if (n === name || n.includes(name) || (name.length >= 5 && name.includes(n) && n.length >= 5)) {
        if (!best || name.length > best.len) best = { e, len: name.length };
      }
    }
  }
  return best?.e || null;
}

/** Curated entries whose names literally appear in a piece of text (used to ground the interpreter). */
export function curatedMentionedIn(text) {
  const n = norm(text);
  if (!n) return [];
  return INDEX.filter(({ names }) => names.some((name) => name.length >= 4 && n.includes(name))).map(({ e }) => e);
}

function brandsLabel(c) {
  return c.brands?.length ? `${c.name} (${c.brands.join(", ")})` : c.name;
}

/** The home -> local view of a curated entry, or null if the local country isn't covered. */
export function curatedEquivalent(entry, home, local) {
  const h = entry.by[home] || null;
  const l = entry.by[local];
  if (!l) return null;
  let status = "same_name";
  if (l.unavailable) status = "not_available_locally";
  else if (l.strengthDiffers) status = "different_strength";
  else if (h && norm(h.name) !== norm(l.name)) status = "different_name";
  return {
    key: entry.key,
    generic: entry.generic,
    drug_class: entry.cls || "",
    home_name: h ? brandsLabel(h) : "",
    home_strength: h?.strength || "",
    local_name: l.unavailable ? "" : l.name,
    local_brands: l.brands || [],
    local_strength: l.strength || "",
    status,
    note: l.note || "",
    source: "curated",
  };
}

/** One line per entry for the interpreter prompt. */
export function equivalentLine(eq) {
  const local = eq.status === "not_available_locally" ? "NOT AVAILABLE locally" : `${eq.local_name}${eq.local_brands?.length ? ` (brands: ${eq.local_brands.join(", ")})` : ""}`;
  return `- ${eq.generic}: home name ${eq.home_name || "?"}${eq.home_strength ? ` [${eq.home_strength}]` : ""} -> local ${local}${eq.local_strength ? ` [${eq.local_strength}]` : ""}${eq.drug_class ? `; class: ${eq.drug_class}` : ""}${eq.note ? `; note: ${eq.note}` : ""}`;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Clinician-facing text (record cards) names medicines the local way: "Salbutamol inhaler" becomes
 * "Albuterol inhaler" for a US doctor. Only generic names are swapped; brands and unavailable drugs are left alone.
 */
export function localizeNames(text, home, local) {
  if (!text || home === local) return text;
  let out = text;
  for (const e of CURATED) {
    const h = e.by[home];
    const l = e.by[local];
    if (!h || !l || l.unavailable || norm(h.name) === norm(l.name)) continue;
    // Already says it the local way ("Albuterol (salbutamol in Mexico)"): swapping would duplicate the name.
    if (out.toLowerCase().includes(l.name.toLowerCase())) continue;
    const re = new RegExp(`(?<![A-Za-z0-9À-ɏ])${escapeRe(h.name)}(?![A-Za-z0-9À-ɏ])`, "giu");
    out = out.replace(re, (m) => (m[0] === m[0].toUpperCase() ? l.name[0].toUpperCase() + l.name.slice(1) : l.name));
  }
  return out;
}

/**
 * Make sure the listener hears the drug under the name used where they are.
 * Patient -> clinician: "Ventolin" becomes "albuterol (Ventolin)"; clinician -> patient: "albuterol" becomes "salbutamol (albuterol)".
 * Returns { translation, label } where label is the text to highlight, or null if nothing changed.
 */
export function localizeDrug(translation, entry, { home, local, listener }) {
  const from = listener === "clinician" ? entry.by[home] : entry.by[local];
  const to = listener === "clinician" ? entry.by[local] : entry.by[home];
  if (!from || !to) return null;
  const target = to.unavailable ? entry.generic.replace(/\s*\(.*\)$/, "") : to.name;
  if (!target || translation.toLowerCase().includes(target.toLowerCase())) return null;
  // People drop suffixes ("ProAir" for "ProAir HFA", "Aspirina" for "Aspirina Protect"), so try the first word too.
  const brands = (from.brands || []).flatMap((b) => {
    const first = b.split(/\s+/)[0];
    return first !== b && first.length >= 5 ? [b, first] : [b];
  });
  const names = [...new Set([...brands, from.name])].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const n of names) {
    // Word edges only against Latin letters and digits, so "ProAirを" inside Japanese still matches.
    const re = new RegExp(`(?<![A-Za-z0-9À-ɏ])${escapeRe(n)}(?:s)?(?![A-Za-z0-9À-ɏ])`, "iu");
    const m = translation.match(re);
    if (m) {
      const before = translation.slice(0, m.index);
      const after = translation.slice(m.index + m[0].length);
      // The model may already have added its own bracket ("Neo-Melubrina (dipyrone)"): merge instead of nesting.
      const own = after.match(/^\s*[(（]([^)）]*)[)）]/);
      if (own) {
        const label = `${target} (${m[0]}, ${own[1].trim()})`;
        return { translation: before + label + after.slice(own[0].length), label };
      }
      const label = `${target} (${m[0]})`;
      return { translation: before + label + after, label };
    }
  }
  return null;
}

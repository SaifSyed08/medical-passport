import { describe, expect, it } from "vitest";
import { DEFAULT_PRIVACY, LANGUAGES, TRANSLATED_LANGUAGES, type Language } from "@/shared/tessera";
import { currentCard, setFrozen, toCard } from "@/lib/tessera/cards";
import { listAudit } from "@/lib/tessera/audit";
import { emergencyView, mergeTranslations, profileSchema } from "@/lib/tessera/profile";
import { seedIfMissing } from "@/lib/tessera/seed";
import { JORDAN_ID, jordan, jordanProfile } from "@/lib/tessera/seed-data";
import { simulate } from "@/lib/tessera/simulate";
import { getTraveler, listRequests, updateTraveler } from "@/lib/tessera/traveler";
import { buildPassContent, NullPassIssuer, PASS_FIELDS, WalletNotEnabledError } from "@/lib/tessera/wallet";
import { freshDb } from "./d1-shim";

describe("seeded profile", () => {
  it("matches the seed data and passes validation", async () => {
    const { db } = await freshDb();
    await seedIfMissing(db);
    const t = (await getTraveler(db, JORDAN_ID))!;
    expect(t.profile).toStrictEqual(jordanProfile);
    expect(profileSchema.safeParse(t.profile).success).toBe(true);
    expect(t.language).toBe("ja");
    expect(jordanProfile.allergies.map(a => a.severity)).toEqual(expect.arrayContaining(["severe", "mild"]));
    expect(jordanProfile.medications.length).toBeGreaterThanOrEqual(3);
    expect(jordanProfile.conditions.length).toBeGreaterThanOrEqual(2);
    expect(jordanProfile.contacts.some(c => c.phone.startsWith("+1 "))).toBe(true);
  });
});

describe("emergency view", () => {
  const view = (lang: Language, privacy = DEFAULT_PRIVACY) => emergencyView(jordan.name, jordanProfile, privacy, lang);

  it("leads with allergies then medications in every language", () => {
    for (const lang of LANGUAGES) expect(view(lang).sections.slice(0, 2).map(s => s.category)).toEqual(["allergies", "medications"]);
  });

  it("includes every seeded allergy and medication, translated, in every language", () => {
    for (const lang of LANGUAGES) {
      const v = view(lang);
      const allergies = v.sections.find(s => s.category === "allergies")!.items;
      const meds = v.sections.find(s => s.category === "medications")!.items;
      const expected = (a: (typeof jordanProfile.allergies)[number]) => (lang === "en" ? a.substance : a.tr![lang]!.substance);
      expect(allergies.map(i => i.text)).toEqual(jordanProfile.allergies.map(expected));
      expect(meds).toHaveLength(jordanProfile.medications.length);
      for (const [i, m] of jordanProfile.medications.entries()) expect(meds[i].text).toContain(lang === "en" ? m.generic : m.tr![lang]!.generic!);
      expect(allergies[0].severe).toBe(true);
      expect([...allergies, ...meds].every(i => !i.untranslated)).toBe(true);
    }
  });

  it("omits restricted categories and never includes insurance, encounters or documents", () => {
    const v = view("en", { ...DEFAULT_PRIVACY, conditions: "restricted", insurance: "emergency", encounters: "emergency" });
    expect(v.sections.map(s => s.category)).not.toContain("conditions");
    const json = JSON.stringify(v);
    expect(json).not.toContain(jordanProfile.insurance.memberId);
    expect(json).not.toContain(jordanProfile.insurance.plan);
    expect(json).not.toContain(jordan.dob);
  });

  it("marks edited text untranslated instead of keeping a stale translation", () => {
    const edited = structuredClone(jordanProfile);
    edited.allergies[1].substance = "Kiwi and banana";
    const merged = mergeTranslations(jordanProfile, edited);
    for (const lang of TRANSLATED_LANGUAGES) {
      // Only the edited field loses its translations, in every language.
      expect(merged.allergies[1].tr?.[lang]?.substance).toBeUndefined();
      expect(merged.allergies[1].tr?.[lang]?.reaction).toBe(jordanProfile.allergies[1].tr![lang]!.reaction);
      expect(merged.allergies[0].tr?.[lang]).toEqual(jordanProfile.allergies[0].tr![lang]);
      const item = emergencyView(jordan.name, merged, DEFAULT_PRIVACY, lang).sections[0].items[1];
      expect(item).toMatchObject({ text: "Kiwi and banana", untranslated: true });
    }
  });
});

describe("Wallet groundwork", () => {
  it("pass content carries only the card URL, name, branding and instructions", async () => {
    const { db } = await freshDb();
    await seedIfMissing(db);
    const card = toCard((await currentCard(db, JORDAN_ID))!, "https://tessera.example");
    const content = buildPassContent(card, jordan.name);
    expect(Object.keys(content).sort()).toEqual([...PASS_FIELDS].sort());
    expect(content.qrMessage).toBe(card.cardUrl);
    // qrMessage is exactly the card URL (checked above); scan every other field for medical data.
    const json = JSON.stringify({ ...content, qrMessage: "" }).toLowerCase();
    const medical = [
      jordan.dob, "2004-03-12", jordanProfile.bloodType,
      ...jordanProfile.allergies.flatMap(a => [a.substance, a.reaction]),
      ...jordanProfile.medications.flatMap(m => [m.brand, m.generic]),
      ...jordanProfile.conditions.map(c => c.name),
      jordanProfile.insurance.memberId,
    ];
    for (const m of medical) expect(json).not.toContain(m.toLowerCase());
  });

  it("the null issuer refuses cleanly", async () => {
    await expect(new NullPassIssuer().issue()).rejects.toBeInstanceOf(WalletNotEnabledError);
  });
});

describe("presenter simulation", () => {
  it("a frozen card makes the simulated scan fail and logs it", async () => {
    const { db } = await freshDb();
    await seedIfMissing(db);
    await setFrozen(db, JORDAN_ID, true);
    const r = await simulate(db, (await getTraveler(db, JORDAN_ID))!, "emergency_view");
    expect(r).toMatchObject({ ok: false, result: "card_unusable" });
    const log = await listAudit(db, JORDAN_ID);
    expect(log[0]).toMatchObject({ action: "scan", outcome: "denied" });
    expect(log.some(e => e.action === "profile_view" && !e.seeded)).toBe(false);
  });

  it("an unverified clinician never reaches a profile view", async () => {
    const { db } = await freshDb();
    await seedIfMissing(db);
    const r = await simulate(db, (await getTraveler(db, JORDAN_ID))!, "unverified_clinician");
    expect(r.result).toBe("clinician_denied");
    const live = (await listAudit(db, JORDAN_ID)).filter(e => !e.seeded);
    expect(live.some(e => e.action === "profile_view")).toBe(false);
    expect(live.find(e => e.action === "sign_in")!.outcome).toBe("denied");
  });

  it("full-record requests wait for the traveler unless auto-approve is on", async () => {
    const { db } = await freshDb();
    await seedIfMissing(db);
    await simulate(db, (await getTraveler(db, JORDAN_ID))!, "full_request");
    expect((await listRequests(db, JORDAN_ID)).map(r => r.status)).toEqual(["pending"]);
    await updateTraveler(db, JORDAN_ID, { autoApprove: true });
    await simulate(db, (await getTraveler(db, JORDAN_ID))!, "full_request");
    expect((await listRequests(db, JORDAN_ID)).map(r => r.status).sort()).toEqual(["approved", "pending"]);
  });
});

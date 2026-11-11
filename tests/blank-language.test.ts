import { describe, expect, it } from "vitest";
import { DEFAULT_PRIVACY, DESTINATIONS, LANGUAGES, languageForCountry, OTHER_DESTINATION, type Profile } from "@/shared/tessera";
import { cardUrl, currentCard, lookupForScan } from "@/lib/tessera/cards";
import { destinationSchema, emergencyView, identitySchema, profileSchema, upgradeProfile } from "@/lib/tessera/profile";
import { seedIfMissing } from "@/lib/tessera/seed";
import { blankProfile, JORDAN_ID, jordanProfile } from "@/lib/tessera/seed-data";
import { createBlankTraveler, getTraveler, isSample, needsSetup, updateIdentity, updateTraveler } from "@/lib/tessera/traveler";
import { freshDb } from "./d1-shim";

describe("blank traveler", () => {
  it("starts empty, needs setup, and has its own usable card", async () => {
    const { db } = await freshDb();
    await seedIfMissing(db);
    const id = await createBlankTraveler(db);
    const t = (await getTraveler(db, id))!;
    expect(id).not.toBe(JORDAN_ID);
    expect(isSample(t)).toBe(false);
    expect(needsSetup(t)).toBe(true);
    expect(t.profile).toStrictEqual(blankProfile());
    expect(profileSchema.safeParse(t.profile).success).toBe(true);
    const card = (await currentCard(db, id))!;
    expect((await lookupForScan(db, card.cardId)).usable).toBe(true);
    expect(cardUrl("https://x.example", card.cardId)).toBe(`https://x.example/t/${card.cardId}`);
    // Jordan's card is untouched.
    expect((await currentCard(db, JORDAN_ID))!.cardId).not.toBe(card.cardId);
  });

  it("no longer needs setup once a name and date of birth are saved", async () => {
    const { db } = await freshDb();
    const id = await createBlankTraveler(db);
    await updateIdentity(db, id, { name: "Sam Lee", dob: "2003-05-01" });
    expect(needsSetup((await getTraveler(db, id))!)).toBe(false);
  });

  it("shows 'None recorded' rather than inventing data, in every language", () => {
    for (const lang of LANGUAGES) {
      const v = emergencyView("Sam Lee", blankProfile(), DEFAULT_PRIVACY, lang);
      expect(v.sections.map(s => s.category).slice(0, 2)).toEqual(["allergies", "medications"]);
      for (const s of v.sections) {
        expect(s.items).toHaveLength(1);
        expect(s.items[0].empty).toBe(true);
        expect(s.items[0].untranslated).toBe(false);
      }
      expect(JSON.stringify(v).toLowerCase()).not.toMatch(/no known|nkda/);
    }
  });
});

describe("stored-profile upgrade", () => {
  it("moves legacy *Ja fields into tr.ja and leaves current profiles unchanged", () => {
    const legacy = {
      ...blankProfile(),
      allergies: [{ id: "alg_x", substance: "Peanuts", substanceJa: "ピーナッツ", reaction: "Hives", reactionJa: "じんましん", severity: "moderate" }],
      contacts: [{ id: "con_x", name: "A", relationship: "Mother", relationshipJa: "母", phone: "+1 512 555 0100" }],
    } as unknown as Profile;
    const up = upgradeProfile(legacy);
    expect(up.allergies[0]).toStrictEqual({ id: "alg_x", substance: "Peanuts", reaction: "Hives", severity: "moderate", tr: { ja: { substance: "ピーナッツ", reaction: "じんましん" } } });
    expect(up.contacts[0].tr).toStrictEqual({ ja: { relationship: "母" } });
    expect(profileSchema.safeParse(up).success).toBe(true);
    expect(upgradeProfile(jordanProfile)).toStrictEqual(jordanProfile);
  });
});

describe("destination country sets the doctor language", () => {
  it("maps countries to their language and falls back to English", () => {
    expect(languageForCountry("JP")).toBe("ja");
    expect(languageForCountry("MX")).toBe("es");
    expect(languageForCountry("ES")).toBe("es");
    expect(languageForCountry("FR")).toBe("fr");
    expect(languageForCountry("IT")).toBe("it");
    expect(languageForCountry("AT")).toBe("de");
    expect(languageForCountry("GB")).toBe("en");
    expect(languageForCountry(OTHER_DESTINATION)).toBe("en");
    expect(languageForCountry("ZZ")).toBe("en");
    expect(languageForCountry(undefined)).toBe("en");
  });

  it("only accepts listed countries or Other", () => {
    for (const d of DESTINATIONS) expect(destinationSchema.safeParse(d.code).success).toBe(true);
    expect(destinationSchema.safeParse(OTHER_DESTINATION).success).toBe(true);
    expect(destinationSchema.safeParse("ZZ").success).toBe(false);
  });

  it("every destination language is a supported profile language", () => {
    for (const d of DESTINATIONS) expect(LANGUAGES).toContain(d.language);
  });
});

describe("identity validation", () => {
  const ok = (name: string, dob: string) => identitySchema.safeParse({ name, dob }).success;
  it("accepts a real past date and a name", () => expect(ok("Sam Lee", "2003-05-01")).toBe(true));
  it("rejects an empty name", () => expect(ok("   ", "2003-05-01")).toBe(false));
  it("rejects malformed and impossible dates", () => {
    expect(ok("Sam", "05/01/2003")).toBe(false);
    expect(ok("Sam", "2003-02-30")).toBe(false);
    expect(ok("Sam", "1899-12-31")).toBe(false);
  });
  it("rejects a date of birth in the future", () => {
    const next = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    expect(ok("Sam", next)).toBe(false);
  });
});

describe("sample traveler stored before newer translations", () => {
  it("gets the seed's translations for unchanged fields, but not for edited ones", async () => {
    const { db } = await freshDb();
    await seedIfMissing(db);
    // Simulate an old stored profile: Japanese only (legacy shape) and one edited allergy.
    const legacy = structuredClone(jordanProfile) as unknown as Record<string, Record<string, unknown>[]>;
    for (const a of legacy.allergies) {
      const tr = a.tr as Record<string, Record<string, string>>;
      a.substanceJa = tr.ja.substance;
      a.reactionJa = tr.ja.reaction;
      delete a.tr;
    }
    legacy.allergies[1].substance = "Kiwi and banana";
    await updateTraveler(db, JORDAN_ID, { profile: legacy as unknown as Profile });
    const t = (await getTraveler(db, JORDAN_ID))!;
    expect(t.profile.allergies[0].tr?.it?.substance).toBe(jordanProfile.allergies[0].tr!.it!.substance);
    expect(t.profile.allergies[1].tr?.it?.substance).toBeUndefined();
    expect(t.profile.allergies[1].tr?.it?.reaction).toBe(jordanProfile.allergies[1].tr!.it!.reaction);
    expect(t.profile.basics.destinationCountry).toBe("JP");
  });
});

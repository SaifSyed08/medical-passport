import type { Allergy, Condition, Contact, Medication, Profile } from "@shared/tessera";
import { api } from "./api";
import { primeCache } from "./cache";

/** Saves the whole profile (the API validates it) and refreshes the cached copy. */
export async function saveProfile(next: Profile) {
  const saved = await api<Profile>("/profile", { method: "PUT", body: next });
  primeCache("/profile", saved);
  return saved;
}

export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export type ItemKind = "allergy" | "medication" | "condition" | "contact";
export type ListKey = "allergies" | "medications" | "conditions" | "contacts";
type AnyItem = Allergy | Medication | Condition | Contact;

export type FieldDef = { key: string; label: string; required?: boolean; multiline?: boolean; hint?: string; keyboard?: "phone-pad"; options?: { value: string; label: string }[] };

/** Form layout for each list in the profile. English only: the server keeps or drops translations. */
export const ITEM_KINDS: Record<ItemKind, { list: ListKey; prefix: string; title: string; fields: FieldDef[]; blank: () => AnyItem }> = {
  allergy: {
    list: "allergies",
    prefix: "alg",
    title: "Allergy",
    fields: [
      { key: "substance", label: "Substance", required: true },
      { key: "reaction", label: "Reaction", multiline: true },
      { key: "severity", label: "Severity", options: [{ value: "severe", label: "Severe" }, { value: "moderate", label: "Moderate" }, { value: "mild", label: "Mild" }] },
    ],
    blank: () => ({ id: newId("alg"), substance: "", reaction: "", severity: "moderate" }),
  },
  medication: {
    list: "medications",
    prefix: "med",
    title: "Medication",
    fields: [
      { key: "generic", label: "Generic name", required: true, hint: "The ingredient, e.g. albuterol" },
      { key: "brand", label: "Brand name" },
      { key: "dose", label: "Dose" },
      { key: "schedule", label: "When you take it" },
      { key: "purpose", label: "What it's for" },
    ],
    blank: () => ({ id: newId("med"), brand: "", generic: "", dose: "", schedule: "", purpose: "" }),
  },
  condition: {
    list: "conditions",
    prefix: "cnd",
    title: "Condition",
    fields: [
      { key: "name", label: "Condition", required: true },
      { key: "note", label: "Notes for a doctor", multiline: true },
    ],
    blank: () => ({ id: newId("cnd"), name: "", note: "" }),
  },
  contact: {
    list: "contacts",
    prefix: "con",
    title: "Emergency contact",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "relationship", label: "Relationship" },
      { key: "phone", label: "Phone", required: true, keyboard: "phone-pad", hint: "Include the country code, e.g. +1 512 555 0100" },
    ],
    blank: () => ({ id: newId("con"), name: "", relationship: "", phone: "" }),
  },
};

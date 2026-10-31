import { languageForCountry, LANGUAGE_NAMES, type Language } from "@shared/tessera";
import { api } from "./api";
import { primeCache } from "./cache";

/** Light client-side check; the API does the real validation (real date, in the past, after 1900). */
export const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function saveIdentity(name: string, dob: string) {
  return api<{ name: string; dob: string }>("/identity", { method: "PUT", body: { name: name.trim(), dob: dob.trim() } });
}

/** Sets the destination country; the API derives the doctor-facing language from it. */
export async function saveDestination(destinationCountry: string) {
  const r = await api<{ language: Language; destinationCountry: string | null; autoApprove: boolean }>("/prefs", { method: "PUT", body: { destinationCountry } });
  // The destination lives in the profile's basics; drop the cached copy so screens refetch it.
  primeCache("/profile", undefined);
  return r;
}

export const languageLabelFor = (country: string | null | undefined) => LANGUAGE_NAMES[languageForCountry(country)];

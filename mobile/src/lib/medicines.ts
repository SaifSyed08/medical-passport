// Medicine names abroad: what a medicine from home is called in another country.
// Asks the interpreter server (interpreter/server): its checked reference list first, an AI suggestion otherwise.
import { INTERPRETER_URL, interpreterPost } from "./interpreter";

export type DrugStatus = "same_name" | "different_name" | "not_available_locally" | "different_strength" | "uncertain";
/** Same shape as `Equivalent` in interpreter/src/lib/types.ts. */
export type Equivalent = {
  id?: string;
  input?: string;
  generic: string;
  drug_class: string;
  home_name: string;
  local_name: string;
  local_brands: string[];
  local_strength: string;
  /** How to say local_name / each brand, in the script of the traveler's home country; "" when it's already readable. */
  local_reading?: string;
  local_brands_reading?: string[];
  status: DrugStatus;
  note: string;
  source: "curated" | "ai";
};

export const MEDICINES_AVAILABLE = !!INTERPRETER_URL;

/** Only the medicine names and the two country codes are sent; nothing else from the profile. */
export async function findEquivalents(home: string, local: string, items: { id: string; name: string; generic: string }[]): Promise<Equivalent[]> {
  if (!items.length) return [];
  const data = await interpreterPost<{ items?: Equivalent[] }>("/api/equivalents", { home, local, items });
  return Array.isArray(data.items) ? data.items : [];
}

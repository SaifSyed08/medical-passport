// Medicine names abroad: what a medicine from home is called in another country.
// Asks the interpreter server (interpreter/server): its checked reference list first, an AI suggestion otherwise.
import { INTERPRETER_CODE, INTERPRETER_URL } from "./interpreter";

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
  status: DrugStatus;
  note: string;
  source: "curated" | "ai";
};

export const MEDICINES_AVAILABLE = !!INTERPRETER_URL;

/** Only the medicine names and the two country codes are sent; nothing else from the profile. */
export async function findEquivalents(home: string, local: string, items: { id: string; name: string; generic: string }[]): Promise<Equivalent[]> {
  if (!items.length) return [];
  const res = await fetch(`${INTERPRETER_URL}/api/equivalents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(INTERPRETER_CODE ? { "X-Access-Code": INTERPRETER_CODE } : {}) },
    body: JSON.stringify({ home, local, items }),
  });
  if (!res.ok) throw new Error(`equivalents ${res.status}`);
  const data = (await res.json()) as { items?: Equivalent[] };
  return Array.isArray(data.items) ? data.items : [];
}

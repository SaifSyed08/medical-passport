import { z } from "zod";

export const identity = { name: "Alex Morgan", dob: "1994-06-18", sex: "Female" };
export const profileSchema = z.object({
  allergies: z.string().max(500), conditions: z.string().max(800), medications: z.string().max(1000),
  height: z.coerce.number().min(30).max(260), weight: z.coerce.number().min(1).max(500),
  blood: z.enum(["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
  emergencyName: z.string().max(120), emergencyPhone: z.string().max(40), notes: z.string().max(800),
});
export const dataSchema = z.object({
  profile: profileSchema,
  integrations: z.array(z.enum(["apple", "arc"])).min(1).max(2),
  theme: z.enum(["midnight", "pearl", "cobalt", "sage"]),
  photo: z.string().regex(/^$|^\/api\/photo\/[a-f0-9-]{36}$/),
  address: z.object({ street: z.string().min(3).max(160), unit: z.string().max(80), city: z.string().min(2).max(80), region: z.string().min(2).max(80), postal: z.string().min(3).max(20), country: z.string().min(2).max(80) }),
  sms: z.boolean(), phone: z.string().max(40),
}).refine(d => !d.sms || /^[+0-9 ()-]{7,40}$/.test(d.phone), { message: "Enter a valid demo phone number.", path: ["phone"] });
export type Profile = z.infer<typeof profileSchema>;
export type PassportData = z.infer<typeof dataSchema>;
export type Passport = { id: string; token: string; number: string; status: string; created: string; expires: string; arrival: string; data: PassportData };
export type ReadablePassport = Omit<Passport, "data"> & { data: Pick<PassportData, "profile" | "theme" | "photo" | "integrations"> };
export const sampleProfile: Profile = {
  allergies: "Penicillin (hives)", conditions: "Asthma; Seasonal allergies",
  medications: "Albuterol inhaler, 90 mcg per actuation; Cetirizine, 10 mg tablet",
  height: 168, weight: 64, blood: "O+", emergencyName: "Taylor Morgan (sibling)", emergencyPhone: "+1 512 555 0142",
  notes: "No additional notes recorded.",
};
export const initialData: PassportData = { profile: sampleProfile, integrations: [], theme: "midnight", photo: "", address: { street: "", unit: "", city: "", region: "", postal: "", country: "United States" }, sms: false, phone: "" };
export function age(dob = identity.dob) { const d = new Date(dob + "T12:00:00"); const n = new Date(); return n.getFullYear() - d.getFullYear() - (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate()) ? 1 : 0); }
export function date(value: string) { return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
export async function api<T>(path: string, method = "GET", data?: unknown): Promise<T> {
  const r = await fetch(path, { method, ...(data === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }) });
  const body = await r.json() as T & {error?:string}; if (!r.ok) throw new Error(body.error || "Something went wrong. Please try again."); return body;
}

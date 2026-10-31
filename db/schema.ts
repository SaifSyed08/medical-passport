import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const passports = sqliteTable("passports", {
  id: text("id").primaryKey(), owner: text("owner").notNull(),
  token: text("token").notNull().unique(), number: text("number").notNull().unique(),
  status: text("status").notNull(), data: text("data").notNull(),
  created: text("created").notNull(), expires: text("expires").notNull(), arrival: text("arrival").notNull(),
});
export const photos = sqliteTable("photos", {
  id: text("id").primaryKey(), owner: text("owner").notNull(),
});

// Tessera traveler app (mobile). Synthetic demo data only; separate from the website's passports.
export const tesseraTravelers = sqliteTable("tessera_travelers", {
  id: text("id").primaryKey(), name: text("name").notNull(), dob: text("dob").notNull(),
  profile: text("profile").notNull(), privacy: text("privacy").notNull(),
  language: text("language").notNull(), autoApprove: integer("auto_approve").notNull().default(0),
  updated: text("updated").notNull(),
});
export const tesseraCards = sqliteTable("tessera_cards", {
  cardId: text("card_id").primaryKey(), travelerId: text("traveler_id").notNull(),
  serialNumber: text("serial_number").notNull().unique(), status: text("status").notNull(),
  created: text("created").notNull(), replacedBy: text("replaced_by"),
  passLastUpdated: text("pass_last_updated"),
}, t => [index("tessera_cards_traveler").on(t.travelerId)]);
export const tesseraRecords = sqliteTable("tessera_records", {
  id: text("id").primaryKey(), travelerId: text("traveler_id").notNull(),
  kind: text("kind").notNull(), title: text("title").notNull(), date: text("date").notNull(),
  facility: text("facility"), body: text("body"), summary: text("summary"),
  simulated: integer("simulated").notNull().default(0),
  r2Key: text("r2_key"), contentType: text("content_type"), size: integer("size"),
  created: text("created").notNull(),
}, t => [index("tessera_records_traveler").on(t.travelerId)]);
export const tesseraTokens = sqliteTable("tessera_tokens", {
  hash: text("hash").primaryKey(), travelerId: text("traveler_id").notNull(),
  created: text("created").notNull(), expires: text("expires").notNull(), revoked: text("revoked"),
});
// Append-only: triggers in the migration reject UPDATE and DELETE.
export const tesseraAudit = sqliteTable("tessera_audit", {
  seq: integer("seq").primaryKey({ autoIncrement: true }), travelerId: text("traveler_id").notNull(),
  cardId: text("card_id"), actor: text("actor").notNull(), actorRole: text("actor_role").notNull(),
  facility: text("facility"), scope: text("scope"), action: text("action").notNull(),
  outcome: text("outcome").notNull(), detail: text("detail"), seeded: integer("seeded").notNull().default(0),
  at: text("at").notNull(),
}, t => [index("tessera_audit_traveler").on(t.travelerId, t.seq)]);
export const tesseraRequests = sqliteTable("tessera_requests", {
  id: text("id").primaryKey(), travelerId: text("traveler_id").notNull(), cardId: text("card_id").notNull(),
  clinician: text("clinician").notNull(), role: text("role").notNull(), facility: text("facility").notNull(),
  reason: text("reason").notNull(), status: text("status").notNull(),
  created: text("created").notNull(), decided: text("decided"),
}, t => [index("tessera_requests_traveler").on(t.travelerId)]);

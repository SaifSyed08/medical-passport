// Record translations, cached per record content + target language (and whether the phone-sized models made it).
// Shared by POST /api/translate-record (the patient's phone, which may call the model) and
// POST /api/card-translation (the doctor page a card's QR opens, which only ever reads what is already here).
import { createHash } from "node:crypto";

/** The cache key for `record` translated into `to`. The patient's phone and the doctor page send the same record, so they meet here. */
export function recordKey(record, to, local = false) {
  const body = JSON.stringify(record).slice(0, 60_000);
  return `${local ? "local:" : ""}${to}:${createHash("sha256").update(body).digest("hex").slice(0, 24)}`;
}

/** A translation someone already paid for, or undefined. Never calls a model. */
export function cachedTranslation(cache, record, to) {
  if (!record || typeof record !== "object" || typeof to !== "string") return undefined;
  return cache[recordKey(record, to)];
}

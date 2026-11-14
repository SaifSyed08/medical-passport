// Run a document through the extractor's model call locally (no Worker, nothing uploaded):
//   ANTHROPIC_API_KEY=... npx tsx extractor/scripts/try.mjs extractor/samples/a-discharge-summary.pdf
// Optional: MODEL=<model id>. Supports pdf, jpg, jpeg, png. Run from the repo root.
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { callModel } from "../src/anthropic.ts";
import { parseFindings } from "../src/findings.ts";

const TYPES = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
const file = process.argv[2];
const type = TYPES[extname(file ?? "").toLowerCase()];
const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}
if (!type) {
  console.error("Usage: npx tsx extractor/scripts/try.mjs <file.pdf|jpg|jpeg|png>");
  process.exit(1);
}

const raw = await callModel(key, process.env.MODEL || "claude-sonnet-5-5", type, new Uint8Array(readFileSync(file)));
console.log(JSON.stringify(parseFindings(raw), null, 2));

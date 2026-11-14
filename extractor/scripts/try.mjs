// Run a document through OCR and the rules locally (no Worker, nothing uploaded). Start ../ocr/server.py first:
//   npx tsx extractor/scripts/try.mjs extractor/samples/a-discharge-summary.pdf
// Optional: OCR_URL (default http://127.0.0.1:8790). Supports pdf, jpg, jpeg, png. Run from the repo root.
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { parseFindings } from "../src/findings.ts";
import { readText } from "../src/ocr.ts";
import { findFindings } from "../src/rules.ts";

const TYPES = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
const file = process.argv[2];
const type = TYPES[extname(file ?? "").toLowerCase()];
if (!type) {
  console.error("Usage: npx tsx extractor/scripts/try.mjs <file.pdf|jpg|jpeg|png>");
  process.exit(1);
}
const text = await readText(process.env.OCR_URL ?? "http://127.0.0.1:8790", type, new Uint8Array(readFileSync(file)));
console.log(`--- text\n${text}\n--- suggestions`);
console.log(JSON.stringify(parseFindings(findFindings(text)), null, 2));

// Reads a document's text through the local PaddleOCR server (../ocr/server.py). No AI API is involved.

/** Returns the document's text, one OCR line per line. Throws on any failure (message carries the status only). */
export async function readText(ocrUrl: string, contentType: string, bytes: Uint8Array, doFetch: typeof fetch = fetch): Promise<string> {
  const res = await doFetch(`${ocrUrl.replace(/\/$/, "")}/ocr`, { method: "POST", headers: { "Content-Type": contentType }, body: bytes.slice().buffer });
  if (!res.ok) throw new Error(`ocr ${res.status}`);
  const data = (await res.json()) as { text?: unknown };
  if (typeof data.text !== "string") throw new Error("ocr malformed output");
  return data.text;
}

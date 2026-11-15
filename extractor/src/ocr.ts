// Reads a document's text through the local PaddleOCR server (../ocr/server.py). No AI API is involved.

const base = (ocrUrl: string) => ocrUrl.replace(/\/$/, "");

/** Returns the document's text, one OCR line per line. Throws on any failure (message carries the status only). */
export async function readText(ocrUrl: string, contentType: string, bytes: Uint8Array, doFetch: typeof fetch = fetch): Promise<string> {
  const res = await doFetch(`${base(ocrUrl)}/ocr`, { method: "POST", headers: { "Content-Type": contentType }, body: bytes.slice().buffer });
  if (!res.ok) throw new Error(`ocr ${res.status}`);
  const data = (await res.json()) as { text?: unknown };
  if (typeof data.text !== "string") throw new Error("ocr malformed output");
  return data.text;
}

export type JobStatus =
  | { status: "reading"; page: number; pages: number }
  | { status: "done"; page: number; pages: number; text: string }
  | { status: "error" };

/** Starts a background read and returns its id. `owner` identifies the caller: only the same owner can poll the job. */
export async function startJob(ocrUrl: string, contentType: string, bytes: Uint8Array, owner: string, doFetch: typeof fetch = fetch): Promise<string> {
  const res = await doFetch(`${base(ocrUrl)}/jobs`, { method: "POST", headers: { "Content-Type": contentType, "X-Owner": owner }, body: bytes.slice().buffer });
  if (!res.ok) throw new Error(`ocr ${res.status}`);
  const data = (await res.json()) as { id?: unknown };
  if (typeof data.id !== "string" || !data.id) throw new Error("ocr malformed output");
  return data.id;
}

/** A job's progress, or null when the OCR server doesn't know it (finished long ago, restarted, or not yours). */
export async function jobStatus(ocrUrl: string, jobId: string, owner: string, doFetch: typeof fetch = fetch): Promise<JobStatus | null> {
  const res = await doFetch(`${base(ocrUrl)}/jobs/${encodeURIComponent(jobId)}`, { headers: { "X-Owner": owner } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ocr ${res.status}`);
  const d = (await res.json()) as { status?: unknown; page?: unknown; pages?: unknown; text?: unknown };
  const page = typeof d.page === "number" ? d.page : 0;
  const pages = typeof d.pages === "number" ? d.pages : 0;
  if (d.status === "reading") return { status: "reading", page, pages };
  if (d.status === "done" && typeof d.text === "string") return { status: "done", page, pages, text: d.text };
  if (d.status === "error") return { status: "error" };
  throw new Error("ocr malformed output");
}

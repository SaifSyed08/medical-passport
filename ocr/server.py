"""Tessera OCR: reads the text off an uploaded document with PaddleOCR (https://github.com/PaddlePaddle/PaddleOCR).

Runs entirely on this machine: no AI API is called. The extractor Worker (../extractor) posts a document's bytes
to POST /ocr and turns the returned text into profile suggestions with plain rules (extractor/src/rules.ts).

    .venv/bin/python server.py            # http://127.0.0.1:8790
    OCR_PORT=8790 OCR_HOST=127.0.0.1 ...  # defaults

POST /ocr   body: the file (PDF, JPEG or PNG), Content-Type set to its type; waits for the result
            200 {"text": "...", "lines": [{"text": "...", "score": 0.98}], "pages": 1, "ms": 812}
POST /jobs  same body plus an X-Owner header (a hash that identifies the caller); starts a background read
            202 {"id": "<32 hex chars>"}
GET  /jobs/<id>  same X-Owner header; poll for progress
            200 {"status": "reading", "page": 2, "pages": 3}  ...  {"status": "done", "page": 3, "pages": 3, "text": "..."}
            status is "reading", "done" or "error"; an unknown id or a different owner gets 404
GET  /health  200 {"ok": true}

A PDF page that already contains real text is read from that text layer (instant and exact). Scans and photos use OCR.
"""

import hmac
import json
import os
import re
import secrets
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pypdfium2 as pdfium
from paddleocr import PaddleOCR
from PIL import Image, ImageDraw, ImageOps

HOST = os.environ.get("OCR_HOST", "127.0.0.1")
PORT = int(os.environ.get("OCR_PORT", "8790"))
MAX_BYTES = 15 * 1024 * 1024
# Phone photos are ~12 megapixels and take over a minute to read; text is just as readable at 2000 px on the long side.
MAX_SIDE = int(os.environ.get("OCR_MAX_SIDE", "2000"))
SUFFIX = {"application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png"}

# The "mobile" models read a dense page in about half the time of PaddleOCR's default (server) models, with the same
# accuracy on clean text (measured: 22 s vs 43 s on a 40-line page). Set OCR_MODELS=server if blurry photos read poorly.
MODEL_NAMES = {} if os.environ.get("OCR_MODELS", "mobile") == "server" else {
    "text_detection_model_name": "PP-OCRv5_mobile_det",
    "text_recognition_model_name": "PP-OCRv5_mobile_rec",
}
# Documents are photographed or scanned upright; skipping the orientation and unwarping models keeps it fast.
ocr = PaddleOCR(lang="en", use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False, **MODEL_NAMES)
# One model instance, used by one request at a time.
lock = threading.Lock()


def warm_up():
    """The first read after start-up is several seconds slower; do it now so the first scan isn't."""
    with tempfile.NamedTemporaryFile(suffix=".png") as f:
        img = Image.new("RGB", (480, 120), "white")
        ImageDraw.Draw(img).text((20, 45), "warm up 123", fill="black")
        img.save(f.name, "PNG")
        list(ocr.predict(f.name))


def page_lines(res):
    """Boxes on the same row (e.g. "Admitted: …   Discharged: …") become one line, left to right, top to bottom."""
    texts, scores, boxes = res["rec_texts"], res["rec_scores"], res["rec_boxes"]
    items = sorted(
        ({"text": t.strip(), "score": float(s), "x": float(b[0]), "y": (float(b[1]) + float(b[3])) / 2, "h": float(b[3]) - float(b[1])}
         for t, s, b in zip(texts, scores, boxes) if t.strip()),
        key=lambda i: i["y"],
    )
    rows = []
    for it in items:
        if rows and abs(rows[-1][-1]["y"] - it["y"]) < max(6.0, 0.5 * it["h"]):
            rows[-1].append(it)
        else:
            rows.append([it])
    out = []
    for row in rows:
        row.sort(key=lambda i: i["x"])
        out.append({"text": "   ".join(i["text"] for i in row), "score": round(min(i["score"] for i in row), 3)})
    return out


def shrink(path: str, content_type: str):
    """Downscales an oversized photo in place (keeping its orientation), so a 12 MP photo reads in seconds, not minutes."""
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        if max(im.size) <= MAX_SIDE:
            return
        scale = MAX_SIDE / max(im.size)
        small = im.convert("RGB").resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    small.save(path, "PNG" if content_type == "image/png" else "JPEG", **({} if content_type == "image/png" else {"quality": 92}))


# A PDF page with at least this much real text is read from its text layer; scanned pages fall back to OCR.
MIN_TEXT_CHARS = 40


def ocr_image(path: str, content_type: str):
    shrink(path, content_type)
    with lock:
        results = list(ocr.predict(path))
    return [line for res in results for line in page_lines(res)]


def read_pdf(data: bytes, progress):
    pdf = pdfium.PdfDocument(data)
    try:
        pages = len(pdf)
        lines = []
        for i in range(pages):
            progress(i + 1, pages)
            page = pdf[i]
            layer = page.get_textpage().get_text_bounded().replace("\r\n", "\n").strip()
            if len(layer) >= MIN_TEXT_CHARS:
                lines += [{"text": t.strip(), "score": 1.0} for t in layer.split("\n") if t.strip()]
                continue
            with tempfile.NamedTemporaryFile(suffix=".png") as f:
                page.render(scale=2).to_pil().convert("RGB").save(f.name, "PNG")
                lines += ocr_image(f.name, "image/png")
        return lines, pages
    finally:
        pdf.close()


def read(data: bytes, content_type: str, progress=lambda page, pages: None):
    """Returns {"text", "lines", "pages"}. progress(page, pages) is called as each page starts."""
    if content_type == "application/pdf":
        lines, pages = read_pdf(data, progress)
    else:
        progress(1, 1)
        with tempfile.NamedTemporaryFile(suffix=SUFFIX[content_type]) as f:
            f.write(data)
            f.flush()
            lines, pages = ocr_image(f.name, content_type), 1
    return {"text": "\n".join(line["text"] for line in lines), "lines": lines, "pages": pages}


# Background reads, kept in memory only: a finished or abandoned job is dropped after JOB_TTL seconds.
JOB_TTL = 900
MAX_JOBS = 50
JOBS: dict = {}
JOBS_LOCK = threading.Lock()


def run_job(job: dict, data: bytes, content_type: str):
    def progress(page: int, pages: int):
        job["page"], job["pages"] = page, pages

    try:
        out = read(data, content_type, progress)
        job.update(status="done", text=out["text"], pages=out["pages"])
    except Exception as e:  # noqa: BLE001 - never echo document text back in an error
        print(f"[ocr] job failed: {type(e).__name__}")
        job["status"] = "error"


def start_job(data: bytes, content_type: str, owner: str):
    """Returns the new job's id, or None when too many jobs are waiting."""
    now = time.monotonic()
    with JOBS_LOCK:
        for old in [k for k, j in JOBS.items() if now - j["created"] > JOB_TTL]:
            del JOBS[old]
        if len(JOBS) >= MAX_JOBS:
            return None
        job_id = secrets.token_hex(16)
        job = JOBS[job_id] = {"owner": owner, "status": "reading", "page": 0, "pages": 0, "created": now}
    threading.Thread(target=run_job, args=(job, data, content_type), daemon=True).start()
    return job_id


class Handler(BaseHTTPRequestHandler):
    def send(self, status, body):
        raw = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def owner(self) -> str:
        return (self.headers.get("X-Owner") or "").strip()

    def document(self):
        """The uploaded file as (bytes, content_type), or None after sending the error."""
        content_type = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if content_type not in SUFFIX:
            self.send(415, {"error": "Only PDF, JPEG and PNG documents can be read."})
            return None
        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= MAX_BYTES:
            self.send(413, {"error": "The document is empty or too large."})
            return None
        return self.rfile.read(length), content_type

    def do_GET(self):
        if self.path == "/health":
            return self.send(200, {"ok": True})
        match = re.fullmatch(r"/jobs/([0-9a-f]{32})", self.path)
        job = JOBS.get(match.group(1)) if match else None
        if job and hmac.compare_digest(job["owner"], self.owner()):
            body = {"status": job["status"], "page": job["page"], "pages": job["pages"]}
            if job["status"] == "done":
                body["text"] = job["text"]
            return self.send(200, body)
        self.send(404, {"error": "Not found."})

    def do_POST(self):
        if self.path not in ("/ocr", "/jobs"):
            return self.send(404, {"error": "Not found."})
        if self.path == "/jobs" and not 8 <= len(self.owner()) <= 128:
            return self.send(400, {"error": "X-Owner is required."})
        doc = self.document()
        if doc is None:
            return
        data, content_type = doc
        if self.path == "/jobs":
            job_id = start_job(data, content_type, self.owner())
            if job_id is None:
                return self.send(429, {"error": "Too many scans are in progress."})
            return self.send(202, {"id": job_id})
        t0 = time.monotonic()
        try:
            out = read(data, content_type)
        except Exception as e:  # noqa: BLE001 - never echo document text back in an error
            print(f"[ocr] failed: {type(e).__name__}")
            return self.send(422, {"error": "The document could not be read."})
        out["ms"] = round((time.monotonic() - t0) * 1000)
        self.send(200, out)

    def log_message(self, fmt, *args):
        # Request lines only; never the document's contents.
        print(f"[ocr] {self.address_string()} {fmt % args}")


if __name__ == "__main__":
    warm_up()
    print(f"Tessera OCR (PaddleOCR) on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()

"""Tessera OCR: reads the text off an uploaded document with PaddleOCR (https://github.com/PaddlePaddle/PaddleOCR).

Runs entirely on this machine: no AI API is called. The extractor Worker (../extractor) posts a document's bytes
to POST /ocr and turns the returned text into profile suggestions with plain rules (extractor/src/rules.ts).

    .venv/bin/python server.py            # http://127.0.0.1:8790
    OCR_PORT=8790 OCR_HOST=127.0.0.1 ...  # defaults

POST /ocr   body: the file (PDF, JPEG or PNG), Content-Type set to its type
            200 {"text": "...", "lines": [{"text": "...", "score": 0.98}], "pages": 1, "ms": 812}
GET  /health  200 {"ok": true}
"""

import json
import os
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from paddleocr import PaddleOCR

HOST = os.environ.get("OCR_HOST", "127.0.0.1")
PORT = int(os.environ.get("OCR_PORT", "8790"))
MAX_BYTES = 15 * 1024 * 1024
SUFFIX = {"application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png"}

# Documents are photographed or scanned upright; skipping the orientation and unwarping models keeps it fast.
ocr = PaddleOCR(lang="en", use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False)
# One model instance, used by one request at a time.
lock = threading.Lock()


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


def read(data: bytes, content_type: str):
    with tempfile.NamedTemporaryFile(suffix=SUFFIX[content_type]) as f:
        f.write(data)
        f.flush()
        with lock:
            results = list(ocr.predict(f.name))
    lines = [line for res in results for line in page_lines(res)]
    return {"text": "\n".join(line["text"] for line in lines), "lines": lines, "pages": len(results)}


class Handler(BaseHTTPRequestHandler):
    def send(self, status, body):
        raw = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == "/health":
            return self.send(200, {"ok": True})
        self.send(404, {"error": "Not found."})

    def do_POST(self):
        if self.path != "/ocr":
            return self.send(404, {"error": "Not found."})
        content_type = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if content_type not in SUFFIX:
            return self.send(415, {"error": "Only PDF, JPEG and PNG documents can be read."})
        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= MAX_BYTES:
            return self.send(413, {"error": "The document is empty or too large."})
        data = self.rfile.read(length)
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
    print(f"Tessera OCR (PaddleOCR) on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()

"""Private mode's models, all phone-sized and run on this machine: Whisper (speech to text), NLLB-200 (translation)
and Piper (text to speech).

The Node server starts this on demand (server/local.mjs) and talks to it over 127.0.0.1 only, so the patient's
voice and words never leave the laptop. Setup: npm run local:setup.

  POST /stt    {"audio": <base64 WAV>, "langs": ["es", "en"], "terms": ["Glucophage", ...]} -> {"text", "language", "ms"}
  POST /mt     {"texts": ["..."], "from": "es", "to": "en"} -> {"texts": ["..."], "ms"}
  POST /tts    {"text": "...", "lang": "es"} -> audio/wav
  POST /warm   loads both models
  GET  /health
"""

import base64
import io
import json
import os
import sys
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VOICES_DIR = os.environ.get("PIPER_VOICES", os.path.join(ROOT, ".cache", "piper"))
# Whisper small: 244M parameters, about 250 MB as int8, the size whisper.cpp runs on phones.
WHISPER = os.environ.get("LOCAL_STT_MODEL", "small")
# Language packs for speech: a language Whisper small handles badly gets its own fine-tuned small model, loaded
# only when that language is in the room. Nepali: aamoshdahal/whisper-small-nepali converted to int8 (240 MB);
# the multilingual small writes Nepali in Latin letters or as Hindi.
STT_PACKS = {"ne": os.environ.get("LOCAL_STT_NE", os.path.join(ROOT, ".cache", "stt", "small-nepali-ct2"))}
# Languages Whisper's language detector confuses with each other: their probabilities count together.
KIN = {"ne": ["ne", "hi", "mr", "sa"], "hi": ["hi", "ne", "mr"], "ur": ["ur", "hi"]}
# NLLB-200 distilled 600M as int8 (about 600 MB): one translation model for 200 languages, Nepali included.
MT_DIR = os.environ.get("LOCAL_MT_MODEL", os.path.join(ROOT, ".cache", "mt", "nllb-600m-int8"))
NLLB = {
    "en": "eng_Latn", "es": "spa_Latn", "ne": "npi_Deva", "ja": "jpn_Jpan", "fr": "fra_Latn", "de": "deu_Latn", "it": "ita_Latn",
    "pt": "por_Latn", "zh": "zho_Hans", "ko": "kor_Hang", "hi": "hin_Deva", "ur": "urd_Arab", "ar": "arb_Arab", "vi": "vie_Latn",
    "ru": "rus_Cyrl", "tl": "tgl_Latn", "bn": "ben_Beng", "tr": "tur_Latn", "pl": "pol_Latn", "uk": "ukr_Cyrl", "fa": "pes_Arab",
}
VOICES = {
    "en": "en_US-lessac-medium",
    "es": "es_MX-claude-high",
    "ja": "ja_JP-hi_fi_captain-medium",
    "ne": "ne_NP-google-medium",
}


def cuda_dirs():
    """ctranslate2 needs cuBLAS 12. Ollama ships a copy, so borrow it instead of a 1 GB CUDA install."""
    out = []
    if os.environ.get("WHISPER_CUDA_DIR"):
        out.append(os.environ["WHISPER_CUDA_DIR"])
    local = os.environ.get("LOCALAPPDATA")
    if local:
        out.append(os.path.join(local, "Programs", "Ollama", "lib", "ollama", "cuda_v12"))
    return [d for d in out if os.path.isdir(d)]


for d in cuda_dirs():
    os.add_dll_directory(d)
    os.environ["PATH"] = d + os.pathsep + os.environ.get("PATH", "")

stt_lock = threading.Lock()
tts_lock = threading.Lock()
mt_lock = threading.Lock()
_mt = None
_whisper = None
_whisper_device = ""
_packs = {}
_voices = {}


def whisper():
    global _whisper, _whisper_device
    if _whisper is None:
        from faster_whisper import WhisperModel

        try:
            _whisper = WhisperModel(WHISPER, device="cuda", compute_type="int8_float16")
            # transcribe() is lazy: consume it, or a missing CUDA library only shows up on the first real line.
            list(_whisper.transcribe(np.zeros(16000, dtype=np.float32), language="en")[0])
            _whisper_device = "cuda"
        except Exception as e:  # no GPU or no CUDA libraries: a smaller model on the CPU still works
            print(f"[sidecar] GPU Whisper unavailable ({e}); running on the CPU", file=sys.stderr, flush=True)
            _whisper = WhisperModel(WHISPER, device="cpu", compute_type="int8")
            _whisper_device = "cpu"
    return _whisper


def mt():
    global _mt
    if _mt is None:
        import ctranslate2
        import sentencepiece as spm

        sp = spm.SentencePieceProcessor(model_file=os.path.join(MT_DIR, "sentencepiece.bpe.model"))
        # int8 on the CPU: what a phone would run, and fast enough (about half a second a line).
        _mt = (ctranslate2.Translator(MT_DIR, device="cpu", compute_type="int8", inter_threads=1, intra_threads=4), sp)
    return _mt


def translate(body):
    src, tgt = NLLB.get(body.get("from")), NLLB.get(body.get("to"))
    if not src or not tgt:
        raise ValueError(f"no translation pack for {body.get('from')} -> {body.get('to')}")
    texts = [str(t)[:1500] for t in body.get("texts") or []][:64]
    t0 = time.time()
    with mt_lock:
        tr, sp = mt()
        batch = [sp.encode(t, out_type=str) + ["</s>", src] for t in texts]
        res = tr.translate_batch(batch, target_prefix=[[tgt]] * len(batch), beam_size=4, max_decoding_length=256) if batch else []
        out = [sp.decode(r.hypotheses[0][1:]) for r in res]
    return {"texts": out, "ms": int((time.time() - t0) * 1000)}


def pack(lang):
    """The fine-tuned model for `lang` if it has one installed, else None (use the multilingual one)."""
    path = STT_PACKS.get(lang)
    if not path or not os.path.exists(os.path.join(path, "model.bin")):
        return None
    if lang not in _packs:
        from faster_whisper import WhisperModel

        whisper()  # settles which device works
        _packs[lang] = WhisperModel(path, device=_whisper_device, compute_type="int8_float16" if _whisper_device == "cuda" else "int8")
    return _packs[lang]


def voice(lang):
    name = VOICES.get(lang)
    if not name:
        return None
    if name not in _voices:
        from piper import PiperVoice

        path = os.path.join(VOICES_DIR, name + ".onnx")
        if not os.path.exists(path):
            return None
        _voices[name] = PiperVoice.load(path)
    return _voices[name]


def decode_wav(raw):
    w = wave.open(io.BytesIO(raw))
    n, sr, sw = w.getnchannels(), w.getframerate(), w.getsampwidth()
    frames = w.readframes(w.getnframes())
    if sw == 2:
        x = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768
    elif sw == 4:
        x = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / 2**31
    else:
        raise ValueError(f"unsupported sample width {sw}")
    if n > 1:
        x = x.reshape(-1, n).mean(1)
    if sr != 16000:
        x = np.interp(np.arange(0, len(x), sr / 16000), np.arange(len(x)), x).astype(np.float32)
    return x


def stt(body):
    audio = decode_wav(base64.b64decode(body["audio"]))
    langs = [l for l in body.get("langs") or [] if isinstance(l, str)][:2]
    # Short names only (medicines, mostly): a long prompt is what small models echo back on unclear audio.
    terms = [t for t in body.get("terms") or [] if isinstance(t, str) and len(t.split()) <= 3][:12]
    t0 = time.time()
    with stt_lock:
        m = whisper()
        lang = langs[0] if langs else None
        if len(langs) == 2 and langs[0] != langs[1]:
            # Only two people are talking: pick whichever of their two languages the audio sounds most like.
            _, _, probs = m.detect_language(audio)
            p = dict(probs)
            lang = max(langs, key=lambda l: sum(p.get(k, 0.0) for k in KIN.get(l, [l])))
        model = pack(lang) or m

        def run(prompt):
            segs, _ = model.transcribe(
                audio,
                language=lang,
                # Whisper takes a prompt as preceding text, not instructions: the medicine names prime spelling.
                initial_prompt=prompt,
                beam_size=5 if body.get("fast") is not True else 1,
                temperature=0,
                condition_on_previous_text=False,
                vad_filter=False,
            )
            return " ".join(s.text.strip() for s in segs).strip()

        prompt = (", ".join(terms) + ".") if terms else None
        text = run(prompt)
        # Echoed the prompt instead of hearing the audio: listen again without one.
        if terms and sum(t.lower() in text.lower() for t in terms) >= 3:
            text = run(None)
    return {"text": text, "language": lang, "pack": lang in _packs, "ms": int((time.time() - t0) * 1000), "device": _whisper_device}


def tts(body):
    text = str(body.get("text") or "")[:1200]
    v = voice(str(body.get("lang") or "en"))
    if v is None:
        return None
    buf = io.BytesIO()
    with tts_lock:
        with wave.open(buf, "wb") as w:
            v.synthesize_wav(text, w)
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, payload, ctype="application/json"):
        data = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            have = {l: os.path.exists(os.path.join(VOICES_DIR, n + ".onnx")) for l, n in VOICES.items()}
            return self.send(200, {
                "ok": True, "whisper": WHISPER, "loaded": _whisper is not None and _mt is not None, "device": _whisper_device, "voices": have,
                "mt": os.path.exists(os.path.join(MT_DIR, "model.bin")),
            })
        self.send(404, {"error": "not found"})

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
            if self.path == "/stt":
                return self.send(200, stt(body))
            if self.path == "/mt":
                return self.send(200, translate(body))
            if self.path == "/tts":
                wav = tts(body)
                if wav is None:
                    return self.send(404, {"error": f"no local voice for {body.get('lang')}"})
                return self.send(200, wav, "audio/wav")
            if self.path == "/warm":
                with stt_lock:
                    whisper()
                    for l in body.get("langs") or []:
                        pack(l)
                with mt_lock:
                    mt()
                for l in VOICES:
                    voice(l)
                return self.send(200, {"ok": True, "device": _whisper_device})
            self.send(404, {"error": "not found"})
        except Exception as e:
            self.send(500, {"error": f"{type(e).__name__}: {e}"})


if __name__ == "__main__":
    port = int(os.environ.get("SIDECAR_PORT") or (sys.argv[1] if len(sys.argv) > 1 else 5182))
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"[sidecar] listening on 127.0.0.1:{port}", flush=True)
    srv.serve_forever()

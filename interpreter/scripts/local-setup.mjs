// One-time setup for private mode (P): installs the Python packages and downloads the phone-sized models into
// .cache/ (about 1.6 GB). Free; needs Python 3.10+ and an internet connection once. After that, private
// mode runs offline.
//   npm run local:setup [-- --langs es,en,ja,ne]
//
// What lands where:
//   Whisper small (multilingual, CTranslate2)  ~/.cache/huggingface (downloaded on first use, 464 MB, int8 at load)
//   Nepali speech pack (whisper-small-nepali)  .cache/stt/small-nepali-ct2 (int8, 240 MB)
//   NLLB-200 distilled 600M translation        .cache/mt/nllb-600m-int8 (int8, 618 MB)
//   Piper voices, one per language             .cache/piper (60-75 MB each)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const langs = (args.includes("--langs") ? args[args.indexOf("--langs") + 1] : "en,es,ja,ne").split(",");
const PY = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const VOICES = { en: "en_US-lessac-medium", es: "es_MX-claude-high", ja: "ja_JP-hi_fi_captain-medium", ne: "ne_NP-google-medium" };

function run(cmd, argv, opts = {}) {
  console.log(`> ${cmd} ${argv.join(" ")}`);
  const r = spawnSync(cmd, argv, { stdio: "inherit", env: { ...process.env, PYTHONIOENCODING: "utf-8" }, ...opts });
  if (r.status !== 0) {
    console.error(`failed: ${cmd} ${argv.join(" ")}`);
    process.exit(1);
  }
}
const py = (code) => run(PY, ["-c", code]);

// pyopenjtalk-plus: the Japanese voice's phonemizer. torch + transformers: only to convert the Nepali pack.
const pkgs = ["faster-whisper", "ctranslate2", "sentencepiece", "piper-tts", "huggingface_hub"];
if (langs.includes("ja")) pkgs.push("pyopenjtalk-plus");
const nepali = langs.includes("ne") && !fs.existsSync(".cache/stt/small-nepali-ct2/model.bin");
if (nepali) pkgs.push("transformers", "torch");
run(PY, ["-m", "pip", "install", "--user", ...pkgs]);

if (!fs.existsSync(".cache/mt/nllb-600m-int8/model.bin")) {
  py(`from huggingface_hub import snapshot_download; snapshot_download("JustFrederik/nllb-200-distilled-600M-ct2-int8", local_dir=".cache/mt/nllb-600m-int8")`);
}

if (nepali) {
  // Whisper small fine-tuned on Nepali, converted to int8 for CTranslate2.
  run(PY, ["-m", "ctranslate2.converters.transformers", "--model", "aamoshdahal/whisper-small-nepali", "--output_dir", ".cache/stt/small-nepali-ct2",
    "--quantization", "int8", "--copy_files", "tokenizer_config.json", "preprocessor_config.json", "vocab.json", "merges.txt"]);
}

fs.mkdirSync(".cache/piper", { recursive: true });
const want = langs.map((l) => VOICES[l]).filter((v) => v && !fs.existsSync(path.join(".cache/piper", `${v}.onnx`)));
if (want.length) run(PY, ["-m", "piper.download_voices", ...want], { cwd: ".cache/piper" });

// Whisper small: download now rather than on the first spoken line.
py(`from faster_whisper import download_model; download_model("small")`);

console.log(`\nPrivate mode is ready for ${langs.join(", ")}. Start the app (npm run dev) and press P.`);

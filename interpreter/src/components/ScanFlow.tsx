import { useEffect, useState } from "react";
import type { Persona, RecordDoc } from "../lib/types";
import type { Suggestion } from "../../../shared/autofill";
import { analyse, findingKindLabel, findingTitle, readPhoto, toItems } from "../lib/scan";
import { addItems, saveDocFile } from "../lib/edits";
import { Sheet } from "./bits";
import Icon from "./Icon";

type Props = { persona: Persona; file: File; onDone: () => void; onClose: () => void };

/** Photo -> text (Tesseract, on the phone) -> rule-based findings -> the patient ticks what to keep. */
export default function ScanFlow({ persona, file, onDone, onClose }: Props) {
  // Made inside the effect (not useMemo) so StrictMode's remount doesn't revoke the URL the image still uses.
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const [stage, setStage] = useState<"reading" | "review" | "error">("reading");
  const [progress, setProgress] = useState(0);
  const [doc, setDoc] = useState<RecordDoc | null>(null);
  const [findings, setFindings] = useState<Suggestion[]>([]);
  const [keep, setKeep] = useState<Record<string, boolean>>({});
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    let live = true;
    readPhoto(file, persona.recordLanguage, (p) => live && setProgress(p))
      .then((t) => {
        if (!live) return;
        if (t.replace(/\W/g, "").length < 12) return setStage("error");
        const r = analyse(t);
        setText(t);
        setDoc(r.doc);
        setFindings(r.findings);
        setKeep(Object.fromEntries(r.findings.map((f) => [f.id, f.confidence >= 0.5])));
        setStage("review");
      })
      .catch(() => live && setStage("error"));
    return () => {
      live = false;
    };
  }, [file, persona.recordLanguage]);

  const save = () => {
    if (!doc) return;
    const chosen = findings.filter((f) => keep[f.id]);
    saveDocFile(doc.id, { image: thumbnail(document.querySelector<HTMLImageElement>(".scan-photo img")), text: text.slice(0, 6000) });
    addItems(persona.id, { documents: [doc], ...toItems(chosen, doc.id) });
    onDone();
  };

  return (
    <Sheet title="Add a document" onClose={onClose}>
      <div className={`scan ${stage}`}>
        <div className="scan-photo">
          {url && <img src={url} alt="" />}
          {stage === "reading" && <i className="scan-beam" aria-hidden />}
        </div>

        {stage === "reading" && (
          <div className="scan-status" role="status">
            <strong>Reading the document</strong>
            <span>On this phone. Nothing is uploaded.</span>
            <span className="scan-bar">
              <i style={{ width: `${Math.max(6, Math.round(progress * 100))}%` }} />
            </span>
          </div>
        )}

        {stage === "error" && (
          <div className="scan-status">
            <strong>Couldn't read any text</strong>
            <span>Try again in good light, with the page flat and filling the photo.</span>
            <button className="btn-quiet" onClick={onDone}>
              <Icon name="back" size={16} />
              Back to the record
            </button>
          </div>
        )}

        {stage === "review" && doc && (
          <>
            <label className="scan-field">
              <span>Title</span>
              <input value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
            </label>
            <div className="scan-pair">
              <label className="scan-field">
                <span>Date</span>
                <input type="date" value={doc.date} onChange={(e) => setDoc({ ...doc, date: e.target.value })} />
              </label>
              <label className="scan-field">
                <span>From</span>
                <input value={doc.facility} placeholder="Hospital or clinic" onChange={(e) => setDoc({ ...doc, facility: e.target.value })} />
              </label>
            </div>

            <h4 className="scan-h">{findings.length ? "Found in this document" : "Nothing to add to the record"}</h4>
            {findings.length > 0 && (
              <div className="list scan-findings">
                {findings.map((f) => (
                  <label key={f.id} className={`list-row finding ${f.kind} ${keep[f.id] ? "on" : ""}`}>
                    <input type="checkbox" checked={!!keep[f.id]} onChange={(e) => setKeep({ ...keep, [f.id]: e.target.checked })} />
                    <span className="finding-body">
                      <span className="row-top">
                        <strong>{findingTitle(f)}</strong>
                        <span className={`tag ${f.kind === "allergy" ? "danger" : "plain"}`}>{findingKindLabel(f)}</span>
                      </span>
                      <span className="finding-quote">“{f.quote}”</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {!findings.length && <p className="fine">The document is still saved, so the clinician can read it.</p>}

            <button className="link scan-text-toggle" onClick={() => setShowText(!showText)}>
              {showText ? "Hide the text we read" : "Show the text we read"}
            </button>
            {showText && <pre className="scan-text">{text}</pre>}

            <div className="scan-actions">
              <button className="btn-quiet" onClick={onDone}>
                Cancel
              </button>
              <button className="btn-primary" onClick={save}>
                <Icon name="check" />
                Add to record
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** A small JPEG of the photo for the record's thumbnail and preview (about 30 KB). */
function thumbnail(img: HTMLImageElement | null): string | undefined {
  if (!img || !img.naturalWidth) return undefined;
  const scale = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const g = c.getContext("2d");
  if (!g) return undefined;
  g.drawImage(img, 0, 0, c.width, c.height);
  try {
    return c.toDataURL("image/jpeg", 0.72);
  } catch {
    return undefined;
  }
}

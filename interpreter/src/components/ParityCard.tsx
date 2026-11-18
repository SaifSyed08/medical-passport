// The patient's Parity card on the Card tab, with the QR a doctor scans, plus the profile details a doctor or
// clinic desk may ask for (basics and insurance). Card look follows the Tessera app's card (mobile/src/components/card-face.tsx).
import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { PERSONAS } from "../data/personas";
import { hasEdits, saveProfile } from "../lib/edits";
import type { Insurance, Persona } from "../lib/types";
import { Sheet } from "./bits";
import Icon from "./Icon";

/** Where a doctor lands after scanning: this server's own doctor page, for a built-in patient. */
export const cardUrl = (id: string) => `${window.location.origin}/card/${encodeURIComponent(id)}`;
/** Only the built-in patients have a page a doctor's phone can open (their record ships with the app). */
export const hasCard = (id: string) => PERSONAS.some((p) => p.id === id);

function useQr(text: string) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#17243a", light: "#ffffff" } })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(""));
    return () => {
      live = false;
    };
  }, [text]);
  return svg;
}

function Mark({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden>
      <rect x="2" y="7" width="24" height="5.5" rx="2.75" fill="currentColor" />
      <rect x="2" y="15.5" width="24" height="5.5" rx="2.75" fill="currentColor" opacity=".55" />
    </svg>
  );
}

export function CardFace({ persona, onOpen }: { persona: Persona; onOpen: () => void }) {
  const svg = useQr(cardUrl(persona.id));
  return (
    <button className="parity-card" onClick={onOpen} aria-label={`${persona.name}'s Parity card. Open the QR code for a doctor`}>
      <span className="pc-watermark" aria-hidden>
        <Mark size={260} />
      </span>
      <span className="pc-top">
        <span className="pc-brand">
          <Mark /> Parity
        </span>
        <span className="pc-chip">Show to a doctor</span>
      </span>
      <span className="pc-bottom">
        <span className="pc-who">
          <span className="pc-kicker">Medical card · demo</span>
          <span className="pc-name">{persona.name}</span>
          <span className="pc-meta">
            Born {persona.dob} · {persona.bloodType}
          </span>
        </span>
        <span className="pc-qr" aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />
      </span>
    </button>
  );
}

export function CardQr({ persona, onClose }: { persona: Persona; onClose: () => void }) {
  const url = cardUrl(persona.id);
  const svg = useQr(url);
  const edited = hasEdits(persona.id);
  return (
    <Sheet title="Show this to a doctor" onClose={onClose}>
      <div className="card-qr">
        <div className="card-qr-code" role="img" aria-label={`QR code for ${persona.name}'s emergency information`} dangerouslySetInnerHTML={{ __html: svg }} />
        <strong>{persona.name}</strong>
        <p>The doctor scans it with their phone's camera, enters your date of birth, and sees your allergies, medicines and conditions in their language.</p>
        {edited && <p className="fine">The QR shows your saved record. Changes made on this phone aren't included.</p>}
        <a className="fine card-qr-link" href={url} target="_blank" rel="noreferrer">
          {url.replace(/^https?:\/\//, "")}
        </a>
      </div>
    </Sheet>
  );
}

const cm = (v?: number | null) => (v == null ? "—" : `${v} cm`);
const kg = (v?: number | null) => (v == null ? "—" : `${v} kg`);

/** Basics and insurance on the Card tab, in the same section style as the record above them. */
export function ProfileExtras({ persona }: { persona: Persona }) {
  const [editing, setEditing] = useState<"basics" | "insurance" | null>(null);
  const ins = persona.insurance;
  const hasIns = !!ins && Object.values(ins).some((v) => v.trim());
  return (
    <>
      <section className="rec-section basics">
        <header>
          <Icon name="user" size={24} className="rec-icon" />
          <span className="rec-title">Basics</span>
          <button className="add-btn" onClick={() => setEditing("basics")} aria-label="Edit basics">
            <Icon name="pencil" size={15} /> Edit
          </button>
        </header>
        <div className="list">
          <div className="list-row vitals">
            <span className="vital">
              <b>{persona.bloodType || "—"}</b>
              <small>Blood type</small>
            </span>
            <span className="vital">
              <b>{cm(persona.heightCm)}</b>
              <small>Height</small>
            </span>
            <span className="vital">
              <b>{kg(persona.weightKg)}</b>
              <small>Weight</small>
            </span>
            {persona.sex && (
              <span className="vital">
                <b>{persona.sex}</b>
                <small>Sex</small>
              </span>
            )}
          </div>
        </div>
      </section>
      <section className="rec-section insurance">
        <header>
          <Icon name="card" size={24} className="rec-icon" />
          <span className="rec-title">Insurance</span>
          <button className="add-btn" onClick={() => setEditing("insurance")} aria-label="Edit insurance">
            <Icon name="pencil" size={15} /> Edit
          </button>
        </header>
        <div className="list">
          <div className="list-row">
            {hasIns ? (
              <>
                <span className="row-top">
                  <strong>{ins!.plan || "Plan not recorded"}</strong>
                </span>
                <span>{[ins!.memberId && `Member ${ins!.memberId}`, ins!.group && `Group ${ins!.group}`].filter(Boolean).join(" · ")}</span>
                {ins!.phone && <span>{ins!.phone}</span>}
              </>
            ) : (
              <span>None recorded yet.</span>
            )}
          </div>
        </div>
      </section>
      {editing === "basics" && <BasicsForm persona={persona} onClose={() => setEditing(null)} />}
      {editing === "insurance" && <InsuranceForm persona={persona} onClose={() => setEditing(null)} />}
    </>
  );
}

const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return s.trim() && Number.isFinite(n) && n > 0 && n < 400 ? Math.round(n) : null;
};
const BLOOD = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-", "unknown"];

function BasicsForm({ persona, onClose }: { persona: Persona; onClose: () => void }) {
  const [blood, setBlood] = useState(persona.bloodType);
  const [height, setHeight] = useState(persona.heightCm == null ? "" : String(persona.heightCm));
  const [weight, setWeight] = useState(persona.weightKg == null ? "" : String(persona.weightKg));
  const [sex, setSex] = useState(persona.sex);
  const save = (e: FormEvent) => {
    e.preventDefault();
    saveProfile(persona.id, { bloodType: blood, heightCm: num(height), weightKg: num(weight), sex: sex.trim() });
    onClose();
  };
  return (
    <Sheet title="Basics" onClose={onClose}>
      <form className="manual" onSubmit={save}>
        <div className="scan-field">
          <span>Blood type</span>
          <div className="seg wrap">
            {BLOOD.map((b) => (
              <button type="button" key={b} className={blood === b ? "on" : ""} onClick={() => setBlood(b)}>
                {b === "unknown" ? "Don't know" : b}
              </button>
            ))}
          </div>
        </div>
        <label className="scan-field">
          <span>Height (cm)</span>
          <input inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 170" />
        </label>
        <label className="scan-field">
          <span>Weight (kg)</span>
          <input inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 65" />
        </label>
        <label className="scan-field">
          <span>Sex</span>
          <input value={sex} onChange={(e) => setSex(e.target.value)} placeholder="e.g. Female" />
        </label>
        <div className="scan-actions">
          <button type="button" className="btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            <Icon name="check" />
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function InsuranceForm({ persona, onClose }: { persona: Persona; onClose: () => void }) {
  const [v, setV] = useState<Insurance>(persona.insurance ?? { plan: "", memberId: "", group: "", phone: "" });
  const fields: { key: keyof Insurance; label: string; placeholder: string; type?: string }[] = [
    { key: "plan", label: "Plan", placeholder: "e.g. Student travel health" },
    { key: "memberId", label: "Member ID", placeholder: "On your insurance card" },
    { key: "group", label: "Group", placeholder: "If your card has one" },
    { key: "phone", label: "Phone for doctors", placeholder: "+1 …", type: "tel" },
  ];
  const save = (e: FormEvent) => {
    e.preventDefault();
    saveProfile(persona.id, { insurance: { plan: v.plan.trim(), memberId: v.memberId.trim(), group: v.group.trim(), phone: v.phone.trim() } });
    onClose();
  };
  return (
    <Sheet title="Insurance" onClose={onClose}>
      <form className="manual" onSubmit={save}>
        {fields.map((f, i) => (
          <label key={f.key} className="scan-field">
            <span>{f.label}</span>
            <input autoFocus={i === 0} type={f.type || "text"} value={v[f.key]} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
          </label>
        ))}
        <div className="scan-actions">
          <button type="button" className="btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            <Icon name="check" />
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}

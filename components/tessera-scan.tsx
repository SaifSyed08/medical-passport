"use client";
import { useState, useSyncExternalStore } from "react";
import { ArrowRight, Droplet, Globe2, HeartPulse, LockKeyhole, Phone, Pill, ShieldAlert } from "lucide-react";
import { DEMO_NOTICE, LANGUAGE_NAMES, LANGUAGES, type Category, type EmergencyView, type Language } from "@/shared/tessera";

// What a doctor sees after scanning a Tessera card: a date-of-birth check, then the emergency profile.
// The profile comes from POST /api/v1/scan/{cardId}; nothing about the patient is in this page until the date matches.

type Copy = { title: string; lead: string; dob: string; open: string; opening: string; mismatch: string; locked: string; failed: string; kicker: string; selfReported: string; language: string };
// Hand-written and unreviewed, like the rest of the doctor-facing strings (see TRANSLATION_REVIEW.md).
const COPY: Record<Language, Copy> = {
  en: { title: "Confirm the patient", lead: "Enter the patient's date of birth to see their emergency information.", dob: "Patient's date of birth", open: "View information", opening: "Opening…", mismatch: "That date of birth doesn't match this card.", locked: "Too many tries. Wait 15 minutes, then try again.", failed: "This card can't be opened right now.", kicker: "Emergency information", selfReported: "Entered by the patient. Confirm with the patient where possible.", language: "Language" },
  ja: { title: "患者さんの確認", lead: "緊急時の情報を表示するには、患者さんの生年月日を入力してください。", dob: "患者さんの生年月日", open: "情報を表示", opening: "開いています…", mismatch: "生年月日がこのカードと一致しません。", locked: "試行回数が多すぎます。15分後にもう一度お試しください。", failed: "このカードは現在開けません。", kicker: "緊急時の情報", selfReported: "患者さん本人が入力した情報です。可能な限り本人に確認してください。", language: "言語" },
  es: { title: "Confirme al paciente", lead: "Introduzca la fecha de nacimiento del paciente para ver su información de emergencia.", dob: "Fecha de nacimiento del paciente", open: "Ver información", opening: "Abriendo…", mismatch: "Esa fecha de nacimiento no coincide con esta tarjeta.", locked: "Demasiados intentos. Espere 15 minutos y vuelva a intentarlo.", failed: "Esta tarjeta no se puede abrir en este momento.", kicker: "Información de emergencia", selfReported: "Información introducida por el paciente. Confírmela con el paciente si es posible.", language: "Idioma" },
  fr: { title: "Confirmez le patient", lead: "Saisissez la date de naissance du patient pour voir ses informations d'urgence.", dob: "Date de naissance du patient", open: "Voir les informations", opening: "Ouverture…", mismatch: "Cette date de naissance ne correspond pas à cette carte.", locked: "Trop de tentatives. Attendez 15 minutes, puis réessayez.", failed: "Cette carte ne peut pas être ouverte pour le moment.", kicker: "Informations d'urgence", selfReported: "Informations saisies par le patient. Confirmez-les avec lui si possible.", language: "Langue" },
  it: { title: "Conferma il paziente", lead: "Inserisca la data di nascita del paziente per vedere le informazioni di emergenza.", dob: "Data di nascita del paziente", open: "Mostra informazioni", opening: "Apertura…", mismatch: "Questa data di nascita non corrisponde a questa tessera.", locked: "Troppi tentativi. Attenda 15 minuti e riprovi.", failed: "Questa tessera non può essere aperta in questo momento.", kicker: "Informazioni di emergenza", selfReported: "Informazioni inserite dal paziente. Se possibile, le confermi con il paziente.", language: "Lingua" },
  de: { title: "Patient bestätigen", lead: "Geben Sie das Geburtsdatum des Patienten ein, um die Notfallinformationen zu sehen.", dob: "Geburtsdatum des Patienten", open: "Informationen anzeigen", opening: "Wird geöffnet…", mismatch: "Dieses Geburtsdatum passt nicht zu dieser Karte.", locked: "Zu viele Versuche. Bitte 15 Minuten warten und erneut versuchen.", failed: "Diese Karte kann derzeit nicht geöffnet werden.", kicker: "Notfallinformationen", selfReported: "Vom Patienten selbst eingetragen. Wenn möglich mit dem Patienten abklären.", language: "Sprache" },
};

const ICONS: Partial<Record<Category, typeof Pill>> = { allergies: ShieldAlert, medications: Pill, conditions: HeartPulse, bloodType: Droplet, contacts: Phone };

const noSubscribe = () => () => {};
function browserLanguage(): Language {
  const l = navigator.language.slice(0, 2).toLowerCase() as Language;
  return LANGUAGES.includes(l) ? l : "en";
}

export function TesseraScan({ cardId }: { cardId: string }) {
  const [picked, setPicked] = useState<Language | undefined>(undefined);
  const [dob, setDob] = useState("");
  const [view, setView] = useState<EmergencyView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // The page chrome follows the doctor's browser; the record itself opens in the language the patient set for the trip.
  const ui = useSyncExternalStore(noSubscribe, browserLanguage, () => "en" as Language);
  const t = COPY[view?.language ?? ui];

  async function load(lang: Language | undefined, again: boolean) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/scan/${encodeURIComponent(cardId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob, ...(lang ? { lang } : {}), ...(again ? { again: true } : {}) }),
      });
      if (res.ok) setView((await res.json()) as EmergencyView);
      else {
        const code = ((await res.json().catch(() => ({}))) as { code?: string }).code;
        // A card frozen or replaced while the page is open closes the record too.
        if (code !== "mismatch" && code !== "locked") setView(null);
        setError(code === "mismatch" ? t.mismatch : code === "locked" ? t.locked : t.failed);
      }
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  if (!view)
    return (
      <main className="gate-panel" lang={ui}>
        <div className="professional-icon"><LockKeyhole size={25} strokeWidth={1.3} /></div>
        <h1>{t.title}</h1>
        <p className="lead">{t.lead}</p>
        <form onSubmit={e => { e.preventDefault(); void load(picked, false); }}>
          <label className="field">
            <span>{t.dob}</span>
            <input type="date" required autoComplete="off" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={e => setDob(e.target.value)} />
          </label>
          <button type="submit" className="button primary" disabled={busy || !dob}>{busy ? t.opening : t.open}<ArrowRight size={17} /></button>
        </form>
        {error && <p role="alert" className="error-note">{error}</p>}
        <p className="notice">{DEMO_NOTICE}</p>
      </main>
    );

  return (
    <main className="reader scan-reader" lang={view.language}>
      <div className="reader-toolbar">
        <span>{t.kicker}</span>
        <label className="language-picker">
          <Globe2 size={15} />
          <select aria-label={t.language} value={view.language} disabled={busy} onChange={e => { const l = e.target.value as Language; setPicked(l); void load(l, true); }}>
            {LANGUAGES.map(l => <option key={l} value={l}>{LANGUAGE_NAMES[l]}</option>)}
          </select>
        </label>
      </div>
      <h1 className="scan-name">{view.name}</h1>
      <p className="record-notice">{t.selfReported}</p>
      {error && <p role="alert" className="error-note">{error}</p>}
      <div className="medical-grid">
        {view.sections.map(s => {
          const Icon = ICONS[s.category] ?? Pill;
          return (
            <section key={s.category} className={`medical-section ${s.category === "allergies" ? "allergies wide" : s.category === "medications" ? "wide" : ""}`}>
              <h2><Icon />{s.title}</h2>
              <div className="medicine-list">
                {s.items.map((it, i) => (
                  <div key={i} className={it.empty ? "scan-empty" : undefined}>
                    <span className={it.severe ? "scan-severe" : undefined}>{it.text}</span>
                    {it.untranslated && <span className="scan-en" title="English">EN</span>}
                    {it.detail && <small>{it.detail}</small>}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <p className="notice">{DEMO_NOTICE}</p>
    </main>
  );
}

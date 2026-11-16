// A dropdown drawn by the app instead of the browser's native <select>: a pill that opens a short list inside
// the phone, with flags or native names, a check on the current choice, and keyboard support.
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";

export type PickerOption = { value: string; label: string; hint?: string; icon?: ReactNode };

export default function Picker({ value, options, onChange, label, className = "" }: { value: string; options: PickerOption[]; onChange: (v: string) => void; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [hi, setHi] = useState(0);
  // Sideways nudge so the list never spills out of the phone.
  const [shift, setShift] = useState(0);
  const wrap = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const cur = options.find((o) => o.value === value) || options[0];

  const show = () => {
    setShift(0);
    setHi(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const pick = (v: string) => {
    setOpen(false);
    if (v !== value) onChange(v);
  };

  // Open upwards when there isn't room under the pill inside the phone.
  useLayoutEffect(() => {
    if (!open || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    const app = (wrap.current.closest(".app") || document.body).getBoundingClientRect();
    setUp(app.bottom - r.bottom < 300 && r.top - app.top > app.bottom - r.bottom);
    // Measured from the layout box, not the on-screen rect, which is mid scale-in animation here.
    const el = list.current;
    if (el) {
      const left = r.left + el.offsetLeft;
      const right = left + el.offsetWidth;
      setShift(right > app.right - 12 ? app.right - 12 - right : left < app.left + 12 ? app.left + 12 - left : 0);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(".on")?.scrollIntoView({ block: "nearest" });
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", away, true);
    return () => window.removeEventListener("pointerdown", away, true);
  }, [open]);
  useEffect(() => {
    list.current?.children[hi]?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  return (
    <span className={`picker ${open ? "open" : ""} ${up ? "up" : ""} ${className}`} ref={wrap}>
      <button
        type="button"
        className="picker-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}: ${cur?.label}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) return show();
            setHi((h) => (h + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
          } else if (open && e.key === "Enter") {
            e.preventDefault();
            pick(options[hi].value);
          } else if (open && e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {cur?.icon}
        <span className="picker-value">{cur?.label}</span>
        <Icon name="chevron" size={15} className="picker-chev" />
      </button>
      {open && (
        <ul className="picker-list" role="listbox" id={id} ref={list} aria-label={label} style={shift ? { translate: `${shift}px 0` } : undefined}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`${o.value === value ? "on" : ""} ${i === hi ? "hi" : ""}`}
              onPointerEnter={() => setHi(i)}
              onClick={() => pick(o.value)}
            >
              {o.icon}
              <span className="picker-label">
                {o.label}
                {o.hint && <small>{o.hint}</small>}
              </span>
              {o.value === value && <Icon name="check" size={18} />}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

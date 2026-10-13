import { useEffect, useRef, useState } from "react";
import { formatPrice, licenses } from "../data/site";
import { toggleBeat, useEngineState } from "../hooks/useEngine";
import { useCart } from "../state/cart";
import { Check, Close, Pause, Play } from "./Icons";
import "./Overlays.css";

export default function LicenseModal() {
  const { licenseFor: beat, chooseLicense, add, lines, setOpen } = useCart();
  const { playingId } = useEngineState();
  const current = beat ? lines.find((l) => l.beatId === beat.id)?.licenseId : undefined;
  const [pick, setPick] = useState("wav");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!beat) return;
    setPick(current ?? "wav");
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && chooseLicense(null);
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [beat]);

  if (!beat) return null;
  const chosen = licenses.find((l) => l.id === pick)!;
  const playing = playingId === beat.id;

  const confirm = () => {
    add({ beatId: beat.id, licenseId: pick });
    chooseLicense(null);
    setOpen(true);
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && chooseLicense(null)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lic-title"
        ref={panel}
        tabIndex={-1}
      >
        <header className="modal__head">
          <button className="modal__play" onClick={() => toggleBeat(beat)} aria-label={playing ? "עצירה" : "ניגון"}>
            {playing ? <Pause /> : <Play />}
          </button>
          <div>
            <p className="mono modal__k">בחירת רישיון</p>
            <h2 id="lic-title" className="latin modal__title">
              {beat.title}
            </h2>
            <p className="modal__meta mono" dir="ltr">
              {beat.bpm} BPM · {beat.key} · {beat.genre}
            </p>
          </div>
          <button className="icon-btn" onClick={() => chooseLicense(null)} aria-label="סגירה">
            <Close />
          </button>
        </header>

        <div className="lic-list" role="radiogroup" aria-label="רישיונות">
          {licenses.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={pick === l.id}
              className={`lic ${pick === l.id ? "is-on" : ""}`}
              onClick={() => setPick(l.id)}
            >
              <span className="lic__dot" aria-hidden="true" />
              <span className="lic__main">
                <span className="lic__name latin">{l.name}</span>
                <span className="lic__files">{l.files}</span>
                <span className="lic__perks">{l.perks.slice(0, 3).join(" · ")}</span>
              </span>
              <span className="lic__price">{formatPrice(l.price)}</span>
            </button>
          ))}
        </div>

        <footer className="modal__foot">
          <p>
            {chosen.price === null
              ? "ב-Exclusive המחיר נקבע מול גל לפי הפרויקט."
              : "התשלום מול גל אחרי שליחת ההזמנה. קבצים בלי תג קולי."}
          </p>
          <button className="btn btn--hot" onClick={confirm}>
            {current ? <Check /> : null}
            {current ? "עדכון בעגלה" : chosen.price === null ? "הוספה לעגלה כבקשת הצעה" : `הוספה לעגלה · ${formatPrice(chosen.price)}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

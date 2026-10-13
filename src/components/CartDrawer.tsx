import { useEffect, useRef, useState } from "react";
import { formatPrice, waLink } from "../data/site";
import { useCart } from "../state/cart";
import { Close, WhatsApp } from "./Icons";
import "./Overlays.css";

export default function CartDrawer() {
  const { lines, total, hasQuote, remove, open, setOpen, chooseLicense } = useCart();
  const [name, setName] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [open, setOpen]);

  const message = [
    "היי גל! אני רוצה להזמין ביטים מהאתר:",
    ...lines.map((l) => `• ${l.beat.title} — ${l.license.name} (${formatPrice(l.license.price)})`),
    "",
    `סה״כ: ${formatPrice(total)}${hasQuote ? " + הצעה ל-Exclusive" : ""}`,
    name.trim() ? `שם: ${name.trim()}` : "",
  ]
    .filter((x, i, a) => x !== "" || a[i - 1] !== "")
    .join("\n");

  return (
    <div className={`drawer-wrap ${open ? "is-open" : ""}`} aria-hidden={!open} inert={!open}>
      <div className="drawer-scrim" onClick={() => setOpen(false)} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" ref={panel} tabIndex={-1}>
        <header className="drawer__head">
          <h2 id="cart-title">
            העגלה <span className="mono">{String(lines.length).padStart(2, "0")}</span>
          </h2>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="סגירת העגלה">
            <Close />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="drawer__empty">
            <p>עוד אין פה ביטים.</p>
            <a
              className="btn"
              href="#beats"
              onClick={() => setOpen(false)}
            >
              לחנות הביטים
            </a>
          </div>
        ) : (
          <>
            <ul className="cart-lines">
              {lines.map((l) => (
                <li key={l.beatId} className="cart-line">
                  <div>
                    <p className="latin cart-line__title">{l.beat.title}</p>
                    <button
                      className="cart-line__lic"
                      onClick={() => {
                        setOpen(false);
                        chooseLicense(l.beat);
                      }}
                    >
                      {l.license.name} · {l.license.files} <u>שינוי</u>
                    </button>
                  </div>
                  <span className="cart-line__price">{formatPrice(l.license.price)}</span>
                  <button className="icon-btn icon-btn--sm" onClick={() => remove(l.beatId)} aria-label={`הסרת ${l.beat.title}`}>
                    <Close />
                  </button>
                </li>
              ))}
            </ul>

            <div className="drawer__foot">
              <div className="drawer__total">
                <span>סה״כ</span>
                <b>
                  {formatPrice(total)}
                  {hasQuote && <small> + הצעה</small>}
                </b>
              </div>
              <label className="field">
                <span>איך קוראים לך? (לא חובה)</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="השם שלך / שם במה" />
              </label>
              <a className="btn btn--hot btn--block" href={waLink(message)} target="_blank" rel="noreferrer">
                <WhatsApp /> שליחת ההזמנה בוואטסאפ
              </a>
              <p className="drawer__note">
                ההזמנה נפתחת בוואטסאפ עם כל הפרטים. גל חוזר אליך עם קישור לתשלום (ביט, פייבוקס או אשראי), והקבצים נשלחים
                מיד אחרי.
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

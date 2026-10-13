import { useEffect, useState } from "react";
import { useCart } from "../state/cart";
import { Bag, Close } from "./Icons";
import "./Header.css";

const links = [
  { href: "#beats", label: "ביטים" },
  { href: "#licenses", label: "רישיונות" },
  { href: "#lessons", label: "שיעורי FL" },
  { href: "#about", label: "מי אני" },
  { href: "#contact", label: "צור קשר" },
];

export function Logo() {
  return (
    <a href="#top" className="logo" aria-label="גל שמש, לראש העמוד">
      <span className="logo__mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="logo__word latin">GAL SHEMESH</span>
    </a>
  );
}

export default function Header() {
  const { lines, setOpen } = useCart();
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [menu]);

  return (
    <header className={`header ${solid ? "is-solid" : ""} ${menu ? "is-menu" : ""}`}>
      <div className="header__in wrap">
        <Logo />
        <nav className="header__nav" aria-label="ניווט ראשי">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="header__actions">
          <button className="cart-btn" onClick={() => setOpen(true)} aria-label={`עגלה, ${lines.length} פריטים`}>
            <Bag />
            <span className="cart-btn__label">עגלה</span>
            {lines.length > 0 && <span className="cart-btn__count">{lines.length}</span>}
          </button>
          <button
            className="menu-btn"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-controls="mobile-menu"
            aria-label={menu ? "סגירת תפריט" : "פתיחת תפריט"}
          >
            {menu ? <Close /> : <span className="menu-btn__lines" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div id="mobile-menu" className="mobile-menu" hidden={!menu}>
        <nav aria-label="ניווט ראשי">
          {links.map((l, i) => (
            <a key={l.href} href={l.href} onClick={() => setMenu(false)} style={{ transitionDelay: `${i * 40}ms` }}>
              <span className="mono">0{i + 1}</span>
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

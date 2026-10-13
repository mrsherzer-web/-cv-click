import { faq, waLink } from "../data/site";
import { Plus } from "./Icons";
import "./Faq.css";

export default function Faq() {
  return (
    <section className="faq on-paper section" id="faq" aria-labelledby="faq-title">
      <div className="wrap faq__grid">
        <header className="faq__head">
          <span className="eyebrow reveal">05 / שאלות</span>
          <h2 id="faq-title" className="display sec-title">
            <span className="line">
              <span className="line__in">שאלות.</span>
            </span>
          </h2>
          <p className="reveal">
            לא מצאת תשובה?{" "}
            <a href={waLink("היי גל, יש לי שאלה:")} target="_blank" rel="noreferrer">
              שלחו הודעה
            </a>{" "}
            ותקבלו תשובה ממני, לא מבוט.
          </p>
        </header>
        <div className="faq__list">
          {faq.map((f, i) => (
            <details key={f.q} className="qa reveal" open={i === 0}>
              <summary>
                <span className="qa__n mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="qa__q">{f.q}</span>
                <span className="qa__icon" aria-hidden="true">
                  <Plus />
                </span>
              </summary>
              <p className="qa__a">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

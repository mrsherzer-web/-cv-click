import { useRef, useState, type FormEvent } from "react";
import metro from "../assets/metro.webp";
import { curriculum, formatPrice, lessonPlans, waLink } from "../data/site";
import { Arrow, Check, WhatsApp } from "./Icons";
import "./Lessons.css";

const levels = ["מתחיל לגמרי", "יודע את הבסיס", "מפיק כבר, רוצה לעלות רמה"];
const formats = ["זום", "פרונטלי"];

export default function Lessons() {
  const [plan, setPlan] = useState("pack");
  const [level, setLevel] = useState(levels[0]);
  const [format, setFormat] = useState(formats[0]);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");

  const choose = (id: string) => {
    setPlan(id);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const p = lessonPlans.find((x) => x.id === plan)!;
  const message = [
    "היי גל! אני רוצה לקבוע שיעור FL Studio.",
    `שם: ${name.trim() || "—"}`,
    `מסלול: ${p.name} (${p.sessions}, ${formatPrice(p.price)})`,
    `רמה: ${level}`,
    `פורמט: ${format}`,
    goal.trim() ? `מה אני רוצה ללמוד: ${goal.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // הכפתור הוא קישור אמיתי לוואטסאפ, כך שחוסמי חלונות קופצים לא עוצרים אותו
  const sendLink = useRef<HTMLAnchorElement>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    sendLink.current?.click();
  };

  return (
    <section className="lessons on-paper section" id="lessons" aria-labelledby="lessons-title">
      <div className="wrap">
        <header className="sec-head">
          <span className="eyebrow reveal">03 / שיעורי FL Studio</span>
          <h2 id="lessons-title" className="display sec-title">
            <span className="line">
              <span className="line__in">לומדים להפיק.</span>
            </span>
            <span className="line">
              <span className="line__in">
                מהמשבצת <em>הראשונה.</em>
              </span>
            </span>
          </h2>
          <p className="sec-lede reveal">
            שיעורים פרטיים, אחד על אחד, על הפרויקטים שלך. לא קורס מוקלט ולא הרצאה: יושבים מול FL Studio ומפיקים, עד
            שזה יושב לך בידיים.
          </p>
        </header>
      </div>

      <figure className="band">
        <div className="band__img">
          <img src={metro} width={1800} height={1013} alt="גל שמש בתחנת רכבת, מצביע למצלמה" loading="lazy" />
        </div>
        <figcaption className="band__tags">
          <span>1 על 1</span>
          <span>זום או פרונטלי</span>
          <span>כל שיעור מוקלט</span>
        </figcaption>
      </figure>

      <div className="wrap curriculum">
        <aside className="curriculum__aside">
          <p className="eyebrow">Playlist</p>
          <h3>
            8 פטרנים.
            <br />
            ביט אחד שלם.
          </h3>
          <p>
            המסלול בנוי כמו פרויקט ב-FL: כל שיעור הוא פטרן, ובסוף מחברים הכל לביט מוכן שאפשר לשלוח לאמן. מתחילים מאיפה
            שאתה נמצא, לא מהעמוד הראשון של המדריך.
          </p>
          <a className="btn btn--ink" href="#book">
            לקביעת שיעור <Arrow />
          </a>
        </aside>
        <ol className="modules">
          {curriculum.map((m) => (
            <li key={m.n} className="module reveal">
              <span className="module__n latin">{m.n}</span>
              <div>
                <h4>{m.title}</h4>
                <p>{m.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="wrap">
        <div className="plans reveal" role="list">
          {lessonPlans.map((p) => (
            <article key={p.id} className={`plan ${p.featured ? "is-featured" : ""}`} role="listitem">
              <header>
                <p className="plan__sessions mono">{p.sessions}</p>
                <h3 className="plan__name">{p.name}</h3>
              </header>
              <p className="plan__price">
                {formatPrice(p.price)}
                {p.per && <small>{p.per}</small>}
              </p>
              <p className="plan__blurb">{p.blurb}</p>
              <ul className="plan__list">
                {p.includes.map((x) => (
                  <li key={x}>
                    <Check /> {x}
                  </li>
                ))}
              </ul>
              <button className={`btn btn--block ${p.featured ? "btn--hot" : "btn--ink"}`} onClick={() => choose(p.id)}>
                {plan === p.id ? "נבחר" : "בחירה"} <Arrow />
              </button>
            </article>
          ))}
        </div>

        <form className="book reveal" id="book" onSubmit={submit}>
          <div className="book__intro">
            <p className="eyebrow">Book a session</p>
            <h3>קובעים שיעור.</h3>
            <p>ממלאים, לוחצים, וההודעה נפתחת בוואטסאפ של גל עם כל הפרטים. משם קובעים יום ושעה.</p>
          </div>
          <div className="book__fields">
            <label className="field">
              <span>שם</span>
              <input id="book-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="איך קוראים לך?" autoComplete="name" />
            </label>
            <label className="field">
              <span>מסלול</span>
              <select id="book-plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
                {lessonPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatPrice(p.price)}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="seg">
              <legend>רמה</legend>
              {levels.map((l) => (
                <label key={l} className={level === l ? "is-on" : ""}>
                  <input id={`book-level-${levels.indexOf(l)}`} type="radio" name="level" value={l} checked={level === l} onChange={() => setLevel(l)} />
                  {l}
                </label>
              ))}
            </fieldset>
            <fieldset className="seg">
              <legend>איפה</legend>
              {formats.map((f) => (
                <label key={f} className={format === f ? "is-on" : ""}>
                  <input id={`book-format-${formats.indexOf(f)}`} type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} />
                  {f}
                </label>
              ))}
            </fieldset>
            <label className="field field--wide">
              <span>מה הכי בא לך ללמוד? (לא חובה)</span>
              <textarea
                id="book-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="למשל: 808 שנשמע טוב, מיקס, איך לסיים ביט…"
                rows={3}
              />
            </label>
            <a
              ref={sendLink}
              className="btn btn--hot btn--block field--wide"
              href={waLink(message)}
              target="_blank"
              rel="noreferrer"
            >
              <WhatsApp /> שליחה בוואטסאפ
            </a>
          </div>
        </form>
      </div>
    </section>
  );
}

import { contact, waLink } from "../data/site";
import { Logo } from "./Header";
import { Arrow, Instagram, Mail, WhatsApp, YouTube } from "./Icons";
import "./Contact.css";

const channels = [
  {
    label: "וואטסאפ",
    note: "הכי מהיר. ביטים, שיעורים, הזמנות אישיות",
    href: waLink("היי גל! הגעתי מהאתר"),
    Icon: WhatsApp,
    primary: true,
  },
  { label: "אינסטגרם", note: "ביטים חדשים וקטעים מהאולפן", href: contact.instagram, Icon: Instagram },
  { label: "יוטיוב", note: "ביטים וטיפים ל-FL Studio", href: contact.youtube, Icon: YouTube },
  { label: "מייל", note: "שיתופי פעולה ורישיונות מיוחדים", href: `mailto:${contact.email}`, Icon: Mail },
];

export default function Contact() {
  return (
    <section className="contact grain" id="contact" aria-labelledby="contact-title">
      <div className="wrap">
        <span className="eyebrow reveal">06 / צור קשר</span>
        <h2 id="contact-title" className="contact__title">
          <span className="line">
            <span className="line__in">יאללה,</span>
          </span>
          <span className="line">
            <span className="line__in">נעשה משהו.</span>
          </span>
        </h2>

        <ul className="channels">
          {channels.map(({ label, note, href, Icon, primary }) => (
            <li key={label} className="reveal">
              <a
                className={`channel ${primary ? "is-primary" : ""}`}
                href={href}
                target={href.startsWith("mailto") ? undefined : "_blank"}
                rel="noreferrer"
              >
                <Icon className="icon channel__icon" />
                <span className="channel__label">{label}</span>
                <span className="channel__note">{note}</span>
                <Arrow className="icon channel__arrow" />
              </a>
            </li>
          ))}
        </ul>
      </div>

      <footer className="footer wrap">
        <Logo />
        <p className="footer__copy">
          © {new Date().getFullYear()} גל שמש. כל הביטים מוגנים בזכויות יוצרים.
        </p>
        <a className="footer__top mono" href="#top">
          חזרה למעלה ↑
        </a>
      </footer>
    </section>
  );
}

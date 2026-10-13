import train from "../assets/train.webp";
import stage from "../assets/stage.webp";
import "./About.css";

const statement = "אני גל שמש. מפיק, קלידן, ומישהו שיושב מול FL Studio בשלוש בלילה כי ה-808 עדיין לא יושב.";

export default function About() {
  return (
    <section className="about section" id="about" aria-labelledby="about-title">
      <div className="wrap about__grid">
        <div className="about__copy">
          <span className="eyebrow reveal">04 / מי אני</span>
          <h2 id="about-title" className="about__statement">
            {statement.split(" ").map((w, i) => (
              <span className="word" key={i}>
                {w}{" "}
              </span>
            ))}
          </h2>
          <p className="about__body reveal">
            אני עושה ביטים לאמנים שרוצים סאונד שנשמע כמו שהם מרגישים: טראפ, דריל, R&amp;B, אפרו ומזרחית. על הבמה אני
            על הקלידים, ובאולפן אני ליד המסך. בשיעורים אני מלמד בדיוק את מה שאני עושה כל יום, בלי לחפף ובלי תיאוריה
            מיותרת.
          </p>
          <dl className="about__facts reveal">
            <div>
              <dt className="mono">DAW</dt>
              <dd className="latin">FL Studio</dd>
            </div>
            <div>
              <dt className="mono">On stage</dt>
              <dd>קלידים</dd>
            </div>
            <div>
              <dt className="mono">Sound</dt>
              <dd>Trap · Drill · R&amp;B · Afro · מזרחית</dd>
            </div>
          </dl>
        </div>

        <div className="about__media">
          <figure className="about__photo">
            <img src={train} width={839} height={1390} alt="גל שמש בפרופיל, עם כובע הפוך" loading="lazy" />
          </figure>
          <figure className="about__detail">
            <img src={stage} width={1200} height={1798} alt="" loading="lazy" />
          </figure>
        </div>
      </div>
    </section>
  );
}

import { formatPrice, licenseMatrix, licenses } from "../data/site";
import { Check } from "./Icons";
import "./Licenses.css";

export default function Licenses() {
  return (
    <section className="licenses section" id="licenses" aria-labelledby="lic-sec-title">
      <div className="wrap">
        <header className="sec-head">
          <span className="eyebrow reveal">02 / רישיונות</span>
          <h2 id="lic-sec-title" className="display sec-title">
            <span className="line">
              <span className="line__in">מה מקבלים.</span>
            </span>
          </h2>
          <p className="sec-lede reveal">
            רישיון אחד לכל שיר. מתחילים מליס, ואם השיר מתפוצץ משדרגים. כל רישיון מגיע עם חוזה מסודר.
          </p>
        </header>

        <div className="matrix-scroll reveal">
          <table className="matrix">
            <caption className="visually-hidden">השוואה בין סוגי הרישיונות</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">מאפיין</span>
                </th>
                {licenses.map((l) => (
                  <th scope="col" key={l.id} className={l.featured ? "is-featured" : ""}>
                    {l.featured && <span className="matrix__badge mono">מומלץ</span>}
                    <span className="matrix__name latin">{l.name}</span>
                    <span className="matrix__price">{formatPrice(l.price)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {licenseMatrix.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((v, i) => (
                    <td key={i} className={licenses[i].featured ? "is-featured" : ""}>
                      {v === true ? (
                        <Check className="icon matrix__yes" />
                      ) : v === false ? (
                        <span className="matrix__no" aria-label="לא כלול">
                          —
                        </span>
                      ) : (
                        v
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* במובייל: כרטיס לכל רישיון במקום טבלה רחבה */}
        <ul className="lic-cards">
          {licenses.map((l, i) => (
            <li key={l.id} className={`lic-card reveal ${l.featured ? "is-featured" : ""}`}>
              <header>
                <span className="matrix__name latin">{l.name}</span>
                <span className="matrix__price">{formatPrice(l.price)}</span>
                {l.featured && <span className="matrix__badge mono">מומלץ</span>}
              </header>
              <dl>
                {licenseMatrix.map((row) => {
                  const v = row.values[i];
                  return (
                    <div key={row.label} className={v === false ? "is-off" : ""}>
                      <dt>{row.label}</dt>
                      <dd>{v === true ? <Check className="icon matrix__yes" /> : v === false ? "—" : v}</dd>
                    </div>
                  );
                })}
              </dl>
            </li>
          ))}
        </ul>
        <p className="matrix-note reveal">
          * הקרדיט <span className="latin">prod. Gal Shemesh</span> חובה בכל הרישיונות. צריכים משהו אחר? רישיון מותאם
          לסינגל, לפרסומת או לסדרה — פשוט כתבו.
        </p>
      </div>
    </section>
  );
}

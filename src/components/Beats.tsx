import { useMemo, useState } from "react";
import { beats, formatPrice, licenses, waLink, type Beat } from "../data/site";
import { toggleBeat, useEngineState, useStep } from "../hooks/useEngine";
import { useCart } from "../state/cart";
import { Arrow, Check, Pause, Play, Plus } from "./Icons";
import "./Beats.css";

const ALL = "הכל";
const fromPrice = Math.min(...licenses.flatMap((l) => (l.price === null ? [] : [l.price])));

// "גל קול" נגזר מהפטרן עצמו: קיק ו-808 גבוהים, קלאפ בינוני, היי-האט נמוך
function waveform(b: Beat) {
  const p = b.pattern;
  let seed = [...b.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: p.chords.length * 16 }, (_, s) => {
    const i = s % 16;
    let v = 0.18 + rnd() * 0.12;
    if (p.hat[i] !== ".") v = Math.max(v, 0.32 + rnd() * 0.12);
    if (p.arp[i] >= "0" && p.arp[i] <= "3") v = Math.max(v, 0.45 + rnd() * 0.15);
    if (p.clap[i] === "x") v = Math.max(v, 0.72 + rnd() * 0.1);
    if (p.kick[i] === "x" || p.bass[i] !== ".") v = Math.max(v, 0.86 + rnd() * 0.14);
    return v;
  });
}

function Wave({ beat, playing }: { beat: Beat; playing: boolean }) {
  const bars = useMemo(() => waveform(beat), [beat]);
  const step = useStep(playing);
  const w = 3;
  const gap = 2;
  return (
    <svg
      className="wave"
      viewBox={`0 0 ${bars.length * (w + gap)} 40`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {bars.map((v, i) => (
        <rect
          key={i}
          x={i * (w + gap)}
          y={20 - v * 18}
          width={w}
          height={v * 36}
          rx={1}
          className={playing && i <= step ? (i === step ? "now" : "done") : ""}
        />
      ))}
    </svg>
  );
}

function TrackRow({ beat, index }: { beat: Beat; index: number }) {
  const { playingId } = useEngineState();
  const { lines, chooseLicense } = useCart();
  const playing = playingId === beat.id;
  const inCart = lines.find((l) => l.beatId === beat.id);

  return (
    <li className={`track ${playing ? "is-playing" : ""}`}>
      <span className="track__n mono">{String(index + 1).padStart(2, "0")}</span>
      <button
        className="track__play"
        onClick={() => toggleBeat(beat)}
        aria-label={playing ? `עצירת ${beat.title}` : `ניגון ${beat.title}`}
        aria-pressed={playing}
      >
        {playing ? <Pause /> : <Play />}
      </button>
      <div className="track__title">
        <h3 className="latin">
          {beat.title}
          {beat.isNew && <span className="track__new mono">New</span>}
        </h3>
        <p className="track__tags">
          {beat.tags.map((t) => (
            <span key={t}>#{t.replace(/\s/g, "")}</span>
          ))}
        </p>
      </div>
      <div className="track__wave" dir="ltr">
        <Wave beat={beat} playing={playing} />
      </div>
      <dl className="track__meta">
        <div>
          <dt>BPM</dt>
          <dd className="mono">{beat.bpm}</dd>
        </div>
        <div>
          <dt>סולם</dt>
          <dd className="mono">{beat.key}</dd>
        </div>
        <div className="track__mood">
          <dt>וייב</dt>
          <dd>{beat.mood}</dd>
        </div>
      </dl>
      <div className="track__buy">
        <span className="track__price">
          {inCart ? (
            <>
              <small>{inCart.license.name}</small>
              {formatPrice(inCart.license.price)}
            </>
          ) : (
            <>
              <small>החל מ-</small>
              {formatPrice(fromPrice)}
            </>
          )}
        </span>
        <button
          className={`track__add ${inCart ? "is-in" : ""}`}
          onClick={() => chooseLicense(beat)}
          aria-label={inCart ? `שינוי רישיון עבור ${beat.title}` : `בחירת רישיון עבור ${beat.title}`}
        >
          {inCart ? <Check /> : <Plus />}
        </button>
      </div>
    </li>
  );
}

export default function Beats() {
  const [genre, setGenre] = useState(ALL);
  const [q, setQ] = useState("");
  const genres = useMemo(() => [ALL, ...new Set(beats.map((b) => b.genre))], []);

  const list = beats.filter((b) => {
    const okGenre = genre === ALL || b.genre === genre;
    const needle = q.trim().toLowerCase();
    const okQ =
      !needle ||
      [b.title, b.genre, b.mood, b.key, String(b.bpm), ...b.tags].some((f) => f.toLowerCase().includes(needle));
    return okGenre && okQ;
  });

  return (
    <section className="beats section" id="beats" aria-labelledby="beats-title">
      <div className="wrap">
        <header className="sec-head">
          <span className="eyebrow reveal">01 / חנות ביטים</span>
          <h2 id="beats-title" className="display sec-title">
            <span className="line">
              <span className="line__in">הביטים.</span>
            </span>
          </h2>
          <p className="sec-lede reveal">
            כל ביט זמין ברישיון ליס או בבלעדיות. לוחצים Play, שומעים, בוחרים רישיון, וההזמנה יוצאת ישר לוואטסאפ של גל.
          </p>
        </header>

        <div className="beats__bar reveal">
          <div className="chips" role="group" aria-label="סינון לפי ז'אנר">
            {genres.map((g) => (
              <button key={g} className={`chip ${genre === g ? "is-on" : ""}`} onClick={() => setGenre(g)} aria-pressed={genre === g}>
                {g}
              </button>
            ))}
          </div>
          <label className="search">
            <span className="visually-hidden">חיפוש ביט</span>
            <input type="search" placeholder="חיפוש: שם, BPM, וייב…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>

        <div className="tracks__head mono" aria-hidden="true">
          <span>#</span>
          <span />
          <span>Title</span>
          <span>Preview</span>
          <span>BPM · Key · Vibe</span>
          <span>Price</span>
        </div>
        <ol className="tracks">
          {list.map((b, i) => (
            <TrackRow key={b.id} beat={b} index={beats.indexOf(b) === -1 ? i : beats.indexOf(b)} />
          ))}
          {list.length === 0 && <li className="tracks__empty">לא מצאנו ביט כזה. אולי ביט בהזמנה אישית?</li>}
        </ol>

        <a
          className="custom reveal"
          href={waLink("היי גל, אני רוצה לדבר על ביט בהזמנה אישית")}
          target="_blank"
          rel="noreferrer"
        >
          <span className="custom__k mono">Custom</span>
          <span className="custom__t">לא מצאת את הסאונד? ביט בהזמנה אישית, מאפס, בשבילך.</span>
          <span className="custom__go">
            דברו איתי <Arrow />
          </span>
        </a>
      </div>
    </section>
  );
}

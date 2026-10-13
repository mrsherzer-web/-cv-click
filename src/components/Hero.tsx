import { useRef } from "react";
import stage from "../assets/stage.webp";
import { gsap, MOTION_OK, useGSAP } from "../lib/gsap";
import ChannelRack from "./ChannelRack";
import { Arrow } from "./Icons";
import "./Hero.css";

const WORD = ["GAL", "SHEMESH"];

export default function Hero() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.set(root.current, { autoAlpha: 1 });
        gsap
          .timeline({ defaults: { ease: "power4.out" } })
          .from(".hero__photo", { clipPath: "inset(100% 0% 0% 0%)", duration: 1.6, ease: "expo.out" })
          .from(".hero__photo img", { scale: 1.25, duration: 2.2, ease: "expo.out" }, 0)
          .from(".hero__char", { yPercent: 105, duration: 1.1, stagger: 0.035 }, 0.25)
          .from(".hero__title .line__in", { yPercent: 110, duration: 1, stagger: 0.1 }, 0.55)
          .from([".hero__meta", ".hero__sub", ".hero__ctas"], { y: 18, opacity: 0, duration: 0.8, stagger: 0.08 }, 0.85)
          .from(".rack-dock", { y: 70, opacity: 0, duration: 1.1, ease: "expo.out" }, 0.9);

        // עומק קל בגלילה: התמונה זזה לאט, השם מהר יותר
        gsap.to(".hero__photo img", {
          yPercent: 10,
          ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
        });
        gsap.to(".hero__word", {
          yPercent: -18,
          ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="hero-wrap">
      <section className="hero grain" id="top" aria-labelledby="hero-title">
        <div className="hero__photo">
          <img src={stage} width={1200} height={1798} alt="גל שמש מנגן על קלידים על במה, באור כחול" fetchPriority="high" />
        </div>

        <div className="hero__content wrap">
          <p className="hero__meta mono">
            <span>Beatmaker</span>
            <span>Producer</span>
            <span>FL Studio Teacher</span>
          </p>
          <h1 id="hero-title" className="hero__title">
            <span className="visually-hidden">גל שמש. </span>
            <span className="line">
              <span className="line__in">עושה ביטים.</span>
            </span>
            <span className="line">
              <span className="line__in">
                ומלמד <em>איך.</em>
              </span>
            </span>
          </h1>
          <p className="hero__sub">
            ביטים לאמנים עם רישיון מסודר, ביטים בהזמנה אישית ושיעורים פרטיים ב-FL Studio. בזום או פרונטלית, מאפס
            ועד ביט שיוצא לעולם.
          </p>
          <div className="hero__ctas">
            <a className="btn" href="#beats">
              לחנות הביטים <Arrow />
            </a>
            <a className="btn btn--ghost" href="#lessons">
              שיעורי FL Studio
            </a>
          </div>
        </div>

        <div className="hero__word latin" aria-hidden="true">
          {WORD.map((w) => (
            <span className="hero__wordline" key={w}>
              {[...w].map((ch, i) => (
                <span className="hero__char" key={i}>
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </div>
      </section>

      <div className="rack-dock wrap">
        <ChannelRack />
        <p className="rack-dock__hint">
          <span className="mono">נסו בעצמכם</span>
          לחצו Play ותדליקו משבצות. ככה מתחיל כל ביט, <a href="#lessons">ובשיעורים ממשיכים מכאן.</a>
        </p>
      </div>
    </div>
  );
}

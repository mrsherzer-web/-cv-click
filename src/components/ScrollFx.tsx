import { useRef, type ReactNode } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "../lib/gsap";

// כל אנימציות הגלילה של העמוד במקום אחד. מחוץ ל-matchMedia לא רץ כלום,
// כך שמי שביקש reduced motion מקבל את העמוד הסופי כמו שהוא.
export default function ScrollFx({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.utils.toArray<HTMLElement>(".sec-title, .contact__title").forEach((title) => {
          gsap.from(title.querySelectorAll(".line__in"), {
            yPercent: 110,
            duration: 1.1,
            stagger: 0.1,
            ease: "power4.out",
            scrollTrigger: { trigger: title, start: "top 88%", once: true },
          });
        });

        gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
          gsap.from(el, {
            y: 40,
            opacity: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          });
        });

        gsap.set(".track", { opacity: 0, y: 24 });
        ScrollTrigger.batch(".track", {
          start: "top 92%",
          once: true,
          onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.7, stagger: 0.06, ease: "power3.out" }),
        });

        // ההצהרה ב"מי אני" נדלקת מילה אחרי מילה עם הגלילה
        gsap.fromTo(
          ".about__statement .word",
          { opacity: 0.16 },
          {
            opacity: 1,
            stagger: 0.1,
            ease: "none",
            scrollTrigger: { trigger: ".about__statement", start: "top 80%", end: "bottom 45%", scrub: 0.6 },
          },
        );

        const parallax = (sel: string, from: number, to: number) =>
          gsap.utils.toArray<HTMLElement>(sel).forEach((img) => {
            gsap.fromTo(
              img,
              { yPercent: from },
              {
                yPercent: to,
                ease: "none",
                scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true },
              },
            );
          });
        parallax(".band__img img", -14, 0);
        parallax(".about__photo img", -6, 6);

        gsap.utils.toArray<HTMLElement>(".band__img, .about__photo").forEach((frame) => {
          gsap.from(frame, {
            clipPath: "inset(18% 8% 18% 8%)",
            duration: 1.4,
            ease: "expo.out",
            scrollTrigger: { trigger: frame, start: "top 85%", once: true },
          });
        });
      });

      const refresh = () => ScrollTrigger.refresh();
      document.fonts?.ready.then(refresh);
      window.addEventListener("load", refresh);
      return () => window.removeEventListener("load", refresh);
    },
    { scope: root },
  );

  return <main ref={root}>{children}</main>;
}

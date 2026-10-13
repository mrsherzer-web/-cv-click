import { useEffect, useRef } from "react";
import { engine } from "../audio/engine";
import { beats } from "../data/site";
import { toggleBeat, useEngineState } from "../hooks/useEngine";
import { useCart } from "../state/cart";
import { Close, Pause, Plus } from "./Icons";
import "./Player.css";

export default function Player() {
  const { playingId, isPlaying } = useEngineState();
  const { chooseLicense } = useCart();
  const canvas = useRef<HTMLCanvasElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const beat = beats.find((b) => b.id === playingId);
  const idx = beat ? beats.indexOf(beat) : -1;

  useEffect(() => {
    document.documentElement.style.setProperty("--player-h", isPlaying ? "76px" : "0px");
  }, [isPlaying]);

  // ויזואלייזר + פס התקדמות, מחוץ ל-React כדי לא לרנדר 60 פעם בשנייה
  useEffect(() => {
    if (!isPlaying) return;
    const c = canvas.current;
    const g = c?.getContext("2d");
    const data = new Uint8Array(engine.analyser?.frequencyBinCount ?? 128);
    let raf = 0;
    const draw = () => {
      if (c && g && engine.analyser) {
        const dpr = window.devicePixelRatio || 1;
        const w = c.clientWidth;
        const h = c.clientHeight;
        if (c.width !== w * dpr) {
          c.width = w * dpr;
          c.height = h * dpr;
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        engine.analyser.getByteFrequencyData(data);
        const n = 28;
        const bw = w / n;
        for (let i = 0; i < n; i++) {
          const v = data[Math.floor(Math.pow(i / n, 1.6) * data.length * 0.7)] / 255;
          const bh = Math.max(2, v * h);
          g.fillStyle = i < 5 ? "#ff6a1f" : "rgba(239,234,224,0.85)";
          g.fillRect(i * bw + 1, h - bh, bw - 2, bh);
        }
      }
      if (bar.current) bar.current.style.transform = `scaleX(${engine.progress})`;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const skip = (d: number) => {
    const next = beats[(Math.max(idx, 0) + d + beats.length) % beats.length];
    toggleBeat(next);
  };

  return (
    <div className={`player ${isPlaying ? "is-on" : ""}`} aria-hidden={!isPlaying} inert={!isPlaying}>
      <div className="player__progress" dir="ltr">
        <div ref={bar} />
      </div>
      <div className="player__in wrap">
        <button className="player__pp" onClick={() => engine.stop()} aria-label="עצירה">
          <Pause />
        </button>
        <div className="player__info">
          <p className="latin player__title">{beat ? beat.title : "Channel Rack"}</p>
          <p className="mono player__meta" dir="ltr">
            {beat ? `${beat.bpm} BPM · ${beat.key} · ${beat.genre}` : "Pattern 01 · הגרוב שלך"}
          </p>
        </div>
        <canvas ref={canvas} className="player__viz" aria-hidden="true" />
        <div className="player__actions">
          {beat && (
            <>
              <button className="player__skip mono" onClick={() => skip(1)} aria-label="הביט הבא">
                הבא
              </button>
              <button className="btn btn--hot player__buy" onClick={() => chooseLicense(beat)}>
                <Plus /> לרכישה
              </button>
            </>
          )}
          <button className="icon-btn icon-btn--sm" onClick={() => engine.stop()} aria-label="סגירת הנגן">
            <Close />
          </button>
        </div>
      </div>
      {!beat && playingId && <span className="visually-hidden">מנגן את ה-Channel Rack</span>}
    </div>
  );
}

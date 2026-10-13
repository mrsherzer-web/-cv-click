import { useMemo, useRef, useState, type ReactNode } from "react";
import { engine, type Sequence } from "../audio/engine";
import { beats, heroPattern } from "../data/site";
import { useEngineState, useStep } from "../hooks/useEngine";
import { Pause, Play } from "./Icons";
import "./ChannelRack.css";

const RACK_ID = "rack";
const parse = (s: string) => [...s].map((c) => c !== ".");
const initial = () => heroPattern.rows.map((r) => parse(r.steps));
const progression = beats[0].pattern; // אקורדים ומלודיה של Red Line

// 16 צעדים בארבע קבוצות של רבע, כמו ב-FL
function Steps({ children }: { children: (i: number) => ReactNode }) {
  return (
    <div className="rack__steps">
      {[0, 1, 2, 3].map((g) => (
        <div className="rack__group" key={g}>
          {[0, 1, 2, 3].map((k) => children(g * 4 + k))}
        </div>
      ))}
    </div>
  );
}

export default function ChannelRack() {
  const [grid, setGrid] = useState<boolean[][]>(initial);
  const [bpm, setBpm] = useState(heroPattern.bpm);
  const [keys, setKeys] = useState(true);
  const gridRef = useRef(grid);
  const bpmRef = useRef(bpm);
  const keysRef = useRef(keys);
  gridRef.current = grid;
  bpmRef.current = bpm;
  keysRef.current = keys;

  const { playingId } = useEngineState();
  const playing = playingId === RACK_ID;
  const step = useStep(playing);
  const col = step < 0 ? -1 : step % 16;

  // הסיקוונס קורא את המצב מתוך refs, כך ששינוי משבצת נשמע מיד בלי לעצור
  const seq = useMemo<Sequence>(
    () => ({
      id: RACK_ID,
      get bpm() {
        return bpmRef.current;
      },
      swing: 0,
      totalSteps: 64,
      schedule(s, t, e) {
        const i = s % 16;
        const bar = Math.floor(s / 16);
        const g = gridRef.current;
        const chord = progression.chords[bar % 4];
        if (g[0][i]) e.kick(t);
        if (g[1][i]) e.clap(t, 0.9);
        if (g[2][i]) e.hat(t, i % 4 === 0 ? 1 : 0.7);
        if (g[3][i]) {
          let len = 1;
          while (len < 16 && !g[3][(i + len) % 16]) len++;
          e.bass808(t, progression.root + chord[0], (len * 60) / bpmRef.current / 4);
        }
        if (keysRef.current) {
          const a = progression.arp[i];
          if (a >= "0" && a <= "3") e.lead("bell", t, progression.root + 24 + chord[Number(a)], 0.2, 0.7);
          if (i === 0) e.pad(t, chord.slice(0, 3).map((n) => progression.root + 24 + n), (16 * 60) / bpmRef.current / 4);
        }
      },
    }),
    [],
  );

  const toggle = (r: number, c: number) =>
    setGrid((g) => g.map((row, ri) => (ri === r ? row.map((v, ci) => (ci === c ? !v : v)) : row)));

  const togglePlay = () => (playing ? engine.stop() : engine.play(seq));
  const nudge = (d: number) => setBpm((b) => Math.min(170, Math.max(70, b + d)));

  return (
    <div className="rack" dir="ltr" role="group" aria-label="Channel Rack — סיקוונסר תופים אינטראקטיבי">
      <div className="rack__bar">
        <button
          className={`rack__play ${playing ? "is-on" : ""}`}
          onClick={togglePlay}
          aria-label={playing ? "עצירה" : "ניגון הפטרן"}
        >
          {playing ? <Pause /> : <Play />}
        </button>
        <div className="rack__tempo">
          <button onClick={() => nudge(-2)} aria-label="להאט">
            −
          </button>
          <output aria-live="polite">
            <b>{bpm}</b>
            <small>BPM</small>
          </output>
          <button onClick={() => nudge(2)} aria-label="להאיץ">
            +
          </button>
        </div>
        <div className="rack__title">
          <span>Channel rack</span>
          <b>PAT 01 · RED LINE</b>
        </div>
        <div className="rack__tools">
          <button className={`rack__chip ${keys ? "is-on" : ""}`} onClick={() => setKeys((k) => !k)} aria-pressed={keys}>
            <i /> Keys
          </button>
          <button className="rack__chip" onClick={() => setGrid(initial())}>
            Reset
          </button>
          <button className="rack__chip" onClick={() => setGrid((g) => g.map((r) => r.map(() => false)))}>
            Clear
          </button>
        </div>
      </div>

      <div className="rack__leds" aria-hidden="true">
        <span className="rack__label-spacer" />
        <Steps>
          {(i) => <span key={i} className={`rack__led ${col === i ? "is-on" : ""}`} />}
        </Steps>
      </div>

      {heroPattern.rows.map((row, r) => (
        <div className="rack__row" key={row.id}>
          <span className="rack__label">
            <i className={grid[r][col] ? "is-hit" : ""} />
            {row.label}
          </span>
          <Steps>
            {(c) => (
              <button
                key={c}
                className={`rack__step ${grid[r][c] ? "is-on" : ""} ${col === c ? "is-now" : ""}`}
                onClick={() => toggle(r, c)}
                aria-pressed={grid[r][c]}
                aria-label={`${row.label} צעד ${c + 1}`}
              />
            )}
          </Steps>
        </div>
      ))}
    </div>
  );
}

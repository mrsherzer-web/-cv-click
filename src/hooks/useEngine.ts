import { useEffect, useState, useSyncExternalStore } from "react";
import { engine, sequenceFromPattern } from "../audio/engine";
import type { Beat } from "../data/site";

export function useEngineState() {
  return useSyncExternalStore(engine.subscribe, engine.getState, engine.getState);
}

export function useStep(active: boolean) {
  const [step, setStep] = useState(-1);
  useEffect(() => {
    if (!active) {
      setStep(-1);
      return;
    }
    setStep(engine.step);
    return engine.onStep(setStep);
  }, [active]);
  return step;
}

export function toggleBeat(beat: Beat) {
  if (engine.state.playingId === beat.id) {
    engine.stop();
    return;
  }
  if (beat.audio) engine.playFile(beat.id, beat.audio);
  else engine.play(sequenceFromPattern(beat.id, beat.bpm, beat.pattern));
}

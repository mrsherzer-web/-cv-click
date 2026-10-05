// ============================================================================
//  Voice: plays a recorded file when one exists (story.js VOICE_FILES),
//  otherwise uses the browser's Hebrew text-to-speech if available.
// ============================================================================
import { VOICE_FILES } from '../story.js';

class Voice {
  constructor() {
    this.enabled = true;
    this.he = null;
    this.audioEl = null;
    this.supported = 'speechSynthesis' in window;
    if (this.supported) {
      const pick = () => {
        const vs = speechSynthesis.getVoices();
        this.he =
          vs.find((v) => /^he|^iw/i.test(v.lang) && /asaf|male|גבר/i.test(v.name)) ||
          vs.find((v) => /^he|^iw/i.test(v.lang)) ||
          null;
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    }
  }

  get available() {
    return this.enabled && (!!this.he || Object.keys(VOICE_FILES).length > 0);
  }

  // Warm up TTS on iOS (must happen inside a user gesture)
  unlock() {
    if (!this.supported) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  cancel() {
    if (this.supported) speechSynthesis.cancel();
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl = null;
    }
  }

  /** Speak a line. Resolves when finished (or immediately if no voice). */
  speak(line, profile, volume = 1) {
    this.cancel();
    if (!this.enabled) return Promise.resolve(false);
    const file = line.id && VOICE_FILES[line.id];
    if (file) {
      return new Promise((res) => {
        const a = new Audio(file);
        a.volume = volume;
        this.audioEl = a;
        a.onended = () => res(true);
        a.onerror = () => res(false);
        a.play().catch(() => res(false));
      });
    }
    if (!this.he || !profile) return Promise.resolve(false);
    return new Promise((res) => {
      const text = line.text.replace(/[—–]/g, ',').replace(/\.{3}/g, '…');
      const u = new SpeechSynthesisUtterance(text);
      u.voice = this.he;
      u.lang = this.he.lang;
      u.pitch = profile.pitch ?? 1;
      u.rate = profile.rate ?? 1;
      u.volume = volume;
      let done = false;
      const fin = () => {
        if (!done) {
          done = true;
          res(true);
        }
      };
      u.onend = fin;
      u.onerror = fin;
      // safety net: some browsers never fire onend
      setTimeout(fin, 1500 + text.length * 140);
      speechSynthesis.speak(u);
    });
  }
}

export const voice = new Voice();

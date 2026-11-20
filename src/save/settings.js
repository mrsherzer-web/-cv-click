// Player settings kept in this browser only. Game progress saving arrives in stage H.
const KEY = 'nehorai-game:settings:v1';

export function loadSettings() {
  const defaults = { quality: 'medium' };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // private mode or storage blocked: settings just won't persist
  }
}

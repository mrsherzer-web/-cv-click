// Comfort on a computer. Where the page is used with a mouse (a fine pointer that can hover: no phone, no
// tablet) the start screen's how-to names the keys and the mouse instead of the thumbs, the start screen gets
// a full-screen button (the pause menu has its own, from the HUD: it moves up to the top of that menu), Enter
// starts the game, and the hints that speak of a phone go. Everywhere else nothing changes.
//
// The keys are the ones src/input/controls.js listens for; a mouse drag anywhere on the view looks around.

const HOWTO = [
  ['תנועה', '<span dir="ltr"><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></span> או החצים'],
  ['מצלמה', 'גרירה עם העכבר'],
  ['ריצה', 'להחזיק <kbd>Shift</kbd>'],
  ['פעולה', '<kbd>E</kbd> או <kbd>Enter</kbd> כשמופיע כפתור הפעולה'],
  ['נהיגה', 'אותם מקשים לגז, לברקס ולהיגוי, <kbd>רווח</kbd> לבלם יד, <kbd>F</kbd> ליציאה מהרכב'],
  ['קרב', '<kbd>J</kbd> אגרוף, <kbd>K</kbd> הגנה (להחזיק), <kbd>L</kbd> או <kbd>רווח</kbd> התחמקות; בקרבות של פרק 9 גם <kbd>U</kbd> מכה חזקה ו־<kbd>I</kbd> דחיפה, ובקרב האחרון <kbd>O</kbd> מכה מיוחדת'],
  ['פיינטבול', '<kbd>J</kbd> ירי, <kbd>R</kbd> טעינה, <kbd>K</kbd> סימון'],
  ['השהיה', '<kbd>Esc</kbd> או <kbd>P</kbd>'],
  ['טלפון והשתקה', 'הכפתורים ליד הכסף, בלחיצת עכבר'],
];
const PHONE_NOTE = 'מומלץ לשחק כשהטלפון לרוחב. ';

export function isDesktop() {
  try { return matchMedia('(pointer: fine) and (hover: hover)').matches; } catch { return false; }
}

export function installDesktop() {
  document.documentElement.classList.add('howto-set'); // the how-to is settled from here on (see the rule in style.css)
  if (!isDesktop()) return false;
  document.documentElement.classList.add('desktop'); // the styles at the end of style.css

  const list = document.querySelector('#startScreen .howto');
  if (list) { list.innerHTML = HOWTO.map(([name, text]) => `<li><b>${name}:</b> ${text}</li>`).join(''); list.classList.add('keys'); }
  const note = document.getElementById('startNote');
  if (note && note.textContent.startsWith(PHONE_NOTE)) note.textContent = note.textContent.slice(PHONE_NOTE.length);

  // full screen, asked for inside this button's own click (a browser gives it only to a press); a refusal
  // leaves the window as it is
  const root = document.documentElement;
  if (note && document.fullscreenEnabled && root.requestFullscreen) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'secondary'; b.id = 'startFullscreenBtn';
    const label = () => { b.textContent = document.fullscreenElement ? 'יציאה ממסך מלא' : 'מסך מלא'; };
    b.addEventListener('click', () => {
      try { (document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen({ navigationUI: 'hide' }))?.catch?.(() => {}); } catch { /* refused */ }
      b.blur(); // Enter after it starts the game, it does not press this again
    });
    document.addEventListener('fullscreenchange', label);
    label();
    note.before(b);
    // the pause menu's own full-screen button sits under the list of all the missions: up under "continue"
    const inPause = document.getElementById('fullscreenBtn'), resume = document.getElementById('resumeBtn');
    if (inPause && resume) resume.after(inPause);
  }

  // Enter on the start screen presses its start button (through the button's own click, so the ident and the
  // opening film see it like any press): only while that button is the thing on top there (not under the
  // ident, a film or a question), and not when a button or a link has the focus and answers Enter itself
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const start = document.getElementById('startScreen'), btn = document.getElementById('startBtn');
    if (!start || start.hidden || !btn || btn.hidden || btn.disabled) return;
    if (document.activeElement?.matches?.('button, a, input, select, textarea')) return;
    const r = btn.getBoundingClientRect();
    if (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) !== btn) return;
    e.preventDefault();
    e.stopPropagation(); // (the press is the start button's alone: the game's own keys do not get this Enter too)
    btn.click();
  });
  return true;
}

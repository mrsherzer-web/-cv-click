// The cast: real friends, real faces (scanned from their photos), made-up night.
export const CAST = {
  yonati: {
    name: 'יונתי',
    full: 'יונתי',
    role: 'זה אתה',
    nick: 'החבר שלא מוותר',
    color: '#6ec3ff',
    hair: 'quiff',
    hairColor: [0.13, 0.1, 0.08],
    pitch: 1.0,
    outfit: { shirt: '#ecebe6', pants: '#5a6f8f', shoes: '#1f2125', legs: 'jeans', chain: true, accent: '#2a2a2a' },
    seed: 2,
  },
  ido: {
    name: 'עידו',
    full: 'עידו הידנה',
    role: 'צריך להציל אותו',
    nick: 'ידוע גם בשם: ברודנה',
    color: '#ffcc4d',
    hair: 'buzz',
    hairColor: [0.16, 0.12, 0.1],
    pitch: 1.1,
    outfit: { shirt: '#1b1c20', pants: '#3b4f72', shoes: '#ecebe6', legs: 'jeans' },
    seed: 1,
  },
  yiftach: {
    name: 'יפתח',
    full: 'דוקטור יפתח צימט',
    role: 'דוקטור. חבר. לכאורה.',
    nick: '"אני הולך לראות סרט, ככה בפאן"',
    color: '#e8e2d6',
    villainColor: '#ff4d4d',
    hair: 'wavy',
    hairColor: [0.06, 0.06, 0.07],
    pitch: 0.85,
    outfit: { shirt: '#16171b', pants: '#2b3140', shoes: '#141414', legs: 'jeans', print: 'flag' },
    seed: 4,
  },
  dolev: {
    name: 'דולב',
    full: 'דולב דורון',
    role: 'נעלם',
    nick: 'ניסה להזהיר',
    color: '#c9a7ff',
    hair: 'curly',
    hairColor: [0.08, 0.07, 0.07],
    pitch: 1.05,
    scale: 0.98,
    outfit: { shirt: '#d9cfbd', pants: '#8a8064', shoes: '#ecebe6', legs: 'shorts', top: 'tank', print: 'cactus', watch: true, chain: true },
    seed: 5,
  },
  yahli: {
    name: 'יהלי',
    full: 'יהלי',
    role: 'החבר מקציר',
    nick: '"אהההה דלביובים!"',
    color: '#7fe0c4',
    hair: 'fringe',
    hairColor: [0.42, 0.3, 0.2],
    pitch: 1.15,
    scale: 1.01,
    outfit: { shirt: '#151618', pants: '#4b505c', shoes: '#ecebe6', legs: 'jeans', print: 'lisbon' },
    seed: 6,
  },
  avraham: {
    name: 'אברהם',
    full: 'אברהם שזגר',
    role: 'בא לעצור את זה',
    nick: '"תניע את הרכב"',
    color: '#ff9f43',
    hair: 'short',
    hairColor: [0.12, 0.1, 0.09],
    pitch: 0.95,
    scale: 1.03,
    outfit: { shirt: '#191a1e', pants: '#2e3a52', shoes: '#ecebe6', legs: 'jeans', chain: true, build: 1.08 },
    seed: 3,
  },
};

export function portraitOf(id, assets) {
  return assets.portraits?.[id] || assets.faces?.[id]?.portrait || fallbackPortrait(id);
}

const _fallback = {};
function fallbackPortrait(id) {
  if (_fallback[id]) return _fallback[id];
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = CAST[id]?.color || '#888';
  g.fillRect(0, 0, 160, 160);
  g.fillStyle = '#111';
  g.font = '700 90px Assistant, Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText((CAST[id]?.name || '?').charAt(0), 80, 88);
  return (_fallback[id] = c.toDataURL());
}

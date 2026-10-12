// סט אייקונים אחיד (קו 1.75) – במקום אימוג'ים
const P = {
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 9"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pan: '<circle cx="10" cy="12" r="6.5"/><path d="M16.5 12H22"/>',
  protein: '<path d="M7 7c2-3 8-3 10 0s1 9-5 11C6 16 5 10 7 7z"/>',
  flame: '<path d="M12 21c-4 0-6-2.7-6-6 0-4 4-6 4-10 3 2 4 4 4 6 1-1 1.5-2 1.5-3 2 2 2.5 4.5 2.5 7 0 3.3-2 6-6 6z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4M9.5 2.5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M14.5 6 8.5 12l6 6"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
  battFull: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3M6 10v4M9.5 10v4M13 10v4M16 10v4"/>',
  battMid: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3M6 10v4M9.5 10v4"/>',
  battLow: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3M6 10v4"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19 13 11"/>',
  recycle: '<path d="M7.5 9.5 10 5h4l2 3.5M18 13l2 3.5-2 3.5h-4M9 20H5l-2-3.5 2.5-4"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.4-2.5-1.2M12 6.5V8M12 16v1.5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l2.5 2.5M14.5 8.5 16.5 10.5"/>',
  // קטגוריות מזון
  dairy: '<path d="M8 3h8v3l2 3v12H6V9l2-3z"/><path d="M6 12h12"/>',
  egg: '<path d="M12 3c3.5 0 6.5 6 6.5 10.5a6.5 6.5 0 0 1-13 0C5.5 9 8.5 3 12 3z"/>',
  veg: '<path d="M14 4c-1 2-1 3 0 4M17 3c-1 2-.5 4 1 5M10 21C6 17 6 11 10 8c2-1.5 6-1 8 1 1 4-3 10-8 12z"/>',
  fruit: '<path d="M12 7c-4-2-8 0-8 5s4 9 6 9c1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 6-4 6-9s-4-7-8-5z"/><path d="M12 7c0-2 1-4 3-4"/>',
  carbs: '<path d="M12 21V9M12 9c-2 0-4-2-4-5 2 0 4 2 4 5zM12 9c2 0 4-2 4-5-2 0-4 2-4 5zM12 14c-2 0-4-2-4-4.5 2 0 4 2 4 4.5zM12 14c2 0 4-2 4-4.5-2 0-4 2-4 4.5z"/>',
  sauces: '<path d="M9 3h6v3H9zM7 8h10v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path d="M7 13h10"/>',
  other: '<path d="M4 9h16l-1.5 11h-13zM8 9l4-5 4 5"/>',
};

export function icon(name, size = 20, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.other}</svg>`;
}

// רכיב → אייקון קטגוריה
export function catIcon(cat, id, size = 20) {
  if (id === 'eggs') return icon('egg', size);
  return icon({ dairy: 'dairy', protein: 'egg', veg: 'veg', fruit: 'fruit', carbs: 'carbs', sauces: 'sauces' }[cat] || 'other', size);
}

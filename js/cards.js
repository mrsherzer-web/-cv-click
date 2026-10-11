/* Katzir FC — player card component (FC-style cards rendered with HTML/CSS). */
window.KFC = window.KFC || {};

KFC.Cards = (function () {
  'use strict';
  const D = KFC.DATA;

  const FLAG_IL = '<svg class="flag" viewBox="0 0 44 32" aria-label="ישראל"><rect width="44" height="32" fill="#fff"/>' +
    '<rect y="3.5" width="44" height="4.5" fill="#0038b8"/><rect y="24" width="44" height="4.5" fill="#0038b8"/>' +
    '<g fill="none" stroke="#0038b8" stroke-width="1.6"><path d="M22 10.2l5.2 9h-10.4z"/><path d="M22 21.8l-5.2-9h10.4z"/></g></svg>';

  function art(id) { return 'assets/players/' + id + '.webp'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // card: { player, edition, ovr, stats }
  function html(card, opts) {
    opts = opts || {};
    const p = card.player;
    const keys = p.gk ? D.GK_KEYS : D.OUTFIELD;
    const ed = card.edition;
    const stats = keys.map(k =>
      '<div class="cs"><span class="cs-l">' + D.STAT_LABELS[k] + '</span><span class="cs-v">' + card.stats[k] + '</span></div>'
    ).join('');
    const nick = ed === 'goat' ? '<div class="card-ribbon">THE GOAT</div>'
      : (p.nick && !p.key ? '<div class="card-nick">' + esc(p.nick) + '</div>' : '');
    const key = p.key ? '<div class="card-key">שחקן מפתח</div>' : '';
    const crown = ed === 'goat' ? '<svg class="card-crown" viewBox="0 0 64 40"><path d="M4 34L8 8l14 14L32 2l10 20L56 8l4 26z" fill="url(#goldg)"/><rect x="4" y="34" width="56" height="5" rx="1.5" fill="url(#goldg)"/></svg>' : '';
    return '' +
      '<div class="card ed-' + ed + (opts.cls ? ' ' + opts.cls : '') + '" data-card="' + esc(card.cardId || '') + '" data-player="' + p.id + '">' +
        '<div class="card-face">' +
          '<div class="card-inner">' +
            '<div class="card-bg"></div>' +
            '<div class="card-lines"></div>' +
            '<img class="card-art" src="' + art(p.id) + '" alt="" loading="lazy" decoding="async">' +
            '<div class="card-shine"></div>' +
            '<div class="card-top">' +
              '<div class="card-ovr">' + card.ovr + '</div>' +
              '<div class="card-pos">' + p.pos + '</div>' +
              FLAG_IL +
              '<img class="card-club" src="assets/brand/crest-sm.png" alt="">' +
              crown +
            '</div>' +
            nick +
            '<div class="card-name">' + esc(p.he.replace(/"[^"]*"\s*/, '')) + '</div>' +
            key +
            '<div class="card-stats">' + stats + '</div>' +
            '<div class="card-ed">' + D.EDITIONS[ed].en + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function el(card, opts) {
    const t = document.createElement('template');
    t.innerHTML = html(card, opts).trim();
    return t.content.firstChild;
  }

  // Shared gradient defs used by inline SVG icons on cards.
  function injectDefs() {
    if (document.getElementById('kfc-defs')) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('id', 'kfc-defs'); s.setAttribute('width', '0'); s.setAttribute('height', '0');
    s.style.position = 'absolute';
    s.innerHTML = '<defs><linearGradient id="goldg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#e8c26a"/><stop offset="1" stop-color="#9c6f22"/></linearGradient></defs>';
    document.body.appendChild(s);
  }

  // Subtle 3D tilt that follows the pointer (skipped when reduced motion is requested).
  function tilt(node) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const face = node.querySelector('.card-face');
    node.addEventListener('pointermove', e => {
      const r = node.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      face.style.transform = 'rotateY(' + (x * 16) + 'deg) rotateX(' + (-y * 14) + 'deg)';
      node.style.setProperty('--mx', (x + 0.5) * 100 + '%');
      node.style.setProperty('--my', (y + 0.5) * 100 + '%');
    });
    node.addEventListener('pointerleave', () => { face.style.transform = ''; });
  }

  return { html, el, tilt, injectDefs, FLAG_IL, art };
})();

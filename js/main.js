/* Katzir FC — boot: preload, title screen, first-run welcome pack. */
(function () {
  'use strict';
  const D = KFC.DATA, ST = KFC.Store, AU = KFC.Audio, UI = KFC.UI, C = KFC.Cards;

  function boot() {
    C.injectDefs();
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    document.body.classList.add(coarse ? 'touch' : 'no-touch');

    const imgs = ['assets/brand/crest.png', 'assets/brand/crest-sm.png', 'assets/brand/stadium.jpg']
      .concat(D.PLAYERS.map(p => 'assets/players/' + p.id + '.webp'))
      .concat(D.PLAYERS.map(p => 'assets/heads/' + p.id + '.png'))
      .concat(['liam', 'ido', 'erez', 'sipko'].map(id => 'assets/action/' + id + '.jpg'));
    let done = 0;
    const total = imgs.length + 1;
    const tick = () => { done++; UI.renderTitle(done / total); if (done >= total) ready(); };
    UI.renderTitle(0);
    imgs.forEach(src => { const im = new Image(); im.onload = im.onerror = tick; im.src = src; });
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise(r => setTimeout(r, 2500))]).then(tick);

    let entered = false;
    function ready() {
      const title = document.getElementById('screen-title');
      const enter = () => {
        if (entered) return;
        entered = true;
        const p = ST.get();
        AU.unlock();
        AU.setEnabled(p.sound);
        AU.setVoice(p.voice);
        AU.preloadLines();
        AU.play('tap', { vol: 0.6 });
        UI.show('home');
        if (!p.welcomed) {
          setTimeout(() => {
            UI.toast('ברוכים הבאים לקציר! קיבלתם חבילת פתיחה');
            UI.openPack({ id: 'welcome', he: 'חבילת פתיחה', en: 'WELCOME', cls: 'pk-welcome' }, UI.welcomePack(), () => {
              p.welcomed = true; ST.save(); UI.show('home');
            });
          }, 700);
        }
      };
      title.addEventListener('click', enter);
      window.addEventListener('keydown', function k(e) { if (e.code === 'Enter' || e.code === 'Space') { window.removeEventListener('keydown', k); enter(); } });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && UI.match && !UI.match.state.paused && !UI.match.state.over) UI.match.togglePause(true);
    });
  }

  // Live-update hook used when the page runs as a claude.ai artifact: keep the player's
  // place across republishes (the profile itself already lives in localStorage).
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) { try { hot.snapshot(() => ({ screen: UI.current() })); } catch (e) { /* optional */ } }
  const start = () => { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); };
  if (hot && hot.ready) hot.ready(start); else start();
})();

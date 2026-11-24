/* HHack — the laptop hacking mini-game of chapter 2, "THE BIG SCORE".
 *
 * Shown when the player reaches the hacker outside the hotel: the overlay IS the hacker's laptop from
 * the trailer (red-lit room, dark desktop, white windows peeking behind a terminal with green code).
 * Three one-button timing rounds, each a little faster / tighter than the last:
 *   1. FIREWALL BYPASS      a cursor sweeps a line of hex bytes; hit it inside the green window
 *   2. CRACK THE ENCRYPTION a needle spins round a cipher ring; hit it inside the green arc
 *   3. VAULT ACCESS KEY     key bytes stream through a lock; hit when a yellow key is between the brackets
 * Every hit locks one key byte (3 per round). A miss never fails the hack: it drains half a key byte,
 * glitches the screen, and quietly widens/slows the next attempt so nobody can get stuck.
 *
 * DOM + one 2D canvas inside the #stage box (1280x720 logical px, scaled by main.js). No three.js.
 *   HHack.start({ container, lang: 'he'|'en', onDone({ misses, perfect, perfects, hits, time }) })
 *   HHack.stop()      remove everything now, no callback
 *   HHack.active      true from start() until onDone fires (or stop())
 */
var HHack = (function () {
  'use strict';

  /* ------------------------------------------------------------------ layout (laptop-screen px) */
  var SW = 1166, SH = 620;                                         // screen inside the bezel
  var TERM = { x: 128, y: 38, w: 996, h: 562, bar: 32 };           // terminal window
  var LOG = { x: 128, y: 70, w: 340, h: 530, pad: 14, lh: 23 };    // scrolling code pane
  var WID = { x: 484, y: 136, w: 624, h: 290, cx: 796, cy: 281 };  // mini-game panel
  var PINS = { y: 438, w: 132, h: 40, gap: 18 };                   // the 3 key-byte slots
  var VAULT = { cx: 626, cy: 236, r: 112 };                        // finale vault door
  var C = { g: '#3cff8f', g2: '#1fbf62', gw: '#eafff2', hot: '#b8ffd8', y: '#ffd23f', r: '#ff4d6d', panel: '#07130c', term: '#060a07' };
  var MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace';
  var SANS = 'Rubik, system-ui, -apple-system, "Segoe UI", sans-serif';
  var TAU = Math.PI * 2;
  var GRACE = 0.045;   // s of forgiveness for display/input latency (hit-test only, not drawn)
  var PERF = 0.4;      // inner fraction of the window that counts as PERFECT

  // per-round difficulty: speed (bar widths/s | rad/s | px/s) and half-window (bar units | rad | px)
  var ROUNDS = [
    { kind: 'bar', sp: 0.74, hw: 0.115, pitch: 1.0 },
    { kind: 'ring', sp: 4.2, hw: 0.5, pitch: 1.12 },
    { kind: 'stream', sp: 250, hw: 30, pitch: 1.26 }
  ];

  var STR = {
    en: {
      connecting: 'CONNECTING…', round: 'ROUND {n}/3', progress: 'BREACH',
      names: ['FIREWALL BYPASS', 'CRACK THE ENCRYPTION', 'VAULT ACCESS KEY'],
      clears: ['FIREWALL BYPASSED', 'ENCRYPTION CRACKED', 'KEY ACCEPTED'],
      instr: ['Press <kbd>SPACE</kbd> / tap when the cursor is inside the window',
        'Press <kbd>SPACE</kbd> / tap when the needle is inside the green arc',
        'Press <kbd>SPACE</kbd> / tap when a yellow key is between the brackets'],
      tap: ['Tap when the cursor is inside the window', 'Tap when the needle is inside the green arc', 'Tap when a yellow key is between the brackets'],
      ok: 'LOCKED', perfect: 'PERFECT!', miss: 'MISS',
      granted: 'ACCESS GRANTED', grantedSub: 'VAULT DOOR UNLOCKED', aria: 'Hacking the hotel security system'
    },
    he: {
      connecting: 'מתחבר…', round: 'שלב {n}/3', progress: 'פריצה',
      names: ['עקיפת חומת האש', 'פיצוח ההצפנה', 'מפתח הכספת'],
      clears: ['חומת האש נפרצה', 'ההצפנה פוצחה', 'המפתח התקבל'],
      instr: ['לחצו <kbd>רווח</kbd> / הקישו כשהסמן בתוך החלון',
        'לחצו <kbd>רווח</kbd> / הקישו כשהמחוג בתוך הקשת הירוקה',
        'לחצו <kbd>רווח</kbd> / הקישו כשמפתח צהוב בין הסוגריים'],
      tap: ['הקישו כשהסמן בתוך החלון', 'הקישו כשהמחוג בתוך הקשת הירוקה', 'הקישו כשמפתח צהוב בין הסוגריים'],
      ok: 'ננעל', perfect: 'מושלם!', miss: 'פספוס',
      granted: 'הגישה אושרה', grantedSub: 'דלת הכספת נפתחה', aria: 'פורצים למערכת האבטחה של המלון'
    }
  };

  /* ------------------------------------------------------------------ terminal text */
  var BOOT = [
    'Last login: Tue 23:41 tty1', '$ ifconfig wlan0 | grep inet', '  inet 10.13.37.66/24',
    '$ nmap -sS 10.13.37.0/24', 'PORT      STATE  SERVICE', '22/tcp    open   ssh', '443/tcp   open   https',
    '2222/tcp  open   vault-ctl', '$ ssh root@10.13.37.7 -p2222', 'ECDSA key fp SHA256:7f3a9c',
    'root@vault password: ******', 'Access: LIMITED (guest)', '$ sudo ./breach --stealth',
    '[*] loading payload v4.2', '[*] spoofing MAC 3c:1f:9a', '[*] IDS heuristics: DORMANT',
    '{row}', '{row}', '[*] opening tunnel :2222'
  ];
  var POOL = [
    ['$ ./fw_bypass --rule 0x{h2}', '[*] probing fw01:{port}', 'iptables -D INPUT {n}', 'mov  eax, [ebp+0x{h1}]',
      'xor  ecx, ecx', 'jmp  0x{h4}', '[*] packet 0x{h4} -> DROP', '{row}', '{row}', '[*] ACL entry {n}/64 parsed', 'push 0x{h4}  ; ret'],
    ['$ hashcat -m 1400 vault.h', '[*] AES-256 round {r14}/14', 'rk[{n}] = {row4}', 'xor  ecx, 0x5f3759df', 'sbox[0x{h2}] -> 0x{h2}',
      '[*] entropy {pct}% ...', '{row}', '{row}', 'shl  edx, 0x{h1}', 'ror  eax, 0x{h1}'],
    ['$ ./vault_sync --handshake', '[*] challenge 0x{h4} sent', 'nonce={h8} ttl=30', '[*] bolt ctrl ch {n} ACK', '{row}', '{row}',
      'cmp  al, 0x{h2}', 'jne  retry_sync', '[*] relay K{n} -> LOW']
  ];
  var START = ['$ ./fw_bypass --target fw01', '$ ./crack --cipher aes256', '$ ./vault_sync --live'];
  var HITL = [['[OK] rule {n} disabled', '[OK] fw01 segment open', '[OK] port 2222 whitelisted'],
    ['[OK] key byte 0x{key}', '[OK] round key verified', '[OK] cipher block {n} clear'],
    ['[OK] sync byte 0x{key} ACK', '[OK] handshake step ok', '[OK] bolt relay armed']];
  var MISSL = ['[ERR] checksum mismatch', '[ERR] timing drift +{n}ms', '[!] IDS ping - masked', '[ERR] parity fail, retry'];
  var CLEARL = ['>>> FIREWALL DOWN', '>>> CIPHER BROKEN', '>>> KEY ACCEPTED'];

  /* ------------------------------------------------------------------ small helpers */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rndi(n) { return (Math.random() * n) | 0; }
  function pick(a) { return a[rndi(a.length)]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function hx(v, n) { var s = (v >>> 0).toString(16).toUpperCase(); while (s.length < n) s = '0' + s; return s.slice(-n); }
  function hxr(n) { var s = ''; for (var i = 0; i < n; i++) s += hx(rndi(16), 1); return s; }
  function eOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function eIO(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function eBack(t) { t = clamp(t, 0, 1); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function wrapA(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function fillTpl(s, key) {
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      switch (k) {
        case 'h1': return hxr(1).toLowerCase(); case 'h2': return hxr(2).toLowerCase(); case 'h4': return hxr(4).toLowerCase();
        case 'h8': return hxr(8).toLowerCase(); case 'n': return String(1 + rndi(31)); case 'port': return String(pick([22, 80, 443, 2222, 8443]));
        case 'pct': return String(40 + rndi(59)); case 'r14': return String(1 + rndi(14)); case 'key': return key || hxr(2);
        case 'row': { var r = []; for (var i = 0; i < 8; i++) r.push(hxr(2).toLowerCase()); return r.join(' '); }
        case 'row4': { var q = []; for (var j = 0; j < 4; j++) q.push(hxr(2).toLowerCase()); return q.join(' '); }
      }
      return m;
    });
  }
  // true once the injected JetBrains Mono face has actually loaded (check() is true for unknown faces too)
  function monoReady() {
    var ok = false;
    try { if (document.fonts && document.fonts.forEach) document.fonts.forEach(function (f) { if (f.status === 'loaded' && /JetBrains Mono/i.test(f.family)) ok = true; }); } catch (e) {}
    return ok;
  }
  function sfx(name, o) {
    try {
      if (typeof HAudio !== 'undefined' && HAudio && HAudio.sfx) { HAudio.sfx(name, o); return; }
      var A = typeof AudioSys !== 'undefined' ? AudioSys : null, m = FALLBACK[name];
      if (A && A.sfx && m) A.sfx(m);
    } catch (e) { /* audio must never break the game */ }
  }
  var FALLBACK = { beep: 'click', hackOk: 'select', hackFail: 'hurt', accessGranted: 'levelup', checkpoint: 'select' };

  /* ------------------------------------------------------------------ CSS (injected once) */
  var CSS = [
    '.hk-ui.screen{display:block;position:absolute;inset:0;z-index:6;overflow:hidden;text-align:start;touch-action:none;cursor:pointer;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;font-family:' + SANS + ';color:#eafff2;opacity:0;transition:opacity .28s ease;',
    'background:radial-gradient(ellipse 52% 62% at 10% -4%,rgba(255,56,56,.6),rgba(255,40,40,0) 72%),radial-gradient(ellipse 46% 64% at 102% 88%,rgba(210,12,30,.5),rgba(0,0,0,0) 70%),repeating-linear-gradient(90deg,rgba(0,0,0,0) 0 158px,rgba(0,0,0,.34) 158px 161px,rgba(255,96,96,.07) 161px 163px),linear-gradient(180deg,#44070b 0%,#230306 55%,#0b0103 100%)}',
    '.hk-ui.hk-on{opacity:1}',
    '.hk-ui.hk-out{opacity:0;transition:opacity .42s ease;pointer-events:none}',
    '.hk-ui *{box-sizing:border-box}',
    '.hk-laptop{position:absolute;left:44px;top:12px;width:1192px;height:646px;padding:13px;border-radius:22px 22px 8px 8px;background:linear-gradient(165deg,#521419 0%,#19161b 17%,#0c0c0f 58%,#160a0c 100%);box-shadow:0 0 0 1px rgba(255,110,110,.22),inset 0 1px 0 rgba(255,160,160,.3),inset 0 0 0 2px #050506,-26px -20px 70px rgba(255,30,40,.24),0 0 110px rgba(60,255,143,.08),0 34px 60px rgba(0,0,0,.65)}',
    '.hk-cam{position:absolute;left:50%;top:4px;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:#1b211d;box-shadow:0 0 0 1px #000;transition:background .3s,box-shadow .3s}',
    '.hk-cam.on{background:#3cff8f;box-shadow:0 0 0 1px #000,0 0 7px #3cff8f}',
    '.hk-screen{position:relative;width:100%;height:100%;border-radius:6px;overflow:hidden;background:#050607;box-shadow:inset 0 0 0 1px #000}',
    '.hk-cv{position:absolute;left:0;top:0;width:100%;height:100%;display:block}',
    '.hk-head{position:absolute;left:484px;top:80px;width:624px;height:48px;display:flex;align-items:center;justify-content:space-between;gap:14px;transition:opacity .3s}',
    '.hk-title{display:flex;align-items:center;gap:12px;min-width:0;white-space:nowrap;overflow:hidden;font:400 42px/1.05 "Bebas Neue","Secular One",Impact,sans-serif;letter-spacing:2px;color:#3cff8f;text-shadow:0 0 14px rgba(60,255,143,.55)}',
    '.hk-title::before{content:"";flex:none;width:12px;height:12px;background:#3cff8f;box-shadow:0 0 10px #3cff8f}',
    '.hk-title b{font-weight:400;display:block;padding-top:3px}',
    '.hk-title.hk-rev b{animation:hk-rev .42s steps(14,end) both}',
    '[dir=rtl] .hk-title.hk-rev b{animation-name:hk-revr}',
    '@keyframes hk-rev{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}',
    '@keyframes hk-revr{from{clip-path:inset(0 0 0 100%)}to{clip-path:inset(0 0 0 0)}}',
    '.hk-round{flex:none;display:flex;align-items:center;gap:7px;padding:7px 12px 5px;border:1px solid rgba(60,255,143,.45);border-radius:6px;background:rgba(60,255,143,.08);font:400 26px/1 "Bebas Neue","Secular One",sans-serif;letter-spacing:1.5px;color:#cfffe1;white-space:nowrap}',
    '.hk-round span{margin-inline-end:4px}',
    '.hk-round i{width:10px;height:10px;border-radius:2px;background:rgba(60,255,143,.2);margin-top:-2px}',
    '.hk-round i.done{background:#3cff8f;box-shadow:0 0 7px #3cff8f}',
    '.hk-round i.cur{background:#ffd23f;box-shadow:0 0 7px rgba(255,210,63,.8);animation:hk-blink 1s steps(2,start) infinite}',
    '@keyframes hk-blink{50%{opacity:.35}}',
    '.hk-instr{position:absolute;left:484px;top:480px;width:624px;min-height:60px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:24px;font-weight:600;line-height:1.3;color:#e6fff0;text-shadow:0 0 12px rgba(60,255,143,.35),0 2px 0 #000;transition:opacity .3s}',
    '.hk-instr span{display:block;text-wrap:balance;max-width:600px}',
    '.hk-instr span.hk-nudge{animation:hk-nudge .45s ease-out}',
    '@keyframes hk-nudge{0%{color:#ff8a9c}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-3px)}100%{color:#e6fff0;transform:none}}',
    '@keyframes hk-nudger{0%{color:#ff8a9c}100%{color:#e6fff0}}',
    '.hk-instr kbd{display:inline-block;font:400 23px/1 "Bebas Neue","Secular One",sans-serif;letter-spacing:1.5px;color:#04130a;background:#3cff8f;border-radius:6px;padding:5px 11px 3px;margin:0 5px;box-shadow:0 3px 0 #0b7a3e,0 0 12px rgba(60,255,143,.5);text-shadow:none;vertical-align:2px}',
    '.hk-prog{position:absolute;left:484px;top:546px;width:624px;transition:opacity .3s}',
    '.hk-pl{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:6px}',
    '.hk-plab{font-size:18px;font-weight:800;letter-spacing:3px;color:rgba(214,255,228,.88)}',
    '.hk-pct{font:400 30px/0.9 "Bebas Neue",Impact,sans-serif;color:#3cff8f;text-shadow:0 0 10px rgba(60,255,143,.6);direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}',
    '.hk-bar{position:relative;height:14px;border-radius:7px;background:rgba(60,255,143,.08);border:1px solid rgba(60,255,143,.38);overflow:hidden}',
    '.hk-bar::before,.hk-bar::after{content:"";position:absolute;top:0;bottom:0;width:2px;background:rgba(0,0,0,.65);z-index:1}',
    '.hk-bar::before{left:33.33%}.hk-bar::after{left:66.66%}',
    '.hk-fill{position:absolute;inset:0;transform-origin:left center;transform:scaleX(0);background:linear-gradient(90deg,#11994c,#3cff8f);box-shadow:0 0 12px rgba(60,255,143,.75)}',
    '[dir=rtl] .hk-fill{transform-origin:right center;background:linear-gradient(270deg,#11994c,#3cff8f)}',
    '.hk-pops,.hk-stamp{position:absolute;left:484px;top:136px;width:624px;height:290px;pointer-events:none}',
    '.hk-pop{position:absolute;left:0;right:0;top:10px;text-align:center;font:400 46px/1 "Bebas Neue","Secular One",sans-serif;letter-spacing:2px;animation:hk-pop .8s cubic-bezier(.2,1.4,.4,1) both}',
    '.hk-pop.ok{color:#8dffbc;text-shadow:0 0 14px rgba(60,255,143,.8),0 3px 0 #000}',
    '.hk-pop.pf{color:#ffd23f;text-shadow:0 0 16px rgba(255,210,63,.85),0 3px 0 #000}',
    '.hk-pop.miss{color:#ff4d6d;text-shadow:0 0 14px rgba(255,40,80,.8),0 3px 0 #000;top:auto;bottom:26px}',
    '@keyframes hk-pop{0%{opacity:0;transform:translateY(16px) scale(.7)}16%{opacity:1;transform:translateY(0) scale(1.1)}30%{transform:scale(1)}72%{opacity:1}100%{opacity:0;transform:translateY(-28px)}}',
    '.hk-stamp{display:flex;align-items:center;justify-content:center;opacity:0}',
    '.hk-stamp b{font:400 58px/1 "Bebas Neue","Secular One",sans-serif;font-weight:400;letter-spacing:3px;color:#3cff8f;border:4px solid #3cff8f;border-radius:8px;padding:10px 26px 4px;background:rgba(3,16,8,.9);transform:rotate(-4deg);box-shadow:0 0 34px rgba(60,255,143,.38),inset 0 0 22px rgba(60,255,143,.2);text-shadow:0 0 14px rgba(60,255,143,.75);white-space:nowrap}',
    '.hk-stamp.show{opacity:1}',
    '.hk-stamp.show b{animation:hk-stamp .4s cubic-bezier(.2,1.5,.4,1) both}',
    '@keyframes hk-stamp{from{opacity:0;transform:rotate(-4deg) scale(1.9)}to{opacity:1;transform:rotate(-4deg) scale(1)}}',
    '.hk-grant{position:absolute;left:128px;top:388px;width:996px;text-align:center;pointer-events:none;opacity:0}',
    '.hk-grant h2{margin:0;font:400 104px/0.92 "Bebas Neue","Secular One",Impact,sans-serif;letter-spacing:5px;color:#9dffc6;text-shadow:0 0 16px rgba(60,255,143,.95),0 0 52px rgba(60,255,143,.55),0 5px 0 #03250f;white-space:nowrap}',
    '.hk-grant p{margin:12px 0 0;font-size:28px;font-weight:800;letter-spacing:3px;color:#ffd23f;text-shadow:0 2px 0 #000,0 0 14px rgba(255,210,63,.45)}',
    '.hk-grant.show{opacity:1}',
    '.hk-grant.show h2{animation:hk-grant .62s cubic-bezier(.15,1.3,.35,1) both}',
    '.hk-grant.show p{animation:hk-up .45s .28s both}',
    '@keyframes hk-grant{0%{opacity:0;transform:scale(1.55);letter-spacing:34px}100%{opacity:1;transform:none;letter-spacing:5px}}',
    '@keyframes hk-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
    '@keyframes hk-fade{from{opacity:0}to{opacity:1}}',
    '.hk-ui.hk-final .hk-head,.hk-ui.hk-final .hk-instr,.hk-ui.hk-final .hk-prog{opacity:0}',
    '.hk-ui.hk-gl .hk-title,.hk-ui.hk-gl .hk-instr,.hk-ui.hk-gl .hk-pct{text-shadow:-3px 0 rgba(255,0,70,.85),3px 0 rgba(0,240,255,.7)}',
    '.hk-fx{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 40% 50% at 0% 0%,rgba(255,50,60,.13),rgba(255,50,60,0) 70%),linear-gradient(118deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,0) 26%),radial-gradient(ellipse 78% 74% at 50% 50%,rgba(0,0,0,0) 58%,rgba(0,0,0,.5) 100%),repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 1px,rgba(0,0,0,0) 1px 4px)}',
    '.hk-fx::after{content:"";position:absolute;left:0;right:0;top:-140px;height:140px;background:linear-gradient(180deg,rgba(60,255,143,0),rgba(60,255,143,.045),rgba(60,255,143,0));animation:hk-roll 5s linear infinite}',
    '@keyframes hk-roll{to{transform:translateY(780px)}}',
    '.hk-deck{position:absolute;left:-26px;right:-26px;top:657px;height:72px;clip-path:polygon(5.2% 0,94.8% 0,100% 100%,0 100%);background:linear-gradient(180deg,#040405 0 5px,#2c2b31 5px,#1c1a1f 13px,#0f0e11 100%)}',
    '.hk-deck::before{content:"";position:absolute;left:15%;right:15%;top:19px;height:34px;clip-path:polygon(.8% 0,99.2% 0,100% 100%,0 100%);background:repeating-linear-gradient(90deg,rgba(0,0,0,.7) 0 3px,rgba(0,0,0,0) 3px 44px),repeating-linear-gradient(180deg,#17161a 0 13px,rgba(0,0,0,.75) 13px 17px)}',
    '.hk-deck::after{content:"";position:absolute;left:0;right:0;top:5px;height:2px;background:linear-gradient(90deg,rgba(255,70,70,.0) 4%,rgba(255,90,90,.55) 22%,rgba(255,90,90,.12) 60%,rgba(255,70,70,0) 96%)}',
    '.hk-space{position:absolute;left:50%;top:56px;width:280px;height:12px;margin-left:-140px;border-radius:3px;background:#1e1d22;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}',
    '#stage.compact .hk-instr{font-size:30px;line-height:1.2}',
    '#stage.compact .hk-instr kbd{font-size:28px}',
    '#stage.compact .hk-plab{font-size:22px}',
    '#stage.compact .hk-pct{font-size:34px}',
    '#stage.compact .hk-fx{background:radial-gradient(ellipse 40% 50% at 0% 0%,rgba(255,50,60,.13),rgba(255,50,60,0) 70%),linear-gradient(118deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,0) 26%),radial-gradient(ellipse 78% 74% at 50% 50%,rgba(0,0,0,0) 58%,rgba(0,0,0,.5) 100%)}',
    // Hebrew: no tracking (spaced-out letters read badly in RTL scripts)
    '.hk-ui[lang=he] .hk-title,.hk-ui[lang=he] .hk-plab,.hk-ui[lang=he] .hk-round,.hk-ui[lang=he] .hk-stamp b,.hk-ui[lang=he] .hk-pop,.hk-ui[lang=he] .hk-grant h2,.hk-ui[lang=he] .hk-grant p{letter-spacing:0}',
    '.hk-ui[lang=he] .hk-grant.show h2{animation-name:hk-granth}',
    '@keyframes hk-granth{0%{opacity:0;transform:scale(1.55)}100%{opacity:1;transform:none}}',
    '@media (prefers-reduced-motion: reduce){.hk-instr span.hk-nudge{animation-name:hk-nudger}.hk-ui[lang] .hk-grant.show h2{animation:hk-fade .4s both}.hk-fx::after{animation:none;display:none}.hk-pop{animation:hk-fade .2s both}.hk-stamp.show b{animation:hk-fade .25s both}.hk-grant.show h2{animation:hk-fade .4s both}.hk-grant.show p{animation:hk-fade .4s both}.hk-title.hk-rev b{animation:none}.hk-round i.cur{animation:none}}'
  ].join('\n');

  function injectStyle() {
    if (!document.getElementById('hk-style')) {
      var st = document.createElement('style'); st.id = 'hk-style'; st.textContent = CSS; document.head.appendChild(st);
    }
    // the terminal face; falls back to the system monospace stack when offline
    if (!document.getElementById('hk-font') && !document.querySelector('link[href*="JetBrains+Mono"]')) {
      var l = document.createElement('link'); l.id = 'hk-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700;800&display=swap';
      document.head.appendChild(l);
    }
  }

  /* ------------------------------------------------------------------ runtime state */
  var S = null;
  var api = { active: false, start: start, stop: stop, _debug: debug };

  function start(opts) {
    opts = opts || {};
    if (S) stop();
    var de = document.documentElement, htmlDir = (de.getAttribute('dir') || '').toLowerCase();
    var lang = opts.lang === 'he' || opts.lang === 'en' ? opts.lang : (htmlDir === 'rtl' || de.lang === 'he' ? 'he' : 'en');
    var dir = lang === 'he' ? 'rtl' : 'ltr';
    var container = opts.container || document.getElementById('stage') || document.body;
    injectStyle();

    var mm = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
    var touch = mm('(hover: none) and (pointer: coarse)') || (typeof Input !== 'undefined' && Input && Input.touchMode);
    var L = STR[lang];

    var root = document.createElement('section');
    root.className = 'screen hk-ui';
    root.setAttribute('dir', dir); root.setAttribute('lang', lang);
    root.setAttribute('role', 'application'); root.setAttribute('aria-label', L.aria);
    root.innerHTML =
      '<div class="hk-laptop"><i class="hk-cam"></i><div class="hk-screen">' +
        '<canvas class="hk-cv" dir="ltr"></canvas>' +
        '<div class="hk-head"><div class="hk-title"><b></b></div><div class="hk-round"><span></span><i></i><i></i><i></i></div></div>' +
        '<div class="hk-instr" aria-live="polite"><span></span></div>' +
        '<div class="hk-prog"><div class="hk-pl"><span class="hk-plab"></span><bdi class="hk-pct">0%</bdi></div><div class="hk-bar"><i class="hk-fill"></i></div></div>' +
        '<div class="hk-pops"></div><div class="hk-stamp"></div>' +
        '<div class="hk-grant" aria-live="assertive"><h2></h2><p></p></div>' +
        '<div class="hk-fx"></div>' +
      '</div></div>' +
      '<div class="hk-deck"><i class="hk-space"></i></div>';
    container.appendChild(root);
    var q = function (s) { return root.querySelector(s); };
    var cv = q('.hk-cv');

    S = {
      root: root, container: container, cv: cv, ctx: cv.getContext('2d'), bg: document.createElement('canvas'), k: 0, kCheck: 0, bgDirty: true,
      lang: lang, dir: dir, L: L, touch: touch, reduced: mm('(prefers-reduced-motion: reduce)'), onDone: typeof opts.onDone === 'function' ? opts.onDone : null,
      el: { laptop: q('.hk-laptop'), cam: q('.hk-cam'), title: q('.hk-title'), titleB: q('.hk-title b'), round: q('.hk-round span'), dots: root.querySelectorAll('.hk-round i'),
        instr: q('.hk-instr span'), plab: q('.hk-plab'), pct: q('.hk-pct'), fill: q('.hk-fill'), pops: q('.hk-pops'), stamp: q('.hk-stamp'),
        grant: q('.hk-grant'), space: q('.hk-space') },
      t: 0, pt: 0, phase: 'intro', round: 0, R: null, prog: 0, pv: 0, pvShown: -1, keys: ['··', '··', '··'], pinPop: [-9, -9, -9], drainT: -9,
      hits: 0, misses: 0, perfects: 0, doneT: 0, cd: 0, wasIn: false, f: {}, finished: false,
      parts: [], pops: [], flash: 0, flashC: '60,255,143', gl: 0, glCls: 0, shake: 0, shook: false, amb: rnd(2.5, 4.5),
      log: null, raf: 0, last: now(), cw: 10.8, cost: 0
    };
    logInit();
    S.el.title.querySelector('b').textContent = L.connecting;
    S.el.plab.textContent = L.progress;
    setRoundChip(0, false);
    setInstr(0);
    S.el.grant.querySelector('h2').textContent = L.granted;
    S.el.grant.querySelector('p').textContent = L.grantedSub;

    // input: keys anywhere, pointer/tap anywhere on the overlay
    S.onKey = function (e) {
      var c = e.code, k = e.key;
      var isSpace = c === 'Space' || k === ' ' || k === 'Spacebar';
      var hit = isSpace || c === 'Enter' || c === 'NumpadEnter' || c === 'KeyE' || (!c && (k === 'Enter' || k === 'e' || k === 'E'));
      if (!hit) return;
      e.preventDefault();
      if (e.repeat) return;
      press();
    };
    S.onPtr = function (e) {
      if (e.button != null && e.button > 0) return;
      if (e.cancelable) e.preventDefault();
      press();
    };
    S.onCtx = function (e) { e.preventDefault(); };
    S.ptrEvt = window.PointerEvent ? ['pointerdown'] : ['touchstart', 'mousedown'];
    window.addEventListener('keydown', S.onKey);
    S.ptrEvt.forEach(function (n) { root.addEventListener(n, S.onPtr, { passive: false }); });
    root.addEventListener('contextmenu', S.onCtx);

    api.active = true;
    resize();
    void root.offsetWidth;                       // commit opacity:0 so the fade-in transitions
    root.classList.add('hk-on');
    S.el.cam.classList.add('on');
    sfx('beep', { pitch: 0.75, vol: 0.6 });
    S.raf = requestAnimationFrame(frame);
    return api;
  }

  function stop() { if (S) cleanup(); api.active = false; }

  function cleanup() {
    var s = S; if (!s) return;
    S = null; api.active = false;
    if (s.raf) cancelAnimationFrame(s.raf);
    unbind(s);
    if (s.root && s.root.parentNode) s.root.parentNode.removeChild(s.root);
  }
  function unbind(s) {
    if (s.unbound) return; s.unbound = true;
    window.removeEventListener('keydown', s.onKey);
    s.ptrEvt.forEach(function (n) { s.root.removeEventListener(n, s.onPtr, { passive: false }); });
    s.root.removeEventListener('contextmenu', s.onCtx);
  }

  function debug() {
    if (!S) return { active: false };
    var R = S.R, inPlay = S.phase === 'play' && R && R.age >= 0.28;
    return {
      active: api.active, phase: S.phase, round: S.round, prog: S.prog, hits: S.hits, misses: S.misses, perfects: S.perfects,
      inside: !!(inPlay && R.inside()), center: inPlay ? R.cdist() : 9, ready: !!inPlay && S.t >= S.cd, t: S.t, k: S.k,
      parts: S.parts.length, logLines: S.log.lines.length, frameMs: Math.round(S.cost * 100) / 100, glitch: S.gl, shake: S.shake, reduced: S.reduced, touch: !!S.touch, font: !!S.fontOK
    };
  }

  /* ------------------------------------------------------------------ canvas sizing */
  function resize() {
    var r = S.container.getBoundingClientRect(), lw = S.container.offsetWidth || 1280;
    var s = r.width > 0 ? r.width / lw : 1, dpr = window.devicePixelRatio || 1;
    var k = clamp(Math.round(s * dpr * 4) / 4, 1, S.touch ? 1.75 : 2);
    if (k === S.k) return;
    S.k = k;
    S.cv.width = S.bg.width = Math.round(SW * k);
    S.cv.height = S.bg.height = Math.round(SH * k);
    S.bgDirty = true;
  }

  /* ------------------------------------------------------------------ input */
  function press() {
    if (!S || S.finished) return;
    var t = now(), dt = Math.min(0.05, Math.max(0, (t - S.last) / 1000));
    if (dt > 0) { S.last = t; step(dt); }          // judge at the exact moment of the press
    if (!S || S.phase !== 'play') return;
    var R = S.R;
    if (R.age < 0.28 || S.t < S.cd) return;
    S.cd = S.t + 0.13;
    flashSpace();
    var res = R.judge();
    if (res.ok) onHit(res); else { onMiss(res); S.cd = S.t + 0.3; }
  }

  function flashSpace() {
    var el = S.el.space;
    if (el && el.animate) {
      try { el.animate([{ background: '#3cff8f', boxShadow: '0 0 16px #3cff8f' }, { background: '#1e1d22', boxShadow: '0 0 0 rgba(0,0,0,0)' }], { duration: 280, easing: 'ease-out' }); } catch (e) {}
    }
  }

  function halves(p, i) { return clamp(p - 2 * i, 0, 2); }

  function onHit(res) {
    var before = S.prog;
    S.hits++; if (res.perfect) S.perfects++;
    S.prog = Math.min(6, S.prog + 2);
    var slot = 0;
    for (var i = 0; i < 3; i++) if (halves(before, i) < 2 && halves(S.prog, i) === 2) { S.pinPop[i] = S.t; slot = i; }
    if (res.key) S.keys[slot] = res.key;
    S.R.onHit(res, slot);
    sfx('hackOk', { pan: clamp((res.x - SW / 2) / SW, -0.5, 0.5) });
    if (res.perfect) sfx('beep', { pitch: 1.55, vol: 0.55 });
    popup(res.perfect ? S.L.perfect : S.L.ok, res.perfect ? 'pf' : 'ok');
    burst(res.x, res.y, S.reduced ? 10 : (res.perfect ? 30 : 22), res.perfect ? C.y : C.g, res.perfect ? 330 : 260);
    S.flash = Math.max(S.flash, 0.11); S.flashC = res.perfect ? '255,220,90' : '60,255,143';
    logNow(fillTpl(res.perfect ? '[OK] clean hit (0 jitter)' : pick(HITL[S.round]), S.keys[slot]));
    if (S.prog >= 6) roundClear();
  }

  function onMiss(res) {
    S.misses++;
    var before = S.prog;
    S.prog = Math.max(0, S.prog - 1);
    if (S.prog < before) S.drainT = S.t;
    S.R.onMiss(res);
    sfx('hackFail');
    popup(S.L.miss, 'miss');
    var ins = S.el.instr; ins.classList.remove('hk-nudge'); void ins.offsetWidth; ins.classList.add('hk-nudge');
    logNow(fillTpl(pick(MISSL)));
    S.flash = Math.max(S.flash, S.reduced ? 0.08 : 0.17); S.flashC = '255,40,70';
    if (!S.reduced) { S.gl = 1; S.shake = 1; S.root.classList.add('hk-gl'); S.glCls = 0.3; }
  }

  function roundClear() {
    S.doneT = S.t;
    S.el.stamp.innerHTML = '<b></b>'; S.el.stamp.firstChild.textContent = S.L.clears[S.round];
    S.el.stamp.classList.add('show');
    logNow(CLEARL[S.round]);
    if (S.round < 2) {
      S.phase = 'clear'; S.pt = 0;
      setRoundChip(S.round, true);
      sfx('checkpoint');
    } else {
      S.phase = 'final'; S.pt = 0; S.f = {};
      setRoundChip(S.round, true);
      sfx('riser', { duration: 0.8 });
    }
  }

  function startRound(i) {
    S.round = i; S.phase = 'play'; S.pt = 0; S.prog = 0; S.wasIn = false;
    S.keys = [hxr(2), hxr(2), hxr(2)]; S.pinPop = [-9, -9, -9]; S.drainT = -9;
    var d = ROUNDS[i];
    S.R = d.kind === 'bar' ? mkBar(d) : d.kind === 'ring' ? mkRing(d) : mkStream(d);
    S.R.age = 0;
    S.el.stamp.classList.remove('show');
    var tb = S.el.titleB; tb.textContent = S.L.names[i];
    S.el.title.classList.remove('hk-rev'); void S.el.title.offsetWidth; S.el.title.classList.add('hk-rev');
    setRoundChip(i, false);
    setInstr(i);
    if (i > 0) sfx('whoosh', { duration: 0.45 });
    sfx('beep', { pitch: 0.9 + i * 0.15, vol: 0.6 });
    logNow(START[i]);
  }

  function setRoundChip(i, cleared) {
    S.el.round.textContent = S.L.round.replace('{n}', String(i + 1));
    for (var j = 0; j < 3; j++) S.el.dots[j].className = j < i || (j === i && cleared) ? 'done' : j === i ? 'cur' : '';
  }
  function setInstr(i) { S.el.instr.innerHTML = S.touch ? S.L.tap[i] : S.L.instr[i]; }

  function popup(text, cls) {
    var el = document.createElement('div');
    el.className = 'hk-pop ' + cls; el.textContent = text;
    S.el.pops.appendChild(el); S.pops.push({ el: el, t: S.t });
    while (S.pops.length > 3) { var o = S.pops.shift(); if (o.el.parentNode) o.el.parentNode.removeChild(o.el); }
  }

  function burst(x, y, n, col, sp) {
    for (var i = 0; i < n; i++) {
      var a = rnd(0, TAU), v = rnd(0.25, 1) * sp;
      S.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: rnd(0.35, 0.75), ch: pick('01ABCDEF#$%&<>/'), col: col, sq: Math.random() < 0.45 });
    }
    if (S.parts.length > 140) S.parts.splice(0, S.parts.length - 140);
  }

  /* ------------------------------------------------------------------ terminal log */
  function cls(s) {
    if (s.charAt(0) === '$') return 'cmd';
    if (s.indexOf('[OK]') === 0 || s.indexOf('>>>') === 0) return 'ok';
    if (s.indexOf('[ERR]') === 0 || s.indexOf('[!]') === 0) return 'err';
    if (s.indexOf('[*]') === 0) return 'info';
    if (/^[0-9a-f]{2} [0-9a-f]{2}/.test(s)) return 'dim';
    return 'out';
  }
  function logInit() {
    S.log = { lines: [], q: [], cur: null, wait: 0.15, scroll: 0, clk: 0 };
    BOOT.forEach(function (l) { var s = fillTpl(l); S.log.lines.push({ s: s, k: cls(s), n: s.length }); });
  }
  function newLine(s, fast) {
    var L = S.log; if (s.length > 28) s = s.slice(0, 28);
    var ln = { s: s, k: cls(s), n: 0, fast: !!fast };
    L.lines.push(ln); if (L.lines.length > 34) L.lines.shift();
    L.cur = ln; L.scroll = Math.min(L.scroll + LOG.lh, LOG.lh * 2);
  }
  function logNow(s) { var L = S.log; if (L.cur) L.cur.n = L.cur.s.length; newLine(s, true); }
  function filler() {
    var r = S.phase === 'intro' ? 0 : S.round;
    return fillTpl(pick(POOL[r]));
  }
  function logUpdate(dt) {
    var L = S.log;
    L.scroll = Math.max(0, L.scroll - dt * 170);
    if (L.cur) {
      L.cur.n = Math.min(L.cur.s.length, L.cur.n + dt * (L.cur.fast ? 260 : 90));
      if (!L.cur.fast && typeof HAudio !== 'undefined' && (L.clk -= dt) <= 0 && S.phase !== 'final') { sfx('type', { vol: 0.45 }); L.clk = rnd(0.06, 0.13); }
      if (L.cur.n >= L.cur.s.length) { L.cur = null; L.wait = rnd(0.08, 0.42); }
    } else if ((L.wait -= dt) <= 0) {
      newLine(L.q.length ? L.q.shift() : filler(), false);
    }
  }

  /* ------------------------------------------------------------------ main loop */
  function frame() {
    if (!S) return;
    S.raf = requestAnimationFrame(frame);
    var t = now(), dt = Math.min(0.05, Math.max(0, (t - S.last) / 1000));
    S.last = t;
    if ((S.kCheck -= dt) <= 0) {
      S.kCheck = 0.5; resize();
      if (!S.fontOK && monoReady()) { S.fontOK = true; S.bgDirty = true; S.cw = 0; }
    }
    step(dt);
    if (S) { draw(); S.cost += (now() - t - S.cost) * 0.05; }
  }

  function step(dt) {
    S.t += dt; S.pt += dt;
    logUpdate(dt);
    // particles / fx
    for (var i = S.parts.length - 1; i >= 0; i--) {
      var p = S.parts[i]; p.t += dt;
      if (p.t >= p.life) { S.parts.splice(i, 1); continue; }
      var dr = Math.max(0, 1 - 3.2 * dt); p.vx *= dr; p.vy = p.vy * dr + 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    S.flash = Math.max(0, S.flash - dt * 0.9);
    S.gl = Math.max(0, S.gl - dt / 0.34);
    S.shake = Math.max(0, S.shake - dt / 0.3);
    if (S.glCls > 0 && (S.glCls -= dt) <= 0) S.root.classList.remove('hk-gl');
    if (!S.reduced && (S.amb -= dt) <= 0) { S.amb = rnd(3.5, 7); if (S.phase === 'play' || S.phase === 'intro') S.gl = Math.max(S.gl, 0.22); }
    for (var j = S.pops.length - 1; j >= 0; j--) if (S.t - S.pops[j].t > 0.85) { var el = S.pops[j].el; if (el.parentNode) el.parentNode.removeChild(el); S.pops.splice(j, 1); }

    var target = 0;
    switch (S.phase) {
      case 'intro':
        if (S.pt >= 0.95) startRound(0);
        break;
      case 'play': {
        var R = S.R; R.age += dt;
        if (R.age > 0.25) R.update(dt);
        var ins = R.age >= 0.28 && R.inside();
        if (ins && !S.wasIn) sfx('beep', { pitch: ROUNDS[S.round].pitch, vol: 0.42 });
        S.wasIn = ins;
        R.fxUpdate && R.fxUpdate(dt);
        target = (S.round + S.prog / 6) / 3;
        break;
      }
      case 'clear':
        S.R.fxUpdate && S.R.fxUpdate(dt);
        S.R.update(dt * Math.max(0, 1 - S.pt * 1.6));     // the widget winds down under the stamp
        target = (S.round + 1) / 3;
        if (S.pt >= 1.15) startRound(S.round + 1);
        break;
      case 'final':
        target = 1;
        S.R.fxUpdate && S.R.fxUpdate(dt);
        finalStep();
        break;
    }
    if (!S) return;
    S.pv += (target - S.pv) * Math.min(1, dt * 9);
    if (Math.abs(S.pv - S.pvShown) > 0.002 || (target === 1 && S.pvShown !== 1 && S.pv > 0.995)) {
      var v = S.pv > 0.995 && target === 1 ? 1 : S.pv;
      S.pvShown = v;
      S.el.fill.style.transform = 'scaleX(' + v.toFixed(3) + ')';
      S.el.pct.textContent = Math.round(v * 100) + '%';
    }
    // shake the whole laptop on a miss (compositor-only transform)
    if (S.shake > 0) {
      var a = S.shake * S.shake * 7;
      S.el.laptop.style.transform = 'translate(' + rnd(-a, a).toFixed(1) + 'px,' + rnd(-a * 0.6, a * 0.6).toFixed(1) + 'px)';
      S.shook = true;
    } else if (S.shook) { S.el.laptop.style.transform = ''; S.shook = false; }
  }

  // finale: decrypt -> vault door -> ACCESS GRANTED -> fade + onDone
  function finalStep() {
    var ft = S.pt, f = S.f;
    if (!f.vault && ft >= 0.5) {
      f.vault = true; S.root.classList.add('hk-final'); S.el.stamp.classList.remove('show');
      logNow('$ vault.unlock --force');
    }
    if (!f.grant && ft >= 0.8) {
      f.grant = true; S.grantT = S.t;
      sfx('accessGranted');
      S.flash = S.reduced ? 0.22 : 0.55; S.flashC = '150,255,195';
      S.el.grant.classList.add('show');
      logNow('>>> ACCESS GRANTED');
      if (!S.reduced) burst(VAULT.cx, VAULT.cy, 46, C.g, 520);
    }
    if (!f.bolts && ft >= 1.12) { f.bolts = true; logNow('bolts: RETRACTED'); }
    if (!f.out && ft >= 2.75) {
      f.out = true; S.finished = true;
      S.root.classList.add('hk-out');
      unbind(S); api.active = false;
      var cb = S.onDone, me = S; S.onDone = null;
      var res = { misses: S.misses, perfect: S.misses === 0, perfects: S.perfects, hits: S.hits, time: Math.round(S.doneT * 10) / 10 };
      if (cb) { try { cb(res); } catch (e) { if (window.console) console.error(e); } }
      if (S !== me) return;                         // the callback started/stopped something
    }
    if (f.out && ft >= 3.2) cleanup();
  }

  /* ------------------------------------------------------------------ round 1: sweeping cursor over a code line */
  function mkBar(d) {
    var B = { x: 518, y: 244, w: 556, h: 76 }, n = 12, cells = [];
    for (var i = 0; i < n; i++) cells.push(hxr(2));
    var r = { B: B, n: n, cells: cells, p: 0.04, dir: 1, sp: d.sp, sp0: d.sp, hw: d.hw, hw0: d.hw, c: 0.66, fx: [], rule: hxr(2) };
    r.update = function (dt) {
      r.p += r.dir * r.sp * dt;
      for (var g = 0; g < 4 && (r.p > 1 || r.p < 0); g++) { if (r.p > 1) { r.p = 2 - r.p; r.dir = -1; } else { r.p = -r.p; r.dir = 1; } }
    };
    r.inside = function () { return Math.abs(r.p - r.c) <= r.hw; };
    r.cdist = function () { return Math.abs(r.p - r.c) / r.hw; };
    r.judge = function () {
      var dd = Math.abs(r.p - r.c);
      return { ok: dd <= r.hw + r.sp * GRACE, perfect: dd <= r.hw * PERF, x: B.x + r.p * B.w, y: B.y + B.h / 2 };
    };
    r.onHit = function () {
      r.fx.push({ t: 0, kind: 'hit', c: r.c, hw: r.hw, word: pick(['R00T', 'ADMN', 'K3YS', 'V4LT', 'PWND', 'B1G$', 'OPEN']) });
      for (var j = 0; j < n; j++) if (Math.abs((j + 0.5) / n - r.c) <= r.hw + 0.5 / n) r.cells[j] = hxr(2);
      r.sp *= 1.1; r.hw = Math.max(0.05, r.hw * 0.86);
      for (var k = 0; k < 24; k++) { var c = rnd(r.hw + 0.03, 1 - r.hw - 0.03); if (Math.abs(c - r.p) > 0.3) { r.c = c; return; } }
      r.c = r.p > 0.5 ? r.hw + 0.05 : 1 - r.hw - 0.05;
    };
    r.onMiss = function () {
      r.fx.push({ t: 0, kind: 'miss', p: r.p });
      r.hw = Math.min(r.hw * 1.12, r.hw0 * 1.5); r.sp = Math.max(r.sp * 0.92, r.sp0 * 0.7);
    };
    r.fxUpdate = function (dt) { for (var i = r.fx.length - 1; i >= 0; i--) if ((r.fx[i].t += dt) > 0.6) r.fx.splice(i, 1); };
    r.draw = function (c) {
      var x0 = B.x, y0 = B.y, hot = r.age >= 0.28 && r.inside(), cw = B.w / n, i;
      c.textBaseline = 'middle';
      c.font = '500 16px ' + MONO; c.fillStyle = 'rgba(60,255,143,.55)';
      c.textAlign = 'left'; c.fillText('fw01.rules[0x' + r.rule + ']  DROP *:2222', x0, y0 - 24);
      c.textAlign = 'right'; c.fillText('ptr 0x' + hx((r.p * 255) | 0, 2), x0 + B.w, y0 - 24);
      // track
      c.fillStyle = 'rgba(60,255,143,.05)'; c.fillRect(x0, y0, B.w, B.h);
      c.strokeStyle = 'rgba(60,255,143,.28)'; c.lineWidth = 1; c.strokeRect(x0 + 0.5, y0 + 0.5, B.w - 1, B.h - 1);
      c.beginPath();
      for (i = 1; i < n; i++) { c.moveTo(x0 + i * cw + 0.5, y0 + 8); c.lineTo(x0 + i * cw + 0.5, y0 + B.h - 8); }
      c.strokeStyle = 'rgba(60,255,143,.1)'; c.stroke();
      // the target window
      var wx = x0 + (r.c - r.hw) * B.w, ww = r.hw * 2 * B.w;
      c.fillStyle = hot ? 'rgba(60,255,143,.34)' : 'rgba(60,255,143,.17)'; c.fillRect(wx, y0, ww, B.h);
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = hot ? 'rgba(60,255,143,.32)' : 'rgba(60,255,143,.16)'; c.lineWidth = 12; c.strokeRect(wx, y0, ww, B.h);
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = hot ? C.hot : C.g; c.lineWidth = 3; c.strokeRect(wx + 1.5, y0 + 1.5, ww - 3, B.h - 3);
      // window brackets above / below
      c.beginPath();
      c.moveTo(wx, y0 - 12); c.lineTo(wx, y0 - 4); c.moveTo(wx + ww, y0 - 12); c.lineTo(wx + ww, y0 - 4);
      c.moveTo(wx, y0 + B.h + 4); c.lineTo(wx, y0 + B.h + 12); c.moveTo(wx + ww, y0 + B.h + 4); c.lineTo(wx + ww, y0 + B.h + 12);
      c.strokeStyle = C.g; c.lineWidth = 2; c.stroke();
      // bytes
      c.font = '700 25px ' + MONO; c.textAlign = 'center';
      for (i = 0; i < n; i++) {
        var u = (i + 0.5) / n, inW = Math.abs(u - r.c) <= r.hw;
        c.fillStyle = inW ? (hot ? '#ffffff' : C.gw) : 'rgba(60,255,143,.4)';
        c.fillText(r.cells[i], x0 + cw * (i + 0.5), y0 + B.h / 2 + 1);
      }
      // cursor + motion trail
      var px = x0 + r.p * B.w, tl = 96, tx = px - r.dir * tl;
      var gr = c.createLinearGradient(tx, 0, px, 0);
      gr.addColorStop(0, 'rgba(234,255,242,0)'); gr.addColorStop(1, hot ? 'rgba(184,255,216,.42)' : 'rgba(234,255,242,.26)');
      c.fillStyle = gr; c.fillRect(Math.min(tx, px), y0 + 3, tl, B.h - 6);
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = hot ? 'rgba(60,255,143,.34)' : 'rgba(234,255,242,.14)'; c.fillRect(px - 12, y0 - 18, 24, B.h + 36);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = hot ? C.hot : C.gw; c.fillRect(px - 3, y0 - 18, 6, B.h + 36);
      c.beginPath(); c.moveTo(px - 9, y0 - 28); c.lineTo(px + 9, y0 - 28); c.lineTo(px, y0 - 18); c.closePath(); c.fill();
      // ruler
      c.beginPath();
      for (i = 0; i <= 32; i++) { var rx = x0 + (i / 32) * B.w + 0.5, big = i % 8 === 0; c.moveTo(rx, y0 + B.h + 18); c.lineTo(rx, y0 + B.h + (big ? 30 : 24)); }
      c.strokeStyle = 'rgba(60,255,143,.3)'; c.lineWidth = 1; c.stroke();
      c.font = '500 16px ' + MONO; c.fillStyle = 'rgba(60,255,143,.5)';
      c.textAlign = 'left'; c.fillText('0x00', x0, y0 + B.h + 44); c.textAlign = 'right'; c.fillText('0xFF', x0 + B.w, y0 + B.h + 44);
      // hit / miss fx
      for (i = 0; i < r.fx.length; i++) {
        var f = r.fx[i];
        if (f.kind === 'hit') {
          var a = 1 - f.t / 0.6, fx0 = x0 + (f.c - f.hw) * B.w, fw = f.hw * 2 * B.w, gx = (1 - a) * 18;
          c.fillStyle = 'rgba(234,255,242,' + (a * a * 0.85).toFixed(3) + ')'; c.fillRect(fx0 - gx, y0 - gx * 0.5, fw + gx * 2, B.h + gx);
          c.font = '800 30px ' + MONO; c.textAlign = 'center'; c.fillStyle = 'rgba(4,19,10,' + a.toFixed(3) + ')';
          c.fillText(f.word, fx0 + fw / 2, y0 + B.h / 2 + 1);
        } else {
          var b = 1 - f.t / 0.6;
          c.strokeStyle = 'rgba(255,77,109,' + b.toFixed(3) + ')'; c.lineWidth = 3;
          c.strokeRect(x0 + f.p * B.w - 16, y0 - 10, 32, B.h + 20);
        }
      }
    };
    r.hitPos = function () { return { x: B.x + r.p * B.w, y: B.y + B.h / 2 }; };
    return r;
  }

  /* ------------------------------------------------------------------ round 2: spinning needle on a cipher ring */
  function mkRing(d) {
    var cx = WID.cx, cy = WID.cy + 2, R = 96;
    var r = { th: -Math.PI / 2, dir: 1, w: d.sp, w0: d.sp, hw: d.hw, hw0: d.hw, c: 0, fx: [], scr: hxr(2), scrT: 0, keyT: -9, key: '' };
    r.c = r.th + 2.3;
    r.update = function (dt) {
      r.th += r.dir * r.w * dt;
      if ((r.scrT -= dt) <= 0) { r.scrT = 0.055; r.scr = hxr(2); }
    };
    function dist() { return Math.abs(wrapA(r.th - r.c)); }
    r.inside = function () { return dist() <= r.hw; };
    r.cdist = function () { return dist() / r.hw; };
    r.judge = function () {
      var dd = dist();
      return { ok: dd <= r.hw + r.w * GRACE, perfect: dd <= r.hw * PERF, x: cx + Math.cos(r.th) * R, y: cy + Math.sin(r.th) * R };
    };
    r.onHit = function (res, slot) {
      r.fx.push({ t: 0, kind: 'hit', c: r.c, hw: r.hw });
      r.key = S.keys[slot]; r.keyT = S.t;
      r.dir = -r.dir; r.w *= 1.1; r.hw = Math.max(0.2, r.hw * 0.86);
      r.c = r.th + r.dir * rnd(1.9, 3.4);
    };
    r.onMiss = function () {
      r.fx.push({ t: 0, kind: 'miss', th: r.th });
      r.hw = Math.min(r.hw * 1.12, r.hw0 * 1.5); r.w = Math.max(r.w * 0.92, r.w0 * 0.7);
    };
    r.fxUpdate = function (dt) { for (var i = r.fx.length - 1; i >= 0; i--) if ((r.fx[i].t += dt) > 0.6) r.fx.splice(i, 1); };
    r.draw = function (c) {
      var hot = r.age >= 0.28 && r.inside(), i, a;
      // outer tick ring + labels
      c.beginPath();
      for (i = 0; i < 60; i++) {
        a = i / 60 * TAU; var big = i % 5 === 0, r0 = R + 15, r1 = R + (big ? 27 : 21);
        c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      }
      c.strokeStyle = 'rgba(60,255,143,.32)'; c.lineWidth = 2; c.stroke();
      c.font = '500 16px ' + MONO; c.fillStyle = 'rgba(60,255,143,.5)'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (i = 0; i < 12; i++) { a = i / 12 * TAU - Math.PI / 2; c.fillText(hx(i * 21, 2), cx + Math.cos(a) * (R + 40), cy + Math.sin(a) * (R + 40)); }
      // track
      c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.strokeStyle = 'rgba(60,255,143,.08)'; c.lineWidth = 18; c.stroke();
      c.beginPath(); c.arc(cx, cy, R - 30, 0, TAU); c.strokeStyle = 'rgba(60,255,143,.16)'; c.lineWidth = 1.5; c.stroke();
      // target arc
      c.globalCompositeOperation = 'lighter';
      c.beginPath(); c.arc(cx, cy, R, r.c - r.hw, r.c + r.hw); c.strokeStyle = hot ? 'rgba(60,255,143,.38)' : 'rgba(60,255,143,.17)'; c.lineWidth = 34; c.stroke();
      c.globalCompositeOperation = 'source-over';
      c.beginPath(); c.arc(cx, cy, R, r.c - r.hw, r.c + r.hw); c.strokeStyle = hot ? C.hot : C.g; c.lineWidth = 18; c.stroke();
      c.beginPath();
      [r.c - r.hw, r.c + r.hw].forEach(function (e) { c.moveTo(cx + Math.cos(e) * (R - 16), cy + Math.sin(e) * (R - 16)); c.lineTo(cx + Math.cos(e) * (R + 16), cy + Math.sin(e) * (R + 16)); });
      c.strokeStyle = C.gw; c.lineWidth = 2.5; c.stroke();
      // needle trail
      for (i = 1; i <= 9; i++) {
        var a0 = r.th - r.dir * i * 0.07, a1 = r.th - r.dir * (i - 1) * 0.07;
        c.beginPath(); c.arc(cx, cy, R, Math.min(a0, a1), Math.max(a0, a1));
        c.strokeStyle = 'rgba(234,255,242,' + ((1 - i / 10) * 0.3).toFixed(3) + ')'; c.lineWidth = 18; c.stroke();
      }
      // needle
      var ca = Math.cos(r.th), sa = Math.sin(r.th);
      c.globalCompositeOperation = 'lighter';
      c.beginPath(); c.moveTo(cx + ca * 30, cy + sa * 30); c.lineTo(cx + ca * (R + 20), cy + sa * (R + 20));
      c.strokeStyle = hot ? 'rgba(60,255,143,.45)' : 'rgba(234,255,242,.2)'; c.lineWidth = 14; c.stroke();
      c.globalCompositeOperation = 'source-over';
      c.beginPath(); c.moveTo(cx + ca * 30, cy + sa * 30); c.lineTo(cx + ca * (R + 20), cy + sa * (R + 20));
      c.strokeStyle = hot ? C.hot : C.gw; c.lineWidth = 4.5; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
      c.beginPath(); c.arc(cx + ca * R, cy + sa * R, 6.5, 0, TAU); c.fillStyle = hot ? C.hot : '#ffffff'; c.fill();
      // hub with a scrambling readout that freezes on each recovered key byte
      c.beginPath(); c.arc(cx, cy, 44, 0, TAU); c.fillStyle = C.panel; c.fill();
      c.strokeStyle = hot ? C.g : 'rgba(60,255,143,.5)'; c.lineWidth = 2; c.stroke();
      var showKey = S.t - r.keyT < 0.55;
      c.font = '800 30px ' + MONO; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = showKey ? C.y : (hot ? '#ffffff' : C.g); c.fillText(showKey ? r.key : r.scr, cx, cy + 2);
      // fx
      for (i = 0; i < r.fx.length; i++) {
        var f = r.fx[i], k = f.t / 0.6, al = 1 - k;
        if (f.kind === 'hit') {
          c.beginPath(); c.arc(cx, cy, R + k * 46, f.c - f.hw, f.c + f.hw);
          c.strokeStyle = 'rgba(234,255,242,' + (al * al).toFixed(3) + ')'; c.lineWidth = 18 * al + 2; c.stroke();
          c.beginPath(); c.arc(cx, cy, 44 + k * 90, 0, TAU); c.strokeStyle = 'rgba(60,255,143,' + (al * 0.6).toFixed(3) + ')'; c.lineWidth = 2; c.stroke();
        } else {
          c.beginPath(); c.arc(cx, cy, R, f.th - 0.12, f.th + 0.12); c.strokeStyle = 'rgba(255,77,109,' + al.toFixed(3) + ')'; c.lineWidth = 22; c.stroke();
        }
      }
    };
    return r;
  }

  /* ------------------------------------------------------------------ round 3: key bytes streaming through a lock */
  function mkStream(d) {
    var Ln = { x: 500, y: 246, w: 592, h: 72 }, cx = WID.cx, SP = 84, BW = 64;
    var r = { v: d.sp, v0: d.sp, tol: d.hw, tol0: d.hw, blocks: [], gap: 0, next: 2, fx: [], fly: [], nonce: hxr(8), nT: 0, hitB: null };
    function mk(x, tgt) { return { x: x, hex: hxr(2), tgt: tgt, hit: false }; }
    var x = Ln.x - 40, first = false;
    while (x < Ln.x + Ln.w + 70) {
      var t = false;
      if (!first && x >= cx + 190) { t = true; first = true; r.gap = 0; r.next = 2 + rndi(2); }
      else if (first && ++r.gap >= r.next) { t = true; r.gap = 0; r.next = 2 + rndi(2); }
      r.blocks.push(mk(x, t)); x += SP;
    }
    function nearest() {
      var best = null, bd = 1e9;
      for (var i = 0; i < r.blocks.length; i++) { var b = r.blocks[i]; if (!b.tgt || b.hit) continue; var dd = Math.abs(b.x - cx); if (dd < bd) { bd = dd; best = b; } }
      return { b: best, d: bd };
    }
    r.update = function (dt) {
      for (var i = 0; i < r.blocks.length; i++) r.blocks[i].x -= r.v * dt;
      while (r.blocks.length && r.blocks[0].x < Ln.x - 60) r.blocks.shift();
      var last = r.blocks[r.blocks.length - 1];
      while (!last || last.x < Ln.x + Ln.w + 70) {
        var nx = last ? last.x + SP : Ln.x + Ln.w, tg = ++r.gap >= r.next;
        if (tg) { r.gap = 0; r.next = 2 + rndi(2); }
        last = mk(nx, tg); r.blocks.push(last);
      }
      if ((r.nT -= dt) <= 0) { r.nT = 0.09; r.nonce = hxr(8); }
    };
    r.inside = function () { return nearest().d <= r.tol; };
    r.cdist = function () { return nearest().d / r.tol; };
    r.judge = function () {
      var n = nearest(), ok = !!n.b && n.d <= r.tol + r.v * GRACE;
      r.hitB = ok ? n.b : null;
      return { ok: ok, perfect: ok && n.d <= r.tol * PERF, x: ok ? n.b.x : cx, y: Ln.y + Ln.h / 2, key: ok ? n.b.hex : null };
    };
    r.onHit = function (res, slot) {
      var b = r.hitB; if (!b) return;
      b.hit = true;
      r.fly.push({ t: 0, x: b.x, y: Ln.y + Ln.h / 2, hex: b.hex, slot: slot });
      r.fx.push({ t: 0, kind: 'hit' });
      r.v *= 1.1; r.tol = Math.max(16, r.tol * 0.9);
    };
    r.onMiss = function () {
      r.fx.push({ t: 0, kind: 'miss' });
      r.tol = Math.min(r.tol * 1.12, r.tol0 * 1.5); r.v = Math.max(r.v * 0.92, r.v0 * 0.7);
    };
    r.fxUpdate = function (dt) {
      for (var i = r.fx.length - 1; i >= 0; i--) if ((r.fx[i].t += dt) > 0.5) r.fx.splice(i, 1);
      for (var j = r.fly.length - 1; j >= 0; j--) if ((r.fly[j].t += dt) > 0.5) r.fly.splice(j, 1);
    };
    r.draw = function (c) {
      var hot = r.age >= 0.28 && r.inside(), y0 = Ln.y, i, b;
      var half = 32 + r.tol * 0.8;                       // bracket gap follows the (assisted) tolerance
      c.textBaseline = 'middle';
      c.font = '500 16px ' + MONO; c.fillStyle = 'rgba(60,255,143,.55)';
      c.textAlign = 'left'; c.fillText('SYNC ch7  nonce ' + r.nonce.toLowerCase(), Ln.x, y0 - 34);
      c.textAlign = 'right'; c.fillText(Math.round(r.v) + ' B/s', Ln.x + Ln.w, y0 - 34);
      // lane
      c.fillStyle = 'rgba(60,255,143,.04)'; c.fillRect(Ln.x, y0 - 6, Ln.w, Ln.h + 12);
      c.beginPath(); c.moveTo(Ln.x, y0 - 6.5); c.lineTo(Ln.x + Ln.w, y0 - 6.5); c.moveTo(Ln.x, y0 + Ln.h + 6.5); c.lineTo(Ln.x + Ln.w, y0 + Ln.h + 6.5);
      c.strokeStyle = 'rgba(60,255,143,.25)'; c.lineWidth = 1; c.stroke();
      // lock zone
      c.fillStyle = hot ? 'rgba(60,255,143,.2)' : 'rgba(60,255,143,.07)'; c.fillRect(cx - half, y0 - 6, half * 2, Ln.h + 12);
      // blocks
      c.save(); c.beginPath(); c.rect(Ln.x, y0 - 8, Ln.w, Ln.h + 16); c.clip();
      c.font = '700 25px ' + MONO; c.textAlign = 'center';
      for (i = 0; i < r.blocks.length; i++) {
        b = r.blocks[i]; if (b.hit) continue;
        var bx = b.x - BW / 2, by = y0 + 5, bh = Ln.h - 10;
        if (b.tgt) {
          var past = b.x < cx - r.tol - 6;
          if (!past) {
            c.globalCompositeOperation = 'lighter'; rr(c, bx - 4, by - 4, BW + 8, bh + 8, 9);
            c.fillStyle = 'rgba(255,210,63,.22)'; c.fill(); c.globalCompositeOperation = 'source-over';
          }
          rr(c, bx, by, BW, bh, 6); c.fillStyle = past ? 'rgba(255,210,63,.25)' : C.y; c.fill();
          c.fillStyle = past ? 'rgba(255,230,150,.5)' : '#1d1400'; c.fillText(b.hex, b.x, by + bh / 2 + 1);
        } else {
          rr(c, bx + 0.5, by + 0.5, BW - 1, bh - 1, 6); c.fillStyle = 'rgba(60,255,143,.06)'; c.fill();
          c.strokeStyle = 'rgba(60,255,143,.32)'; c.lineWidth = 1; c.stroke();
          c.fillStyle = 'rgba(60,255,143,.5)'; c.fillText(b.hex, b.x, by + bh / 2 + 1);
        }
      }
      c.restore();
      // edge fades into the panel
      var gl = c.createLinearGradient(Ln.x, 0, Ln.x + 80, 0); gl.addColorStop(0, C.panel); gl.addColorStop(1, 'rgba(7,19,12,0)');
      c.fillStyle = gl; c.fillRect(Ln.x - 1, y0 - 9, 81, Ln.h + 18);
      var gr = c.createLinearGradient(Ln.x + Ln.w - 80, 0, Ln.x + Ln.w, 0); gr.addColorStop(0, 'rgba(7,19,12,0)'); gr.addColorStop(1, C.panel);
      c.fillStyle = gr; c.fillRect(Ln.x + Ln.w - 80, y0 - 9, 81, Ln.h + 18);
      // brackets
      var ya = y0 - 18, yb = y0 + Ln.h + 18;
      c.beginPath();
      c.moveTo(cx - half + 14, ya); c.lineTo(cx - half, ya); c.lineTo(cx - half, yb); c.lineTo(cx - half + 14, yb);
      c.moveTo(cx + half - 14, ya); c.lineTo(cx + half, ya); c.lineTo(cx + half, yb); c.lineTo(cx + half - 14, yb);
      if (hot) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(60,255,143,.4)'; c.lineWidth = 14; c.stroke(); c.globalCompositeOperation = 'source-over'; }
      c.strokeStyle = hot ? C.hot : C.g; c.lineWidth = 5; c.lineJoin = 'miter'; c.stroke();
      c.beginPath(); c.moveTo(cx - 10, yb + 10); c.lineTo(cx + 10, yb + 10); c.lineTo(cx, yb + 2); c.closePath(); c.fillStyle = hot ? C.hot : C.g; c.fill();
      // fx
      for (i = 0; i < r.fx.length; i++) {
        var f = r.fx[i], al = 1 - f.t / 0.5;
        c.strokeStyle = f.kind === 'hit' ? 'rgba(234,255,242,' + (al * al).toFixed(3) + ')' : 'rgba(255,77,109,' + al.toFixed(3) + ')';
        c.lineWidth = 3; var g = (1 - al) * 16; c.strokeRect(cx - half - g, ya - g, (half + g) * 2, yb - ya + g * 2);
      }
      // captured keys fly into their slot
      c.font = '800 22px ' + MONO;
      for (i = 0; i < r.fly.length; i++) {
        var fl = r.fly[i], k = eIO(fl.t / 0.5), tx = pinX(fl.slot) + PINS.w / 2, ty = PINS.y + PINS.h / 2;
        var fx = fl.x + (tx - fl.x) * k, fy = fl.y + (ty - fl.y) * k - Math.sin(k * Math.PI) * 50, sc = 1 - 0.25 * k;
        rr(c, fx - BW * sc / 2, fy - 31 * sc, BW * sc, 62 * sc, 6); c.fillStyle = C.y; c.fill();
        c.fillStyle = '#1d1400'; c.fillText(fl.hex, fx, fy + 1);
      }
    };
    return r;
  }

  /* ------------------------------------------------------------------ drawing */
  function pinX(i) { var tot = 3 * PINS.w + 2 * PINS.gap; return WID.cx - tot / 2 + i * (PINS.w + PINS.gap); }

  function drawBG(c) {
    var g, i;
    g = c.createLinearGradient(0, 0, SW, SH); g.addColorStop(0, '#0b0d13'); g.addColorStop(0.6, '#131722'); g.addColorStop(1, '#1b0f1d');
    c.fillStyle = g; c.fillRect(0, 0, SW, SH);
    g = c.createRadialGradient(SW * 0.95, SH, 0, SW * 0.95, SH, 460); g.addColorStop(0, 'rgba(224,77,255,.28)'); g.addColorStop(1, 'rgba(224,77,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, SW, SH);
    g = c.createRadialGradient(0, SH * 0.3, 0, 0, SH * 0.3, 380); g.addColorStop(0, 'rgba(255,45,149,.14)'); g.addColorStop(1, 'rgba(255,45,149,0)');
    c.fillStyle = g; c.fillRect(0, 0, SW, SH);
    // top bar
    c.fillStyle = 'rgba(0,0,0,.74)'; c.fillRect(0, 0, SW, 24);
    c.textBaseline = 'middle'; c.font = '600 13px ' + SANS; c.fillStyle = '#d9dde4';
    c.textAlign = 'left'; c.fillText('Activities', 14, 12.5);
    c.textAlign = 'center'; c.fillText('Tue 23:47', SW / 2, 12.5);
    c.textAlign = 'right'; c.fillText('87%', SW - 14, 12.5);
    c.strokeStyle = '#d9dde4'; c.lineWidth = 1.4; c.strokeRect(SW - 66.5, 7.5, 20, 10); c.fillStyle = '#d9dde4'; c.fillRect(SW - 64, 10, 14, 5); c.fillRect(SW - 46, 10, 2, 5);
    for (i = 0; i < 4; i++) c.fillRect(SW - 96 + i * 5, 17 - i * 3, 3, 2 + i * 3);
    // dock
    var dock = [['#e8b93a', '▤'], ['#16201a', '>_'], ['#2d7ff9', '◍'], ['#ff4d6d', '✉'], ['#8a2be2', '♪'], ['#7a808a', '⚙']];
    c.fillStyle = 'rgba(0,0,0,.35)'; rr(c, 6, 40, 46, 300, 12); c.fill();
    dock.forEach(function (d, j) {
      var y = 48 + j * 48;
      rr(c, 13, y, 32, 32, 8); c.fillStyle = d[0]; c.fill();
      if (j === 1) { c.strokeStyle = C.g; c.lineWidth = 1; c.stroke(); }
      c.fillStyle = j === 1 ? C.g : 'rgba(255,255,255,.9)'; c.font = '700 15px ' + (j === 1 ? MONO : SANS); c.textAlign = 'center'; c.fillText(d[1], 29, y + 17);
      if (j === 1) { c.fillStyle = '#d9dde4'; c.beginPath(); c.arc(9, y + 16, 2, 0, TAU); c.fill(); }
    });
    // windows peeking from behind the terminal (as in the trailer)
    c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 18;
    rr(c, 60, 66, 600, 404, 8); c.fillStyle = '#e8e9ed'; c.fill(); c.restore();
    c.save(); rr(c, 60, 66, 600, 404, 8); c.clip();
    c.fillStyle = '#d2d4da'; c.fillRect(60, 66, 600, 28);
    ['#ff5f57', '#febc2e', '#28c840'].forEach(function (col, j) { c.beginPath(); c.arc(76 + j * 17, 80, 5, 0, TAU); c.fillStyle = col; c.fill(); });
    g = c.createLinearGradient(60, 0, 660, 0); g.addColorStop(0, '#2a0b3a'); g.addColorStop(1, '#e04dff');
    c.fillStyle = g; c.fillRect(60, 94, 600, 56);
    c.fillStyle = '#fff'; c.font = '800 18px ' + SANS; c.textAlign = 'left'; c.fillText('THE BIG SCORE', 74, 122);
    c.fillStyle = '#c9cbd2'; for (i = 0; i < 7; i++) c.fillRect(74, 172 + i * 30, 30 + (i * 37) % 50, 10);
    c.fillStyle = '#2d7ff9'; c.fillRect(74, 392, 44, 18);
    c.restore();
    c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 18;
    rr(c, 72, 438, 360, 150, 8); c.fillStyle = '#f2f2f5'; c.fill(); c.restore();
    c.save(); rr(c, 72, 438, 360, 150, 8); c.clip();
    c.fillStyle = '#dcdde2'; c.fillRect(72, 438, 360, 24);
    ['#ff5f57', '#febc2e', '#28c840'].forEach(function (col, j) { c.beginPath(); c.arc(87 + j * 15, 450, 4.5, 0, TAU); c.fillStyle = col; c.fill(); });
    for (i = 0; i < 4; i++) { c.fillStyle = '#e8b93a'; c.fillRect(84, 474 + i * 26, 16, 12); c.fillStyle = '#c4c6cc'; c.fillRect(106, 477 + i * 26, 14 + (i * 13) % 20, 7); }
    c.restore();
    // desktop icons, right edge
    [[64, '#e8b93a'], [118, '#d9dde4'], [548, '#8a93a0']].forEach(function (d) { rr(c, 1133, d[0], 24, 22, 4); c.fillStyle = d[1]; c.fill(); c.fillStyle = 'rgba(217,221,228,.7)'; c.fillRect(1133, d[0] + 28, 24, 4); });
    // terminal window
    c.save(); c.shadowColor = 'rgba(0,0,0,.75)'; c.shadowBlur = 40; c.shadowOffsetY = 12;
    rr(c, TERM.x, TERM.y, TERM.w, TERM.h, 10); c.fillStyle = C.term; c.fill(); c.restore();
    c.save(); rr(c, TERM.x, TERM.y, TERM.w, TERM.h, 10); c.clip();
    g = c.createLinearGradient(0, TERM.y, 0, TERM.y + TERM.bar); g.addColorStop(0, '#2b2e35'); g.addColorStop(1, '#1b1d22');
    c.fillStyle = g; c.fillRect(TERM.x, TERM.y, TERM.w, TERM.bar);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(TERM.x, TERM.y + TERM.bar - 1, TERM.w, 1);
    ['#ff5f57', '#febc2e', '#28c840'].forEach(function (col, j) { c.beginPath(); c.arc(TERM.x + 20 + j * 20, TERM.y + 16, 6, 0, TAU); c.fillStyle = col; c.fill(); });
    c.font = '500 15px ' + MONO; c.fillStyle = '#a9b0bb'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('root@bigscore: ~/breach — ssh -p 2222 vault', TERM.x + TERM.w / 2, TERM.y + 16.5);
    c.fillStyle = 'rgba(60,255,143,.025)'; c.fillRect(LOG.x, LOG.y, LOG.w, LOG.h);
    c.fillStyle = 'rgba(60,255,143,.14)'; c.fillRect(LOG.x + LOG.w, LOG.y, 1, LOG.h);
    c.restore();
    // the mini-game panel
    rr(c, WID.x, WID.y, WID.w, WID.h, 10); c.fillStyle = C.panel; c.fill();
    c.strokeStyle = 'rgba(60,255,143,.2)'; c.lineWidth = 1; c.stroke();
    c.save(); rr(c, WID.x, WID.y, WID.w, WID.h, 10); c.clip();
    c.strokeStyle = 'rgba(60,255,143,.035)'; c.beginPath();
    for (i = 1; i < 26; i++) { c.moveTo(WID.x + i * 24 + 0.5, WID.y); c.lineTo(WID.x + i * 24 + 0.5, WID.y + WID.h); }
    for (i = 1; i < 12; i++) { c.moveTo(WID.x, WID.y + i * 24 + 0.5); c.lineTo(WID.x + WID.w, WID.y + i * 24 + 0.5); }
    c.stroke(); c.restore();
    c.strokeStyle = 'rgba(60,255,143,.75)'; c.lineWidth = 2; c.beginPath();
    [[WID.x, WID.y, 1, 1], [WID.x + WID.w, WID.y, -1, 1], [WID.x, WID.y + WID.h, 1, -1], [WID.x + WID.w, WID.y + WID.h, -1, -1]].forEach(function (p) {
      c.moveTo(p[0] + p[2] * 4, p[1] + p[3] * 22); c.lineTo(p[0] + p[2] * 4, p[1] + p[3] * 4); c.lineTo(p[0] + p[2] * 22, p[1] + p[3] * 4);
    });
    c.stroke();
  }

  var LOGCOL = { cmd: '#dcffe9', out: '#2fe07a', info: '#58f0a0', ok: '#a8ffcc', err: '#ff5c78', dim: 'rgba(60,255,143,.5)' };
  function drawLog(c, alpha) {
    var L = S.log, n = L.lines.length, base = LOG.y + LOG.h - LOG.pad - 6 + L.scroll, x = LOG.x + LOG.pad;
    c.save(); c.globalAlpha = alpha;
    c.beginPath(); c.rect(LOG.x, LOG.y + 4, LOG.w, LOG.h - 8); c.clip();
    c.font = '500 18px ' + MONO; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    if (!S.cw) S.cw = c.measureText('0000000000').width / 10 || 10.8;
    var cy = 0, cx = 0;
    for (var i = n - 1, row = 0; i >= 0; i--, row++) {
      var y = base - row * LOG.lh; if (y < LOG.y) break;
      var ln = L.lines[i], str = ln.n >= ln.s.length ? ln.s : ln.s.slice(0, ln.n | 0);
      if (ln.k === 'cmd' && str.length) {
        c.fillStyle = C.g; c.fillText('$', x, y);
        c.fillStyle = LOGCOL.cmd; c.fillText(str.slice(1), x + S.cw, y);
      } else { c.fillStyle = LOGCOL[ln.k] || LOGCOL.out; c.fillText(str, x, y); }
      if (i === n - 1) { cy = y; cx = x + str.length * S.cw; }
    }
    if (((S.t * 2.4) | 0) % 2 === 0 || L.cur) { c.fillStyle = C.g; c.fillRect(cx + 3, cy - 16, 10, 20); }
    var g = c.createLinearGradient(0, LOG.y, 0, LOG.y + 70); g.addColorStop(0, C.term); g.addColorStop(1, 'rgba(6,10,7,0)');
    c.fillStyle = g; c.fillRect(LOG.x, LOG.y, LOG.w, 70);
    c.restore();
  }

  function drawPins(c, alpha) {
    c.save(); c.globalAlpha = alpha;
    c.font = '500 16px ' + MONO; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(60,255,143,.55)';
    c.fillText('KEY', pinX(0) - 12, PINS.y + PINS.h / 2 + 1);
    for (var i = 0; i < 3; i++) {
      var h = halves(S.prog, i), x = pinX(i), y = PINS.y, w = PINS.w, hh = PINS.h;
      var pop = S.t - S.pinPop[i], sc = pop < 0.35 ? 1 + 0.16 * Math.sin(clamp(pop / 0.35, 0, 1) * Math.PI) : 1;
      c.save(); c.translate(x + w / 2, y + hh / 2); c.scale(sc, sc); c.translate(-w / 2, -hh / 2);
      if (h === 2) {
        c.globalCompositeOperation = 'lighter'; rr(c, -5, -5, w + 10, hh + 10, 10); c.fillStyle = 'rgba(60,255,143,.2)'; c.fill(); c.globalCompositeOperation = 'source-over';
        rr(c, 0, 0, w, hh, 7); c.fillStyle = pop < 0.25 ? '#eafff2' : C.g; c.fill();
        c.fillStyle = '#04130a'; c.font = '800 22px ' + MONO; c.textAlign = 'center'; c.fillText('0x' + S.keys[i], w / 2, hh / 2 + 1);
      } else if (h === 1) {
        var dr = S.t - S.drainT, blink = dr < 0.5 && ((dr * 12) | 0) % 2 === 0;
        rr(c, 0.5, 0.5, w - 1, hh - 1, 7); c.fillStyle = 'rgba(255,77,109,.08)'; c.fill();
        c.save(); rr(c, 0, 0, w, hh, 7); c.clip(); c.fillStyle = blink ? 'rgba(255,77,109,.6)' : 'rgba(255,160,90,.35)'; c.fillRect(0, hh / 2, w, hh / 2); c.restore();
        rr(c, 0.5, 0.5, w - 1, hh - 1, 7); c.strokeStyle = 'rgba(255,120,110,.85)'; c.lineWidth = 1.5; c.stroke();
        c.fillStyle = '#ffb3a0'; c.font = '800 22px ' + MONO; c.textAlign = 'center'; c.fillText('0x' + S.keys[i].charAt(0) + '?', w / 2, hh / 2 + 1);
      } else {
        rr(c, 0.5, 0.5, w - 1, hh - 1, 7); c.strokeStyle = 'rgba(60,255,143,.3)'; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(60,255,143,.38)'; c.font = '700 22px ' + MONO; c.textAlign = 'center'; c.fillText('0x··', w / 2, hh / 2 + 1);
      }
      c.restore();
    }
    c.restore();
  }

  function drawConnect(c, t) {
    var cx = WID.cx, cy = WID.cy - 12, a = t * 7;
    c.beginPath(); c.arc(cx, cy, 52, 0, TAU); c.strokeStyle = 'rgba(60,255,143,.14)'; c.lineWidth = 8; c.stroke();
    c.beginPath(); c.arc(cx, cy, 52, a, a + 1.5); c.strokeStyle = C.g; c.lineWidth = 8; c.lineCap = 'round'; c.stroke();
    c.beginPath(); c.arc(cx, cy, 36, -a * 0.7, -a * 0.7 + 0.9); c.strokeStyle = 'rgba(60,255,143,.5)'; c.lineWidth = 3; c.stroke(); c.lineCap = 'butt';
    c.font = '800 22px ' + MONO; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = C.gw;
    c.fillText(Math.min(100, Math.round(t / 0.9 * 100)) + '%', cx, cy + 1);
    c.font = '600 18px ' + MONO; c.fillStyle = C.g; c.fillText('ESTABLISHING TUNNEL' + '...'.slice(0, ((t * 6) | 0) % 4), cx, cy + 92);
  }

  // a round's widget, with a scan-in at round start and a wipe-out under the stamp
  function drawWidget(c) {
    var R = S.R, y0 = WID.y + 2, h = WID.h - 4, top = y0, bot = y0 + h, dim = 1;
    if (S.phase === 'play' && R.age < 0.3) {
      var e = eOut(R.age / 0.3), mid = WID.y + WID.h / 2;
      top = mid - (h / 2) * e; bot = mid + (h / 2) * e;
    } else if (S.phase === 'clear') {
      dim = 1 - 0.55 * clamp(S.pt / 0.3, 0, 1);
      if (S.pt > 0.8) top = y0 + h * eIO((S.pt - 0.8) / 0.32);
    } else if (S.phase === 'final') dim = 1 - 0.55 * clamp(S.pt / 0.3, 0, 1);
    if (bot - top < 1) return;
    c.save();
    c.beginPath(); c.rect(WID.x + 2, top, WID.w - 4, bot - top); c.clip();
    c.globalAlpha = dim;
    R.draw(c);
    c.restore();
    if (S.phase === 'play' && R.age < 0.3 || (S.phase === 'clear' && S.pt > 0.8 && S.pt < 1.12)) {
      var yy = S.phase === 'clear' ? top : bot;
      c.fillStyle = 'rgba(184,255,216,.85)'; c.fillRect(WID.x + 2, yy - 1, WID.w - 4, 2);
      if (S.phase === 'play') { c.fillRect(WID.x + 2, top - 1, WID.w - 4, 2); }
    }
  }

  function drawVault(c, ft) {
    var V = VAULT, R = V.r, g = ft - 0.8;
    var appear = clamp((ft - 0.5) / 0.25, 0, 1);
    var spin = eIO(clamp(g / 0.32, 0, 1)) * Math.PI * 1.25;
    var bolts = eIO(clamp((g - 0.32) / 0.2, 0, 1));
    var open = eIO(clamp((g - 0.56) / 0.62, 0, 1));
    var granted = g >= 0, i, a, grd;
    // dim the terminal body
    c.fillStyle = 'rgba(2,6,4,' + (0.9 * appear).toFixed(3) + ')'; c.fillRect(TERM.x, TERM.y + TERM.bar, TERM.w, TERM.h - TERM.bar);
    if (appear <= 0) return;
    c.save();
    c.translate(V.cx, V.cy);
    var sc = 0.82 + 0.18 * eBack(appear); c.scale(sc, sc); c.globalAlpha = appear;
    // light spilling out once the door opens
    if (open > 0) {
      c.globalCompositeOperation = 'lighter';
      grd = c.createRadialGradient(0, 0, R * 0.3, 0, 0, R * 2.6); grd.addColorStop(0, 'rgba(255,200,90,' + (0.5 * open).toFixed(3) + ')'); grd.addColorStop(1, 'rgba(255,90,40,0)');
      c.fillStyle = grd; c.fillRect(-R * 2.8, -R * 2.2, R * 5.6, R * 4.4);
      c.globalCompositeOperation = 'source-over';
    }
    // wall frame + status LEDs
    c.beginPath(); c.arc(0, 0, R + 34, 0, TAU); grd = c.createLinearGradient(0, -R, 0, R); grd.addColorStop(0, '#20262e'); grd.addColorStop(1, '#0b0e12'); c.fillStyle = grd; c.fill();
    c.strokeStyle = '#3a434e'; c.lineWidth = 3; c.stroke();
    for (i = 0; i < 24; i++) {
      a = i / 24 * TAU - Math.PI / 2;
      var lit = granted && i < 24 * clamp(g / 0.3, 0, 1);
      c.beginPath(); c.arc(Math.cos(a) * (R + 20), Math.sin(a) * (R + 20), 4, 0, TAU);
      c.fillStyle = lit ? C.g : (granted ? '#3a1015' : (((S.t * 4) | 0) % 2 ? '#ff2d3d' : '#8a1520')); c.fill();
    }
    // vault interior: red-lit, stacked cash
    c.save(); c.beginPath(); c.arc(0, 0, R + 2, 0, TAU); c.clip();
    grd = c.createRadialGradient(0, -10, 6, 0, 0, R); grd.addColorStop(0, '#ffe2a0'); grd.addColorStop(0.45, '#ff8a3d'); grd.addColorStop(1, '#5a070d');
    c.fillStyle = grd; c.fillRect(-R, -R, R * 2, R * 2);
    for (var row = 0; row < 5; row++) for (var col = -4; col <= 4; col++) {
      var bx = col * 30 + (row % 2) * 15 - 14, by = 18 + row * 17 - 30;
      c.fillStyle = row % 2 ? '#3f8f55' : '#4fa866'; c.fillRect(bx, by, 28, 15);
      c.fillStyle = 'rgba(240,255,235,.75)'; c.fillRect(bx + 11, by, 6, 15);
    }
    grd = c.createRadialGradient(0, 0, R * 0.5, 0, 0, R); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(40,0,4,.75)');
    c.fillStyle = grd; c.fillRect(-R, -R, R * 2, R * 2);
    c.restore();
    // the door (hinged on the left, squashes as it swings open)
    var sx = 1 - 0.9 * open;
    c.save(); c.translate(-R * (1 - sx), 0); c.scale(sx, 1);
    if (open > 0) { c.beginPath(); c.arc(16 * open / Math.max(0.1, sx), 0, R, 0, TAU); c.fillStyle = '#05070a'; c.fill(); }
    c.beginPath(); c.arc(0, 0, R, 0, TAU);
    grd = c.createRadialGradient(-R * 0.35, -R * 0.4, 10, 0, 0, R); grd.addColorStop(0, '#5b6673'); grd.addColorStop(0.55, '#2c333c'); grd.addColorStop(1, '#161a1f');
    c.fillStyle = grd; c.fill(); c.strokeStyle = '#7d8894'; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.arc(0, 0, R - 16, 0, TAU); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 4; c.stroke();
    c.beginPath(); c.arc(0, 0, R - 20, 0, TAU); c.strokeStyle = 'rgba(160,175,190,.25)'; c.lineWidth = 1.5; c.stroke();
    // bolts
    for (i = 0; i < 8; i++) {
      a = i / 8 * TAU + Math.PI / 8;
      c.save(); c.rotate(a);
      var b0 = R - 26 - bolts * 16;
      rr(c, b0, -7, 34, 14, 4); c.fillStyle = '#aab5c1'; c.fill(); c.strokeStyle = '#3d454f'; c.lineWidth = 1.5; c.stroke();
      c.restore();
    }
    // dial ring + handle wheel
    c.beginPath(); c.arc(0, 0, 46, 0, TAU); c.fillStyle = '#1b2026'; c.fill(); c.strokeStyle = granted ? C.g : '#8893a0'; c.lineWidth = 2.5; c.stroke();
    c.save(); c.rotate(spin);
    c.strokeStyle = '#c9d3dd'; c.lineWidth = 9; c.lineCap = 'round';
    for (i = 0; i < 3; i++) { a = i / 3 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); c.lineTo(Math.cos(a) * 70, Math.sin(a) * 70); c.stroke(); }
    c.lineCap = 'butt';
    for (i = 0; i < 3; i++) { a = i / 3 * TAU; c.beginPath(); c.arc(Math.cos(a) * 72, Math.sin(a) * 72, 9, 0, TAU); c.fillStyle = '#e6edf3'; c.fill(); }
    c.beginPath(); c.arc(0, 0, 20, 0, TAU); grd = c.createRadialGradient(-6, -6, 2, 0, 0, 20); grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#8794a2'); c.fillStyle = grd; c.fill();
    c.restore();
    c.restore();
    c.restore();
  }

  function draw() {
    var c = S.ctx, k = S.k;
    if (S.bgDirty) {
      var b = S.bg.getContext('2d'); b.setTransform(k, 0, 0, k, 0, 0); b.clearRect(0, 0, SW, SH); drawBG(b); S.bgDirty = false;
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.drawImage(S.bg, 0, 0);
    c.setTransform(k, 0, 0, k, 0, 0);
    drawLog(c, 1);
    if (S.phase === 'intro') { drawConnect(c, S.pt); drawPins(c, clamp(S.pt / 0.5, 0, 1)); }
    else {
      if (S.phase !== 'final' || S.pt < 0.76) drawWidget(c);
      drawPins(c, S.phase === 'final' ? 1 - clamp((S.pt - 0.3) / 0.2, 0, 1) : 1);
      if (S.phase === 'final' && S.pt >= 0.5) drawVault(c, S.pt);
    }
    // particles (hex shards + pixels)
    if (S.parts.length) {
      c.font = '700 18px ' + MONO; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (var i = 0; i < S.parts.length; i++) {
        var p = S.parts[i], al = 1 - p.t / p.life;
        c.globalAlpha = al; c.fillStyle = p.col;
        if (p.sq) c.fillRect(p.x - 2.5, p.y - 2.5, 5, 5); else c.fillText(p.ch, p.x, p.y);
      }
      c.globalAlpha = 1;
    }
    if (S.flash > 0.004) { c.fillStyle = 'rgba(' + S.flashC + ',' + S.flash.toFixed(3) + ')'; c.fillRect(0, 0, SW, SH); }
    // glitch: displaced slices + a chroma ghost (skipped for reduced motion)
    if (S.gl > 0.01 && !S.reduced) {
      var W = S.cv.width, H = S.cv.height, s = S.gl;
      c.setTransform(1, 0, 0, 1, 0, 0);
      for (var j = 0; j < 6; j++) {
        var sy = Math.random() * H, sh = rnd(3, 24) * k, dx = rnd(-26, 26) * k * s;
        if (sy + sh > H) sh = H - sy;
        if (sh >= 1) c.drawImage(S.cv, 0, sy, W, sh, dx, sy, W, sh);
      }
      if (s > 0.4) {
        c.globalAlpha = 0.22 * s; c.globalCompositeOperation = 'lighter';
        c.drawImage(S.cv, 5 * k * s, 0);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        c.fillStyle = 'rgba(255,30,60,' + (0.07 * s).toFixed(3) + ')'; c.fillRect(0, (Math.random() * H) | 0, W, (rnd(20, 70) * k) | 0);
      }
    }
  }

  return api;
})();

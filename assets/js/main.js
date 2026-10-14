/* עדי ויינשטיין · UGC — interactions
   Prices live in index.html (data-price on each menu input). */

(function () {
  'use strict';

  var PHONE = '972536267521';
  var html = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fmt(n) { return Math.round(n).toLocaleString('he-IL'); }
  function waLink(text) { return 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(text); }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---------- generic WhatsApp links ---------- */
  var GENERIC_MSG = 'היי עדי, הגעתי מהאתר ואשמח לשמוע על סרטוני UGC לעסק שלי.';
  $$('[data-wa]').forEach(function (a) {
    if (a.id !== 'r-send' && a.id !== 'dock-btn') a.href = waLink(GENERIC_MSG);
    a.target = '_blank';
    a.rel = 'noopener';
  });

  $('#year').textContent = new Date().getFullYear();

  /* ---------- nav border on scroll ---------- */
  var nav = $('.nav');
  function onScroll() { nav.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ==========================================================
     ORDER BUILDER (the menu)
     ========================================================== */
  var form = $('#order');
  var linesEl = $('#r-lines');
  var totalEl = $('#r-total');
  var perEl = $('#r-per');
  var sendBtn = $('#r-send');
  var dockPrice = $('#dock-price');
  var shownTotal = 1350;
  var currentTotal = 1350;

  // keep visible prices in sync with data-price (single source of truth)
  $$('input[data-price]', form).forEach(function (input) {
    var label = input.closest('.item');
    var el = label && $('[data-show-price]', label);
    if (el) el.textContent = fmt(+input.dataset.price) + ' ₪';
  });

  var d = new Date();
  $('#r-date').textContent = d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();

  function readOrder() {
    var main = $('input[name="main"]:checked', form);
    var videos = +main.dataset.videos;
    var monthly = main.dataset.monthly === 'true';
    var lines = [{ label: main.dataset.name + ' · ' + main.dataset.sub, price: +main.dataset.price }];

    $$('input[name="addon"]', form).forEach(function (input) {
      var item = input.closest('.item');
      var disabled = monthly && input.dataset.notMonthly === 'true';
      var included = monthly && input.dataset.includedMonthly === 'true';

      item.classList.toggle('is-disabled', disabled);
      item.classList.toggle('is-included', included);
      input.disabled = disabled || included;

      if (included) {
        lines.push({ label: input.dataset.name, price: 0, free: true });
        return;
      }
      if (disabled || !input.checked) return;

      var perVideo = input.dataset.perVideo === 'true';
      var qty = perVideo ? videos : 1;
      lines.push({
        label: input.dataset.name + (perVideo && qty > 1 ? ' × ' + qty : ''),
        price: +input.dataset.price * qty
      });
    });

    var total = lines.reduce(function (s, l) { return s + l.price; }, 0);
    return { lines: lines, total: total, monthly: monthly };
  }

  function buildMessage(order) {
    var out = ['היי עדי, הגעתי מהאתר ואשמח להזמין:', ''];
    order.lines.forEach(function (l) {
      out.push('• ' + l.label + ' — ' + (l.free ? 'כלול' : fmt(l.price) + ' ₪'));
    });
    out.push('', 'סה״כ משוער: ' + fmt(order.total) + ' ₪' + (order.monthly ? ' לחודש' : ''));
    out.push('', 'שם העסק:', 'מה רוצים לקדם:');
    return out.join('\n');
  }

  function renderTotal(value) {
    totalEl.textContent = fmt(value);
    if (dockPrice && menuInView) dockPrice.textContent = fmt(value);
  }

  function update(animate) {
    var order = readOrder();

    linesEl.innerHTML = '';
    order.lines.forEach(function (l) {
      var li = document.createElement('li');
      if (l.free) li.className = 'is-free';
      var a = document.createElement('span');
      var b = document.createElement('span');
      a.textContent = l.label;
      b.textContent = l.free ? 'כלול' : fmt(l.price) + ' ₪';
      li.appendChild(a);
      li.appendChild(b);
      linesEl.appendChild(li);
    });

    perEl.textContent = order.monthly ? ' / חודש' : '';
    sendBtn.href = waLink(buildMessage(order));
    var dockBtn = $('#dock-btn');
    if (menuInView) dockBtn.href = sendBtn.href;

    currentTotal = order.total;
    if (animate && window.gsap && !reduceMotion) {
      var counter = { v: shownTotal };
      gsap.to(counter, {
        v: order.total, duration: .6, ease: 'power3.out', overwrite: true,
        onUpdate: function () { renderTotal(counter.v); shownTotal = counter.v; }
      });
      gsap.fromTo(linesEl.lastElementChild, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: .4, ease: 'power2.out' });
    } else {
      renderTotal(order.total);
      shownTotal = order.total;
    }
  }

  /* ---------- mobile dock: shows the live total while the menu is on screen ---------- */
  var dock = $('#dock');
  var dockLabel = $('#dock-label');
  var dockText = $('#dock-text');
  var menuInView = false;

  function syncDock() {
    if (menuInView) {
      dockLabel.textContent = 'סה״כ';
      dockPrice.textContent = fmt(currentTotal);
      dockText.textContent = 'שליחת הזמנה';
      $('#dock-btn').href = sendBtn.href;
    } else {
      dockLabel.textContent = 'החל מ־';
      dockPrice.textContent = '500';
      dockText.textContent = 'וואטסאפ';
      $('#dock-btn').href = waLink(GENERIC_MSG);
    }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { menuInView = e.isIntersecting; });
      syncDock();
    }, { rootMargin: '-35% 0px -35% 0px' }).observe($('#menu'));

    // hide the dock over the hero (CTA already visible) and over the final contact block
    var hideFor = { hero: true, contact: false };
    var dockIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        hideFor[e.target.id === 'contact' ? 'contact' : 'hero'] = e.isIntersecting;
      });
      dock.classList.toggle('is-hidden', hideFor.hero || hideFor.contact);
    }, { threshold: 0.15 });
    dockIO.observe($('.hero__ctas'));
    dockIO.observe($('#contact'));
  }

  form.addEventListener('change', function () { update(true); });
  update(false);
  syncDock();

  /* ==========================================================
     MOTION
     ========================================================== */
  function reveal() { html.classList.remove('is-loading'); }

  if (!window.gsap || reduceMotion) { reveal(); return; }

  gsap.registerPlugin(ScrollTrigger);

  var fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();
  var maxWait = new Promise(function (r) { setTimeout(r, 900); });

  Promise.race([fontsReady, maxWait]).then(function () {
    var mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', function () {
      /* --- hero entrance: one orchestrated timeline --- */
      gsap.set('.hero__inner', { autoAlpha: 1 });
      reveal();

      var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
      tl.from('.hero__title .ln > span', { yPercent: 110, duration: 1.15, stagger: .12 })
        .fromTo('.hero__photo .photo',
          { clipPath: 'inset(100% 0% 0% 0% round 14px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 14px)', duration: 1.35, ease: 'expo.out' }, .15)
        .from('.hero__photo .photo img', { scale: 1.25, duration: 1.8, ease: 'expo.out' }, .15)
        .from('.hero-meta', { opacity: 0, y: 18, duration: .8, stagger: .08, ease: 'power3.out' }, .55)
        .from('.sticker', { scale: 0, rotate: -70, duration: .9, ease: 'back.out(1.8)' }, .9);

      /* --- headings: line masks --- */
      gsap.utils.toArray('[data-lines]').forEach(function (h) {
        if (h.closest('.hero')) return;
        gsap.from($$('.ln > span', h), {
          yPercent: 110, duration: 1, stagger: .1, ease: 'power4.out',
          scrollTrigger: { trigger: h, start: 'top 85%', once: true }
        });
      });

      /* --- generic reveals --- */
      gsap.utils.toArray('[data-reveal]').forEach(function (el) {
        if (el.dataset.reveal === 'phone') return;
        gsap.from(el, {
          y: 36, opacity: 0, duration: .9, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
      });

      /* --- phone: rises and straightens a little --- */
      gsap.from('.phone', {
        y: 80, rotate: -4, opacity: 0, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: '.phone', start: 'top 85%', once: true }
      });

      /* --- menu items cascade in --- */
      gsap.from('.board .item', {
        opacity: 0, y: 14, duration: .6, stagger: .06, ease: 'power3.out',
        scrollTrigger: { trigger: '.board', start: 'top 75%', once: true }
      });

      /* --- photo parallax --- */
      gsap.utils.toArray('[data-parallax] img').forEach(function (img) {
        gsap.fromTo(img, { yPercent: -5 }, {
          yPercent: 5, ease: 'none',
          scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });

      /* --- process line draws as you scroll through the steps --- */
      var desktop = window.matchMedia('(min-width: 861px)').matches;
      gsap.fromTo('.steps__line span',
        desktop ? { scaleX: 0 } : { scaleY: 0 },
        Object.assign(desktop ? { scaleX: 1 } : { scaleY: 1 }, {
          ease: 'none',
          scrollTrigger: { trigger: '.steps', start: 'top 80%', end: 'bottom 60%', scrub: .6 }
        })
      );
      gsap.from('.step__dot', {
        scale: 0, duration: .5, stagger: .15, ease: 'back.out(2)',
        scrollTrigger: { trigger: '.steps', start: 'top 75%', once: true }
      });
    });

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  });
})();

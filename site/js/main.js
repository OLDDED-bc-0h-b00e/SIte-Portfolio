(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  root.classList.remove('no-js');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fineHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } },
  };

  /* ---------- Язык RU / EN ---------- */
  let lang = 'ru';
  const t = key => (window.I18N && I18N[lang] && I18N[lang][key]) || null;

  function setLang(next) {
    if (!window.I18N || !I18N[next]) return;
    lang = next;
    root.lang = next;
    $$('[data-i18n]').forEach(el => { const v = t(el.dataset.i18n); if (v) el.textContent = v; });
    $$('[data-i18n-attr]').forEach(el => {
      el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, key] = pair.split(':');
        const v = t(key);
        if (v) el.setAttribute(attr, v);
      });
    });
    document.title = t('meta.title');
    const d = $('meta[name="description"]'); if (d) d.content = t('meta.desc');
    $$('.lang [data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === next)));
    syncBurgerLabel();
    store.set('lang', next);
  }

  $$('.lang [data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

  /* ---------- Заголовок Hero по буквам ---------- */
  const heroTitle = $('#heroTitle');
  'MOONLIGHT'.split('').forEach((c, i) => {
    const span = document.createElement('span');
    span.className = 'ch'; span.style.setProperty('--n', i); span.setAttribute('aria-hidden', 'true');
    span.innerHTML = `<i>${c}</i>`;
    heroTitle.insertBefore(span, heroTitle.lastElementChild);
  });

  /* ---------- Плавный скролл (Lenis, если загрузился) ---------- */
  let lenis = null;
  function initLenis() {
    if (reduceMotion || !window.Lenis) return;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    if (document.body.classList.contains('is-loading')) lenis.stop();
  }
  window.addEventListener('load', initLenis);
  if (document.readyState === 'complete') initLenis();

  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { duration: 1.3 });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  /* ---------- Прелоадер ---------- */
  const pl = $('#preloader'), plLit = $('#plLit'), plCount = $('#plCount'), plPhrase = $('#plPhrase');
  const hero = $('#top');
  let plFinished = false;

  function finishPreloader() {
    if (plFinished) return;
    plFinished = true;
    setPl(100);
    setTimeout(() => {
      pl.classList.add('is-done');
      document.body.classList.remove('is-loading');
      if (lenis) lenis.start();
      hero.classList.add('is-in');
      setTimeout(() => pl.remove(), 1200);
    }, 450);
  }
  function setPl(p) {
    plLit.style.setProperty('--cut', (100 - p) + '%');
    plCount.textContent = Math.round(p) + '%';
    if (p > 45) plPhrase.classList.add('is-on');
  }

  const minTime = reduceMotion ? 300 : 2400;
  const ready = Promise.all([
    (document.fonts && document.fonts.ready) || Promise.resolve(),
    new Promise(res => { const im = $('#heroImg'); if (im.complete) res(); else { im.addEventListener('load', res); im.addEventListener('error', res); } }),
  ]);
  let isReady = false;
  ready.then(() => { isReady = true; });
  setTimeout(() => { isReady = true; }, 6000);

  const plStart = performance.now();
  (function plTick(now) {
    const e = now - plStart;
    const target = isReady ? 100 : 88;
    const timeP = clamp(e / minTime, 0, 1);
    const eased = 1 - Math.pow(1 - timeP, 3);
    const p = Math.min(eased * 100, target);
    setPl(p);
    if (p >= 100) finishPreloader(); else requestAnimationFrame(plTick);
  })(plStart);

  /* ---------- Хедер, меню, активный пункт ---------- */
  const header = $('#header'), burger = $('#burger');
  const onScrollHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  function syncBurgerLabel() {
    const open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-label', t(open ? 'menu.close' : 'menu.open') || 'Menu');
  }
  function toggleMenu(force) {
    const open = typeof force === 'boolean' ? force : burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('nav-open', open);
    if (lenis) open ? lenis.stop() : lenis.start();
    syncBurgerLabel();
  }
  burger.addEventListener('click', () => toggleMenu());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) toggleMenu(false); });
  /* поворот планшета шире 860px прячет бургер: закрываем меню, иначе скролл остаётся заблокированным */
  matchMedia('(min-width: 861px)').addEventListener('change', e => {
    if (e.matches && document.body.classList.contains('nav-open')) toggleMenu(false);
  });

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? hero : $(id);
    if (!target) return;
    e.preventDefault();
    toggleMenu(false);
    scrollToTarget(target);
  }));

  const navLinks = $$('.nav a');
  const navObs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      navLinks.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['services', 'cases', 'about', 'process', 'contact'].forEach(id => { const s = document.getElementById(id); if (s) navObs.observe(s); });

  /* ---------- Появление блоков ---------- */
  const revObs = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-visible'); revObs.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal]').forEach(el => revObs.observe(el));

  /* ---------- Курсор ---------- */
  const cursor = $('#cursor');
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, has: false };
  const ring = { x: mouse.x, y: mouse.y };
  const dot = $('.cursor__dot'), ringEl = $('.cursor__ring');
  if (fineHover) {
    root.classList.add('has-cursor');
    document.addEventListener('mouseover', e => {
      cursor.classList.toggle('is-hover', !!e.target.closest('a, button, [data-cursor]'));
    });
  }
  window.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (!mouse.has) { mouse.has = true; cursor.classList.add('is-on'); }
  }, { passive: true });

  /* ---------- Цветной след в Hero (как на nickho-motorsports.nl), кнопка-магнит, заливка надписи ---------- */
  const heroAmb = $('.hero__amb'), heroBg = $('.hero__bg'), heroLit = $('#heroLit'), heroShade = $('.hero__shade'), cta = $('#heroCta');
  const giant = $('#giant'), giantFill = $('#giantFill');
  const body = () => ({ x: 0, y: 0, vx: 0, vy: 0 });
  const light = body(), fill = body();
  let lightInit = false, fillInit = false, lastT = performance.now(), frameN = 0;
  const ctaState = { x: 0, y: 0, tx: 0, ty: 0 };
  let heroVisible = true, footerVisible = false;
  new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }).observe(hero);
  new IntersectionObserver(es => { footerVisible = es[0].isIntersecting; }, { threshold: 0.05 }).observe($('#contact'));

  /* Пружина с демпфированием: лёгкий разгон, инерция и небольшой «перелёт» */
  function spring(s, tx, ty, dt, k, c) {
    s.vx += ((tx - s.x) * k - s.vx * c) * dt; s.vy += ((ty - s.y) * k - s.vy * c) * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
  }

  /* Фото 969x1624 показываем по высоте экрана: видно лицо и корпус, строго по центру.
     На широких экранах края уходят в фон, на узких режем по бокам, но не по лицу. */
  const PHOTO = { ratio: 1624 / 969, faceX: 0.49, faceY: 0.15 };
  const geo = { iw: 0, il: 0, ih: 0, it: 0 };

  /* След: в maskCanvas копятся мягкие мазки кисти и постепенно гаснут, через них проявляется цветная копия фото */
  const trailCanvas = $('#heroTrail'), tctx = trailCanvas.getContext('2d');
  const maskCanvas = document.createElement('canvas'), mctx = maskCanvas.getContext('2d');
  const photo = new Image(); let photoReady = false;
  photo.onload = () => { photoReady = true; };
  photo.src = $('#heroImg').getAttribute('src');
  const trail = { sc: 1, cw: 0, ch: 0, visH: 0, last: null };

  function sizeTrail() {
    const heroH = hero.clientHeight || innerHeight;
    /* на телефоне холст маленький по CSS-размеру, но экран плотный: разрешение 1-1.5x, иначе цветной слой выходит пиксельным */
    const sc = fineHover ? clamp(devicePixelRatio * 0.7, 0.7, 1.1) : clamp(devicePixelRatio * 0.75, 1, 1.5);
    const visH = Math.min(geo.ih, heroH * 1.08);
    trail.sc = sc; trail.visH = visH;
    trail.cw = Math.max(1, Math.round(geo.iw * sc)); trail.ch = Math.max(1, Math.round(visH * sc));
    trailCanvas.width = maskCanvas.width = trail.cw;
    trailCanvas.height = maskCanvas.height = trail.ch;
    trailCanvas.style.width = geo.iw + 'px'; trailCanvas.style.height = visH + 'px'; trailCanvas.style.left = geo.il + 'px';
    trail.last = null;
  }

  function layoutHero() {
    const W = hero.clientWidth, H = hero.clientHeight || innerHeight;
    const iw = Math.max(Math.min(W, 1.39 * H), H / PHOTO.ratio);
    const il = (W - iw) / 2;
    /* на узком экране фото на всю ширину и голова попадает под логотип: опускаем кадр на высоту хедера */
    const it = W <= 860 ? header.offsetHeight : 0;
    geo.iw = iw; geo.il = il; geo.ih = iw * PHOTO.ratio; geo.it = it;
    hero.style.setProperty('--iw', iw.toFixed(1) + 'px');
    hero.style.setProperty('--il', il.toFixed(1) + 'px');
    hero.style.setProperty('--it', it + 'px');
    sizeTrail();
  }
  layoutHero();
  /* На телефоне адресная строка при скролле меняет высоту окна и шлёт resize: перерасчёт нужен только при реальной смене размера */
  let lastW = hero.clientWidth, lastH = hero.clientHeight;
  window.addEventListener('resize', () => {
    const w = hero.clientWidth, h = hero.clientHeight;
    if (w === lastW && Math.abs(h - lastH) < 160) return;
    lastW = w; lastH = h;
    layoutHero();
  });

  function stamp(x, y, r, a) {
    const g = mctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.35, `rgba(255,255,255,${(a * 0.75).toFixed(3)})`);
    g.addColorStop(0.7, `rgba(255,255,255,${(a * 0.28).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    mctx.fillStyle = g; mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI * 2); mctx.fill();
  }

  /* x, y в px относительно канваса с цветом; r радиус кисти в px */
  function paintTrail(x, y, r) {
    if (!photoReady) return;
    mctx.globalCompositeOperation = 'destination-out';
    mctx.fillStyle = 'rgba(0,0,0,0.045)';
    mctx.fillRect(0, 0, trail.cw, trail.ch);
    mctx.globalCompositeOperation = 'source-over';

    const sc = trail.sc, px = x * sc, py = y * sc, pr = r * sc;
    if (trail.last) {
      const dx = px - trail.last.x, dy = py - trail.last.y, d = Math.hypot(dx, dy);
      const n = Math.min(Math.ceil(d / Math.max(pr * 0.22, 2)), 40);
      for (let i = 1; i <= n; i++) stamp(trail.last.x + dx * i / n, trail.last.y + dy * i / n, pr, 0.17);
    } else stamp(px, py, pr, 0.28);
    trail.last = { x: px, y: py };

    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, trail.cw, trail.ch);
    tctx.drawImage(photo, 0, 0, photo.naturalWidth, photo.naturalHeight * (trail.visH / geo.ih), 0, 0, trail.cw, trail.ch);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(maskCanvas, 0, 0);
    tctx.globalCompositeOperation = 'source-over';
  }

  function facePoint(r) {
    return {
      x: clamp((geo.il + geo.iw * PHOTO.faceX) / r.width, 0, 1),
      y: clamp((-0.04 * r.height + geo.it + geo.ih * PHOTO.faceY) / r.height, 0, 1),
    };
  }

  function frame(now) {
    const dt = Math.min((now - lastT) / 1000, 0.033); lastT = now;
    if (lenis) lenis.raf(now);

    if (fineHover && mouse.has) {
      dot.style.transform = `translate(${mouse.x}px, ${mouse.y}px)`;
      ring.x = lerp(ring.x, mouse.x, 0.18); ring.y = lerp(ring.y, mouse.y, 0.18);
      ringEl.style.transform = `translate(${ring.x}px, ${ring.y}px)`;
    }

    if (heroVisible) {
      const r = hero.getBoundingClientRect();
      const face = facePoint(r);
      let tx, ty;
      if (fineHover && mouse.has && !reduceMotion) {
        tx = clamp((mouse.x - r.left) / r.width, 0, 1);
        ty = clamp((mouse.y - r.top) / r.height, 0, 1);
      } else if (!reduceMotion) {
        const s = now / 1000;
        tx = face.x + 0.09 * Math.sin(s * 0.55);
        ty = face.y + 0.14 + 0.1 * Math.sin(s * 0.8 + 1);
      } else { tx = face.x; ty = face.y + 0.1; }

      if (!lightInit) { light.x = tx; light.y = ty; lightInit = true; }
      if (reduceMotion) { light.x = tx; light.y = ty; light.vx = light.vy = 0; }
      else spring(light, tx, ty, dt, 70, 9);

      /* параллакс только для мыши: на телефоне JS отстаёт от нативного скролла и картинка дрожит */
      const par = fineHover ? clamp(-r.top, 0, r.height) * 0.18 : 0;
      const tr = `translate3d(0, ${par.toFixed(1)}px, 0)`;
      heroAmb.style.transform = heroBg.style.transform = heroLit.style.transform = heroShade.style.transform = tr;

      /* позиция кисти: точка пружины -> координаты цветного канваса */
      const cr = heroLit.getBoundingClientRect();
      const cx = r.left + light.x * r.width - (cr.left + geo.il);
      const cy = r.top + light.y * r.height - (cr.top + geo.it);
      const speed = Math.hypot(light.vx * r.width, light.vy * r.height);
      const base = Math.max(220, Math.min(420, r.width * 0.2)) * 0.55;
      if (fineHover || (frameN++ & 1) === 0) paintTrail(cx, cy, base * (1 + Math.min(speed / 2600, 0.35)));

      if (fineHover && mouse.has && !reduceMotion) {
        const br = cta.getBoundingClientRect();
        const bx = br.left + br.width / 2 - ctaState.x, by = br.top + br.height / 2 - ctaState.y;
        const dx = mouse.x - bx, dy = mouse.y - by, d = Math.hypot(dx, dy);
        const reach = br.width * 1.1;
        ctaState.tx = d < reach ? dx * 0.28 : 0; ctaState.ty = d < reach ? dy * 0.28 : 0;
      }
      ctaState.x = lerp(ctaState.x, ctaState.tx, 0.15); ctaState.y = lerp(ctaState.y, ctaState.ty, 0.15);
      cta.style.transform = hero.classList.contains('is-in') ? `translate(${ctaState.x.toFixed(1)}px, ${ctaState.y.toFixed(1)}px)` : '';
    }

    if (footerVisible) {
      const gr = giant.getBoundingClientRect();
      let tx, ty;
      const near = fineHover && mouse.has && !reduceMotion
        && mouse.y > gr.top - gr.height * 0.8 && mouse.y < gr.bottom + gr.height * 0.8
        && mouse.x > gr.left - 120 && mouse.x < gr.right + 120;
      if (near) { tx = mouse.x - gr.left; ty = mouse.y - gr.top; }
      else if (!reduceMotion) { tx = gr.width * (0.5 + 0.4 * Math.sin(now / 2200)); ty = gr.height * (0.5 + 0.12 * Math.sin(now / 1500)); }
      else { tx = gr.width * 0.5; ty = gr.height * 0.5; }
      if (!fillInit) { fill.x = tx; fill.y = ty; fillInit = true; }
      if (reduceMotion) { fill.x = tx; fill.y = ty; fill.vx = fill.vy = 0; } else spring(fill, tx, ty, dt, 60, 10);
      const fspeed = Math.hypot(fill.vx, fill.vy);
      const fr = gr.height * 0.95 * (1 + Math.min(fspeed / 3000, 0.3));
      giantFill.style.setProperty('--fx', fill.x.toFixed(1) + 'px');
      giantFill.style.setProperty('--fy', fill.y.toFixed(1) + 'px');
      giantFill.style.setProperty('--fr', fr.toFixed(0) + 'px');
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- Аккордеон услуг ---------- */
  /* закрытая панель inert: её кнопка «Заказать» не получает фокус с клавиатуры */
  const syncAcc = () => $$('.acc__item').forEach(i => { $('.acc__panel', i).inert = !i.classList.contains('is-open'); });
  $$('.acc__btn').forEach(btn => btn.addEventListener('click', () => {
    const item = btn.closest('.acc__item');
    const open = !item.classList.contains('is-open');
    $$('.acc__item').forEach(i => {
      i.classList.remove('is-open');
      $('.acc__btn', i).setAttribute('aria-expanded', 'false');
    });
    if (open) { item.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
    syncAcc();
  }));
  syncAcc();

  /* ---------- 3D-карусель кейсов ---------- */
  const stage = $('#stage'), cases = $$('.case', stage), dotsBox = $('#dots');
  let cur = 0;
  const n = cases.length;
  cases.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', String(i + 1));
    b.addEventListener('click', () => go(i));
    dotsBox.append(b);
  });
  function render() {
    cases.forEach((c, i) => {
      let o = ((i - cur) % n + n) % n; if (o > n / 2) o -= n;
      c.style.setProperty('--o', o);
      c.style.setProperty('--a', Math.abs(o));
      c.style.zIndex = String(10 - Math.abs(o));
      c.classList.toggle('is-active', o === 0);
      c.setAttribute('aria-hidden', String(o !== 0));
    });
    $$('button', dotsBox).forEach((d, i) => d.setAttribute('aria-selected', String(i === cur)));
  }
  function go(i) { cur = ((i % n) + n) % n; render(); }
  $('#prev').addEventListener('click', () => go(cur - 1));
  $('#next').addEventListener('click', () => go(cur + 1));
  cases.forEach((c, i) => c.addEventListener('click', () => { if (!dragMoved) go(i); }));
  $('#carousel').addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') go(cur - 1);
    if (e.key === 'ArrowRight') go(cur + 1);
  });

  let dragX = null, dragMoved = false;
  stage.addEventListener('pointerdown', e => { dragX = e.clientX; dragMoved = false; });
  window.addEventListener('pointermove', e => { if (dragX !== null && Math.abs(e.clientX - dragX) > 8) dragMoved = true; });
  window.addEventListener('pointerup', e => {
    if (dragX === null) return;
    const dx = e.clientX - dragX; dragX = null;
    if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
    setTimeout(() => { dragMoved = false; }, 0);
  });
  /* браузер забрал жест под вертикальный скролл: pointerup не придёт, сбрасываем старт свайпа */
  window.addEventListener('pointercancel', () => { dragX = null; dragMoved = false; });
  render();

  /* ---------- Копирование контактов ---------- */
  $$('.copy').forEach(btn => btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    let ok = true;
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    btn.classList.toggle('is-done', ok);
    btn.textContent = ok ? (t('ct.copied') || 'Copied') : (t('ct.copyFail') || 'Failed');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.classList.remove('is-done'); btn.textContent = t('ct.copy') || 'Copy'; }, 1600);
  }));

  /* ---------- Линия процесса ---------- */
  const steps = $('#steps'), stepsLine = $('#stepsLine'), stepItems = $$('li', steps);
  function updateSteps() {
    const r = steps.getBoundingClientRect();
    const vertical = getComputedStyle(stepsLine).width === '1px';
    const p = clamp((innerHeight * 0.72 - r.top) / (vertical ? r.height : innerHeight * 0.4), 0, 1);
    stepsLine.style.setProperty('--p', p.toFixed(3));
    stepItems.forEach((li, i) => li.classList.toggle('is-lit', p >= i / (stepItems.length - 1) - 0.02 && p > 0));
  }
  window.addEventListener('scroll', updateSteps, { passive: true });
  window.addEventListener('resize', updateSteps);
  updateSteps();

  /* ---------- Стартовый язык (в конце, когда всё объявлено) ---------- */
  const savedLang = store.get('lang');
  setLang(savedLang === 'en' || savedLang === 'ru' ? savedLang : (/^(ru|uk|be|kk)/i.test(navigator.language || '') ? 'ru' : 'en'));
})();

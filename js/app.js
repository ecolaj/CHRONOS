(() => {
  'use strict';

  /* ---------------- Storage ---------------- */
  const STORAGE_KEY = 'orbita-settings-v1';
  const defaults = {
    mode: 'elapsed',       // 'elapsed' | 'remaining'
    theme: 'medianoche',
    precision: 2,          // 0 | 2 | 4
    showDays: true,
    animatedSky: true,
    wakeLock: false,
  };
  const settings = { ...defaults, ...loadSettings() };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  /* ---------------- Themes ---------------- */
  const THEMES = [
    { id: 'medianoche', name: 'Medianoche', bg: '#0B0F19', a: '#F2C879' },
    { id: 'aurora',     name: 'Aurora',     bg: '#0D1321', a: '#4CC9F0' },
    { id: 'papel',      name: 'Papel',      bg: '#F7F5F0', a: '#2D5B4E' },
    { id: 'terminal',   name: 'Terminal',   bg: '#05070A', a: '#7CFC9A' },
    { id: 'marea',      name: 'Marea',      bg: '#071A22', a: '#4ECDC4' },
  ];

  /* ---------------- Elements ---------------- */
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const percentValue = $('percentValue');
  const modeCaption = $('modeCaption');
  const subStats = $('subStats');
  const dateLabel = $('dateLabel');
  const progressArc = $('progressArc');
  const mover = $('mover');
  const ticksGroup = $('ticks');
  const themeGrid = $('themeGrid');
  const sheet = $('sheet');
  const sheetBackdrop = $('sheetBackdrop');
  const settingsBtn = $('settingsBtn');
  const closeSheetBtn = $('closeSheetBtn');
  const showDaysToggle = $('showDaysToggle');
  const animatedSkyToggle = $('animatedSkyToggle');
  const wakeLockToggle = $('wakeLockToggle');

  const RADIUS = 140;
  const CIRC = 2 * Math.PI * RADIUS;
  progressArc.style.strokeDasharray = `${CIRC}`;

  const monthLetters = ['E','F','M','A','M','J','J','A','S','O','N','D'];

  /* ---------------- Build ticks (12 months) ---------------- */
  function buildTicks() {
    ticksGroup.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
      const x1 = 160 + Math.cos(angle) * 132;
      const y1 = 160 + Math.sin(angle) * 132;
      const x2 = 160 + Math.cos(angle) * 140;
      const y2 = 160 + Math.sin(angle) * 140;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('class', 'tick');
      ticksGroup.appendChild(line);
    }
  }
  buildTicks();

  /* ---------------- Build theme swatches ---------------- */
  function buildThemeGrid() {
    themeGrid.innerHTML = '';
    THEMES.forEach((t) => {
      const el = document.createElement('button');
      el.className = 'theme-swatch' + (t.id === settings.theme ? ' active' : '');
      el.style.background = t.bg;
      el.setAttribute('aria-label', t.name);
      el.dataset.theme = t.id;
      const dot = document.createElement('span');
      dot.className = 'theme-swatch-dot';
      dot.style.background = t.a;
      el.appendChild(dot);
      el.addEventListener('click', () => {
        settings.theme = t.id;
        applyTheme();
        saveSettings();
        [...themeGrid.children].forEach((c) => c.classList.toggle('active', c.dataset.theme === t.id));
      });
      themeGrid.appendChild(el);
    });
  }
  buildThemeGrid();

  function applyTheme() { body.dataset.theme = settings.theme; }
  applyTheme();

  /* ---------------- Year math ---------------- */
  function getYearProgress(now) {
    const year = now.getFullYear();
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    const end = new Date(year + 1, 0, 1, 0, 0, 0, 0);
    const total = end - start;
    const elapsed = now - start;
    const fraction = Math.min(1, Math.max(0, elapsed / total));
    const totalDays = Math.round(total / 86400000);
    const elapsedDays = Math.floor(elapsed / 86400000) + 1; // day 1 = Jan 1
    const remainingDays = totalDays - elapsedDays + 1;
    return { year, fraction, totalDays, elapsedDays, remainingDays };
  }

  /* ---------------- Formatting ---------------- */
  const monthsEs = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function formatDate(now) {
    return `${now.getDate()} de ${monthsEs[now.getMonth()]} de ${now.getFullYear()}`;
  }

  /* ---------------- Render ---------------- */
  function render() {
    const now = new Date();
    const { fraction, totalDays, elapsedDays, remainingDays, year } = getYearProgress(now);

    const isElapsed = settings.mode === 'elapsed';
    const displayFraction = isElapsed ? fraction : 1 - fraction;
    const pct = displayFraction * 100;

    // number
    const p = settings.precision;
    const [intPart, decPart] = pct.toFixed(p).split('.');
    percentValue.innerHTML = p > 0
      ? `${intPart}<span class="percent-decimals">.${decPart}</span><span class="percent-sign">%</span>`
      : `${intPart}<span class="percent-sign">%</span>`;

    modeCaption.textContent = isElapsed
      ? `del ${year} transcurrido`
      : `del ${year} restante`;

    if (settings.showDays) {
      subStats.textContent = isElapsed
        ? `día ${elapsedDays} de ${totalDays}`
        : `faltan ${remainingDays} días`;
      subStats.style.display = '';
    } else {
      subStats.style.display = 'none';
    }

    dateLabel.textContent = formatDate(now);

    // The ring/mover always reflect real calendar progress (fraction of the
    // year elapsed), so the orbit always advances forward regardless of mode.
    const offset = CIRC * (1 - fraction);
    progressArc.style.strokeDashoffset = offset;
  }

  /* fix mover positioning cleanly (simpler approach) */
  // The static circle in the markup sits at (160, 20) — the top of the ring.
  const MOVER_ORIGIN = { x: 160, y: 20 };
  function positionMover(fraction) {
    const angle = fraction * 2 * Math.PI - Math.PI / 2;
    const mx = 160 + Math.cos(angle) * 140;
    const my = 160 + Math.sin(angle) * 140;
    mover.setAttribute('transform', `translate(${mx - MOVER_ORIGIN.x} ${my - MOVER_ORIGIN.y})`);
  }

  function renderAll() {
    const now = new Date();
    const { fraction } = getYearProgress(now);
    render();
    positionMover(fraction);
  }

  /* ---------------- Mode switching ---------------- */
  function setMode(mode) {
    settings.mode = mode;
    saveSettings();
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    renderAll();
  }
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  /* ---------------- Precision switching ---------------- */
  document.querySelectorAll('[data-precision]').forEach((btn) => {
    btn.addEventListener('click', () => {
      settings.precision = Number(btn.dataset.precision);
      saveSettings();
      document.querySelectorAll('[data-precision]').forEach((b) =>
        b.classList.toggle('active', b === btn));
      renderAll();
    });
  });

  /* ---------------- Toggles ---------------- */
  showDaysToggle.addEventListener('change', () => {
    settings.showDays = showDaysToggle.checked;
    saveSettings();
    renderAll();
  });

  animatedSkyToggle.addEventListener('change', () => {
    settings.animatedSky = animatedSkyToggle.checked;
    saveSettings();
    starfield.setEnabled(settings.animatedSky);
  });

  let wakeLockSentinel = null;
  wakeLockToggle.addEventListener('change', async () => {
    settings.wakeLock = wakeLockToggle.checked;
    saveSettings();
    if (settings.wakeLock) {
      await requestWakeLock();
    } else if (wakeLockSentinel) {
      wakeLockSentinel.release().catch(() => {});
      wakeLockSentinel = null;
    }
  });
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
      }
    } catch (e) { /* silently ignore (unsupported / denied) */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (settings.wakeLock && document.visibilityState === 'visible' && !wakeLockSentinel) {
      requestWakeLock();
    }
  });

  /* ---------------- Sheet open/close ---------------- */
  function openSheet() {
    sheet.classList.add('open');
    sheetBackdrop.classList.add('visible');
    sheet.setAttribute('aria-hidden', 'false');
  }
  function closeSheet() {
    sheet.classList.remove('open');
    sheetBackdrop.classList.remove('visible');
    sheet.setAttribute('aria-hidden', 'true');
  }
  settingsBtn.addEventListener('click', openSheet);
  closeSheetBtn.addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);

  /* ---------------- Init controls from settings ---------------- */
  function initControls() {
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      const active = btn.dataset.mode === settings.mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-precision]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.precision) === settings.precision);
    });
    showDaysToggle.checked = settings.showDays;
    animatedSkyToggle.checked = settings.animatedSky;
    wakeLockToggle.checked = settings.wakeLock;
  }
  initControls();
  if (settings.wakeLock) requestWakeLock();

  /* ---------------- Starfield ---------------- */
  const starfield = (() => {
    const canvas = $('stars');
    const ctx = canvas.getContext('2d');
    let stars = [];
    let enabled = settings.animatedSky;
    let raf = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      const count = Math.round((window.innerWidth * window.innerHeight) / 9000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: (Math.random() * 1.3 + 0.3) * devicePixelRatio,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.4 + 0.15,
      }));
    }

    function getStarColor() {
      const style = getComputedStyle(document.body);
      return style.getPropertyValue('--star-color').trim() || '245,243,237';
    }

    function draw(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const color = getStarColor();
      for (const s of stars) {
        const twinkle = reduceMotion ? 0.6 : 0.4 + 0.6 * Math.abs(Math.sin(t * 0.0005 * s.speed + s.phase));
        ctx.beginPath();
        ctx.fillStyle = `rgba(${color}, ${twinkle * 0.8})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (enabled && !reduceMotion) raf = requestAnimationFrame(draw);
    }

    function start() {
      if (raf) return;
      draw(0);
      if (reduceMotion) { drawStatic(); }
    }
    function drawStatic() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const color = getStarColor();
      for (const s of stars) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${color}, 0.5)`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    function setEnabled(v) {
      enabled = v;
      if (enabled) start(); else stop();
    }

    window.addEventListener('resize', () => {
      resize();
      if (enabled) drawStatic();
    });
    resize();
    if (enabled) start(); else stop();

    return { setEnabled, refresh: () => { drawStatic(); } };
  })();

  // Redraw static stars whenever theme changes (color depends on theme)
  const themeObserver = new MutationObserver(() => starfield.refresh && starfield.refresh());
  themeObserver.observe(body, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------------- Ticking ---------------- */
  renderAll();
  setInterval(renderAll, 1000);

  /* ---------------- Service worker ---------------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();

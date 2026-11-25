(() => {
  'use strict';

  /* ---------------- Storage ---------------- */
  const STORAGE_KEY = 'chronos-settings-v1';
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
      const candidateKeys = [
        STORAGE_KEY,
        'orbita-settings-v1',
        'chronos-settings',
        'orbita-settings'
      ];
      for (const key of candidateKeys) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
          } catch (_) {}
        }
      }
      return {};
    } catch (e) { return {}; }
  }
  function saveSettings() {
    try {
      const serialized = JSON.stringify(settings);
      localStorage.setItem(STORAGE_KEY, serialized);
      localStorage.setItem('orbita-settings-v1', serialized);
    } catch (e) {}
  }

  /* ---------------- Themes ---------------- */
  const THEMES = [
    { id: 'medianoche', name: 'Medianoche', bg: '#0B0F19', a: '#F2C879' },
    { id: 'aurora',     name: 'Aurora',     bg: '#0D1321', a: '#4CC9F0' },
    { id: 'papel',      name: 'Papel',      bg: '#F7F5F0', a: '#2D5B4E' },
    { id: 'terminal',   name: 'Terminal',   bg: '#05070A', a: '#7CFC9A' },
    { id: 'marea',      name: 'Marea',      bg: '#071A22', a: '#4ECDC4' },
    { id: 'terracota', name: 'Terracota',  bg: '#181110', a: '#E07A5F' },
    { id: 'amatista',  name: 'Amatista',   bg: '#120E1E', a: '#B388FF' },
    { id: 'marfil',    name: 'Marfil',     bg: '#F4F0EA', a: '#9E6B38' },
    { id: 'bosque',    name: 'Bosque',     bg: '#0A140E', a: '#52B788' },
    { id: 'granate',   name: 'Granate',    bg: '#180C14', a: '#E65C8A' },
  ];

  /* ---------------- Elements ---------------- */
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const percentValue = $('percentValue');
  const modeCaption = $('modeCaption');
  const subStats = $('subStats');
  const dateLabel = $('dateLabel');
  const progressArc = $('progressArc');
  const markStart = $('markStart');
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
      el.setAttribute('title', t.name);
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

  /* ---------------- Orbit Animation Engine ---------------- */
  let currentVal = null;
  let targetVal = 0;
  let animRafId = null;

  function updatePercentDisplay(val) {
    const pct = val * 100;
    const p = settings.precision;
    const [intPart, decPart] = pct.toFixed(p).split('.');
    percentValue.innerHTML = p > 0
      ? `${intPart}<span class="percent-decimals">.${decPart}</span><span class="percent-sign">%</span>`
      : `${intPart}<span class="percent-sign">%</span>`;
  }

  function updateOrbitVisuals(val) {
    progressArc.style.strokeDashoffset = CIRC * (1 - val);
    if (mover) {
      mover.style.transform = `rotate(${val * 360}deg)`;
    }
  }

  function animateOrbitTo(newTargetVal) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // If an animation is already running toward essentially the same target
    // (e.g., 1s tick during a mode switch), update targetVal without restarting.
    if (animRafId !== null && Math.abs(newTargetVal - targetVal) < 0.001) {
      targetVal = newTargetVal;
      return;
    }

    targetVal = newTargetVal;

    // First load or reduced motion: update immediately
    if (currentVal === null || reduceMotion) {
      currentVal = targetVal;
      updateOrbitVisuals(currentVal);
      updatePercentDisplay(currentVal);
      return;
    }

    const diff = Math.abs(currentVal - targetVal);

    // Minor update (standard 1s interval tick), set directly without animation overhead
    if (diff < 0.001 && animRafId === null) {
      currentVal = targetVal;
      updateOrbitVisuals(currentVal);
      updatePercentDisplay(currentVal);
      return;
    }

    if (animRafId) cancelAnimationFrame(animRafId);

    const startVal = currentVal;
    const startTime = performance.now();
    const duration = 1200; // 25% slower than 900ms for a calmer, more deliberate glide

    function easeInOutCubic(x) {
      return x < 0.5
        ? 4 * x * x * x
        : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeInOutCubic(progress);

      currentVal = startVal + (targetVal - startVal) * eased;
      updateOrbitVisuals(currentVal);
      updatePercentDisplay(currentVal);

      if (progress < 1) {
        animRafId = requestAnimationFrame(step);
      } else {
        currentVal = targetVal;
        updateOrbitVisuals(currentVal);
        updatePercentDisplay(currentVal);
        animRafId = null;
      }
    }

    animRafId = requestAnimationFrame(step);
  }

  /* ---------------- Render ---------------- */
  function render() {
    const now = new Date();
    const { fraction, totalDays, elapsedDays, remainingDays, year } = getYearProgress(now);

    const isElapsed = settings.mode === 'elapsed';

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

    // Orbital progress arc and marker position
    // Value represents the percentage to display starting from 12 o'clock (-90deg)
    const val = isElapsed ? fraction : (1 - fraction);
    animateOrbitTo(val);
  }

  function renderAll() {
    render();
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
        vx: (Math.random() * 0.03 + 0.01) * devicePixelRatio,
        vy: -(Math.random() * 0.025 + 0.008) * devicePixelRatio,
        swayAmp: (Math.random() * 1.2 + 0.4) * devicePixelRatio,
        swayFreq: Math.random() * 0.0006 + 0.0003,
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
        if (!reduceMotion) {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x > canvas.width + 10) s.x = -10;
          if (s.x < -10) s.x = canvas.width + 10;
          if (s.y < -10) s.y = canvas.height + 10;
          if (s.y > canvas.height + 10) s.y = -10;
        }

        const swayX = reduceMotion ? 0 : Math.sin(t * s.swayFreq + s.phase) * s.swayAmp;
        const swayY = reduceMotion ? 0 : Math.cos(t * s.swayFreq * 0.8 + s.phase) * (s.swayAmp * 0.5);

        const twinkle = reduceMotion
          ? 0.6
          : 0.35 + 0.55 * (Math.sin(t * 0.0006 * s.speed + s.phase) ** 2);

        ctx.beginPath();
        ctx.fillStyle = `rgba(${color}, ${twinkle * 0.75})`;
        ctx.arc(s.x + swayX, s.y + swayY, s.r, 0, Math.PI * 2);
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

  /* ---------------- Service worker cleanup ---------------- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {});
      }
    }).catch(() => {});
  }
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) caches.delete(key).catch(() => {});
    }).catch(() => {});
  }
})();

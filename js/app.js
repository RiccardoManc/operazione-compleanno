/* =====================================================================
   APP — navigazione tra le schermate, progresso, salvataggio, audio,
   schermate "narrative" (intro, ripresa, 99%, rivelazione finale).
   I minigiochi stanno in games.js, i contenuti in config.js.
   ===================================================================== */
'use strict';

const STORAGE_KEY = 'operazione-compleanno';
const AUDIO_KEY = 'operazione-compleanno-audio';

// ordine dei livelli
const SCREENS = ['intro', 'quiz', 'crossword', 'suitcase', 'stress', 'dinner', 'almost', 'final'];

// la grafica si "ammorbidisce" man mano che ci si avvicina alla rivelazione
const THEMES = {
  intro: 'mission', quiz: 'mission', crossword: 'mission',
  suitcase: 'dusk', stress: 'dusk',
  dinner: 'twilight', almost: 'twilight',
  final: 'spa',
};
const THEME_COLORS = { mission: '#11131b', dusk: '#1b1d29', twilight: '#2a2431', spa: '#f4eee6' };

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');


/* ---------------------------------------------------------------------
   Utility
   --------------------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// sostituisce {name} e {nickname} nei testi
function fill(text) {
  return String(text ?? '')
    .replace(/\{name\}/g, CONFIG.name)
    .replace(/\{nickname\}/g, CONFIG.nickname);
}

// pausa (accorciata se l'utente preferisce meno animazioni)
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, reducedMotion.matches ? Math.min(ms, 200) : ms));
}

// crea un elemento da una stringa HTML
function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}


/* ---------------------------------------------------------------------
   Salvataggio su localStorage
   --------------------------------------------------------------------- */
const Store = {
  load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  },
  save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* modalità privata piena: pazienza */ }
  },
  clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* idem */ }
  },
};

function freshState() {
  return {
    screen: 'intro',   // livello da cui riprendere
    completed: [],     // livelli completati
    progress: 0,       // percentuale "regalo decifrato"
    games: {},         // stato interno dei giochi (risposte cruciverba, ecc.)
  };
}


/* ---------------------------------------------------------------------
   Audio: effetti sintetizzati con Web Audio (nessun file) + musica finale
   --------------------------------------------------------------------- */
const Sound = {
  ctx: null,
  music: null,
  enabled: true,

  // va chiamato dentro un tocco/click: i browser mobile lo richiedono
  unlock() {
    if (!CONFIG.audio.effects) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(freq, duration, { type = 'sine', gain = 0.06, delay = 0, to = null } = {}) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(amp).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  },

  play(name) {
    switch (name) {
      case 'tap':    this.tone(660, 0.06, { gain: 0.03 }); break;
      case 'type':   this.tone(1200, 0.03, { gain: 0.015, type: 'triangle' }); break;
      case 'ok':     this.tone(660, 0.12); this.tone(990, 0.18, { delay: 0.08 }); break;
      case 'error':  this.tone(220, 0.22, { type: 'triangle', gain: 0.07, to: 150 }); break;
      case 'tick':   this.tone(1800, 0.02, { gain: 0.012, type: 'square' }); break;
      case 'unlock': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { delay: i * 0.09, gain: 0.05 })); break;
      case 'soft':   [392, 494, 587].forEach((f, i) => this.tone(f, 0.9, { delay: i * 0.12, gain: 0.035 })); break;
      case 'heart':  this.tone(880, 0.25, { gain: 0.04, to: 1320 }); break;
    }
  },

  // la musica deve partire dentro un gesto dell'utente (vedi schermata 99%)
  startMusic() {
    const src = CONFIG.audio.finalMusic;
    if (!src || !this.enabled) return;
    if (!this.music) {
      this.music = new Audio(src);
      this.music.loop = true;
      this.music.preload = 'auto';
    }
    this.music.volume = 0;
    this.music.play().then(() => this.fadeMusic(CONFIG.audio.finalMusicVolume)).catch(() => { /* bloccata: niente musica */ });
  },

  fadeMusic(target) {
    const step = () => {
      if (!this.music) return;
      const v = this.music.volume + (target - this.music.volume) * 0.08;
      this.music.volume = Math.max(0, Math.min(1, v));
      if (Math.abs(target - v) > 0.01) requestAnimationFrame(step);
    };
    step();
  },

  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem(AUDIO_KEY, on ? '1' : '0'); } catch { /* ignore */ }
    if (this.music) {
      if (on && App.state.screen === 'final') this.music.play().catch(() => {});
      else this.music.pause();
    }
  },
};


/* ---------------------------------------------------------------------
   Toast (messaggi brevi) e modal
   --------------------------------------------------------------------- */
const Toast = {
  timer: null,
  show(html, type = '', top = false) {
    const t = $('#toast');
    t.innerHTML = html;
    t.className = `toast is-visible ${type ? 'toast--' + type : ''} ${top ? 'toast--top' : ''}`;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => t.classList.remove('is-visible'), 2800);
  },
};

const Modal = {
  opener: null,
  open(html) {
    const modal = $('#modal');
    this.opener = document.activeElement;
    $('#modal-content').innerHTML = html;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => modal.classList.add('is-open'));
    $('.modal__close', modal).focus();
  },
  close() {
    const modal = $('#modal');
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => { modal.hidden = true; }, reducedMotion.matches ? 0 : 250);
    if (this.opener) this.opener.focus();
  },
  init() {
    const modal = $('#modal');
    modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) this.close(); });
    document.addEventListener('keydown', (e) => {
      if (modal.hidden) return;
      if (e.key === 'Escape') this.close();
      // focus trap minimale
      if (e.key === 'Tab') {
        const focusable = $$('button, [href], [tabindex]:not([tabindex="-1"])', modal);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  },
};


/* ---------------------------------------------------------------------
   Schermata "indizio sbloccato" (comune a tutti i giochi)
   --------------------------------------------------------------------- */
function showUnlock({ label, clue, text }, cta = 'CONTINUA') {
  return new Promise((resolve) => {
    const layer = el(`
      <div class="unlock-layer">
        <div class="unlock" role="dialog" aria-modal="true" aria-labelledby="unlock-label">
          <p class="unlock__label" id="unlock-label"><span class="dot" aria-hidden="true"></span>${fill(label)}</p>
          <p class="unlock__clue">${fill(clue)}</p>
          ${text ? `<p class="unlock__text">${fill(text)}</p>` : ''}
          <button class="btn btn--primary" type="button">${cta}</button>
        </div>
      </div>`);
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('is-in'));
    const btn = $('button', layer);
    setTimeout(() => btn.focus({ preventScroll: true }), 50);
    btn.addEventListener('click', () => {
      Sound.play('tap');
      layer.classList.remove('is-in');
      setTimeout(() => layer.remove(), reducedMotion.matches ? 0 : 300);
      resolve();
    }, { once: true });
  });
}


/* ---------------------------------------------------------------------
   Schermate narrative
   --------------------------------------------------------------------- */
const Screens = {

  /* ---- 1. Intro ---- */
  intro(section) {
    const c = CONFIG.intro;
    section.innerHTML = `
      <div class="intro">
        <div class="radar" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="56" class="radar__ring"/>
            <circle cx="60" cy="60" r="38" class="radar__ring"/>
            <circle cx="60" cy="60" r="20" class="radar__ring"/>
            <path d="M60 60 L60 4 A56 56 0 0 1 108 32 Z" class="radar__sweep"/>
            <g class="radar__gift">
              <rect x="47" y="56" width="26" height="18" rx="2"/>
              <rect x="44" y="49" width="32" height="7" rx="2"/>
              <path d="M60 49v25M60 49c-3-7-11-8-11-3s8 3 11 3c3 0 11 2 11-3s-8-4-11 3"/>
            </g>
          </svg>
        </div>
        <ol class="boot" aria-hidden="true"></ol>
        <div class="intro__body" hidden>
          <p class="eyebrow">Dossier ${CONFIG.birthday}</p>
          <h1 class="title" tabindex="-1">${fill(c.title)}</h1>
          <p class="stamp">${fill(c.stamp)}</p>
          <div class="intro__lines">${c.lines.map((l) => `<p>${fill(l)}</p>`).join('')}</div>
          <button class="btn btn--primary btn--wide" type="button">${fill(c.cta)}</button>
        </div>
      </div>`;

    const boot = $('.boot', section);
    const body = $('.intro__body', section);

    (async () => {
      for (const line of c.bootLines) {
        boot.appendChild(el(`<li>${fill(line)}</li>`));
        await wait(650);
      }
      await wait(250);
      body.hidden = false;
      body.classList.add('reveal');
      $('.title', section).focus({ preventScroll: true });
    })();

    $('.btn', section).addEventListener('click', () => {
      Sound.unlock();
      Sound.play('unlock');
      App.complete('intro');
      App.go('quiz');
    });
  },

  /* ---- Ripresa dopo chiusura del browser ---- */
  resume(section, target) {
    const c = CONFIG.resume;
    section.innerHTML = `
      <div class="resume">
        <p class="eyebrow">Sessione recuperata · ${App.state.progress}%</p>
        <h1 class="title title--sm" tabindex="-1">${fill(c.title)}</h1>
        <p class="lead">${fill(c.text)}</p>
        <button class="btn btn--primary btn--wide" type="button" data-go>${fill(c.cta)}</button>
        <button class="link-btn" type="button" data-restart>${fill(c.restart)}</button>
      </div>`;
    $('[data-go]', section).addEventListener('click', () => {
      Sound.unlock();
      Sound.play('ok');
      if (target === 'final') Sound.startMusic();
      App.go(target);
    });
    $('[data-restart]', section).addEventListener('click', () => App.restart());
  },

  /* ---- 7. 99% ---- */
  almost(section) {
    const c = CONFIG.almost;
    section.innerHTML = `
      <div class="almost">
        <p class="eyebrow">Analisi quasi completata</p>
        <h1 class="title title--sm" tabindex="-1">${fill(c.title)}</h1>
        <ul class="clue-list">
          ${c.clues.map((clue, i) => `
            <li style="--i:${i}"><span class="check" aria-hidden="true">✓</span><span>${fill(clue)}</span></li>`).join('')}
        </ul>
        <p class="lead almost__text">${fill(c.text)}</p>
        <div class="almost__action">
          <button class="btn btn--primary btn--big" type="button">${fill(c.cta)}</button>
          <p class="last-piece" aria-live="polite"></p>
        </div>
      </div>`;

    App.setProgress(CONFIG.progress.almost);

    const btn = $('.btn', section);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      Sound.unlock();
      Sound.startMusic(); // dentro al tocco, altrimenti iOS la blocca
      Sound.play('soft');
      section.classList.add('is-final-step');
      $('.last-piece', section).innerHTML = fill(c.lastPiece);
      await wait(700);
      App.complete('almost');
      App.setProgress(CONFIG.progress.final);
      await wait(2600);
      App.go('final');
    }, { once: true });
  },

  /* ---- 8. Rivelazione finale ---- */
  final(section) {
    const c = CONFIG.final;
    App.setProgress(CONFIG.progress.final);
    const logo = c.logo ? `<img class="final__logo" src="${c.logo}" alt="" loading="lazy">` : '';
    section.innerHTML = `
      <div class="final">
        <figure class="hero" style="--i:0">
          <img src="${c.heroImage}" ${c.heroSrcset ? `srcset="${c.heroSrcset}" sizes="(min-width: 600px) 560px, 100vw"` : ''} alt="${fill(c.heroAlt)}" decoding="async">
          <div class="hero__fallback" aria-hidden="true"><span>foto in arrivo</span></div>
          <button class="secret-heart" type="button" aria-label="Un cuore nascosto">♥</button>
        </figure>

        <div class="final__card">
          <h1 class="final__title" tabindex="-1" style="--i:1">${fill(c.title)}</h1>
          <p class="final__subtitle" style="--i:2">${fill(c.subtitle)}</p>
          <p class="final__reveal" style="--i:3">${fill(c.reveal)}</p>

          <div class="final__place" style="--i:4">
            ${logo}
            <p class="final__name">${fill(c.place.name)}</p>
            <p class="final__meta">${fill(c.place.location)} · ${fill(c.place.date)}</p>
          </div>

          <ul class="final__includes">
            ${c.includes.map((it, i) => `<li style="--i:${5 + i}"><span class="final__icon" aria-hidden="true">${it.icon}</span>${fill(it.text)}</li>`).join('')}
          </ul>

          <p class="final__extra" style="--i:${5 + c.includes.length}">${fill(c.extra)}</p>
          <p class="final__dedication" style="--i:${6 + c.includes.length}">${fill(c.dedication)}</p>
        </div>

        <div class="final__outro" hidden>
          <p class="final__label">${fill(c.outro.label)}</p>
          ${c.outro.lines.map((l) => `<p class="final__line">${fill(l)}</p>`).join('')}
          <button class="btn btn--envelope btn--wide" type="button">${fill(c.outro.cta)}</button>
          <p class="final__after" aria-live="polite"></p>
        </div>

        <button class="link-btn final__restart" type="button">rivivi la missione</button>
      </div>`;

    // foto mancante: mostra un riquadro elegante al suo posto
    const hero = $('.hero', section);
    const img = $('img', hero);
    const markMissing = () => hero.classList.add('is-missing');
    img.addEventListener('error', markMissing);
    if (img.complete && img.naturalWidth === 0) markMissing();

    $('.secret-heart', section).addEventListener('click', openSecret);

    // messaggio finale dopo qualche secondo
    const outro = $('.final__outro', section);
    setTimeout(() => {
      outro.hidden = false;
      outro.classList.add('reveal');
      outro.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
    }, reducedMotion.matches ? 300 : c.outroDelayMs);

    $('.btn--envelope', section).addEventListener('click', () => {
      Sound.play('heart');
      vibrate([30, 60, 30]);
      $('.final__after', section).textContent = fill(c.outro.afterCta);
      heartBurst($('.btn--envelope', section));
    });

    $('.final__restart', section).addEventListener('click', () => App.restart());
  },
};

// Easter egg: modal con dedica e galleria
function openSecret() {
  const s = CONFIG.secret;
  Sound.play('heart');
  Modal.open(`
    <h2 class="modal__title" id="modal-title">${fill(s.title)}</h2>
    <p class="modal__text">${fill(s.text)}</p>
    ${s.photos.length ? `<div class="gallery">${s.photos.map((p) => `
      <figure class="gallery__item">
        <img src="${p.src}" alt="${fill(p.alt)}" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('is-missing')">
      </figure>`).join('')}</div>` : ''}`);
}

// piccola esplosione di cuori (solo decorativa)
function heartBurst(origin) {
  if (reducedMotion.matches) return;
  const r = origin.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const h = el('<span class="burst-heart" aria-hidden="true">♥</span>');
    h.style.left = `${r.left + r.width / 2}px`;
    h.style.top = `${r.top + r.height / 2}px`;
    h.style.setProperty('--dx', `${(Math.random() - 0.5) * 260}px`);
    h.style.setProperty('--dy', `${-80 - Math.random() * 220}px`);
    h.style.setProperty('--r', `${(Math.random() - 0.5) * 80}deg`);
    h.style.animationDelay = `${Math.random() * 120}ms`;
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 1600);
  }
}


/* ---------------------------------------------------------------------
   App: stato, navigazione, progresso
   --------------------------------------------------------------------- */
const App = {
  state: freshState(),
  shownProgress: 0,
  navigating: false,

  init() {
    Modal.init();
    this.initAudioToggle();

    // ?reset nell'indirizzo = riparte da zero
    const params = new URLSearchParams(location.search);
    if (params.has('reset')) {
      Store.clear();
      history.replaceState(null, '', location.pathname);
    }

    const saved = Store.load();
    if (saved && SCREENS.includes(saved.screen)) {
      this.state = Object.assign(freshState(), saved);
    }
    this.setProgress(this.state.progress, false);

    if (this.state.screen !== 'intro') {
      this.go('resume', { target: this.state.screen });
    } else {
      this.go('intro');
    }
  },

  initAudioToggle() {
    let on = true;
    try { on = localStorage.getItem(AUDIO_KEY) !== '0'; } catch { /* ignore */ }
    const btn = $('#audio-toggle');
    if (!CONFIG.audio.effects && !CONFIG.audio.finalMusic) { btn.hidden = true; return; }
    const render = () => {
      btn.setAttribute('aria-pressed', String(Sound.enabled));
      btn.setAttribute('aria-label', Sound.enabled ? 'Audio attivo. Tocca per disattivare' : 'Audio disattivato. Tocca per attivare');
      btn.classList.toggle('is-muted', !Sound.enabled);
    };
    Sound.enabled = on;
    render();
    btn.addEventListener('click', () => {
      Sound.unlock();
      Sound.setEnabled(!Sound.enabled);
      render();
      Sound.play('tap');
    });
  },

  save() {
    Store.save(this.state);
  },

  // segna un livello come completato e prepara il successivo
  complete(id) {
    if (!this.state.completed.includes(id)) this.state.completed.push(id);
    const next = SCREENS[SCREENS.indexOf(id) + 1];
    if (next) this.state.screen = next;
    this.setProgress(CONFIG.progress[id]);
    this.save();
  },

  setProgress(value, animate = true) {
    value = Math.max(0, Math.min(100, Math.round(value)));
    this.state.progress = value;
    const label = $('#progress-value');
    const bar = $('#progress-fill');
    $('.progress').setAttribute('aria-valuenow', value);
    bar.style.transform = `scaleX(${value / 100})`;
    $('#topbar').classList.toggle('is-complete', value === 100);

    const from = this.shownProgress;
    this.shownProgress = value;
    if (!animate || reducedMotion.matches || from === value) {
      label.textContent = value;
      return;
    }
    const start = performance.now();
    const dur = 900;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      label.textContent = Math.round(from + (value - from) * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  // contesto passato ai minigiochi
  gameContext(id) {
    if (!this.state.games[id]) this.state.games[id] = {};
    return {
      config: CONFIG[id],
      state: this.state.games[id],
      save: () => this.save(),
      // avanzamento parziale dentro al livello (fraction 0..1)
      partial: (fraction) => {
        const from = CONFIG.progress[SCREENS[SCREENS.indexOf(id) - 1]] || 0;
        const to = CONFIG.progress[id];
        this.setProgress(from + (to - from) * Math.min(1, fraction) * 0.9);
      },
      // il gioco è finito: mostra l'indizio e passa al livello successivo
      done: async () => {
        this.complete(id);
        Sound.play('unlock');
        vibrate(40);
        await showUnlock(CONFIG[id].complete);
        this.go(SCREENS[SCREENS.indexOf(id) + 1]);
      },
    };
  },

  async go(id, opts = {}) {
    if (this.navigating) return;
    this.navigating = true;

    const stage = $('#stage');
    const old = $('.screen', stage);
    if (old) {
      old.classList.add('is-leaving');
      await wait(280);
      if (old._cleanup) old._cleanup();
      old.remove();
    }

    if (id !== 'resume') {
      this.state.screen = id;
      this.save();
    }

    const theme = id === 'resume' ? THEMES[opts.target] : THEMES[id];
    document.body.dataset.theme = theme;
    $('meta[name="theme-color"]').setAttribute('content', THEME_COLORS[theme]);
    document.body.dataset.screen = id;

    const section = document.createElement('section');
    section.className = `screen screen--${id}`;
    stage.appendChild(section);
    window.scrollTo(0, 0);

    if (Screens[id]) Screens[id](section, opts.target);
    else Games[id].mount(section, this.gameContext(id));

    requestAnimationFrame(() => section.classList.add('is-in'));

    // focus sul titolo per chi usa lettori di schermo / tastiera
    const heading = $('[tabindex="-1"]', section);
    if (heading && id !== 'intro') heading.focus({ preventScroll: true });

    this.navigating = false;
  },

  restart() {
    Store.clear();
    if (Sound.music) Sound.music.pause();
    this.state = freshState();
    this.setProgress(0, false);
    this.go('intro');
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());

/* =====================================================================
   MINIGIOCHI
   Ogni gioco espone mount(section, ctx):
     ctx.config   → la sezione corrispondente di CONFIG
     ctx.state    → oggetto salvato in localStorage (stato del gioco)
     ctx.save()   → salva lo stato
     ctx.partial(f) → avanza la barra di progresso dentro al livello (0..1)
     ctx.done()   → livello completato: mostra l'indizio e prosegue
   Le utility ($, el, fill, wait, Sound, Toast, Modal…) sono in app.js.
   ===================================================================== */
'use strict';

// intestazione comune dei livelli
function gameHead(c, extraClass = '') {
  return `
    <header class="game__head ${extraClass}">
      <h1 class="title title--sm" tabindex="-1">${fill(c.title)}</h1>
      ${c.intro ? `<p class="lead">${fill(c.intro)}</p>` : ''}
    </header>`;
}

// animazione "vola da A a B" usata da cruciverba e valigia
function flyTo(content, fromEl, toEl, className = 'fly') {
  const from = fromEl.getBoundingClientRect();
  const to = toEl.getBoundingClientRect();
  const node = el(`<span class="${className}" aria-hidden="true">${content}</span>`);
  Object.assign(node.style, {
    left: `${from.left}px`, top: `${from.top}px`,
    width: `${from.width}px`, height: `${from.height}px`,
  });
  document.body.appendChild(node);
  if (reducedMotion.matches || !node.animate) {
    node.remove();
    return Promise.resolve();
  }
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const anim = node.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(1.35)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 1 },
  ], { duration: 850, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' });
  return anim.finished.then(() => node.remove());
}

const Games = {};


/* =====================================================================
   SCHERMATA 2 — QUIZ DI COPPIA
   ===================================================================== */
Games.quiz = {
  mount(section, ctx) {
    const c = ctx.config;
    const total = c.questions.length;
    if (!ctx.state.index) ctx.state.index = 0;

    section.innerHTML = `
      <div class="game quiz">
        ${gameHead(c)}
        <div class="quiz__card"></div>
      </div>`;
    const card = $('.quiz__card', section);

    const render = () => {
      const i = ctx.state.index;
      const q = c.questions[i];
      card.innerHTML = `
        <div class="quiz__meta">
          <span>Domanda ${i + 1} di ${total}</span>
          <span class="quiz__dots" aria-hidden="true">${c.questions.map((_, k) => `<i class="${k < i ? 'is-done' : k === i ? 'is-current' : ''}"></i>`).join('')}</span>
        </div>
        <p class="quiz__question" id="quiz-q">${fill(q.q)}</p>
        <div class="quiz__answers" role="group" aria-labelledby="quiz-q">
          ${q.answers.map((a, k) => `<button class="answer" type="button" data-k="${k}"><span class="answer__key" aria-hidden="true">${'ABCD'[k]}</span><span>${fill(a)}</span></button>`).join('')}
        </div>
        <div class="quiz__feedback" aria-live="polite"></div>`;
      card.classList.remove('slide-in');
      void card.offsetWidth; // riavvia l'animazione
      card.classList.add('slide-in');
    };

    const next = () => {
      ctx.state.index++;
      ctx.save();
      ctx.partial(ctx.state.index / total);
      if (ctx.state.index >= total) ctx.done();
      else render();
    };

    card.addEventListener('click', (e) => {
      const btn = e.target.closest('.answer');
      const action = e.target.closest('[data-action]');
      const q = c.questions[ctx.state.index];
      const feedback = $('.quiz__feedback', card);

      if (btn && !btn.disabled) {
        const k = Number(btn.dataset.k);
        const answers = $$('.answer', card);
        answers.forEach((b) => { b.disabled = true; });

        if (k === q.correct) {
          btn.classList.add('is-correct');
          btn.insertAdjacentHTML('beforeend', '<span class="answer__mark">✓ giusta</span>');
          Sound.play('ok');
          const last = ctx.state.index === total - 1;
          feedback.innerHTML = `
            <p class="feedback feedback--ok">${fill(q.right)}</p>
            <button class="btn btn--primary" type="button" data-action="next">${last ? 'COMPLETA IL TEST' : 'AVANTI'}</button>`;
        } else {
          btn.classList.add('is-wrong', 'shake');
          btn.insertAdjacentHTML('beforeend', '<span class="answer__mark">✗ no</span>');
          Sound.play('error');
          vibrate(60);
          feedback.innerHTML = `
            <p class="feedback feedback--ko">${fill(q.wrong)}</p>
            <div class="btn-row">
              <button class="btn btn--primary" type="button" data-action="retry">RIPROVA</button>
              ${c.allowSkipAfterWrong ? '<button class="btn btn--ghost" type="button" data-action="next">Prosegui comunque</button>' : ''}
            </div>`;
        }
        $('button', feedback).focus({ preventScroll: true });
        feedback.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
      }

      if (action) {
        Sound.play('tap');
        if (action.dataset.action === 'next') next();
        if (action.dataset.action === 'retry') {
          // le risposte già sbagliate restano barrate
          $$('.answer', card).forEach((b) => {
            b.classList.remove('shake');
            if (!b.classList.contains('is-wrong')) b.disabled = false;
          });
          feedback.innerHTML = '';
          $('.answer:not(:disabled)', card)?.focus({ preventScroll: true });
        }
      }
    });

    render();
  },
};


/* =====================================================================
   SCHERMATA 3 — CRUCIVERBA
   ===================================================================== */
Games.crossword = {
  mount(section, ctx) {
    const c = ctx.config;
    const normalize = (s) => s.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();

    /* ---- Costruzione dello schema dalla configurazione ---- */
    const words = c.words.map((w, i) => ({
      ...w, id: i, answer: normalize(w.answer), cells: [],
    }));
    let rows = 0, cols = 0;
    words.forEach((w) => {
      const len = w.answer.length;
      rows = Math.max(rows, w.row + (w.dir === 'down' ? len : 1));
      cols = Math.max(cols, w.col + (w.dir === 'across' ? len : 1));
    });
    const grid = Array.from({ length: rows }, () => Array(cols).fill(null));

    words.forEach((w) => {
      for (let k = 0; k < w.answer.length; k++) {
        const r = w.row + (w.dir === 'down' ? k : 0);
        const col = w.col + (w.dir === 'across' ? k : 0);
        let cell = grid[r][col];
        if (!cell) cell = grid[r][col] = { r, c: col, answer: w.answer[k], value: '', across: null, down: null };
        else if (cell.answer !== w.answer[k]) {
          console.warn(`[cruciverba] conflitto in riga ${r}, colonna ${col}: "${cell.answer}" vs "${w.answer[k]}" (${w.answer})`);
        }
        cell[w.dir] = w;
        w.cells.push(cell);
      }
    });

    // numerazione automatica (da sinistra a destra, dall'alto in basso)
    let num = 0;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const starts = words.filter((w) => w.row === r && w.col === col);
        if (starts.length) {
          num++;
          grid[r][col].num = num;
          starts.forEach((w) => { w.num = num; });
        }
      }
    }
    // ordine di navigazione: prima le orizzontali, poi le verticali
    const ordered = [
      ...words.filter((w) => w.dir === 'across').sort((a, b) => a.num - b.num),
      ...words.filter((w) => w.dir === 'down').sort((a, b) => a.num - b.num),
    ];

    // caselle misteriose
    const secret = normalize(c.secret);
    const mystery = c.mystery.map((m, i) => {
      const cell = grid[m.row]?.[m.col];
      if (!cell) console.warn(`[cruciverba] casella misteriosa ${i + 1} fuori dallo schema`);
      else if (cell.answer !== secret[i]) console.warn(`[cruciverba] la casella misteriosa ${i + 1} contiene "${cell.answer}", attesa "${secret[i]}"`);
      if (cell) cell.mystery = true;
      return cell;
    }).filter(Boolean);

    // ripristino lettere salvate
    const allCells = grid.flat().filter(Boolean);
    if (ctx.state.letters) {
      allCells.forEach((cell) => { cell.value = ctx.state.letters[`${cell.r},${cell.c}`] || ''; });
    }

    /* ---- DOM ---- */
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

    // definizione e pulsanti: su telefono stanno nel pannello della tastiera, sempre visibili
    const clue = `
      <div class="cw__clue">
        <button class="cw__nav" type="button" data-nav="-1" aria-label="Definizione precedente">‹</button>
        <p class="cw__clue-text" aria-live="polite"></p>
        <button class="cw__nav" type="button" data-nav="1" aria-label="Definizione successiva">›</button>
      </div>`;
    const tools = `
      <div class="cw__actions">
        <button class="chip" type="button" data-act="check">Controlla</button>
        ${c.allowHints ? '<button class="chip" type="button" data-act="hint">Aiutino</button>' : ''}
        <button class="chip" type="button" data-act="list">Definizioni</button>
      </div>`;

    section.innerHTML = `
      <div class="game crossword">
        ${gameHead(c, 'game__head--compact')}
        <div class="cw">
          <div class="cw__grid" role="group" aria-label="Schema del cruciverba: usa le frecce e digita le lettere" tabindex="0"
               style="--cols:${cols}; --rows:${rows}">
            ${grid.map((row, r) => row.map((cell, col) => cell
              ? `<div class="cw__cell${cell.mystery ? ' is-mystery' : ''}" data-r="${r}" data-c="${col}">
                   ${cell.num ? `<span class="cw__num">${cell.num}</span>` : ''}
                   <span class="cw__letter"></span>
                 </div>`
              : '<div class="cw__block" aria-hidden="true"></div>').join('')).join('')}
          </div>

          ${touch ? '' : `${clue}<p class="cw__status" aria-live="polite"></p>${tools}`}

          <div class="cw__secret">
            <p class="eyebrow">Caselle misteriose</p>
            <div class="cw__slots">${mystery.map(() => '<span class="cw__slot">?</span>').join('')}</div>
          </div>

          ${touch ? `
          <div class="kb" aria-label="Tastiera">
            ${clue}
            ${tools}
            ${KEYS.map((row, i) => `<div class="kb__row">
              ${row.split('').map((k) => `<button class="kb__key" type="button" data-key="${k}">${k}</button>`).join('')}
              ${i === 2 ? '<button class="kb__key kb__key--wide" type="button" data-key="BACK" aria-label="Cancella">⌫</button>' : ''}
            </div>`).join('')}
          </div>` : ''}
        </div>
      </div>`;

    const gridEl = $('.cw__grid', section);
    const clueText = $('.cw__clue-text', section);
    const statusEl = $('.cw__status', section);
    // messaggi: sotto la griglia su desktop, in alto (toast) su telefono
    const status = {
      set textContent(msg) {
        if (statusEl) statusEl.textContent = msg;
        else if (msg) Toast.show(msg, '', true);
      },
    };
    const kb = $('.kb', section);
    allCells.forEach((cell) => { cell.el = $(`.cw__cell[data-r="${cell.r}"][data-c="${cell.c}"]`, gridEl); });

    /* ---- Dimensione caselle: la griglia + definizione + tastiera devono stare nello schermo ---- */
    const fit = () => {
      const gap = 2;
      const width = gridEl.parentElement.clientWidth;
      let size = Math.floor((width - (cols - 1) * gap) / cols);
      if (kb) {
        const reserved = kb.offsetHeight + 24;
        size = Math.min(size, Math.floor((window.innerHeight - reserved - (rows - 1) * gap) / rows));
      }
      size = Math.max(26, Math.min(46, size));
      gridEl.style.setProperty('--cell', `${size}px`);
    };

    /* ---- Stato selezione ---- */
    let active = null;      // casella attiva
    let dir = 'across';     // direzione attiva
    let solved = false;
    let interacted = false; // prima interazione: da lì in poi teniamo la griglia in vista

    // su telefono: scorre la pagina perché casella attiva e definizione non finiscano sotto la tastiera
    const ensureVisible = () => {
      if (!kb || !interacted || solved) return;
      const kbTop = kb.getBoundingClientRect().top;
      const g = gridEl.getBoundingClientRect();
      let delta = 0;
      const need = g.bottom + 8 - kbTop;
      if (need > 0) delta = Math.max(0, Math.min(need, g.top - 8));
      if (active) {
        const a = active.el.getBoundingClientRect();
        if (a.bottom + 4 - delta > kbTop) delta = a.bottom + 4 - kbTop;
        if (a.top - delta < 8) delta = a.top - 8;
      }
      if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    };

    const currentWord = () => active && (active[dir] || active[dir === 'across' ? 'down' : 'across']);

    const render = () => {
      const word = currentWord();
      allCells.forEach((cell) => {
        cell.el.querySelector('.cw__letter').textContent = cell.value;
        cell.el.classList.toggle('is-word', !!word && word.cells.includes(cell));
        cell.el.classList.toggle('is-active', cell === active);
      });
      if (word) {
        const arrow = word.dir === 'across' ? '→' : '↓';
        clueText.innerHTML = `<span class="cw__clue-num">${word.num} ${arrow}</span>${fill(word.clue)} <span class="cw__len">(${word.answer.length})</span>`;
      }
      ensureVisible();
    };

    const select = (cell, toggle = false) => {
      if (!cell) return;
      if (toggle && cell === active && cell.across && cell.down) {
        dir = dir === 'across' ? 'down' : 'across';
      } else if (!cell[dir]) {
        dir = cell.across ? 'across' : 'down';
      }
      active = cell;
      render();
    };

    const selectWord = (word, preferEmpty = true) => {
      dir = word.dir;
      const target = (preferEmpty && word.cells.find((x) => !x.value)) || word.cells[0];
      active = target;
      render();
    };

    const moveWord = (step) => {
      const word = currentWord();
      const i = ordered.indexOf(word);
      selectWord(ordered[(i + step + ordered.length) % ordered.length]);
    };

    const persist = () => {
      const letters = {};
      allCells.forEach((cell) => { if (cell.value) letters[`${cell.r},${cell.c}`] = cell.value; });
      ctx.state.letters = letters;
      ctx.save();
    };

    const type = (letter) => {
      if (solved || !active) return;
      active.value = letter;
      active.el.classList.remove('is-wrong');
      Sound.play('type');
      const word = currentWord();
      const i = word.cells.indexOf(active);
      if (i < word.cells.length - 1) {
        active = word.cells[i + 1];
      } else {
        // fine parola: passa alla prossima parola ancora incompleta
        const start = ordered.indexOf(word);
        for (let k = 1; k <= ordered.length; k++) {
          const w = ordered[(start + k) % ordered.length];
          if (w.cells.some((x) => !x.value)) { selectWord(w); break; }
        }
      }
      render();
      persist();
      checkComplete();
    };

    const backspace = () => {
      if (solved || !active) return;
      if (!active.value) {
        const word = currentWord();
        const i = word.cells.indexOf(active);
        if (i > 0) active = word.cells[i - 1];
      }
      active.value = '';
      active.el.classList.remove('is-wrong');
      render();
      persist();
    };

    const moveArrow = (dr, dc) => {
      if (!active) return select(allCells[0]);
      let r = active.r + dr, col = active.c + dc;
      while (r >= 0 && r < rows && col >= 0 && col < cols) {
        if (grid[r][col]) {
          dir = dc !== 0 ? 'across' : 'down';
          return select(grid[r][col]);
        }
        r += dr; col += dc;
      }
    };

    const checkComplete = () => {
      if (allCells.some((x) => !x.value)) { status.textContent = ''; return; }
      if (allCells.every((x) => x.value === x.answer)) win();
      else status.textContent = 'Schema pieno, ma qualcosa non torna. Prova “Controlla”.';
    };

    /* ---- Vittoria: le lettere misteriose volano negli slot ---- */
    const win = async () => {
      solved = true;
      active = null;
      render();
      section.classList.add('is-solved');
      status.textContent = 'Schema completato. Estrazione delle caselle misteriose…';
      Sound.play('ok');
      allCells.forEach((cell) => cell.el.style.setProperty('--d', `${(cell.r + cell.c) * 35}ms`));
      ctx.partial(1);
      await wait(1100);

      const slotsBox = $('.cw__secret', section);
      slotsBox.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
      await wait(600);

      const slots = $$('.cw__slot', section);
      for (let i = 0; i < mystery.length; i++) {
        mystery[i].el.classList.add('is-extracting');
        await flyTo(mystery[i].answer, mystery[i].el, slots[i], 'fly fly--letter');
        slots[i].textContent = mystery[i].answer;
        slots[i].classList.add('is-filled');
        Sound.play('tick');
        await wait(250);
      }
      slotsBox.classList.add('is-complete');
      await wait(900);
      ctx.done();
    };

    /* ---- Eventi ---- */
    gridEl.addEventListener('click', (e) => {
      const cellEl = e.target.closest('.cw__cell');
      if (!cellEl || solved) return;
      Sound.unlock();
      interacted = true;
      select(grid[cellEl.dataset.r][cellEl.dataset.c], true);
    });

    section.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      const act = e.target.closest('[data-act]');
      const key = e.target.closest('[data-key]');
      if (solved) return;
      if (nav || key) interacted = true;

      if (nav) { if (!active) selectWord(ordered[0]); else moveWord(Number(nav.dataset.nav)); }

      if (key) {
        if (!active) selectWord(ordered[0]);
        if (key.dataset.key === 'BACK') backspace();
        else type(key.dataset.key);
      }

      if (act?.dataset.act === 'check') {
        const wrong = allCells.filter((x) => x.value && x.value !== x.answer);
        wrong.forEach((x) => x.el.classList.add('is-wrong'));
        const empty = allCells.filter((x) => !x.value).length;
        Sound.play(wrong.length ? 'error' : 'ok');
        status.textContent = wrong.length
          ? `${wrong.length === 1 ? '1 lettera da rivedere' : `${wrong.length} lettere da rivedere`} (segnate con il puntino).`
          : empty ? `Finora tutto giusto. Mancano ${empty} lettere.` : '';
      }

      if (act?.dataset.act === 'hint') {
        if (!active) selectWord(ordered[0]);
        active.el.classList.add('is-revealed');
        const lines = ['Aiutino concesso. Lo terrò a mente.', 'Anche questo verrà annotato nel dossier.', 'Nessun giudizio. Quasi.'];
        type(active.answer);
        if (!solved) status.textContent = lines[Math.floor(Math.random() * lines.length)];
      }

      if (act?.dataset.act === 'list') openList();
    });

    // tastiera fisica (desktop, tablet con tastiera)
    const onKey = (e) => {
      if (solved || !document.body.contains(gridEl) || !$('#modal').hidden) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
      const k = e.key;
      if (/^[a-zà-ü]$/i.test(k)) { if (!active) selectWord(ordered[0]); type(normalize(k)); }
      else if (k === 'Backspace' || k === 'Delete') backspace();
      else if (k === 'ArrowRight') moveArrow(0, 1);
      else if (k === 'ArrowLeft') moveArrow(0, -1);
      else if (k === 'ArrowDown') moveArrow(1, 0);
      else if (k === 'ArrowUp') moveArrow(-1, 0);
      else if (k === 'Tab' && document.activeElement === gridEl) moveWord(e.shiftKey ? -1 : 1);
      else if (k === 'Enter' || k === ' ') { if (active) select(active, true); else selectWord(ordered[0]); }
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);

    // elenco completo delle definizioni (in un modal)
    const openList = () => {
      const group = (d, label) => `
        <h3 class="cw-list__head">${label}</h3>
        <ol class="cw-list">
          ${ordered.filter((w) => w.dir === d).map((w) => `
            <li><button type="button" data-word="${w.id}" class="${w.cells.every((x) => x.value) ? 'is-filled' : ''}">
              <b>${w.num}</b><span>${fill(w.clue)} <span class="cw__len">(${w.answer.length})</span></span>
            </button></li>`).join('')}
        </ol>`;
      Modal.open(`
        <h2 class="modal__title" id="modal-title">Definizioni</h2>
        ${group('across', 'Orizzontali →')}
        ${group('down', 'Verticali ↓')}`);
      $('#modal-content').onclick = (e) => {
        const b = e.target.closest('[data-word]');
        if (!b) return;
        selectWord(words[Number(b.dataset.word)]);
        Modal.close();
        gridEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
    };

    window.addEventListener('resize', fit);
    section._cleanup = () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', fit);
      $('#modal-content').onclick = null;
    };

    fit();
    selectWord(ordered[0]);
    if (allCells.every((x) => x.value === x.answer)) win(); // già risolto in una sessione precedente
  },
};


/* =====================================================================
   SCHERMATA 4 — PREPARA LA VALIGIA
   ===================================================================== */
Games.suitcase = {
  mount(section, ctx) {
    const c = ctx.config;
    const needed = c.items.filter((it) => it.ok).length;
    ctx.state.packed = ctx.state.packed || [];
    ctx.state.rejected = ctx.state.rejected || [];

    section.innerHTML = `
      <div class="game suitcase">
        ${gameHead(c)}
        <div class="case" aria-live="polite">
          <div class="case__handle" aria-hidden="true"></div>
          <div class="case__body">
            <div class="case__content" aria-hidden="true"></div>
            <p class="case__count"><span>0</span>/${needed} oggetti giusti</p>
          </div>
        </div>
        <ul class="items">
          ${c.items.map((it, i) => `
            <li><button class="item" type="button" data-i="${i}">
              <span class="item__icon" aria-hidden="true">${it.icon}</span>
              <span class="item__label">${fill(it.label)}</span>
              <span class="item__state"></span>
            </button></li>`).join('')}
        </ul>
      </div>`;

    const content = $('.case__content', section);
    const count = $('.case__count span', section);

    const paint = () => {
      content.innerHTML = ctx.state.packed.map((i) => `<span>${c.items[i].icon}</span>`).join('');
      count.textContent = ctx.state.packed.length;
      $$('.item', section).forEach((b) => {
        const i = Number(b.dataset.i);
        const packed = ctx.state.packed.includes(i);
        const rejected = ctx.state.rejected.includes(i);
        b.classList.toggle('is-packed', packed);
        b.classList.toggle('is-rejected', rejected);
        b.disabled = packed;
        $('.item__state', b).textContent = packed ? '✓ in valigia' : rejected ? '✗ scartato' : '';
      });
    };

    section.addEventListener('click', async (e) => {
      const b = e.target.closest('.item');
      if (!b || b.disabled || section.classList.contains('is-done')) return;
      const i = Number(b.dataset.i);
      const item = c.items[i];

      if (item.ok) {
        b.disabled = true;
        Sound.play('ok');
        Toast.show(fill(item.msg), 'ok');
        await flyTo(item.icon, $('.item__icon', b), content, 'fly fly--emoji');
        ctx.state.packed.push(i);
        ctx.save();
        ctx.partial(ctx.state.packed.length / needed);
        paint();
        if (ctx.state.packed.length === needed) {
          section.classList.add('is-done');
          await wait(500);
          $('.case', section).classList.add('is-closed');
          Sound.play('unlock');
          await wait(1200);
          ctx.done();
        }
      } else {
        if (!ctx.state.rejected.includes(i)) ctx.state.rejected.push(i);
        ctx.save();
        Sound.play('error');
        vibrate(50);
        Toast.show(fill(item.msg), 'ko');
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        paint();
      }
    });

    paint();
  },
};


/* =====================================================================
   SCHERMATA 5 — TEST ANTI-STRESS (tieni premuto, volutamente pilotato)
   ===================================================================== */
Games.stress = {
  mount(section, ctx) {
    const c = ctx.config;
    ctx.state.attempts = ctx.state.attempts || 0;
    const R = 88;
    const CIRC = 2 * Math.PI * R;

    section.innerHTML = `
      <div class="game stress">
        ${gameHead(c)}
        <div class="stress__zone">
          <div class="stress__glow" aria-hidden="true"></div>
          <button class="hold" type="button" aria-describedby="stress-msg">
            <svg class="hold__ring" viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="${R}" class="hold__track"/>
              <circle cx="100" cy="100" r="${R}" class="hold__bar" style="stroke-dasharray:${CIRC};stroke-dashoffset:${CIRC}"/>
            </svg>
            <span class="hold__text">
              <span class="hold__label">${fill(c.holdLabel)}</span>
              <span class="hold__value" hidden>${fill(c.progressLabel)} <b><span>0</span>%</b></span>
            </span>
          </button>
        </div>
        <p class="stress__msg" id="stress-msg" aria-live="polite"></p>
        <div class="stress__result" aria-live="polite"></div>
      </div>`;

    const btn = $('.hold', section);
    const bar = $('.hold__bar', section);
    const label = $('.hold__label', section);
    const valueBox = $('.hold__value', section);
    const valueNum = $('b span', valueBox);
    const msg = $('.stress__msg', section);

    let value = 0;
    let holding = false;
    let locked = false;     // dopo un errore: bisogna staccare il dito
    let mustReset = false;  // dopo un errore il tentativo successivo riparte da 0
    let finished = false;
    let raf = null;
    let last = 0;
    let lastTick = 0;

    const draw = () => {
      bar.style.strokeDashoffset = CIRC * (1 - value / 100);
      valueNum.textContent = Math.floor(value);
      const showValue = value > 0.5;
      valueBox.hidden = !showValue;
      label.hidden = showValue;
    };

    const loop = (now) => {
      const dt = now - last;
      last = now;
      if (holding) {
        value = Math.min(100, value + (dt / c.durationMs) * 100);
        if (Math.floor(value / 5) !== lastTick) { lastTick = Math.floor(value / 5); Sound.play('tick'); }
        const failAt = c.failAt[ctx.state.attempts];
        if (failAt !== undefined && value >= failAt) { value = failAt; draw(); return fail(); }
        if (value >= 100) { draw(); return success(); }
      } else {
        // rilasciato in anticipo: la barra si svuota
        value = Math.max(0, value - (dt / 600) * 100);
        if (value === 0) { draw(); raf = null; return; }
      }
      draw();
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (finished || locked || holding) return;
      if (mustReset) { value = 0; mustReset = false; lastTick = 0; }
      Sound.unlock();
      holding = true;
      section.classList.add('is-holding');
      section.classList.remove('is-error');
      msg.textContent = '';
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    };

    const release = () => {
      if (locked) { locked = false; section.classList.remove('is-error'); }
      if (!holding) return;
      holding = false;
      section.classList.remove('is-holding');
      if (!finished && value > 8) msg.textContent = fill(c.releasedEarly);
      if (!raf && !finished) { last = performance.now(); raf = requestAnimationFrame(loop); }
    };

    const fail = () => {
      raf = null;
      holding = false;
      locked = true;
      mustReset = true;
      const hint = c.failHints[ctx.state.attempts] || '';
      ctx.state.attempts++;
      ctx.save();
      section.classList.remove('is-holding');
      section.classList.add('is-error');
      Sound.play('error');
      vibrate([80, 50, 80]);
      msg.innerHTML = `<strong>${fill(c.failMessage)}</strong><br>${fill(hint)}`;
      // svuota la barra dopo un attimo
      setTimeout(() => { last = performance.now(); if (!raf) raf = requestAnimationFrame(loop); }, 900);
    };

    const success = async () => {
      raf = null;
      holding = false;
      finished = true;
      section.classList.remove('is-holding');
      section.classList.add('is-success');
      btn.disabled = true;
      Sound.play('ok');
      vibrate(40);
      msg.textContent = '';
      ctx.partial(1);
      const result = $('.stress__result', section);
      for (const line of c.result) {
        result.insertAdjacentHTML('beforeend', `<p class="reveal">${fill(line)}</p>`);
        await wait(900);
      }
      ctx.done();
    };

    // pointer events: funzionano con dito, mouse e penna
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      start();
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    // tastiera: tieni premuto Spazio o Invio
    btn.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); }
    });
    btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') release(); });
    btn.addEventListener('blur', release);
    // niente menu contestuale / selezione durante la pressione lunga
    section.addEventListener('contextmenu', (e) => e.preventDefault());

    section._cleanup = () => { if (raf) cancelAnimationFrame(raf); };
    draw();
  },
};


/* =====================================================================
   SCHERMATA 6 — CENA MISTERIOSA (slot machine pilotata)
   ===================================================================== */
Games.dinner = {
  mount(section, ctx) {
    const c = ctx.config;
    const SPINS = 16; // simboli che scorrono prima del risultato

    // ogni rullo: simboli casuali + risultato pilotato in fondo
    const strips = c.reels.map((reel) => {
      const list = [];
      for (let i = 0; i < SPINS; i++) list.push(reel.symbols[Math.floor(Math.random() * reel.symbols.length)]);
      list.push(reel.result);
      return list;
    });

    section.innerHTML = `
      <div class="game dinner">
        ${gameHead(c)}
        <div class="slot">
          <div class="slot__reels">
            ${c.reels.map((reel, i) => `
              <div class="reel">
                <div class="reel__window" aria-hidden="true">
                  <div class="reel__strip">${strips[i].map((s) => `<span>${s}</span>`).join('')}</div>
                </div>
                <span class="reel__label">${fill(reel.label)}</span>
              </div>`).join('')}
          </div>
          <button class="btn btn--primary btn--big" type="button">${fill(c.cta)}</button>
        </div>
        <div class="dinner__result" aria-live="polite"></div>
      </div>`;

    const btn = $('.slot .btn', section);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      Sound.unlock();
      section.classList.add('is-spinning');

      const durations = c.reels.map((_, i) => (reducedMotion.matches ? 200 : 1300 + i * 550));
      const ticker = setInterval(() => Sound.play('tick'), 80);

      $$('.reel__strip', section).forEach((strip, i) => {
        const h = strip.firstElementChild.offsetHeight;
        strip.style.transition = `transform ${durations[i]}ms cubic-bezier(.12,.75,.2,1)`;
        strip.style.transform = `translateY(${-(strips[i].length - 1) * h}px)`;
        setTimeout(() => { strip.closest('.reel').classList.add('is-stopped'); Sound.play('tap'); }, durations[i]);
      });

      await wait(Math.max(...durations) + 100);
      clearInterval(ticker);
      section.classList.remove('is-spinning');
      section.classList.add('is-won');
      Sound.play('ok');
      vibrate(40);
      ctx.partial(1);

      const result = $('.dinner__result', section);
      for (const line of c.result) {
        result.insertAdjacentHTML('beforeend', `<p class="reveal">${fill(line)}</p>`);
        await wait(1100);
      }
      ctx.done();
    }, { once: true });
  },
};

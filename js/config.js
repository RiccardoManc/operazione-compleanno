/* =====================================================================
   CONFIGURAZIONE — l'unico file da modificare per personalizzare il sito
   =====================================================================

   - Tutti i testi, le domande, il cruciverba, gli oggetti e i dettagli
     del regalo stanno qui. La logica (app.js / games.js) non va toccata.
   - Nei testi puoi usare semplice HTML (<em>, <strong>, <br>).
   - Le voci marcate con  // TODO  sono ancora placeholder.
   - Dopo aver modificato questo file ricarica la pagina. Se vuoi ripartire
     da zero apri il sito con  ?reset  in fondo all'indirizzo
     (es. https://tuosito/?reset).
*/

const CONFIG = {

  /* -------------------------------------------------------------------
     PERSONE
     ------------------------------------------------------------------- */
  name: 'Valentina',
  nickname: 'Vale',
  birthday: '26 ottobre',      // usato solo nei testi, formato libero

  /* -------------------------------------------------------------------
     PERCENTUALE "REGALO DECIFRATO" raggiunta al termine di ogni livello.
     Non arriva mai a 100 prima della rivelazione finale.
     ------------------------------------------------------------------- */
  progress: {
    intro: 3,
    quiz: 14,
    crossword: 41,
    suitcase: 58,
    stress: 74,
    dinner: 88,
    almost: 99,
    final: 100,
  },

  /* -------------------------------------------------------------------
     SCHERMATA 1 — INTRO
     {name} e {nickname} vengono sostituiti automaticamente.
     ------------------------------------------------------------------- */
  intro: {
    title: 'OPERAZIONE COMPLEANNO',
    // righe "di sistema" che compaiono una alla volta all'avvio
    bootLines: [
      'Avvio scansione…',
      'Pacchetto anomalo rilevato.',
      'Destinatario identificato: {name}.',
    ],
    lines: [
      'È stato rilevato un regalo destinato a <strong>{name}</strong>.',
      'Per scoprirlo dovrai superare una serie di test estremamente sofisticati.',
      'Li ho programmati io, quindi “sofisticati” è un termine relativo.',
    ],
    stamp: 'CONTENUTO CLASSIFICATO',
    cta: 'INIZIA LA MISSIONE',
  },

  /* -------------------------------------------------------------------
     SCHERMATA "BENTORNATA" (se chiude il browser e ritorna)
     ------------------------------------------------------------------- */
  resume: {
    title: 'Missione precedente rilevata.',
    text: 'Vuoi continuare a ficcanasare nel tuo regalo?',
    cta: 'OVVIAMENTE SÌ',
    restart: 'ricomincia da capo',
  },

  /* -------------------------------------------------------------------
     SCHERMATA 2 — QUIZ DI COPPIA
     correct = indice della risposta giusta (0 = la prima)
     ------------------------------------------------------------------- */
  quiz: {
    title: 'Test 1 — Verifica identità',
    intro: 'Prima di procedere devo accertarmi che tu sia davvero tu.',
    // true  = dopo un errore può riprovare OPPURE andare avanti
    // false = dopo un errore può solo riprovare
    allowSkipAfterWrong: true,
    questions: [ // TODO: sostituisci con domande vostre
      {
        q: 'Qual è stata la mia relazione più stabile durante quest’estate?',
        answers: ['Quella con te, ovviamente', 'Quella con l’aria condizionata', 'Quella con il frigorifero', 'Quella con il computer'],
        correct: 1,
        right: 'Confermo. È stata dura, ma alla fine siamo riusciti a trovare un equilibrio in questo triangolo amoroso. ❤️',
        wrong: 'Dopo tutto quello che abbiamo passato insieme, io e il condizionatore ci aspettavamo più riconoscenza.',
      },
      {
        q: 'Chi dei due dice “cinque minuti e arrivo” mentendo spudoratamente?',
        answers: ['Riccardo', 'Valentina', 'Entrambi'],
        correct: 0,
        right: 'Risposta dolorosamente corretta. 🥲',
        wrong: 'Il sistema rileva una lieve distorsione della realtà.',
      },
      {
        q: 'Quando dormiamo insieme, come viene suddiviso equamente il letto?',
        answers: ['50% a testa, come in ogni coppia civile', '60% a te, 40% a me', '90% a te, 10% a me, se sono fortunato', 'Il letto è tuo. Io sono un ospite occasionale'],
        correct: 2,
        right: 'Esatto! Il sistema conferma che il tuo concetto di spazio personale è piuttosto… espansivo. ❤️',
        wrong: 'Risposta non compatibile con i dati raccolti sul campo. Il mio lato del letto non è d’accordo.',
      },
      {
        q: 'Qual è il tuo superpotere segreto?',
        answers: ['Riuscire a trovare qualsiasi oggetto smarrito.', 'Addormentarti ovunque, in qualsiasi momento e in qualsiasi posizione.', 'Prevedere il futuro.'],
        correct: 1,
        right: 'La NASA sta ancora studiando come tu riesca a passare da sveglia a profondamente addormentata in 0,3 secondi. ❤️',
        wrong: 'Il sistema suggerisce di rifletterci meglio. Magari dopo un pisolino.',
      },
      {
        q: 'Di fronte a un problema apparentemente irrisolvibile, qual è la tua soluzione filosofica preferita?',
        answers: ['Manteniamo la calma e ragioniamo.', 'Non te sta a preoccupà.', 'Che dobbiamo fa? Ce dobbiamo sparà?', 'Scine ca scine, ma ca scine ‘n tutt’ no.'],
        correct: 2,
        right: 'Dopo anni di studi, il sistema conferma che la filosofia abruzzese è superiore a qualsiasi tecnica di problem solving. 🧠',
        wrong: 'Scine ca scine… ma questa risposta no.',
      },
      {
        q: 'Cosa stai per scoprire?',
        answers: ['Un regalo bellissimo', 'Un regalo bellissimo', 'Un regalo bellissimo'],
        correct: 0,
        right: 'Visto? Non era difficile. ❤️',
        wrong: 'Come hai fatto a sbagliare? Erano tutte uguali.',
      },
    ],
    complete: {
      label: 'PRIMO INDIZIO SBLOCCATO',
      clue: 'Identità confermata',
      text: 'Primo indizio: ti servirà del tempo libero. E non dovrai organizzare niente.', // TODO
    },
  },

  /* -------------------------------------------------------------------
     SCHERMATA 3 — CRUCIVERBA

     Ogni parola: answer (solo lettere, maiuscole), row/col della prima
     lettera (0 = prima riga/colonna), dir 'across' (orizzontale) o
     'down' (verticale), clue (definizione).
     I numeri delle definizioni vengono calcolati in automatico.

     mystery: le caselle misteriose, NELL'ORDINE in cui formano la parola
     segreta (secret). Ogni casella deve contenere la lettera giusta.

     Se cambi le parole devi ricalcolare lo schema (posizioni e incroci):
     la console del browser segnala eventuali conflitti.

     ------------------------------------------------------------------- */
  crossword: {
    title: 'Test 2 — Cruciverba classificato',
    intro: 'Un cruciverba fatto su misura per te. Tra le tue passioni si nasconde qualcosa, riuscirai a scoprirlo?',
    allowHints: true, // pulsante "Aiutino" che rivela la lettera selezionata
    words: [
      {
        answer: 'COLLARE',
        row: 0, col: 1, dir: 'across',
        clue: 'Quello elisabettiano è il più odiato dai pazienti.'
      },
      {
        answer: 'CROCCANTINI',
        row: 0, col: 1, dir: 'down',
        clue: 'Lo strumento diplomatico preferito per negoziare con pazienti poco collaborativi.'
      },
      {
        answer: 'GOJO',
        row: 2, col: 0, dir: 'across',
        clue: 'Ha gli occhi più belli della serie, ma preferisce non mostrarli.'
      },
      {
        answer: 'KUZCO',
        row: 2, col: 6, dir: 'down',
        clue: 'Il suo più grande errore? Aver licenziato la persona sbagliata.'
      },
      {
        answer: 'MUSHU',
        row: 3, col: 5, dir: 'across',
        clue: 'Doveva essere un grande drago protettore. È arrivata la versione tascabile.'
      },
      {
        answer: 'NEZUKO',
        row: 6, col: 1, dir: 'across',
        clue: 'Il suo monolocale è di legno, portatile e decisamente poco luminoso.'
      },
      {
        answer: 'LEVI',
        row: 7, col: 7, dir: 'down',
        clue: 'L’incubo dei giganti e di chi lascia le briciole sul tavolo.'
      },
      {
        answer: 'EDNA',
        row: 8, col: 7, dir: 'across',
        clue: 'La stilista che ha dichiarato guerra ai mantelli. Per ottime ragioni.'
      },
      {
        answer: 'ADE',
        row: 8, col: 10, dir: 'down',
        clue: 'Gestisce gli inferi, ma il suo vero problema è la gestione della rabbia.'
      },
      {
        answer: 'MICROCHIP',
        row: 10, col: 0, dir: 'across',
        clue: 'Un documento d’identità che non puoi dimenticare a casa.'
      }
    ],
    secret: 'SPA',
    mystery: [
      { row: 3, col: 7 },  // S di MUSHU
      { row: 10, col: 8 }, // P di MICROCHIP
      { row: 8, col: 10 }, // A di EDNA / ADE
    ],
    complete: {
      label: 'NUOVO INDIZIO SBLOCCATO',
      clue: 'S P A',
      text: 'Strano. Sicuramente si riferisce al <em>circuito di Formula 1 del Belgio</em>.',
    },
  },

  /* -------------------------------------------------------------------
     SCHERMATA 4 — PREPARA LA VALIGIA
     ok: true = serve davvero. Il livello finisce quando li ha presi tutti.
     msg: battuta mostrata quando tocca l'oggetto.
     ------------------------------------------------------------------- */
  suitcase: {
    title: 'Test 3 — Prepara la valigia',
    intro: 'Tocca gli oggetti che secondo te serviranno. Pensaci bene.',
    items: [
      { icon: '🩱', label: 'Costume',          ok: true,  msg: 'Ottima scelta. Potrebbe esserci dell’acqua.' },
      { icon: '💻', label: 'Computer',         ok: false, msg: 'Assolutamente no.' },
      { icon: '🥋', label: 'Accappatoio',      ok: false,  msg: 'Lascialo, dove andiamo ce n\'è uno più morbido del nostro.' },
      { icon: '🥾', label: 'Scarponi',         ok: false, msg: 'Non è quel tipo di gita. L’unica fatica sarà alzarsi dal lettino.' },
      { icon: '🩴', label: 'Ciabatte',         ok: true,  msg: 'Il sistema approva le ciabatte.' },
      { icon: '🤿', label: 'Maschera e pinne',          ok: false, msg: 'Acqua sì, ma non quel tipo di acqua.' },
      { icon: '🌙', label: 'Pigiama',            ok: true,  msg: 'Serve. A quanto pare la sera non si torna a casa.' },
      { icon: '🧴', label: 'Crema',    ok: false, msg: 'Non serve. Della tua pelle si occuperà qualcun altro.' },
      { icon: '👗', label: 'Vestito elegante', ok: true,  msg: 'Interessante… forse ci sarà un’occasione per metterlo.' },
      { icon: '⏰', label: 'Sveglia',          ok: false, msg: 'Sveglia? In che senso, sveglia?' },
      { icon: '⛺', label: 'Tenda',            ok: false, msg: 'Dormiremo in un letto vero. Giuro.' },
      { icon: '📑', label: 'Paper scientifici',  ok: false, msg: 'Il sistema li ha nascosti per il tuo bene.' },
    ],
    complete: {
      label: 'NUOVO INDIZIO SBLOCCATO',
      clue: 'RELAX',
      text: 'Costume, ciabatte… Pare ci sarà parecchia acqua calda. E nessuno ti chiederà di fare niente.',
    },
  },

  /* -------------------------------------------------------------------
     SCHERMATA 5 — TEST ANTI-STRESS (tieni premuto)
     failAt: a che percentuale fallisce ogni tentativo; l'ultimo arriva a 100.
     ------------------------------------------------------------------- */
  stress: {
    title: 'Test 4 — Anti-stress',
    intro: 'Analisi del livello di stress. Appoggia il dito e non mollare.',
    holdLabel: 'TIENI PREMUTO PER RILASSARTI',
    progressLabel: 'RILASSAMENTO',
    durationMs: 4200,       // tempo per arrivare al 100%
    failAt: [85, 96],       // 1° e 2° tentativo falliscono qui, il 3° riesce
    failMessage: 'ERRORE — Livello di stress troppo elevato.',
    failHints: ['Respira. Riprova.', 'Ci siamo quasi. Spalle giù.'],
    releasedEarly: 'Non mollare proprio adesso.',
    result: [
      'ANALISI COMPLETATA',
      'Livello di stress: <strong>preoccupante</strong>.',
    ],
    complete: {
      label: 'TRATTAMENTO CONSIGLIATO',
      clue: 'MASSAGGIO',
      text: 'Il sistema ha già provveduto. Nessuna obiezione verrà accettata.',
    },
  },

  /* -------------------------------------------------------------------
     SCHERMATA 6 — CENA MISTERIOSA (slot machine pilotata)
     L'ultimo simbolo di ogni rullo (result) è quello su cui si ferma.
     ------------------------------------------------------------------- */
  dinner: {
    title: 'Test 5 — Cena misteriosa',
    intro: 'Il sistema deve decidere cosa mangerai. Lascia fare alla fortuna (o quasi).',
    cta: 'GIRA',
    reels: [
      { label: 'Portata', symbols: ['🍕', '🍔', '🌮', '🍜', '🥪', '🍟'], result: '🍽️' },
      { label: 'Da bere', symbols: ['🥤', '☕', '🧃', '🍺', '🥛'],       result: '🍷' },
      { label: 'Dolce',   symbols: ['🍩', '🍦', '🍪', '🍫', '🧁'],       result: '🍰' },
    ],
    result: [
      'Il sistema ha preso una decisione importante.',
      'Quella sera non cuciniamo noi.',
    ],
    complete: {
      label: 'NUOVO INDIZIO',
      clue: 'CENA INCLUSA',
      text: 'E niente piatti da lavare.',
    },
  },

  /* -------------------------------------------------------------------
     SCHERMATA 7 — 99%
     ------------------------------------------------------------------- */
  almost: {
    title: 'Riepilogo indizi',
    // indizi mostrati nella lista, in ordine
    clues: ['SPA', 'MASSAGGIO', 'CENA', 'RELAX'],
    text: 'Manca ancora un elemento fondamentale.',
    cta: 'SCOPRI L’ULTIMO 1%',
    lastPiece: 'TU ❤️',
  },

  /* -------------------------------------------------------------------
     SCHERMATA 8 — RIVELAZIONE FINALE
     ------------------------------------------------------------------- */
  final: {
    // foto grande in alto. Nome neutro apposta (niente "spa.jpg").
    heroImage: 'assets/images/final-hero.jpg',   // TODO: aggiungi la foto
    // facoltativo, per caricare una foto più leggera sui telefoni:
    // es. 'assets/images/final-hero-800.jpg 800w, assets/images/final-hero.jpg 1600w'
    heroSrcset: '',
    heroAlt: 'La struttura che ci aspetta',
    logo: '',                                      // es. 'assets/images/final-logo.png' (facoltativo)
    title: 'BUON COMPLEANNO ❤️',
    subtitle: '',
    reveal: 'UN SOGGIORNO PER NOI DUE IN UNA SPA',
    place: {
      name: 'Villa Anitori',
      location: 'Loro Piceno (MC)',
      date: '30/10/2026',
    },
    includes: [
      { icon: '🫧', text: 'Percorso benessere esclusivo' },
      { icon: '💆‍♀️', text: 'Massaggio di coppia' },
      { icon: '🍷', text: 'Cena' },
      { icon: '🛏️', text: 'Pernottamento' },
    ],
    extra: 'E soprattutto io, che purtroppo ero incluso nel pacchetto.',
    dedication: 'Ancora tanti auguri, {nickname}. ❤️<br>Spero che questa sorpresa ti abbia fatto sorridere almeno quanto tu fai sorridere me.', // TODO
    // compaiono qualche secondo dopo
    outro: {
      label: 'MISSIONE COMPLETATA',
      lines: [
        'Ma dopo tutto questo lavoro, direi che ti meriti qualcosa di più concreto.',
        'C’è ancora una piccola sorpresa per te.',
      ],
      cta: 'APRI LA SECONDA BUSTA ❤️',
      afterCta: 'Dai, aprila 💌',
    },
    outroDelayMs: 6000,
  },

  /* -------------------------------------------------------------------
     EASTER EGG — cuoricino nascosto nella schermata finale
     ------------------------------------------------------------------- */
  secret: {
    title: 'Hai trovato il cuore segreto',
    text: 'Trovare 4 foto decenti di noi è stato più difficile che creare questo sito. Prometto che in futuro ne faremo molte di più, perché di ricordi da immortalare insieme ne abbiamo ancora tantissimi. ❤️',
    // foto della galleria (facoltative). Se un file manca viene mostrato un riquadro vuoto.
    photos: [ // TODO
      { src: 'assets/images/us-1.jpg', alt: 'Noi due' },
      { src: 'assets/images/us-2.jpg', alt: 'Noi due' },
      { src: 'assets/images/us-3.jpg', alt: 'Noi due' },
      { src: 'assets/images/us-4.jpg', alt: 'Noi due' },
    ],
  },

  /* -------------------------------------------------------------------
     AUDIO (facoltativo)
     Gli effetti sonori sono generati dal browser, non servono file.
     finalMusic: file mp3 per la rivelazione finale ('' = nessuna musica).
     Parte quando lei tocca "Scopri l'ultimo 1%" (i telefoni bloccano
     l'audio automatico senza un tocco).
     ------------------------------------------------------------------- */
  audio: {
    effects: true,
    finalMusic: '',          // es. 'assets/audio/finale.mp3'
    finalMusicVolume: 0.6,
  },
};

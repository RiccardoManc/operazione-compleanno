# Operazione Compleanno

Sito statico (HTML + CSS + JavaScript, nessuna dipendenza) pensato per il telefono.
Si apre dal QR code e porta, livello dopo livello, alla scoperta del regalo.

Flusso: **Intro → Quiz → Cruciverba → Valigia → Anti-stress → Cena → 99% → Rivelazione**

## File

```
index.html          pagina unica (titolo neutro, nessuno spoiler)
css/style.css       grafica, temi (missione → spa), animazioni
js/config.js        ← TUTTI i contenuti personalizzabili
js/app.js           navigazione, progresso, salvataggio, audio, intro/99%/finale
js/games.js         quiz, cruciverba, valigia, anti-stress, slot della cena
assets/images/      foto (vedi sotto)
assets/audio/       musica finale (facoltativa)
```

## Provarlo

**Sul computer**: apri un terminale nella cartella del progetto e lancia

```bash
python3 -m http.server 8000
```

poi apri <http://localhost:8000>.

**Sul telefono** (stessa rete Wi-Fi): con il server acceso apri `http://IP-DEL-COMPUTER:8000`. Per trovare l'IP usa `hostname -I`.

**Ripartire da zero**: aggiungi `?reset` all'indirizzo (es. `http://localhost:8000/?reset`). In alternativa usa il link “ricomincia da capo” nella schermata di ripresa.

## Personalizzare

Si modifica **solo `js/config.js`**: ogni sezione è commentata e i placeholder sono marcati con `// TODO`.

| Cosa | Dove in `config.js` |
|---|---|
| Nome, soprannome, data | `name`, `nickname`, `birthday` |
| Percentuali della barra | `progress` |
| Domande del quiz | `quiz.questions` (`correct` = indice della risposta giusta, da 0) |
| Riprovare o saltare dopo un errore | `quiz.allowSkipAfterWrong` |
| Cruciverba | `crossword.words`, `crossword.mystery` |
| Oggetti della valigia e battute | `suitcase.items` (`ok: true` = va preso) |
| Anti-stress (a che % fallisce) | `stress.failAt` |
| Simboli della slot | `dinner.reels` |
| Nome SPA, luogo, data, pacchetto | `final.place`, `final.includes` |
| Dedica finale | `final.dedication` |
| Easter egg (cuore nascosto) | `secret.text`, `secret.photos` |
| Musica | `audio.finalMusic` |

Nei testi puoi usare `{name}` e `{nickname}`, e semplice HTML (`<em>`, `<strong>`, `<br>`).

### Cruciverba

Ogni parola ha `row`/`col` della prima lettera (si parte da 0), una direzione (`across` = orizzontale, `down` = verticale) e una definizione. I numeri delle definizioni si calcolano da soli.

Se cambi le parole devi ricalcolare lo schema, perché gli incroci devono combaciare. La console del browser (F12) segnala:
- eventuali conflitti tra lettere;
- caselle misteriose che non contengono la lettera attesa.

Il modo più semplice: mandami la lista di parole e definizioni e ti preparo lo schema con le caselle che formano S-P-A.

## Immagini da aggiungere

I nomi dei file sono volutamente neutri: non rinominarli in “spa.jpg” o simili.

| File | Uso | Consiglio |
|---|---|---|
| `assets/images/final-hero.jpg` | foto grande della rivelazione | orizzontale 4:3, ~1600px di larghezza, < 400 KB |
| `assets/images/us-1.jpg` … `us-4.jpg` | galleria del cuore segreto | quadrate, ~800px, < 200 KB |
| `final.logo` (facoltativo) | logo della struttura | PNG trasparente, alto ~120px |

Se una foto manca, al suo posto compare un riquadro elegante: non si rompe nulla.
Puoi mettere quante foto vuoi nella galleria aggiungendole all'elenco `secret.photos`.
Per comprimerle va benissimo <https://squoosh.app>.

## Audio

- Gli **effetti sonori** sono generati dal browser, quindi non servono file. Si spengono con l'icona in alto a destra.
- La **musica finale** è facoltativa. Metti un mp3 in `assets/audio/` (es. `finale.mp3`) e scrivi il percorso in `audio.finalMusic`. Parte quando lei tocca “Scopri l'ultimo 1%”, perché i telefoni bloccano l'audio automatico. Se il telefono è in silenzioso o l'audio è bloccato, il sito funziona comunque.

## Pubblicare su GitHub Pages

1. Crea un repository **con un nome neutro**: il nome finisce nell'URL e quindi nel QR. Ad esempio `operazione-compleanno` va bene, `regalo-spa` no.
2. Carica tutti i file (`index.html` deve stare nella radice).
3. Vai su **Settings → Pages → Build and deployment**, scegli *Deploy from a branch*, branch `main`, cartella `/ (root)`.
4. Dopo un minuto il sito sarà su `https://TUO-UTENTE.github.io/NOME-REPO/`.
5. Genera il QR **solo quando l'indirizzo è definitivo** e provalo stampato, non solo sullo schermo.

Il sito ha `noindex`, quindi non comparirà sui motori di ricerca.

## Collaudo consigliato

- [ ] Apri il sito dal QR stampato, in navigazione anonima.
- [ ] Completa tutto dall'inizio alla fine su iPhone e Android.
- [ ] Chiudi a metà, riapri e verifica “Missione precedente rilevata”.
- [ ] Prova risposte sbagliate, “Controlla” e “Aiutino” nel cruciverba.
- [ ] Prova l'anti-stress tenendo premuto con il pollice.
- [ ] Verifica che URL, titolo della scheda e anteprima non rivelino nulla.
- [ ] Prova con l'audio acceso e spento.
- [ ] I progressi restano salvati solo sul telefono che li ha fatti: le tue prove non influenzano quello di lei.

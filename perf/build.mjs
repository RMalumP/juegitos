// Build script: genera la versión modular (CSS + JS por juego) desde los
// archivos únicos originales, de forma DETERMINISTA y con verificación
// byte-exacta de que la concatenación reproduce el original (=> misma cascada
// CSS y mismo orden de ejecución JS => comportamiento idéntico).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...a) => path.join(ROOT, ...a);
const read = (f) => fs.readFileSync(p(f), 'utf8');
const write = (f, c) => { fs.mkdirSync(path.dirname(p(f)), { recursive: true }); fs.writeFileSync(p(f), c); };

// Fuente de verdad = la versión monolítica original, que vive SOLO en
// perf/baseline/ (el build escribe la versión modular en la raíz; nunca pisa
// su propia entrada, así es idempotente).
const ORIG_HTML = read('perf/baseline/index.html');
const ORIG_CSS = read('perf/baseline/css/style.css');
const ORIG_JS = read('perf/baseline/js/script.js');

console.log('== Originales ==');
console.log('  index.html :', ORIG_HTML.length, 'B');
console.log('  style.css  :', ORIG_CSS.length, 'B');
console.log('  script.js  :', ORIG_JS.length, 'B');

/* ---------------------------------------------------------------------------
 * 1) CSS: tokenizar reglas top-level con sus rangos de bytes
 * ------------------------------------------------------------------------- */
function tokenizeCss(css) {
  const rules = [];
  let i = 0; const n = css.length;
  const skipStr = (q) => { i++; while (i < n && css[i] !== q) { if (css[i] === '\\') i++; i++; } i++; };
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++;
    if (i >= n) break;
    const start = i;
    // selector / at-rule prelude hasta '{' (respetando strings)
    while (i < n && css[i] !== '{') { if (css[i] === '"' || css[i] === "'") skipStr(css[i]); else i++; }
    const sel = css.slice(start, i).trim();
    // bloque {...} respetando anidamiento y strings
    let depth = 0;
    while (i < n) {
      const ch = css[i];
      if (ch === '"' || ch === "'") { skipStr(ch); continue; }
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
      i++;
    }
    rules.push({ sel, start, end: i });
  }
  return rules;
}

const cssRules = tokenizeCss(ORIG_CSS);

// Clasificador por prefijo de selector. @keyframes se mapean por nombre.
const KF = { flipOut: 'carta', flipIn: 'carta', bjDeal: 'bj', bjPulse: 'bj',
  roulWinPulse: 'roul', roulBigPulse: 'roul', pkPulse: 'poker', tetPulse: 'tetris' };
function classify(sel) {
  if (sel.startsWith('@keyframes')) {
    const name = sel.replace('@keyframes', '').trim().split(/\s|{/)[0];
    return KF[name] || null;
  }
  if (sel.startsWith('@')) return null; // @media u otros -> ride-along
  const tok = (re) => re.test(sel);
  if (tok(/(^|[\s,>~+])#?\.?carta|cBig|cNewDeck/i)) return 'carta';
  if (tok(/(^|[\s,>~+])#?\.?bj/i) || tok(/cs(Table|Title|Close|Prob|St|H|D|Sp|Row)/)) return 'bj';
  if (tok(/(^|[\s,>~+])#?\.?roul/i)) return 'roul';
  if (tok(/(^|[\s,>~+])#?\.?(pk|poker)/i)) return 'poker';
  if (tok(/(^|[\s,>~+])#?\.?tet/i)) return 'tetris';
  if (tok(/(^|[\s,>~+])#?\.?inv/i)) return 'invaders';
  if (tok(/(^|[\s,>~+])#?\.?snk/i)) return 'snake';
  if (tok(/(^|[\s,>~+])#?\.?pac/i)) return 'pacman';
  if (tok(/(^|[\s,>~+])#?\.?ast/i)) return 'asteroids';
  if (tok(/(^|[\s,>~+])#?\.?sud/i)) return 'sudoku';
  return 'core';
}

// Orden esperado de la "cola" limpia (cada juego = tramo contiguo con prefijo único).
// Los juegos de cartas (Buscaminas, Solitario, Carta, Blackjack) comparten reglas
// .card/.hidden/.cBig con el núcleo y van intercalados => se quedan en core.css.
// La separación limpia empieza en el clúster de Ruleta.
const TAIL_ORDER = ['roul','poker','tetris','invaders','snake','pacman','sudoku','asteroids'];

// Inicio de la cola = comienzo del PRIMER clúster grande de roul (>=10 reglas
// seguidas), para saltarnos reglas 'roul' sueltas/compartidas del head.
let tailStartIdx = -1;
for (let k = 0; k < cssRules.length; k++) {
  if (classify(cssRules[k].sel) !== 'roul') continue;
  let run = 0;
  for (let j = k; j < cssRules.length && classify(cssRules[j].sel) === 'roul'; j++) run++;
  if (run >= 10) { tailStartIdx = k; break; }
}
if (tailStartIdx < 0) throw new Error('No se encontró el clúster de Ruleta (inicio de cola)');

// core.css = prefijo [0, tailStart)
const coreCssEnd = cssRules[tailStartIdx].start;
const cssParts = { core: ORIG_CSS.slice(0, coreCssEnd) };

// Recorrer la cola asignando cada regla al juego actual (ride-along de ambiguas)
let cur = null;
const tailBuckets = {}; // game -> [startByte, endByte]
for (let k = tailStartIdx; k < cssRules.length; k++) {
  const r = cssRules[k];
  const c = classify(r.sel);
  if (c && TAIL_ORDER.includes(c)) cur = c;
  if (!cur) throw new Error('Regla de cola sin juego: ' + r.sel.slice(0, 40));
  if (!tailBuckets[cur]) tailBuckets[cur] = [r.start, r.end];
  else tailBuckets[cur][1] = r.end;
}
// Construir slices en orden y verificar contigüidad/exactitud
let cursor = coreCssEnd;
for (const g of TAIL_ORDER) {
  const b = tailBuckets[g];
  if (!b) throw new Error('Falta bucket de cola: ' + g);
  // El gap entre el fin de core y el inicio del primer juego, o entre juegos,
  // debe ser solo whitespace (lo absorbemos al slice siguiente para exactitud).
  const sliceStart = cursor;
  cssParts[g] = ORIG_CSS.slice(sliceStart, b[1]);
  cursor = b[1];
}
// Verificación byte-exacta
const cssRebuilt = cssParts.core + TAIL_ORDER.map(g => cssParts[g]).join('');
if (cssRebuilt !== ORIG_CSS) {
  // localizar primer byte divergente
  let d = 0; while (d < ORIG_CSS.length && cssRebuilt[d] === ORIG_CSS[d]) d++;
  throw new Error('CSS reconstruido != original en byte ' + d + '\n orig: ...' +
    JSON.stringify(ORIG_CSS.slice(d-40, d+40)) + '\n got : ...' + JSON.stringify(cssRebuilt.slice(d-40, d+40)));
}
console.log('\n== CSS split (verificado byte-exacto) ==');
const cssHeader = (name) => `/* ${name} — parte de Juegos XP. Extraído de style.css sin reordenar (cascada preservada). */\n`;
write('css/core.css', cssHeader('core.css: base + chrome de ventanas + escritorio + Buscaminas + Solitario') + cssParts.core);
for (const g of TAIL_ORDER) write(`css/games/${g}.css`, cssHeader(`${g}.css`) + cssParts[g]);
for (const g of ['core', ...TAIL_ORDER]) {
  const f = g === 'core' ? 'css/core.css' : `css/games/${g}.css`;
  console.log('  ', f.padEnd(24), fs.statSync(p(f)).size, 'B');
}

/* ---------------------------------------------------------------------------
 * 2) JS: cortar por líneas (fronteras de sentencia ya existentes)
 * ------------------------------------------------------------------------- */
const jsLines = ORIG_JS.split('\n'); // 1-indexado: jsLines[k-1]
const slice = (a, b) => jsLines.slice(a - 1, b).join('\n');

// Mapa de módulos por rango de líneas (ver análisis)
const jsCore = slice(1, 4);                 // núcleo + Mine/Sol/Carta/BJ/Roul/Poker + credits
const jsSud = slice(5, 6);                  // Sudoku (+ ';')
const jsTet = slice(7, 8);                  // Tetris
const jsInv = slice(9, 10);                 // Invaders
const jsSnk = slice(11, 12);                // Snake
const jsPac = slice(13, 14);                // Pac-Man
const jsAst = slice(41, 62);                // Asteroids (+ ';')
const jsBars = slice(63, 66);               // window-bars (hide/show title bar)
const openChessTabSrc = slice(27, 39);      // openChessTab + botón Damas + icono Damas (verbatim)

const jsHeader = (name) => `/* ${name} — Juegos XP. Código original sin cambios (solo separado en archivos). */\n`;

write('js/core.js', jsHeader('core.js: gestor de ventanas/taskbar/inicio + Buscaminas, Solitario, Carta, Blackjack, Ruleta, Póker') + jsCore);
write('js/window-bars.js', jsHeader('window-bars.js: ocultar/mostrar barra de título de cada ventana') + jsBars);
write('js/games/sudoku.js', jsHeader('sudoku.js') + jsSud);
write('js/games/tetris.js', jsHeader('tetris.js') + jsTet);
write('js/games/invaders.js', jsHeader('invaders.js') + jsInv);
write('js/games/snake.js', jsHeader('snake.js') + jsSnk);
write('js/games/pacman.js', jsHeader('pacman.js') + jsPac);
write('js/games/asteroids.js', jsHeader('asteroids.js') + jsAst);

/* ---------------------------------------------------------------------------
 * 3) Externalizar Ajedrez/Parchís: blob gz+base64 -> games/*.html
 * ------------------------------------------------------------------------- */
function decodeBlob(name) {
  const m = ORIG_JS.match(new RegExp(name + '="([^"]+)"'));
  if (!m) throw new Error('No se encontró ' + name);
  return zlib.gunzipSync(Buffer.from(m[1], 'base64')).toString('utf8');
}
write('games/chess.html', decodeBlob('CHESS_HTML_GZ_B64'));
write('games/parchis.html', decodeBlob('PARCHIS_HTML_GZ_B64'));
console.log('\n== iframe games externalizados ==');
console.log('  games/chess.html   ', fs.statSync(p('games/chess.html')).size, 'B');
console.log('  games/parchis.html ', fs.statSync(p('games/parchis.html')).size, 'B');

// iframe-games.js: init por fetch+srcdoc (idéntico a srcdoc original) + openChessTab/Damas verbatim
const iframeGames = jsHeader('iframe-games.js: Ajedrez y Parchís (HTML externo, carga bajo demanda al abrir)') +
`var GAMES_BASE=new URL('../games/',document.currentScript.src).href;
function initChess(){var f=document.getElementById('chessFrame');if(f.getAttribute('data-loaded'))return;f.setAttribute('data-loaded','1');fetch(GAMES_BASE+'chess.html').then(function(r){return r.text();}).then(function(html){f.srcdoc=html;});}
function initParchis(){var f=document.getElementById('parchisFrame');if(f.getAttribute('data-loaded'))return;f.setAttribute('data-loaded','1');fetch(GAMES_BASE+'parchis.html').then(function(r){return r.text();}).then(function(html){f.srcdoc=html;});}
` + openChessTabSrc + '\n';
write('js/iframe-games.js', iframeGames);
console.log('  js/iframe-games.js ', fs.statSync(p('js/iframe-games.js')).size, 'B');

/* ---------------------------------------------------------------------------
 * 4) lazy-loader.js: stubs init* que cargan js+css del juego bajo demanda
 * ------------------------------------------------------------------------- */
const lazyLoader = jsHeader('lazy-loader.js: carga bajo demanda de los módulos de juego (primer "abrir")') +
`(function(){
  var base=new URL('..',document.currentScript.src).href; // .../ (raíz del sitio)
  var cache={};
  function load(url){ if(cache[url])return cache[url];
    return cache[url]=new Promise(function(res,rej){
      var s=document.createElement('script'); s.src=url; s.async=false;
      s.onload=function(){res();}; s.onerror=function(){rej(new Error('load '+url));};
      document.head.appendChild(s);
    });
  }
  function css(url){ if(cache[url])return; cache[url]=1;
    var l=document.createElement('link'); l.rel='stylesheet'; l.href=url; document.head.appendChild(l);
  }
  // game -> { js, css, init }
  var GAMES={
    Sud:{js:'js/games/sudoku.js',  css:'css/games/sudoku.css',   init:'initSud'},
    Tetris:{js:'js/games/tetris.js',css:'css/games/tetris.css',  init:'initTetris'},
    Inv:{js:'js/games/invaders.js',css:'css/games/invaders.css', init:'initInv'},
    Snk:{js:'js/games/snake.js',   css:'css/games/snake.css',    init:'initSnk'},
    Pac:{js:'js/games/pacman.js',  css:'css/games/pacman.css',   init:'initPac'},
    Ast:{js:'js/games/asteroids.js',css:'css/games/asteroids.css',init:'initAst'}
  };
  // Define un stub global init* que carga el módulo y luego llama al init real.
  Object.keys(GAMES).forEach(function(key){
    var g=GAMES[key];
    window[g.init]=function(){
      css(base+g.css);
      load(base+g.js).then(function(){
        // tras cargar, window[init] es la función real (sobrescribe el stub)
        if(window[g.init]&&window[g.init].__lazy)return; // seguridad
        window[g.init]();
      });
    };
    window[g.init].__lazy=true;
  });
})();
`;
write('js/lazy-loader.js', lazyLoader);
console.log('  js/lazy-loader.js  ', fs.statSync(p('js/lazy-loader.js')).size, 'B');

console.log('\nBuild base OK.');

/* ---------------------------------------------------------------------------
 * 5) Generar los tres index.html (lazy raíz, eager perf, baseline copia)
 * ------------------------------------------------------------------------- */
const LINK_ORIG = '<link rel="stylesheet" href="css/style.css">';
const SCRIPT_ORIG = '<script src="js/script.js"></script>';
if (!ORIG_HTML.includes(LINK_ORIG) || !ORIG_HTML.includes(SCRIPT_ORIG))
  throw new Error('No se encontraron los tags <link>/<script> esperados en index.html');

const link = (href) => `<link rel="stylesheet" href="${href}">`;
const script = (src) => `<script src="${src}"></script>`;

// Conjuntos de archivos
const EAGER_CSS = ['css/core.css','css/games/roul.css','css/games/poker.css'];
const LAZY_CSS_TAIL = ['css/games/tetris.css','css/games/invaders.css','css/games/snake.css',
  'css/games/pacman.css','css/games/sudoku.css','css/games/asteroids.css'];
const CORE_JS = ['js/core.js','js/iframe-games.js','js/window-bars.js'];
const GAME_JS = ['js/games/sudoku.js','js/games/tetris.js','js/games/invaders.js',
  'js/games/snake.js','js/games/pacman.js','js/games/asteroids.js'];

// --- LAZY (index.html raíz): css/js núcleo + lazy-loader; juegos bajo demanda ---
{
  const css = EAGER_CSS.map(f => link(f)).join('');
  const js = [script('js/lazy-loader.js'), ...CORE_JS.map(f => script(f))].join('');
  let html = ORIG_HTML.replace(LINK_ORIG, css).replace(SCRIPT_ORIG, js);
  write('index.html', html);
  console.log('\n== index.html (LAZY, raíz) ==', fs.statSync(p('index.html')).size, 'B');
}

// --- EAGER (perf/eager/index.html): todo el css/js modular cargado de inicio ---
{
  const allCss = [...EAGER_CSS, ...LAZY_CSS_TAIL];
  const css = allCss.map(f => link('../../' + f)).join('');
  const allJs = ['js/core.js', ...GAME_JS, 'js/iframe-games.js', 'js/window-bars.js'];
  const js = allJs.map(f => script('../../' + f)).join('');
  let html = ORIG_HTML.replace(LINK_ORIG, css).replace(SCRIPT_ORIG, js);
  write('perf/eager/index.html', html);
  console.log('== perf/eager/index.html (EAGER) ==', fs.statSync(p('perf/eager/index.html')).size, 'B');
}

// --- BASELINE (perf/baseline/): es la ENTRADA del build (versión original
//     monolítica, self-contained). No se regenera aquí. ---
console.log('== perf/baseline/ (single-file original) ==');

console.log('\nBuild COMPLETO.');

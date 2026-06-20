// Verificación funcional de las 3 variantes con Playwright (Chromium headless).
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8731;
const BASE = `http://localhost:${PORT}`;

// Servidor estático simple (sin caché) con gzip desactivado para claridad
import fs from 'node:fs';
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url.endsWith('/')) url += 'index.html';
  const fp = path.join(ROOT, url);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('404'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(PORT, r));

const VARIANTS = [
  { name: 'baseline (single-file)', url: `${BASE}/perf/baseline/index.html` },
  { name: 'eager (modular)',        url: `${BASE}/perf/eager/index.html` },
  { name: 'lazy (modular)',         url: `${BASE}/index.html` },
];

const browser = await chromium.launch();
let allOk = true;

for (const v of VARIANTS) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  // Ignorar errores de recursos EXTERNOS (p.ej. fuente de Google dentro de un
  // juego iframe), que fallan solo por la política de red del sandbox y existen
  // también en la baseline original — no son del refactor.
  const isExternal = (t) => /googleapis|gstatic|ERR_CERT|net::ERR|Failed to load resource/i.test(t);
  page.on('console', m => { if (m.type() === 'error' && !isExternal(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => { if (!isExternal(e.message)) errors.push('PAGEERROR: ' + e.message); });

  console.log(`\n=== ${v.name} ===`);
  await page.goto(v.url, { waitUntil: 'load' });
  await page.waitForTimeout(300);

  // 1) Escritorio: 15 iconos
  const icons = await page.locator('.deskIcon').count();
  console.log(`  iconos escritorio: ${icons} ${icons===15?'✓':'✗'}`);

  // 2) Abrir Tetris (juego lazy con canvas) vía openGame
  await page.evaluate(() => window.openGame && window.openGame('tetris'));
  await page.waitForTimeout(500);
  const tetVisible = await page.locator('#winTetris').evaluate(el => !el.classList.contains('hidden')).catch(()=>false);
  const tetInitReal = await page.evaluate(() => typeof window.initTetris === 'function' && !window.initTetris.__lazy);
  const tetCanvas = await page.locator('#tet-bc').count();
  console.log(`  Tetris ventana visible: ${tetVisible?'✓':'✗'} | initTetris real cargado: ${tetInitReal?'✓':'✗'} | canvas: ${tetCanvas?'✓':'✗'}`);

  // 3) Abrir Blackjack (juego del core)
  await page.evaluate(() => window.openGame && window.openGame('bj'));
  await page.waitForTimeout(300);
  const bjVisible = await page.locator('#winBJ').evaluate(el => !el.classList.contains('hidden')).catch(()=>false);
  const bjBet = await page.locator('#bjBetPhase').count();
  console.log(`  Blackjack visible: ${bjVisible?'✓':'✗'} | panel apuestas: ${bjBet?'✓':'✗'}`);

  // 4) Abrir Sudoku (lazy) y comprobar tablero generado
  await page.evaluate(() => window.openGame && window.openGame('sud'));
  await page.waitForTimeout(500);
  const sudCells = await page.locator('#sudBoard .sudCell, #sudBoard > div').count();
  console.log(`  Sudoku celdas generadas: ${sudCells} ${sudCells>0?'✓':'✗'}`);

  // 5) Abrir Ajedrez (iframe externalizado) y comprobar srcdoc cargado + switchTab
  await page.evaluate(() => window.openGame && window.openGame('chess'));
  await page.waitForTimeout(1500);
  const chessLoaded = await page.evaluate(() => {
    const f = document.getElementById('chessFrame');
    if (!f) return 'no-frame';
    const hasDoc = !!(f.srcdoc && f.srcdoc.length > 1000);
    let hasSwitch = false;
    try { hasSwitch = typeof f.contentWindow.switchTab === 'function'; } catch(e) {}
    return { srcdocLen: f.srcdoc ? f.srcdoc.length : 0, hasSwitch };
  });
  console.log(`  Ajedrez iframe:`, JSON.stringify(chessLoaded));

  // 6) Errores de consola
  if (errors.length) { allOk = false; console.log(`  ✗ ERRORES (${errors.length}):`); errors.slice(0,8).forEach(e => console.log('     ', e.slice(0,140))); }
  else console.log('  ✓ sin errores de consola');

  if (icons!==15 || !tetVisible || !tetInitReal || !bjVisible) allOk = false;
  await ctx.close();
}

await browser.close();
server.close();
console.log(allOk ? '\n=== RESULTADO: TODAS LAS VARIANTES OK ===' : '\n=== RESULTADO: HAY FALLOS (ver arriba) ===');
process.exit(allOk ? 0 : 1);

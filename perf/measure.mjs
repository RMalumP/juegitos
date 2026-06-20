// Medición de rendimiento de las 3 variantes (Playwright + Chromium headless).
//  1) Desglose de bytes DETERMINISTA (raw + gzip) de la carga inicial.
//  2) Timing en frío con Chromium: sin throttling y con perfil MÓVIL
//     (CPU 4x lenta + red "Fast 3G"), ya que la app es mobile-first.
//  3) Latencia/bytes al abrir un juego en frío (Tetris y Ajedrez).
// Genera perf/results.json y perf/RESULTS.md
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const PORT = 8733;
const BASE = `http://localhost:${PORT}`;
const RUNS = 9;
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml' };
const gzip = (buf) => zlib.gzipSync(buf, { level: 6 });
const sz = (f) => fs.statSync(P(f)).size;
const gzsz = (f) => gzip(fs.readFileSync(P(f))).length;

/* ---- 1) Desglose determinista de la carga inicial ---- */
const INIT = {
  A: ['perf/baseline/index.html','perf/baseline/css/style.css','perf/baseline/js/script.js'],
  B: ['perf/eager/index.html',
      'css/core.css','css/games/roul.css','css/games/poker.css','css/games/tetris.css','css/games/invaders.css',
      'css/games/snake.css','css/games/pacman.css','css/games/sudoku.css','css/games/asteroids.css',
      'js/core.js','js/games/sudoku.js','js/games/tetris.js','js/games/invaders.js','js/games/snake.js',
      'js/games/pacman.js','js/games/asteroids.js','js/iframe-games.js','js/window-bars.js'],
  C: ['index.html','css/core.css','css/games/roul.css','css/games/poker.css',
      'js/lazy-loader.js','js/core.js','js/iframe-games.js','js/window-bars.js'],
};
const breakdown = {};
for (const [k, files] of Object.entries(INIT)) {
  let raw = 0, gz = 0, js = 0, jsgz = 0;
  for (const f of files) { raw += sz(f); gz += gzsz(f); if (f.endsWith('.js')) { js += sz(f); jsgz += gzsz(f); } }
  breakdown[k] = { reqs: files.length, raw, gz, js, jsgz };
}

/* ---- Servidor con gzip ---- */
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url.endsWith('/')) url += 'index.html';
  const fp = path.join(ROOT, url);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  const buf = fs.readFileSync(fp); const type = MIME[path.extname(fp)] || 'application/octet-stream';
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '') && /text|javascript|json|svg/.test(type);
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' };
  if (gz) { const c = gzip(buf); headers['Content-Encoding'] = 'gzip'; res.writeHead(200, headers); res.end(c); }
  else { res.writeHead(200, headers); res.end(buf); }
});
await new Promise(r => server.listen(PORT, r));

const VARIANTS = [
  { key: 'A', name: 'A · single-file (original)', url: `${BASE}/perf/baseline/index.html` },
  { key: 'B', name: 'B · modular (eager)',        url: `${BASE}/perf/eager/index.html` },
  { key: 'C', name: 'C · modular (lazy)',         url: `${BASE}/index.html` },
];
const median = (a) => { const s = [...a].sort((x,y)=>x-y); const m = s.length>>1; return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
const browser = await chromium.launch();

async function measure(v, throttle) {
  const runs = [];
  for (let it = 0; it < RUNS; it++) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    if (throttle) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline:false, latency:150, downloadThroughput:1.6*1024*1024/8, uploadThroughput:750*1024/8 });
    }
    let phase='initial'; const bytes={initial:0,tetris:0,chess:0}; const reqs={initial:0,tetris:0,chess:0};
    page.on('response', async (resp) => { const u=resp.url(); if(!u.startsWith(BASE))return; let s=0; try{s=(await resp.request().sizes()).responseBodySize;}catch{} if(bytes[phase]!=null){bytes[phase]+=s;reqs[phase]++;} });

    await page.goto(v.url, { waitUntil: 'load' });
    await page.waitForTimeout(throttle?250:120);
    const t = await page.evaluate(() => { const n=performance.getEntriesByType('navigation')[0]||{}; const fcp=(performance.getEntriesByType('paint').find(p=>p.name==='first-contentful-paint')||{}).startTime||0; return { dcl:n.domContentLoadedEventEnd, load:n.loadEventEnd, fcp }; });
    const M = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));

    phase='tetris'; const ts=await page.evaluate(()=>performance.now());
    await page.evaluate(()=>window.openGame&&window.openGame('tetris'));
    await page.waitForFunction(()=>typeof window.initTetris==='function'&&!window.initTetris.__lazy,{timeout:8000}).catch(()=>{});
    const tetMs=await page.evaluate(s=>performance.now()-s,ts);

    phase='chess'; const cs=await page.evaluate(()=>performance.now());
    await page.evaluate(()=>window.openGame&&window.openGame('chess'));
    await page.waitForFunction(()=>{const f=document.getElementById('chessFrame');return f&&f.srcdoc&&f.srcdoc.length>1000;},{timeout:10000}).catch(()=>{});
    const chMs=await page.evaluate(s=>performance.now()-s,cs);

    runs.push({ scriptMs:(M.ScriptDuration||0)*1000, dcl:t.dcl, load:t.load, fcp:t.fcp,
      tetMs, tetBytes:bytes.tetris, chMs, chBytes:bytes.chess });
    await ctx.close();
  }
  const agg={}; for(const k of Object.keys(runs[0])) agg[k]=Math.round(median(runs.map(r=>r[k]))); return agg;
}

const timing = { plain:{}, mobile:{} };
for (const v of VARIANTS) { process.stdout.write(`Midiendo ${v.name} sin throttle...\n`); timing.plain[v.key]=await measure(v,false); }
for (const v of VARIANTS) { process.stdout.write(`Midiendo ${v.name} móvil (4x CPU + Fast 3G)...\n`); timing.mobile[v.key]=await measure(v,true); }

await browser.close(); server.close();

const out = { breakdown, timing };
fs.writeFileSync(P('perf','results.json'), JSON.stringify(out,null,2));

/* ---- Salida consola ---- */
const KB=b=>(b/1024).toFixed(1);
const pad=(s,n)=>String(s).padEnd(n);
function table(title, rows){ console.log('\n'+title); console.log('-'.repeat(70));
  console.log(pad('',30)+pad('A single',13)+pad('B eager',13)+pad('C lazy',13));
  for(const[label,fa,fb,fc]of rows) console.log(pad(label,30)+pad(fa,13)+pad(fb,13)+pad(fc,13)); }
const b=breakdown;
table('CARGA INICIAL — bytes (determinista)', [
  ['Peticiones HTTP', b.A.reqs, b.B.reqs, b.C.reqs],
  ['Tamaño total (raw)', KB(b.A.raw)+' KB', KB(b.B.raw)+' KB', KB(b.C.raw)+' KB'],
  ['Transferido (gzip)', KB(b.A.gz)+' KB', KB(b.B.gz)+' KB', KB(b.C.gz)+' KB'],
  ['JS a parsear (raw)', KB(b.A.js)+' KB', KB(b.B.js)+' KB', KB(b.C.js)+' KB'],
]);
const tp=timing.plain, tm=timing.mobile;
table('TIMING sin throttle (mediana '+RUNS+' runs)', [
  ['JS CPU (ScriptDuration)', tp.A.scriptMs+' ms', tp.B.scriptMs+' ms', tp.C.scriptMs+' ms'],
  ['DOMContentLoaded', tp.A.dcl+' ms', tp.B.dcl+' ms', tp.C.dcl+' ms'],
  ['First Contentful Paint', tp.A.fcp+' ms', tp.B.fcp+' ms', tp.C.fcp+' ms'],
]);
table('TIMING móvil 4x CPU + Fast 3G (mediana '+RUNS+' runs)', [
  ['JS CPU (ScriptDuration)', tm.A.scriptMs+' ms', tm.B.scriptMs+' ms', tm.C.scriptMs+' ms'],
  ['DOMContentLoaded', tm.A.dcl+' ms', tm.B.dcl+' ms', tm.C.dcl+' ms'],
  ['First Contentful Paint', tm.A.fcp+' ms', tm.B.fcp+' ms', tm.C.fcp+' ms'],
]);
table('ABRIR EN FRÍO (móvil) — latencia / bytes', [
  ['Tetris', tm.A.tetMs+' ms / '+KB(tm.A.tetBytes)+'KB', tm.B.tetMs+' ms / '+KB(tm.B.tetBytes)+'KB', tm.C.tetMs+' ms / '+KB(tm.C.tetBytes)+'KB'],
  ['Ajedrez', tm.A.chMs+' ms / '+KB(tm.A.chBytes)+'KB', tm.B.chMs+' ms / '+KB(tm.B.chBytes)+'KB', tm.C.chMs+' ms / '+KB(tm.C.chBytes)+'KB'],
]);
console.log('\nJSON -> perf/results.json');

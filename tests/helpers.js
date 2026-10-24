// Utilidades de las pruebas de navegador: servidor web estático, servidor de señalización PeerJS local y contextos de Chromium.
// Se usan las mismas piezas que en producción, salvo que PeerJS se sirve desde node_modules y la señalización es local.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { PeerServer } = require('peer');
const root = path.resolve(__dirname, '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PEERJS = fs.readFileSync(require.resolve('peerjs/dist/peerjs.min.js'));
const wait = ms => new Promise(r => setTimeout(r, ms));
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) { fallos++; process.exitCode = 1; } };

async function entorno(puertoWeb = 9302, puertoPeer = 9301) {
  const ps = PeerServer({ port: puertoPeer, path: '/juegitos', host: '127.0.0.1' });
  const web = http.createServer((q, r) => {
    const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end('no'); return; }
    r.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f));
  }).listen(puertoWeb, '127.0.0.1');
  const cands = [process.env.CHROME_PATH, ...(fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers').filter(d => /^chromium-/.test(d)).map(d => '/opt/pw-browsers/' + d + '/chrome-linux/chrome') : [])].filter(Boolean);
  const exe = cands.find(c => fs.existsSync(c));
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const url = 'http://127.0.0.1:' + puertoWeb + '/index.html';
  async function contexto(opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 400, height: 760 }, hasTouch: true }, opts || {}));
    await ctx.route(/cdn\.jsdelivr\.net|unpkg\.com/, r => r.fulfill({ contentType: 'text/javascript', body: PEERJS }));
    await ctx.addInitScript(p => { window.JUEGITOS_PEER_SERVER = { host: '127.0.0.1', port: p, path: '/juegitos', secure: false }; }, puertoPeer);
    return ctx;
  }
  async function pagina(ctx, nombre) {
    const pg = await ctx.newPage();
    pg.on('pageerror', e => { console.log('pageerror' + (nombre ? ' [' + nombre + ']' : '') + ':', e.message); ok(false, 'sin errores de página (' + (nombre || '') + ')'); });
    if (process.env.DEBUG_PAGES) pg.on('console', m => console.log('   [consola ' + (nombre || '') + ']', m.text().slice(0, 200)));
    await pg.goto(url);
    return pg;
  }
  async function cerrar() { await browser.close(); web.close(); ps.removeAllListeners && ps.removeAllListeners(); }
  return { browser, contexto, pagina, url, cerrar, root };
}
const fin = () => { console.log(fallos ? '\n' + fallos + ' prueba(s) fallida(s)' : '\nTodo correcto'); process.exit(fallos ? 1 : 0); };
module.exports = { entorno, wait, ok, fin };

// Pruebas de la PWA: manifest, iconos, lista de archivos del service worker, funcionamiento sin conexión, botón de instalar y accesos directos.
const fs = require('fs'), path = require('path');
const { entorno, wait, ok, fin } = require('./helpers');
const root = path.resolve(__dirname, '..');
function ls(dir) { return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(d => d.isDirectory() ? ls(path.join(dir, d.name)) : [path.join(dir, d.name).replace(/\\/g, '/')]); }
function dimPng(f) { const b = fs.readFileSync(path.join(root, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }

(async () => {
  // --- estático
  const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  ok(man.display === 'fullscreen' && man.display_override.includes('standalone') && man.start_url && man.scope && man.name && man.short_name && man.theme_color && man.background_color, 'manifest con nombre, colores, start_url y pantalla completa (con standalone de reserva)');
  for (const ic of man.icons.filter(i => i.type === 'image/png')) {
    ok(fs.existsSync(path.join(root, ic.src)) && dimPng(ic.src).join('x') === ic.sizes, 'icono ' + ic.src + ' existe y mide ' + ic.sizes);
  }
  ok(man.icons.some(i => i.purpose === 'maskable') && man.icons.some(i => i.sizes === '192x192') && man.icons.some(i => i.sizes === '512x512'), 'iconos 192, 512 y maskable');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const lista = [...sw.matchAll(/'([^']+)'/g)].map(m => m[1]);
  const necesarios = [...ls('css'), ...ls('js'), ...ls('games'), 'index.html', 'manifest.webmanifest'];
  const faltan = necesarios.filter(f => !lista.includes(f));
  ok(!faltan.length, 'el service worker precachea todos los archivos de la aplicación' + (faltan.length ? ' (faltan: ' + faltan.join(', ') + ')' : ''));
  const ver = fs.readFileSync(path.join(root, 'js/version.js'), 'utf8');
  ok(/APP_VERSION = '\d+\.\d+\.\d+'/.test(ver) && /importScripts\('js\/version\.js'\)/.test(sw) && /VERSION = 'v' \+ self\.APP_VERSION/.test(sw), 'la versión de la app sale de js/version.js y el service worker deriva de ahí el nombre de su caché');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(/rel="manifest"/.test(html) && /rel="apple-touch-icon"/.test(html) && /name="theme-color"/.test(html), 'index.html enlaza manifest, apple-touch-icon y theme-color');

  // --- navegador
  const env = await entorno(9352, 9351);
  const ctx = await env.contexto({ serviceWorkers: 'allow' });
  const pg = await env.pagina(ctx, 'pwa');
  await pg.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller || false, null, { timeout: 20000 }).catch(() => {});
  await pg.evaluate(() => navigator.serviceWorker.ready);
  await wait(1500);
  const cacheados = await pg.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks.find(k => k.startsWith('juegitos-shell'))); return (await c.keys()).length; });
  ok(cacheados >= necesarios.length, 'el service worker ha guardado ' + cacheados + ' archivos');
  await pg.reload(); await wait(800);
  ok(await pg.evaluate(() => !!navigator.serviceWorker.controller), 'la página está controlada por el service worker');

  // botón de instalar
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => window.openGame('sala'));
  await pg.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompt = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
  ok(await pg.locator('#salaInstalar').isVisible(), 'aparece el botón «Instalar como app» cuando el navegador lo permite');
  await pg.click('#salaInstalar');
  ok(await pg.evaluate(() => window.__prompt === true), 'el botón lanza el diálogo de instalación');

  // sin conexión
  await ctx.setOffline(true);
  await pg.goto(env.url);
  await pg.waitForSelector('#iconBingo');
  ok(true, 'sin conexión el escritorio sigue abriendo');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.locator('#iconBingo').click();
  await pg.waitForSelector('.bgTitulo', { timeout: 10000 });
  await pg.locator('#bingoWrap >> text=Empezar partida').click(); await pg.waitForSelector('.bgTablero');
  await pg.locator('#bingoWrap >> text=Sacar bola').click();
  ok(await pg.locator('.bgT.sal').count() === 1, 'sin conexión el bingo local funciona (carga diferida desde la caché)');
  await pg.evaluate(() => window.openGame('tetris')); await pg.waitForSelector('#winTetris:not(.hidden)');
  ok(true, 'sin conexión también abren los demás juegos');
  await ctx.setOffline(false);

  // accesos directos
  const pg2 = await ctx.newPage();
  pg2.on('pageerror', e => ok(false, 'sin errores: ' + e.message));
  await pg2.goto(env.url + '?abrir=bingo');
  await pg2.waitForSelector('#winBingo:not(.hidden)', { timeout: 10000 });
  ok(await pg2.locator('#startScreen').evaluate(e => getComputedStyle(e).display) === 'none', 'el acceso directo «Bingo» abre el bingo sin pantalla de inicio');
  await pg2.goto(env.url + '?abrir=sala');
  await pg2.waitForSelector('#winSala:not(.hidden)', { timeout: 10000 });
  ok(true, 'el acceso directo «Sala online» abre la sala');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

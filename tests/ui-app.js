// Aplicación: botón «← Volver» de la conexión, ocultar la barra del juego oculta «Conectar», versión en créditos, botón «Instalar app» y pantalla completa.
const fs = require('fs'), path = require('path');
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9582, 9581);
  const ver = /APP_VERSION = '([\d.]+)'/.exec(fs.readFileSync(path.join(env.root, 'js/version.js'), 'utf8'))[1];

  // ---------------- volver desde la conexión de cada juego ----------------
  let ctx = await env.contexto({ hasTouch: true }), pg = await env.pagina(ctx, 'app');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => window.openChessTab(2)); await pg.waitForFunction(() => document.getElementById('chessFrame').contentWindow.getActiveTab);
  await pg.locator('#winChess [data-conectar]').click();
  await pg.waitForSelector('#winSala:not(.hidden)');
  ok(await pg.locator('#salaVolver').isVisible() && /Volver a Damas/.test(await pg.locator('#salaVolver').innerText()), 'la conexión de Damas tiene un botón «← Volver a Damas»');
  await pg.locator('#salaVolver').click();
  ok(await pg.locator('#winChess:not(.hidden)').count() === 1 && await pg.locator('#winSala.hidden').count() === 1, 'volver lleva de nuevo al juego (Damas), no se queda en la conexión');
  ok(await pg.evaluate(() => document.getElementById('chessFrame').contentWindow.getActiveTab()) === 2, 'y a la pestaña de Damas');
  await pg.evaluate(() => window.openGame('parchis')); await pg.locator('#winParchis [data-conectar]').click(); await pg.waitForSelector('#winSala:not(.hidden)');
  await pg.locator('#salaVolver').click(); ok(await pg.locator('#winParchis:not(.hidden)').count() === 1, 'lo mismo en Parchís');
  await pg.evaluate(() => document.getElementById('btnSala').click()); await pg.waitForSelector('#winSala:not(.hidden)');
  ok(/^← Volver$/.test((await pg.locator('#salaVolver').innerText()).trim()), 'desde el botón Multijugador el botón dice solo «← Volver»');
  await pg.locator('#salaVolver').click(); ok(await pg.locator('#winSala.hidden').count() === 1, 'y vuelve al escritorio');

  // ---------------- ocultar la barra del juego oculta también «Conectar» ----------------
  await pg.evaluate(() => window.openGame('parchis')); await wait(300);
  ok(await pg.locator('#winParchis [data-conectar]').isVisible() && await pg.locator('#winParchis .menuBar').isVisible(), 'con la barra a la vista se ve «🌐 Conectar» en Parchís');
  await pg.locator('#winParchis .wbtn.hidebar').click(); await wait(300);
  ok(!(await pg.locator('#winParchis [data-conectar]').isVisible()) && !(await pg.locator('#winParchis .menuBar').isVisible()), 'al ocultar la barra superior de Parchís desaparece «Conectar» (y su barra vacía)');
  await pg.locator('#winParchis .winReopen').click(); await wait(300);
  ok(await pg.locator('#winParchis [data-conectar]').isVisible(), 'al volver a mostrar la barra reaparece «Conectar»');
  for (const [win, id] of [['bj', 'winBJ'], ['roul', 'winRoul'], ['poker', 'winPoker']]) {
    await pg.evaluate(w => window.openGame(w), win); await wait(200);
    await pg.locator('#' + id + ' .wbtn.hidebar').click(); await wait(250);
    ok(!(await pg.locator('#' + id + ' [data-conectar]').isVisible()), 'en ' + id + ' ocultar la barra superior oculta «Conectar»');
    await pg.locator('#' + id + ' .winReopen').click(); await wait(200);
  }

  // ---------------- versión en créditos ----------------
  await pg.locator('#creditsBtn').evaluate(e => { e.style.display = 'flex'; e.click(); });
  await pg.waitForSelector('#creditsModal.show');
  ok(new RegExp('^v' + ver.replace(/\./g, '\\.')).test((await pg.locator('#creditsVersion').innerText()).trim()), 'los créditos muestran la versión de la app (v' + ver + ')');
  const swTxt = await pg.evaluate(async () => (await (await fetch('sw.js')).text()));
  ok(/VERSION = 'v' \+ self\.APP_VERSION/.test(swTxt), 'y el service worker usa esa misma versión para su caché');
  await pg.evaluate(() => document.getElementById('creditsModal').classList.remove('show'));

  // ---------------- instalar app ----------------
  await pg.evaluate(() => document.querySelectorAll('.win').forEach(w => w.classList.add('hidden')));
  ok(await pg.locator('#btnInstalar').isVisible() && /Instalar app/.test(await pg.locator('#btnInstalar').innerText()), 'si la app no está instalada hay un botón «Instalar app»');
  const sup = await pg.evaluate(() => ({ c: document.getElementById('btnLoadData').getBoundingClientRect().bottom, i: document.getElementById('btnInstalar').getBoundingClientRect().top }));
  ok(sup.i >= sup.c - 0.5, 'y está debajo de «Cargar»');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.locator('#btnInstalar').click(); await pg.waitForSelector('#pwaAyuda');
  ok(/Instalar aplicación|Compartir/.test(await pg.locator('#pwaAyuda').innerText()), 'sin el aviso del navegador, el botón explica cómo instalarla');
  await pg.locator('#pwaAyuda button').click(); ok(await pg.locator('#pwaAyuda').count() === 0, 'la ayuda se cierra');
  await pg.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompt = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
  await pg.locator('#btnInstalar').click(); await wait(200);
  ok(await pg.evaluate(() => window.__prompt === true) && await pg.locator('#pwaAyuda').count() === 0, 'si el navegador lo permite, el botón lanza directamente el diálogo de instalación');
  await ctx.close();
  // instalada (modo standalone): el botón desaparece
  ctx = await env.contexto({ hasTouch: true });
  await ctx.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q); });
  const pi = await env.pagina(ctx, 'instalada'); await wait(400);
  ok(!(await pi.locator('#btnInstalar').isVisible()), 'con la app ya instalada el botón «Instalar app» no aparece');
  await ctx.close();

  // ---------------- pantalla completa ----------------
  ctx = await env.contexto({ hasTouch: true });
  await ctx.addInitScript(() => { window.__fs = 0; Element.prototype.requestFullscreen = function () { window.__fs++; Object.defineProperty(document, 'fullscreenElement', { value: this, configurable: true }); document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
    document.exitFullscreen = function () { Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true }); document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true }); });
  const pf = await env.pagina(ctx, 'fs'); await pf.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  ok(await pf.locator('#fsToggle').isVisible(), 'hay un botón ⛶ de pantalla completa en la barra');
  await pf.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(300);
  ok(await pf.evaluate(() => window.__fs) >= 1, 'con el primer toque la app pide la pantalla completa (oculta la barra de notificaciones)');
  await pf.locator('#fsToggle').click(); await wait(300);
  ok(!(await pf.evaluate(() => !!document.fullscreenElement)) && await pf.evaluate(() => localStorage.getItem('juegitos.pantallaCompleta')) === '0', 'el botón ⛶ sale de la pantalla completa y recuerda que no la quieres');
  const antes = await pf.evaluate(() => window.__fs); await pf.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(300);
  ok(await pf.evaluate(() => window.__fs) === antes, 'mientras la tengas desactivada no la vuelve a pedir');
  await pf.locator('#fsToggle').click(); await wait(300);
  ok(await pf.evaluate(() => !!document.fullscreenElement), 'pulsar ⛶ otra vez la reactiva');
  ok(JSON.parse(fs.readFileSync(path.join(env.root, 'manifest.webmanifest'), 'utf8')).display === 'fullscreen', 'instalada, el manifest pide display «fullscreen»');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

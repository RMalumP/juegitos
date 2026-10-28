// Vibración: respeta el interruptor 📳, vibra con casillas y cartones (no solo botones), la recuerda al recargar, avisa en los modos online y tiene respaldo en iPhone.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9572, 9571);
  const ctx = await env.contexto({ hasTouch: true });
  await ctx.addInitScript(() => { window.__v = []; Object.defineProperty(navigator, 'vibrate', { value: p => { window.__v.push(p); return true; }, configurable: true }); });
  const pg = await env.pagina(ctx, 'vib');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  const calls = async f => { await pg.evaluate(() => { window.__v.length = 0; }); await f(); await wait(150); return pg.evaluate(() => window.__v.length); };
  ok(await pg.evaluate(() => window.Vibra && window.Vibra.activada()), 'la vibración está activada por defecto');
  await pg.locator('#iconBingo').click(); await pg.waitForSelector('.bgTitulo');
  ok(await calls(() => pg.locator('#bingoWrap .bgBtn.menu').first().click()) >= 1, 'pulsar un botón vibra');
  await pg.waitForSelector('.bgTablero');
  ok(await calls(() => pg.locator('.bgT').first().click()) >= 1, 'tocar una casilla del tablero vibra (antes no)');
  await pg.locator('.bgStep .bgBtn', { hasText: '+' }).count();
  await pg.locator('#bingoMenuInicio').click(); await pg.locator('.bgStep .bgBtn', { hasText: '+' }).click(); await pg.locator('#bingoWrap .bgBtn.menu').first().click();
  await pg.waitForSelector('.bgCarton');
  ok(await calls(() => pg.locator('.bgC:not(.vacio)').first().click()) >= 1, 'tocar un número del cartón vibra (antes no)');
  await pg.evaluate(() => window.openGame('roul'));
  ok(await calls(() => pg.locator('#roulNums .roulCell').first().click()) >= 1, 'tocar un número de la ruleta vibra (antes no)');
  ok(await calls(() => pg.evaluate(() => vibrate(40))) === 1, 'las funciones originales de los juegos (vibrate) usan la misma vibración');
  // interruptor desactivado: nada vibra, tampoco los avisos de los modos nuevos
  await pg.locator('#vibToggle').click(); await wait(100);
  ok(!(await pg.evaluate(() => window.Vibra.activada())) && /📴/.test(await pg.locator('#vibToggle').innerText()), 'el interruptor 📴 desactiva la vibración');
  ok(await calls(async () => { await pg.locator('#roulNums .roulCell').first().click(); await pg.evaluate(() => { vibrate(40); window.Vibra.pulso([60, 40, 60]); }); await pg.evaluate(() => window.openGame('bingo')); await pg.locator('#bingoWrap >> text=Sacar bola').click(); }) === 0, 'con el interruptor desactivado no vibra nada (ni el bingo, que antes lo ignoraba)');
  // se acuerda al recargar
  await pg.reload(); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); await wait(300);
  ok(!(await pg.evaluate(() => window.Vibra.activada())), 'tras recargar sigue desactivada (se recuerda)');
  await pg.locator('#vibToggle').click(); await wait(100);
  await pg.reload(); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); await wait(300);
  ok(await pg.evaluate(() => window.Vibra.activada()), 'y al volver a activarla también se recuerda');

  // ---- modos online: avisos que llegan de la red
  const nuevo = async n => { const c = await env.contexto({ hasTouch: true }); await c.addInitScript(() => { window.__v = []; Object.defineProperty(navigator, 'vibrate', { value: p => { window.__v.push(p); return true; }, configurable: true }); }); const g = await env.pagina(c, n); await g.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return g; };
  const H = await nuevo('h'), G = await nuevo('g');
  await H.click('#btnSala'); await H.selectOption('#salaJuegoSel', 'bingo'); await H.fill('#salaNombre', 'Ana'); await H.fill('#salaSala', 'vib sala'); await H.fill('#salaPass', 'clave1'); await H.click('#salaCrear');
  await H.waitForSelector('.bgSala', { timeout: 25000 });
  await G.click('#btnSala'); await G.fill('#salaNombre', 'Beto'); await G.fill('#salaSala', 'vib sala'); await G.fill('#salaPass', 'clave1'); await G.click('#salaUnir');
  await G.waitForSelector('.bgStep', { timeout: 25000 }); await wait(1200);
  await H.click('#bingoWrap >> text=Empezar partida'); await G.waitForSelector('.bgCarton', { timeout: 15000 });
  await G.evaluate(() => { window.__v.length = 0; });
  await H.click('#bingoWrap >> text=Sacar bola');
  await G.waitForFunction(() => window.Sala.estado.bolas && window.Sala.estado.bolas.length === 1, null, { timeout: 8000 });
  await wait(200);
  ok(await G.evaluate(() => window.__v.length) >= 1, 'una bola nueva hace vibrar al jugador (aviso de red, con la vibración activada)');
  await G.evaluate(() => document.getElementById('vibToggle').click()); await wait(100); await G.evaluate(() => { window.__v.length = 0; });
  await H.click('#bingoWrap >> text=Sacar bola');
  await G.waitForFunction(() => window.Sala.estado.bolas.length === 2, null, { timeout: 8000 }); await wait(200);
  ok(await G.evaluate(() => window.__v.length) === 0, 'con el interruptor desactivado, la bola nueva no hace vibrar');

  // ---- respaldo cuando el navegador no tiene vibración (iPhone con Safari)
  const ctx2 = await env.contexto({ hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
  await ctx2.addInitScript(() => { Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true }); window.__h = 0; });
  const P = await env.pagina(ctx2, 'ios'); await P.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await P.evaluate(() => { document.addEventListener('click', e => { if (e.target.closest && e.target.closest('input[switch]')) window.__h++; if (e.target.tagName === 'LABEL') window.__h++; }, true); });
  await P.evaluate(() => window.Vibra.pulso(30)); await wait(100);
  ok(await P.evaluate(() => !!document.querySelector('input[type=checkbox][switch]')) && await P.evaluate(() => window.__h) >= 1, 'sin API de vibración (iPhone) se usa el toque háptico del interruptor nativo de iOS');
  ok(await P.evaluate(() => window.Vibra.soporta()), 'y la app lo da por soportado');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

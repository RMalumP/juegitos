// Regresión: todos los juegos del escritorio (también los anteriores al bingo) se abren sin errores y se pueden cerrar.
const { entorno, wait, ok, fin } = require('./helpers');
const JUEGOS = ['mine', 'ast', 'sud', 'sol', 'carta', 'bj', 'roul', 'poker', 'tetris', 'inv', 'snk', 'pac', 'chess', 'parchis', 'pong', 'frog', 'dice', 'bingo', 'sala'];
(async () => {
  const env = await entorno(9372, 9371);
  const ctx = await env.contexto();
  const pg = await env.pagina(ctx, 'regresion');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  for (const j of JUEGOS) {
    await pg.evaluate(n => window.openGame(n), j);
    await wait(250);
    const vis = await pg.evaluate(n => { const m = { mine: 'Mine', ast: 'Ast', sud: 'Sud', sol: 'Sol', carta: 'Carta', bj: 'BJ', roul: 'Roul', poker: 'Poker', tetris: 'Tetris', inv: 'Inv', snk: 'Snk', pac: 'Pac', chess: 'Chess', parchis: 'Parchis', pong: 'Pong', frog: 'Frog', dice: 'Dice', bingo: 'Bingo', sala: 'Sala' }[n]; const w = document.getElementById('win' + m); return !!w && !w.classList.contains('hidden'); }, j);
    ok(vis, 'se abre «' + j + '»');
    const otros = await pg.evaluate(() => Array.from(document.querySelectorAll('.win')).filter(w => !w.classList.contains('hidden')).length);
    ok(otros === 1, '«' + j + '»: solo hay una ventana visible');
    ok(await pg.evaluate(() => { const w = Array.from(document.querySelectorAll('.win')).find(x => !x.classList.contains('hidden')); return w.getBoundingClientRect().bottom <= document.getElementById('taskbar').getBoundingClientRect().top + 0.5; }), '«' + j + '»: la ventana no tapa la barra de tareas');
  }
  // los chips de la barra de los dos juegos nuevos
  ok(await pg.locator('#chipBingo').count() === 1 && await pg.locator('#chipSala').count() === 1, 'la barra tiene los chips de Bingo y Sala');
  // cerrar con ✕ oculta el chip; el símbolo de la barra sigue
  await pg.evaluate(() => window.openGame('bingo')); await pg.click('#btnCloseBingo');
  ok(await pg.locator('#winBingo.hidden').count() === 1 && await pg.locator('#chipBingo.hidden').count() === 1, 'cerrar el bingo oculta ventana y chip');
  ok(await pg.locator('#trayNet').isVisible(), 'el símbolo de conexión siempre está en la barra');
  await pg.click('#trayNet'); await pg.waitForSelector('#winSala:not(.hidden)');
  ok(true, 'pulsar el símbolo de la barra abre la Sala online');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

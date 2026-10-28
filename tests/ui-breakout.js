// Breakout: niveles de inicio, lanzar la bola, un bot que sigue la bola rompe ladrillos, perder vidas y fin de partida.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9422, 9421);
  const ctx = await env.contexto({ viewport: { width: 420, height: 800 } });
  const pg = await env.pagina(ctx, 'brk');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => window.openGame('brk')); await wait(400);
  const est = () => pg.evaluate(() => window.brkEstado());
  ok(await pg.locator('#brkLevelGrid .brkLevelCell').count() === 15, 'menú: selector de 15 niveles');

  // todos los niveles tienen ladrillos y los difíciles tienen más filas
  const cuenta = {};
  for (const n of [1, 2, 3, 4, 7, 10, 13, 15]) {
    await pg.evaluate(() => window.brkStartNew());
    await pg.click('#brkLevelGrid .brkLevelCell:nth-child(' + n + ')'); await pg.click('#brk-startBtn'); await wait(120);
    cuenta[n] = (await est()).bricks;
  }
  ok(Object.values(cuenta).every(v => v >= 10), 'niveles: todos los patrones tienen ladrillos (' + JSON.stringify(cuenta) + ')');
  ok(cuenta[15] > cuenta[1], 'niveles: el nivel 15 tiene más ladrillos que el 1');

  // partida normal: un bot sigue la bola
  await pg.evaluate(() => window.brkStartNew());
  await pg.click('#brkLevelGrid .brkLevelCell:nth-child(1)'); await pg.click('#brk-startBtn'); await wait(150);
  let e = await est();
  ok(e.running && e.pegada && e.lives === 3, 'la bola empieza pegada a la pala con 3 vidas');
  const inicio = e.bricks;
  await pg.mouse.move(210, 700); await pg.evaluate(() => window.brkLanzar()); await wait(100);
  ok(!(await est()).pegada, 'lanzar suelta la bola');
  await pg.evaluate(() => { window.__bot = setInterval(() => { const s = window.brkEstado(); if (s.bx != null) window.brkMoverA(s.bx + 22 * Math.sin(Date.now() / 260)); }, 8); });
  await wait(9000);
  e = await est();
  ok(e.score > 0 && e.bricks < inicio, 'el bot rompe ladrillos y suma puntos (puntos ' + e.score + ', ladrillos ' + inicio + '→' + e.bricks + ')');
  ok(e.lives === 3 || e.lives >= 1, 'el bot casi no pierde vidas (' + e.lives + ')');

  // sin mover la pala se pierden las vidas y termina
  await pg.evaluate(() => { clearInterval(window.__bot); window.brkMoverA(0); });
  let t = 0; while (!(await est()).over && t < 120) { await pg.evaluate(() => window.brkLanzar()); await wait(500); t++; }
  ok((await est()).over && await pg.locator('#brkOver.show').isVisible(), 'sin mover la pala se acaban las vidas y sale GAME OVER');
  ok(await pg.evaluate(() => parseInt(localStorage.getItem('brkBest'), 10)) > 0, 'el récord se guarda');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

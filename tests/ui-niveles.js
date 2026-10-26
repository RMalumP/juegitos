// Niveles y dificultades de los juegos de arcade: Snake (dificultades), Invaders (15 niveles), Pong, Asteroids, Tetris, Pac-Man y Frogger.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9382, 9381);
  const ctx = await env.contexto();
  const pg = await env.pagina(ctx, 'niveles');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });

  // ---- Snake: 4 dificultades, récord por dificultad
  await pg.evaluate(() => window.openGame('snk')); await wait(300);
  ok(await pg.locator('#snkDiffBar .diffBtn').count() === 4, 'Snake: hay 4 dificultades');
  ok(await pg.locator('#snkDiffBar .diffBtn.active').getAttribute('data-diff') === 'normal', 'Snake: Normal es la dificultad por defecto');
  await pg.click('#snkDiffBar [data-diff=expert]');
  ok(await pg.locator('#snkDiffBar .diffBtn.active').getAttribute('data-diff') === 'expert', 'Snake: se puede elegir Experto');
  ok((await pg.locator('#snkDiffInfo').textContent()).includes('obstáculos'), 'Snake: Experto explica sus obstáculos');
  await pg.click('#snk-startBtn'); await wait(400);
  ok(await pg.locator('#snkStartScreen').evaluate(e => e.style.display) === 'none', 'Snake: arranca la partida en Experto');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

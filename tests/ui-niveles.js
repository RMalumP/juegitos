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
  await pg.screenshot({ path: process.env.SHOTS ? process.env.SHOTS + '/snake.png' : '/dev/null' });

  // ---- Invaders: 15 niveles
  await pg.evaluate(() => window.openGame('inv')); await wait(300);
  ok(await pg.locator('#invLevelGrid .invLevelCell').count() === 15, 'Invaders: el selector tiene 15 niveles');
  await pg.click('#invLevelGrid .invLevelCell:nth-child(15)');
  await pg.click('#inv-startBtn'); await wait(500);
  ok((await pg.locator('#inv-levelEl').textContent()).trim() === '15', 'Invaders: se puede empezar en el nivel 15');
  if (process.env.SHOTS) await pg.screenshot({ path: process.env.SHOTS + '/inv15.png' });

  // ---- Pong: niveles de CPU
  await pg.evaluate(() => window.openGame('pong')); await wait(300);
  ok(await pg.locator('#pongOpts [data-opt=level]').count() === 10, 'Pong: hay 10 niveles de CPU');
  await pg.click('#pongOpts [data-opt=level][data-val="7"]');
  ok(await pg.locator('#pongOpts [data-opt=level].sel').getAttribute('data-val') === '7', 'Pong: se elige el nivel 7');
  await pg.click('#pongOpts [data-val="2p"]');
  ok(!(await pg.locator('#pongLevelRow').isVisible()), 'Pong: en 2 jugadores se oculta el nivel de CPU');
  await pg.click('#pongOpts [data-val="cpu"]');
  if (process.env.SHOTS) await pg.screenshot({ path: process.env.SHOTS + '/pong.png' });
  await pg.click('#pong-startBtn'); await wait(1500);
  ok((await pg.locator('#pongHeader span').first().textContent()).includes('NIVEL 7'), 'Pong: la cabecera muestra el nivel');

  // ---- Asteroids: nivel inicial alto, platillo sin errores
  await pg.evaluate(() => window.openGame('ast')); await wait(300);
  ok(await pg.locator('#astLevelGrid .astLevelCell').count() === 15, 'Asteroids: el selector tiene 15 niveles');
  await pg.click('#astLevelGrid .astLevelCell:nth-child(12)');
  if (process.env.SHOTS) await pg.screenshot({ path: process.env.SHOTS + '/ast.png' });
  await pg.click('#ast-startBtn'); await wait(500);
  ok((await pg.locator('#ast-levelEl').textContent()).trim() === '12', 'Asteroids: empieza en el nivel 12');
  await wait(11000);
  if (process.env.SHOTS) await pg.screenshot({ path: process.env.SHOTS + '/ast-play.png' });

  // ---- Tetris: nivel inicial
  await pg.evaluate(() => window.openGame('tetris')); await wait(300);
  ok(await pg.locator('#tetLevelGrid .tetLevelCell').count() === 15, 'Tetris: el selector tiene 15 niveles');
  await pg.click('#tetLevelGrid .tetLevelCell:nth-child(6)');
  if (process.env.SHOTS) await pg.screenshot({ path: process.env.SHOTS + '/tetris.png' });
  await pg.click('#tet-ov-btn'); await wait(500);
  ok((await pg.locator('#tet-level-el').textContent()).trim() === '6', 'Tetris: empieza en el nivel 6');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

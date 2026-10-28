// 2048: tablero inicial, jugada con el teclado, deshacer, tamaños, deslizar con el ratón/dedo, victoria y récord por tamaño.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9412, 9411);
  const ctx = await env.contexto({ viewport: { width: 420, height: 800 } });
  const pg = await env.pagina(ctx, 'g2048');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => window.openGame('g2048')); await wait(400);
  const est = () => pg.evaluate(() => window.g2048Estado());
  const poner = g => pg.evaluate(g => window.g2048Poner(g), g);
  const valores = () => pg.evaluate(() => Array.from(document.querySelectorAll('#g48Board .g48T')).map(t => +t.dataset.v));

  ok((await valores()).filter(Boolean).length === 2 && (await valores()).length === 16, 'empieza con 2 fichas en un tablero 4×4');
  await poner([[2, 2, 0, 0], [0, 0, 0, 0], [4, 0, 0, 4], [0, 0, 0, 0]]);
  await pg.keyboard.press('ArrowLeft'); await wait(100);
  let e = await est();
  ok(e.score === 12 && e.grid[0][0] === 4 && e.grid[2][0] === 8, 'flecha izquierda: se funden las fichas y suman puntos (12)');
  await pg.click('#g48Undo'); await wait(50);
  e = await est(); ok(e.score === 0 && e.grid[0][0] === 2 && e.grid[0][1] === 2, 'deshacer devuelve la jugada anterior');
  await pg.keyboard.press('KeyD'); await wait(100);
  ok((await est()).grid[0][3] === 4, 'WASD también funciona (D = derecha)');

  // tamaños
  await pg.click('.g48Sz[data-n="6"]'); await wait(100);
  ok((await valores()).length === 36, 'tablero 6×6: 36 casillas');
  await pg.click('.g48Sz[data-n="5"]'); await wait(100);
  ok((await valores()).length === 25, 'tablero 5×5: 25 casillas');
  await pg.click('.g48Sz[data-n="4"]');

  // deslizar con el ratón sobre el tablero
  await poner([[0, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const caja = await pg.locator('#g48BoardWrap').boundingBox();
  const cx = caja.x + caja.width / 2, cy = caja.y + caja.height / 2;
  await pg.mouse.move(cx + 60, cy); await pg.mouse.down(); await pg.mouse.move(cx - 60, cy, { steps: 5 }); await pg.mouse.up(); await wait(100);
  ok((await est()).grid[0][0] === 2, 'deslizar hacia la izquierda mueve las fichas');
  await pg.mouse.move(cx, cy + 60); await pg.mouse.down(); await pg.mouse.move(cx, cy - 10, { steps: 4 }); await pg.mouse.up(); await wait(60);
  ok((await est()).score >= 0, 'un gesto corto no rompe nada');

  // victoria y seguir jugando
  await poner([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 2]]);
  await pg.keyboard.press('ArrowLeft'); await wait(150);
  ok(await pg.locator('#g48Over.show').isVisible() && /2048/.test(await pg.locator('#g48OverT').innerText()), 'al llegar a 2048 sale el aviso de victoria');
  await pg.click('#g48Cont'); await wait(50);
  ok(!(await pg.locator('#g48Over.show').count()), 'se puede seguir jugando tras ganar');

  // récord guardado por tamaño
  ok(await pg.evaluate(() => parseInt(localStorage.getItem('g2048Best_4'), 10)) >= 2048, 'el récord del tablero 4×4 se guarda');
  await pg.click('#g48NewGame'); await wait(100);
  ok(+(await pg.locator('#g48Best').innerText()) >= 2048 && +(await pg.locator('#g48Score').innerText()) === 0, 'nueva partida: puntos a cero y récord conservado');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

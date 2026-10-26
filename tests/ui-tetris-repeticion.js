// Tetris: un toque corto mueve una sola casilla (retardo antes de repetir) y mantener pulsado repite; sin intervalos huérfanos.
const fs = require('fs');
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9384, 9383);
  const ctx = await env.contexto();
  // gancho solo de la prueba: expone la columna de la pieza (u) y la bloquea para que no caiga
  const src = fs.readFileSync(env.root + '/js/games/tetris.js', 'utf8').replace(/\}\)\(\);\s*;?\s*$/, ';window.__u=()=>u;window.__noGrav=()=>{b=1e9};})();');
  await ctx.route(/tetris\.js/, r => r.fulfill({ contentType: 'text/javascript', body: src }));
  const pg = await env.pagina(ctx, 'tetris-rep');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => window.openGame('tetris')); await wait(300);
  await pg.click('#tet-ov-btn'); await wait(300);
  await pg.evaluate(() => window.__noGrav());
  const box = await pg.locator('#tet-b-right').boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const col = () => pg.evaluate(() => window.__u());

  let u0 = await col();
  await pg.mouse.move(x, y); await pg.mouse.down(); await wait(120); await pg.mouse.up(); await wait(300);
  ok(await col() - u0 === 1, 'un toque de 120 ms en el botón mueve 1 casilla');

  u0 = await col();
  await pg.mouse.move(x, y); await pg.mouse.down(); await wait(500); await pg.mouse.up();
  const u1 = await col(); await wait(400);
  ok(u1 - u0 >= 2, 'mantener pulsado repite el movimiento');
  ok(await col() === u1, 'al soltar la pieza se para en el acto');

  // teclado: toque corto = 1 casilla
  u0 = await col();
  await pg.keyboard.down('ArrowLeft'); await wait(100); await pg.keyboard.up('ArrowLeft'); await wait(300);
  ok(u0 - await col() === 1, 'un toque de 100 ms de la flecha mueve 1 casilla');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

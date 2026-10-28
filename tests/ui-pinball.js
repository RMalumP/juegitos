// Pinball: lanzador con muelle, flippers con teclado y con las mitades de la pantalla, bumpers/dianas que puntúan, 3 bolas, récord y pausa.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9392, 9391);
  const ctx = await env.contexto();
  const pg = await env.pagina(ctx, 'pinball');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => window.openGame('pin'));
  await pg.waitForFunction(() => typeof window.pinEstado === 'function');
  await wait(200);
  ok(await pg.locator('#pinStart').isVisible(), 'sale la pantalla de inicio');
  await pg.click('#pin-startBtn'); await wait(300);
  let e = await pg.evaluate(() => window.pinEstado());
  ok(e.running && e.hayBola && e.enCarril && e.bola === 1, 'empieza con la bola 1 en el lanzador');
  // flippers con teclado
  await pg.keyboard.down('KeyZ'); await wait(150);
  e = await pg.evaluate(() => window.pinEstado());
  ok(e.flipL < 0, 'Z sube el flipper izquierdo (' + e.flipL.toFixed(2) + ')');
  await pg.keyboard.up('KeyZ'); await pg.keyboard.down('ArrowRight'); await wait(150);
  e = await pg.evaluate(() => window.pinEstado());
  ok(e.flipL > 0.4 && e.flipR > Math.PI, 'al soltar baja el izquierdo y → sube el derecho');
  await pg.keyboard.up('ArrowRight'); await wait(150);
  // lanzador: mantener espacio carga el muelle
  await pg.keyboard.down('Space'); await wait(900);
  e = await pg.evaluate(() => window.pinEstado());
  ok(e.carga > 0.8, 'mantener Espacio carga el muelle (' + e.carga.toFixed(2) + ')');
  await pg.keyboard.up('Space');
  await pg.waitForFunction(() => window.pinEstado().enCarril === false, null, { timeout: 4000 }).catch(() => {});
  e = await pg.evaluate(() => window.pinEstado());
  ok(e.enCarril === false, 'al soltar, la bola sale del carril a la mesa');
  // táctil: mitades de la pantalla
  const box = await pg.locator('#pinC').boundingBox();
  await pg.evaluate(() => window.pinColocar(166, 200, 0, 0));
  await pg.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8); await pg.mouse.down(); await wait(150);
  e = await pg.evaluate(() => window.pinEstado());
  ok(e.flipL < 0 && e.flipR < Math.PI, 'tocar la mitad izquierda sube solo el flipper izquierdo');
  await pg.mouse.up(); await pg.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8); await pg.mouse.down(); await wait(150);
  e = await pg.evaluate(() => window.pinEstado());
  ok(e.flipR > Math.PI && e.flipL > 0.4, 'tocar la mitad derecha sube solo el flipper derecho');
  await pg.mouse.up();
  // bumper y dianas puntúan
  let s0 = (await pg.evaluate(() => window.pinEstado())).score;
  await pg.evaluate(() => window.pinColocar(188, 222, 0, -6)); await wait(200);
  ok((await pg.evaluate(() => window.pinEstado())).score > s0, 'chocar con un bumper suma puntos');
  await pg.evaluate(() => window.pinColocar(290, 305, 12, 0)); await wait(200);
  ok((await pg.evaluate(() => window.pinEstado())).dianas >= 1, 'golpear una diana la tumba');
  // la rampa morada lleva la bola y la suelta junto al flipper izquierdo
  s0 = (await pg.evaluate(() => window.pinEstado())).score;
  await pg.evaluate(() => window.pinColocar(126, 270, -2, -9)); await wait(100);
  ok((await pg.evaluate(() => window.pinEstado())).rampa === 'rampa', 'la bola sube por la rampa');
  await pg.waitForFunction(() => !window.pinEstado().rampa, null, { timeout: 4000 }).catch(() => {});
  e = await pg.evaluate(() => window.pinEstado());
  ok(e.score >= s0 + 1500 && e.bx > 33 && e.bx < 57 && e.by > 400, 'la rampa suma puntos y deja la bola en el carril izquierdo');
  // la órbita roja la sube por la derecha hasta los carriles de arriba
  await pg.evaluate(() => window.pinColocar(300, 280, 0, -10)); await wait(100);
  ok((await pg.evaluate(() => window.pinEstado())).rampa === 'orbita', 'la bola entra en la órbita roja');
  await pg.waitForFunction(() => !window.pinEstado().rampa, null, { timeout: 4000 }).catch(() => {});
  await wait(300);
  ok((await pg.evaluate(() => window.pinEstado())).carriles.some(Boolean), 'la órbita deja la bola en los carriles de arriba y enciende uno');
  // misiones: la primera es encender los 3 carriles; el panel la muestra
  ok((await pg.locator('#pinMision').textContent()).startsWith('Misión'), 'el panel muestra la misión actual');
  const m0 = (await pg.evaluate(() => window.pinEstado())).misiones;
  for (const x of [153, 183, 213]) { await pg.evaluate(x => window.pinColocar(x, 50, 0, 3), x); await wait(150); }
  ok((await pg.evaluate(() => window.pinEstado())).misiones > m0 || (await pg.evaluate(() => window.pinEstado())).mult > 1, 'encender los 3 carriles cumple la misión y sube el multiplicador');
  // un flipper golpea la bola hacia arriba
  await pg.evaluate(() => window.pinColocar(135, 528, 0, 0)); await wait(30);
  await pg.keyboard.down('KeyZ'); await wait(120);
  e = await pg.evaluate(() => window.pinEstado());
  ok(e.vy < -6, 'el flipper lanza la bola hacia arriba (vy ' + (e.vy || 0).toFixed(1) + ')');
  await pg.keyboard.up('KeyZ');
  // pausa
  await pg.evaluate(() => window.pausePin()); const t0 = (await pg.evaluate(() => window.pinEstado())).tick; await wait(300);
  e = await pg.evaluate(() => window.pinEstado());
  ok(e.paused && e.tick === t0, 'en pausa el juego se detiene');
  await pg.keyboard.press('Space'); await wait(200);
  ok(!(await pg.evaluate(() => window.pinEstado())).paused, 'Espacio reanuda');
  // perder las 3 bolas
  for (let i = 0; i < 3; i++) {
    await pg.waitForFunction(() => window.pinEstado().hayBola, null, { timeout: 5000 });
    await pg.evaluate(() => window.pinColocar(166, 590, 0, 8)); await wait(300);
  }
  await pg.waitForFunction(() => window.pinEstado().over, null, { timeout: 3000 }).catch(() => {});
  e = await pg.evaluate(() => window.pinEstado());
  ok(e.over && await pg.locator('#pinOver').isVisible(), 'tras 3 bolas perdidas sale GAME OVER');
  ok(Number(await pg.evaluate(() => localStorage.getItem('record:pinball'))) === e.score && e.score > 0, 'se guarda el récord (' + e.score + ')');
  // sin scroll horizontal en móvil
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sin scroll horizontal en móvil');
  await pg.screenshot({ path: process.env.CAPTURA || '/dev/null' }).catch(() => {});
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

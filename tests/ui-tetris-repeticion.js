// Tetris: control unificado. Toque corto = 1 casilla, DAS/ARR, última dirección, soltar = para, caída fuerte, guardar, lock delay,
// pausa que libera entradas, gestos táctiles (solo con control táctil) y opciones escritorio/móvil.
const { entorno, wait, ok, fin } = require('./helpers');

const est = pg => pg.evaluate(() => window.tetEstado());
async function nueva(pg) {
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => window.openGame('tetris')); await wait(300);
  await pg.click('#tet-ov-btn'); await wait(250);
  await pg.evaluate(() => window.tetCongelar(true));       // sin gravedad: solo se mide el movimiento lateral
}
// gesto con Pointer Events sintéticos (los toques reales de Playwright no arrastran)
async function gesto(pg, pasos, ms = 20) {
  await pg.evaluate(async ({ pasos, ms }) => {
    const cv = document.getElementById('tet-bc'), r = cv.getBoundingClientRect();
    const ev = (tipo, x, y, id = 1) => cv.dispatchEvent(new PointerEvent(tipo, { pointerId: id, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true, isPrimary: id === 1 }));
    for (const p of pasos) { ev(p[0], p[1], p[2], p[3] || 1); await new Promise(f => setTimeout(f, ms)); }
  }, { pasos, ms });
}

(async () => {
  const env = await entorno(9384, 9383);

  // ================= ESCRITORIO (teclado; control táctil off; botones plegados) =================
  const cPC = await env.contexto({ hasTouch: false, isMobile: false, viewport: { width: 900, height: 760 } });
  const pc = await env.pagina(cPC, 'tetris-pc');
  ok(await pc.evaluate(() => window.Opciones.tactil()) === false, 'escritorio: el control táctil está desactivado por defecto');
  ok(await pc.evaluate(() => window.Opciones.detectado()) === false, 'escritorio: se detecta un ordenador');
  await nueva(pc);
  ok(await pc.locator('#tetDpad.ctHidden').count() === 1 && await pc.locator('#tetDrop.ctHidden').count() === 1, 'escritorio: los botones en pantalla están plegados (no eliminados)');
  ok(await pc.locator('#tet-b-left').count() === 1, 'escritorio: los botones siguen en el DOM');

  let s0 = await est(pc);
  await pc.keyboard.down('ArrowRight'); await wait(100); await pc.keyboard.up('ArrowRight'); await wait(300);
  ok((await est(pc)).x - s0.x === 1, 'teclado: un toque de 100 ms mueve 1 casilla');
  await pc.keyboard.press('ArrowLeft'); await wait(150);
  s0 = await est(pc);
  await pc.keyboard.down('ArrowLeft'); await wait(700);
  const durante = await est(pc);
  ok(s0.x - durante.x >= 3, 'teclado: mantener pulsado repite el movimiento (DAS + ARR)');
  await pc.keyboard.up('ArrowLeft'); const alSoltar = await est(pc); await wait(400);
  ok((await est(pc)).x === alSoltar.x, 'teclado: al soltar la pieza se para en el acto');

  // última dirección pulsada manda
  await pc.keyboard.press('ArrowRight'); await wait(50);
  s0 = await est(pc);
  await pc.keyboard.down('ArrowLeft'); await wait(40); await pc.keyboard.down('ArrowRight'); await wait(500);
  ok((await est(pc)).x >= s0.x, 'teclado: con izquierda y derecha pulsadas gana la última (derecha)');
  await pc.keyboard.up('ArrowLeft'); await pc.keyboard.up('ArrowRight');

  // rotar y rotar al revés
  s0 = await est(pc);
  await pc.keyboard.press('ArrowUp'); await wait(100);
  const rcw = await est(pc);
  await pc.keyboard.press('KeyZ'); await wait(100);
  const rccw = await est(pc);
  ok(s0.t === 1 || (rcw.r === (s0.r + 1) % 4 && rccw.r === s0.r), 'teclado: ↑ gira horario y Z antihorario (SRS)');
  for (let i = 0; i < 4; i++) { await pc.keyboard.press('ArrowUp'); await wait(40); }
  const dentro = await est(pc);
  ok(dentro.x >= -1 && dentro.x <= 8, 'teclado: girar no saca la pieza del tablero');

  // guardar (una vez por pieza)
  const h0 = await est(pc);
  await pc.keyboard.press('KeyC'); await wait(100);
  const h1 = await est(pc);
  await pc.keyboard.press('KeyC'); await wait(100);
  const h2 = await est(pc);
  ok(h1.t !== undefined && h2.t === h1.t, 'teclado: guardar solo funciona una vez por pieza');

  // caída fuerte
  const antes = await est(pc);
  await pc.keyboard.press('Space'); await wait(150);
  const desp = await est(pc);
  ok(desp.score > antes.score && desp.y <= 0, 'teclado: la caída fuerte da puntos y aparece pieza nueva');

  // lock delay: una pieza apoyada aún se puede deslizar antes de fijarse
  await pc.evaluate(() => window.tetCongelar(false));
  await pc.keyboard.down('ArrowDown');
  let g = null; for (let i = 0; i < 160 && !g; i++) { const e = await est(pc); if (e.grounded) g = e; else await wait(30); }
  await pc.keyboard.up('ArrowDown');
  ok(!!g, 'lock delay: la pieza llega al suelo');
  if (g) {
    await wait(200);
    const e1 = await est(pc);
    ok(e1.playing && e1.y === g.y && e1.t === g.t, 'lock delay: apoyada, la pieza sigue ahí tras 200 ms');
    await pc.keyboard.press('ArrowLeft'); await wait(60);
    const e2 = await est(pc);
    ok(e2.t === g.t && e2.x === g.x - 1, 'lock delay: aún se puede deslizar apoyada');
    let fijada = false;                                  // al deslizar puede quedar sobre un hueco y caer antes de fijarse
    for (let i = 0; i < 70 && !fijada; i++) { await wait(100); fijada = (await est(pc)).y <= 0; }
    ok(fijada, 'lock delay: pasado el tiempo se fija y aparece otra pieza');
  }

  // pausa libera las entradas
  await pc.evaluate(() => window.tetCongelar(true));
  s0 = await est(pc);
  await pc.keyboard.down('ArrowRight'); await wait(60);
  await pc.evaluate(() => window.pauseTetris()); await pc.keyboard.up('ArrowRight');
  await pc.click('#tet-ov-btn'); await wait(120);
  const trasPausa = await est(pc); await wait(500);
  ok((await est(pc)).x === trasPausa.x, 'pausa: tras pausar y reanudar la pieza no sigue moviéndose sola');

  // DAS configurable: con 400 ms de retardo, 300 ms pulsado = 1 casilla
  await pc.evaluate(() => window.Opciones.set('das', 400));
  await pc.keyboard.press('ArrowLeft'); await wait(100);
  s0 = await est(pc);
  await pc.keyboard.down('ArrowRight'); await wait(300); await pc.keyboard.up('ArrowRight'); await wait(100);
  ok((await est(pc)).x - s0.x === 1, 'opciones: un DAS de 400 ms evita la repetición en una pulsación de 300 ms');
  await pc.evaluate(() => window.Opciones.set('das', 160));

  // en escritorio los gestos no hacen nada (control táctil off)
  s0 = await est(pc);
  await gesto(pc, [['pointerdown', 100, 200], ['pointerup', 100, 200]]); await wait(100);
  ok((await est(pc)).r === s0.r, 'escritorio: un toque en el tablero no gira (gestos desactivados)');

  // interruptor en Opciones: activarlo habilita gestos y despliega los botones
  await pc.click('#optToggle'); await pc.waitForSelector('#optModal.show');
  await pc.click('#optModal .optRadio[data-v="si"]'); await pc.click('#optClose');
  ok(await pc.evaluate(() => window.Opciones.tactil()), 'opciones: «Activado» enciende el control táctil');
  ok(await pc.locator('#tetDpad.ctHidden').count() === 0, 'opciones: «Activado» despliega los botones en pantalla');
  s0 = await est(pc);
  await gesto(pc, [['pointerdown', 100, 200], ['pointerup', 100, 200]]); await wait(100);
  const girado = await est(pc);
  ok(s0.t === 1 || girado.r === (s0.r + 1) % 4, 'opciones: con el control táctil activo, tocar el tablero gira');
  await pc.click('#optToggle'); await pc.click('#optModal .optRadio[data-v="no"]'); await pc.click('#optClose');
  ok(await pc.locator('#tetDpad.ctHidden').count() === 1, 'opciones: «Desactivado» vuelve a plegar los botones');
  await pc.reload(); await wait(300);
  ok(await pc.evaluate(() => window.Opciones.get('tactil')) === 'no', 'opciones: el ajuste se recuerda al recargar');

  // ================= MÓVIL (táctil por defecto; botones desplegados; gestos) =================
  const cMov = await env.contexto({ isMobile: true, hasTouch: true, viewport: { width: 400, height: 760 } });
  const mv = await env.pagina(cMov, 'tetris-movil');
  ok(await mv.evaluate(() => window.Opciones.tactil()) === true, 'móvil: el control táctil está activo por defecto');
  await nueva(mv);
  ok(await mv.locator('#tetDpad.ctHidden').count() === 0, 'móvil: los botones en pantalla están desplegados');

  const box = await mv.locator('#tet-b-right').boundingBox();
  const bx = box.x + box.width / 2, by = box.y + box.height / 2;
  s0 = await est(mv);
  await mv.mouse.move(bx, by); await mv.mouse.down(); await wait(120); await mv.mouse.up(); await wait(300);
  ok((await est(mv)).x - s0.x === 1, 'móvil: un toque de 120 ms en el botón mueve 1 casilla');
  s0 = await est(mv);
  await mv.mouse.move(bx, by); await mv.mouse.down(); await wait(600); await mv.mouse.up();
  const sb = await est(mv); await wait(400);
  ok(sb.x - s0.x >= 2 && (await est(mv)).x === sb.x, 'móvil: mantener el botón repite y al soltar se para en el acto');

  const cel = await mv.evaluate(() => document.getElementById('tet-bc').getBoundingClientRect().width / 10);
  await gesto(mv, [['pointerdown', 200, 100], ['pointermove', 200 - cel * 2, 100], ['pointermove', 200 - cel * 4, 100], ['pointermove', 200 - cel * 6, 100], ['pointerup', 200 - cel * 6, 100]], 10);   // centrar la pieza
  s0 = await est(mv);
  await gesto(mv, [['pointerdown', 40, 100], ['pointermove', 40 + cel * 1.0, 100], ['pointermove', 40 + cel * 2.0, 100], ['pointermove', 40 + cel * 3.0, 100], ['pointerup', 40 + cel * 3.0, 100]], 15);
  const arr = await est(mv);
  ok(arr.x - s0.x >= 2 && arr.x - s0.x <= 4, 'móvil: arrastrar 3 casillas mueve ≈3 casillas');
  s0 = await est(mv);
  await gesto(mv, [['pointerdown', 100, 200], ['pointerup', 100, 200]], 20); await wait(80);
  const tap = await est(mv);
  ok(s0.t === 1 || tap.r === (s0.r + 1) % 4, 'móvil: tocar el tablero gira la pieza');
  s0 = await est(mv);
  await gesto(mv, [['pointerdown', 100, 100], ['pointermove', 100, 100 + cel * 2], ['pointermove', 100, 100 + cel * 4], ['pointermove', 100, 100 + cel * 6], ['pointerup', 100, 100 + cel * 6]], 25);
  await wait(150);
  const drop = await est(mv);
  ok(drop.score > s0.score && drop.y <= 0, 'móvil: deslizar rápido hacia abajo = caída fuerte');
  s0 = await est(mv);
  await gesto(mv, [['pointerdown', 100, 300], ['pointermove', 100, 300 - cel * 2], ['pointermove', 100, 300 - cel * 4], ['pointerup', 100, 300 - cel * 4]], 25);
  await wait(120);
  const hold = await est(mv);
  ok(hold.t !== undefined, 'móvil: deslizar rápido hacia arriba no rompe la partida (guardar)');
  s0 = await est(mv);
  await gesto(mv, [['pointerdown', 60, 200, 1], ['pointerdown', 140, 200, 2]], 20); await wait(80);
  const dos = await est(mv);
  ok(s0.t === 1 || dos.r === (s0.r + 3) % 4, 'móvil: dos dedos giran en sentido contrario');
  await gesto(mv, [['pointerup', 60, 200, 1], ['pointerup', 140, 200, 2]], 10);

  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

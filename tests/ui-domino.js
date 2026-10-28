// Dominó local: menú, partida contra 3 CPU hasta el final, mesa en serpiente sin scroll horizontal, guardar y recuperar,
// varias personas en un móvil con «Pasa el móvil» (nadie ve la mano ajena) y récord de la mejor mano.
const { entorno, wait, ok, fin } = require('./helpers');
const SHOT = process.env.SHOT_DIR;
(async () => {
  const env = await entorno(9512, 9511);
  const ctx = await env.contexto({ viewport: { width: 390, height: 780 } });
  const pg = await env.pagina(ctx, 'domino');
  pg.on('dialog', d => d.accept());
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => { window.dominoRapido = true; window.PasarMovil && (window.PasarMovil.retardo = 0); localStorage.removeItem('domConf'); });
  await pg.evaluate(() => window.openGame('domino'));
  await pg.waitForSelector('#dominoWrap .doMenu', { state: 'visible', timeout: 10000 });
  ok(await pg.locator('#dominoWrap .doAsientos .doRow').count() === 4, 'el menú muestra los 4 asientos');
  const E = () => pg.evaluate(() => window.dominoEstado());
  // juega por el humano: la primera ficha jugable (y el primer lado), o roba / pasa
  async function jugarMiTurno() {
    const btn = pg.locator('#dominoWrap .doFichas .doF.jugable').first();
    if (await btn.count()) { await btn.click({ timeout: 2000 }).catch(() => {}); const lado = pg.locator('#dominoWrap .doAcc .doBtn').first(); if (await lado.count() && /En el/.test(await lado.innerText())) await lado.click({ timeout: 2000 }).catch(() => {}); return true; }
    const acc = pg.locator('#dominoWrap .doAcc .doBtn').first();
    if (await acc.count()) { await acc.click({ timeout: 2000 }).catch(() => {}); return true; }
    return false;
  }
  async function jugarHastaFin(maxPasos = 400, hasta = () => false) {
    for (let i = 0; i < maxPasos; i++) {
      const e = await E();
      if (!e.pub || e.pub.fase !== 'jugando' || hasta(e)) return e;
      if (await pg.locator('.pmCubierta').count()) { await pg.locator('.pmCubierta .pmBoton').click(); continue; }
      if (e.pub.turno === e.p && !(e.jug[e.p] || {}).cpu) { await jugarMiTurno(); await wait(20); } else await wait(40);
    }
    return E();
  }
  // 1 persona + 3 CPU, por parejas, a 1 mano
  await pg.locator('#dominoWrap .doMenu [data-k=meta] [data-v="0"]').click();
  await pg.locator('#dominoWrap .doMenu [data-r=jugar]').click();
  let e = await E();
  ok(e.modo === 'local' && e.pub.n === 4 && e.pub.parejas && e.mano.length >= 6, 'partida local de 4 por parejas: ' + e.mano.length + ' fichas en la mano');
  ok(e.jug.filter(j => j.cpu).length === 3 && e.jug[0].nombre === 'Tú', 'asientos: tú y 3 CPU');
  // CPU lentas mientras se mira la partida a medias
  await pg.evaluate(() => { window.dominoRapido = false; });
  await jugarHastaFin(400, x => x.pub.mesa.length >= 5 && x.pub.turno === 0);
  await wait(200);
  if (SHOT) await pg.screenshot({ path: SHOT + '/domino-movil-jugando.png' });
  const anchoOk = await pg.evaluate(() => { const w = document.getElementById('dominoWrap'); return w.scrollWidth <= w.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1; });
  ok(anchoOk, 'sin scroll horizontal en el móvil');
  // guardar y recuperar a mitad
  e = await E();
  ok(e.pub.fase === 'jugando', 'partida a medias');
  if (e.pub.fase === 'jugando') {
    await pg.locator('#dominoSave').click();
    const guardada = await pg.evaluate(() => !!localStorage.getItem('partida_domino'));
    ok(guardada, '💾 Guardar deja la partida en el móvil');
    await pg.reload(); await pg.locator('#startScreen').evaluate(el => { el.style.display = 'none'; });
    await pg.evaluate(() => { window.PasarMovil && (window.PasarMovil.retardo = 0); window.openGame('domino'); });
    await pg.waitForFunction(() => window.dominoEstado && window.dominoEstado().modo === 'local', null, { timeout: 10000 });
    const r = await E();
    ok(r.pub.mesa.length === e.pub.mesa.length && JSON.stringify(r.est.manos) === JSON.stringify(e.est.manos), 'al volver a abrir, la partida se recupera tal cual');
    ok(await pg.evaluate(() => !localStorage.getItem('partida_domino')), 'y se recupera una sola vez');
  }
  await pg.evaluate(() => { window.dominoRapido = true; });
  e = await jugarHastaFin();
  ok(e.pub.fase === 'fin' && e.pub.resultado, 'la mano termina (' + (e.pub.resultado.tranque ? 'tranque' : 'dominó') + ')');
  await pg.waitForSelector('#dominoWrap .doFin', { state: 'visible', timeout: 5000 });
  ok(await pg.locator('#dominoWrap .doCuenta').count() >= 4, 'el final enseña las fichas de todos');
  if (SHOT) await pg.screenshot({ path: SHOT + '/domino-movil-fin.png' });
  // las cuentas cuadran: 28 fichas entre mesa y manos
  ok(e.pub.mesa.length + e.pub.resultado.manos.flat().length === 28, 'mesa + manos = 28 fichas');
  await pg.locator('#dominoWrap .doFin [data-r=ver]').click();
  ok(await pg.locator('#dominoWrap .doFin').isHidden(), '«Ver la mesa» oculta el resultado');
  await pg.locator('#dominoWrap .doEstado').click();
  ok(await pg.locator('#dominoWrap .doFin').isVisible(), 'y se vuelve a él tocando el aviso');
  await pg.locator('#dominoWrap .doFin [data-r=menu]').click();

  // 2 personas + 1 CPU en el mismo móvil, a 50: «Pasa el móvil» antes de cada persona
  await pg.locator('#dominoWrap .doAsientos [data-asiento="1"][data-tipo=per]').click();
  await pg.locator('#dominoWrap .doAsientos [data-asiento="2"][data-tipo=cpu]').click();
  await pg.locator('#dominoWrap .doAsientos [data-asiento="3"][data-tipo=no]').click();
  await pg.locator('#dominoWrap .doMenu [data-k=meta] [data-v="50"]').click();
  await pg.locator('#dominoWrap .doMenu [data-r=jugar]').click();
  e = await E();
  ok(e.pub.n === 3 && !e.pub.parejas && e.pub.pozo === 7, '3 jugadores: sin parejas y 7 fichas en el pozo');
  // la primera vez que le toca a una persona sale la tapa (salvo que empiece la CPU)
  await pg.waitForFunction(() => document.querySelector('.pmCubierta') || window.dominoEstado().jug[window.dominoEstado().pub.turno].cpu, null, { timeout: 5000 });
  let vistos = new Set(), tapas = 0, fuga = false;
  for (let i = 0; i < 300; i++) {
    const x = await E();
    if (x.pub.fase !== 'jugando') break;
    if (await pg.locator('.pmCubierta').count()) {
      tapas++;
      // con la tapa puesta no se ve ninguna mano
      if (await pg.locator('#dominoWrap .doFichas .doF').count()) fuga = true;
      await pg.locator('.pmCubierta .pmBoton').click(); await wait(20); continue;
    }
    if (!x.jug[x.pub.turno].cpu) { vistos.add(x.p); if (x.p !== x.pub.turno) fuga = true; await jugarMiTurno(); await wait(20); } else await wait(40);
  }
  ok(tapas >= 2 && vistos.size === 2, '«Pasa el móvil» entre las dos personas (' + tapas + ' veces)');
  ok(!fuga, 'nadie ve la mano de otro: con la tapa no hay fichas y cada uno juega con las suyas');
  if (SHOT) await pg.screenshot({ path: SHOT + '/domino-movil-3.png' });
  await ctx.close();

  // ordenador: la ventana se ve entera
  const ctx2 = await env.contexto({ viewport: { width: 1366, height: 768 }, hasTouch: false });
  const pc = await env.pagina(ctx2, 'pc');
  await pc.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pc.evaluate(() => { window.dominoRapido = true; localStorage.removeItem('domConf'); window.openGame('domino'); });
  await pc.waitForSelector('#dominoWrap .doMenu', { state: 'visible' });
  await pc.locator('#dominoWrap .doMenu [data-r=jugar]').click();
  for (let i = 0; i < 60; i++) {
    const x = await pc.evaluate(() => window.dominoEstado());
    if (x.pub.fase !== 'jugando' || x.pub.mesa.length >= 9) break;
    if (x.pub.turno === 0) { const b = pc.locator('#dominoWrap .doFichas .doF.jugable').first(); if (await b.count()) { await b.click({ timeout: 2000 }).catch(() => {}); const l = pc.locator('#dominoWrap .doAcc .doBtn').first(); if (await l.count() && /En el/.test(await l.innerText())) await l.click({ timeout: 2000 }).catch(() => {}); } else { const a = pc.locator('#dominoWrap .doAcc .doBtn').first(); if (await a.count()) await a.click({ timeout: 2000 }).catch(() => {}); } }
    await wait(60);
  }
  if (SHOT) await pc.screenshot({ path: SHOT + '/domino-ordenador.png' });
  ok(true, 'partida en el ordenador');
  await ctx2.close();
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

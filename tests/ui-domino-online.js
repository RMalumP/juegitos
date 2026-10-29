// Dominó ONLINE: sala de 2 personas + 2 CPU (por parejas), cada uno ve solo su mano, jugadas fuera de turno o con fichas ajenas ignoradas,
// la CPU juega en el móvil del anfitrión, recarga del invitado (recupera su mano), final de la mano y vuelta al lobby. Después, 3 personas sin CPU.
const { entorno, wait, ok, fin } = require('./helpers');
const SHOT = process.env.SHOT_DIR;
const W = '#dominoWrap', LB = '#winDomino .olLobby[data-j=domino]';
(async () => {
  const env = await entorno(9522, 9521);
  const nuevo = async n => { const ctx = await env.contexto({ viewport: { width: 390, height: 780 } }); const pg = await env.pagina(ctx, n); pg.on('dialog', d => d.accept()); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); await pg.evaluate(() => { window.dominoRapido = true; }); return pg; };
  const sala = async (pg, modo, nombre, nom) => {
    await pg.evaluate(() => window.openGame('domino')); await wait(400);
    await pg.locator('#winDomino [data-conectar]').click();
    await pg.fill('#salaNombre', nombre); await pg.fill('#salaSala', nom); await pg.fill('#salaPass', 'clave1');
    await pg.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await pg.waitForSelector(LB, { state: 'visible', timeout: 25000 });
  };
  const E = pg => pg.evaluate(() => window.dominoEstado());
  async function turnoHumano(pg) {
    const b = pg.locator(W + ' .doFichas .doF.jugable').first();
    if (await b.count()) { await b.click({ timeout: 2000 }).catch(() => {}); const l = pg.locator(W + ' .doAcc .doBtn').first(); if (await l.count() && /En el/.test(await l.innerText())) await l.click({ timeout: 2000 }).catch(() => {}); return; }
    const a = pg.locator(W + ' .doAcc .doBtn').first(); if (await a.count()) await a.click({ timeout: 2000 }).catch(() => {});
  }
  async function jugar(pgs, hasta, max = 600) {
    for (let i = 0; i < max; i++) {
      const e = await E(pgs[0]);
      if (!e.pub || e.pub.fase !== 'jugando' || (hasta && hasta(e))) return e;
      for (const pg of pgs) { const x = await E(pg); if (x.pub && x.pub.fase === 'jugando' && x.pub.turno === x.p) await turnoHumano(pg); }
      await wait(60);
    }
    return E(pgs[0]);
  }

  const H = await nuevo('host'), G = await nuevo('inv');
  await sala(H, 'crear', 'Anfi', 'domino uno'); await sala(G, 'unir', 'Invi', 'domino uno');
  // opciones: 2 CPU, por parejas, las 2 personas en la misma pareja, 1 mano
  const opcion = async (pg, fila, txt) => { await pg.locator(LB + ' .olOp', { hasText: fila }).locator('button', { hasText: txt }).first().click(); await wait(300); };
  await H.waitForFunction(sel => { const b = document.querySelector(sel + ' .olGrande'); return b && !b.disabled; }, LB, { timeout: 15000 });
  await opcion(H, 'CPU:', '2'); await opcion(H, 'Partida:', '1 mano'); await opcion(H, 'Por parejas:', 'Sí'); await opcion(H, 'Las 2 personas:', 'misma pareja');
  ok(/2 personas \+ 2 CPU/.test(await G.locator(LB).innerText()), 'el invitado ve las opciones: 2 personas + 2 CPU');
  if (SHOT) await H.screenshot({ path: SHOT + '/domino-lobby.png' });
  await H.locator(LB + ' .olGrande').click();
  await H.waitForFunction(() => window.dominoEstado().modo === 'online' && window.dominoEstado().mano.length === 7, null, { timeout: 15000 });
  await G.waitForFunction(() => window.dominoEstado().modo === 'online' && window.dominoEstado().mano.length === 7, null, { timeout: 15000 });
  let h = await E(H), g = await E(G);
  ok(h.pub.n === 4 && h.pub.parejas && h.jug.filter(j => j.cpu).length === 2, 'mesa de 4 por parejas con 2 CPU');
  ok(h.p === 0 && g.p === 2, 'las dos personas son pareja (asientos 1 y 3)');
  ok(JSON.stringify(h.mano) !== JSON.stringify(g.mano), 'cada uno tiene su mano');
  const fuga = await G.evaluate(() => JSON.stringify(window.Sala.estado));
  ok(!/"manos"/.test(fuga) && !/"pt"/.test(fuga), 'el estado público no lleva las manos');
  ok(/pareja con Invi/.test(await H.locator('#winDomino .olBarra').innerText()), 'la barra dice quién es tu pareja');

  // jugada de un invitado fuera de turno, o con una ficha que no es suya: se ignora
  h = await E(H);
  if (h.pub.turno !== 2) {
    const nj = h.pub.nj;
    await G.evaluate(f => window.Sala.enviar('host', { tipo: 'accion', a: 'jugar', f, lado: 'd' }), g.mano[0]);
    await wait(600);
    ok((await E(H)).pub.nj === nj || (await E(H)).pub.ultimo.p !== 2, 'una jugada fuera de turno se ignora');
  } else ok(true, 'empieza el invitado (sin prueba fuera de turno)');
  await G.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'siguiente' })); await wait(300);
  ok((await E(H)).pub.mano === 1, 'un invitado no puede repartir la mano siguiente');

  // a medias, el invitado recarga: recupera su mano
  await jugar([H, G], e => e.pub.mesa.length >= 6);
  if (SHOT) await G.screenshot({ path: SHOT + '/domino-online-invitado.png' });
  g = await E(G);
  ok(g.pub.mesa.length >= 1 && g.mano.length >= 1, 'la partida avanza (las CPU juegan solas): ' + g.pub.mesa.length + ' fichas en la mesa');
  const manoAntes = g.mano;
  await G.reload(); await G.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); await G.evaluate(() => { window.dominoRapido = true; });
  await G.waitForFunction(() => window.dominoEstado && window.dominoEstado().modo === 'online' && window.dominoEstado().mano.length > 0, null, { timeout: 30000 });
  const g2 = await E(G), hh = await E(H);
  ok(g2.p === 2 && g2.mano.length === hh.pub.cuentas[2], 'el invitado recarga y recupera su mano (' + g2.mano.length + ' fichas)');
  ok(g2.mano.every(f => manoAntes.includes(f)) || g2.pub.nj !== g.pub.nj, 'la mano recuperada es la suya');

  const finH = await jugar([H, G]);
  ok(finH.pub.fase === 'fin' && finH.pub.resultado, 'la mano termina en los dos (' + (finH.pub.resultado && finH.pub.resultado.tranque ? 'tranque' : 'dominó') + ')');
  await G.waitForSelector(W + ' .doFin', { state: 'visible', timeout: 8000 });
  ok(await G.locator(W + ' .doCuenta').count() >= 4, 'el invitado ve todas las manos al final');
  ok(await H.locator(W + ' .doFin [data-r=otra]').isEnabled() && await G.locator(W + ' .doFin [data-r=otra]').isDisabled(), 'solo el anfitrión vuelve al lobby');
  if (SHOT) await G.screenshot({ path: SHOT + '/domino-online-fin.png' });
  await H.locator(W + ' .doFin [data-r=otra]').click();
  await H.waitForSelector(LB, { state: 'visible', timeout: 15000 }); await G.waitForSelector(LB, { state: 'visible', timeout: 15000 });
  ok(true, 'vuelven al lobby');

  // tercera persona: con 3 personas solo cabe 1 CPU
  const T = await nuevo('tercero'); await sala(T, 'unir', 'Tere', 'domino uno');
  await H.waitForFunction(sel => document.querySelector(sel).innerText.includes('Tere'), LB, { timeout: 15000 });
  await wait(400);
  ok(await H.locator(LB + ' .olOp', { hasText: 'CPU:' }).locator('button', { hasText: '2' }).isDisabled(), 'con 3 personas no se pueden poner 2 CPU');
  await opcion(H, 'CPU:', '0'); await opcion(H, 'Partida:', 'A 50');
  await H.locator(LB + ' .olGrande').click();
  for (const pg of [H, G, T]) await pg.waitForFunction(() => window.dominoEstado().modo === 'online' && window.dominoEstado().mano.length === 7, null, { timeout: 15000 });
  h = await E(H);
  ok(h.pub.n === 3 && !h.pub.parejas && h.pub.pozo === 7 && h.jug.every(j => !j.cpu), '3 personas, sin CPU, con pozo');
  const e3 = await jugar([H, G, T]);
  ok(e3.pub.fase === 'finMano' || e3.pub.fase === 'fin', 'la primera mano de 3 termina');
  if (e3.pub.fase === 'finMano') {
    await H.locator(W + ' .doFin [data-r=otra]').click();
    await T.waitForFunction(() => window.dominoEstado().pub.mano === 2 && window.dominoEstado().mano.length >= 7, null, { timeout: 10000 });
    ok(true, 'el anfitrión reparte la siguiente mano y les llega a todos');
  }
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

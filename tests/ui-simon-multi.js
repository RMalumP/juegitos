// Simon multijugador: varios en el mismo móvil (turnos con «pasa el móvil», eliminación, ganador) y online (todos a la vez, plazo, árbitro).
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9622, 9621);
  const nuevo = async (n, vp) => {
    const ctx = await env.contexto({ viewport: vp || { width: 390, height: 780 } }); const pg = await env.pagina(ctx, n);
    pg.on('dialog', d => d.accept()); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
    await pg.evaluate(() => { window.simRapido = true; }); return pg;
  };
  const se = pg => pg.evaluate(() => window.simEstado());
  const tocar = async (pg, colores) => { for (const c of colores) { await pg.locator('.simPad[data-i="' + c + '"]').dispatchEvent('pointerdown'); await wait(15); } };
  const repetir = async (pg, bien) => {
    await pg.waitForFunction(() => window.simEstado().fase === 'turno', null, { timeout: 15000 });
    const s = await se(pg);
    await tocar(pg, bien ? s.seq : [(s.seq[0] + 1) % 4]);
    return s;
  };

  // ================= MISMO MÓVIL =================
  const P = await nuevo('local');
  await P.evaluate(() => window.openGame('sim')); await wait(500);
  ok(await P.locator('#simGo').isVisible() && await P.locator('#simLocalBtn').isVisible() && await P.locator('#simOnlineBtn').isVisible(), 'simon: el inicio ofrece 1 jugador, varios en el móvil y online');
  await P.click('#simLocalBtn');
  ok(await P.locator('#simNombres input').count() === 2, 'simon local: por defecto 2 jugadores');
  await P.click('.simN[data-n="3"]');
  ok(await P.locator('#simNombres input').count() === 3, 'simon local: se elige 3 jugadores');
  const ins = P.locator('#simNombres input'); await ins.nth(0).fill('Ana'); await ins.nth(1).fill('Beto'); await ins.nth(2).fill('Cris');
  await P.evaluate(() => { window.PasarMovil.retardo = 0; });
  await P.click('#simLocalGo');
  const turnoLocal = async (quien, bien) => {
    await P.waitForSelector('#simWrap .pmCubierta .pmBoton:not([disabled])', { timeout: 8000 });
    const t = await P.locator('#simWrap .pmCubierta .pmTitulo').innerText();
    ok(t.includes(quien), 'simon local: la tapa pide el móvil para ' + quien + ' («' + t + '»)');
    await P.click('#simWrap .pmCubierta .pmBoton');
    return repetir(P, bien);
  };
  let s = await turnoLocal('Ana', true); ok(s.seq.length === 1 && s.actor === 0, 'simon local: ronda 1 con 1 color');
  s = await turnoLocal('Beto', true); ok(s.seq.length === 1, 'simon local: el segundo jugador repite la misma secuencia');
  await turnoLocal('Cris', true);
  s = await turnoLocal('Ana', true); ok(s.seq.length === 2, 'simon local: al terminar la ronda la secuencia crece');
  await turnoLocal('Beto', false);
  await P.waitForFunction(() => /Fallo/.test(document.getElementById('simEstado').textContent), null, { timeout: 5000 });
  ok(true, 'simon local: Beto falla');
  await turnoLocal('Cris', true);
  await P.waitForFunction(() => window.simEstado().multi.vivos[1] === false, null, { timeout: 5000 });
  ok(await P.locator('#simJug .simJ.fuera').count() === 1, 'simon local: al cerrar la ronda Beto queda eliminado (tachado)');
  s = await turnoLocal('Ana', true); ok(s.seq.length === 3, 'simon local: Beto ya no juega la ronda 3');
  await turnoLocal('Cris', false);
  await P.waitForSelector('#simOver.show', { timeout: 8000 });
  ok(/Gana Ana/.test(await P.locator('#simOverT').innerText()), 'simon local: gana el último en pie (Ana)');
  ok(/Ana · 3[\s\S]*Cris · 2[\s\S]*Beto · 1/.test(await P.locator('#simOverS').innerText()), 'simon local: clasificación por secuencias');
  ok(await P.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'simon local: sin scroll horizontal en el móvil');
  await P.click('#simAgain');
  await P.waitForSelector('#simWrap .pmCubierta', { timeout: 5000 });
  ok((await se(P)).multi.vivos.every(Boolean), 'simon local: «otra vez» empieza con los mismos jugadores');
  await P.click('#simNewGame'); await wait(200);
  ok((await se(P)).modo === 'solo' && await P.locator('#simStart').isVisible() && await P.locator('.pmCubierta').count() === 0, 'simon local: «Nueva partida» vuelve al menú');
  await P.click('#simGo');
  await repetir(P, true);
  ok((await se(P)).modo === 'solo', 'simon: el modo de 1 jugador sigue funcionando');

  // ================= ONLINE =================
  const LB = '#winSim .olLobby[data-j=simon]';
  const sala = async (pg, modo, nombre) => {
    await pg.evaluate(() => window.openGame('sim')); await wait(500);
    await pg.click('#simOnlineBtn');
    await pg.waitForSelector('#winSala:not(.hidden)');
    await pg.fill('#salaNombre', nombre); await pg.fill('#salaSala', 'sala simon'); await pg.fill('#salaPass', 'clave1');
    await pg.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await pg.waitForSelector(LB, { state: 'visible', timeout: 25000 });
  };
  const H = await nuevo('host'), G = await nuevo('inv1'), X = await nuevo('inv2');
  await sala(H, 'crear', 'Anfi');
  ok(/1 \/ 6/.test(await H.locator(LB + ' .olSub').first().innerText()), 'simon online: la sala admite 6 jugadores');
  await sala(G, 'unir', 'Gema'); await sala(X, 'unir', 'Xavi');
  await H.locator(LB + ' .olFila button', { hasText: 'Rápida' }).click();
  await G.waitForFunction(() => window.Sala.estado.op && window.Sala.estado.op.vel === 2, null, { timeout: 8000 });
  ok(true, 'simon online: el anfitrión elige la velocidad y los invitados la ven');
  await H.evaluate(() => { window.simPlazoMs = 4000; });
  await H.waitForFunction(sel => { const b = document.querySelector(sel + ' .olGrande'); return b && !b.disabled; }, LB, { timeout: 15000 });
  await H.locator(LB + ' .olGrande').click();
  for (const pg of [H, G, X]) await pg.waitForFunction(() => window.simEstado().modo === 'online', null, { timeout: 15000 });
  ok(await H.locator('#winSim .olBarra.on').count() === 1 && /3 jugadores/.test(await H.locator('#winSim .olBarra').innerText()), 'simon online: la barra muestra la sala y los jugadores');
  ok((await se(G)).multi.vel === 2 && await G.locator('#simJug .simJ').count() === 3, 'simon online: velocidad Rápida y 3 jugadores en la fila');
  const sH = await se(H), sG = await se(G);
  ok(JSON.stringify(sH.multi.seq) === JSON.stringify(sG.multi.seq), 'simon online: todos tienen la misma secuencia');

  // ronda 1: todos aciertan a la vez
  await Promise.all([repetir(H, true), repetir(G, true), repetir(X, true)]);
  await H.waitForFunction(() => window.Sala.estado.si && window.Sala.estado.si.ronda === 2, null, { timeout: 8000 });
  ok(true, 'simon online: cuando todos aciertan pasa a la ronda 2');
  // ronda 2: Xavi no contesta → el plazo lo elimina
  await Promise.all([repetir(H, true), repetir(G, true)]);
  await wait(300);
  ok((await H.evaluate(() => window.Sala.estado.si.ronda)) === 2, 'simon online: se espera a quien falta por contestar');
  await H.waitForFunction(() => window.Sala.estado.si.ronda === 3, null, { timeout: 10000 });
  const e3 = await H.evaluate(() => window.Sala.estado.si);
  ok(e3.vivos[2] === false && e3.vivos[0] && e3.vivos[1], 'simon online: quien no contesta a tiempo queda eliminado');
  await X.waitForFunction(() => /Eliminado/.test(document.getElementById('simEstado').textContent), null, { timeout: 8000 });
  ok(true, 'simon online: el eliminado lo ve en su pantalla');
  await X.evaluate(r => window.Sala.enviar('host', { tipo: 'accion', a: 'resp', ronda: r.ronda, r: r.seq }), e3).catch(() => {});
  await G.evaluate(r => window.Sala.enviar('host', { tipo: 'accion', a: 'resp', ronda: 1, r: [r.seq[0]] }), e3).catch(() => {});
  await wait(500);
  ok((await H.evaluate(() => JSON.stringify(window.Sala.estado.si.resp))) === '[null,null,null]', 'simon online: el anfitrión ignora respuestas de un eliminado o de otra ronda');
  // ronda 3: Gema falla, Anfi acierta → gana Anfi
  await Promise.all([repetir(H, true), repetir(G, false)]);
  for (const pg of [H, G, X]) await pg.waitForSelector('#simOver.show', { timeout: 10000 });
  ok(/Has ganado/.test(await H.locator('#simOverT').innerText()), 'simon online: el anfitrión gana');
  ok(/Gana Anfi/.test(await G.locator('#simOverT').innerText()) && /Gana Anfi/.test(await X.locator('#simOverT').innerText()), 'simon online: los demás ven quién ha ganado');
  ok(await G.locator('#simAgain').isDisabled() && !(await H.locator('#simAgain').isDisabled()), 'simon online: solo el anfitrión puede volver al lobby');

  // recarga del invitado: recupera el final
  await G.reload(); await G.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await G.waitForSelector('#simOver.show', { timeout: 30000 });
  ok(/Gana Anfi/.test(await G.locator('#simOverT').innerText()), 'simon online: el invitado recarga y recupera la partida');

  // volver al lobby y empezar otra
  await H.click('#simAgain');
  await G.waitForSelector(LB, { state: 'visible', timeout: 10000 });
  ok((await se(H)).modo === 'solo', 'simon online: al volver al lobby se sale de la partida');
  await H.locator(LB + ' .olGrande').click();
  await G.waitForFunction(() => window.simEstado().modo === 'online' && window.simEstado().multi.ronda === 1, null, { timeout: 15000 });
  ok(true, 'simon online: revancha desde el lobby');
  fin(env);
})().catch(e => { console.error(e); process.exit(1); });

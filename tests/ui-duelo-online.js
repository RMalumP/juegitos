// Conecta 4 y Tres en raya ONLINE: sala, turnos, jugadas ilegales o fuera de turno ignoradas, victoria, recarga del invitado y revancha.
const { entorno, wait, ok, fin } = require('./helpers');
const JUEGOS = [
  { id: 'c4', win: 'winC4', celda: '.c4Celda', nombre: 'Conecta 4', jugadasHost: [0, 0, 0, 0], jugadasInv: [1, 1, 1], malas: [{ j: 9 }, { j: -1 }, { j: 1.5 }] },
  { id: 'ttt', win: 'winTtt', celda: '.tttCelda', nombre: 'Tres en raya', jugadasHost: [0, 1, 2], jugadasInv: [3, 4], malas: [{ j: 9 }, { j: -2 }] }
];
(async () => {
  const env = await entorno(9482, 9481);
  const nuevo = async n => { const ctx = await env.contexto({ viewport: { width: 420, height: 800 } }); const pg = await env.pagina(ctx, n); pg.on('dialog', d => d.accept()); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return pg; };
  for (const J of JUEGOS) {
    const W = '#' + J.id + 'Wrap', LB = '#' + J.win + ' .olLobby[data-j=' + J.id + ']';
    const sala = async (pg, modo, nombre) => {
      await pg.evaluate(k => window.openGame(k), J.id); await wait(500);
      await pg.locator('#' + J.win + ' [data-conectar]').click();
      await pg.fill('#salaNombre', nombre); await pg.fill('#salaSala', 'duelo ' + J.id); await pg.fill('#salaPass', 'clave1');
      await pg.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
      await pg.waitForSelector(LB, { state: 'visible', timeout: 25000 });
    };
    const H = await nuevo('host-' + J.id), G = await nuevo('inv-' + J.id);
    await sala(H, 'crear', 'Anfi'); await sala(G, 'unir', 'Invi');
    await H.waitForFunction(sel => { const b = document.querySelector(sel + ' .olGrande'); return b && !b.disabled; }, LB, { timeout: 15000 });
    await H.locator(LB + ' .olGrande').click();
    await H.waitForFunction(id => window[id + 'Estado']().modo === 'online', J.id, { timeout: 15000 });
    await G.waitForFunction(id => window[id + 'Estado']().modo === 'online', J.id, { timeout: 15000 });
    ok(await H.locator('.olBarra.on').count() === 1 && /contra Invi/.test(await H.locator('.olBarra').innerText()), J.nombre + ' online: la barra dice contra quién juegas');
    const estado = pg => pg.evaluate(() => window.Sala.estado.du);
    const celdas = pg => pg.locator(W + ' ' + J.celda);

    // el primero (host o invitado) según el azar: el que tiene el turno juega, el otro intenta colarse
    let e = await estado(H);
    const mover = async (pg, j) => { await celdas(pg).nth(J.id === 'c4' ? j : j).click(); };
    const esperar = (pg, n) => pg.waitForFunction(k => window.Sala.estado.du && window.Sala.estado.du.n >= k, n, { timeout: 8000 });
    const turnoDe = async () => (await estado(H)).turno;           // 0 = host, 1 = invitado
    const malo = (await turnoDe()) === 0 ? G : H;                  // quien NO tiene el turno
    const mala = J.malas[0];
    await malo.evaluate(m => window.Sala.enviar('host', { tipo: 'accion', a: 'jugar', j: m.j }), mala).catch(() => {});
    await wait(500);
    ok((await estado(H)).n === 0, J.nombre + ' online: una jugada fuera de turno o ilegal se ignora');
    if ((await turnoDe()) === 1) { await G.evaluate(m => window.Sala.enviar('host', { tipo: 'accion', a: 'jugar', j: m.j }), J.malas[1]); await wait(400); ok((await estado(H)).n === 0, J.nombre + ' online: una jugada con coordenada inválida se ignora'); }

    // partida: se alternan hasta que alguien gana (cada uno juega su serie; el primero según el azar)
    const orden = (await turnoDe()) === 0 ? [[H, J.jugadasHost], [G, J.jugadasInv]] : [[G, J.jugadasHost], [H, J.jugadasInv]];
    let n = 0, i = 0;
    while (!(await H.locator(W + ' .duFin').isVisible()) && n < 40) {
      const [pg, lista] = orden[n % 2]; const j = lista[Math.floor(n / 2)];
      if (j === undefined) break;
      await mover(pg, j); n++; await esperar(H, n); await esperar(G, n);
    }
    await H.waitForSelector(W + ' .duFin', { state: 'visible', timeout: 8000 }); await G.waitForSelector(W + ' .duFin', { state: 'visible', timeout: 8000 });
    const a = await H.locator(W + ' .duFin h1').innerText(), b = await G.locator(W + ' .duFin h1').innerText();
    ok(/ganado/.test(a) !== /ganado/.test(b) && (/ganado|perdido/.test(a)), J.nombre + ' online: la partida termina y uno gana («' + a + '» / «' + b + '»)');
    ok(await H.locator(W + ' .gana').count() >= 3, J.nombre + ' online: se resalta la línea ganadora');

    // recarga del invitado: recupera la partida terminada
    await G.reload(); await G.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
    await G.waitForFunction(() => window.Sala && window.Sala.activo && window.Sala.estado.du, null, { timeout: 30000 });
    await G.waitForFunction(w => document.querySelectorAll(w + ' .gana').length >= 3, W, { timeout: 30000 });
    ok(true, J.nombre + ' online: el invitado recarga la página y recupera la partida');

    // volver al lobby y empezar otra
    ok(await H.locator(W + ' .duFin [data-r=otra]').isEnabled() && await G.locator(W + ' .duFin [data-r=otra]').isDisabled(), J.nombre + ' online: solo el anfitrión vuelve al lobby');
    await H.locator(W + ' .duFin [data-r=otra]').click();
    await H.waitForSelector(LB, { state: 'visible', timeout: 15000 }); await G.waitForSelector(LB, { state: 'visible', timeout: 15000 });
    await H.locator(LB + ' .olGrande').click();
    await G.waitForFunction(id => window[id + 'Estado']().modo === 'online' && window[id + 'Estado']().est && window[id + 'Estado']().est.n === 0, J.id, { timeout: 15000 });
    ok(true, J.nombre + ' online: segunda partida (revancha) desde el lobby');
    await H.context().close(); await G.context().close();
  }
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

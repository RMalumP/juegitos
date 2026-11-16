// Mesa online de Póquer con 2 navegadores: turnos, cartas privadas, enfrentamiento, fichas conservadas y recarga del anfitrión.
// (Ruleta y Blackjack online usan los juegos originales: tests/ui-ruleta.js y tests/ui-blackjack.js.)
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9482, 9481);
  const nuevo = async n => { const ctx = await env.contexto(); const pg = await env.pagina(ctx, n); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return pg; };
  const entrar = async (pg, win, juego, modo, nombre, sala) => {
    await pg.evaluate(j => window.openGame(j), win);
    await pg.waitForSelector('#' + { roul: 'winRoul', bj: 'winBJ', poker: 'winPoker' }[win] + ' [data-conectar]');
    await pg.locator('#' + { roul: 'winRoul', bj: 'winBJ', poker: 'winPoker' }[win] + ' [data-conectar]').click();
    await pg.fill('#salaNombre', nombre); await pg.fill('#salaSala', sala); await pg.fill('#salaPass', 'clave1');
    await pg.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await pg.waitForSelector('.olLobby[data-j=' + juego + ']', { state: 'visible', timeout: 25000 });
  };
  const empezar = async (H, juego) => {
    await H.waitForFunction(j => { const b = document.querySelector('.olLobby[data-j=' + j + '] .olGrande'); return b && !b.disabled; }, juego, { timeout: 15000 });
    await H.locator('.olLobby[data-j=' + juego + '] .olGrande').click();
  };

  // ================= PÓQUER =================
  const H3 = await nuevo('h3'), G3 = await nuevo('g3');
  await entrar(H3, 'poker', 'poker', 'crear', 'Ana', 'casino poker'); await entrar(G3, 'poker', 'poker', 'unir', 'Beto', 'casino poker');
  await empezar(H3, 'poker');
  const T = '#winPoker.pkOnline #pkTable.show';
  await H3.waitForSelector(T + ' .pkSeat', { timeout: 10000 }); await G3.waitForSelector(T + ' .pkSeat', { timeout: 10000 });
  await G3.waitForFunction(() => window.Sala.rol && window.Sala.rol.hole && window.Sala.rol.hole.length === 2, null, { timeout: 10000 });
  ok(await G3.evaluate(() => JSON.stringify(window.Sala.estado.mesa).includes('"hole"')) === false, 'póquer: el estado público no contiene ninguna carta privada');
  ok(await G3.locator('#pkSetup').isVisible() === false, 'póquer: la mesa online usa la del juego offline (sin la pantalla de preparar)');
  ok(await G3.locator('#pkSeats .pkSeat').count() === 2 && await G3.locator('#pkSeats .pkBadge.d').count() === 1 && await G3.locator('#pkBoard .pkBoardSlot').count() === 5, 'póquer: asientos con la ficha D y las 5 casillas de la mesa, como en el offline');
  await G3.waitForFunction(() => document.querySelectorAll('#pkHole .pkBig.flip').length === 2, null, { timeout: 10000 });
  ok(true, 'póquer: el invitado ve sus dos cartas dibujadas (como en el offline)');
  ok(await G3.locator('#pkSeats .pkSeat:not(.pkYo) .pkMini.faceDown').count() === 2, 'póquer: del rival solo ve el reverso');
  const quien = async () => { const ti = await H3.evaluate(() => window.Sala.estado.mesa.turno), id = await H3.evaluate(i => window.Sala.estado.mesa.jug[i].id, ti); return (await H3.evaluate(() => window.Sala.uid)) === id ? [H3, G3] : [G3, H3]; };
  // el panel de subida del offline: «Bote» y confirmar
  { const [pg] = await quien(); const antes = await H3.evaluate(() => window.Sala.estado.mesa.apuestaActual);
    await pg.click('#pkRaiseBtn'); ok(await pg.locator('#pkRaisePanel.show').isVisible(), 'póquer: «Subir» abre el panel de subida del offline');
    await pg.click('#pkRaisePanel .pkQBtn:has-text("Bote")'); await pg.click('#pkRaiseConfirm'); await wait(700);
    ok(await H3.evaluate(() => window.Sala.estado.mesa.apuestaActual) > antes, 'póquer: la subida del panel llega a la mesa'); }
  // todos igualan hasta el enfrentamiento
  for (let i = 0; i < 12; i++) {
    const f = await H3.evaluate(() => window.Sala.estado.mesa.fase); if (f === 'showdown') break;
    const [pg] = await quien(); await pg.click('#pkCheckBtn'); await wait(500);
  }
  await H3.waitForFunction(() => window.Sala.estado.mesa.fase === 'showdown', null, { timeout: 15000 });
  await G3.waitForFunction(() => window.Sala.estado.mesa.fase === 'showdown', null, { timeout: 15000 });
  const total = await G3.evaluate(() => window.Sala.estado.mesa.jug.reduce((t, j) => t + j.coins, 0) + window.Sala.estado.mesa.bote);
  ok(total === 2000, 'póquer: tras el enfrentamiento se conservan las 2000 fichas (' + total + ')');
  ok(await G3.evaluate(() => window.Sala.estado.mesa.com.length) === 5 && await G3.locator('#pkBoard .pkMini').count() === 5, 'póquer: se ven las 5 cartas comunes');
  ok(await G3.locator('#pkSeats .pkSeat:not(.pkYo) .pkSeatCards .pkMini:not(.faceDown):not(.hiddenCard)').count() === 2 && await G3.locator('#pkSeats .pkSeatHand').count() === 2, 'póquer: en el enfrentamiento se destapan las cartas del rival con el nombre de la jugada');
  ok(await G3.locator('#pkContinueHint.show').isVisible(), 'póquer: «Toca la pantalla para continuar», como en el offline');
  await G3.click('#pkFelt'); await G3.waitForSelector('#pkOverlay.show', { timeout: 5000 });
  ok((await G3.locator('#pkOverlayTitle').textContent()) === 'Resultado de la mano' && await G3.locator('#pkSeats .pkSeatStatus.winS').count() >= 1, 'póquer: ventana «Resultado de la mano» y GANA en el asiento');
  await G3.click('#pkOverlayBtn'); await wait(500);
  ok(await H3.evaluate(() => window.Sala.estado.mesa.mano) === 1, 'póquer: un invitado solo no reparte la mano siguiente (espera a los demás)');
  // el anfitrión sigue: reparte la mano siguiente
  await H3.click('#pkFelt'); await H3.waitForSelector('#pkOverlay.show', { timeout: 5000 }); await H3.click('#pkOverlayBtn');
  await G3.waitForFunction(() => window.Sala.estado.mesa.mano === 2 && window.Sala.estado.mesa.fase === 'preflop', null, { timeout: 10000 });
  await G3.waitForFunction(() => window.Sala.rol && window.Sala.rol.hole && window.Sala.rol.hole.length === 2, null, { timeout: 10000 });
  ok(true, 'póquer: con todos listos se reparte la mano siguiente y llegan cartas privadas nuevas');
  const turno = await G3.evaluate(() => window.Sala.estado.mesa.jug[window.Sala.estado.mesa.turno].id), miId = await G3.evaluate(() => window.Sala.uid);
  if (turno !== miId) { const antes = await G3.evaluate(() => JSON.stringify(window.Sala.estado.mesa.jug.map(j => j.apostado))); await G3.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'raise', m: 500 })); await wait(600); ok(antes === await G3.evaluate(() => JSON.stringify(window.Sala.estado.mesa.jug.map(j => j.apostado))), 'póquer: subir fuera de turno se ignora'); }
  // recarga del anfitrión: recupera la mesa
  const manoAntes = await H3.evaluate(() => JSON.stringify(window.Sala.estado.mesa.jug.map(j => [j.coins, j.apostado])));
  await H3.reload(); await H3.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await H3.waitForSelector('#winPoker.pkOnline #pkTable.show .pkSeat', { state: 'visible', timeout: 30000 });
  await wait(2500);
  ok(await H3.evaluate(() => JSON.stringify(window.Sala.estado.mesa.jug.map(j => [j.coins, j.apostado]))) === manoAntes, 'póquer: el anfitrión recarga y recupera la mesa y los saldos');
  const sigue = await G3.evaluate(() => window.Sala.estado.mesa.turno);
  ok(typeof sigue === 'number', 'póquer: la partida sigue en marcha tras recargar el anfitrión');
  // retirarse preguntando si se enseñan las cartas, como en el offline
  { await H3.waitForSelector(T + ' .pkSeat', { timeout: 10000 }); const [pg, otro] = await quien(); await pg.click('#pkFoldBtn');
    ok(await pg.locator('#pkFoldDlg.show').isVisible(), 'póquer: al retirarse pregunta si enseñar las cartas');
    await pg.click('#pkFoldDlg .pkFoldBtn:has-text("Mostrar cartas")');
    await otro.waitForFunction(() => window.Sala.estado.mesa.fase === 'showdown', null, { timeout: 10000 }); await wait(300);
    ok(await otro.locator('#pkSeats .pkSeat.folded .pkSeatCards .pkMini:not(.faceDown):not(.hiddenCard)').count() === 2, 'póquer: quien se retira enseñando sus cartas las muestra al final de la mano'); }
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

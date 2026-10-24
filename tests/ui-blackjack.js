// Blackjack ORIGINAL online: mismas reglas y pantalla; apuestas de cada móvil, reparto cuando todos están listos, carta oculta de la banca, dividir/doblar, pagos y vuelta a local.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9542, 9541);
  const nuevo = async n => { const ctx = await env.contexto(); const pg = await ctx.newPage(); pg.on('pageerror', e => ok(false, 'sin errores: ' + e.message)); await pg.goto(env.url); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return pg; };
  const entrar = async (pg, modo, nombre) => {
    await pg.evaluate(() => window.openGame('bj')); await pg.locator('#winBJ [data-conectar]').click();
    await pg.fill('#salaNombre', nombre); await pg.fill('#salaSala', 'bj orig'); await pg.fill('#salaPass', 'clave1'); await pg.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await pg.waitForSelector('.olLobby[data-j=blackjack]', { state: 'visible', timeout: 25000 });
  };
  const resumen = pg => pg.evaluate(() => JSON.stringify({ je, we, Te, p: Me.map(p => ({ n: p.name, c: p.chips, b: p.bet, h: p.hands.map(h => h.map(c => c.hidden ? '?' : c.v + c.s)) })), d: Se.map(c => c.hidden ? '?' : c.v + c.s) }));
  const H = await nuevo('host'), G = await nuevo('invitado');
  await entrar(H, 'crear', 'Ana'); await entrar(G, 'unir', 'Beto');
  await H.waitForFunction(() => { const b = document.querySelector('.olLobby[data-j=blackjack] .olGrande'); return b && !b.disabled; }, null, { timeout: 15000 });
  await H.locator('.olLobby[data-j=blackjack] .olGrande').click();
  await H.waitForFunction(() => window.Sala.estado.phase === 'jugando', null, { timeout: 10000 });
  await G.waitForFunction(() => window.Sala.estado.bjF, null, { timeout: 10000 });
  await G.waitForFunction(() => je === 'bet' && Me.length === 2, null, { timeout: 10000 });

  const mesa = pg => pg.evaluate(() => ({ chips: document.querySelectorAll('#bjChipsRow .bjChip').length, split: !!document.getElementById('bjSplitBtn'), dbl: !!document.getElementById('bjDoubleBtn'), cheat: !!document.getElementById('bjCheatSheet'), online: document.getElementById('winBJ').classList.contains('bjOnline'), filas: document.querySelectorAll('#bjPlayersArea .bjPRow').length, tabsVisibles: getComputedStyle(document.getElementById('bjPlayerTabs')).display !== 'none' }));
  const mH = await mesa(H), mG = await mesa(G);
  ok(mH.chips === 6 && mH.split && mH.dbl && mH.cheat && mH.filas === 2, 'es la pantalla del Blackjack original (6 fichas, Split, ×2, chuleta, una fila por jugador)');
  ok(JSON.stringify(mH) === JSON.stringify(mG) && mH.online && !mH.tabsVisibles, 'anfitrión e invitado ven la misma mesa y no se pueden cambiar de jugador');
  ok(await H.evaluate(() => Me.map(p => p.name + ':' + p.chips).join()) === 'Ana:1000,Beto:1000' && await H.evaluate(() => Pe) === 0 && await G.evaluate(() => Pe) === 1, 'cada móvil controla a su jugador, con 1000 fichas');

  // ---- apuestas
  await G.evaluate(() => bjAddBet(25)); await H.evaluate(() => bjAddBet(10));
  await G.waitForFunction(() => Me[1].bet === 25 && Me[0].bet === 10, null, { timeout: 5000 });
  ok(await resumen(H) === await resumen(G), 'las apuestas de los dos móviles se ven igual (Ana 10, Beto 25)');
  await G.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'ap', m: 7 })); await G.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'hit' })); await wait(600);
  ok(await H.evaluate(() => Me[1].bet) === 25 && await H.evaluate(() => je) === 'bet', 'fichas que no existen y acciones fuera de turno se ignoran');
  await G.evaluate(() => bjClearBet()); await G.waitForFunction(() => Me[1].bet === 0, null, { timeout: 5000 }); await G.evaluate(() => bjAddBet(25)); await G.waitForFunction(() => Me[1].bet === 25, null, { timeout: 5000 });
  // ---- repartir: el invitado dice «listo» y el anfitrión reparte
  await G.evaluate(() => bjDeal());
  await G.waitForFunction(() => /Esperando/.test(document.getElementById('bjDealBtn2').textContent), null, { timeout: 5000 });
  await wait(600); ok(await H.evaluate(() => je) === 'bet', 'mientras falta el anfitrión no se reparte');
  await H.locator('#bjDealBtn2').click();
  await H.waitForFunction(() => je === 'play' || je === 'dealer' || je === 'done', null, { timeout: 8000 });
  await G.waitForFunction(() => je !== 'bet', null, { timeout: 8000 });
  await wait(1300);
  const ve = await G.evaluate(() => ({ n: Se.length, oculta: Se[1].hidden, v: Se[1].v, s: Se[1].s, back: document.querySelectorAll('#bjDealerCards .bjCard.back').length, manos: Me.map(p => p.hands[0].length) }));
  ok(ve.n === 2 && ve.oculta && ve.v === '' && ve.s === '' && ve.back === 1 && ve.manos.join() === '2,2', 'se reparten 2 cartas a cada uno; la segunda de la banca llega tapada y SIN su valor al invitado');

  // ---- partida controlada: Ana 20, Beto 8-8 (dividir), banca 10+8
  const carta = (v, s) => ({ v, s, cl: s === '♥' || s === '♦' ? 'red' : 'blk', hidden: false });
  await H.evaluate(() => {
    const c = (v, s) => ({ v, s, cl: s === '♥' || s === '♦' ? 'red' : 'blk', hidden: false });
    Me[0].hands = [[c('K', '♠'), c('Q', '♥')]]; Me[0].hands[0].bet = 10; Me[1].hands = [[c('8', '♠'), c('8', '♥')]]; Me[1].hands[0].bet = 25;
    Se = [c('10', '♣'), Object.assign(c('8', '♦'), { hidden: true })]; we = 0; Te = 0; je = 'play'; Ye(); Ze();
  });
  await G.waitForFunction(() => Me[1].hands[0][0].v === '8' && we === 0, null, { timeout: 5000 });
  await G.evaluate(() => bjStand());                                                // fuera de turno: no hace nada
  await wait(500); ok(await H.evaluate(() => we) === 0, 'el invitado no puede plantarse en el turno de Ana');
  await H.evaluate(() => bjStand());
  await G.waitForFunction(() => we === 1, null, { timeout: 5000 });
  ok(await G.evaluate(() => !document.getElementById('bjSplitBtn').disabled), 'en su turno, el invitado tiene Split disponible (8 y 8)');
  await G.evaluate(() => bjSplit());
  await H.waitForFunction(() => Me[1].hands.length === 2, null, { timeout: 5000 }); await G.waitForFunction(() => Me[1].hands.length === 2, null, { timeout: 5000 });
  ok(await H.evaluate(() => Me[1].chips) === 1000 - 25 - 25 && await resumen(H) === await resumen(G), 'dividir con el código original: dos manos con su apuesta cada una y las fichas descontadas, igual en los dos móviles');
  // se fuerzan las dos manos del invitado a 18 y 21 para comprobar los pagos originales
  await H.evaluate(() => { const c = (v, s) => ({ v, s, cl: s === '♥' || s === '♦' ? 'red' : 'blk', hidden: false }); Me[1].hands[0].length = 0; Me[1].hands[0].push(c('10', '♠'), c('8', '♠')); Me[1].hands[1].length = 0; Me[1].hands[1].push(c('9', '♥'), c('2', '♥'), c('K', '♦')); Ye(); });
  await G.evaluate(() => bjStand()); await G.waitForFunction(() => Te === 1, null, { timeout: 5000 }); await G.evaluate(() => bjStand());
  await H.waitForFunction(() => je === 'done', null, { timeout: 15000 }); await G.waitForFunction(() => je === 'done', null, { timeout: 15000 });
  // banca 10+8 = 18 (se planta): Ana 20 gana (+10), mano 1 de Beto 18 empata, mano 2 de Beto 21 gana (+25)
  const rs = await resumen(H); ok(rs === await resumen(G), 'al terminar la banca los dos móviles muestran lo mismo');
  ok(await H.evaluate(() => Me[0].chips) === 1010, 'Ana (20 contra 18) cobra su apuesta: 1010');
  ok(await H.evaluate(() => Me[1].chips) === 1025, 'Beto: 18 empata (recupera 25) y 21 gana (cobra 50) → 1025');
  ok(await G.evaluate(() => Se.every(c => !c.hidden && c.v !== '')), 'con la banca jugando se destapa su segunda carta en el invitado');
  ok(/Ana|Beto|Gana|Empate/.test(await G.locator('#bjMsgBar').innerText()), 'el mensaje de resultados del juego original aparece en el invitado');
  // siguiente ronda con un toque del invitado
  await wait(1700); await G.locator('#bjWrap').click({ position: { x: 20, y: 20 } });
  await H.waitForFunction(() => je === 'bet' && Me.every(p => p.bet === 0), null, { timeout: 8000 });
  await G.waitForFunction(() => je === 'bet', null, { timeout: 8000 });
  ok(await H.evaluate(() => Me.map(p => p.chips).join()) === '1010,1025', 'siguiente ronda: apuestas a cero y fichas conservadas');
  // volver al lobby: Blackjack local normal
  H.once('dialog', d => d.accept());
  await H.locator('.olBarra button', { hasText: 'Lobby' }).click();
  await H.waitForSelector('.olLobby[data-j=blackjack]', { state: 'visible', timeout: 10000 });
  ok(await H.evaluate(() => !document.getElementById('winBJ').classList.contains('bjOnline') && Me.length === 1 && Me[0].chips === 1000), 'al volver al lobby el Blackjack local vuelve a ser el de siempre');
  await H.evaluate(() => { bjAddBet(25); bjDeal(); }); await wait(300);
  ok(await H.evaluate(() => je === 'play' || je === 'dealer' || je === 'done'), 'y en local se juega sin sala (apostar y repartir)');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

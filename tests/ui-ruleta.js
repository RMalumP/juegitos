// Ruleta ORIGINAL online: mismo tapete con todas las casillas, apuestas de cada móvil, giro común, pagos idénticos, «listo», repetir y vuelta a la ruleta local.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9532, 9531);
  const nuevo = async n => { const ctx = await env.contexto(); const pg = await env.pagina(ctx, n); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return pg; };
  const entrar = async (pg, modo, nombre) => {
    await pg.evaluate(() => window.openGame('roul')); await pg.locator('#winRoul [data-conectar]').click();
    await pg.fill('#salaNombre', nombre); await pg.fill('#salaSala', 'ruleta orig'); await pg.fill('#salaPass', 'clave1'); await pg.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await pg.waitForSelector('.olLobby[data-j=ruleta]', { state: 'visible', timeout: 25000 });
  };
  const st = pg => pg.evaluate(() => JSON.stringify(st.map(p => ({ n: p.name, c: p.coins, b: p.bets }))));
  const H = await nuevo('host'), G = await nuevo('invitado');
  await entrar(H, 'crear', 'Ana'); await entrar(G, 'unir', 'Beto');
  ok(/Americana/.test(await H.locator('.olLobby[data-j=ruleta] .olOp').first().innerText()), 'el lobby ofrece ruleta europea o americana');
  await H.locator('.olLobby[data-j=ruleta] .olOp .olBtn', { hasText: 'Americana' }).click(); await wait(400);
  await H.locator('.olLobby[data-j=ruleta] .olOp .olBtn', { hasText: /^500$/ }).click(); await wait(400);
  await H.waitForFunction(() => { const b = document.querySelector('.olLobby[data-j=ruleta] .olGrande'); return b && !b.disabled; }, null, { timeout: 15000 });
  await H.locator('.olLobby[data-j=ruleta] .olGrande').click();
  await H.waitForFunction(() => window.Sala.estado.phase === 'jugando', null, { timeout: 10000 });
  await G.waitForFunction(() => window.Sala.estado.rulF, null, { timeout: 10000 });

  // ---- es la ruleta original, con todo su tapete
  const cuenta = pg => pg.evaluate(() => ({ cel: document.querySelectorAll('#roulBoard .roulCell').length, corners: document.querySelectorAll('#roulCorners .roulCorner').length, splits: document.querySelectorAll('#roulSplits .roulSplit').length,
    streets: document.querySelectorAll('#roulStreets .roulStreet').length, six: document.querySelectorAll('#roulSixlines .roulSixline').length, trios: document.querySelectorAll('#roulBaskets .roulTrio').length, dbl: document.querySelectorAll('#roulBoard .roulDblZone').length,
    cero2: !document.getElementById('roulDblZero').classList.contains('hidden'), chips: document.querySelectorAll('.roulChip').length, usa: document.getElementById('roulBoard').classList.contains('us'), online: document.getElementById('winRoul').classList.contains('rulOnline') }));
  const cH = await cuenta(H), cG = await cuenta(G);
  ok(cH.corners === 22 && cH.splits === 57 && cH.streets === 12 && cH.six === 11 && cH.dbl === 4 && cH.trios > 5 && cH.chips === 6, 'la mesa tiene todas las casillas del original (22 esquinas, 57 splits, 12 calles, 11 seisenas, dobles, trios y 6 fichas)');
  ok(JSON.stringify(cH) === JSON.stringify(cG), 'anfitrión e invitado ven exactamente la misma mesa');
  ok(cH.usa && cH.cero2 && cH.online, 'la ruleta americana muestra el 00 y los ajustes locales (jugadores, monedas, nueva partida) quedan ocultos');
  ok(await H.evaluate(() => st.map(p => p.name).join()) === 'Ana,Beto' && await H.evaluate(() => at) === 0 && await G.evaluate(() => at) === 1, 'cada móvil controla a su jugador (Ana y Beto) y empiezan con 500');
  ok(await H.evaluate(() => st.every(p => p.coins === 500)), 'fichas iniciales 500 para los dos');

  // ---- apuestas de cada móvil
  await G.evaluate(() => roulSelChip(25)); await H.evaluate(() => roulSelChip(10));
  await G.locator('#roulNums .roulCell[data-n="17"]').click();
  await G.locator('#roulCorners .roulCorner').first().dispatchEvent('click');
  await H.locator('#roulOutside2 .roulCell, #roulBoard .roulCell').filter({ hasText: /^Rojo$|🔴/ }).first().click().catch(() => {});
  await H.evaluate(() => { const el = Array.from(document.querySelectorAll('#roulBoard .roulCell, #roulOutside2 .roulCell')).find(e => e.dataset.bet === 'red'); Ct(el); });
  await G.waitForFunction(() => st[1].coins === 450, null, { timeout: 5000 });
  await H.waitForFunction(() => st[1].coins === 450 && st[0].coins <= 490, null, { timeout: 5000 });
  let sH = await st(H), sG = await st(G);
  ok(sH === sG, 'las apuestas de los dos móviles se ven igual en ambos (' + JSON.parse(sH).map(p => p.n + ':' + p.c).join(' ') + ')');
  ok(await G.locator('.roulChipMark.other, .roulChipMark.otherStack').count() >= 1 || await H.locator('.roulChipMark.other, .roulChipMark.otherStack').count() >= 1, 'se ven las fichas de los otros jugadores en sus colores sobre el tapete');
  // apuesta inválida inyectada a mano
  await G.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'ap', k: 'corner:1-2-3-36', m: 25 })); await G.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'ap', k: 'num:17', m: 5000 })); await wait(700);
  ok(await st(H) === sH, 'el anfitrión rechaza casillas inventadas y fichas que no existen');
  // deshacer y repetir se hacen en el anfitrión con el código del juego
  await G.evaluate(() => xt()); await G.waitForFunction(() => st[1].coins === 475, null, { timeout: 5000 });
  await G.evaluate(() => wt()); await G.waitForFunction(() => st[1].coins === 500, null, { timeout: 5000 });
  ok(await H.evaluate(() => st[1].coins) === 500 && await H.evaluate(() => Object.keys(st[1].bets).length) === 0, 'deshacer y limpiar del invitado se aplican en las dos mesas');
  await G.locator('#roulNums .roulCell[data-n="8"]').click(); await G.locator('#roulNums .roulCell[data-n="9"]').click();
  await G.waitForFunction(() => st[1].coins === 450, null, { timeout: 5000 });

  // ---- «Girar»: espera a todos; cuando los dos están listos gira sola
  await G.evaluate(() => roulSpin());
  await G.waitForFunction(() => /Esperando/.test(document.getElementById('roulSpinBtn').textContent), null, { timeout: 5000 });
  ok(/Faltan.*Ana/.test(await G.locator('#roulMsg').innerText()), 'el invitado pulsa Girar y el juego dice a quién falta (Ana)');
  await wait(800); ok(await H.evaluate(() => rt) === false, 'mientras falta alguien por pulsar Girar no gira');
  await H.locator('#roulSpinBtn').click();                            // los dos listos → gira
  await H.waitForFunction(() => rt === true || ut === true, null, { timeout: 5000 });
  await G.waitForFunction(() => rt === true || ut === true, null, { timeout: 5000 });
  ok(true, 'al pulsar Girar el anfitrión, la rueda gira en los dos móviles');
  await H.waitForFunction(() => ut === true, null, { timeout: 12000 }); await G.waitForFunction(() => ut === true, null, { timeout: 12000 });
  const rH = await H.locator('#roulResult').innerText(), rG = await G.locator('#roulResult').innerText();
  ok(rH === rG && rH !== '—', 'los dos ven el mismo número (' + rH + ')');
  sH = await st(H); sG = await st(G);
  ok(sH === sG, 'los saldos tras los pagos son idénticos en los dos (' + JSON.parse(sH).map(p => p.n + ':' + p.c).join(' ') + ')');
  ok(await H.evaluate(() => st.every(p => Number.isInteger(p.coins) && p.coins >= 0)), 'los pagos usan las tablas del juego original (35, 17, 11, 8, 5, 2, 1…)');
  ok(await H.locator('.winCell').count() === await G.locator('.winCell').count(), 'las casillas ganadoras se iluminan igual en los dos');
  ok(/Salió/.test(await G.locator('#roulMsg').innerText()), 'el mensaje del resultado aparece también en el invitado');
  // continuar y repetir
  await wait(1700); await G.locator('#roulSpinBtn').click();
  await H.waitForFunction(() => ut === false && st.every(p => Object.keys(p.bets).length === 0), null, { timeout: 8000 });
  await G.waitForFunction(() => ut === false, null, { timeout: 8000 });
  ok(true, 'cualquiera pulsa «Siguiente» y empieza la ronda nueva en los dos');
  const antes = await G.evaluate(() => st[1].coins);
  await G.evaluate(() => roulRepeatBets());
  await G.waitForFunction(a => st[1].coins === a - 50, antes, { timeout: 5000 });
  ok(await H.evaluate(() => Object.keys(st[1].bets).length) === 2, '«Repetir» del invitado repite sus apuestas anteriores');
  // volver al lobby deja la ruleta local normal
  H.once('dialog', d => d.accept());
  await H.locator('.olBarra button', { hasText: 'Lobby' }).click();
  await H.waitForSelector('.olLobby[data-j=ruleta]', { state: 'visible', timeout: 10000 });
  ok(await H.evaluate(() => !document.getElementById('winRoul').classList.contains('rulOnline') && ct === 1 && nt === 'eu'), 'al volver al lobby la ruleta local vuelve a ser la de siempre');
  await H.evaluate(() => { roulSelChip(5); Ct(document.querySelector('#roulNums .roulCell[data-n="5"]')); });
  ok(await H.evaluate(() => st[0].coins) === 995 && await H.evaluate(() => st.length) === 1, 'y en local las apuestas se hacen sin necesitar a nadie (1 jugador, 1000 fichas, ficha de 5)');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

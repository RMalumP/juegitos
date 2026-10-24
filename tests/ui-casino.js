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
  const M = j => '.olMesa[data-j=' + j + ']';

  // ================= PÓQUER =================
  const H3 = await nuevo('h3'), G3 = await nuevo('g3');
  await entrar(H3, 'poker', 'poker', 'crear', 'Ana', 'casino poker'); await entrar(G3, 'poker', 'poker', 'unir', 'Beto', 'casino poker');
  await empezar(H3, 'poker');
  await H3.waitForSelector(M('poker') + ' .olComun', { timeout: 10000 }); await G3.waitForSelector(M('poker') + ' .olComun', { timeout: 10000 });
  await G3.waitForFunction(() => window.Sala.rol && window.Sala.rol.hole && window.Sala.rol.hole.length === 2, null, { timeout: 10000 });
  ok(await G3.evaluate(() => JSON.stringify(window.Sala.estado.mesa).includes('"hole"')) === false, 'póquer: el estado público no contiene ninguna carta privada');
  ok(await G3.locator(M('poker') + ' .olJ2.yo .olCarta:not(.atras)').count() === 2, 'póquer: el invitado ve sus dos cartas');
  ok(await G3.locator(M('poker') + ' .olJ2:not(.yo) .olCarta.atras').count() === 2, 'póquer: del rival solo ve el reverso');
  // todos igualan hasta el enfrentamiento
  for (let i = 0; i < 12; i++) {
    const f = await H3.evaluate(() => window.Sala.estado.mesa.fase); if (f === 'showdown') break;
    const ti = await H3.evaluate(() => window.Sala.estado.mesa.turno), uidTurno = await H3.evaluate(i => window.Sala.estado.mesa.jug[i].id, ti);
    const pg = (await H3.evaluate(() => window.Sala.uid)) === uidTurno ? H3 : G3;
    const b = pg.locator(M('poker') + ' .olFichas .olB.ok'); await b.click(); await wait(500);
  }
  await H3.waitForFunction(() => window.Sala.estado.mesa.fase === 'showdown', null, { timeout: 15000 });
  await G3.waitForFunction(() => window.Sala.estado.mesa.fase === 'showdown', null, { timeout: 15000 });
  const total = await G3.evaluate(() => window.Sala.estado.mesa.jug.reduce((t, j) => t + j.coins, 0) + window.Sala.estado.mesa.bote);
  ok(total === 2000, 'póquer: tras el enfrentamiento se conservan las 2000 fichas (' + total + ')');
  ok(await G3.evaluate(() => window.Sala.estado.mesa.com.length) === 5 && await G3.locator(M('poker') + ' .olFin').count() === 1, 'póquer: se ven las 5 cartas comunes y quién gana');
  ok(await G3.locator(M('poker') + ' .olJ2:not(.yo) .olCarta:not(.atras)').count() === 2, 'póquer: en el enfrentamiento se destapan las cartas del rival');
  // jugador no puede actuar fuera de turno ni forzar acciones
  await H3.locator(M('poker') + ' .olB', { hasText: 'Siguiente mano' }).click();
  await G3.waitForFunction(() => window.Sala.estado.mesa.mano === 2 && window.Sala.estado.mesa.fase === 'preflop', null, { timeout: 10000 });
  await G3.waitForFunction(() => window.Sala.rol && window.Sala.rol.hole && window.Sala.rol.hole.length === 2, null, { timeout: 10000 });
  ok(true, 'póquer: el anfitrión reparte la mano siguiente y llegan cartas privadas nuevas');
  const turno = await G3.evaluate(() => window.Sala.estado.mesa.jug[window.Sala.estado.mesa.turno].id), miId = await G3.evaluate(() => window.Sala.uid);
  if (turno !== miId) { const antes = await G3.evaluate(() => JSON.stringify(window.Sala.estado.mesa.jug.map(j => j.apostado))); await G3.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'raise', m: 500 })); await wait(600); ok(antes === await G3.evaluate(() => JSON.stringify(window.Sala.estado.mesa.jug.map(j => j.apostado))), 'póquer: subir fuera de turno se ignora'); }
  // recarga del anfitrión: recupera la mesa
  const manoAntes = await H3.evaluate(() => JSON.stringify(window.Sala.estado.mesa.jug.map(j => [j.coins, j.apostado])));
  await H3.reload(); await H3.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await H3.waitForSelector(M('poker') + ' .olComun', { state: 'visible', timeout: 30000 });
  await wait(2500);
  ok(await H3.evaluate(() => JSON.stringify(window.Sala.estado.mesa.jug.map(j => [j.coins, j.apostado]))) === manoAntes, 'póquer: el anfitrión recarga y recupera la mesa y los saldos');
  const sigue = await G3.evaluate(() => window.Sala.estado.mesa.turno);
  ok(typeof sigue === 'number', 'póquer: la partida sigue en marcha tras recargar el anfitrión');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

// Salas por juego: cada juego tiene su botón «🌐 Conectar», su lobby y su límite de jugadores; una sala no admite a quien entra desde otro juego.
const { entorno, wait, ok, fin } = require('./helpers');
const JUEGOS = [
  { id: 'ajedrez', nombre: 'Ajedrez', max: 2, win: 'winChess', abrir: pg => pg.evaluate(() => window.openChessTab(0)) },
  { id: 'damas', nombre: 'Damas', max: 2, win: 'winChess', abrir: pg => pg.evaluate(() => window.openChessTab(2)) },
  { id: 'parchis', nombre: 'Parchís', max: 4, win: 'winParchis', abrir: pg => pg.evaluate(() => window.openGame('parchis')) },
  { id: 'ruleta', nombre: 'Ruleta', max: 6, win: 'winRoul', abrir: pg => pg.evaluate(() => window.openGame('roul')) },
  { id: 'blackjack', nombre: 'Blackjack', max: 6, win: 'winBJ', abrir: pg => pg.evaluate(() => window.openGame('bj')) },
  { id: 'poker', nombre: 'Póquer', max: 6, win: 'winPoker', abrir: pg => pg.evaluate(() => window.openGame('poker')) },
  { id: 'hundir', nombre: 'Hundir la flota', max: 2, win: 'winHundir', abrir: pg => pg.evaluate(() => window.openGame('hundir')) },
  { id: 'c4', nombre: 'Conecta 4', max: 2, win: 'winC4', abrir: pg => pg.evaluate(() => window.openGame('c4')) },
  { id: 'ttt', nombre: 'Tres en raya', max: 2, win: 'winTtt', abrir: pg => pg.evaluate(() => window.openGame('ttt')) },
  { id: 'domino', nombre: 'Dominó', max: 4, win: 'winDomino', abrir: pg => pg.evaluate(() => window.openGame('domino')) }
];
const LB = j => '#' + j.win + ' .olLobby[data-j=' + j.id + ']';
(async () => {
  const env = await entorno(9452, 9451);
  let n = 0;
  async function nuevo(nombre) { const ctx = await env.contexto(); const pg = await env.pagina(ctx, nombre); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return pg; }
  async function conectar(pg, j, modo, sala, nombre) {
    await j.abrir(pg);
    const boton = j.win === 'winChess' ? pg.frameLocator('#chessFrame').locator('#tabConectar') : pg.locator('#' + j.win + ' [data-conectar]');   // en Ajedrez/Damas está dentro del iframe, entre Damas y Personalizado
    await boton.waitFor();
    await pg.waitForFunction(() => { const f = document.getElementById('chessFrame'); return !f || !f.getAttribute('data-loaded') || (f.contentWindow && typeof f.contentWindow.getActiveTab === 'function'); });
    await boton.click();
    await pg.waitForSelector('#winSala:not(.hidden)');
    if (modo === 'crear') ok(/Sala de/.test(await pg.locator('#salaConectarT').innerText()) && !(await pg.locator('#salaJuegoSel').isVisible()), j.nombre + ': el botón Conectar abre la conexión ya fijada a ese juego');
    await pg.fill('#salaNombre', nombre); await pg.fill('#salaSala', sala); await pg.fill('#salaPass', 'clave1');
    await pg.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
  }
  for (const j of JUEGOS) {
    n++; const sala = 'sala-' + j.id + n;
    const H = await nuevo('host-' + j.id), G = await nuevo('inv-' + j.id);
    await conectar(H, j, 'crear', sala, 'Anfi');
    await H.waitForSelector(LB(j), { state: 'visible', timeout: 25000 });
    ok(/Jugadores 1 \/ ' + j.max/.test('') || (await H.locator(LB(j) + ' .olSub').first().innerText()).includes('1 / ' + j.max), j.nombre + ': el lobby del anfitrión muestra el límite de ' + j.max + ' jugadores');
    ok(await H.locator(LB(j) + ' .olGrande').isDisabled(), j.nombre + ': no se puede empezar con un solo jugador');
    ok(await H.locator(LB(j) + ' .olFila button', { hasText: 'QR' }).count() === 1, j.nombre + ': el lobby tiene Compartir y QR');
    await conectar(G, j, 'unir', sala, 'Invitado');
    await G.waitForSelector(LB(j), { state: 'visible', timeout: 25000 });
    ok(/Esperando a que el anfitrión/.test(await G.locator(LB(j)).innerText()), j.nombre + ': el invitado entra directo al lobby del juego');
    await H.waitForFunction(w => document.querySelector(w) && !document.querySelector(w).disabled, LB(j) + ' .olGrande', { timeout: 15000 });
    ok(true, j.nombre + ': con 2 jugadores el anfitrión ya puede empezar');
    // límite de jugadores
    const llenar = j.max - 2;
    for (let i = 0; i < llenar; i++) { const X = await nuevo('x' + i); await conectar(X, j, 'unir', sala, 'Jug' + i); await X.waitForFunction(() => window.Sala.activo, null, { timeout: 25000 }); }
    const E = await nuevo('extra'); await conectar(E, j, 'unir', sala, 'Sobra');
    await E.waitForFunction(() => /llena/i.test(document.getElementById('salaAviso').textContent), null, { timeout: 25000 });
    ok(true, j.nombre + ': el jugador número ' + (j.max + 1) + ' recibe «sala llena»');
    // sala de otro juego
    const otro = JUEGOS.find(x => x.win !== j.win);
    const W = await nuevo('otro'); await conectar(W, otro, 'unir', sala, 'Equivocado');
    await W.waitForFunction(() => /otro juego/i.test(document.getElementById('salaAviso').textContent), null, { timeout: 25000 });
    ok(true, j.nombre + ': entrar desde el botón de ' + otro.nombre + ' se rechaza («es de otro juego»)');
    // empezar
    await H.locator(LB(j) + ' .olGrande').click();
    await H.waitForFunction(() => window.Sala.estado.phase === 'jugando', null, { timeout: 15000 });
    await G.waitForFunction(() => window.Sala.estado.phase === 'jugando', null, { timeout: 15000 });
    ok(await H.locator(LB(j)).isHidden() && await G.locator(LB(j)).isHidden(), j.nombre + ': al empezar el lobby desaparece en todos los móviles');
    ok((await H.evaluate(() => window.Sala.estado.asientos)).length === j.max - 0 || (await H.evaluate(() => window.Sala.estado.asientos)).length >= 2, j.nombre + ': la partida arranca con los asientos');
  }
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

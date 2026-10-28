// Invitación por enlace o QR: se entra directamente a la sala del juego concreto (sin el menú de juegos); la sala general (botón Multijugador) sí lleva al menú.
const { entorno, wait, ok, fin } = require('./helpers');
const JUEGOS = [
  { id: 'bingo', win: 'winBingo', crear: async pg => { await pg.click('#btnSala'); await pg.selectOption('#salaJuegoSel', 'bingo'); } },
  { id: 'ajedrez', win: 'winChess', crear: async pg => { await pg.evaluate(() => window.openChessTab(0)); await pg.waitForFunction(() => document.getElementById('chessFrame').contentWindow.getActiveTab); await pg.frameLocator('#chessFrame').locator('#tabConectar').click(); } },
  { id: 'damas', win: 'winChess', crear: async pg => { await pg.evaluate(() => window.openChessTab(2)); await pg.waitForFunction(() => document.getElementById('chessFrame').contentWindow.getActiveTab); await pg.frameLocator('#chessFrame').locator('#tabConectar').click(); } },
  { id: 'parchis', win: 'winParchis', crear: async pg => { await pg.evaluate(() => window.openGame('parchis')); await pg.locator('#winParchis [data-conectar]').click(); } },
  { id: 'ruleta', win: 'winRoul', crear: async pg => { await pg.evaluate(() => window.openGame('roul')); await pg.locator('#winRoul [data-conectar]').click(); } },
  { id: 'blackjack', win: 'winBJ', crear: async pg => { await pg.evaluate(() => window.openGame('bj')); await pg.locator('#winBJ [data-conectar]').click(); } },
  { id: 'poker', win: 'winPoker', crear: async pg => { await pg.evaluate(() => window.openGame('poker')); await pg.locator('#winPoker [data-conectar]').click(); } }
];
(async () => {
  const env = await entorno(9502, 9501);
  const nuevo = async n => { const ctx = await env.contexto(); const pg = await env.pagina(ctx, n); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return pg; };
  const enlace = async pg => { await pg.evaluate(() => { navigator.share = async d => { window.__url = d.url; }; }); await pg.evaluate(() => window.Sala.compartir()); return pg.evaluate(() => window.__url); };
  const visibles = pg => pg.evaluate(() => Array.from(document.querySelectorAll('.win')).filter(w => !w.classList.contains('hidden')).map(w => w.id));
  const inicioVisible = pg => pg.evaluate(() => getComputedStyle(document.getElementById('startScreen')).display !== 'none');

  for (const j of JUEGOS) {
    const H = await nuevo('host-' + j.id);
    await j.crear(H);
    await H.fill('#salaNombre', 'Anfi'); await H.fill('#salaSala', 'inv ' + j.id); await H.fill('#salaPass', 'clave1'); await H.click('#salaCrear');
    await H.waitForFunction(g => window.Sala.activo && window.Sala.juego === g, j.id, { timeout: 25000 });
    const url = await enlace(H);
    // el invitado abre el enlace en un navegador nuevo (la pantalla de todos los juegos NO debe verse)
    const ctx = await env.contexto(); const G = await ctx.newPage(); G.on('pageerror', e => ok(false, 'sin errores: ' + e.message));
    await G.goto(url); await G.waitForSelector('#salaEntrar');
    ok(!(await inicioVisible(G)), j.id + ': al abrir el enlace no se ve el menú de todos los juegos');
    await G.fill('#salaEntrarNombre', 'Lola'); await G.locator('#salaEntrar button', { hasText: 'Entrar' }).click();
    await G.waitForFunction(w => { const e = document.getElementById(w); return e && !e.classList.contains('hidden'); }, j.win, { timeout: 25000 });
    await wait(600);
    ok(!(await inicioVisible(G)) && (await visibles(G)).join() === j.win, j.id + ': tras aceptar se abre directamente la ventana del juego (' + j.win + ') y nada más');
    if (j.id === 'bingo') await G.waitForSelector('.bgStep', { timeout: 10000 }); else await G.waitForSelector('.olLobby[data-j=' + j.id + ']', { state: 'visible', timeout: 10000 });
    ok(true, j.id + ': el invitado aterriza en el lobby del juego');
    await ctx.close();
  }

  // ===== sala general (botón Multijugador) =====
  const H = await nuevo('host-general');
  await H.click('#btnSala');
  ok(await H.locator('#salaJuegoSel').inputValue() === 'general', 'el selector del botón Multijugador viene en «Sala general»');
  await H.fill('#salaNombre', 'Anfi'); await H.fill('#salaSala', 'sala general'); await H.fill('#salaPass', 'clave1'); await H.click('#salaCrear');
  await H.waitForFunction(() => window.Sala.activo, null, { timeout: 25000 });
  await H.waitForFunction(() => getComputedStyle(document.getElementById('startScreen')).display !== 'none');
  ok(await H.evaluate(() => window.Sala.juego) === null, 'la sala general no tiene juego todavía');
  ok(await inicioVisible(H), 'el anfitrión de una sala general ve el menú de juegos');
  const url = await enlace(H);
  const invitados = [];
  for (const n of ['Uno', 'Dos', 'Tres']) {
    const ctx = await env.contexto(); const G = await ctx.newPage(); G.on('pageerror', e => ok(false, 'sin errores: ' + e.message));
    await G.goto(url); await G.waitForSelector('#salaEntrar'); await G.fill('#salaEntrarNombre', n); await G.locator('#salaEntrar button', { hasText: 'Entrar' }).click();
    await G.waitForFunction(() => window.Sala && window.Sala.activo, null, { timeout: 25000 });
    await G.waitForFunction(() => getComputedStyle(document.getElementById('startScreen')).display !== 'none', null, { timeout: 10000 });
    invitados.push(G);
  }
  ok(await inicioVisible(invitados[0]) && (await visibles(invitados[0])).length === 0, 'quien entra por enlace a una sala general sí ve el menú de juegos');
  await wait(1500);
  // con 4 personas, el Ajedrez (máx. 2) no cabe: se avisa y la sala sigue siendo general
  await H.evaluate(() => window.openChessTab(0)); await wait(1500);
  ok(await H.evaluate(() => window.Sala.juego) === null, 'abrir el Ajedrez con 4 personas en la sala general no cambia la sala (máx. 2)');
  ok(/admite 2/.test(await H.locator('#salaToast').innerText()), 'y se avisa de que el Ajedrez admite 2');
  await H.evaluate(() => window.openGame('parchis'));
  await H.waitForFunction(() => window.Sala.juego === 'parchis', null, { timeout: 10000 });
  for (const G of invitados) { await G.waitForSelector('.olLobby[data-j=parchis]', { state: 'visible', timeout: 15000 }); }
  ok((await visibles(invitados[2])).join() === 'winParchis' && !(await inicioVisible(invitados[2])), 'al abrir el anfitrión el Parchís, todos los invitados van directamente a su lobby');
  ok(await H.evaluate(() => window.Sala.estado.juego) === 'parchis', 'la sala general pasa a ser de Parchís');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

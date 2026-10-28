// Ajedrez y Damas online: jugadas sincronizadas, turnos, color a elegir/azar, validación del anfitrión, rendición, recarga y volver al lobby.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9462, 9461);
  const nuevo = async n => { const ctx = await env.contexto(); const pg = await env.pagina(ctx, n); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return pg; };
  const sala = async (pg, juego, modo, nombre) => {
    await pg.evaluate(j => (j === 'damas' ? window.openChessTab(2) : window.openChessTab(0)), juego);
    await pg.waitForFunction(() => { const f = document.getElementById('chessFrame'); return f && f.contentWindow && typeof f.contentWindow.getActiveTab === 'function'; });
    await pg.frameLocator('#chessFrame').locator('#tabConectar').click();
    await pg.fill('#salaNombre', nombre); await pg.fill('#salaSala', 'tablero ' + juego); await pg.fill('#salaPass', 'clave1');
    await pg.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await pg.waitForSelector('#winChess .olLobby[data-j=' + juego + ']', { state: 'visible', timeout: 25000 });
  };
  const F = (pg, js, arg) => pg.evaluate(([js, arg]) => { const w = document.getElementById('chessFrame').contentWindow; return w.eval('(function(arg){' + js + '})')(arg); }, [js, arg]);
  const click = (pg, r, c) => F(pg, 'chessClick(arg[0],arg[1])', [r, c]);
  const pieza = (pg, r, c) => F(pg, 'return chess.board[arg[0]][arg[1]]', [r, c]);

  // el botón «Conectar» está en la barra de pestañas, en un recuadro entre Damas y Personalizado
  {
    const pg0 = await nuevo('pestanas');
    await pg0.evaluate(() => window.openChessTab(0)); await pg0.waitForFunction(() => document.getElementById('chessFrame').contentWindow.getActiveTab);
    const tabs = await pg0.frameLocator('#chessFrame').locator('.tabs').locator('.tab-btn').allInnerTexts();
    ok(JSON.stringify(tabs.map(t => t.trim())) === JSON.stringify(['♟ Ajedrez', '⏱ Reloj', '⛀ Damas', '🎨 Personalizado']), 'Ajedrez/Damas: las pestañas son Ajedrez, Reloj, Damas y Personalizado (' + tabs.join(' | ') + ')');
    const caja = await pg0.frameLocator('#chessFrame').locator('.title-bar .title-actions').first().locator('button').evaluateAll(bs => bs.map(b => b.id || b.title));
    ok(caja[0] === 'tabConectar' && /Diseño/.test(caja[1]) && await pg0.locator('#winChess .menuBar').count() === 0, 'Ajedrez/Damas: «🌐» (Conectar) va a la izquierda del botón de diseño del tablero (' + caja.join(' | ') + ')');
    ok(await pg0.frameLocator('#chessFrame').locator('.split-btn .split-half').count() === 2, 'Ajedrez/Damas: guardar y cargar archivo forman un solo círculo partido');
    await pg0.context().close();
  }

  // ================= AJEDREZ =================
  let H = await nuevo('host'), G = await nuevo('invitado');
  await sala(H, 'ajedrez', 'crear', 'Anfi'); await sala(G, 'ajedrez', 'unir', 'Invi');
  await H.waitForFunction(() => document.querySelector('#winChess .olLobby[data-j=ajedrez] .olGrande') && !document.querySelector('#winChess .olLobby[data-j=ajedrez] .olGrande').disabled, null, { timeout: 15000 });
  ok(/Azar/.test(await H.locator('.olLobby[data-j=ajedrez] .olOp').innerText()) && await H.locator('.olLobby[data-j=ajedrez] .olOp .olBtn.on').innerText() === '🎲 Azar', 'el color por defecto es «Azar» y hay botones para cambiarlo');
  await H.locator('.olLobby[data-j=ajedrez] .olOp .olBtn', { hasText: 'Blancas' }).click();
  await G.waitForFunction(() => window.Sala.estado.op && window.Sala.estado.op.color === 'w', null, { timeout: 8000 });
  ok(/Blancas/.test(await G.locator('.olLobby[data-j=ajedrez]').innerText()), 'el invitado ve el color que ha elegido el anfitrión');
  await H.locator('.olLobby[data-j=ajedrez] .olGrande').click();
  await H.waitForSelector('.olBarra.on'); await G.waitForSelector('.olBarra.on');
  ok(await H.evaluate(() => window.Sala.estado.colores[window.Sala.uid]) === 'w' && await G.evaluate(() => window.Sala.estado.colores[window.Sala.uid]) === 'b', 'el anfitrión juega con blancas y el invitado con negras');
  ok(await F(G, 'return chess.rotationMode') === 1 && await F(H, 'return chess.rotationMode') === 0, 'el invitado ve el tablero desde el lado de las negras');
  ok(/Tu turno/.test(await H.locator('.olBarra').innerText()) && /rival/.test(await G.locator('.olBarra').innerText()), 'la barra indica de quién es el turno');

  await click(G, 1, 4); await click(G, 3, 4);                                    // negras intentan mover en turno de blancas
  ok(await pieza(G, 3, 4) === ' ' && await pieza(G, 1, 4) === 'p', 'fuera de turno no se puede mover');
  await click(H, 6, 4); await click(H, 4, 4);                                    // e4
  await G.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('chess').board[4][4] === 'P', null, { timeout: 8000 });
  ok(true, 'la jugada del anfitrión (e4) aparece en el tablero del invitado');
  await click(G, 1, 4); await click(G, 3, 4);                                    // e5
  await H.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('chess').board[3][4] === 'p', null, { timeout: 8000 });
  ok(true, 'la respuesta del invitado (e5) llega al anfitrión');
  // jugada ilegal inyectada por el invitado: el anfitrión la ignora
  await G.evaluate(() => window.Sala.enviar('host', { tipo: 'jugada', a: 'aj', fr: 6, fc: 0, tr: 3, tc: 0 }));
  await G.evaluate(() => window.Sala.enviar('host', { tipo: 'jugada', a: 'aj', fr: 0, fc: 0, tr: 5, tc: 0 }));   // torre negra atravesando piezas, y además fuera de turno
  await wait(1200);
  ok(await pieza(H, 3, 0) === ' ' && await pieza(H, 6, 0) === 'P' && await pieza(H, 5, 0) === ' ', 'el anfitrión rechaza jugadas ilegales o fuera de turno enviadas a mano');
  // recarga del invitado: se reconstruye
  await G.reload(); await G.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await G.waitForFunction(() => window.Sala && window.Sala.activo && window.Sala.estado.phase === 'jugando', null, { timeout: 30000 });
  await G.waitForFunction(() => { const f = document.getElementById('chessFrame'); return f && f.contentWindow && f.contentWindow.__ol; }, null, { timeout: 30000 }).catch(() => {});
  await G.waitForFunction(() => { try { const w = document.getElementById('chessFrame').contentWindow; return w.eval('chess').board[4][4] === 'P' && w.eval('chess').board[3][4] === 'p'; } catch (e) { return false; } }, null, { timeout: 30000 });
  ok(true, 'el invitado recarga la página y recupera la partida (e4 y e5)');
  // rendición
  G.once('dialog', d => d.accept());
  await G.locator('.olBarra button', { hasText: 'Rendirse' }).click();
  await H.waitForFunction(() => window.Sala.estado.phase === 'fin', null, { timeout: 10000 });
  ok(/Gana\s*Blancas/.test(await H.locator('.olBarra').innerText()), 'al rendirse el invitado, gana el anfitrión (blancas)');
  H.once('dialog', d => d.accept());
  await H.locator('.olBarra button', { hasText: 'Lobby' }).click();
  await G.waitForSelector('.olLobby[data-j=ajedrez]', { state: 'visible', timeout: 10000 });
  ok(await F(H, 'return chess.history.length') === 0, 'el anfitrión vuelve al lobby y el tablero se reinicia');
  // segunda partida: el anfitrión con negras
  await H.locator('.olLobby[data-j=ajedrez] .olOp .olBtn', { hasText: 'Negras' }).click(); await wait(500);
  await H.locator('.olLobby[data-j=ajedrez] .olGrande').click();
  await H.waitForFunction(() => window.Sala.estado.phase === 'jugando' && window.Sala.estado.colores, null, { timeout: 10000 });
  ok(await H.evaluate(() => window.Sala.estado.colores[window.Sala.uid]) === 'b', 'en la segunda partida el anfitrión juega con negras');
  await click(G, 6, 3); await click(G, 4, 3);                                   // d4 (el invitado ahora tiene blancas)
  await H.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('chess').board[4][3] === 'P', null, { timeout: 8000 });
  ok(true, 'las jugadas funcionan también con los colores cambiados');

  // ================= DAMAS =================
  const H2 = await nuevo('host2'), G2 = await nuevo('inv2');
  await sala(H2, 'damas', 'crear', 'Anfi'); await sala(G2, 'damas', 'unir', 'Invi');
  await H2.waitForFunction(() => document.querySelector('#winChess .olLobby[data-j=damas] .olGrande') && !document.querySelector('#winChess .olLobby[data-j=damas] .olGrande').disabled, null, { timeout: 15000 });
  await H2.locator('.olLobby[data-j=damas] .olOp .olBtn', { hasText: 'Blancas' }).click(); await wait(500);
  await H2.locator('.olLobby[data-j=damas] .olGrande').click();
  await H2.waitForSelector('.olBarra.on'); await G2.waitForSelector('.olBarra.on');
  const ck = (pg, r, c) => F(pg, 'checkersClick(arg[0],arg[1])', [r, c]);
  const ckp = (pg, r, c) => F(pg, 'return ck.board[arg[0]][arg[1]]', [r, c]);
  await ck(G2, 2, 1); await ck(G2, 3, 0);
  ok(await ckp(G2, 3, 0) === 0, 'damas: fuera de turno no se mueve');
  await ck(H2, 5, 0); await ck(H2, 4, 1);
  await G2.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('ck').board[4][1] === 1, null, { timeout: 8000 });
  ok(true, 'damas: la jugada del anfitrión llega al invitado');
  await ck(G2, 2, 1); await ck(G2, 3, 0);
  await H2.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('ck').board[3][0] === 2, null, { timeout: 8000 });
  ok(true, 'damas: la respuesta del invitado llega al anfitrión');
  ok(await F(G2, 'return document.getElementById("olEstilo") && document.getElementById("olEstilo").textContent.includes("rotate(180deg)")'), 'damas: el invitado (negras) ve el tablero girado');
  // captura obligatoria con salto: blancas 4,1 captura 3,0? no (borde). Se comprueba un salto real
  await F(H2, 'ck.board=Array.from({length:8},()=>Array(8).fill(0));ck.board[5][2]=1;ck.board[4][3]=2;ck.board[2][5]=0;ck.turn=1;ck.mustCapture=null;ck.selected=null;ck.possibleMoves=[];renderCheckersBoard()');
  await F(G2, 'ck.board=Array.from({length:8},()=>Array(8).fill(0));ck.board[5][2]=1;ck.board[4][3]=2;ck.turn=1;ck.mustCapture=null;ck.selected=null;ck.possibleMoves=[];renderCheckersBoard()');
  await ck(H2, 5, 2); await ck(H2, 3, 4);
  await G2.waitForFunction(() => { const b = document.getElementById('chessFrame').contentWindow.eval('ck').board; return b[3][4] === 1 && b[4][3] === 0; }, null, { timeout: 8000 });
  ok(true, 'damas: una captura (salto) se sincroniza y retira la pieza capturada');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

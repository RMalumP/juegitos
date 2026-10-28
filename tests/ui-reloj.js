// Relojes de ajedrez online: mismo tiempo en los dos móviles; cada uno corre el suyo y se sincronizan al iniciar, pausar, reiniciar y cambiar de turno.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9512, 9511);
  const nuevo = async n => { const ctx = await env.contexto(); const pg = await env.pagina(ctx, n); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return pg; };
  const F = (pg, js, arg) => pg.evaluate(([js, arg]) => { const w = document.getElementById('chessFrame').contentWindow; return w.eval('(function(arg){' + js + '})')(arg); }, [js, arg]);
  const reloj = pg => F(pg, 'return {mode:chessClock.mode,started:chessClock.started,running:chessClock.running,turn:chessClock.turn,w:Math.round(chessClock.times.w),b:Math.round(chessClock.times.b)}');
  const grande = pg => F(pg, 'return {running:bigClock.running,turn:bigClock.turn,w:Math.round(bigClock.times.w),b:Math.round(bigClock.times.b)}');
  const casi = (a, b, tol) => Math.abs(a - b) <= tol;
  const H = await nuevo('host'), G = await nuevo('invitado');
  for (const [pg, modo, n] of [[H, 'crear', 'Anfi'], [G, 'unir', 'Invi']]) {
    await pg.evaluate(() => window.openChessTab(0));
    await pg.waitForFunction(() => document.getElementById('chessFrame').contentWindow.getActiveTab);
    await pg.frameLocator('#chessFrame').locator('#tabConectar').click();
    await pg.fill('#salaNombre', n); await pg.fill('#salaSala', 'reloj'); await pg.fill('#salaPass', 'clave1'); await pg.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await pg.waitForSelector('.olLobby[data-j=ajedrez]', { state: 'visible', timeout: 25000 });
  }
  // el anfitrión prepara el reloj (3 min, automático) ANTES de empezar y el invitado tiene otro distinto
  await F(H, 'document.getElementById("chessClockPreset").value="180000"; chessClockPresetChange(); chessClockSetMode("auto")');
  await F(G, 'document.getElementById("chessClockPreset").value="900000"; chessClockPresetChange(); chessClockSetMode("manual")');
  await H.waitForFunction(() => { const b = document.querySelector('.olLobby[data-j=ajedrez] .olGrande'); return b && !b.disabled; }, null, { timeout: 15000 });
  await H.locator('.olLobby[data-j=ajedrez] .olOp .olBtn', { hasText: 'Blancas' }).click(); await wait(400);
  await H.locator('.olLobby[data-j=ajedrez] .olGrande').click();
  await H.waitForFunction(() => window.Sala.estado.phase === 'jugando', null, { timeout: 10000 });
  await G.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('chessClock').mode === 'auto', null, { timeout: 10000 });
  let a = await reloj(H), b = await reloj(G);
  ok(a.mode === 'auto' && b.mode === 'auto' && a.w === 180000 && b.w === 180000 && a.b === 180000 && b.b === 180000, 'al empezar los dos relojes son iguales (automático, 3:00), aunque el invitado tuviera otro configurado');
  ok(!a.started && !b.started, 'y ninguno corre todavía');

  // el anfitrión inicia: arrancan los dos
  await F(H, 'chessClockAutoToggle()');
  await G.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('chessClock').running === true, null, { timeout: 5000 });
  await wait(1500);
  a = await reloj(H); b = await reloj(G);
  ok(a.running && b.running && a.turn === 'w' && b.turn === 'w', 'el anfitrión inicia el reloj y arranca en los dos móviles');
  ok(casi(a.w, b.w, 700) && a.w < 180000, 'cada móvil corre el suyo y los tiempos coinciden (' + a.w + ' / ' + b.w + ')');

  // el invitado pausa: se paran los dos con el mismo tiempo
  await F(G, 'chessClockAutoToggle()');
  await H.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('chessClock').running === false, null, { timeout: 5000 });
  await wait(600);
  a = await reloj(H); b = await reloj(G);
  ok(!a.running && !b.running && a.w === b.w && a.b === b.b, 'el invitado pausa y se paran los dos con el mismo tiempo exacto (' + a.w + ')');
  const parado = a.w; await wait(1200); a = await reloj(H); ok(a.w === parado, 'en pausa no avanza ninguno');
  // reanuda el anfitrión
  await F(H, 'chessClockAutoToggle()');
  await G.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('chessClock').running === true, null, { timeout: 5000 });
  ok(true, 'al reanudar uno, reanudan los dos');

  // una jugada del anfitrión (blancas) pasa el turno del reloj en los dos
  await F(H, 'chessClick(6,4)'); await F(H, 'chessClick(4,4)');
  await G.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('chess').board[4][4] === 'P', null, { timeout: 8000 });
  await wait(700);
  a = await reloj(H); b = await reloj(G);
  ok(a.turn === 'b' && b.turn === 'b' && casi(a.b, b.b, 800) && casi(a.w, b.w, 300), 'tras la jugada corre el reloj de las negras en los dos y los tiempos siguen iguales');

  // reiniciar el reloj (cambiar de modo) en uno lo reinicia en el otro
  await F(G, 'chessClockSetMode("auto")');
  await H.waitForFunction(() => { const c = document.getElementById('chessFrame').contentWindow.eval('chessClock'); return !c.started && c.times.w >= 179000; }, null, { timeout: 5000 }).catch(() => {});
  a = await reloj(H); b = await reloj(G);
  ok(!a.started && !b.started && a.w === b.w && a.b === b.b, 'al reiniciar el reloj en un móvil se reinicia en el otro (' + a.w + ' / ' + b.w + ')');

  // reloj grande de la pestaña «Reloj»
  await F(H, 'bigClockSetBoth(60000)');
  await G.waitForFunction(() => Math.round(document.getElementById('chessFrame').contentWindow.eval('bigClock').times.w) === 60000, null, { timeout: 5000 });
  await F(G, 'bigClockTap("w")');
  await H.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('bigClock').running === true, null, { timeout: 5000 });
  await wait(1200);
  let g1 = await grande(H), g2 = await grande(G);
  ok(g1.running && g2.running && casi(g1.w, g2.w, 700) && g1.w < 60000, 'el reloj grande: el invitado lo inicia y corre en los dos con el mismo tiempo');
  await F(H, 'bigClockTogglePause()');
  await G.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('bigClock').running === false, null, { timeout: 5000 });
  await wait(500); g1 = await grande(H); g2 = await grande(G);
  ok(g1.w === g2.w && g1.b === g2.b, 'el reloj grande: al pausar se igualan exactamente (' + g1.w + ')');
  await F(H, 'bigClockReset()');
  await G.waitForFunction(() => Math.round(document.getElementById('chessFrame').contentWindow.eval('bigClock').times.w) === 600000, null, { timeout: 5000 });
  ok(true, 'el reloj grande: reiniciar en uno reinicia en el otro');

  // se acaba el tiempo: pierde en los dos
  await F(H, 'chessClock.times.b = 900; chess.gameOver = false;');
  await F(H, 'chessClockSetMode("auto"); chessClock.times={w:60000,b:60000}'); await wait(300);
  await F(H, 'chessClockAutoToggle()'); await wait(300);
  await F(H, 'chessClock.times.w = 800');      // a las blancas les quedan 0,8 s
  await F(H, 'chessClockAutoToggle(); chessClockAutoToggle()');   // pausar + reanudar para que el invitado reciba el tiempo bajo
  await H.waitForFunction(() => window.Sala.estado.phase === 'fin', null, { timeout: 10000 });
  await G.waitForFunction(() => window.Sala.estado.phase === 'fin', null, { timeout: 10000 });
  ok(/tiempo/.test(JSON.stringify(await G.evaluate(() => window.Sala.estado.resultado))) && /Gana\s*Negras/.test(await G.locator('.olBarra').innerText()), 'al agotarse el tiempo de las blancas ganan las negras (por tiempo) en los dos móviles');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

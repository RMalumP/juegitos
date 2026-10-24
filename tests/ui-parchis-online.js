// Parchís online: el anfitrión ejecuta el motor, los invitados pintan su foto y mandan intenciones; bots opcionales; recarga.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9472, 9471);
  const nuevo = async n => { const ctx = await env.contexto(); const pg = await env.pagina(ctx, n); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return pg; };
  const sala = async (pg, modo, nombre, nombreSala) => {
    await pg.evaluate(() => window.openGame('parchis'));
    await pg.waitForSelector('#winParchis [data-conectar]');
    await pg.locator('#winParchis [data-conectar]').click();
    await pg.fill('#salaNombre', nombre); await pg.fill('#salaSala', nombreSala); await pg.fill('#salaPass', 'clave1');
    await pg.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await pg.waitForSelector('#winParchis .olLobby[data-j=parchis]', { state: 'visible', timeout: 25000 });
  };
  const F = (pg, js, arg) => pg.evaluate(([js, arg]) => { const w = document.getElementById('parchisFrame').contentWindow; return w.eval('(function(arg){' + js + '})')(arg); }, [js, arg]);
  const estado = pg => F(pg, 'return G && JSON.stringify({t:G.seats.map(s=>s.tokens),turn:G.turn,phase:G.phase,fin:G.finished})');
  const igual = async (a, b, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await estado(a) === await estado(b)) return true; await wait(250); } return false; };
  // juega un turno de quien le toque (según el anfitrión): tirar y mover la primera ficha posible
  async function turno(H, G, bots) {
    const g = JSON.parse(await estado(H));
    if (g.fin) return g;
    const seatHumano = bots ? [0, 1].includes(g.turn) : true;
    if (!seatHumano) { await wait(900); return g; }
    const pg = g.turn === 0 ? H : G;
    if (g.phase === 'roll') { await F(pg, 'roll()'); await wait(1300); }
    else if (g.phase === 'move') {
      const ti = await F(pg, 'const v=G.value, eff=(v===6&&cur().tokens.every(r=>r!==-1))?7:v; const m=legalTokensEff(cur(), eff); return m.length?m[0].ti:-1');
      if (ti >= 0) await F(pg, 'play(arg)', ti);
      await wait(900);
    } else await wait(300);
    return JSON.parse(await estado(H));
  }

  // ===== 2 personas =====
  let H = await nuevo('host'), G = await nuevo('invitado');
  await sala(H, 'crear', 'Anfi', 'parchis uno'); await sala(G, 'unir', 'Invi', 'parchis uno');
  await H.waitForFunction(() => { const b = document.querySelector('#winParchis .olLobby[data-j=parchis] .olGrande'); return b && !b.disabled; }, null, { timeout: 15000 });
  ok(await H.locator('.olLobby[data-j=parchis] .olOp').count() === 1, 'el lobby de Parchís ofrece la opción de bots');
  await H.locator('.olLobby[data-j=parchis] .olGrande').click();
  await H.waitForFunction(() => { const w = document.getElementById('parchisFrame').contentWindow; try { return w.eval('G') && w.eval('G').seats.length === 2; } catch (e) { return false; } }, null, { timeout: 15000 });
  await G.waitForFunction(() => { const w = document.getElementById('parchisFrame').contentWindow; try { return w.eval('G') && w.eval('G').seats.length === 2; } catch (e) { return false; } }, null, { timeout: 15000 });
  ok(JSON.stringify(await H.evaluate(() => window.Sala.estado.mesa.map(m => m.color))) === '[0,2]', 'con 2 personas los colores son opuestos (rojo y amarillo)');
  ok(await estado(H) === await estado(G), 'ambos móviles ven el mismo tablero al empezar');
  ok(/eres/.test(await G.locator('.olBarra').innerText()) && await G.locator('.olBarra.on').count() === 1, 'la barra dice qué color eres');
  // fuera de turno: el invitado no puede tirar ni mover aunque lo intente
  let g = JSON.parse(await estado(H));
  if (g.turn === 0) { await F(G, 'roll()'); await wait(1200); ok(JSON.parse(await estado(H)).phase === 'roll', 'el invitado no puede tirar en turno del anfitrión'); }
  else { await F(H, 'roll()'); await wait(1200); ok(JSON.parse(await estado(H)).phase === 'roll', 'el anfitrión no puede tirar en turno del invitado'); }
  for (let i = 0; i < 14; i++) await turno(H, G, false);
  ok(await igual(H, G), 'tras 14 pasos de juego, los dos móviles muestran exactamente el mismo estado');
  const eH = await estado(H);
  const movs = JSON.parse(eH).t.flat().filter(r => r > 0).length; ok(movs >= 1, 'se han movido fichas (' + movs + ')');
  // intención inválida de un invitado enviada a mano
  const antes = await estado(H);
  await G.evaluate(() => { window.Sala.enviar('host', { tipo: 'accion', a: 'play', ti: 3 }); window.Sala.enviar('host', { tipo: 'accion', a: 'play', ti: 99 }); window.Sala.enviar('host', { tipo: 'accion', a: 'roll' }); });
  await wait(1500);
  const despues = JSON.parse(await estado(H)); const ant = JSON.parse(antes);
  ok(await igual(H, G) && despues.t.flat().filter(r => r > 0).length >= ant.t.flat().filter(r => r > 0).length - 1, 'mensajes manuales del invitado no rompen la partida');
  // recarga del invitado
  const previo = await estado(H);
  await G.reload(); await G.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await G.waitForFunction(() => window.Sala && window.Sala.activo && window.Sala.estado.g, null, { timeout: 30000 });
  await G.waitForFunction(() => { try { const w = document.getElementById('parchisFrame').contentWindow; return w.eval('G') && w.eval('G').seats.length === 2; } catch (e) { return false; } }, null, { timeout: 30000 });
  ok(await igual(H, G), 'el invitado recarga y recupera exactamente el tablero del anfitrión');
  // volver al lobby
  H.once('dialog', d => d.accept());
  await H.locator('.olBarra button', { hasText: 'Lobby' }).click();
  await G.waitForSelector('.olLobby[data-j=parchis]', { state: 'visible', timeout: 10000 });
  ok(true, 'el anfitrión vuelve al lobby y el invitado también');

  // ===== con bots =====
  await H.locator('.olLobby[data-j=parchis] .olOp .olBtn', { hasText: 'Completar' }).click(); await wait(600);
  await H.locator('.olLobby[data-j=parchis] .olGrande').click();
  await H.waitForFunction(() => { const w = document.getElementById('parchisFrame').contentWindow; try { return w.eval('G') && w.eval('G').seats.length === 4; } catch (e) { return false; } }, null, { timeout: 15000 });
  ok(await F(H, 'return G.seats.map(s=>s.cpu).join()') === 'false,false,true,true', 'con bots hay 4 asientos: 2 personas y 2 bots');
  let pasos = 0, vistoBot = false;
  for (; pasos < 40 && !vistoBot; pasos++) { const e = await turno(H, G, true); if (e.turn >= 2) vistoBot = true; }
  ok(vistoBot, 'el turno llega a los bots y estos juegan solos');
  ok(await igual(H, G, 15000), 'con bots, anfitrión e invitado siguen viendo lo mismo');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

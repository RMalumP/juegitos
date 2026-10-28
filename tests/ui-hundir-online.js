// Hundir la flota ONLINE: sala, opciones, colocación en secreto, validación del anfitrión, turnos, privacidad del estado, recarga, rendición y revancha.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9472, 9471);
  const nuevo = async n => { const ctx = await env.contexto({ viewport: { width: 420, height: 800 } }); const pg = await env.pagina(ctx, n); pg.on('dialog', d => d.accept()); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return pg; };
  const sala = async (pg, modo, nombre) => {
    await pg.evaluate(() => { window.PasarMovil && (window.PasarMovil.retardo = 0); });
    await pg.evaluate(() => window.openGame('hundir')); await wait(500);
    await pg.locator('#winHundir [data-conectar]').click();
    await pg.fill('#salaNombre', nombre); await pg.fill('#salaSala', 'flota online'); await pg.fill('#salaPass', 'clave1');
    await pg.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await pg.waitForSelector('#winHundir .olLobby[data-j=hundir]', { state: 'visible', timeout: 25000 });
  };
  const est = pg => pg.evaluate(() => window.hundirEstado());
  const status = pg => pg.locator('#hunStatus').innerText();
  const boton = (pg, t) => pg.locator('#hunBtns button', { hasText: t });
  const pub = pg => pg.evaluate(() => window.Sala.estado.hf);
  async function colocar(pg) { await pg.waitForSelector('#hunBtns button'); await boton(pg, 'Aleatorio').click(); await boton(pg, 'Listo').click(); }
  async function jugarHastaElFinal(H, G) {
    for (let i = 0; i < 700; i++) {
      if (await H.locator('#hunFin').isVisible() && await G.locator('#hunFin').isVisible()) return true;
      let movido = false;
      for (const pg of [H, G]) {
        if ((await status(pg)).includes('Tu turno')) {
          const c = pg.locator('#hunEnemy .hunC:not(:disabled)').first();
          if (await c.count()) { await c.click(); movido = true; await wait(40); }
        }
      }
      if (!movido) await wait(60);
    }
    return false;
  }

  const H = await nuevo('host'), G = await nuevo('invitado');
  await sala(H, 'crear', 'Anfi'); await sala(G, 'unir', 'Invi');
  await H.waitForFunction(() => { const b = document.querySelector('#winHundir .olLobby[data-j=hundir] .olGrande'); return b && !b.disabled; }, null, { timeout: 15000 });
  ok(/tocándose/.test(await H.locator('.olLobby[data-j=hundir]').innerText()), 'lobby: el anfitrión ve las opciones de reglas');
  await H.locator('.olLobby[data-j=hundir] .olOp', { hasText: 'tocándose' }).locator('.olBtn', { hasText: 'No' }).click();
  await G.waitForFunction(() => window.Sala.estado.op && window.Sala.estado.op.tocar === false, null, { timeout: 8000 });
  ok(/no/.test(await G.locator('.olLobby[data-j=hundir] .olNota').first().innerText()), 'lobby: el invitado ve la regla elegida (barcos sin tocarse)');
  await H.locator('.olLobby[data-j=hundir] .olGrande').click();
  await H.waitForFunction(() => window.hundirEstado().modo === 'online', null, { timeout: 15000 });
  await G.waitForFunction(() => window.hundirEstado().modo === 'online', null, { timeout: 15000 });
  ok((await status(H)).includes('Coloca') && (await status(G)).includes('Coloca'), 'los dos jugadores empiezan colocando su flota');
  ok(await H.locator('.olBarra.on').count() === 1 && /contra Invi/.test(await H.locator('.olBarra').innerText()), 'la barra online dice contra quién juegas');

  // el anfitrión coloca; el invitado intenta colar una flota ilegal (barcos solapados)
  await colocar(H);
  await H.waitForFunction(() => window.Sala.estado.hf && window.Sala.estado.hf.listos[0] === true, null, { timeout: 8000 });
  ok((await status(H)).includes('Esperando'), 'el anfitrión espera a que el rival coloque');
  await G.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'colocar', f: '5,0,0,1;4,0,1,1;3,0,2,1;3,0,3,1;2,0,4,1' }));
  await wait(800);
  ok((await pub(G)).listos[1] === false, 'el anfitrión rechaza una flota ilegal enviada a mano');
  await G.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'disparar', c: 5 }));
  await wait(500);
  ok((await pub(G)).shots[1].length === 0 && (await pub(G)).fase === 'colocando', 'no se puede disparar mientras se coloca');
  await colocar(G);
  await G.waitForFunction(() => window.Sala.estado.hf && window.Sala.estado.hf.fase === 'jugando', null, { timeout: 8000 });
  await H.waitForFunction(() => window.Sala.estado.hf && window.Sala.estado.hf.fase === 'jugando', null, { timeout: 8000 });
  ok(true, 'con las dos flotas listas empieza la batalla');
  const p = await pub(G);
  ok(p.flotas === null && !JSON.stringify(p).includes('"r":') , 'el estado público que recibe el invitado NO lleva flotas');
  ok(await G.locator('#hunOwn .barco').count() === 17 && await H.locator('#hunOwn .barco').count() === 17, 'cada jugador ve su propia flota (17 casillas)');
  const rolG = await G.evaluate(() => window.Sala.rol);
  ok(rolG && rolG.hundir && typeof rolG.hundir.flota === 'string', 'el invitado recibe solo su flota por el canal privado');
  const miFlotaH = await H.evaluate(() => Array.from(document.querySelectorAll('#hunOwn .hunC')).map((b, i) => b.classList.contains('barco') ? i : -1).filter(i => i >= 0));
  ok(!JSON.stringify(await G.evaluate(() => window.Sala.estado)).includes(JSON.stringify(miFlotaH)), 'la flota del anfitrión no aparece en nada que reciba el invitado');

  // turno: dispara el que tenga el turno; el otro intenta disparar fuera de turno
  const turno = (await pub(H)).turno;
  const quien = turno === 0 ? H : G, otro = turno === 0 ? G : H, idx = turno === 0 ? 1 : 0;
  await otro.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'disparar', c: 7 })).catch(() => {});
  if (turno === 0) await wait(500);                                         // (si el que intenta es el anfitrión, ya lo valida el propio árbitro)
  ok((await pub(H)).shots[1 - turno].length === 0, 'un disparo fuera de turno se ignora');
  await quien.locator('#hunEnemy .hunC:not(:disabled)').first().click();
  await otro.waitForFunction(() => window.Sala.estado.hf.shots.some(s => s.length > 0), null, { timeout: 8000 });
  ok(/→/.test(await status(otro)) || /Tu turno/.test(await status(otro)), 'el rival ve el resultado del disparo y pasa a ser su turno');

  // recarga del invitado a mitad de partida: recupera su flota y el estado
  await G.reload(); await G.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await G.waitForFunction(() => window.Sala && window.Sala.activo && window.Sala.estado.hf, null, { timeout: 30000 });
  await G.waitForFunction(() => document.querySelectorAll('#hunOwn .barco').length === 17, null, { timeout: 30000 });
  ok(true, 'el invitado recarga la página y recupera su flota y la partida');

  // partida completa
  ok(await jugarHastaElFinal(H, G), 'la partida online termina en los dos móviles');
  const a = await H.locator('#hunFinT').innerText(), b = await G.locator('#hunFinT').innerText();
  ok(/VICTORIA/.test(a) !== /VICTORIA/.test(b), 'uno gana y el otro pierde («' + a + '» / «' + b + '»)');
  ok((await pub(G)).flotas !== null, 'al terminar se revelan las flotas');
  ok(await H.locator('#hunFinBtn').isEnabled() && await G.locator('#hunFinBtn').isDisabled(), 'solo el anfitrión puede volver al lobby');

  // revancha: lobby y rendición
  await H.click('#hunFinBtn');
  await G.waitForSelector('#winHundir .olLobby[data-j=hundir]', { state: 'visible', timeout: 15000 });
  await H.waitForSelector('#winHundir .olLobby[data-j=hundir]', { state: 'visible', timeout: 15000 });
  ok(true, 'los dos vuelven al lobby');
  await H.locator('.olLobby[data-j=hundir] .olGrande').click();
  await H.waitForFunction(() => window.hundirEstado().modo === 'online' && window.hundirEstado().fase === 'colocando', null, { timeout: 15000 });
  await G.waitForFunction(() => window.hundirEstado().fase === 'colocando' && document.querySelectorAll('#hunOwn .barco').length === 0, null, { timeout: 15000 });
  await colocar(H); await colocar(G);
  await H.waitForFunction(() => window.Sala.estado.hf && window.Sala.estado.hf.fase === 'jugando', null, { timeout: 8000 });
  await G.waitForFunction(() => window.Sala.estado.hf && window.Sala.estado.hf.fase === 'jugando', null, { timeout: 8000 });
  await boton(G, 'Rendirse').click();
  await H.waitForSelector('#hunFin', { state: 'visible', timeout: 8000 });
  ok(/VICTORIA/.test(await H.locator('#hunFinT').innerText()) && /DERROTA/.test(await G.locator('#hunFinT').innerText()), 'si el invitado se rinde, gana el anfitrión');
  // ---------- tablero y flota distintos (plantilla Rápida 8×8) ----------
  await H.click('#hunFinBtn');
  await H.waitForSelector('#winHundir .olLobby[data-j=hundir]', { state: 'visible', timeout: 15000 }); await G.waitForSelector('#winHundir .olLobby[data-j=hundir]', { state: 'visible', timeout: 15000 });
  ok(/10×10/.test(await H.locator('.olLobby[data-j=hundir]').innerText()), 'lobby: por defecto 10×10');
  await H.locator('.olLobby[data-j=hundir] .olOp .olBtn', { hasText: 'Rápida 8×8' }).click();
  await G.waitForFunction(() => window.Sala.estado.op && window.Sala.estado.op.n === 8, null, { timeout: 8000 });
  ok(/8×8 · 4 barcos/.test(await G.locator('.olLobby[data-j=hundir]').innerText()), 'lobby: el invitado ve el tablero 8×8 elegido por el anfitrión');
  await H.locator('.olLobby[data-j=hundir] .olGrande').click();
  await H.waitForFunction(() => window.hundirEstado().fase === 'colocando', null, { timeout: 15000 });
  await G.waitForFunction(() => window.hundirEstado().fase === 'colocando' && document.querySelectorAll('#hunOwn .hunC').length === 64, null, { timeout: 15000 });
  ok(await H.locator('#hunOwn .hunC').count() === 64 && await H.locator('#hunShips .hunBarco').count() === 4, 'online 8×8: los dos tableros tienen 64 casillas y 4 barcos');
  await G.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'colocar', f: '5,0,0,1;4,2,0,1;3,4,0,1;3,6,0,1;2,7,0,1' }));   // flota clásica: no vale en 8×8
  await wait(700); ok((await pub(G)).listos[1] === false, 'online 8×8: el anfitrión rechaza una flota clásica en un tablero de 8×8');
  await colocar(H); await colocar(G);
  await H.waitForFunction(() => window.Sala.estado.hf && window.Sala.estado.hf.fase === 'jugando', null, { timeout: 8000 });
  await G.waitForFunction(() => window.Sala.estado.hf && window.Sala.estado.hf.fase === 'jugando', null, { timeout: 8000 });
  ok(await H.locator('#hunOwn .barco').count() === 12 && await G.locator('#hunOwn .barco').count() === 12, 'online 8×8: cada jugador ve su flota de 12 casillas');
  ok(await jugarHastaElFinal(H, G), 'online 8×8: la partida termina en los dos móviles');
  ok((await pub(G)).op.n === 8 && (await pub(G)).flotas.length === 2, 'online 8×8: el estado público lleva el tamaño y, al final, las flotas');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

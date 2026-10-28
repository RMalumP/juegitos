// Ahorcado: solo (palabra del Wordle, letras, fallos, final y estadísticas), 2 jugadores en un móvil (escribir la palabra, pasar el móvil, marcador)
// y online con 3 jugadores (la palabra no llega a quien adivina, turnos, jugadas fuera de turno ignoradas, puntos y siguiente ronda).
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9502, 9501);
  const nuevo = async (n, vp) => { const ctx = await env.contexto({ viewport: vp || { width: 390, height: 760 } }); const pg = await env.pagina(ctx, n); pg.on('dialog', d => d.accept()); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return pg; };
  const st = pg => pg.evaluate(() => window.ahorEstado());
  const tecla = (pg, l) => pg.locator('#ahoKeys .ahoTecla[data-k="' + l + '"]').click();

  /* ---------- solo ---------- */
  const pg = await nuevo('solo');
  await pg.evaluate(() => { window.ahorRapido = true; window.openGame('ahor'); });
  await pg.waitForFunction(() => typeof window.ahorEstado === 'function' && window.ahorEstado().pal);
  let e = await st(pg);
  const SOL = await pg.evaluate(() => window.WORDLE_PALABRAS.sol.split(' '));
  ok(e.modo === 'solo' && SOL.includes(e.pal) && e.mascara.length === 5 && e.mascara.every(c => c === ''), 'solo: sale una palabra del Wordle (' + e.pal.length + ' letras, ocultas)');
  ok(await pg.locator('#ahoKeys .ahoTecla').count() === 27, 'teclado de 27 letras (con la Ñ)');
  const noEsta = 'abcdefghijklmnñopqrstuvwxyz'.split('').filter(l => !e.pal.includes(l));
  await tecla(pg, noEsta[0]); e = await st(pg);
  ok(e.fallos === 1 && await pg.locator('#ahoKeys .ahoTecla.mal').count() === 1 && await pg.locator('.ahoP.on').count() === 1, 'una letra que no está: un fallo, tecla tachada y aparece la cabeza');
  ok(await pg.locator('#ahoKeys .ahoTecla[data-k="' + noEsta[0] + '"]').isDisabled(), 'la tecla usada no se puede repetir');
  await pg.keyboard.press(e.pal[0].toUpperCase() === 'Ñ' ? 'a' : e.pal[0]); e = await st(pg);
  ok(e.letras.length === 2 && e.mascara.includes(e.pal[0]), 'el teclado físico también juega (y destapa la letra)');
  for (const l of [...new Set(e.pal.split(''))]) if (!e.letras.includes(l)) await tecla(pg, l);
  await pg.waitForSelector('#ahoFin.show');
  e = await st(pg);
  ok(e.fase === 'gana' && /Salvado/.test(await pg.locator('#ahoFinT').innerText()) && e.stats.ganadas === 1 && e.stats.racha === 1, 'solo: completar la palabra gana y cuenta para la racha');
  await pg.click('#ahoFinB button'); e = await st(pg);
  for (const l of 'abcdefghijklmnñopqrstuvwxyz'.split('').filter(l => !e.pal.includes(l)).slice(0, 6)) await tecla(pg, l);
  await pg.waitForSelector('#ahoFin.show');
  e = await st(pg);
  ok(e.fase === 'pierde' && /Ahorcado/.test(await pg.locator('#ahoFinT').innerText()) && (await pg.locator('#ahoFinP').innerText()) === e.pal.toUpperCase() && e.stats.racha === 0, 'solo: 6 fallos ahorcan, se enseña la palabra y la racha vuelve a 0');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin scroll horizontal en el móvil');

  /* ---------- 2 jugadores en un móvil ---------- */
  await pg.evaluate(() => { window.PasarMovil.retardo = 0; });
  await pg.click('#ahoFinB button');
  await pg.click('.ahoModo[data-m=dos]');
  ok((await st(pg)).escribiendo, '2 jugadores: el Jugador 1 escribe la palabra');
  await pg.fill('#ahoInput', 'Pingüino 7'); await pg.click('#ahoListo');
  ok(/números/.test(await pg.locator('#ahoEscErr').innerText()), 'una palabra con números se rechaza');
  await pg.fill('#ahoInput', 'Árbol Ñu'); await pg.click('#ahoListo');
  await pg.waitForSelector('#ahoWrap .pmCubierta');
  e = await st(pg);
  ok(e.pal === 'arbol ñu' && /Jugador 2/.test(await pg.locator('.pmTitulo').innerText()), 'se acepta (sin tildes, con espacio y Ñ) y sale «Pasa el móvil a Jugador 2»');
  ok(await pg.locator('#ahoKeys .ahoTecla').first().isDisabled(), 'con la tapa puesta no se juega');
  await pg.click('.pmBoton'); await wait(100);
  ok(await pg.locator('.ahoGrupo').count() === 2, 'la palabra se ve en dos grupos (el espacio no es una letra)');
  for (const l of ['a', 'r', 'b', 'o', 'l', 'ñ', 'u']) await tecla(pg, l);
  await pg.waitForSelector('#ahoFin.show');
  e = await st(pg);
  ok(e.dos.puntos[1] === 1 && /Jugador 2 la ha adivinado/.test(await pg.locator('#ahoFinT').innerText()), 'el Jugador 2 la adivina y se lleva el punto');
  await pg.click('#ahoFinB button'); e = await st(pg);
  ok(e.escribiendo && e.dos.escribe === 1, 'siguiente ronda: ahora escribe el Jugador 2');
  await pg.click('#ahoAzar'); const az = (await pg.inputValue('#ahoInput')).toLowerCase();
  ok(SOL.includes(az), '🎲 Al azar propone una palabra del Wordle');
  await pg.context().close();

  /* ---------- online, 3 jugadores ---------- */
  const LB = '#winAhor .olLobby[data-j=ahorcado]';
  const sala = async (p, modo, nombre) => {
    await p.evaluate(() => window.openGame('ahor')); await wait(400);
    await p.locator('#winAhor [data-conectar]').click();
    await p.fill('#salaNombre', nombre); await p.fill('#salaSala', 'ahorcado prueba'); await p.fill('#salaPass', 'clave1');
    await p.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await p.waitForSelector(LB, { state: 'visible', timeout: 25000 });
  };
  const H = await nuevo('host'), G1 = await nuevo('inv1'), G2 = await nuevo('inv2');
  const T = [H, G1, G2];
  await sala(H, 'crear', 'Ana'); await sala(G1, 'unir', 'Bea'); await sala(G2, 'unir', 'Carlos');
  await H.waitForFunction(s => /3 \/ 6/.test(document.querySelector(s).innerText), LB, { timeout: 15000 });
  await H.locator(LB + ' .olGrande').click();
  for (const p of T) await p.waitForFunction(() => window.ahorEstado().modo === 'online' && window.ahorEstado().est, null, { timeout: 15000 });
  const pub = p => p.evaluate(() => window.Sala.estado.ah);
  let a = await pub(H);
  const escribe = T[a.escribe];
  ok(a.fase === 'escribiendo' && (await escribe.evaluate(() => window.ahorEstado().escribiendo)), 'online: a quien le toca escribir le sale el cuadro para la palabra');
  const otro = T[(a.escribe + 1) % 3];
  ok(!(await otro.evaluate(() => window.ahorEstado().escribiendo)) && /escribiendo/.test(await otro.locator('#ahoInfo').innerText()), 'los demás ven «… está escribiendo la palabra»');
  await otro.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'palabra', p: 'trampa' })).catch(() => {});
  await wait(400);
  ok((await pub(H)).fase === 'escribiendo', 'una palabra de quien no escribe se ignora');
  await escribe.fill('#ahoInput', 'murciélago'); await escribe.click('#ahoListo');
  for (const p of T) await p.waitForFunction(() => window.Sala.estado.ah && window.Sala.estado.ah.fase === 'jugando', null, { timeout: 8000 });
  const adivinan = T.filter((p, i) => i !== a.escribe);
  for (const p of adivinan.filter(p => p !== H)) {
    const txt = await p.evaluate(() => JSON.stringify(window.Sala.estado) + JSON.stringify(window.ahorEstado()) + document.body.innerText);
    ok(!/murcielago/i.test(txt), 'online: la palabra no llega al móvil de quien adivina');
  }
  a = await pub(H);
  ok(a.mascara.length === 10 && a.turno !== a.escribe, 'online: 10 huecos y el turno es de alguien que adivina');
  const fuera = T.find((p, i) => i !== a.turno);
  await fuera.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'letra', l: 'a' })).catch(() => {});
  await wait(400);
  ok((await pub(H)).letras.length === 0, 'online: una letra fuera de turno se ignora');
  // acierto: sigue el mismo; fallo: pasa al otro que adivina
  let t0 = a.turno; await tecla(T[t0], 'a');
  await H.waitForFunction(() => window.Sala.estado.ah.letras.length === 1); a = await pub(H);
  ok(a.turno === t0 && a.puntos[t0] === 1 && a.mascara.includes('a'), 'online: acertar da 1 punto y repites turno');
  await tecla(T[t0], 'z');
  await H.waitForFunction(() => window.Sala.estado.ah.letras.length === 2); a = await pub(H);
  ok(a.turno !== t0 && a.turno !== a.escribe && a.fallos === 1, 'online: fallar pasa el turno al otro que adivina');
  for (const l of ['m', 'u', 'r', 'c', 'i', 'e', 'l', 'g', 'o']) {
    a = await pub(H); const n = a.letras.length;
    await tecla(T[a.turno], l);
    await H.waitForFunction(k => window.Sala.estado.ah.letras.length > k, n);
  }
  for (const p of T) await p.waitForSelector('#ahoFin.show', { timeout: 8000 });
  a = await pub(H);
  ok(a.fase === 'gana' && a.palabra === 'murcielago' && a.puntos[a.ultimo.p] >= 3, 'online: la palabra se completa, se enseña a todos y quien la completa gana 2 puntos más');
  ok(await G1.locator('#ahoFinB button').isDisabled() && await H.locator('#ahoFinB [data-r=otra]').isEnabled(), 'solo el anfitrión pasa a la siguiente ronda');
  const antes = a.escribe;
  await H.locator('#ahoFinB [data-r=otra]').click();
  await H.waitForFunction(() => window.Sala.estado.ah.fase === 'escribiendo'); a = await pub(H);
  ok(a.escribe === (antes + 1) % 3 && a.rn === 1, 'online: en la siguiente ronda escribe el siguiente jugador');
  await T[a.escribe].waitForFunction(() => window.ahorEstado().escribiendo, null, { timeout: 8000 });
  // recarga de un invitado
  const gi = [G1, G2].indexOf(T[a.escribe]) >= 0 ? (T[a.escribe] === G1 ? G2 : G1) : G1;
  await gi.reload(); await gi.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await gi.waitForFunction(() => window.ahorEstado && window.ahorEstado().modo === 'online' && window.Sala.estado.ah && window.Sala.estado.ah.rn === 1, null, { timeout: 30000 });
  ok(true, 'online: un invitado recarga y vuelve a la partida');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

// UNO: contra la CPU (partida completa, «¡UNO!», estadísticas), guardar y recuperar, pasar el móvil (tapa entre turnos) y online con 2 navegadores
// + 1 CPU (cada uno solo recibe su mano, el anfitrión valida, recarga del anfitrión y partida completa). Sin scroll horizontal a 360 px.
const { entorno, wait, ok, fin } = require('./helpers');

// Un paso de un jugador humano a través de la interfaz (como lo haría una persona): tapa, color, «¡UNO!», jugar, robar o pasar.
const paso = pg => pg.evaluate(() => {
  const q = s => document.querySelector(s), bs = () => [...document.querySelectorAll('#unoAcc .unoB')];
  const tapa = q('.pmCubierta'); if (tapa) { const b = tapa.querySelector('.pmBoton'); if (!b.disabled) { b.click(); return 'tapa'; } return 'espera'; }
  if (getComputedStyle(q('#unoFin')).display !== 'none') return 'fin';
  if (q('#unoElegir').style.display === 'flex') { q('.unoElB').click(); return 'color'; }
  const uno = bs().find(b => b.textContent.includes('¡UNO!')); if (uno) { uno.click(); return 'uno'; }
  if (!q('#unoEstado').classList.contains('mio')) return 'espera';
  const c = q('#unoMano .unoCarta.puede'); if (c) { c.click(); return 'jugar'; }
  const b = bs().find(x => /Robar|Pasar|Elegir color/.test(x.textContent)); if (b) { b.click(); return 'robar'; }
  return 'nada';
});
async function hastaElFinal(pgs, max) {
  for (let i = 0; i < (max || 3000); i++) {
    const r = await Promise.all(pgs.map(paso));
    if (r.every(x => x === 'fin')) return true;
    if (r.every(x => x === 'espera' || x === 'fin')) await wait(30);
  }
  return false;
}

(async () => {
  const env = await entorno(9572, 9571);
  const ctx = await env.contexto({ viewport: { width: 360, height: 740 } });
  const pg = await env.pagina(ctx, 'uno');
  pg.on('dialog', d => d.accept());
  const preparar = async p => { await p.evaluate(() => { localStorage.clear(); document.getElementById('startScreen').style.display = 'none'; window.openGame('uno'); }); await wait(500); await p.evaluate(() => { window.PasarMovil.retardo = 0; window.unoRetardo(20); }); };
  await preparar(pg);

  // ---------------- menú ----------------
  ok(await pg.locator('#unoMenu').isVisible(), 'se abre el menú del UNO');
  const sinScroll = () => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.getElementById('unoWrap').scrollWidth <= document.getElementById('unoWrap').clientWidth + 1);
  ok(await sinScroll(), 'menú sin scroll horizontal a 360 px');

  // ---------------- contra la CPU ----------------
  await pg.locator('.unoTab', { hasText: 'CPU' }).click();
  for (let i = 0; i < 6; i++) await pg.locator('#unoMenu .unoRow', { hasText: 'Rivales' }).locator('.unoOpt', { hasText: '−' }).click();
  await pg.locator('#unoMenu .unoRow', { hasText: 'Rivales' }).locator('.unoOpt', { hasText: '+' }).click();
  ok((await pg.locator('#unoMenu .unoRow', { hasText: 'Rivales' }).innerText()).includes('2'), 'se eligen 2 rivales');
  await pg.locator('.unoBig').click(); await wait(200);
  let e = await pg.evaluate(() => window.unoEstado());
  ok(e.modo === 'cpu' && e.s.n === 3 && e.s.manos.every(m => m.length >= 7), 'empieza la partida contra 2 CPU con 7 cartas cada uno');
  ok(await pg.locator('#unoRivales .unoRival').count() === 2, 'se ven los 2 rivales');
  ok(await sinScroll(), 'mesa sin scroll horizontal a 360 px');
  // carta que no encaja: no se juega
  await pg.waitForFunction(() => document.getElementById('unoEstado').classList.contains('mio'), null, { timeout: 10000 });
  const antes = await pg.evaluate(() => window.unoEstado().s.ev);
  const mala = pg.locator('#unoMano .unoCarta.no').first();
  if (await mala.count()) { await mala.click({ force: true }); await wait(50); ok((await pg.evaluate(() => window.unoEstado().s.ev)) === antes, 'una carta que no encaja no se puede jugar'); }
  ok(await hastaElFinal([pg]), 'la partida contra la CPU llega al final');
  e = await pg.evaluate(() => window.unoEstado());
  ok(e.s.fase === 'final' && e.s.manos[e.s.ganador].length === 0, 'gana quien se queda sin cartas (' + e.s.nombres[e.s.ganador] + ')');
  ok(/gana la partida/.test(await pg.locator('#unoFin').innerText()), 'pantalla final con el ganador');
  const st = await pg.evaluate(() => JSON.parse(localStorage.getItem('unoStats')));
  ok(st && st.jugadas === 1 && st.ganadas === (e.s.ganador === 0 ? 1 : 0), 'cuenta la partida en las estadísticas contra la CPU');
  if (e.s.ganador === 0) ok(await pg.evaluate(() => window.loadRecord('uno')) === e.s.turnos[0], 'récord de turnos al ganar');

  // ---------------- guardar y recuperar ----------------
  await pg.locator('#unoFin .unoB', { hasText: 'Otra partida' }).click(); await wait(100);
  await pg.evaluate(() => window.unoRetardo(100000));               // las CPU esperan: la partida queda quieta
  for (let i = 0; i < 40 && !(await pg.evaluate(() => document.getElementById('unoEstado').classList.contains('mio'))); i++) {
    await pg.evaluate(() => window.unoRetardo(10)); await wait(60); await pg.evaluate(() => window.unoRetardo(100000));
  }
  await pg.locator('#unoSave').click(); await wait(100);
  const guard = await pg.evaluate(() => window.Partida.cargar('uno'));
  ok(guard && guard.modo === 'cpu' && guard.s.manos.length === 3, '«💾 Guardar» guarda la partida');
  const mano0 = guard.s.manos[0].slice().sort().join();
  await pg.reload(); await wait(300);
  await pg.evaluate(() => { document.getElementById('startScreen').style.display = 'none'; window.openGame('uno'); }); await wait(600);
  e = await pg.evaluate(() => window.unoEstado());
  ok(e.modo === 'cpu' && e.s.manos[0].slice().sort().join() === mano0, 'al reabrir la app se recupera la partida con la misma mano');
  ok(!(await pg.evaluate(() => window.Partida.existe('uno'))), 'lo guardado se recupera una sola vez');
  await pg.locator('#unoNewGame').click(); await wait(100);
  ok(await pg.locator('#unoMenu').isVisible(), '«Nueva partida» vuelve al menú');

  // ---------------- pasar el móvil ----------------
  await pg.evaluate(() => { window.PasarMovil.retardo = 0; window.unoRetardo(10); });
  await pg.locator('.unoTab', { hasText: 'Pasar' }).click();
  await pg.locator('.unoNombres input').nth(0).fill('Ana'); await pg.locator('.unoNombres input').nth(0).dispatchEvent('change');
  await pg.locator('.unoNombres input').nth(1).fill('Luis'); await pg.locator('.unoNombres input').nth(1).dispatchEvent('change');
  await pg.locator('#unoMenu .unoRow', { hasText: 'CPU:' }).locator('.unoOpt', { hasText: '+' }).click();
  await pg.locator('.unoBig').click(); await wait(150);
  ok(await pg.locator('.pmCubierta').isVisible(), 'pasar el móvil: tapa antes de ver la primera mano');
  ok(await pg.locator('#unoMano .unoCarta').count() === 0, 'bajo la tapa no hay ninguna mano a la vista');
  e = await pg.evaluate(() => window.unoEstado());
  ok(e.modo === 'local' && e.s.n === 3 && e.jug[2].cpu, '2 personas (Ana y Luis) y 1 CPU');
  let tapas = 0, cambios = new Set();
  for (let i = 0; i < 4000; i++) {
    const r = await paso(pg);
    if (r === 'tapa') { tapas++; cambios.add(await pg.evaluate(() => window.unoEstado().visor)); }
    if (r === 'fin') break;
    if (r === 'espera') await wait(15);
  }
  e = await pg.evaluate(() => window.unoEstado());
  ok(e.s.fase === 'final', 'pasar el móvil: la partida termina');
  ok(tapas >= 2 && cambios.has(0) && cambios.has(1), 'la tapa sale al pasar el móvil entre Ana y Luis (' + tapas + ' veces)');

  // ---------------- online: 2 navegadores + 1 CPU ----------------
  const nuevo = async n => { const c = await env.contexto({ viewport: { width: 380, height: 780 } }); const p = await env.pagina(c, n); p.on('dialog', d => d.accept()); await preparar(p); return p; };
  const H = await nuevo('anfitrión'), G = await nuevo('invitado');
  const sala = async (p, modo, nombre) => {
    await p.locator('#winUno [data-conectar]').click();
    await p.fill('#salaNombre', nombre); await p.fill('#salaSala', 'mesa uno'); await p.fill('#salaPass', 'clave1');
    await p.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await p.waitForSelector('#winUno .olLobby[data-j=uno]', { state: 'visible', timeout: 25000 });
  };
  await sala(H, 'crear', 'Anfi'); await sala(G, 'unir', 'Invi');
  await H.waitForFunction(() => { const b = document.querySelector('#winUno .olLobby[data-j=uno] .olGrande'); return b && !b.disabled; }, null, { timeout: 15000 });
  await H.locator('.olLobby[data-j=uno] .olOp', { hasText: 'CPU:' }).locator('.olBtn', { hasText: '1' }).click(); await wait(300);
  ok(/CPU: <b>|CPU: 1|1 \(normal\)/.test(await G.locator('.olLobby[data-j=uno] .olNota').first().innerHTML()), 'el invitado ve que habrá 1 CPU');
  await H.evaluate(() => window.unoOnlineRetardo && window.unoOnlineRetardo(30));
  await H.locator('.olLobby[data-j=uno] .olGrande').click();
  await H.waitForFunction(() => window.unoEstado().modo === 'online', null, { timeout: 15000 });
  await G.waitForFunction(() => window.unoEstado().modo === 'online' && window.unoEstado().mano.length >= 7, null, { timeout: 15000 });
  await H.evaluate(() => window.unoOnlineRetardo(30));
  const pub = await G.evaluate(() => window.Sala.estado.uno);
  ok(pub && pub.n === 3 && !('manos' in pub) && pub.manosFin === null, 'online: el estado público no lleva ninguna mano');
  const gE = await G.evaluate(() => window.unoEstado());
  ok(gE.mano.length === pub.cuantas[gE.p], 'online: el invitado recibe solo su mano (' + gE.mano.length + ' cartas)');
  ok(await G.locator('#unoRivales .unoRival', { hasText: 'CPU' }).count() === 1, 'online: el asiento de la CPU se ve en la mesa');
  // jugada ilegal del invitado: el anfitrión la rechaza
  const evAntes = await H.evaluate(() => window.Sala.estado.uno.ev);
  await G.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'jugar', i: 99 }));
  await wait(400);
  ok((await H.evaluate(() => window.Sala.estado.uno.ev)) === evAntes, 'online: una jugada imposible del invitado no cambia nada');
  // unas jugadas y el anfitrión recarga
  for (let i = 0; i < 40; i++) { await Promise.all([H, G].map(paso)); await wait(20); }
  const evR = await H.evaluate(() => window.Sala.estado.uno.ev);
  await H.reload(); await wait(300);
  await H.evaluate(() => { document.getElementById('startScreen').style.display = 'none'; window.PasarMovil.retardo = 0; });
  await H.waitForFunction(() => window.unoEstado && window.unoEstado().modo === 'online' && window.unoEstado().mano.length > 0, null, { timeout: 25000 });
  await H.evaluate(() => window.unoOnlineRetardo(30));
  ok((await H.evaluate(() => window.Sala.estado.uno.ev)) >= evR, 'online: el anfitrión recarga y recupera la partida');
  ok(await hastaElFinal([H, G], 4000), 'online: la partida llega al final en los dos móviles');
  const fh = await H.evaluate(() => window.Sala.estado.uno), fg = await G.evaluate(() => window.Sala.estado.uno);
  ok(fh.fase === 'final' && fg.ganador === fh.ganador && fg.manosFin && fg.manosFin[fh.ganador].length === 0, 'online: los dos ven el mismo ganador (' + fh.nombres[fh.ganador] + ')');
  ok(/Esperando al anfitrión/.test(await G.locator('#unoFin').innerText()), 'online: el invitado espera al anfitrión al final');
  await H.locator('#unoFin .unoB', { hasText: 'Revancha' }).click();
  await G.waitForFunction(() => window.Sala.estado.uno && window.Sala.estado.uno.fase !== 'final' && window.unoEstado().mano.length >= 7, null, { timeout: 15000 });
  ok(true, 'online: revancha con las mismas personas');
  await H.locator('#winUno .olBarra button', { hasText: 'Lobby' }).click();
  await G.waitForSelector('#winUno .olLobby[data-j=uno]', { state: 'visible', timeout: 15000 });
  ok(await G.evaluate(() => window.unoEstado().modo === null), 'online: volver al lobby saca a todos de la mesa');

  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

// Auditoría: en UNO online con 3 personas, un invitado sale de la sala a mitad de partida. ¿Sigue la partida? (fallo C2). Uso: node tests/_auditoria/uno-abandono.js
const { entorno, wait, ok, fin } = require('../helpers');
const paso = pg => pg.evaluate(() => {
  const q = s => document.querySelector(s), bs = () => [...document.querySelectorAll('#unoAcc .unoB')];
  if (getComputedStyle(q('#unoFin')).display !== 'none') return 'fin';
  if (q('#unoElegir').style.display === 'flex') { q('.unoElB').click(); return 'color'; }
  const uno = bs().find(b => b.textContent.includes('¡UNO!')); if (uno) { uno.click(); return 'uno'; }
  if (!q('#unoEstado').classList.contains('mio')) return 'espera';
  const c = q('#unoMano .unoCarta.puede'); if (c) { c.click(); return 'jugar'; }
  const b = bs().find(x => /Robar|Pasar|Elegir color/.test(x.textContent)); if (b) { b.click(); return 'robar'; }
  return 'nada';
});
(async () => {
  const env = await entorno(9672, 9671);
  const nuevo = async n => { const c = await env.contexto({ viewport: { width: 390, height: 844 } }); const p = await env.pagina(c, n); p.on('dialog', d => d.accept());
    await p.evaluate(() => { localStorage.clear(); document.getElementById('startScreen').style.display = 'none'; window.openGame('uno'); }); await wait(500); return p; };
  const H = await nuevo('anfitrión'), G1 = await nuevo('inv1'), G2 = await nuevo('inv2');
  const sala = async (p, modo, nombre) => {
    await p.locator('#winUno [data-conectar]').click();
    await p.fill('#salaNombre', nombre); await p.fill('#salaSala', 'mesa abandono'); await p.fill('#salaPass', 'clave1');
    await p.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await p.waitForSelector('#winUno .olLobby[data-j=uno]', { state: 'visible', timeout: 25000 });
  };
  await sala(H, 'crear', 'Anfi'); await sala(G1, 'unir', 'Uno'); await sala(G2, 'unir', 'Dos');
  await H.waitForFunction(() => window.Sala.jug.length === 3, null, { timeout: 15000 });
  await H.evaluate(() => window.unoOnlineRetardo && window.unoOnlineRetardo(30));
  await H.locator('.olLobby[data-j=uno] .olGrande').click();
  await G2.waitForFunction(() => window.unoEstado().modo === 'online' && window.unoEstado().mano.length >= 7, null, { timeout: 15000 });
  await G2.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/uno-abandono-0-inv2.png' });
  // el invitado 2 sale de la sala
  await G2.evaluate(() => window.Sala.salir()); await wait(1500);
  const jug = await H.evaluate(() => window.Sala.jug.map(j => j.nombre + (j.conectado ? '' : '(off)')));
  console.log('jugadores en el anfitrión tras salir:', jug.join(', '));
  let quieto = 0, ultimo = -1, i;
  for (i = 0; i < 800; i++) {
    const r = await Promise.all([paso(H), paso(G1)]);
    if (r.every(x => x === 'fin')) break;
    const ev = await H.evaluate(() => window.Sala.estado.uno && window.Sala.estado.uno.ev);
    if (ev === ultimo) quieto++; else { quieto = 0; ultimo = ev; }
    if (quieto > 150) break;
    await wait(20);
  }
  const est = await H.evaluate(() => { const u = window.Sala.estado.uno; return { turno: u.turno, nombres: u.nombres, fase: u.fase }; });
  console.log('estado final:', JSON.stringify(est), 'quieto', quieto);
  ok(est.fase === 'final' || quieto <= 150, 'la partida sigue tras salir un invitado (atascada en el turno de ' + (est.nombres && est.nombres[est.turno]) + ')');
  await H.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/uno-abandono-1-anfitrion.png' });
  await G1.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/uno-abandono-2-inv1.png' });
  await env.cerrar(); fin();
})();

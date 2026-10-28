// TURN: las credenciales se piden al Worker; si responde se añaden al ICE, y si falla la sala funciona igual solo con STUN y se avisa.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9382, 9381);
  const WORKER = /impostor-turn\.raul110082\.workers\.dev/;
  async function sala(modo, nombre) {
    const ctx = await env.contexto();
    await ctx.addInitScript(() => { delete window.JUEGITOS_TURN_PROXY; });           // usar la URL real del Worker
    let pedidas = 0;
    await ctx.route(WORKER, r => { pedidas++; modo(r); });
    const pg = await env.pagina(ctx, nombre);
    await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
    await pg.evaluate(() => window.openGame('sala'));
    await pg.fill('#salaNombre', 'Bolero'); await pg.fill('#salaSala', 'sala turn ' + nombre); await pg.fill('#salaPass', 'clave1'); await pg.click('#salaCrear');
    await pg.waitForFunction(() => window.Sala.activo, null, { timeout: 25000 });
    const ice = await pg.evaluate(async () => (await import('/js/online/transport-peer.js')).default.iceActual());
    return { pg, ice, pedidas: () => pedidas };
  }
  const buena = await sala(r => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify([{ urls: 'stun:stun.relay.metered.ca:80' }, { urls: 'turn:global.relay.metered.ca:443', username: 'u', credential: 'c' }]) }), 'ok');
  ok(buena.pedidas() === 1, 'al crear la sala se piden las credenciales al Worker');
  ok(buena.ice.some(s => /^turn:/.test([].concat(s.urls)[0]) && s.username === 'u'), 'los servidores TURN del Worker se añaden al ICE');
  ok(buena.ice.some(s => /stun\.l\.google\.com/.test(s.urls)), 'y se mantienen los STUN');
  ok(await buena.pg.locator('#salaAviso').innerText() === '', 'sin avisos cuando el relé está disponible');

  const caida = await sala(r => r.fulfill({ status: 500, body: 'error', headers: { 'access-control-allow-origin': '*' } }), 'caida');
  ok(caida.pedidas() >= 1 && caida.ice.every(s => /^stun:/.test([].concat(s.urls)[0])), 'si el Worker falla, la sala se crea igualmente solo con STUN');
  await wait(300);
  ok(await caida.pg.evaluate(() => window.Sala.activo), 'la sala está activa sin relé');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

// Entrar en la sala por enlace (solo pide el nombre), símbolo de conexión con la barra plegada y que los iconos Guardar/Multijugador/Cargar no se solapen.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9432, 9431);
  const nuevo = async n => { const ctx = await env.contexto(); const pg = await env.pagina(ctx, n); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return { ctx, pg }; };
  const H = await nuevo('bolero');

  // --- Guardar · Multijugador · Cargar: columna vertical, sin solapar con los iconos de juegos
  const caja = async (pg, sel) => pg.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }, sel);
  for (const w of [360, 400, 440]) {
    await H.pg.setViewportSize({ width: w, height: 700 });
    const [g, m, c] = [await caja(H.pg, '#btnSaveData'), await caja(H.pg, '#btnSala'), await caja(H.pg, '#btnLoadData')];
    ok(Math.abs(g.l - m.l) < 1 && Math.abs(m.l - c.l) < 1 && g.b <= m.t + 0.5 && m.b <= c.t + 0.5, 'a ' + w + ' px Guardar, Multijugador y Cargar están en vertical y no se solapan');
    const iconos = await H.pg.evaluate(() => Array.from(document.querySelectorAll('#icons .deskIcon')).map(e => e.getBoundingClientRect()).filter(r => r.width && r.right > 0).map(r => r.right));
    ok(Math.max(...iconos) <= g.l + 0.5, 'a ' + w + ' px los iconos de juegos quedan a la izquierda de las herramientas');
    ok(await H.pg.evaluate(() => { const l = document.querySelector('#btnSala .dtLbl'); return l.scrollWidth <= l.parentElement.clientWidth; }), 'a ' + w + ' px la etiqueta «Multijugador» cabe entera');
  }
  await H.pg.setViewportSize({ width: 400, height: 760 });

  // --- crear sala y elegir bingo
  await H.pg.click('#btnSala');
  await H.pg.fill('#salaNombre', 'Bolero'); await H.pg.fill('#salaSala', 'sala enlace'); await H.pg.fill('#salaPass', 'clave1'); await H.pg.click('#salaCrear');
  await H.pg.waitForSelector('#salaDentro', { state: 'visible' }); await H.pg.click('#salaJuegoBingo'); await H.pg.waitForSelector('.bgSala');

  // --- símbolo de la barra: se pliega y se despliega con la barra
  ok(await H.pg.locator('#trayNet').isVisible(), 'con la barra desplegada se ve el símbolo');
  ok(await H.pg.evaluate(() => document.getElementById('winBingo').getBoundingClientRect().bottom <= document.getElementById('taskbar').getBoundingClientRect().top + 0.5), 'la barra se ve en el bingo (la ventana no la tapa)');
  await H.pg.click('#tbHideBtn'); await wait(400);
  ok(await H.pg.locator('#taskbar.tbHidden').count() === 1, 'la barra queda plegada');
  ok(await H.pg.evaluate(() => document.getElementById('trayNet').getBoundingClientRect().top >= window.innerHeight - 1), 'con la barra plegada el símbolo de conexión también se oculta');
  await H.pg.click('#tbReopen'); await wait(400);
  ok(await H.pg.locator('#trayNet').isVisible() && await H.pg.locator('#trayNet.tray-ok').count() === 1, 'al desplegar la barra el símbolo vuelve, con su estado');
  await H.pg.click('#trayNet'); await H.pg.waitForSelector('#winSala:not(.hidden)'); ok(true, 'pulsar el símbolo abre la Sala');
  await H.pg.click('#salaIrJuego'); await H.pg.waitForSelector('.bgSala');

  // --- compartir: el enlace generado entra directo y solo pide el nombre
  await H.pg.evaluate(() => { navigator.share = async d => { window.__url = d.url; }; });
  await H.pg.locator('#bingoWrap button', { hasText: 'Compartir' }).click();
  const url = await H.pg.evaluate(() => window.__url);
  ok(/#s=/.test(url || ''), 'Compartir genera un enlace con la sala');
  const ctxG = await env.contexto(); const G = await ctxG.newPage();
  G.on('pageerror', e => ok(false, 'sin errores: ' + e.message));
  await G.goto(url);
  await G.waitForSelector('#salaEntrar');
  ok(await G.locator('#salaEntrar input').count() === 1 && await G.locator('#salaEntrar label').count() === 1, 'al abrir el enlace solo se pregunta el nombre');
  ok(/sala enlace/.test(await G.locator('#salaEntrar').innerText()), 'y se ve a qué sala se entra');
  await G.locator('#salaEntrar button', { hasText: 'Entrar' }).click();
  ok(/nombre/i.test(await G.locator('#salaEntrarAviso').innerText()), 'sin nombre no entra y lo avisa');
  await G.fill('#salaEntrarNombre', 'Lola'); await G.locator('#salaEntrar button', { hasText: 'Entrar' }).click();
  await G.waitForSelector('#winBingo:not(.hidden)', { timeout: 25000 }); await G.waitForSelector('.bgStep', { timeout: 15000 });
  ok(await G.evaluate(() => window.Sala.activo && window.Sala.sala === 'sala enlace'), 'Lola entra en la sala y aterriza directamente en el bingo');
  await wait(1200);
  ok(/Lola/.test(await H.pg.locator('.bgLista').innerText()), 'el Bolero ve a Lola en su lista');
  ok(await G.locator('#salaEntrar').count() === 0 && !/[?#]s=/.test(G.url()), 'el enlace con la contraseña desaparece de la barra de direcciones');

  // --- QR: contiene el mismo enlace
  await H.pg.locator('#bingoWrap button', { hasText: 'QR' }).click();
  await H.pg.waitForSelector('#salaQR svg'); ok(true, 'el QR también está disponible desde el bingo');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

// Fallos de la auditoría (v2.23.1). Fase 1 (críticos):
//  C1 · un nombre de jugador con HTML no se ejecuta: la sala lo rechaza (en la ventana y en el anfitrión) y Blackjack, Ruleta y Póquer lo pintan como texto.
//  C2 · si alguien sale a mitad de partida, la partida no se queda atascada: en UNO una CPU ocupa su asiento; en Conecta 4 se vuelve al lobby avisando.
// Uso: node tests/ui-auditoria.js
const { entorno, wait, ok, fin } = require('./helpers');
const MALO = '<img src=x onerror="window.Q8=1">';

(async () => {
  const env = await entorno(9772, 9771);
  const nuevo = async (n, juego) => {
    const c = await env.contexto({ viewport: { width: 390, height: 844 } }); const p = await env.pagina(c, n); p.on('dialog', d => d.accept());
    await p.evaluate(w => { localStorage.clear(); document.getElementById('startScreen').style.display = 'none'; if (w) window.openGame(w); }, juego); await wait(500); return p;
  };
  const sala = async (p, winId, modo, nombre, nomSala, esperaLobby) => {
    await p.locator('#' + winId + ' [data-conectar]').first().click();
    await p.fill('#salaNombre', nombre); await p.fill('#salaSala', nomSala); await p.fill('#salaPass', 'clave1');
    await p.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    if (esperaLobby !== false) await p.waitForFunction(() => window.Sala.activo, null, { timeout: 25000 });
  };

  // ---------- C1: nombres con HTML ----------
  {
    const H = await nuevo('anfitrión-bj', 'bj'), G = await nuevo('invitado-bj', 'bj');
    await sala(H, 'winBJ', 'crear', 'Anfi', 'nombres raros');
    await sala(G, 'winBJ', 'unir', MALO, 'nombres raros', false); await wait(400);
    ok(!(await G.evaluate(() => window.Sala.activo)) && /< ni >/.test(await G.textContent('#salaAviso')), 'la ventana de la sala no deja entrar con < o > en el nombre');
    // un cliente que se salta la ventana y habla directamente con el anfitrión
    const r = await G.evaluate(async n => {
      const m = await import(new URL('js/online/transport-peer.js', document.baseURI).href);
      try { await m.default.unirse('nombres raros', 'clave1', n); return 'entró'; } catch (e) { return 'rechazado'; }
    }, MALO);
    await wait(500);
    ok(r === 'rechazado' && (await H.evaluate(() => window.Sala.jug.length)) === 1, 'el anfitrión rechaza un nombre con < o > aunque no llegue desde la ventana');
    await H.close(); await G.close();
  }
  {
    // aunque llegara un nombre así (p. ej. de un anfitrión trucado), Blackjack, Ruleta y Póquer lo pintan como texto
    const p = await nuevo('pintar');
    const res = await p.evaluate(async n => {
      const out = {};
      window.openGame('bj'); await new Promise(r => setTimeout(r, 300));
      Me[0].name = n; Ye(); out.bj = { js: window.Q8 === 1, img: !!document.querySelector('#winBJ img[src="x"]'), txt: [...document.querySelectorAll('.bjPLbl')].some(e => e.textContent === n) };
      window.openGame('roul'); await new Promise(r => setTimeout(r, 300));
      st[0].name = n; Lt(); out.rul = { js: window.Q8 === 1, img: !!document.querySelector('#winRoul img[src="x"]'), txt: [...document.querySelectorAll('.roulPTab')].some(e => e.textContent.includes(n)) };
      return out;
    }, MALO);
    await wait(300);
    ok(!res.bj.js && !res.bj.img && res.bj.txt, 'Blackjack pinta el nombre como texto (sin ejecutar nada)');
    ok(!res.rul.js && !res.rul.img && res.rul.txt, 'Ruleta pinta el nombre como texto (sin ejecutar nada)');
    ok(!(await p.evaluate(() => window.Q8)), 'ningún código del nombre se ha ejecutado');
    await p.close();
  }

  // ---------- C2: alguien sale a mitad de partida ----------
  {
    const H = await nuevo('anfitrión-uno', 'uno'), G1 = await nuevo('inv1-uno', 'uno'), G2 = await nuevo('inv2-uno', 'uno');
    await sala(H, 'winUno', 'crear', 'Anfi', 'mesa abandono'); await sala(G1, 'winUno', 'unir', 'Uno', 'mesa abandono'); await sala(G2, 'winUno', 'unir', 'Dos', 'mesa abandono');
    await H.waitForFunction(() => window.Sala.jug.length === 3, null, { timeout: 15000 });
    await H.waitForSelector('.olLobby[data-j=uno] .olGrande', { state: 'visible', timeout: 10000 });
    await H.evaluate(() => window.unoOnlineRetardo(30));
    await H.locator('.olLobby[data-j=uno] .olGrande').click();
    await G2.waitForFunction(() => window.unoEstado().modo === 'online' && window.unoEstado().mano.length >= 7, null, { timeout: 15000 });
    await G2.evaluate(() => window.Sala.salir());
    await H.waitForFunction(() => { const a = window.Sala.estado.unoAsientos; return a && a[2] && a[2].cpu; }, null, { timeout: 8000 }).catch(() => {});
    ok(await H.evaluate(() => !!(window.Sala.estado.unoAsientos[2] || {}).cpu), 'UNO: al salir un invitado, una CPU ocupa su asiento');
    ok(/Dos ha salido/.test(await G1.evaluate(() => (document.getElementById('salaToast') || {}).textContent || '')), 'UNO: los demás reciben el aviso de que ha salido');
    // se juega hasta que el turno pasa por el asiento que quedó libre y sigue adelante
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
    let paso2 = false, despues = false;
    for (let i = 0; i < 600 && !despues; i++) {
      const r = await Promise.all([paso(H), paso(G1)]);
      const u = await H.evaluate(() => { const u = window.Sala.estado.uno; return u && { t: u.turno, f: u.fase }; });
      if (r.includes('fin') || (u && u.f !== 'jugando' && u.f !== 'color')) { despues = paso2 = true; break; }
      if (u && u.t === 2) paso2 = true; else if (paso2) despues = true;
      await wait(25);
    }
    ok(paso2 && despues, 'UNO: la partida sigue cuando llega el turno de quien salió');
    await H.close(); await G1.close(); await G2.close();
  }
  {
    const H = await nuevo('anfitrión-c4', 'c4'), G = await nuevo('inv-c4', 'c4');
    await sala(H, 'winC4', 'crear', 'Anfi', 'c4 abandono'); await sala(G, 'winC4', 'unir', 'Beto', 'c4 abandono');
    await H.waitForFunction(() => window.Sala.jug.length === 2, null, { timeout: 15000 });
    await H.waitForSelector('.olLobby[data-j=c4] .olGrande', { state: 'visible', timeout: 10000 });
    await H.locator('.olLobby[data-j=c4] .olGrande').click();
    await H.waitForFunction(() => window.Sala.estado.phase === 'jugando', null, { timeout: 10000 });
    // el anfitrión expulsa al invitado durante la partida desde la ventana de la sala
    await H.evaluate(() => window.Sala.abrir()); await wait(300);
    ok(await H.locator('#salaJugadores .salaX').count() === 1, 'el anfitrión puede expulsar también durante la partida');
    await H.locator('#salaJugadores .salaX').click();
    await H.waitForFunction(() => window.Sala.estado.phase === 'lobby', null, { timeout: 8000 }).catch(() => {});
    ok(await H.evaluate(() => window.Sala.estado.phase === 'lobby'), 'Conecta 4: si el rival se va, la partida se cierra y se vuelve al lobby');
    ok(/Beto ha salido/.test(await H.evaluate(() => (document.getElementById('salaToast') || {}).textContent || '')), 'Conecta 4: el anfitrión ve el aviso');
    await H.close(); await G.close();
  }

  await env.cerrar(); fin();
})();

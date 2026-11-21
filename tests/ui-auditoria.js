// Fallos de la auditoría (v2.23.1). Fase 1 (críticos):
//  C1 · un nombre de jugador con HTML no se ejecuta: la sala lo rechaza (en la ventana y en el anfitrión) y Blackjack, Ruleta y Póquer lo pintan como texto.
//  C2 · si alguien sale a mitad de partida, la partida no se queda atascada: en UNO una CPU ocupa su asiento; en Conecta 4 se vuelve al lobby avisando.
// Fase 2 (medios): M1 Bingo para el automático al cerrar · M2 Buscaminas no da por ganada una derrota · M3 pagos del Blackjack ·
//  M4 cartas del Solitario en ordenador · M5 aviso de girar el móvil · M6 Breakout y Pinball paran el bucle en pausa ·
//  M7 «Guardar datos» no copia la identidad online · M8 Snake con el almacenamiento bloqueado.
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
    await G1.evaluate(() => { window.__avisos = []; const t = window.Sala.toast; window.Sala.toast = m => { window.__avisos.push(m); t(m); }; });
    await G2.evaluate(() => window.Sala.salir());
    await H.waitForFunction(() => { const a = window.Sala.estado.unoAsientos; return a && a[2] && a[2].cpu; }, null, { timeout: 8000 }).catch(() => {});
    ok(await H.evaluate(() => !!(window.Sala.estado.unoAsientos[2] || {}).cpu), 'UNO: al salir un invitado, una CPU ocupa su asiento');
    ok(await G1.evaluate(() => window.__avisos.some(m => /Dos ha salido/.test(m))), 'UNO: los demás reciben el aviso de que ha salido');
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

  // ---------- Fase 2 ----------
  {
    const c = await env.contexto({ viewport: { width: 390, height: 844 } }); const p = await env.pagina(c, 'medios'); p.on('dialog', d => d.accept());
    await p.evaluate(() => { localStorage.clear(); document.getElementById('startScreen').style.display = 'none'; });
    // M1: Bingo local en automático; al cerrar la ventana deja de sacar bolas
    await p.evaluate(() => window.openGame('bingo')); await p.waitForSelector('.bgTitulo');
    await p.locator('#bingoWrap >> text=Empezar partida').click(); await p.waitForSelector('.bgTablero');
    await p.evaluate(() => { window.BingoUI.estado.seg = 0.3; });
    await p.locator('#bingoWrap >> text=Automático').click(); await wait(200);
    await p.click('#btnCloseBingo'); const n0 = await p.evaluate(() => window.BingoUI.estado.p.bolas.length); await wait(1200);
    const b1 = await p.evaluate(() => ({ n: window.BingoUI.estado.p.bolas.length, auto: window.BingoUI.estado.auto }));
    ok(b1.n === n0 && !b1.auto, 'M1: al cerrar el Bingo se para el modo automático (' + n0 + ' → ' + b1.n + ' bolas)');

    // M2: pisar una mina cuando quedan tantas casillas seguras como minas no cuenta como victoria ni guarda récord
    const m2 = await p.evaluate(async () => {
      window.openGame('mine'); await new Promise(r => setTimeout(r, 300));
      const cel = document.getElementById('board').children; cel[0].click(); await new Promise(r => setTimeout(r, 50));
      let seguras = []; let mina = null;
      for (let r = 0; r < E.rows; r++) for (let k = 0; k < E.cols; k++) { const x = v[r][k]; if (x.mine) mina = mina || [r, k]; else if (!x.revealed) seguras.push(x); }
      seguras.slice(E.mines).forEach(x => { x.revealed = true; });
      cel[mina[0] * E.cols + mina[1]].click(); await new Promise(r => setTimeout(r, 50));
      return { cara: document.getElementById('smiley').textContent, rec: Object.keys(localStorage).filter(k => /mine:/.test(k)) };
    });
    ok(m2.cara !== '😎' && m2.rec.length === 0, 'M2: Buscaminas no da por ganada la partida perdida ni guarda récord (' + m2.cara + ')');

    // M3: Blackjack: el blackjack de la banca gana a un 21 de tres cartas; un 21 tras dividir se paga 1:1
    const m3 = await p.evaluate(async () => {
      window.openGame('bj'); await new Promise(r => setTimeout(r, 300));
      const k = v => Object.assign(qe(), { v: v, hidden: false });
      const pl = Me[0]; Me.length = 1;
      pl.chips = 990; pl.bet = 10; pl.hands = [[k('7'), k('7'), k('7')]]; pl.hands[0].bet = 10; Se = [k('A'), k('K')]; Qe();
      const a = pl.chips;
      pl.chips = 980; pl.bet = 10; pl.hands = [[k('A'), k('K')], [k('5'), k('5')]]; pl.hands[0].bet = 10; pl.hands[1].bet = 10; Se = [k('10'), k('8')]; Qe();
      const b = pl.chips;
      pl.chips = 990; pl.bet = 10; pl.hands = [[k('A'), k('K')]]; pl.hands[0].bet = 10; Se = [k('10'), k('8')]; Qe();
      return { a: a, b: b, c: pl.chips };
    });
    ok(m3.a === 990, 'M3: blackjack de la banca contra 21 de tres cartas: gana la banca (' + m3.a + ' fichas)');
    ok(m3.b === 1000, 'M3: 21 con dos cartas tras dividir se paga 1:1 (' + m3.b + ' fichas)');
    ok(m3.c === 1015, 'M3: el blackjack normal sigue pagando 3:2 (' + m3.c + ' fichas)');

    // M7: «Guardar datos» no lleva la identidad online ni la sesión de la sala
    await p.evaluate(() => { ['mine', 'bj', 'bingo'].forEach(w => { try { document.getElementById('btnClose' + ({ mine: 'Mine', bj: 'BJ', bingo: 'Bingo' })[w]).click(); } catch (e) {} });
      localStorage.setItem('juegitos.peer.id', 'p-0123456789abcdef'); localStorage.setItem('juegitos.peer.token', 'secreto'); localStorage.setItem('juegitos.sala.sesion', '{"pass":"clave1"}'); localStorage.setItem('snkBest', '50'); });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => document.getElementById('btnSaveData').click())]);
    const copia = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8')).data;
    await p.click('#dataOk');
    ok(copia.snkBest === '50' && !Object.keys(copia).some(k => /^juegitos\.peer\.|^juegitos\.sala\.sesion$/.test(k)), 'M7: la copia guarda las puntuaciones pero no la identidad online ni la contraseña de la sala');

    // M6: Breakout y Pinball no piden fotogramas en pausa
    const cuenta = () => p.evaluate(async () => { let n = 0; const o = window.requestAnimationFrame; window.requestAnimationFrame = f => { n++; return o(f); }; await new Promise(r => setTimeout(r, 1000)); window.requestAnimationFrame = o; return n; });
    await p.evaluate(() => window.openGame('brk')); await p.waitForFunction(() => typeof window.brkStartNew === 'function'); await p.evaluate(() => window.brkStartNew()); await wait(200);
    await p.click('#brkLevelGrid .brkLevelCell:nth-child(1)'); await p.click('#brk-startBtn'); await wait(300);
    const brkJugando = await cuenta(); await p.click('#btnMinBrk'); const brkPausa = await cuenta();
    ok(brkJugando > 30 && brkPausa < 3, 'M6: Breakout deja de dibujar al minimizarlo (' + brkJugando + ' → ' + brkPausa + ' fotogramas/s)');
    await p.evaluate(() => window.openGame('brk')); await wait(200);
    await p.evaluate(() => { const cv = document.querySelector('#winBrk canvas'), r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + 20, clientY: r.top + 20, pointerId: 1 })); }); await wait(300);
    const brkOtra = await cuenta();
    ok(brkOtra > 30, 'M6: Breakout vuelve a dibujar al reanudar (' + brkOtra + ' fotogramas/s)');
    await p.evaluate(() => window.openGame('pin')); await p.waitForFunction(() => typeof window.pinStartNew === 'function'); await p.evaluate(() => window.pinStartNew()); await wait(200);
    await p.click('#pin-startBtn').catch(() => p.evaluate(() => document.querySelector('#pinStart button').click())); await wait(300);
    const pinJugando = await cuenta(); await p.click('#btnMinPin'); const pinPausa = await cuenta();
    ok(pinJugando > 30 && pinPausa < 3, 'M6: Pinball deja de dibujar al minimizarlo (' + pinJugando + ' → ' + pinPausa + ' fotogramas/s)');
    await c.close();
  }
  {
    // M4: Solitario en ordenador: cartas más altas que anchas
    const c = await env.contexto({ viewport: { width: 1366, height: 768 }, hasTouch: false }); const p = await env.pagina(c, 'solitario');
    await p.evaluate(() => { localStorage.clear(); document.getElementById('startScreen').style.display = 'none'; window.openGame('sol'); }); await wait(500);
    const r = await p.evaluate(() => [...document.querySelectorAll('[id^=tc] .card:last-child')].map(e => { const b = e.getBoundingClientRect(); return b.height / b.width; }));
    ok(r.length === 7 && r.every(x => x > 1.3 && x < 1.5), 'M4: las cartas de las columnas del Solitario tienen proporción de carta en 1366×768 (' + r.map(x => x.toFixed(2)).join(', ') + ')');
    await c.close();
    const m = await env.contexto({ viewport: { width: 390, height: 844 } }); const q = await env.pagina(m, 'solitario-movil');
    await q.evaluate(() => { localStorage.clear(); document.getElementById('startScreen').style.display = 'none'; window.openGame('sol'); }); await wait(500);
    const h = await q.evaluate(() => [...document.querySelectorAll('[id^=tc] .card:last-child')].map(e => Math.round(e.getBoundingClientRect().height)));
    ok(h.every(x => x === 64), 'M4: en el móvil las cartas siguen igual (64 px de alto)');
    await m.close();
  }
  {
    // M5: con el móvil girado, Tetris, Snake, Invaders y Wordle piden girarlo; en vertical no
    const c = await env.contexto({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }); const p = await env.pagina(c, 'apaisado');
    await p.evaluate(() => { document.getElementById('startScreen').style.display = 'none'; });
    const aviso = id => p.evaluate(id => getComputedStyle(document.getElementById(id), '::after').content, id);
    const r = []; for (const [g, id] of [['tetris', 'winTetris'], ['snk', 'winSnk'], ['inv', 'winInv'], ['word', 'winWord']]) { await p.evaluate(g => window.openGame(g), g); await wait(200); r.push(/Gira el móvil/.test(await aviso(id))); }
    ok(r.every(Boolean), 'M5: en apaisado, Tetris, Snake, Invaders y Wordle piden girar el móvil');
    await p.setViewportSize({ width: 390, height: 844 }); await wait(200);
    ok(!/Gira/.test(await aviso('winWord')), 'M5: en vertical no sale el aviso');
    const man = JSON.parse(require('fs').readFileSync(require('path').join(env.root, 'manifest.webmanifest'), 'utf8'));
    ok(man.orientation === 'portrait', 'M5: la app instalada se queda en vertical');
    await c.close();
  }
  {
    // M8: Snake con el almacenamiento bloqueado
    const c = await env.contexto({ viewport: { width: 390, height: 844 } });
    await c.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqueado', 'SecurityError'); } }); });
    const p = await env.pagina(c, 'sin-almacenamiento');
    await p.evaluate(() => { document.getElementById('startScreen').style.display = 'none'; window.openGame('snk'); }); await wait(500);
    await p.click('#snk-startBtn'); await wait(400);
    ok(await p.evaluate(() => getComputedStyle(document.getElementById('snkStartScreen')).display === 'none'), 'M8: Snake arranca aunque el navegador bloquee el almacenamiento');
    await c.close();
  }

  await env.cerrar(); fin();
})();

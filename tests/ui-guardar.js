// Botón «💾 Guardar» de Blackjack, Ruleta, Póker, Hundir la flota, Parchís y Dados: guarda la partida, se recupera al volver a abrir la app
// y la barra de menús de esos juegos cabe en un móvil estrecho (sin scroll horizontal).
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9592, 9591);
  const ctx = await env.contexto({ viewport: { width: 360, height: 740 } });
  const abrir = async () => {
    const pg = await env.pagina(ctx, 'guardar');
    await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
    await pg.evaluate(() => { window.hundirRapido = true; });
    return pg;
  };
  const guardado = (pg, id) => pg.evaluate(k => window.Partida.cargar(k), id);
  const aviso = pg => pg.evaluate(() => { const d = document.getElementById('partidaAviso'); return d ? d.textContent : ''; });
  let pg = await abrir();

  // ---------------- la barra de menús cabe a 360 px ----------------
  for (const [win, id] of [['bj', 'winBJ'], ['roul', 'winRoul'], ['poker', 'winPoker'], ['hundir', 'winHundir'], ['dice', 'winDice']]) {
    await pg.evaluate(w => window.openGame(w), win); await wait(250);
    const m = await pg.evaluate(i => { const b = document.querySelector('#' + i + ' .menuBar'); return { sw: b.scrollWidth, cw: b.clientWidth, doc: document.documentElement.scrollWidth, vw: innerWidth }; }, id);
    ok(m.sw <= m.cw + 1 && m.doc <= m.vw, id + ': la barra de menús con «Guardar» cabe sin scroll horizontal (' + m.sw + '/' + m.cw + ')');
    ok(await pg.locator('#' + id + ' .menuBar .mItem', { hasText: '💾 Guardar' }).isVisible(), id + ': se ve «💾 Guardar»');
  }

  // ---------------- Blackjack ----------------
  await pg.evaluate(() => window.openGame('bj')); await wait(200);
  await pg.evaluate(() => { bjAddBet(25); bjDeal(); }); await wait(900);
  const bj = await pg.evaluate(() => ({ cartas: Me[0].hands.map(h => h.length), fichas: Me[0].chips }));
  await pg.locator('#bjSave').click(); await wait(100);
  ok(/guardada/.test(await aviso(pg)) && !!(await guardado(pg, 'blackjack')), 'Blackjack: «Guardar» guarda la mano en curso');

  // ---------------- Ruleta ----------------
  await pg.evaluate(() => window.openGame('roul')); await wait(200);
  await pg.evaluate(() => { const c = document.querySelector('#roulBoard [data-bet], #roulBoard .roulNum, #roulBoard td'); c && c.click(); }); await wait(150);
  const ruleta = await pg.evaluate(() => window.roulSnapshot());
  ok(!!ruleta, 'Ruleta: hay una apuesta puesta');
  await pg.locator('#roulSave').click(); await wait(100);
  ok(!!(await guardado(pg, 'ruleta')), 'Ruleta: «Guardar» guarda las apuestas');

  // ---------------- Póker ----------------
  await pg.evaluate(() => window.openGame('poker')); await wait(200);
  await pg.locator('#pkSave').click(); await wait(100);
  ok(/No hay ninguna partida/.test(await aviso(pg)), 'Póker: antes de empezar no hay nada que guardar');
  await pg.locator('#pkStartBtn').click(); await wait(600);
  const pk = await pg.evaluate(() => window.pkSnapshot());
  ok(!!pk, 'Póker: la partida ha empezado');
  await pg.locator('#pkSave').click(); await wait(100);
  ok(!!(await guardado(pg, 'poker')), 'Póker: «Guardar» guarda la mano');

  // ---------------- Hundir la flota (contra la CPU) ----------------
  await pg.evaluate(() => window.openGame('hundir')); await wait(300);
  await pg.evaluate(() => { window.PasarMovil.retardo = 0; });
  await pg.locator('#hunMenu [data-modo=cpu]').click(); await wait(150);
  await pg.locator('#hunSave').click(); await wait(100);
  ok(/Coloca las flotas/.test(await aviso(pg)), 'Hundir: mientras se colocan los barcos no se guarda');
  await pg.locator('#hunBtns button', { hasText: 'Aleatorio' }).click(); await pg.locator('#hunBtns button', { hasText: 'Listo' }).click(); await wait(200);
  await pg.waitForFunction(() => window.hundirEstado().pt.turno === 0, null, { timeout: 5000 });
  await pg.locator('#hunEnemy .hunC').nth(0).click(); await wait(100);
  await pg.waitForFunction(() => window.hundirEstado().pt.turno === 0 || window.hundirEstado().fase !== 'jugando', null, { timeout: 5000 });
  const hun = await pg.evaluate(() => window.hundirEstado().pt);
  await pg.locator('#hunSave').click(); await wait(100);
  ok(!!(await guardado(pg, 'hundir')), 'Hundir: «Guardar» guarda la batalla');

  // ---------------- Parchís ----------------
  await pg.evaluate(() => window.openGame('parchis'));
  await pg.waitForFunction(() => { const w = document.getElementById('parchisFrame').contentWindow; return w && w.document.getElementById('start'); }, null, { timeout: 8000 });
  const F = pg.frameLocator('#parchisFrame');
  await F.locator('#start').click(); await wait(300);
  const fw = async fn => pg.evaluate(f => document.getElementById('parchisFrame').contentWindow.eval(f), fn);
  await pg.waitForFunction(() => { const w = document.getElementById('parchisFrame').contentWindow; const G = w.eval('G'); return !G.busy && !G.seats[G.turn].cpu && G.phase === 'roll'; }, null, { timeout: 20000 });
  await F.locator('#saveBtn').click(); await wait(100);
  ok(/guardada/.test(await aviso(pg)) && !!(await guardado(pg, 'parchis')), 'Parchís: «Guardar» guarda la partida');
  const par = await fw('JSON.stringify(G.seats.map(s=>s.tokens))');

  // ---------------- Dados ----------------
  await pg.evaluate(() => window.openGame('dice')); await wait(200);
  await pg.locator('#diceSave').click(); await wait(100);
  ok(/No hay ninguna partida/.test(await aviso(pg)), 'Dados: en la configuración no hay nada que guardar');
  await pg.locator('#dicePlayBtn').click(); await pg.locator('#diceRollBtn').click(); await wait(800);
  await pg.locator('#diceSave').click(); await wait(100);
  ok((await guardado(pg, 'dados')).history.length === 1, 'Dados: «Guardar» guarda el historial de tiradas');

  // ---------------- se recupera todo al volver a abrir la app ----------------
  await pg.close(); pg = await abrir();
  await pg.evaluate(() => window.openGame('bj')); await wait(300);
  ok(JSON.stringify(await pg.evaluate(() => ({ cartas: Me[0].hands.map(h => h.length), fichas: Me[0].chips }))) === JSON.stringify(bj), 'Blackjack: al reabrir sigue la misma mano y las mismas fichas');
  await pg.evaluate(() => window.openGame('roul')); await wait(300);
  ok(JSON.stringify(await pg.evaluate(() => window.roulSnapshot().st)) === JSON.stringify(ruleta.st), 'Ruleta: al reabrir siguen las apuestas');
  await pg.evaluate(() => window.openGame('poker')); await wait(300);
  const pk2 = await pg.evaluate(() => window.pkSnapshot());
  ok(pk2 && JSON.stringify(pk2.Ot) === JSON.stringify(pk.Ot) && pk2.Gt === pk.Gt, 'Póker: al reabrir sigue la misma mano');
  await pg.evaluate(() => window.openGame('hundir')); await wait(400);
  const h2 = await pg.evaluate(() => window.hundirEstado());
  ok(h2.modo === 'cpu' && h2.fase === 'jugando' && JSON.stringify(h2.pt.shots) === JSON.stringify(hun.shots), 'Hundir: al reabrir sigue la batalla con los mismos disparos');
  ok(await pg.locator('#hunMenu').isHidden() && await pg.locator('#hunEnemy .hunC').first().isVisible(), 'Hundir: se ve el tablero, no el menú');
  await pg.evaluate(() => window.openGame('parchis'));
  await pg.waitForFunction(() => { const w = document.getElementById('parchisFrame').contentWindow; return w && w.eval && w.document.getElementById('game') && !w.document.getElementById('game').classList.contains('hidden'); }, null, { timeout: 8000 });
  ok(await fw('JSON.stringify(G.seats.map(s=>s.tokens))') === par, 'Parchís: al reabrir siguen las fichas donde estaban');
  await pg.evaluate(() => window.openGame('dice')); await wait(300);
  ok(await pg.locator('#diceGame').isVisible() && await pg.locator('#diceHist .diceHistRow').count() === 1, 'Dados: al reabrir sigue la partida con su historial');

  // ---------------- se recupera una sola vez y se borra al terminar o empezar otra ----------------
  for (const id of ['blackjack', 'ruleta', 'poker', 'hundir', 'parchis', 'dados']) ok(await guardado(pg, id) === null, id + ': al recuperarla, lo guardado se borra (solo se recupera una vez)');
  await pg.close(); pg = await abrir();
  await pg.evaluate(() => window.openGame('dice')); await wait(300);
  ok(await pg.locator('#diceSetup').isVisible(), 'Dados: al volver a abrir la app sin guardar otra vez, la partida no vuelve');
  await pg.locator('#dicePlayBtn').click(); await pg.locator('#diceRollBtn').click(); await wait(800);
  await pg.locator('#diceSave').click(); await wait(100);
  await pg.locator('#diceNewGame').click(); await wait(100);
  ok(await guardado(pg, 'dados') === null, 'Dados: «Nueva partida» borra lo guardado');
  await pg.evaluate(() => window.openGame('bj')); await wait(200);
  await pg.locator('#bjSave').click(); await wait(100);
  await pg.locator('#bjNewGame').click(); await wait(100);
  ok(await guardado(pg, 'blackjack') === null, 'Blackjack: «Nueva partida» borra lo guardado');
  await pg.evaluate(() => window.openGame('mine')); await wait(200);
  await pg.evaluate(() => { document.querySelector('#board').children[0].click(); }); await wait(100);
  await pg.locator('#mSaveMine').click(); await wait(100);
  ok(!!(await guardado(pg, 'buscaminas')), 'Buscaminas: se guarda');
  await pg.evaluate(() => { for (let r = 0; r < E.rows; r++) for (let c = 0; c < E.cols; c++) if (v[r][c].mine) { document.querySelector('#board').children[r * E.cols + c].click(); return; } }); await wait(200);
  ok(await guardado(pg, 'buscaminas') === null, 'Buscaminas: al perder se borra lo guardado');
  await pg.evaluate(() => window.openGame('hundir')); await wait(200);
  await pg.evaluate(() => { window.PasarMovil.retardo = 0; window.hundirStartNew(); }); await wait(100);
  await pg.locator('#hunMenu [data-modo=cpu]').click(); await wait(150);
  await pg.locator('#hunBtns button', { hasText: 'Aleatorio' }).click(); await pg.locator('#hunBtns button', { hasText: 'Listo' }).click(); await wait(200);
  await pg.waitForFunction(() => window.hundirEstado().pt.turno === 0, null, { timeout: 5000 });
  await pg.locator('#hunSave').click(); await wait(100);
  pg.once('dialog', d => d.accept());
  await pg.locator('#hunBtns button', { hasText: 'Rendirse' }).click(); await wait(300);
  ok(await guardado(pg, 'hundir') === null, 'Hundir: al terminar (rendirse) se borra lo guardado');

  // ---------------- Hundir, 2 jugadores: al recuperar no se ve ninguna flota hasta pasar el móvil ----------------
  await pg.evaluate(() => window.openGame('hundir')); await pg.evaluate(() => { window.PasarMovil.retardo = 0; window.hundirStartNew(); }); await wait(100);
  await pg.locator('#hunMenu [data-modo=local]').click(); await wait(100);
  for (let j = 0; j < 2; j++) {
    await pg.locator('#hunBtns button', { hasText: 'Aleatorio' }).click(); await pg.locator('#hunBtns button', { hasText: 'Listo' }).click(); await wait(200);
    await pg.locator('.pmBtn, .pasarBtn, [data-pasar], #hunWrap button', { hasText: 'Soy' }).first().click(); await wait(200);
  }
  await pg.locator('#hunSave').click(); await wait(100);
  ok(!!(await guardado(pg, 'hundir')), 'Hundir 2 jugadores: se guarda');
  await pg.close(); pg = await abrir();
  await pg.evaluate(() => window.openGame('hundir')); await wait(400);
  ok(await pg.locator('#hunWrap button', { hasText: 'Soy' }).first().isVisible() && await pg.locator('#hunOwn .hunC.barco, #hunOwn .hunC[class*=b]').count() === 0, 'Hundir 2 jugadores: al recuperar sale «Pasa el móvil» sin enseñar flotas');
  await pg.locator('#hunWrap button', { hasText: 'Soy' }).first().click(); await wait(200);
  ok((await pg.evaluate(() => window.hundirEstado())).fase === 'jugando' && await pg.locator('#hunEnemy .hunC').first().isVisible(), 'Hundir 2 jugadores: después se sigue jugando');

  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

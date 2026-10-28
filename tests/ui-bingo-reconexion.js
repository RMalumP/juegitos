// Robustez online: un jugador y el anfitrión recargan la página a mitad de partida y todo se recupera.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9362, 9361);
  const ctxH = await env.contexto(), ctxA = await env.contexto(), ctxB = await env.contexto();
  const abre = async (ctx, n) => { const pg = await env.pagina(ctx, n); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return pg; };
  let H = await abre(ctxH, 'bolero'), A = await abre(ctxA, 'ana'), B = await abre(ctxB, 'beto');
  await H.evaluate(() => window.openGame('sala'));
  await H.selectOption('#salaJuegoSel', 'bingo'); await H.fill('#salaNombre', 'Bolero'); await H.fill('#salaSala', 'recon sala'); await H.fill('#salaPass', 'clave1'); await H.click('#salaCrear');
  await H.waitForSelector('.bgSala', { timeout: 25000 });
  for (const [J, n] of [[A, 'Ana'], [B, 'Beto']]) {
    await J.evaluate(() => window.openGame('sala'));
    await J.fill('#salaNombre', n); await J.fill('#salaSala', 'recon sala'); await J.fill('#salaPass', 'clave1'); await J.click('#salaUnir');
    await J.waitForSelector('.bgStep', { timeout: 20000 });
  }
  await wait(1200);
  await H.click('#bingoWrap >> text=Empezar partida');
  await A.waitForSelector('.bgCarton'); await B.waitForSelector('.bgCarton');
  for (let i = 0; i < 4; i++) await H.click('#bingoWrap >> text=Sacar bola');
  await A.waitForFunction(() => window.Sala.estado.bolas && window.Sala.estado.bolas.length === 4);
  const cartonA = await A.evaluate(() => window.Sala.rol.cartones[0]);
  const bolasAntes = await H.evaluate(() => window.BingoUI.estado.p.bolas.slice());
  // Ana marca un número a mano, recarga y sigue
  const num = cartonA.flat().find(n => n);
  await A.locator('.bgCarton .bgC', { hasText: new RegExp('^' + num + '$') }).click();
  await A.reload(); await A.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await A.waitForFunction(() => window.Sala && window.Sala.activo, null, { timeout: 30000 });
  await A.evaluate(() => window.openGame('bingo')); await A.waitForSelector('.bgCarton', { timeout: 20000 });
  ok(JSON.stringify(await A.evaluate(() => window.Sala.rol.cartones[0])) === JSON.stringify(cartonA), 'Ana recarga y recupera su mismo cartón');
  ok((await A.evaluate(() => window.Sala.estado.bolas.length)) === 4, 'y las bolas que ya habían salido');
  ok(await A.locator('.bgCarton .bgC.marc', { hasText: new RegExp('^' + num + '$') }).count() === 1, 'y la casilla que había marcado a mano');

  // el anfitrión recarga: la partida se recupera
  await H.reload(); await H.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await H.waitForSelector('#winBingo:not(.hidden)', { timeout: 30000 });
  await H.waitForSelector('.bgTablero', { timeout: 20000 });
  const bolasDespues = await H.evaluate(() => window.BingoUI.estado.p.bolas.slice());
  ok(JSON.stringify(bolasDespues) === JSON.stringify(bolasAntes), 'el Bolero recarga y recupera el bombo y las bolas');
  await wait(4000); // los jugadores se reconectan solos
  await H.click('#bingoWrap >> text=Sacar bola');
  await A.waitForFunction(() => window.Sala.estado.bolas.length === 5, null, { timeout: 25000 });
  await B.waitForFunction(() => window.Sala.estado.bolas.length === 5, null, { timeout: 25000 });
  ok(true, 'tras recargar el Bolero, la bola 5 llega a los dos jugadores');
  // y se puede cantar y validar con el estado recuperado
  const todos = cartonA.flat().filter(n => n);
  await H.evaluate(todos => { const p = window.BingoUI.estado.p; const sal = p.bolas.slice(); p.bombo = sal.concat(todos.filter(n => !sal.includes(n)), p.bombo.filter(n => !sal.includes(n) && !todos.includes(n))); }, todos);
  const quedan = todos.filter(n => !bolasDespues.includes(n)).length - 0;
  const ya = await H.evaluate(() => window.BingoUI.estado.p.bolas.slice());
  for (let i = 0; i < todos.filter(n => !ya.includes(n)).length; i++) await H.click('#bingoWrap >> text=Sacar bola');
  const total = await H.evaluate(() => window.BingoUI.estado.p.bolas.length);
  await A.waitForFunction(n => window.Sala.estado.bolas.length >= n, total, { timeout: 25000 });
  await A.locator('.bgBtn.cantar', { hasText: 'BINGO' }).first().click({ force: true });
  await A.waitForSelector('.bgFin', { timeout: 15000 });
  ok(/Ana/.test(await A.locator('.bgFin').innerText()), 'Ana canta bingo y el Bolero recuperado lo valida');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

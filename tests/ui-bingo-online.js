// Prueba online de extremo a extremo: un Bolero y tres jugadores (cada uno en su navegador) usan el icono «Sala online» y juegan una partida de bingo.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9322, 9321);
  const nuevo = async nombre => { const ctx = await env.contexto(); const pg = await env.pagina(ctx, nombre); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); return { ctx, pg }; };
  const H = await nuevo('bolero'), A = await nuevo('ana'), Bt = await nuevo('beto'), C = await nuevo('carla');

  // --- el anfitrión abre la app «Sala online» desde su icono y crea la sala
  await H.pg.locator('#btnSala').click();
  await H.pg.waitForSelector('#winSala:not(.hidden)');
  ok(await H.pg.locator('#trayNet.tray-off').count() === 1, 'símbolo de la barra apagado antes de conectar');
  await H.pg.selectOption('#salaJuegoSel', 'bingo'); await H.pg.fill('#salaNombre', 'Bolero'); await H.pg.fill('#salaSala', 'sala bingo'); await H.pg.fill('#salaPass', 'clave1');
  await H.pg.click('#salaCrear');
  await H.pg.waitForFunction(() => window.Sala.activo, null, { timeout: 25000 });
  ok(await H.pg.locator('#trayNet.tray-ok').count() === 1, 'el símbolo de la barra se pone en verde al conectar');
  ok(/sala bingo/.test(await H.pg.locator('#trayNet').getAttribute('title')), 'el símbolo muestra la sala en su tooltip');
  ok(await H.pg.evaluate(() => window.Sala.juego) === 'bingo', 'la sala nace ya como sala de Bingo (el juego se elige al crearla)');
  await H.pg.waitForSelector('#winBingo:not(.hidden)');
  await H.pg.waitForSelector('.bgSala');
  ok(/Eres el\s+Bolero/.test(await H.pg.locator('.bgSala').innerText()), 'el anfitrión ve su lobby de Bolero');

  // --- los jugadores se unen por el icono de la Sala
  async function unir(J, nombre, pass) {
    await J.pg.locator('#btnSala').click();
    await J.pg.waitForSelector('#winSala:not(.hidden)');
    await J.pg.fill('#salaNombre', nombre); await J.pg.fill('#salaSala', 'Sala Bingo'); await J.pg.fill('#salaPass', pass);
    await J.pg.click('#salaUnir');
  }
  await unir(A, 'Ana', 'mala');
  await A.pg.waitForFunction(() => /no encontrada|incorrecta/i.test(document.getElementById('salaAviso').textContent), null, { timeout: 20000 });
  ok(true, 'contraseña incorrecta rechazada con aviso');
  await A.pg.fill('#salaPass', 'clave1'); await A.pg.click('#salaUnir');
  await A.pg.waitForFunction(() => window.Sala.activo, null, { timeout: 20000 });
  await unir(Bt, 'Beto', 'clave1'); await unir(C, 'Carla', 'clave1');
  await Bt.pg.waitForFunction(() => window.Sala.activo, null, { timeout: 20000 }); await C.pg.waitForFunction(() => window.Sala.activo, null, { timeout: 20000 });
  // al elegir el anfitrión el juego, los jugadores que miran la ventana de sala pasan a él
  await Promise.all([A, Bt, C].map(J => J.pg.waitForSelector('#winBingo:not(.hidden)', { timeout: 15000 })));
  ok(true, 'los jugadores pasan al bingo cuando el anfitrión lo elige');
  for (const J of [A, Bt, C]) await J.pg.waitForSelector('.bgStep');
  await wait(1500);
  ok(await H.pg.locator('.bgJ').count() === 3, 'el Bolero ve a los 3 jugadores');

  // --- compartir desde el bingo: enlace y QR a mano del Bolero
  ok(await H.pg.locator('#bingoWrap button', { hasText: 'Compartir' }).count() === 1 && await H.pg.locator('#bingoWrap button', { hasText: 'QR' }).count() === 1, 'el lobby del Bolero tiene Compartir y QR');
  await H.pg.locator('#bingoWrap button', { hasText: 'QR' }).click();
  await H.pg.waitForSelector('#salaQR svg'); ok(true, 'el QR se muestra sin salir del bingo'); await H.pg.click('#salaQR');
  // el Bolero también juega: se pide 1 cartón propio
  await H.pg.locator('.bgStep .bgBtn', { hasText: '+' }).click();
  ok(/1/.test(await H.pg.locator('.bgStepN').innerText()), 'el Bolero se añade 1 cartón propio en el lobby');

  // --- Beto pide 3 cartones, Carla 2
  await Bt.pg.locator('.bgStep .bgBtn', { hasText: '+' }).click(); await Bt.pg.locator('.bgStep .bgBtn', { hasText: '+' }).click();
  await C.pg.locator('.bgStep .bgBtn', { hasText: '+' }).click();
  await H.pg.waitForFunction(() => Array.from(document.querySelectorAll('.bgJ b')).map(b => b.textContent).join('|').includes('3'), null, { timeout: 8000 });
  ok(true, 'el Bolero ve cuántos cartones quiere cada uno');

  // --- empieza la partida
  await H.pg.click('#bingoWrap >> text=Empezar partida');
  await Promise.all([A, Bt, C].map(J => J.pg.waitForSelector('.bgCarton', { timeout: 15000 })));
  ok(await A.pg.locator('.bgCarton').count() === 1 && await Bt.pg.locator('.bgCarton').count() === 3 && await C.pg.locator('.bgCarton').count() === 2, 'cada jugador recibe los cartones que pidió');
  const cartonesA = await A.pg.evaluate(() => window.Sala.rol.cartones);
  const cartonesB = await Bt.pg.evaluate(() => window.Sala.rol.cartones);
  ok(JSON.stringify(cartonesA) !== JSON.stringify(cartonesB[0]), 'los cartones de dos jugadores son distintos');
  ok(await H.pg.evaluate(() => Object.values(window.BingoUI.estado.p.cartones).flat().length) === 7, 'el Bolero guarda los 7 cartones repartidos (3 jugadores + el suyo)');
  await H.pg.waitForSelector('.bgCarton');
  ok(await H.pg.locator('.bgCarton').count() === 1, 'el Bolero ve su cartón propio debajo del tablero');
  const nums = [].concat(await H.pg.evaluate(() => window.BingoUI.estado.p.nums[window.Sala.uid]), await A.pg.evaluate(() => window.Sala.rol.nums), await Bt.pg.evaluate(() => window.Sala.rol.nums), await C.pg.evaluate(() => window.Sala.rol.nums));
  ok(new Set(nums).size === 7 && Math.min(...nums) === 1 && Math.max(...nums) === 7, 'los 7 cartones tienen número único (1 a 7) entre todos los móviles');
  ok(/Nº\s*\d/.test(await A.pg.locator('.bgBCab').first().innerText()), 'el jugador ve el número de su cartón');

  // --- las bolas llegan a todos
  await H.pg.click('#bingoWrap >> text=Sacar bola');
  await H.pg.click('#bingoWrap >> text=Sacar bola');
  await Promise.all([A, Bt, C].map(J => J.pg.waitForFunction(() => /Bola\s*2\s*de 90/.test(document.querySelector('.bgCuenta').innerText), null, { timeout: 10000 })));
  ok(true, 'las bolas que saca el Bolero llegan a los tres jugadores');

  // --- cantar en falso
  const noSalida = await A.pg.evaluate(() => { const sal = window.Sala.estado.bolas; return window.Sala.rol.cartones[0].flat().find(n => n && !sal.includes(n)); });
  await A.pg.locator('.bgCarton .bgC', { hasText: new RegExp('^' + noSalida + '$') }).first().click();
  ok(await A.pg.locator('.bgC.marc').count() === 1, 'Ana marca a mano una casilla que no ha salido');
  const msgFalso = A.pg.waitForFunction(() => document.getElementById('salaToast') && /Falso/.test(document.getElementById('salaToast').textContent), null, { timeout: 8000 });
  await A.pg.locator('.bgBtn.cantar', { hasText: 'BINGO' }).first().click({ force: true });
  await msgFalso; ok(true, 'un bingo en falso es rechazado');
  await A.pg.waitForFunction(() => document.querySelectorAll('.bgC.marc').length === 0, null, { timeout: 5000 });
  ok(true, 'y se borra la casilla mal marcada del cartón de Ana');
  // el Bolero comprueba cartones por número
  await H.pg.locator('#bingoWrap >> text=Comprobar cartones').click();
  ok(await H.pg.locator('.bgOverlay .bgCk').count() === 7, 'comprobar cartones lista los 7 cartones de la sala con su número');
  ok(/Beto/.test(await H.pg.locator('.bgOverlay').innerText()) && /Carla/.test(await H.pg.locator('.bgOverlay').innerText()), 'y a quién pertenece cada uno');
  await H.pg.locator('.bgCk').nth(3).click();
  ok(/Línea|línea/.test(await H.pg.locator('.bgOverlay').innerText()), 'tocar un cartón muestra el cartón con su veredicto');
  await H.pg.locator('.bgOvX').click();

  // --- el Bolero saca bolas en el orden que conviene a Ana: su primera fila
  const bombo = await H.pg.evaluate(() => window.BingoUI.estado.p.bombo.slice());
  const idA = await A.pg.evaluate(() => window.Sala.uid);
  const fila = cartonesA[0][0].filter(n => n);
  await H.pg.evaluate(([fila, idA]) => { const p = window.BingoUI.estado.p; const sal = p.bolas.slice(); p.bombo = sal.concat(fila.filter(n => !sal.includes(n)), p.bombo.filter(n => !sal.includes(n) && !fila.includes(n))); }, [fila, idA]);
  const nuevas = fila.filter(n => !(bombo.slice(0, 2).includes(n)));
  for (let i = 0; i < nuevas.length; i++) await H.pg.click('#bingoWrap >> text=Sacar bola');
  await A.pg.waitForFunction(n => window.Sala.estado.bolas.length >= n, 2 + nuevas.length, { timeout: 10000 });
  // marcado automático para no tocar casilla a casilla
  await A.pg.click('#bingoWrap >> text=Marcado automático');
  await A.pg.waitForSelector('.bgBtn.lista');
  ok(true, 'el botón ¡LÍNEA! se ilumina en el móvil de Ana');
  await A.pg.locator('.bgBtn.cantar', { hasText: 'LÍNEA' }).first().click({ force: true });
  await Promise.all([H.pg, A.pg, Bt.pg, C.pg].map(J => J.waitForSelector('.bgAnuncio', { timeout: 10000 })));
  ok(true, 'la línea de Ana se anuncia en los cuatro móviles');
  ok(/Ana/.test(await Bt.pg.locator('.bgAnuncio').innerText()), 'el anuncio dice quién ha cantado');
  ok(await A.pg.locator('.bgBtn.cantar', { hasText: 'LÍNEA' }).first().isDisabled(), 'tras la línea ya no se puede volver a cantar');

  // --- bingo: se sacan todas las bolas de su cartón
  const todos = cartonesA[0].flat().filter(n => n);
  await H.pg.evaluate(todos => { const p = window.BingoUI.estado.p; const sal = p.bolas.slice(); p.bombo = sal.concat(todos.filter(n => !sal.includes(n)), p.bombo.filter(n => !sal.includes(n) && !todos.includes(n))); }, todos);
  const ya = await H.pg.evaluate(() => window.BingoUI.estado.p.bolas.slice());
  const quedan = todos.filter(n => !ya.includes(n)).length;
  for (let i = 0; i < quedan; i++) await H.pg.click('#bingoWrap >> text=Sacar bola');
  await A.pg.waitForFunction(n => window.Sala.estado.bolas.length >= n, ya.length + quedan, { timeout: 10000 });
  await A.pg.locator('.bgBtn.cantar', { hasText: 'BINGO' }).first().click({ force: true });
  await Promise.all([H.pg, A.pg, Bt.pg, C.pg].map(J => J.waitForSelector('.bgFin', { timeout: 10000 })));
  ok(/Ana/.test(await C.pg.locator('.bgFin').innerText()), 'el bingo de Ana cierra la partida para todos');

  // --- nueva partida
  await H.pg.click('#bingoWrap >> text=Nueva partida');
  await Promise.all([A, Bt, C].map(J => J.pg.waitForSelector('.bgStep', { timeout: 15000 })));
  ok(true, 'el Bolero vuelve al lobby y los jugadores a la espera');

  // --- segunda partida: gana el propio Bolero con su cartón
  await wait(1000);
  await H.pg.click('#bingoWrap >> text=Empezar partida');
  await H.pg.waitForSelector('.bgCarton'); await Promise.all([A, Bt, C].map(J => J.pg.waitForSelector('.bgCarton', { timeout: 15000 })));
  const mio = await H.pg.evaluate(() => window.BingoUI.estado.p.cartones[window.Sala.uid][0].flat().filter(n => n));
  await H.pg.evaluate(todos => { const p = window.BingoUI.estado.p; p.bombo = todos.concat(p.bombo.filter(n => !todos.includes(n))); }, mio);
  for (let i = 0; i < 15; i++) await H.pg.click('#bingoWrap >> text=Sacar bola');
  await H.pg.locator('.bgBloque .bgBtn.cantar', { hasText: 'BINGO' }).click({ force: true });
  await Promise.all([A.pg, Bt.pg, C.pg].map(J => J.waitForSelector('.bgFin', { timeout: 10000 })));
  ok(/Bolero/.test(await A.pg.locator('.bgFin').innerText()), 'el Bolero puede ganar con su cartón propio y todos lo ven');

  // --- salir: el símbolo se apaga y la sala se cierra para todos
  await H.pg.click('#bingoMenuSala'); await H.pg.waitForSelector('#winSala:not(.hidden)');
  H.pg.once('dialog', d => d.accept());
  await H.pg.click('#salaCerrar');
  await H.pg.waitForSelector('#trayNet.tray-off');
  ok(true, 'al cerrar la sala el símbolo vuelve a gris');
  await A.pg.waitForSelector('#trayNet.tray-off', { timeout: 15000 });
  ok(true, 'los jugadores también se desconectan');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

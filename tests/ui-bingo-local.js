// Bingo en local (sin sala): un único modo Bolero, con cartones propios opcionales; comprobar cartones; marcas falsas; el resto del escritorio sigue funcionando.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9312, 9311);
  const ctx = await env.contexto();
  const pg = await env.pagina(ctx, 'local');
  pg.on('dialog', d => (d.type() === 'prompt' ? d.accept('1 2 3') : d.accept()));
  const abrirBingo = async () => { await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); await pg.locator('#iconBingo').click(); await pg.waitForSelector('.bgTitulo'); };
  ok(await pg.locator('#iconBingo').count() === 1 && await pg.locator('#iconSala').count() === 0 && await pg.locator('#deskTools #btnSala').count() === 1, 'el icono Bingo está en el escritorio y Multijugador junto a Guardar y Cargar');
  ok(await pg.locator('#trayNet').count() === 1, 'el símbolo de conexión está en la barra inferior');
  await abrirBingo();
  ok(await pg.locator('#bingoWrap >> text=Mis cartones (para jugar').count() === 1 && await pg.locator('#bingoWrap >> text=Soy el Bolero').count() === 0 && await pg.locator('#bingoWrap >> text=Mis cartones', { hasText: /^Mis cartones$/ }).count() === 0, 'no hay modos separados: un único modo con cartones propios opcionales');

  // --- solo Bolero (0 cartones propios: cartones físicos)
  await pg.locator('#bingoWrap >> text=Empezar partida').click();
  await pg.waitForSelector('.bgTablero');
  ok(await pg.locator('.bgBloque').count() === 0, 'con 0 cartones propios no sale ningún cartón (modo cartones físicos)');
  for (let i = 0; i < 5; i++) await pg.locator('#bingoWrap >> text=Sacar bola').click();
  ok(await pg.locator('.bgT.sal').count() === 5 && /Bola\s*5\s*de 90/.test(await pg.locator('.bgCuenta').innerText()), 'sacar 5 bolas marca 5 números en el tablero');
  const antes = await pg.evaluate(() => window.BingoUI.estado.p.bolas.slice());
  await pg.reload(); await abrirBingo();
  await pg.locator('#bingoWrap >> text=Continuar partida').click();
  ok(JSON.stringify(await pg.evaluate(() => window.BingoUI.estado.p.bolas)) === JSON.stringify(antes), 'la partida se puede continuar tras recargar la página');
  await pg.locator('#bingoWrap >> text=Automático').click(); await wait(300);
  ok(await pg.locator('.bgT.sal').count() >= 6, 'el modo automático saca una bola enseguida');
  await pg.locator('#bingoWrap >> text=Pausar').click();
  // comprobar un cartón físico
  await pg.locator('#bingoWrap >> text=Comprobar cartones').click();
  await pg.locator('.bgOverlay >> text=Cartón físico').click();
  ok(await pg.locator('.bgOverlay').count() === 1 && /Nadie tiene cartones/.test(await pg.locator('.bgOverlay').innerText()), 'comprobar cartones sin cartones propios ofrece el cartón físico');
  await pg.locator('.bgOvX').click();
  await pg.locator('#bingoWrap >> text=Terminar').click();
  await pg.waitForSelector('.bgTitulo');

  // --- Bolero con 2 cartones propios: bolas y cartones en el mismo modo
  await pg.locator('.bgStep .bgBtn', { hasText: '+' }).click(); await pg.locator('.bgStep .bgBtn', { hasText: '+' }).click();
  await pg.locator('#bingoWrap >> text=Empezar partida').click();
  await pg.waitForSelector('.bgTablero'); await pg.waitForSelector('.bgCarton');
  ok(await pg.locator('.bgCarton').count() === 2 && await pg.locator('.bgCarton .bgC:not(.vacio)').count() === 30, 'dos cartones propios debajo de bombo y tablero');
  const y = await pg.evaluate(() => [document.querySelector('.bgTablero').getBoundingClientRect().bottom, document.querySelector('.bgBloque').getBoundingClientRect().top]);
  ok(y[1] > y[0], 'los cartones salen debajo del tablero');
  ok(/Cartón Nº 1/.test(await pg.locator('.bgBCab').nth(0).innerText()) && /Cartón Nº 2/.test(await pg.locator('.bgBCab').nth(1).innerText()), 'los cartones están numerados (Nº 1 y Nº 2)');
  // marcar a mano una fila entera → línea falsa porque no han salido las bolas
  const fila = await pg.evaluate(() => window.BingoUI.estado.p.cartones.yo[0][0].filter(n => n));
  for (const n of fila) await pg.locator('.bgBloque').first().locator('.bgC', { hasText: new RegExp('^' + n + '$') }).click();
  ok(await pg.locator('.bgBloque').first().locator('.bgC.marc').count() === 5, 'se marcan 5 casillas a mano');
  await pg.locator('.bgBloque').first().locator('.bgBtn.cantar', { hasText: 'LÍNEA' }).click({ force: true });
  await pg.waitForFunction(() => document.querySelectorAll('.bgBloque')[0].querySelectorAll('.bgC.marc').length === 0);
  ok(true, 'un canto falso borra las casillas mal marcadas');
  ok(/mal marcada/.test(await pg.locator('#salaToast').innerText()), 'y avisa de cuántas se han quitado');
  // ahora salen de verdad las bolas de esa fila: se marcan bien y la línea es válida
  await pg.evaluate(fila => { const p = window.BingoUI.estado.p; const sal = p.bolas.slice(); p.bombo = sal.concat(fila.filter(n => !sal.includes(n)), p.bombo.filter(n => !sal.includes(n) && !fila.includes(n))); }, fila);
  for (let i = 0; i < 5; i++) await pg.locator('#bingoWrap >> text=Sacar bola').click();
  await pg.locator('.bgBloque').first().locator('.bgBtn.cantar', { hasText: 'LÍNEA' }).click({ force: true });
  await pg.waitForSelector('.bgAnuncio');
  ok(/LÍNEA/.test(await pg.locator('.bgAnuncio').innerText()), 'cantar una línea correcta con un cartón propio se anuncia');
  // comprobar cartones: lista con números y detalle
  await pg.locator('#bingoWrap >> text=Comprobar cartones').click();
  ok(await pg.locator('.bgOverlay .bgCk').count() === 2 && /Nº 1/.test(await pg.locator('.bgCk').first().innerText()), 'comprobar cartones lista los cartones por número');
  await pg.locator('.bgCk').first().click();
  ok(/Línea completa/.test(await pg.locator('.bgOverlay').innerText()) && /Sin bingo/.test(await pg.locator('.bgOverlay').innerText()), 'el detalle del cartón da el veredicto de línea y bingo');
  await pg.locator('.bgOvX').click();
  // resto del escritorio
  await pg.evaluate(() => window.openGame('dice'));
  await pg.waitForSelector('#winDice:not(.hidden)');
  ok(await pg.locator('#winBingo.hidden').count() === 1, 'abrir otro juego oculta el bingo');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

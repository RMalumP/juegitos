// Pruebas de interfaz del bingo en local (sin sala): menú, bolero, cartones y que el resto del escritorio siga funcionando.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9312, 9311);
  const ctx = await env.contexto();
  const pg = await env.pagina(ctx, 'local');
  ok(await pg.locator('#iconBingo').count() === 1 && await pg.locator('#iconSala').count() === 1, 'los iconos Bingo y Sala online están en el escritorio');
  ok(await pg.locator('#trayNet').count() === 1, 'el símbolo de conexión está en la barra inferior');
  // abrir con doble clic
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.locator('#iconBingo').click(); await pg.locator('#iconBingo').click();
  await pg.waitForSelector('#winBingo:not(.hidden)');
  await pg.waitForSelector('.bgTitulo');
  ok(true, 'el bingo se abre y carga bajo demanda');
  // bolero
  await pg.getByText('Soy el Bolero').click();
  await pg.waitForSelector('.bgTablero');
  for (let i = 0; i < 5; i++) await pg.getByText('Sacar bola').click();
  ok(await pg.locator('.bgT.sal').count() === 5, 'sacar 5 bolas marca 5 números en el tablero');
  ok(/Bola\s*5\s*de 90/.test(await pg.locator('.bgCuenta').innerText()), 'el contador marca 5 de 90');
  const antes = await pg.evaluate(() => window.BingoUI.estado.p.bolas.slice());
  await pg.reload(); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); await pg.locator('#iconBingo').click(); await pg.locator('#iconBingo').click();
  await pg.waitForSelector('.bgTitulo'); await pg.getByText('Soy el Bolero').click();
  const despues = await pg.evaluate(() => window.BingoUI.estado.p.bolas.slice());
  ok(JSON.stringify(antes) === JSON.stringify(despues), 'el bombo sobrevive a recargar la página');
  // auto
  await pg.getByText('Automático').click();
  await wait(300);
  ok(await pg.locator('.bgT.sal').count() >= 6, 'el modo automático saca una bola enseguida');
  await pg.getByText('Pausar').click();
  // cartones
  await pg.locator('#bingoMenuInicio').click();
  await pg.getByText('Mis cartones').click();
  await pg.waitForSelector('.bgCarton');
  ok(await pg.locator('.bgCarton').count() === 1 && await pg.locator('.bgCarton .bgC:not(.vacio)').count() === 15, 'un cartón con 15 números');
  await pg.locator('.bgBtn', { hasText: '+' }).first().click();
  ok(await pg.locator('.bgCarton').count() === 2, 'se pide un segundo cartón');
  const fila = await pg.evaluate(() => window.BingoUI.estado.loc.cartones[0][0].filter(n => n));
  for (const n of fila) await pg.locator('.bgCarton').first().locator('.bgC', { hasText: new RegExp('^' + n + '$') }).click();
  ok(await pg.locator('.bgBtn.lista').count() >= 1, 'al completar una fila el botón ¡LÍNEA! se ilumina');
  pg.once('dialog', d => { ok(/Línea/.test(d.message()), 'cantar línea con una fila completa es correcto'); d.accept(); });
  await pg.locator('.bgBtn.cantar').first().click({ force: true });
  await wait(200);
  // resto del escritorio sigue funcionando
  await pg.evaluate(() => window.openGame('dice'));
  await pg.waitForSelector('#winDice:not(.hidden)');
  ok(await pg.locator('#winBingo.hidden').count() === 1, 'abrir otro juego oculta el bingo');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

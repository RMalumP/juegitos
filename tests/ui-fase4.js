// Fase 4: Memoria (parejas, 2 jugadores), Simon (bot que repite la secuencia), Flappy (bot que sigue el hueco) y Wordle en español.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9442, 9441);
  const ctx = await env.contexto({ viewport: { width: 420, height: 820 } });
  const pg = await env.pagina(ctx, 'fase4');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => { window.memRapido = true; window.simRapido = true; window.wordleRapido = true; });
  const abrir = k => pg.evaluate(k => window.openGame(k), k).then(() => wait(450));

  // ================= MEMORIA =================
  await abrir('mem');
  const me = () => pg.evaluate(() => window.memEstado());
  ok((await pg.locator('#memBoard .memCarta').count()) === 16, 'memoria: tablero 4×4 con 16 cartas');
  let e = await me();
  const x = e.cartas.indexOf(0), y = e.cartas.indexOf(1);
  await pg.locator('#memBoard .memCarta').nth(x).click(); await pg.locator('#memBoard .memCarta').nth(y).click();
  ok((await pg.locator('#memBoard .memCarta.up').count()) === 2, 'memoria: un fallo deja las dos cartas boca arriba un momento');
  await wait(200);
  ok((await pg.locator('#memBoard .memCarta.up').count()) === 0 && (await me()).intentos === 1, 'memoria: tras el fallo se tapan y cuenta un intento');
  for (let id = 0; id < 8; id++) { e = await me(); const a = e.cartas.indexOf(id), b = e.cartas.lastIndexOf(id); await pg.locator('#memBoard .memCarta').nth(a).click(); await pg.locator('#memBoard .memCarta').nth(b).click(); }
  await pg.waitForSelector('#memOver.show', { timeout: 5000 });
  ok(/récord|Completado/.test(await pg.locator('#memOverT').innerText()), 'memoria: al terminar sale el resultado («' + await pg.locator('#memOverT').innerText() + '»)');
  ok(await pg.evaluate(() => parseFloat(localStorage.getItem('memBest_4x4'))) > 0, 'memoria: se guarda el mejor tiempo del tamaño');
  await pg.click('.memTam[data-t="6x6"]'); ok((await pg.locator('#memBoard .memCarta').count()) === 36, 'memoria: tablero 6×6 con 36 cartas');
  await pg.click('.memTam[data-t="4x5"]'); ok((await pg.locator('#memBoard .memCarta').count()) === 20, 'memoria: tablero 5×4 con 20 cartas');
  await pg.click('.memTam[data-t="4x4"]'); await pg.click('.memJug[data-j="2"]');
  ok(/jugador 1/.test(await pg.locator('#memTurno').innerText()), 'memoria 2 jugadores: empieza el jugador 1');
  e = await me(); await pg.locator('#memBoard .memCarta').nth(e.cartas.indexOf(0)).click(); await pg.locator('#memBoard .memCarta').nth(e.cartas.indexOf(1)).click(); await wait(250);
  ok(/jugador 2/.test(await pg.locator('#memTurno').innerText()), 'memoria 2 jugadores: tras un fallo pasa el turno');
  await pg.click('.memJug[data-j="1"]');

  // ================= SIMON =================
  await abrir('sim');
  const se = () => pg.evaluate(() => window.simEstado());
  ok(await pg.locator('#simStart').isVisible(), 'simon: pantalla de inicio');
  await pg.click('#simGo');
  for (let ronda = 1; ronda <= 4; ronda++) {
    await pg.waitForFunction(r => { const s = window.simEstado(); return s.fase === 'turno' && s.seq.length === r; }, ronda, { timeout: 15000 });
    const s = await se();
    for (const c of s.seq) { await pg.locator('.simPad[data-i="' + c + '"]').dispatchEvent('pointerdown'); await wait(15); }
  }
  await pg.waitForFunction(() => window.simEstado().seq.length === 5 && window.simEstado().fase !== 'fin', null, { timeout: 15000 });
  ok(true, 'simon: el bot repite 4 rondas seguidas y la secuencia crece');
  await pg.waitForFunction(() => window.simEstado().fase === 'turno', null, { timeout: 15000 });
  const s5 = await se(); const mal = (s5.seq[0] + 1) % 4;
  await pg.locator('.simPad[data-i="' + mal + '"]').dispatchEvent('pointerdown'); await wait(100);
  ok((await se()).fase === 'fin' && await pg.locator('#simOver.show').isVisible(), 'simon: fallar un color termina la partida');
  ok(await pg.evaluate(() => parseInt(localStorage.getItem('simBest_1'), 10)) >= 4, 'simon: se guarda el récord (≥4)');
  await pg.click('#simAgain'); await wait(300);
  ok((await se()).fase !== 'fin', 'simon: «otra vez» empieza una partida nueva');
  await pg.evaluate(() => window.pauseSim());

  // ================= FLAPPY =================
  await abrir('flap');
  ok(await pg.locator('.flapDif').count() === 3, 'flappy: 3 dificultades');
  await pg.click('.flapDif[data-d="0"]');
  let f = await pg.evaluate(() => window.flapEstado());
  ok(f.fase === 'listo' && f.dif === 0, 'flappy: empieza «listo» en Fácil');
  await pg.keyboard.press('Space'); await wait(100);
  ok((await pg.evaluate(() => window.flapEstado())).fase === 'jugando', 'flappy: un toque empieza la partida');
  await pg.evaluate(() => { window.__fb = setInterval(() => { const s = window.flapEstado(); if (s.fase !== 'jugando') return; const objetivo = s.gapY == null ? 230 : s.gapY + 8; if (s.by > objetivo && s.vy > -1) window.flapAletear(); }, 10); });
  await wait(14000);
  f = await pg.evaluate(() => window.flapEstado());
  ok(f.score >= 3, 'flappy: el bot pasa varias tuberías (puntos ' + f.score + ', estado ' + f.fase + ')');
  await pg.evaluate(() => clearInterval(window.__fb));
  await pg.waitForSelector('#flapOver.show', { timeout: 15000 });
  ok(await pg.evaluate(() => parseInt(localStorage.getItem('flapBest_0'), 10)) >= 3, 'flappy: al chocar sale GAME OVER y se guarda el récord');
  await pg.click('#flap-again'); ok((await pg.evaluate(() => window.flapEstado())).fase === 'listo', 'flappy: «otra vez» vuelve a «listo»');
  await pg.evaluate(() => window.pauseFlap());

  // ================= WORDLE =================
  await abrir('word');
  const we = () => pg.evaluate(() => window.wordleEstado());
  const escribir = async t => { for (const ch of t) await pg.keyboard.press(ch === 'ñ' ? 'Semicolon' : 'Key' + ch.toUpperCase()).catch(() => {}); };
  ok(await pg.locator('#wrdBoard .wrdCasilla').count() === 30 && await pg.locator('#wrdKeys .wrdTecla[data-k="ñ"]').count() === 1, 'wordle: 6×5 casillas y tecla Ñ');
  let w = await we(); ok(w.modo === 'dia' && w.sol.length === 5, 'wordle: empieza con la palabra del día');
  await pg.keyboard.type('zzzzz'); await pg.keyboard.press('Enter'); await wait(100);
  ok(/No está en la lista/.test(await pg.locator('#wrdMsg').innerText()) && (await we()).intentos.length === 0, 'wordle: una palabra que no existe se rechaza');
  for (let i = 0; i < 5; i++) await pg.keyboard.press('Backspace');
  await pg.keyboard.type('abc'); await pg.keyboard.press('Enter'); await wait(100);
  ok(/Faltan letras/.test(await pg.locator('#wrdMsg').innerText()), 'wordle: con menos de 5 letras avisa');
  await pg.keyboard.press('Backspace'); await pg.keyboard.press('Backspace'); await pg.keyboard.press('Backspace');
  const mala = ['ahora', 'mujer', 'nunca'].find(p => p !== w.sol);
  await pg.keyboard.type(mala); await pg.keyboard.press('Enter'); await wait(100);
  w = await we(); ok(w.intentos.length === 1 && w.intentos[0] === mala, 'wordle: un intento válido se acepta');
  ok(await pg.locator('#wrdBoard .wrdFila').first().locator('.e0, .e1, .e2').count() === 5, 'wordle: las 5 letras se colorean');
  ok(await pg.locator('#wrdKeys .wrdTecla.e0, #wrdKeys .wrdTecla.e1, #wrdKeys .wrdTecla.e2').count() > 0, 'wordle: el teclado en pantalla también se colorea');
  for (const ch of w.sol) await pg.locator('#wrdKeys .wrdTecla[data-k="' + ch + '"]').dispatchEvent('pointerdown');
  await pg.locator('#wrdKeys .wrdTecla[data-k="Enter"]').dispatchEvent('pointerdown');
  await pg.waitForSelector('#wrdOver.show', { timeout: 5000 });
  ok(/acertado|Genial|Increíble|Muy bien|Bien hecho|Por poco|justo/.test(await pg.locator('#wrdOverT').innerText() + await pg.locator('#wrdOverS').innerText()), 'wordle: al acertar con el teclado en pantalla sale la victoria');
  ok((await we()).stats.jugadas === 1 && (await we()).stats.ganadas === 1 && (await we()).stats.racha === 1, 'wordle: se actualizan las estadísticas (1 jugada, 1 victoria, racha 1)');
  await pg.reload(); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => { window.wordleRapido = true; }); await abrir('word');
  await pg.waitForSelector('#wrdOver.show', { timeout: 5000 });
  ok((await we()).intentos.length === 2, 'wordle: al recargar se conserva la palabra del día ya resuelta');
  await pg.click('#wrdAgain'); await wait(100);
  w = await we(); ok(w.modo === 'libre' && w.intentos.length === 0, 'wordle: «palabra libre» empieza otra partida sin tocar la del día');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

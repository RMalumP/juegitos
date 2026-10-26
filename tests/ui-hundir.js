// Hundir la flota: contra la CPU, 2 jugadores en un móvil (con la tapa «pasa el móvil») y colocación manual.
const { entorno, wait, ok, fin } = require('./helpers');
const est = pg => pg.evaluate(() => window.hundirEstado());
const txt = (pg, s) => pg.locator(s).innerText();
async function abrir(pg) {
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => { window.hundirRapido = true; });
  await pg.evaluate(() => window.openGame('hundir')); await wait(400);
  await pg.evaluate(() => { window.PasarMovil.retardo = 0; });
}
const boton = (pg, t) => pg.locator('#hunBtns button', { hasText: t });
async function colocarAleatorio(pg) { await boton(pg, 'Aleatorio').click(); await boton(pg, 'Listo').click(); await wait(80); }
async function dispararPrimero(pg) {
  const c = pg.locator('#hunEnemy .hunC:not(:disabled)').first();
  if (await c.count() === 0) return false;
  await c.click(); return true;
}

(async () => {
  const env = await entorno(9392, 9391);
  const ctx = await env.contexto({ viewport: { width: 420, height: 800 } });
  const pg = await env.pagina(ctx, 'hundir');
  pg.on('dialog', d => d.accept());
  await abrir(pg);

  // ---------- menú ----------
  ok(await pg.locator('#hunMenu').isVisible(), 'menú: se muestra al abrir el juego');
  ok(await pg.locator('#hunMenu [data-modo]').count() === 3, 'menú: CPU, 2 jugadores y online');
  await pg.click('#hunMenu [data-nivel="3"]');
  ok((await est(pg)).nivel === 3, 'menú: se elige la dificultad Difícil');
  ok(await pg.locator('[data-conectar=hundir]').count() === 1, 'ventana: botón «🌐 Conectar» del modo online');

  // ---------- colocación manual ----------
  await pg.click('#hunMenu [data-modo="cpu"]'); await wait(100);
  ok(!(await pg.locator('#hunMenu').isVisible()), 'cpu: el menú se oculta y se entra a colocar');
  ok(await pg.locator('#hunShips .hunBarco').count() === 5, 'colocar: 5 barcos para elegir');
  const celda = (r, c) => pg.locator('#hunOwn .hunC').nth(r * 10 + c);
  await celda(0, 3).click();
  let e = await est(pg);
  ok(e.draft[0] && e.draft[0].l === 5 && e.draft[0].r === 0 && e.draft[0].c === 3 && e.draft[0].h === true, 'colocar: el portaaviones queda en A4 horizontal');
  await celda(0, 0).click();                                            // el siguiente barco (4) llegaría hasta la casilla 4 y solapa con el primero
  ok(!(await est(pg)).draft[1], 'colocar: no deja solapar barcos');
  ok((await txt(pg, '#hunStatus')).includes('no cabe'), 'colocar: avisa de que no cabe');
  await boton(pg, 'Horizontal').click();
  ok((await est(pg)).draft[0] !== null, 'colocar: girar no borra lo colocado');
  await celda(2, 9).click();                                            // vertical en borde: se ajusta para caber
  e = await est(pg);
  ok(e.draft[1] && e.draft[1].h === false && e.draft[1].r + 4 <= 10, 'colocar: un barco vertical se ajusta al tablero');
  await celda(0, 3).click();
  ok((await est(pg)).draft[0] === null, 'colocar: tocar un barco puesto lo recoge');
  ok(await boton(pg, 'Listo').isDisabled(), 'colocar: «Listo» está desactivado con la flota incompleta');
  await boton(pg, 'Borrar').click(); ok((await est(pg)).draft.every(x => !x), 'colocar: «Borrar» vacía el tablero');

  // ---------- partida completa contra la CPU ----------
  await colocarAleatorio(pg);
  e = await est(pg);
  ok(e.fase === 'jugando', 'cpu: con las dos flotas colocadas empieza la batalla');
  ok(await pg.locator('#hunEnemy').isVisible() && await pg.locator('#hunOwn .barco').count() === 17, 'cpu: se ven las aguas enemigas y mis 17 casillas de barco');
  let turnos = 0;
  while (!(await pg.locator('#hunFin').isVisible()) && turnos < 400) {
    if (!(await dispararPrimero(pg))) await wait(25);
    turnos++; if (turnos % 5 === 0) await wait(20);
  }
  ok(await pg.locator('#hunFin').isVisible(), 'cpu: la partida termina con victoria o derrota');
  const fintxt = await txt(pg, '#hunFinT');
  ok(/VICTORIA|DERROTA/.test(fintxt), 'cpu: el final dice quién ha ganado («' + fintxt + '»)');
  await pg.click('#hunFinBtn'); await wait(100);
  ok(await pg.locator('#hunMenu').isVisible(), 'cpu: «Jugar de nuevo» vuelve al menú');

  // ---------- 2 jugadores en un móvil ----------
  await pg.click('#hunMenu [data-modo="local"]'); await wait(100);
  ok((await est(pg)).modo === 'local' && (await txt(pg, '#hunStatus')).includes('Jugador 1'), 'local: coloca el Jugador 1');
  await colocarAleatorio(pg);
  ok(await pg.locator('.pmCubierta').isVisible(), 'local: al acabar de colocar sale la tapa «pasa el móvil»');
  ok(await pg.locator('#hunOwn .barco').count() === 0, 'local: detrás de la tapa no queda ninguna flota a la vista');
  ok((await txt(pg, '.pmTitulo')).includes('Jugador 2'), 'local: la tapa pide pasar el móvil al Jugador 2');
  await pg.click('.pmBoton'); await wait(100);
  ok(!(await est(pg)).draft.some(Boolean) && (await txt(pg, '#hunStatus')).includes('Jugador 2'), 'local: el Jugador 2 empieza con el tablero vacío');
  await colocarAleatorio(pg);
  ok(await pg.locator('.pmCubierta').isVisible(), 'local: tapa antes de empezar los disparos');
  await pg.click('.pmBoton'); await wait(100);
  e = await est(pg);
  ok(e.fase === 'jugando', 'local: empieza la batalla');
  const quien = e.actor;
  await dispararPrimero(pg); await wait(60);
  e = await est(pg);
  if (e.bloqueado) {
    ok(await pg.locator('#hunEnemy .hunC:not(:disabled)').count() === 0, 'local: tras disparar no se puede disparar otra vez hasta pasar el móvil');
    await boton(pg, 'Pasar el móvil').click();
    ok(await pg.locator('.pmCubierta').isVisible() && await pg.locator('#hunOwn .barco').count() === 0 && await pg.locator('#hunEnemy .toc, #hunEnemy .agua').count() === 0, 'local: al pasar el móvil la pantalla queda tapada y vacía');
    await pg.click('.pmBoton'); await wait(60);
    ok((await est(pg)).actor !== quien, 'local: cambia el jugador que mira la pantalla');
  }
  let t2 = 0;
  while (!(await pg.locator('#hunFin').isVisible()) && t2 < 500) {
    const s = await est(pg);
    if (s.bloqueado) { await boton(pg, 'Pasar el móvil').click(); await pg.click('.pmBoton'); await wait(10); }
    else await dispararPrimero(pg);
    t2++;
  }
  ok(await pg.locator('#hunFin').isVisible() && (await txt(pg, '#hunFinT')).includes('Gana'), 'local: la partida termina y dice quién gana');
  ok(await pg.locator('#hunEnemy .rev, #hunEnemy .hund').count() > 0, 'local: al final se ven los barcos del rival');

  // ---------- tamaño del agua y flota configurables ----------
  async function partidaCompleta() {
    let t = 0;
    while (!(await pg.locator('#hunFin').isVisible()) && t < 500) { if (!(await dispararPrimero(pg))) await wait(20); t++; if (t % 5 === 0) await wait(15); }
    return pg.locator('#hunFin').isVisible();
  }
  await pg.evaluate(() => window.hundirStartNew()); await wait(100);
  ok(await pg.locator('#hunMenu [data-plantilla]').count() === 5, 'config: 4 plantillas y «Personalizar»');
  ok(/10×10 · 5 barcos \(17 casillas\)/.test(await pg.locator('#hunResumen').innerText()), 'config: por defecto la flota clásica 10×10');
  await pg.click('#hunMenu [data-plantilla="rapida"]');
  ok(/8×8 · 4 barcos \(12 casillas\)/.test(await pg.locator('#hunResumen').innerText()), 'config: «Rápida» = 8×8 con 4 barcos');
  await pg.click('#hunMenu [data-modo="cpu"]'); await wait(100);
  ok(await pg.locator('#hunOwn .hunC').count() === 64 && await pg.locator('#hunShips .hunBarco').count() === 4, '8×8: 64 casillas y 4 barcos para colocar');
  await pg.locator('#hunOwn .hunC').nth(5).click();                              // el portaaviones (4) se ajusta al borde: columna 4
  e = await est(pg);
  ok(e.draft[0] && e.draft[0].l === 4 && e.draft[0].c === 4 && e.draft[0].r === 0, '8×8: un barco de 4 se ajusta al borde del tablero pequeño');
  await colocarAleatorio(pg);
  ok(await pg.locator('#hunOwn .barco').count() === 12 && (await est(pg)).fase === 'jugando', '8×8: la flota ocupa 12 casillas y empieza la batalla');
  ok(await partidaCompleta(), '8×8: la partida contra la CPU termina');
  await pg.click('#hunFinBtn'); await wait(100);

  await pg.click('#hunMenu [data-plantilla="grande"]'); await pg.click('#hunMenu [data-modo="cpu"]'); await wait(100);
  ok(await pg.locator('#hunOwn .hunC').count() === 144 && await pg.locator('#hunShips .hunBarco').count() === 8, '12×12: 144 casillas y 8 barcos');
  await colocarAleatorio(pg); ok(await pg.locator('#hunOwn .barco').count() === 29, '12×12: la flota ocupa 29 casillas');
  await pg.evaluate(() => window.hundirStartNew()); await wait(100);
  await pg.click('#hunMenu [data-plantilla="armada"]'); await pg.click('#hunMenu [data-modo="cpu"]'); await wait(100);
  ok(await pg.locator('#hunOwn .hunC').count() === 225 && await pg.locator('#hunShips .hunBarco').count() === 12, '15×15: 225 casillas y 12 barcos');
  await colocarAleatorio(pg); ok(await pg.locator('#hunOwn .barco').count() === 40, '15×15: la flota ocupa 40 casillas');

  // personalizar: tablero 6×6 con 3 barcos; una flota imposible se rechaza
  await pg.evaluate(() => window.hundirStartNew()); await wait(100);
  await pg.click('#hunMenu [data-plantilla="custom"]');
  ok(await pg.locator('#hunPers').isVisible(), 'personalizar: aparece el editor de tablero y barcos');
  for (let i = 0; i < 12; i++) await pg.click('#hunMenu [data-nstep="-1"]');
  ok((await pg.locator('#hunNval').innerText()) === '6×6', 'personalizar: el tablero no baja de 6×6');
  for (let l = 1; l <= 6; l++) for (let i = 0; i < 5; i++) await pg.click('#hunMenu [data-bl="' + l + '"][data-d="-1"]');
  ok(/⚠/.test(await pg.locator('#hunCfgMsg').innerText()) && await pg.locator('#hunMenu [data-modo="cpu"]').isDisabled() && await pg.locator('#hunMenu [data-modo="local"]').isDisabled(), 'personalizar: sin barcos no se puede empezar');
  for (let i = 0; i < 4; i++) await pg.click('#hunMenu [data-bl="6"][data-d="1"]');
  ok(/demasiado grande/.test(await pg.locator('#hunCfgMsg').innerText()) && await pg.locator('#hunMenu [data-modo="cpu"]').isDisabled(), 'personalizar: una flota que no cabe se rechaza con aviso');
  for (let i = 0; i < 4; i++) await pg.click('#hunMenu [data-bl="6"][data-d="-1"]');
  await pg.click('#hunMenu [data-bl="3"][data-d="1"]'); await pg.click('#hunMenu [data-bl="2"][data-d="1"]'); await pg.click('#hunMenu [data-bl="2"][data-d="1"]');
  ok((await pg.locator('#hunCfgMsg').innerText()) === '' && await pg.locator('#hunMenu [data-modo="cpu"]').isEnabled() && /6×6 · 3 barcos \(7 casillas\)/.test(await pg.locator('#hunResumen').innerText()), 'personalizar: 6×6 con un barco de 3 y dos de 2 es válido');
  // se recuerda al recargar
  await pg.reload(); await abrir(pg);
  ok(/6×6 · 3 barcos/.test(await pg.locator('#hunResumen').innerText()), 'config: la partida personalizada se recuerda al recargar');
  await pg.click('#hunMenu [data-modo="cpu"]'); await wait(100);
  ok(await pg.locator('#hunOwn .hunC').count() === 36 && await pg.locator('#hunShips .hunBarco').count() === 3, '6×6: 36 casillas y 3 barcos');
  await colocarAleatorio(pg); ok(await partidaCompleta(), '6×6: la partida termina');
  await pg.click('#hunFinBtn'); await wait(100);
  // sin tocarse: una flota que solo cabe tocándose queda desactivada
  await pg.click('#hunMenu [data-plantilla="armada"]'); await pg.click('#hunMenu [data-reg="tocar"][data-v="0"]');
  ok((await pg.locator('#hunMenu [data-modo="cpu"]').isEnabled()), 'armada 15×15 sigue siendo válida sin tocarse');
  await pg.click('#hunMenu [data-plantilla="custom"]');
  for (let i = 0; i < 9; i++) await pg.click('#hunMenu [data-nstep="-1"]');
  ok(await pg.locator('#hunMenu [data-modo="cpu"]').isDisabled(), 'una flota de 40 casillas no cabe en 6×6 sin tocarse');
  await pg.click('#hunMenu [data-reg="tocar"][data-v="1"]'); await pg.click('#hunMenu [data-plantilla="clasica"]');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

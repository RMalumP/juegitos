// Conecta 4 y Tres en raya: menú, partida contra la CPU (3 niveles), 2 jugadores en un móvil, victoria/empate y revancha.
const { entorno, wait, ok, fin } = require('./helpers');
const JUEGOS = [
  { id: 'c4', Name: 'C4', win: 'winC4', celda: '.c4Celda', n: 42, nombre: 'Conecta 4', gana: [0, 1, 0, 1, 0, 1, 0], ganaTxt: /Gana Rojas/, jug: i => ({ col: i }) },
  { id: 'ttt', Name: 'Ttt', win: 'winTtt', celda: '.tttCelda', n: 9, nombre: 'Tres en raya', gana: [0, 3, 1, 4, 2], ganaTxt: /Gana Equis/ }
];
(async () => {
  const env = await entorno(9432, 9431);
  const ctx = await env.contexto({ viewport: { width: 420, height: 800 } });
  const pg = await env.pagina(ctx, 'duelo');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => { window.dueloRapido = true; });
  for (const J of JUEGOS) {
    const W = '#' + J.id + 'Wrap', est = () => pg.evaluate(id => window[id + 'Estado'](), J.id);
    const celdas = () => pg.locator(W + ' ' + J.celda);
    await pg.evaluate(k => window.openGame(k), J.id); await wait(500);
    ok(await pg.locator(W + ' .duMenu').isVisible(), J.nombre + ': menú al abrir');
    ok(await pg.locator(W + ' .duMenu [data-modo]').count() === 3 && await pg.locator('[data-conectar=' + J.id + ']').count() === 1, J.nombre + ': CPU, 2 jugadores y online (botón Conectar)');
    ok(await celdas().count() === J.n, J.nombre + ': tablero con ' + J.n + ' casillas');

    // ---- 2 jugadores en un móvil
    await pg.click(W + ' [data-modo=local]'); await wait(100);
    ok((await est()).modo === 'local' && /Turno de/.test(await pg.locator(W + ' .duStatus').innerText()), J.nombre + ': 2 jugadores, turno del primero');
    for (const m of J.gana) { await celdas().nth(m).click(); await wait(30); }
    await wait(100);
    ok(await pg.locator(W + ' .duFin').isVisible() && J.ganaTxt.test(await pg.locator(W + ' .duFin h1').innerText()), J.nombre + ': gana el primer jugador («' + await pg.locator(W + ' .duFin h1').innerText() + '»)');
    ok(await pg.locator(W + ' .gana').count() >= (J.id === 'c4' ? 4 : 3), J.nombre + ': se resalta la línea ganadora');
    const antes = (await est()).est.n;
    await pg.click(W + ' .duFin [data-r=otra]'); await wait(100);
    ok(!(await pg.locator(W + ' .duFin').isVisible()) && (await est()).est.n === 0 && antes > 0, J.nombre + ': la revancha empieza otra partida');

    // ---- contra la CPU
    await pg.click(W + ' .duFin [data-r=menu]').catch(() => {});
    await pg.evaluate(id => window[id + 'StartNew'](), J.id); await wait(80);
    for (const nivel of [1, 2, 3]) {
      await pg.click(W + ' .duMenu [data-nivel="' + nivel + '"]'); await pg.click(W + ' [data-modo=cpu]'); await wait(80);
      let t = 0;
      while (!(await pg.locator(W + ' .duFin').isVisible()) && t < 300) {
        const c = pg.locator(W + ' ' + J.celda + ':not(:disabled)'); if (await c.count()) await c.nth(Math.floor(Math.random() * await c.count())).click(); else await wait(15);
        t++;
      }
      const txt = await pg.locator(W + ' .duFin h1').innerText();
      ok(/ganado|perdido|Empate/.test(txt), J.nombre + ' CPU nivel ' + nivel + ': la partida termina («' + txt + '»)');
      if (J.id === 'ttt' && nivel === 3) ok(!/ganado/.test(txt), 'Tres en raya difícil: la CPU nunca pierde contra jugadas al azar');
      await pg.evaluate(id => window[id + 'StartNew'](), J.id); await wait(60);
    }
  }
  // ---- el tablero no se deforma al aparecer símbolos (en móvil y en ordenador)
  for (const [w, h, t] of [[400, 760, true], [1366, 768, false], [1920, 1080, false]]) {
    const cx = await env.contexto({ hasTouch: t, isMobile: t, viewport: { width: w, height: h } });
    const p = await env.pagina(cx, 'forma' + w);
    await p.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
    await p.evaluate(() => window.openGame('ttt')); await wait(500); await p.click('#tttWrap [data-modo=local]');
    for (const m of [6, 4, 0]) { await p.locator('#tttWrap .tttCelda').nth(m).click(); await wait(40); }
    const med = await p.evaluate(() => { const c = [...document.querySelectorAll('.tttCelda')].map(e => e.getBoundingClientRect()); const sv = [...document.querySelectorAll('.tttCelda svg')].map(e => e.getBoundingClientRect()); return { filas: [0, 3, 6].map(i => c[i].height), anchos: [0, 1, 2].map(i => c[i].width), x: sv[0] && sv[0].width, o: sv[1] && sv[1].width }; });
    ok(Math.max(...med.filas) - Math.min(...med.filas) <= 1 && Math.abs(med.filas[0] - med.anchos[0]) <= 1, 'Tres en raya ' + w + '×' + h + ': las 3 filas miden lo mismo y las casillas son cuadradas (' + med.filas.map(Math.round).join('/') + ')');
    ok(med.x > 0 && Math.abs(med.x - med.o) <= 1, 'Tres en raya ' + w + '×' + h + ': la ❌ y el ⭕ tienen el mismo tamaño');
    await cx.close();
  }
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

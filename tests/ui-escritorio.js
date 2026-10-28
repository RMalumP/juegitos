// Ordenador: escalado por altura (--ui), menú de inicio grande, juegos verticales que NO se ensanchan, juegos anchos que sí, ventanas dentro de la pantalla,
// puntero correcto con el zoom (Breakout, Tetris con gestos activados) y móvil sin cambios.
const { entorno, wait, ok, fin } = require('./helpers');
const JUEGOS = ['mine', 'tetris', 'inv', 'snk', 'pac', 'chess', 'parchis', 'ast', 'sud', 'sol', 'carta', 'bj', 'roul', 'poker', 'pong', 'frog', 'hundir', 'g2048', 'brk', 'pin', 'c4', 'ttt', 'domino', 'mem', 'sim', 'flap', 'word', 'dice', 'bingo'];
const VERTICALES = ['tetris', 'brk', 'pin', 'flap', 'word', 'pac', 'frog', 'hundir', 'g2048', 'mem', 'sim', 'c4', 'ttt', 'domino', 'snk', 'sud', 'dice'];
const ANCHOS = ['inv', 'ast', 'pong', 'mine', 'sol', 'carta', 'bj', 'roul', 'poker', 'bingo'];
const geo = pg => pg.evaluate(() => {
  const w = [...document.querySelectorAll('.win')].find(x => !x.classList.contains('hidden')); const b = w.getBoundingClientRect();
  return { l: b.left, t: b.top, w: b.width, h: b.height, tb: document.getElementById('taskbar').getBoundingClientRect().top, forma: w.getAttribute('data-forma') };
});
(async () => {
  const env = await entorno(9492, 9491);

  for (const [W, H] of [[1920, 1080], [1366, 768]]) {
    const ctx = await env.contexto({ hasTouch: false, isMobile: false, viewport: { width: W, height: H } });
    const pg = await env.pagina(ctx, 'pc' + W);
    const ui = +(await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui')));
    ok(Math.abs(ui - Math.max(1, Math.min(1.8, H / 760))) < 0.02, W + '×' + H + ': el factor --ui sigue a la altura (' + ui + ')');
    const sb = await pg.evaluate(() => { const b = document.getElementById('startBox').getBoundingClientRect(); return { w: b.width, h: b.height, cols: getComputedStyle(document.querySelector('.gameChoice')).gridTemplateColumns.split(' ').length }; });
    ok(sb.cols === 5 && sb.w >= 650 && sb.h <= H - 40, W + '×' + H + ': el menú de inicio es grande (' + Math.round(sb.w) + '×' + Math.round(sb.h) + ', 5 columnas) y cabe');
    await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
    let malas = [];
    for (const j of JUEGOS) {
      await pg.evaluate(k => window.openGame(k), j); await wait(250);
      const g = await geo(pg);
      if (g.t < -1 || g.l < -1 || g.l + g.w > W + 1 || g.t + g.h > g.tb + 1) malas.push(j + ' fuera de pantalla');
      if (VERTICALES.includes(j) && g.w / g.h > 0.8) malas.push(j + ' vertical demasiado ancho (' + Math.round(g.w) + '×' + Math.round(g.h) + ')');
      if (ANCHOS.includes(j) && g.forma !== 'ancho') malas.push(j + ' sin forma ancha');
      if (['chess', 'parchis'].includes(j) && g.w < W - 20) malas.push(j + ' debería ocupar el ancho');
    }
    ok(malas.length === 0, W + '×' + H + ': las 28 ventanas caben, los verticales siguen siendo columnas y Ajedrez/Parchís ocupan el ancho' + (malas.length ? ' → ' + malas.join('; ') : ''));
    if (W === 1920) {
      const gt = (await (async () => { await pg.evaluate(() => window.openGame('tetris')); await wait(200); return geo(pg); })());
      ok(gt.w > 600 && gt.w < 720, 'Tetris a 1920×1080 mide ≈' + Math.round(gt.w) + ' px de ancho (no se ensancha) y toda la altura (' + Math.round(gt.h) + ')');
      const gm = await (async () => { await pg.evaluate(() => window.openGame('mine')); await wait(200); return geo(pg); })();
      ok(gm.w > 1200, 'Buscaminas (ancho) usa más anchura (' + Math.round(gm.w) + ')');

      // puntero con zoom: Breakout sigue al ratón y Tetris obedece a un arrastre
      await pg.evaluate(() => window.openGame('brk')); await wait(300);
      await pg.click('#brk-startBtn'); await wait(200);
      const cv = await pg.locator('#brkC').boundingBox();
      await pg.mouse.move(cv.x + cv.width * 0.5, cv.y + cv.height * 0.8); await pg.mouse.down(); await pg.mouse.move(cv.x + cv.width * 0.2, cv.y + cv.height * 0.8, { steps: 6 }); await wait(300);
      const px = (await pg.evaluate(() => window.brkEstado())).paddle;
      ok(Math.abs(px - 64) < 20, 'Breakout: con el zoom la pala sigue al ratón (x=' + Math.round(px) + ', esperado ≈64 de 320)');
      await pg.mouse.up();
      await pg.evaluate(() => window.Opciones.set('tactil', 'si'));
      await pg.evaluate(() => window.openGame('tetris')); await wait(300);
      await pg.click('#tet-ov-btn'); await wait(200); await pg.evaluate(() => window.tetCongelar(true));
      const tb = await pg.locator('#tet-bc').boundingBox(), celda = tb.width / 10, x0 = await pg.evaluate(() => window.tetEstado().x);
      await pg.mouse.move(tb.x + tb.width * 0.3, tb.y + tb.height * 0.4); await pg.mouse.down();
      await pg.mouse.move(tb.x + tb.width * 0.3 + celda * 3, tb.y + tb.height * 0.4, { steps: 8 }); await pg.mouse.up(); await wait(100);
      const dx = (await pg.evaluate(() => window.tetEstado().x)) - x0;
      ok(dx >= 2 && dx <= 4, 'Tetris: con el zoom, arrastrar 3 casillas mueve la pieza ≈3 (movió ' + dx + ')');
    }
    await ctx.close();
  }

  const cm = await env.contexto({ hasTouch: true, isMobile: true, viewport: { width: 400, height: 760 } });
  const mv = await env.pagina(cm, 'movil');
  ok(+(await mv.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui'))) === 1, 'móvil: el factor --ui es 1 (sin cambios)');
  ok(await mv.evaluate(() => getComputedStyle(document.querySelector('.gameChoice')).gridTemplateColumns.split(' ').length) === 3, 'móvil: el menú de inicio sigue en 3 columnas');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

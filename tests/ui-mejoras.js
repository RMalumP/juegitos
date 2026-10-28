// Mejoras traídas de main: Sudoku experto rápido, cronómetro que se reanuda, pausa al ocultar la pestaña, relojes del ajedrez,
// récords, rival por ordenador en Ajedrez y Damas, y accesibilidad de los botones.
const { entorno, wait, ok, fin } = require('./helpers');
(async () => {
  const env = await entorno(9532, 9531);
  const ctx = await env.contexto();
  const pg = await env.pagina(ctx, 'mejoras');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  const F = (js, arg) => pg.evaluate(([js, arg]) => document.getElementById('chessFrame').contentWindow.eval('(function(arg){' + js + '})')(arg), [js, arg]);

  // ---- Sudoku ----
  await pg.evaluate(() => openGame('sud'));
  await pg.waitForFunction(() => typeof sudGeneratePuzzle === 'function' && SUD.puzzle);
  const exp = await pg.evaluate(() => { const t = performance.now(), p = sudGeneratePuzzle(24); return { ms: performance.now() - t, pistas: p.puzzle.flat().filter(Boolean).length, unica: sudCountSolutions(p.puzzle, 2) === 1 }; });
  ok(exp.ms < 400 && exp.pistas === 24 && exp.unica, 'Sudoku experto: 24 pistas, solución única, en ' + Math.round(exp.ms) + ' ms');
  await pg.click('#btnMinSud');
  ok(await pg.evaluate(() => SUD.timerId === null), 'al minimizar el Sudoku se para el cronómetro');
  await pg.click('#chipSud');
  ok(await pg.evaluate(() => SUD.timerId !== null), 'al volver desde la barra de tareas el cronómetro sigue');
  const ocultar = h => pg.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, h);
  await ocultar(true);
  ok(await pg.evaluate(() => SUD.timerId === null), 'al ocultar la pestaña se pausa el juego visible');
  await ocultar(false);
  ok(await pg.evaluate(() => SUD.timerId !== null), 'y al volver el cronómetro del Sudoku se reanuda');
  await pg.evaluate(() => { SUD.seconds = 75; SUD.puzzle = SUD.solution.map(r => [...r]); sudWin(); });
  ok(/Nuevo récord/.test(await pg.textContent('#sudOSub')), 'récord de Sudoku al ganar');
  await pg.evaluate(() => { sudNewGame(); SUD.seconds = 90; SUD.puzzle = SUD.solution.map(r => [...r]); sudWin(); });
  ok(/Récord: 01:15/.test(await pg.textContent('#sudOSub')), 'una partida más lenta muestra el récord anterior (01:15)');

  // ---- Récords en Tetris ----
  await pg.evaluate(() => openGame('tetris'));
  await pg.waitForFunction(() => document.getElementById('tetOverlay'));
  ok(await pg.evaluate(() => saveRecord('tetris', 500).isNew && !saveRecord('tetris', 100).isNew && loadRecord('tetris') === 500), 'saveRecord guarda solo la mejor puntuación');

  // ---- Ajedrez: relojes y rival ----
  await pg.evaluate(() => window.openChessTab(0));
  await pg.waitForFunction(() => { const w = document.getElementById('chessFrame').contentWindow; return w && typeof w.pauseClocks === 'function' && w.document.getElementById('ai-chess-level'); });
  await F('chessClockSetMode("auto"); chessClockAutoToggle()');
  ok(await F('return chessClock.running'), 'el reloj del ajedrez corre');
  await pg.click('#btnMinChess');
  ok(!(await F('return chessClock.running')), 'al minimizar el Ajedrez se pausa su reloj');
  await pg.click('#chipChess');
  await F('const l=document.getElementById("ai-chess-level"),s=document.getElementById("ai-chess-side"); l.value="easy"; s.value="w"; l.onchange()');
  await pg.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('chess').history.length >= 1, null, { timeout: 8000 });
  ok(await F('return chess.turn === "b"'), 'Ajedrez: con la máquina en blancas, mueve ella primero y luego te toca');
  await F('document.getElementById("ai-chess-level").value="off"; document.getElementById("ai-chess-level").onchange()');
  await pg.evaluate(() => window.openChessTab(2));
  await F('const l=document.getElementById("ai-checkers-level"),s=document.getElementById("ai-checkers-side"); l.value="easy"; s.value="w"; l.onchange()');
  await pg.waitForFunction(() => document.getElementById('chessFrame').contentWindow.eval('ck').history.length >= 1, null, { timeout: 8000 });
  ok(await F('return ck.turn === 2'), 'Damas: con la máquina en blancas, mueve ella primero');
  await F('document.getElementById("ai-checkers-level").value="off"; document.getElementById("ai-checkers-level").onchange()');

  // ---- Accesibilidad ----
  const a = await pg.evaluate(() => { const i = document.getElementById('iconMine'), c = document.getElementById('btnCloseSud'); return { rol: i.getAttribute('role'), tab: i.tabIndex, cerrar: c && c.getAttribute('aria-label') }; });
  ok(a.rol === 'button' && a.tab === 0 && a.cerrar === 'Cerrar', 'los botones <div> tienen rol de botón, foco y nombre');
  ok(await pg.evaluate(() => !/user-scalable=no/.test(document.querySelector('meta[name=viewport]').content)), 'se puede ampliar con dos dedos');

  await env.cerrar();
  fin();
})().catch(e => { console.error(e); process.exit(1); });

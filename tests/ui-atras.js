// Botón «atrás» del móvil: cierra la capa superior (modal → menú de inicio → conexión → ventana de juego) y, sin capas, sale de la web.
const { entorno, wait, ok, fin } = require('./helpers');

(async () => {
  const env = await entorno(9472, 9471);
  const ctx = await env.contexto({ viewport: { width: 400, height: 760 } });
  const pg = await env.pagina(ctx, 'atras');
  const capa = () => pg.evaluate(() => window.Atras.capa());
  const entrada = () => pg.evaluate(() => window.Atras.entrada());
  const atras = async () => { await pg.goBack().catch(() => null); await wait(250); };
  const oculta = id => pg.evaluate(i => document.getElementById(i).classList.contains('hidden'), id);
  const inicioVisible = () => pg.evaluate(() => getComputedStyle(document.getElementById('startScreen')).display !== 'none');
  const abrir = async j => { await pg.evaluate(x => window.openGame(x), j); await wait(450); };

  // a) menú de inicio visible → «atrás» lo cierra
  ok(await inicioVisible(), 'al cargar se ve el menú «¿Qué quieres jugar?»');
  await pg.keyboard.press('KeyX'); await wait(150);                      // primera interacción: crea la entrada de historial
  ok(await capa() === 'inicio' && await entrada(), 'menú de inicio: es la capa superior y hay una entrada de historial');
  await atras();
  ok(!(await inicioVisible()), 'atrás cierra el menú de inicio');
  ok(await capa() === null && !(await entrada()), 'sin capas: no queda entrada extra');

  // b) juego abierto → «atrás» lo minimiza
  await abrir('brk');
  ok(await capa() === 'ventana' && await entrada(), 'juego abierto: capa «ventana» con entrada de historial');
  ok(!(await oculta('winBrk')), 'Breakout está visible');
  await atras();
  ok(await oculta('winBrk'), 'atrás minimiza el juego (Breakout)');
  ok(await pg.locator('#chipBrk').isVisible(), 'el juego minimizado sigue en la barra de tareas');
  ok(!(await pg.url()).includes('about:blank'), 'seguimos en la web app');

  // c) menú de inicio encima de un juego: primero se cierra el menú, luego el juego
  await abrir('brk');
  await pg.click('#startBtn'); await wait(150);
  ok(await capa() === 'inicio', 'menú de inicio sobre un juego: capa «inicio»');
  await atras();
  ok(!(await inicioVisible()) && !(await oculta('winBrk')), 'primer atrás: cierra el menú y deja el juego');
  await atras();
  ok(await oculta('winBrk'), 'segundo atrás: minimiza el juego');

  // d) pantalla de conexión de un juego → «atrás» vuelve a ese juego
  await abrir('chess');
  await pg.evaluate(() => window.Sala.lobby('ajedrez')); await wait(500);
  ok(await capa() === 'sala', 'pantalla de conexión: capa «sala»');
  ok(!(await oculta('winSala')), 'la ventana de conexión está visible');
  await atras();
  ok(await oculta('winSala') && !(await oculta('winChess')), 'atrás desde Conectar vuelve a Ajedrez');
  await atras();
  ok(await oculta('winChess'), 'otro atrás minimiza Ajedrez');

  // e) modal de opciones
  await abrir('tetris');
  await pg.evaluate(() => window.Opciones.abrir('Tetris')); await wait(200);
  ok(await capa() === 'modal', 'modal de Opciones: capa «modal»');
  await atras();
  ok(!(await pg.locator('#optModal.show').count()) && !(await oculta('winTetris')), 'atrás cierra el modal y deja el juego');
  await atras();
  ok(await oculta('winTetris'), 'luego minimiza Tetris');

  // f) el historial no crece al abrir y cerrar capas varias veces (también cerrando con los botones)
  const h0 = await pg.evaluate(() => history.length);
  for (let i = 0; i < 4; i++) { await abrir('brk'); await pg.click('#btnMinBrk'); await wait(200); }
  await pg.click('#startBtn'); await wait(150); await pg.locator('#startScreen').click({ position: { x: 3, y: 3 } }); await wait(250);
  const h1 = await pg.evaluate(() => history.length);
  ok(h1 <= h0 + 1 && !(await entrada()), 'el historial no crece al abrir/cerrar capas (' + h0 + ' → ' + h1 + ')');

  // g) sin capas, «atrás» sale de la web app
  ok(await capa() === null, 'no queda ninguna capa abierta');
  await pg.goBack().catch(() => null); await wait(400);
  ok(pg.url() === 'about:blank', 'sin capas, atrás abandona la web app (' + pg.url() + ')');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

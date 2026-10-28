// Teclas reasignables (Breakout, 2048, Flappy, Hundir) + Hundir jugable solo con teclado.
const { entorno, wait, ok, fin } = require('./helpers');

(async () => {
  const env = await entorno(9452, 9451);
  const ctx = await env.contexto({ viewport: { width: 1280, height: 800 } });
  const pg = await env.pagina(ctx, 'teclas');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  const abrir = async id => { await pg.evaluate(j => window.openGame(j), id); await wait(450); };
  const k = c => pg.keyboard.press(c);
  // abre el modal «⌨ Reasignar» de una ventana, asigna una tecla a una acción y cierra
  async function reasignar(win, accion, tecla) {
    await pg.locator('#tkItem' + win).click();
    await pg.locator('#tkModal.active').waitFor();
    await pg.locator('.tkKey[data-accion="' + accion + '"]').click();
    await k(tecla); await wait(50);
  }
  const cerrarModal = async () => { await pg.locator('#tkListo').click(); await wait(50); };

  /* ---------------- 2048 ---------------- */
  await abrir('g2048');
  ok(await pg.locator('#tkItemwinG2048').count() === 1, '2048: el menú tiene «⌨ Reasignar»');
  const ponTile = () => pg.evaluate(() => { const g = window.g2048Estado().grid.map(r => r.map(() => 0)); g[0][g.length - 1] = 2; window.g2048Poner(g); });
  await ponTile(); await k('ArrowLeft'); await wait(120);
  ok((await pg.evaluate(() => window.g2048Estado().grid))[0][0] === 2, '2048: ← por defecto mueve a la izquierda');
  await ponTile(); await k('KeyA'); await wait(120);
  ok((await pg.evaluate(() => window.g2048Estado().grid))[0][0] === 2, '2048: A sigue valiendo como tecla secundaria');
  await reasignar('winG2048', 'izq', 'KeyJ');
  await k('ArrowLeft'); await cerrarModal();   // con el modal abierto el juego ignora el teclado
  await ponTile(); await k('ArrowLeft'); await wait(120);
  ok((await pg.evaluate(() => window.g2048Estado().grid))[0][0] === 0, '2048: la tecla antigua (←) ya no mueve');
  await ponTile(); await k('KeyJ'); await wait(120);
  ok((await pg.evaluate(() => window.g2048Estado().grid))[0][0] === 2, '2048: la tecla nueva (J) mueve a la izquierda');

  // duplicado: asignar a «arriba» la tecla J intercambia con «izquierda» (que pasa a tener la antigua de arriba)
  await reasignar('winG2048', 'arr', 'KeyJ'); await cerrarModal();
  const mapa = await pg.evaluate(() => window.localStorage.getItem('g2048KeyMap'));
  const m = JSON.parse(mapa);
  ok(m.arr === 'KeyJ' && m.izq === 'ArrowUp', '2048: asignar una tecla usada intercambia las dos (' + mapa + ')');
  await pg.locator('#tkItemwinG2048').click(); await pg.locator('#tkReset').click(); await cerrarModal();
  const m2 = JSON.parse(await pg.evaluate(() => window.localStorage.getItem('g2048KeyMap')));
  ok(m2.izq === 'ArrowLeft' && m2.arr === 'ArrowUp', '2048: «Restablecer» devuelve los valores iniciales');

  /* ---------------- Flappy ---------------- */
  await abrir('flap');
  await pg.evaluate(() => window.flapStartNew()); await wait(100);
  ok((await pg.evaluate(() => window.flapEstado().fase)) !== 'jugando', 'Flappy: empieza sin jugar');
  await k('Space'); await wait(150);
  ok((await pg.evaluate(() => window.flapEstado().fase)) === 'jugando', 'Flappy: Espacio aletea por defecto');
  await reasignar('winFlap', 'aletear', 'KeyJ'); await cerrarModal();
  await pg.evaluate(() => window.flapStartNew()); await wait(100);
  await k('Space'); await wait(150);
  ok((await pg.evaluate(() => window.flapEstado().fase)) !== 'jugando', 'Flappy: la tecla antigua deja de valer');
  await k('KeyJ'); await wait(150);
  ok((await pg.evaluate(() => window.flapEstado().fase)) === 'jugando', 'Flappy: la tecla nueva aletea');
  await pg.reload(); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await abrir('flap');
  ok(JSON.parse(await pg.evaluate(() => localStorage.getItem('flapKeyMap'))).aletear === 'KeyJ', 'Flappy: el ajuste sobrevive a una recarga');
  await pg.evaluate(() => window.flapStartNew()); await wait(100); await k('KeyJ'); await wait(150);
  ok((await pg.evaluate(() => window.flapEstado().fase)) === 'jugando', 'Flappy: tras recargar sigue valiendo la tecla nueva');

  /* ---------------- Breakout ---------------- */
  await abrir('brk');
  const nuevoBrk = async () => { await pg.evaluate(() => window.brkStartNew()); await pg.click('#brkLevelGrid .brkLevelCell:nth-child(1)'); await pg.click('#brk-startBtn'); await wait(150); };
  await nuevoBrk();
  ok((await pg.evaluate(() => window.brkEstado().pegada)), 'Breakout: la bola empieza pegada');
  await k('Space'); await wait(100);
  ok(!(await pg.evaluate(() => window.brkEstado().pegada)), 'Breakout: Espacio lanza por defecto');
  await reasignar('winBrk', 'lanzar', 'KeyL'); await cerrarModal();
  await nuevoBrk(); await k('Space'); await wait(100);
  ok((await pg.evaluate(() => window.brkEstado().pegada)), 'Breakout: Espacio ya no lanza tras reasignar');
  await k('KeyL'); await wait(100);
  ok(!(await pg.evaluate(() => window.brkEstado().pegada)), 'Breakout: L lanza');
  await nuevoBrk();
  const x0 = await pg.evaluate(() => window.brkEstado().paddle);
  await pg.keyboard.down('ArrowLeft'); await wait(400); await pg.keyboard.up('ArrowLeft');
  ok((await pg.evaluate(() => window.brkEstado().paddle)) < x0, 'Breakout: ← mueve la pala');
  await reasignar('winBrk', 'izq', 'KeyH'); await cerrarModal();
  await nuevoBrk();
  const x1 = await pg.evaluate(() => window.brkEstado().paddle);
  await pg.keyboard.down('ArrowLeft'); await wait(400); await pg.keyboard.up('ArrowLeft');
  ok(Math.abs((await pg.evaluate(() => window.brkEstado().paddle)) - x1) < 1, 'Breakout: ← antigua no mueve tras reasignar');
  await pg.keyboard.down('KeyH'); await wait(400); await pg.keyboard.up('KeyH');
  ok((await pg.evaluate(() => window.brkEstado().paddle)) < x1, 'Breakout: H mueve la pala a la izquierda');

  /* ---------------- Hundir ---------------- */
  await abrir('hundir');
  await pg.evaluate(() => { window.hundirRapido = true; });
  await pg.click('#hunMenu [data-modo="cpu"]'); await wait(200);
  const est = () => pg.evaluate(() => window.hundirEstado());
  const giro = () => pg.locator('#hunBtns .giro').innerText();
  ok(await pg.locator('#tkItemwinHundir').count() === 1, 'Hundir: el menú tiene «⌨ Reasignar»');
  ok((await giro()).includes('Horizontal'), 'Hundir: el barco empieza en horizontal');
  await k('ArrowRight');                                    // enciende el cursor en A1
  ok(await pg.locator('#hunOwn .hunC.cursor').count() === 1, 'Hundir: aparece la casilla-cursor');
  await k('KeyR'); await wait(50);
  ok((await giro()).includes('Vertical'), 'Hundir: R gira el barco');
  ok(await pg.locator('#hunOwn .hunC.prevOk, #hunOwn .hunC.prevMal').count() > 1, 'Hundir: hay vista previa bajo el cursor');
  await k('KeyR');
  await k('Space'); await wait(50);                          // coloca el primer barco (horizontal) en A1
  let d = (await est()).draft;
  ok(d[0] && d[0].h === true && d[0].r === 0 && d[0].c === 0, 'Hundir: Espacio coloca el barco en el cursor');
  await k('ArrowDown'); await k('ArrowDown'); await k('ArrowDown'); await k('KeyR'); await k('Space'); await wait(50);
  d = (await est()).draft;
  ok(d[1] && d[1].h === false && d[1].r === 3, 'Hundir: el segundo barco, girado con R, queda en vertical');
  await k('KeyE'); await wait(50);
  await k('Backspace'); await wait(50);
  ok((await est()).draft.every(x => !x), 'Hundir: Retroceso borra la flota');

  // reasignar «girar» a T
  await reasignar('winHundir', 'girar', 'KeyT'); await cerrarModal();
  const antes = await giro(); await k('KeyR'); await wait(30);
  ok(await giro() === antes, 'Hundir: R deja de girar tras reasignar');
  await k('KeyT'); await wait(30);
  ok(await giro() !== antes, 'Hundir: T gira el barco');

  // partida completa solo con teclado
  await k('KeyQ'); await wait(60);
  ok((await est()).draft.every(x => x), 'Hundir: Q coloca la flota al azar');
  await k('Enter'); await wait(300);
  ok((await est()).fase === 'jugando', 'Hundir: Intro confirma la flota y empieza la batalla');
  let fase = 'jugando', dir = 1, pasos = 0;
  const N = await pg.evaluate(() => document.querySelectorAll('#hunEnemy .hunC').length ** 0.5 | 0);
  await k('ArrowRight');
  while (fase === 'jugando' && pasos++ < 600) {
    await k('Space'); await wait(40);
    const col = await pg.evaluate(() => { const c = document.querySelector('#hunEnemy .hunC.cursor'); return c ? +c.dataset.i % Math.round(Math.sqrt(document.querySelectorAll('#hunEnemy .hunC').length)) : 0; });
    if ((dir === 1 && col === N - 1) || (dir === -1 && col === 0)) { await k('ArrowDown'); dir = -dir; } else await k(dir === 1 ? 'ArrowRight' : 'ArrowLeft');
    fase = (await est()).fase;
  }
  ok(fase === 'fin', 'Hundir: una partida entera contra la CPU solo con teclado (' + pasos + ' pasos)');
  env.cerrar(); fin();
})();

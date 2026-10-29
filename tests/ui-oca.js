// Juego de la Oca local: menú, partida contra la CPU hasta el final (1 dado), tablero sin scroll horizontal, animación de la ficha,
// guardar y recuperar, 2 dados con el 9 de la primera tirada, 2 personas en el mismo móvil (cada una tira en su turno) y el ordenador.
const { entorno, wait, ok, fin } = require('./helpers');
const SHOT = process.env.SHOT_DIR;
const W = '#ocaWrap';
(async () => {
  const env = await entorno(9532, 9531);
  const ctx = await env.contexto({ viewport: { width: 390, height: 780 } });
  const pg = await env.pagina(ctx, 'oca');
  pg.on('dialog', d => d.accept());
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => { localStorage.removeItem('ocaConf'); });
  await pg.evaluate(() => window.openGame('oca'));
  await pg.waitForSelector(W + ' .ocMenu', { state: 'visible', timeout: 10000 });
  ok(await pg.locator(W + ' .ocAsientos .ocRow').count() === 4, 'el menú muestra los 4 asientos');
  ok(await pg.locator(W + ' .ocC').count() === 64, 'tablero de 63 casillas más la salida');
  const E = () => pg.evaluate(() => window.ocaEstado());
  async function jugarHasta(hasta, max = 3000) {
    for (let i = 0; i < max; i++) {
      const e = await E();
      if (!e.vista || e.vista.fase !== 'jugando' || (hasta && hasta(e))) return e;
      const b = pg.locator(W + ' .ocTirar');
      if (!e.anim && !e.jug[e.vista.turno].cpu && await b.isEnabled()) await b.click({ timeout: 2000 }).catch(() => {}); else await wait(15);
    }
    return E();
  }
  // tú + 1 CPU, con animación
  if (SHOT) await pg.screenshot({ path: SHOT + '/oca-menu.png' });
  await pg.locator(W + ' .ocMenu [data-r=jugar]').click();
  let e = await E();
  ok(e.modo === 'local' && e.vista.n === 2 && e.jug[0].nombre === 'Tú' && e.jug[1].cpu, 'partida local: tú contra la CPU');
  ok(e.vista.pos.every(c => c === 0), 'las fichas empiezan en la salida');
  const linea = () => pg.locator(W + ' .ocLinea').isVisible();
  ok(await pg.locator(W + ' .ocMuros').isVisible() && await linea(), 'al empezar se ven los muros de la espiral y la línea del recorrido');
  // la ficha anima: durante la animación la posición mostrada va por detrás de la real
  e = await jugarHasta(x => x.vista.turno === 0 && !x.anim);
  await pg.locator(W + ' .ocTirar').click();
  let vioAnim = false;
  for (let i = 0; i < 40; i++) { const x = await E(); if (x.anim) { vioAnim = true; break; } await wait(20); }
  ok(vioAnim, 'la tirada se anima (dados, casilla a casilla y saltos)');
  await pg.waitForFunction(() => !window.ocaEstado().anim, null, { timeout: 15000 });
  e = await E();
  ok(JSON.stringify(e.vis) === JSON.stringify(e.vista.pos), 'al acabar la animación, las fichas están en su casilla');
  e = await jugarHasta(x => x.vista.tiros.every(t => t > 0) && !x.anim);
  ok(e.vista.fase !== 'jugando' || (!(await linea()) && await pg.locator(W + ' .ocMuros').isVisible()), 'tras la primera ronda se quita la línea y quedan los muros');
  await pg.evaluate(() => { window.ocaRapido = true; });
  e = await jugarHasta(x => x.vista.nj >= 8 && x.vista.turno === 0 && !x.anim);
  await pg.evaluate(() => { window.ocaRapido = false; });
  await wait(300);
  if (SHOT) await pg.screenshot({ path: SHOT + '/oca-movil-jugando.png' });
  const anchoOk = await pg.evaluate(() => { const w = document.getElementById('ocaWrap'); return w.scrollWidth <= w.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1; });
  ok(anchoOk, 'sin scroll horizontal en el móvil');
  const cabe = await pg.evaluate(() => { const t = document.querySelector('#ocaWrap .ocTablero').getBoundingClientRect(), z = document.querySelector('#ocaWrap .ocZona').getBoundingClientRect(); return t.width > 200 && t.bottom <= z.bottom + 1 && t.right <= z.right + 1; });
  ok(cabe, 'el tablero cabe entero en la ventana');
  await pg.locator(W + ' .ocVerHist').click();
  ok(await pg.locator(W + ' .ocHist li').count() >= 3, 'el historial recoge las jugadas');
  await pg.locator(W + ' .ocHist [data-r=cerrarHist]').click();
  // guardar y recuperar a mitad
  e = await E();
  if (e.vista.fase === 'jugando') {
    await pg.locator('#ocaSave').click();
    ok(await pg.evaluate(() => !!localStorage.getItem('partida_oca')), '💾 Guardar deja la partida en el móvil');
    await pg.reload(); await pg.locator('#startScreen').evaluate(el => { el.style.display = 'none'; });
    await pg.evaluate(() => window.openGame('oca'));
    await pg.waitForFunction(() => window.ocaEstado && window.ocaEstado().modo === 'local', null, { timeout: 10000 });
    const r = await E();
    ok(JSON.stringify(r.est.pos) === JSON.stringify(e.est.pos) && r.est.turno === e.est.turno, 'al volver a abrir, la partida se recupera tal cual');
    ok(await pg.evaluate(() => !localStorage.getItem('partida_oca')), 'y se recupera una sola vez');
  } else ok(true, 'la partida acabó antes de guardar');
  await pg.evaluate(() => { window.ocaRapido = true; });
  e = await jugarHasta();
  ok(e.vista.fase === 'fin' && e.vista.pos[e.vista.ganador] === 63, 'la partida termina con alguien en la 63 (gana ' + (e.jug[e.vista.ganador] || {}).nombre + ')');
  await pg.waitForSelector(W + ' .ocFin', { state: 'visible', timeout: 5000 });
  ok(await pg.locator(W + ' .ocPuesto').count() === 2, 'el final enseña la clasificación');
  if (SHOT) await pg.screenshot({ path: SHOT + '/oca-movil-fin.png' });
  await pg.locator(W + ' .ocFin [data-r=ver]').click();
  ok(await pg.locator(W + ' .ocFin').isHidden(), '«Ver el tablero» oculta el resultado');
  await pg.locator(W + ' .ocEstado').click();
  ok(await pg.locator(W + ' .ocFin').isVisible(), 'y se vuelve a él tocando el aviso');
  await pg.locator(W + ' .ocFin [data-r=menu]').click();

  // 2 personas + 2 CPU, con 2 dados: el 9 de la primera tirada y un dado desde la 60
  await pg.locator(W + ' .ocAsientos [data-asiento="1"][data-tipo=per]').click();
  await pg.locator(W + ' .ocAsientos [data-asiento="2"][data-tipo=cpu]').click();
  await pg.locator(W + ' .ocAsientos [data-asiento="3"][data-tipo=cpu]').click();
  await pg.locator(W + ' .ocMenu [data-k=dados] [data-v="2"]').click();
  await pg.locator(W + ' .ocMenu [data-r=jugar]').click();
  e = await E();
  ok(e.vista.n === 4 && e.vista.dados === 2 && e.jug.filter(j => !j.cpu).length === 2, '4 jugadores (2 personas y 2 CPU) con 2 dados');
  ok(e.jug[0].nombre === 'Rojo' && e.jug[1].nombre === 'Azul', 'con varias personas, cada una se llama por su color');
  const tiraron = new Set(); let nueves = 0, unDado = 0;
  for (let i = 0; i < 4000; i++) {
    const x = await E();
    if (x.vista.fase !== 'jugando') break;
    const u = x.vista.ultimo;
    if (u && u.saltos.some(s => s.tipo === 'nueve')) nueves++;
    if (u && u.dados.length === 1) unDado++;
    if (!x.anim && !x.jug[x.vista.turno].cpu && await pg.locator(W + ' .ocTirar').isEnabled()) { tiraron.add(x.vista.turno); await pg.locator(W + ' .ocTirar').click({ timeout: 2000 }).catch(() => {}); } else await wait(10);
  }
  e = await E();
  ok(e.vista.fase === 'fin', 'la partida de 4 con 2 dados termina');
  ok(tiraron.size >= 1 && [0, 1].every(i => tiraron.has(i) === e.vista.tiros[i] > 0), 'cada persona tira en su turno con el mismo botón (' + [...tiraron] + ' · ' + e.vista.nj + ' jugadas)');
  console.log('   (tiradas de un dado vistas: ' + unDado + ', nueves en la primera tirada: ' + nueves + ')');
  if (SHOT) await pg.screenshot({ path: SHOT + '/oca-movil-4.png' });

  // tablero clásico (Fournier): se elige en el menú, la imagen carga, las fichas caen dentro de su casilla y se marca la de quien tira
  await pg.waitForSelector(W + ' .ocFin', { state: 'visible', timeout: 8000 });
  await pg.locator(W + ' .ocFin [data-r=menu]').click();
  await pg.locator(W + ' .ocMenu [data-k=tablero] [data-v=clasico]').click();
  ok(/Heraclio Fournier/.test(await pg.locator(W + ' .ocMenu .ocCred').innerText()), 'el menú da el crédito del tablero clásico');
  await pg.locator(W + ' .ocMenu [data-r=jugar]').click();
  await pg.waitForFunction(() => { const i = document.querySelector('#ocaWrap .ocCla img'); return i && i.complete && i.naturalWidth === 660; }, null, { timeout: 10000 });
  e = await E();
  ok(e.tablero === 'clasico' && await pg.locator(W + ' .ocTablero.clasico .ocCla img').isVisible() && await pg.locator(W + ' .ocC').first().isHidden(), 'el tablero clásico sustituye a la espiral');
  ok(await pg.locator(W + ' .ocClaLinea').isVisible() && await pg.locator(W + ' .ocLim polygon').count() === 63, 'con los 63 contornos y la línea del recorrido al empezar');
  await pg.evaluate(() => { window.ocaRapido = true; });
  e = await jugarHasta(x => x.vista.nj >= 6 && x.vista.turno === 0 && !x.anim);
  await pg.evaluate(() => { window.ocaRapido = false; });
  await wait(300);
  const dentro = await pg.evaluate(() => {                                // cada ficha queda dentro del contorno de su casilla
    const e = window.ocaEstado(), svg = document.querySelector('#ocaWrap .ocLim'), r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return e.vis.slice(0, e.vista.n).every((c, i) => {
      if (!c) return true;
      const f = document.querySelectorAll('#ocaWrap .ocFicha')[i].getBoundingClientRect();
      const pt = svg.createSVGPoint(); pt.x = (f.left + f.width / 2 - r.left) / r.width * vb.width; pt.y = (f.top + f.height / 2 - r.top) / r.height * vb.height;
      return svg.querySelector('[data-c="' + c + '"]').isPointInFill(pt);
    });
  });
  ok(dentro, 'las fichas caen dentro del contorno de su casilla (' + e.vista.nj + ' jugadas, ' + e.vista.fase + ')');
  e = await E();
  ok(e.vista.fase !== 'jugando' || !e.vis[e.vista.turno] || await pg.locator(W + ' .ocLim polygon.turno[data-c="' + e.vis[e.vista.turno] + '"]').count() === 1, 'se marca la casilla de quien tira');
  ok(await pg.evaluate(() => { const w = document.getElementById('ocaWrap'), t = w.querySelector('.ocTablero').getBoundingClientRect(), z = w.querySelector('.ocZona').getBoundingClientRect(); return w.scrollWidth <= w.clientWidth + 1 && t.width > 250 && t.right <= z.right + 1 && t.bottom <= z.bottom + 1; }), 'el clásico cabe entero, sin scroll horizontal');
  if (SHOT) await pg.screenshot({ path: SHOT + '/oca-movil-clasico.png' });
  if (await pg.locator(W + ' .ocFin').isVisible()) await pg.locator(W + ' .ocFin [data-r=ver]').click();
  await pg.locator(W + ' .ocVerTab').click();
  ok((await E()).tablero === 'espiral' && await pg.locator(W + ' .ocC').first().isVisible(), '🗺️ vuelve a la espiral a mitad de partida');
  ok(await pg.evaluate(() => JSON.parse(localStorage.getItem('ocaConf')).tablero === 'espiral'), 'y se recuerda la elección');
  await ctx.close();

  // ordenador: la ventana se ve entera
  const ctx2 = await env.contexto({ viewport: { width: 1366, height: 768 }, hasTouch: false });
  const pc = await env.pagina(ctx2, 'pc');
  await pc.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pc.evaluate(() => { localStorage.removeItem('ocaConf'); window.openGame('oca'); });
  await pc.waitForSelector(W + ' .ocMenu', { state: 'visible' });
  await pc.locator(W + ' .ocAsientos [data-asiento="2"][data-tipo=cpu]').click();
  await pc.locator(W + ' .ocMenu [data-r=jugar]').click();
  await pc.evaluate(() => { window.ocaRapido = true; });
  for (let i = 0; i < 200; i++) {
    const x = await pc.evaluate(() => window.ocaEstado());
    if (x.vista.fase !== 'jugando' || x.vista.nj >= 14) break;
    if (!x.anim && x.vista.turno === 0) await pc.keyboard.press('Space'); else await wait(20);
  }
  const x = await pc.evaluate(() => window.ocaEstado());
  ok(x.vista.tiros[0] >= 2, 'en el ordenador se tira con la barra espaciadora (' + x.vista.tiros[0] + ' tiradas)');
  await pc.evaluate(() => { window.ocaRapido = false; });
  await wait(300);
  if (SHOT) await pc.screenshot({ path: SHOT + '/oca-ordenador.png' });
  await ctx2.close();
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

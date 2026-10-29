// Juego de la Oca ONLINE: sala de 2 personas + 1 CPU con 2 dados, el anfitrión tira por todos, una tirada fuera de turno se ignora,
// las CPU juegan solas, el invitado recarga y vuelve a la partida, final y vuelta al lobby. Después, 3 personas sin CPU.
const { entorno, wait, ok, fin } = require('./helpers');
const SHOT = process.env.SHOT_DIR;
const W = '#ocaWrap', LB = '#winOca .olLobby[data-j=oca]';
(async () => {
  const env = await entorno(9542, 9541);
  const nuevo = async n => { const ctx = await env.contexto({ viewport: { width: 390, height: 780 } }); const pg = await env.pagina(ctx, n); pg.on('dialog', d => d.accept()); await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); await pg.evaluate(() => { window.ocaRapido = true; }); return pg; };
  const sala = async (pg, modo, nombre, nom) => {
    await pg.evaluate(() => window.openGame('oca')); await wait(400);
    await pg.locator('#winOca [data-conectar]').click();
    await pg.fill('#salaNombre', nombre); await pg.fill('#salaSala', nom); await pg.fill('#salaPass', 'clave1');
    await pg.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
    await pg.waitForSelector(LB, { state: 'visible', timeout: 25000 });
  };
  const E = pg => pg.evaluate(() => window.ocaEstado());
  async function jugar(pgs, hasta, max = 3000) {
    for (let i = 0; i < max; i++) {
      const e = await E(pgs[0]);
      if (!e.vista || e.vista.fase !== 'jugando' || (hasta && hasta(e))) return e;
      for (const pg of pgs) {
        const x = await E(pg), b = pg.locator(W + ' .ocTirar');
        if (x.vista && x.vista.fase === 'jugando' && x.vista.turno === x.p && !x.anim && await b.isEnabled()) await b.click({ timeout: 2000 }).catch(() => {});
      }
      await wait(30);
    }
    return E(pgs[0]);
  }

  const H = await nuevo('host'), G = await nuevo('inv');
  await sala(H, 'crear', 'Anfi', 'oca uno'); await sala(G, 'unir', 'Invi', 'oca uno');
  const opcion = async (pg, fila, txt) => { await pg.locator(LB + ' .olOp', { hasText: fila }).locator('button', { hasText: txt }).first().click(); await wait(300); };
  await H.waitForFunction(sel => { const b = document.querySelector(sel + ' .olGrande'); return b && !b.disabled; }, LB, { timeout: 15000 });
  await opcion(H, 'CPU:', '1'); await opcion(H, 'Dados:', '2 dados');
  ok(/2 personas \+ 1 CPU/.test(await G.locator(LB).innerText()) && /2 dados/.test(await G.locator(LB).innerText()), 'el invitado ve las opciones: 2 personas + 1 CPU, 2 dados');
  ok(await H.locator(LB + ' .olOp', { hasText: 'CPU:' }).locator('button', { hasText: '3' }).isDisabled(), 'con 2 personas caben como mucho 2 CPU');
  if (SHOT) await H.screenshot({ path: SHOT + '/oca-lobby.png' });
  await H.locator(LB + ' .olGrande').click();
  await H.waitForFunction(() => window.ocaEstado().modo === 'online' && window.ocaEstado().vista, null, { timeout: 15000 });
  await G.waitForFunction(() => window.ocaEstado().modo === 'online' && window.ocaEstado().vista, null, { timeout: 15000 });
  let h = await E(H), g = await E(G);
  ok(h.vista.n === 3 && h.vista.dados === 2 && h.jug[2].cpu, 'mesa de 3 (la CPU en el tercer asiento) con 2 dados');
  ok(h.p === 0 && g.p === 1, 'cada persona tiene su ficha');

  // tirada fuera de turno: se ignora
  h = await E(H);
  if (h.vista.turno !== 1) {
    const nj = h.vista.nj;
    await G.evaluate(() => window.Sala.enviar('host', { tipo: 'accion', a: 'tirar' }));
    await wait(500);
    const h2 = await E(H);
    ok(h2.vista.nj === nj || h2.vista.ultimo.p !== 1, 'una tirada fuera de turno se ignora');
  } else ok(true, 'empieza el invitado (sin prueba fuera de turno)');

  // a medias, el invitado recarga y vuelve a la partida
  await jugar([H, G], e => e.vista.nj >= 8);
  if (SHOT) { await G.evaluate(() => { window.ocaRapido = false; }); await wait(200); await G.screenshot({ path: SHOT + '/oca-online-invitado.png' }); await G.evaluate(() => { window.ocaRapido = true; }); }
  await H.evaluate(() => { window.ocaRapido = false; });              // se detiene la CPU un momento para comparar
  for (let i = 0; i < 100; i++) { g = await E(G); h = await E(H); if (g.vista.nj === h.vista.nj && !g.anim && !h.anim) break; await wait(50); }
  ok(g.vista.nj === h.vista.nj && JSON.stringify(g.vis) === JSON.stringify(h.vis) && JSON.stringify(g.vis) === JSON.stringify(h.vista.pos), 'los dos ven el mismo tablero');
  await H.evaluate(() => { window.ocaRapido = true; });
  ok(h.vista.hist.some(x => x.p === 2), 'la CPU juega sola en el móvil del anfitrión');
  await G.reload(); await G.locator('#startScreen').evaluate(e => { e.style.display = 'none'; }); await G.evaluate(() => { window.ocaRapido = true; });
  await G.waitForFunction(() => window.ocaEstado && window.ocaEstado().modo === 'online' && window.ocaEstado().vista, null, { timeout: 30000 });
  g = await E(G);
  ok(g.p === 1 && g.vista.nj >= 8, 'el invitado recarga y vuelve a su ficha (' + g.vista.nj + ' jugadas)');

  const finH = await jugar([H, G]);
  ok(finH.vista.fase === 'fin' && finH.vista.ganador >= 0, 'la partida termina (gana ' + finH.jug[finH.vista.ganador].nombre + ')');
  await G.waitForSelector(W + ' .ocFin', { state: 'visible', timeout: 8000 });
  ok(await G.locator(W + ' .ocPuesto').count() === 3, 'el invitado ve la clasificación');
  ok(await H.locator(W + ' .ocFin [data-r=otra]').isEnabled() && await G.locator(W + ' .ocFin [data-r=otra]').isDisabled(), 'solo el anfitrión vuelve al lobby');
  if (SHOT) await G.screenshot({ path: SHOT + '/oca-online-fin.png' });
  await H.locator(W + ' .ocFin [data-r=otra]').click();
  await H.waitForSelector(LB, { state: 'visible', timeout: 15000 }); await G.waitForSelector(LB, { state: 'visible', timeout: 15000 });
  ok(true, 'vuelven al lobby');

  // tercera persona, sin CPU y con 1 dado
  const T = await nuevo('tercero'); await sala(T, 'unir', 'Tere', 'oca uno');
  await H.waitForFunction(sel => document.querySelector(sel).innerText.includes('Tere'), LB, { timeout: 15000 });
  await wait(400);
  await opcion(H, 'CPU:', '0'); await opcion(H, 'Dados:', '1 dado');
  await H.locator(LB + ' .olGrande').click();
  for (const pg of [H, G, T]) await pg.waitForFunction(() => window.ocaEstado().modo === 'online' && window.ocaEstado().vista, null, { timeout: 15000 });
  h = await E(H);
  ok(h.vista.n === 3 && h.vista.dados === 1 && h.jug.every(j => !j.cpu), '3 personas, sin CPU, con 1 dado');
  const e3 = await jugar([H, G, T]);
  ok(e3.vista.fase === 'fin', 'la partida de 3 termina');
  await env.cerrar(); fin();
})().catch(e => { console.error(e); process.exit(1); });

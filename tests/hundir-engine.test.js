// Motor de Hundir la flota: colocación, árbitro, vistas públicas e IA (sin DOM).
const test = require('node:test');
const assert = require('node:assert');
const H = require('../js/online/hundir-engine.js');

// generador pseudoaleatorio con semilla (las pruebas son reproducibles)
function rngDe(sem) { let s = sem >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

test('flota aleatoria válida (con y sin barcos tocándose)', () => {
  const rng = rngDe(7);
  for (let i = 0; i < 300; i++) {
    assert.ok(H.validarFlota(H.flotaAleatoria(rng, true), true));
    const f = H.flotaAleatoria(rng, false);
    assert.ok(H.validarFlota(f, false), 'sin tocarse');
  }
});
test('validarFlota rechaza flotas ilegales', () => {
  const ok = [{ l: 5, r: 0, c: 0, h: true }, { l: 4, r: 2, c: 0, h: true }, { l: 3, r: 4, c: 0, h: true }, { l: 3, r: 6, c: 0, h: true }, { l: 2, r: 8, c: 0, h: true }];
  assert.ok(H.validarFlota(ok, false));
  assert.ok(!H.validarFlota(ok.slice(1), true), 'faltan barcos');
  assert.ok(!H.validarFlota(ok.map(b => ({ ...b })).map((b, i) => i === 0 ? { ...b, c: 7 } : b), true), 'se sale del tablero');
  const solapa = ok.map(b => ({ ...b })); solapa[1].r = 0;
  assert.ok(!H.validarFlota(solapa, true), 'se solapan');
  const pegados = ok.map(b => ({ ...b })); pegados[1].r = 1;
  assert.ok(H.validarFlota(pegados, true) && !H.validarFlota(pegados, false), 'tocarse solo vale si se permite');
  assert.ok(!H.validarFlota([...ok.slice(0, 4), { l: 4, r: 8, c: 0, h: true }], true), 'longitudes equivocadas');
  assert.ok(!H.validarFlota([{ l: 5, r: 0.5, c: 0, h: true }, ...ok.slice(1)], true), 'coordenadas no enteras');
});
test('codificar/decodificar ida y vuelta y rechazo de basura', () => {
  const f = H.flotaAleatoria(rngDe(3), true);
  assert.deepStrictEqual(H.decodificar(H.codificar(f)), f);
  assert.ok(H.codificar(f).length < 120, 'cabe de sobra en un mensaje');
  assert.strictEqual(H.decodificar('x'.repeat(500)), null);
  assert.strictEqual(H.decodificar(7), null);
});
test('árbitro: colocar, turnos, agua/tocado/hundido, fin', () => {
  const pt = H.crear({ turno: 0 });
  const f0 = [{ l: 5, r: 0, c: 0, h: true }, { l: 4, r: 2, c: 0, h: true }, { l: 3, r: 4, c: 0, h: true }, { l: 3, r: 6, c: 0, h: true }, { l: 2, r: 8, c: 0, h: true }];
  const f1 = H.flotaAleatoria(rngDe(11), true);
  assert.strictEqual(H.disparar(pt, 0, 5), null, 'no se dispara antes de colocar');
  assert.ok(H.colocar(pt, 1, f1)); assert.ok(!H.colocar(pt, 1, f1), 'no se coloca dos veces');
  assert.strictEqual(pt.fase, 'colocando');
  assert.ok(H.colocar(pt, 0, f0)); assert.strictEqual(pt.fase, 'jugando');
  assert.strictEqual(H.disparar(pt, 1, 0), null, 'turno ajeno');
  // el jugador 1 dispara a la flota 0: tocado y hundido del destructor (fila 8, cols 0-1)
  pt.turno = 1;
  let r = H.disparar(pt, 1, 80); assert.strictEqual(r.res, 2); assert.strictEqual(pt.turno, 0, 'el turno pasa');
  pt.turno = 1; assert.strictEqual(H.disparar(pt, 1, 80), null, 'casilla repetida');
  r = H.disparar(pt, 1, 81); assert.strictEqual(r.res, 3); assert.deepStrictEqual(r.hundido, [80, 81]);
  pt.turno = 1; r = H.disparar(pt, 1, 99); assert.strictEqual(r.res, 1, 'agua');
  assert.strictEqual(H.disparar(pt, 1, 100), null); assert.strictEqual(H.disparar(pt, 1, -1), null); assert.strictEqual(H.disparar(pt, 1, 1.5), null);
});
test('repetir turno al acertar (opción)', () => {
  const pt = H.crear({ repite: true, turno: 0 });
  H.colocar(pt, 0, H.flotaAleatoria(rngDe(1), true)); H.colocar(pt, 1, H.flotaAleatoria(rngDe(2), true));
  const barco = H.celdas(pt.flotas[1][0])[0];
  H.disparar(pt, 0, barco); assert.strictEqual(pt.turno, 0, 'acierta y repite');
  const agua = Array.from({ length: 100 }, (_, i) => i).find(i => !pt.flotas[1].some(b => H.celdas(b).includes(i)));
  H.disparar(pt, 0, agua); assert.strictEqual(pt.turno, 1, 'falla y pasa');
});
test('lo público no revela la flota hasta el final; rendirse acaba la partida', () => {
  const pt = H.crear({}); H.colocar(pt, 0, H.flotaAleatoria(rngDe(5), true)); H.colocar(pt, 1, H.flotaAleatoria(rngDe(6), true));
  assert.strictEqual(H.publico(pt).flotas, null);
  assert.ok(!JSON.stringify(H.publico(pt)).includes('"l":'), 'ni rastro de barcos en el estado público');
  assert.ok(H.rendir(pt, 0)); assert.strictEqual(pt.ganador, 1); assert.ok(H.publico(pt).flotas, 'al final se revelan');
  assert.ok(!H.rendir(pt, 1));
});
function partidaIA(nivel, sem) {
  const rng = rngDe(sem), pt = H.crear({ turno: 0 });
  H.colocar(pt, 0, H.flotaAleatoria(rng, true)); H.colocar(pt, 1, H.flotaAleatoria(rng, true));
  let n = 0; const vistos = new Set();
  while (pt.fase === 'jugando' && n < 200) {
    const pub = H.publico(pt), idx = H.ia(nivel, H.vistaIA(pub, 0), rng);
    assert.ok(!vistos.has(idx), 'la IA no repite casilla'); vistos.add(idx);
    const r = H.disparar(pt, 0, idx); assert.ok(r, 'disparo válido'); n++;
    if (pt.fase === 'jugando') pt.turno = 0;          // solo juega la IA (se mide cuántos disparos necesita)
  }
  assert.strictEqual(pt.fase, 'fin'); return n;
}
test('la IA nunca repite y los niveles se ordenan: difícil < normal < fácil', () => {
  const media = nivel => { let t = 0; for (let i = 0; i < 120; i++) t += partidaIA(nivel, 100 + i); return t / 120; };
  const f = media(1), n = media(2), d = media(3);
  console.log('   disparos medios para hundir toda la flota → fácil', f.toFixed(1), '· normal', n.toFixed(1), '· difícil', d.toFixed(1));
  assert.ok(d < n && n < f, 'orden de dificultad');
  assert.ok(f > 80, 'fácil ≈ disparar al azar'); assert.ok(d < 60, 'difícil es eficaz');
});
test('vistas: aguas y propio', () => {
  const pt = H.crear({}); const f0 = H.flotaAleatoria(rngDe(21), true), f1 = H.flotaAleatoria(rngDe(22), true);
  H.colocar(pt, 0, f0); H.colocar(pt, 1, f1);
  const c = H.celdas(f1[4]); // destructor rival
  H.disparar(pt, 0, c[0]); pt.turno = 0; H.disparar(pt, 0, c[1]);
  const pub = H.publico(pt), a = H.aguas(pub, 0);
  assert.strictEqual(a[c[0]], 3); assert.strictEqual(a[c[1]], 3, 'el hundido se marca entero');
  const mi = H.propio(pub, f1, 1);
  assert.strictEqual(mi[c[0]], 3, 'mi barco hundido'); assert.ok(mi.some(x => x === 5), 'se ven mis barcos');
});

// ---------- tablero y flota configurables ----------
test('validarConfig: límites de tamaño, barcos y casillas', () => {
  assert.ok(H.validarConfig({}).ok, 'valores por defecto');
  assert.ok(H.validarConfig({ n: 6, flota: [3, 2, 2] }).ok); assert.ok(H.validarConfig({ n: 15, flota: [6, 5, 4] }).ok);
  for (const malo of [{ n: 5 }, { n: 16 }, { n: 10.5 }, { n: 10, flota: [] }, { n: 10, flota: Array(13).fill(1) }, { n: 10, flota: [7] }, { n: 10, flota: [0, 2] }, { n: 10, flota: [2.5] }, { n: 8, flota: [6, 6, 6, 6, 6] }, { n: 10, flota: 'x' }])
    assert.ok(!H.validarConfig(malo).ok, 'rechaza ' + JSON.stringify(malo));
  assert.ok(H.validarConfig({ n: 8, flota: [6, 6, 6, 4], tocar: true }).ok && !H.validarConfig({ n: 8, flota: [6, 6, 6, 4], tocar: false }).ok, 'sin tocarse el tope es menor');
  assert.deepStrictEqual(H.validarConfig({ n: 10, flota: [2, 5, 3] }).flota, [5, 3, 2], 'se ordena de mayor a menor');
  assert.throws(() => H.crear({ n: 4 }), /tablero/);
});
test('las plantillas son válidas con y sin barcos tocándose y la flota aleatoria cabe en todas', () => {
  const rng = rngDe(99);
  for (const p of H.PLANTILLAS) for (const tocar of [true, false]) {
    assert.ok(H.validarConfig({ n: p.n, flota: p.flota, tocar }).ok, p.nombre + ' tocar=' + tocar);
    for (let i = 0; i < 40; i++) { const f = H.flotaAleatoria(rng, tocar, p); assert.ok(H.validarFlota(f, tocar, p), p.nombre); assert.strictEqual(f.length, p.flota.length); }
  }
});
test('partida en un tablero 8×8 con flota propia: límites, vistas y fin', () => {
  const cfg = { n: 8, flota: [4, 3, 3, 2] }, rng = rngDe(5);
  const pt = H.crear({ turno: 0, ...cfg });
  assert.deepStrictEqual(pt.op.flota, [4, 3, 3, 2]); assert.strictEqual(pt.op.n, 8);
  const f0 = H.flotaAleatoria(rng, true, pt.op), f1 = H.flotaAleatoria(rng, true, pt.op);
  assert.ok(!H.colocar(pt, 0, H.flotaAleatoria(rng, true)), 'una flota clásica no vale en esta partida');
  assert.ok(H.colocar(pt, 0, f0) && H.colocar(pt, 1, f1));
  assert.strictEqual(H.disparar(pt, 0, 64), null, 'la casilla 64 no existe en 8×8'); assert.ok(H.disparar(pt, 0, 63));
  const pub = H.publico(pt);
  assert.strictEqual(pub.op.n, 8); assert.strictEqual(H.aguas(pub, 0).length, 64); assert.strictEqual(H.propio(pub, f0, 0).length, 64);
  // se hunde todo: la IA contra una flota de 12 casillas en 8×8
  const rng2 = rngDe(7), pt2 = H.crear({ turno: 0, ...cfg }); H.colocar(pt2, 0, H.flotaAleatoria(rng2, true, pt2.op)); H.colocar(pt2, 1, H.flotaAleatoria(rng2, true, pt2.op));
  let n = 0; while (pt2.fase === 'jugando' && n < 200) { const idx = H.ia(3, H.vistaIA(H.publico(pt2), 0), rng2); assert.ok(H.disparar(pt2, 0, idx)); n++; if (pt2.fase === 'jugando') pt2.turno = 0; }
  assert.strictEqual(pt2.fase, 'fin'); assert.ok(n <= 64);
});
test('la IA nunca repite ni se sale en 6×6, 8×8, 12×12 y 15×15; en 8×8 difícil < fácil', () => {
  function disparos(nivel, n, flota, sem) {
    const rng = rngDe(sem), pt = H.crear({ turno: 0, n, flota }); H.colocar(pt, 0, H.flotaAleatoria(rng, true, pt.op)); H.colocar(pt, 1, H.flotaAleatoria(rng, true, pt.op));
    let k = 0; const vistos = new Set();
    while (pt.fase === 'jugando' && k < n * n + 5) { const idx = H.ia(nivel, H.vistaIA(H.publico(pt), 0), rng); assert.ok(idx >= 0 && idx < n * n && !vistos.has(idx), 'casilla válida y nueva'); vistos.add(idx); assert.ok(H.disparar(pt, 0, idx)); k++; if (pt.fase === 'jugando') pt.turno = 0; }
    assert.strictEqual(pt.fase, 'fin'); return k;
  }
  for (const [n, flota] of [[6, [3, 2, 2]], [8, [4, 3, 3, 2]], [12, [6, 5, 4, 4, 3, 3, 2, 2]], [15, [6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 1]]]) for (const nivel of [1, 2, 3]) disparos(nivel, n, flota, 30 + nivel);
  const media = nv => { let t = 0; for (let i = 0; i < 60; i++) t += disparos(nv, 8, [4, 3, 3, 2], 500 + i); return t / 60; };
  const f = media(1), d = media(3); console.log('   8×8 → fácil', f.toFixed(1), '· difícil', d.toFixed(1)); assert.ok(d < f);
});
test('la flota más grande cabe en un mensaje de red', () => {
  const p = H.PLANTILLAS[3], f = H.flotaAleatoria(rngDe(2), true, p);
  assert.ok(H.codificar(f).length < 400 && H.decodificar(H.codificar(f)).length === 12);
  assert.strictEqual(H.decodificar('1,0,0,1;'.repeat(13)), null, 'más de 12 barcos se rechaza');
});

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

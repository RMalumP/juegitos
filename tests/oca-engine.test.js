// Motor de la Oca: casillas especiales, rebote en la 63, oca 59 (rebota o gana), turnos perdidos, pozo, 2 dados (9 en la primera tirada y un dado desde la 60).
const test = require('node:test');
const assert = require('node:assert');
const O = require('../js/online/oca-engine.js');
const rngDe = sem => { let s = sem >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
// partida a medida: posiciones dadas y le toca a `turno`
function hecho(pos, op = {}) {
  const e = O.crear(Object.assign({ n: pos.length, turno: 0 }, op));
  e.pos = pos.slice(); e.tiros = pos.map(() => op.tiros !== undefined ? op.tiros : 1); e.turno = op.turno || 0;
  return e;
}

test('salida, turnos y dados que no valen', () => {
  const e = O.crear({ n: 3, turno: 0 });
  assert.deepStrictEqual(e.pos, [0, 0, 0]); assert.strictEqual(e.turno, 0);
  assert.ok(!O.tirar(e, 1, [3]), 'fuera de turno');
  assert.ok(!O.tirar(e, 0, [7]), 'dado imposible'); assert.ok(!O.tirar(e, 0, [3, 3]), 'con un dado no valen dos');
  assert.ok(O.tirar(e, 0, [3])); assert.strictEqual(e.pos[0], 3); assert.strictEqual(e.turno, 1);
  assert.deepStrictEqual(e.ultimo.camino, [1, 2, 3]);
  for (let s = 1; s < 20; s++) { const x = O.crear({ n: 4, rng: rngDe(s) }); assert.ok(x.turno >= 0 && x.turno < 4); }
});

test('de oca a oca y tiro porque me toca', () => {
  const e = hecho([0, 0]);
  assert.ok(O.tirar(e, 0, [5])); assert.strictEqual(e.pos[0], 9); assert.strictEqual(e.turno, 0, 'vuelve a tirar');
  assert.ok(e.ultimo.otra); assert.deepStrictEqual(e.ultimo.saltos, [{ a: 9, tipo: 'oca' }]);
  assert.ok(O.tirar(e, 0, [5])); assert.strictEqual(e.pos[0], 18, '14 es oca → 18');
  assert.ok(O.tirar(e, 0, [2])); assert.strictEqual(e.pos[0], 20); assert.strictEqual(e.turno, 1);
});

test('puentes y dados: a la otra casilla y vuelve a tirar', () => {
  let e = hecho([2, 0]); O.tirar(e, 0, [4]); assert.strictEqual(e.pos[0], 12); assert.strictEqual(e.turno, 0);
  e = hecho([8, 0]); O.tirar(e, 0, [4]); assert.strictEqual(e.pos[0], 6); assert.strictEqual(e.turno, 0);
  e = hecho([22, 0]); O.tirar(e, 0, [4]); assert.strictEqual(e.pos[0], 53); assert.strictEqual(e.turno, 0);
  e = hecho([51, 0]); O.tirar(e, 0, [2]); assert.strictEqual(e.pos[0], 26); assert.strictEqual(e.turno, 0);
});

test('laberinto → 30 y calavera → salida', () => {
  let e = hecho([40, 0]); O.tirar(e, 0, [2]); assert.strictEqual(e.pos[0], 30); assert.strictEqual(e.turno, 1);
  e = hecho([55, 0]); O.tirar(e, 0, [3]); assert.strictEqual(e.pos[0], 0); assert.strictEqual(e.turno, 1);
});

test('posada (1 turno) y cárcel (2 turnos)', () => {
  const e = hecho([17, 0, 0]);
  O.tirar(e, 0, [2]); assert.strictEqual(e.pos[0], 19); assert.strictEqual(e.espera[0], 1);
  O.tirar(e, 1, [1]); O.tirar(e, 2, [1]);
  assert.strictEqual(e.turno, 1, 'el de la posada pierde su turno'); assert.strictEqual(e.espera[0], 0);
  assert.strictEqual(e.ultimo.pasan[0].p, 0);
  O.tirar(e, 1, [1]); O.tirar(e, 2, [1]); assert.strictEqual(e.turno, 0, 'y después vuelve a tirar');

  const c = hecho([50, 0]);
  O.tirar(c, 0, [2]); assert.strictEqual(c.pos[0], 52); assert.strictEqual(c.espera[0], 2);
  O.tirar(c, 1, [1]); assert.strictEqual(c.turno, 1); O.tirar(c, 1, [1]); assert.strictEqual(c.turno, 1); O.tirar(c, 1, [1]);
  assert.strictEqual(c.turno, 0, 'tras perder 2 turnos vuelve a tirar');
});

test('pozo: hasta que otro caiga o pasen 3 turnos', () => {
  const e = hecho([29, 28]);
  O.tirar(e, 0, [2]); assert.strictEqual(e.pos[0], 31); assert.strictEqual(e.motivo[0], 'pozo');
  O.tirar(e, 1, [1]); assert.strictEqual(e.turno, 1);
  O.tirar(e, 1, [2]); assert.strictEqual(e.pos[1], 31, 'el segundo cae en el pozo');
  assert.strictEqual(e.espera[0], 0, 'y libera al primero'); assert.strictEqual(e.turno, 0);
  assert.deepStrictEqual(e.ultimo.saltos[0].libres, [0]);

  const t = hecho([29, 1]);
  O.tirar(t, 0, [2]); let turnos = 0;
  while (t.turno === 1 && turnos < 10) { t.pos[1] = 1; O.tirar(t, 1, [1]); turnos++; }
  assert.strictEqual(turnos, 4, 'tras 3 turnos sin tirar, sale del pozo');
});

test('última casilla: cuenta exacta o rebote', () => {
  let e = hecho([60, 0]); O.tirar(e, 0, [3]); assert.strictEqual(e.fase, 'fin'); assert.strictEqual(e.ganador, 0);
  assert.ok(!O.tirar(e, 1, [1]), 'acabada no se tira');
  e = hecho([61, 0]); O.tirar(e, 0, [5]); assert.strictEqual(e.pos[0], 60); assert.deepStrictEqual(e.ultimo.camino, [62, 63, 62, 61, 60]);
  e = hecho([60, 0]); O.tirar(e, 0, [6]); assert.strictEqual(e.pos[0], 60, 'de la 60 con un 6: 61, 62, 63 y rebota a la 60');
});

test('oca 59: pasa a la 63 y retrocede lo que saque, o gana directamente', () => {
  const e = hecho([57, 0]);
  O.tirar(e, 0, [2]); assert.strictEqual(e.pos[0], 63); assert.strictEqual(e.fase, 'jugando'); assert.ok(e.meta[0]); assert.strictEqual(e.turno, 0);
  O.tirar(e, 0, [3]); assert.strictEqual(e.pos[0], 60); assert.ok(!e.meta[0]); assert.strictEqual(e.turno, 1);
  const g = hecho([57, 0], { oca59: 'gana' });
  O.tirar(g, 0, [2]); assert.strictEqual(g.fase, 'fin'); assert.strictEqual(g.ganador, 0); assert.strictEqual(g.pos[0], 63);
});

test('dos dados: el 9 de la primera tirada y un dado desde la 60', () => {
  let e = O.crear({ n: 2, dados: 2, turno: 0 });
  assert.strictEqual(O.numDados(e, 0), 2); assert.ok(!O.tirar(e, 0, [3]), 'hacen falta dos dados');
  O.tirar(e, 0, [5, 4]); assert.strictEqual(e.pos[0], 53); assert.strictEqual(e.turno, 0, 'vuelve a tirar');
  O.tirar(e, 0, [1, 1]); assert.strictEqual(e.pos[0], 55);
  O.tirar(e, 1, [3, 6]); assert.strictEqual(e.pos[1], 26);
  O.tirar(e, 1, [6, 3]); assert.strictEqual(e.pos[1], 35, 'el 9 especial solo vale en la primera tirada');
  e = hecho([60, 0], { dados: 2 }); assert.strictEqual(O.numDados(e, 0), 1); assert.strictEqual(O.numDados(e, 1), 2);
  assert.ok(!O.tirar(e, 0, [1, 2])); assert.ok(O.tirar(e, 0, [2])); assert.strictEqual(e.pos[0], 62);
});

test('partidas al azar terminan y restaurar valida', () => {
  for (let s = 1; s < 60; s++) {
    const rng = rngDe(s), e = O.crear({ n: 2 + s % 3, dados: s % 2 ? 1 : 2, oca59: s % 4 ? 'rebota' : 'gana', rng });
    let i = 0; while (e.fase === 'jugando' && i < 5000) { assert.ok(O.tirar(e, e.turno, null, rng)); i++; }
    assert.strictEqual(e.fase, 'fin', 'semilla ' + s); assert.strictEqual(e.pos[e.ganador], 63);
    assert.ok(e.pos.every(c => c >= 0 && c <= 63));
    assert.deepStrictEqual(O.restaurar(O.copiar(e)), e);
  }
  assert.strictEqual(O.restaurar(null), null); assert.strictEqual(O.restaurar({ n: 9 }), null);
  const e = O.crear({ n: 2 }); e.pos[0] = 70; assert.strictEqual(O.restaurar(e), null);
  assert.strictEqual(O.tipo(5), 'oca'); assert.strictEqual(O.tipo(58), 'calavera'); assert.strictEqual(O.tipo(63), 'jardin'); assert.strictEqual(O.tipo(7), '');
});

// Motor del dominó: reparto, salida, jugadas legales, robar y pasar, dominó, tranque, parejas, puntos, vistas e IA (sin DOM).
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/online/domino-engine.js');
const rngDe = sem => { let s = sem >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
// estado a medida: manos dadas, el resto al pozo
function hecho(manos, op = {}) {
  const e = D.crear(Object.assign({ n: manos.length, rng: rngDe(1) }, op));
  const usadas = manos.flat().concat(op.mesa ? op.mesa.map(x => x.f) : []);
  e.manos = manos.map(m => m.slice()); e.pozo = op.pozo !== undefined ? op.pozo : D.TODAS.filter(f => !usadas.includes(f));
  e.mesa = op.mesa || []; e.turno = op.turno || 0; e.obligada = op.obligada !== undefined ? op.obligada : -1; e.pases = 0;
  return e;
}

test('reparto: 28 fichas, 7 por jugador, pozo con 2 y 3, sin pozo con 4', () => {
  for (const n of [2, 3, 4]) {
    for (let s = 1; s < 30; s++) {
      const e = D.crear({ n, rng: rngDe(s) });
      assert.strictEqual(e.manos.length, n); e.manos.forEach(m => assert.strictEqual(m.length, 7));
      assert.strictEqual(e.pozo.length, 28 - 7 * n);
      const todas = e.manos.flat().concat(e.pozo).sort((a, b) => a - b);
      assert.deepStrictEqual(todas, D.TODAS.slice().sort((a, b) => a - b));
      // sale el doble más alto repartido, y es obligado ponerlo
      const dobles = e.manos.flat().filter(D.esDoble); const max = Math.max(...dobles);
      assert.strictEqual(e.obligada, max); assert.ok(e.manos[e.turno].includes(max));
      assert.deepStrictEqual(D.legales(e, e.turno), [{ f: max, lado: 'd' }]);
    }
  }
});

test('jugadas legales, orientación en la mesa y turnos', () => {
  const e = hecho([[66, 26, 0, 13], [36, 5, 44, 11], [16, 22, 33, 3]], { obligada: 66 });
  assert.ok(!D.jugar(e, 1, 36, 'd'), 'fuera de turno');
  assert.ok(!D.jugar(e, 0, 26, 'd'), 'hay que poner el doble obligado');
  assert.ok(D.jugar(e, 0, 66, 'd')); assert.strictEqual(e.turno, 1);
  assert.deepStrictEqual(D.legales(e, 1), [{ f: 36, lado: 'd' }], 'con los dos extremos iguales solo se ofrece un lado');
  assert.ok(D.jugar(e, 1, 36, 'd')); assert.deepStrictEqual(D.extremos(e), [6, 3]);
  assert.deepStrictEqual(e.mesa[1], { f: 36, a: 6, b: 3 }, 'la ficha se gira para casar');
  assert.ok(D.jugar(e, 2, 16, 'i')); assert.deepStrictEqual(e.mesa[0], { f: 16, a: 1, b: 6 }); assert.deepStrictEqual(D.extremos(e), [1, 3]);
  assert.ok(!D.jugar(e, 0, 26, 'd'), 'no casa'); assert.ok(!D.jugar(e, 0, 99, 'd'), 'ficha inexistente'); assert.ok(!D.jugar(e, 0, 13, 'x'), 'lado inválido');
  const leg = D.legales(e, 0).map(j => j.f + j.lado).sort();
  assert.deepStrictEqual(leg, ['13d', '13i'], 'la 1-3 entra por los dos lados');
  assert.ok(D.jugar(e, 0, 13, 'i')); assert.deepStrictEqual(D.extremos(e), [3, 3]);
});

test('robar del pozo hasta poder y pasar cuando no queda', () => {
  const e = hecho([[66, 1], [0, 2]], { mesa: [{ f: 55, a: 5, b: 5 }], pozo: [12, 45] });
  assert.ok(!D.puedePasar(e, 0) && D.puedeRobar(e, 0));
  assert.ok(D.robar(e, 0)); assert.ok(e.manos[0].includes(45)); assert.strictEqual(e.turno, 0, 'sigue su turno tras robar');
  assert.ok(!D.robar(e, 0), 'ya puede poner: no roba');
  assert.ok(D.jugar(e, 0, 45, 'd')); assert.strictEqual(e.turno, 1);
  assert.ok(!D.puedeRobar(e, 1) || D.robar(e, 1));
  const f = hecho([[66], [0], [11]], { mesa: [{ f: 55, a: 5, b: 5 }], pozo: [] });
  assert.ok(!D.robar(f, 0)); assert.ok(D.pasar(f, 0)); assert.strictEqual(f.turno, 1);
});

test('dominó: gana quien se queda sin fichas y suma las de los rivales', () => {
  const e = hecho([[56], [0, 66], [12, 33]], { mesa: [{ f: 55, a: 5, b: 5 }], meta: 0 });
  assert.ok(D.jugar(e, 0, 56, 'd'));
  assert.strictEqual(e.fase, 'fin'); assert.strictEqual(e.resultado.ganador, 0); assert.ok(!e.resultado.tranque);
  assert.strictEqual(e.resultado.puntos, 0 + 12 + 3 + 6);
  assert.deepStrictEqual(e.puntos, [21, 0, 0]); assert.strictEqual(e.ganadorPartida, 0);
  assert.ok(!D.jugar(e, 1, 66, 'd'), 'no se juega tras el final');
});

test('tranque: nadie puede, gana quien menos suma; empate sin puntos', () => {
  const e = hecho([[11, 3], [22, 4], [0, 33]], { mesa: [{ f: 56, a: 5, b: 6 }], pozo: [], meta: 50 });
  assert.ok(D.pasar(e, 0) && D.pasar(e, 1) && D.pasar(e, 2));
  assert.strictEqual(e.fase, 'finMano'); assert.ok(e.resultado.tranque);
  assert.strictEqual(e.resultado.ganador, 0, '2+3 = 5 puntos'); assert.strictEqual(e.resultado.puntos, 8 + 6);
  assert.ok(D.siguienteMano(e, rngDe(4))); assert.strictEqual(e.turno, 0, 'abre quien ganó'); assert.strictEqual(e.obligada, -1);
  assert.strictEqual(e.mano, 2); e.manos.forEach(m => assert.strictEqual(m.length, 7));
  const t = hecho([[11], [2]], { mesa: [{ f: 56, a: 5, b: 6 }], pozo: [] });
  D.pasar(t, 0); D.pasar(t, 1);
  assert.strictEqual(t.resultado.ganador, -1); assert.deepStrictEqual(t.puntos, [0, 0]);
});

test('parejas: 0 y 2 contra 1 y 3, se cuentan las cuatro manos, partida a 50', () => {
  const e = hecho([[56], [44, 33], [1], [66, 25]], { mesa: [{ f: 55, a: 5, b: 5 }], parejas: true, meta: 50 });
  assert.strictEqual(e.parejas, true); assert.strictEqual(e.puntos.length, 2);
  assert.ok(D.jugar(e, 0, 56, 'd'));
  assert.strictEqual(e.resultado.equipo, 0); assert.strictEqual(e.resultado.puntos, 8 + 6 + 1 + 12 + 7);
  assert.deepStrictEqual(e.puntos, [34, 0]); assert.strictEqual(e.fase, 'finMano');
  e.puntos[0] = 49; D.siguienteMano(e, rngDe(2));
  e.manos = [[56], [44], [1], [66]]; e.mesa = [{ f: 55, a: 5, b: 5 }]; e.turno = 0;
  assert.ok(D.jugar(e, 0, 56, 'd')); assert.strictEqual(e.fase, 'fin'); assert.strictEqual(e.ganadorPartida, 0);
  assert.strictEqual(D.crear({ n: 3, parejas: true }).parejas, false, 'parejas solo con 4');
});

test('vistas: lo público no lleva manos ni pozo; cada uno ve solo la suya', () => {
  const e = D.crear({ n: 4, rng: rngDe(7) });
  const pub = D.publico(e);
  assert.ok(!('manos' in pub) && typeof pub.pozo === 'number'); assert.deepStrictEqual(pub.cuentas, [7, 7, 7, 7]);
  assert.ok(!JSON.stringify(pub).includes('"manos"'));
  assert.deepStrictEqual(D.vista(e, 2).mano, e.manos[2]);
  const cli = D.desdePublico(pub, e.turno, e.manos[e.turno]);
  assert.deepStrictEqual(D.legales(cli, e.turno), D.legales(e, e.turno), 'el cliente calcula sus jugadas con su mano');
  assert.ok(D.restaurar(D.copiar(e))); const roto = D.copiar(e); roto.manos[0].pop(); assert.strictEqual(D.restaurar(roto), null);
});

test('IA: siempre una acción válida y las partidas terminan (2, 3 y 4 jugadores, parejas)', () => {
  for (const [n, parejas] of [[2, false], [3, false], [4, false], [4, true]]) {
    for (let s = 1; s <= 25; s++) {
      const rng = rngDe(s * 31 + n), e = D.crear({ n, parejas, meta: 100, rng });
      let pasos = 0;
      while (e.fase !== 'fin' && pasos < 5000) {
        if (e.fase === 'finMano') { D.siguienteMano(e, rng); continue; }
        const m = D.ia(e, e.turno, 1 + (e.turno % 2), rng);
        assert.ok(D.accion(e, e.turno, m), 'acción válida de la IA');
        pasos++;
      }
      assert.strictEqual(e.fase, 'fin'); assert.ok(Math.max(...e.puntos) >= 100);
    }
  }
});

test('IA normal: si puede dominar, domina', () => {
  const e = hecho([[56], [0, 66]], { mesa: [{ f: 55, a: 5, b: 5 }] });
  assert.deepStrictEqual(D.ia(e, 0, 2), { a: 'jugar', f: 56, lado: 'd' });
  const g = hecho([[16, 26, 36, 0], [0, 66]].map((m, i) => i ? [11, 22] : m), { mesa: [{ f: 15, a: 1, b: 5 }], pozo: [] });
  assert.strictEqual(D.ia(g, 0, 2).f, 16, 'pone la ficha que le deja más jugadas');
});

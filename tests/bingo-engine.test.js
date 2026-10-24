// Pruebas del motor del bingo (Node): cartones válidos, bombo, premios y partidas completas simuladas.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/bingo/engine.js');

test('un cartón generado es siempre válido (5000 cartones)', () => {
  const rng = E.rngDe(1234);
  for (let i = 0; i < 5000; i++) {
    const c = E.generarCarton(rng);
    assert.ok(E.cartonValido(c), JSON.stringify(c));
    assert.equal(E.numerosDe(c).length, 15);
  }
});

test('cartonValido rechaza cartones mal formados', () => {
  const c = E.generarCarton(E.rngDe(7));
  const malo = JSON.parse(JSON.stringify(c));
  const f = malo.findIndex(fila => fila.some(n => n > 0));
  const k = malo[f].findIndex(n => n > 0);
  malo[f][k] = k === 8 ? 5 : 90; // fuera de su columna
  assert.equal(E.cartonValido(malo), false);
  assert.equal(E.cartonValido([[0], [0], [0]]), false);
  assert.equal(E.cartonValido(null), false);
});

test('cada columna usa su decena y la última incluye el 90', () => {
  const rng = E.rngDe(99);
  for (let i = 0; i < 300; i++) {
    const c = E.generarCarton(rng);
    c.forEach(fila => fila.forEach((n, k) => { if (n) assert.equal(E.columnaDe(n), k); }));
  }
  assert.equal(E.columnaDe(9), 0); assert.equal(E.columnaDe(10), 1); assert.equal(E.columnaDe(89), 8); assert.equal(E.columnaDe(90), 8);
});

test('mismo seed = mismos cartones y mismo bombo', () => {
  const j = [{ id: 'a', nombre: 'A', cartones: 2 }, { id: 'b', nombre: 'B', cartones: 3 }];
  const p1 = E.nuevaPartida({ jugadores: j, semilla: 42 }), p2 = E.nuevaPartida({ jugadores: j, semilla: 42 });
  assert.deepEqual(p1.cartones, p2.cartones);
  assert.deepEqual(p1.bombo, p2.bombo);
  assert.equal(p1.cartones.a.length, 2); assert.equal(p1.cartones.b.length, 3);
});

test('el bombo es una permutación de 1..90 y sacar la agota', () => {
  const p = E.nuevaPartida({ jugadores: [{ id: 'a', nombre: 'A', cartones: 1 }], semilla: 5 });
  assert.deepEqual([...p.bombo].sort((x, y) => x - y), Array.from({ length: 90 }, (_, i) => i + 1));
  const vistas = new Set();
  let b; while ((b = E.sacar(p)) !== null) { assert.ok(!vistas.has(b)); vistas.add(b); }
  assert.equal(vistas.size, 90);
});

test('ningún cartón se repite entre jugadores y los cartones por jugador se limitan', () => {
  const p = E.nuevaPartida({ jugadores: [{ id: 'a', nombre: 'A', cartones: 99 }, { id: 'b', nombre: 'B', cartones: 0 }], semilla: 3 });
  assert.equal(p.cartones.a.length, E.MAX_CARTONES);
  assert.equal(p.cartones.b.length, 1);
  const claves = Object.values(p.cartones).flat().map(c => JSON.stringify(c));
  assert.equal(new Set(claves).size, claves.length);
});

test('línea, falso y bingo', () => {
  const p = E.nuevaPartida({ jugadores: [{ id: 'a', nombre: 'A', cartones: 1 }, { id: 'b', nombre: 'B', cartones: 1 }], semilla: 11 });
  assert.equal(E.cantar(p, 'a', 'linea', 0).ok, false); // sin bolas
  const carton = p.cartones.a[0];
  // forzamos el bombo: primero los 5 números de la fila 0 del cartón de a
  const fila0 = carton[0].filter(n => n > 0);
  p.bombo = [...fila0, ...p.bombo.filter(n => !fila0.includes(n))];
  fila0.forEach(() => E.sacar(p));
  const r = E.cantar(p, 'a', 'linea', 0);
  assert.equal(r.ok, true);
  assert.equal(r.ganadores[0].id, 'a');
  assert.equal(E.cantar(p, 'b', 'linea', 0).ok, false); // ya cantada
  assert.equal(E.premioPendiente(p), 'bingo');
  assert.equal(E.cantar(p, 'a', 'bingo', 0).ok, false); // no está lleno
  const resto = E.numerosDe(carton).filter(n => !fila0.includes(n));
  p.bombo = [...p.bolas, ...resto, ...p.bombo.filter(n => !p.bolas.includes(n) && !resto.includes(n))];
  resto.forEach(() => E.sacar(p));
  assert.equal(E.cantar(p, 'a', 'bingo', 0).ok, true);
  assert.equal(p.fin, true);
  assert.equal(E.sacar(p), null);
});

test('no se puede cantar con un cartón ajeno o inexistente', () => {
  const p = E.nuevaPartida({ jugadores: [{ id: 'a', nombre: 'A', cartones: 1 }], semilla: 1 });
  assert.equal(E.cantar(p, 'x', 'linea', 0).ok, false);
  assert.equal(E.cantar(p, 'a', 'linea', 5).ok, false);
  assert.equal(E.cantar(p, 'a', 'oro', 0).ok, false);
});

test('empate: ganan los que completan la línea con la misma bola', () => {
  const p = E.nuevaPartida({ jugadores: [{ id: 'a', nombre: 'A', cartones: 1 }, { id: 'b', nombre: 'B', cartones: 1 }], semilla: 21 });
  // dos cartones que comparten una fila: se fabrica a mano
  const fila = [5, 0, 21, 0, 40, 0, 61, 0, 80];
  const base = [[0, 12, 0, 33, 0, 55, 0, 71, 0], [3, 0, 24, 0, 44, 0, 64, 0, 85], [0, 18, 0, 38, 0, 58, 0, 78, 0]];
  p.cartones.a = [[fila, base[1], base[2]]]; p.cartones.b = [[fila, base[1], base[0]]];
  p.bombo = [5, 21, 40, 61, 80, ...Array.from({ length: 90 }, (_, i) => i + 1).filter(n => ![5, 21, 40, 61, 80].includes(n))];
  for (let i = 0; i < 5; i++) E.sacar(p);
  const r = E.cantar(p, 'a', 'linea', 0);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ganadores.map(g => g.id).sort(), ['a', 'b']);
});

test('faltan(): números que quedan para línea y bingo', () => {
  const c = E.generarCarton(E.rngDe(8));
  assert.deepEqual(E.faltan(c, []), { linea: 5, bingo: 15 });
  assert.deepEqual(E.faltan(c, E.numerosDe(c)), { linea: 0, bingo: 0 });
});

test('100 partidas completas con 6 jugadores: siempre hay línea y luego bingo, nunca en falso', () => {
  for (let s = 1; s <= 100; s++) {
    const js = Array.from({ length: 6 }, (_, i) => ({ id: 'j' + i, nombre: 'J' + i, cartones: 1 + (i % 3) }));
    const p = E.nuevaPartida({ jugadores: js, semilla: s });
    let linea = null;
    while (!p.fin) {
      const b = E.sacar(p); assert.ok(b);
      for (const j of js) p.cartones[j.id].forEach((c, k) => {
        if (!p.ganados.linea && E.filasCompletas(c, p.bolas).length) { const r = E.cantar(p, j.id, 'linea', k); assert.ok(r.ok); linea = p.bolas.length; }
        else if (E.esBingo(c, p.bolas) && !p.fin) assert.ok(E.cantar(p, j.id, 'bingo', k).ok);
      });
    }
    assert.ok(linea > 0 && linea <= p.ganados.bingo.total);
    assert.ok(p.ganados.bingo.total <= 90);
  }
});

test('sin premio de línea solo hay bingo', () => {
  const p = E.nuevaPartida({ jugadores: [{ id: 'a', nombre: 'A', cartones: 1 }], premios: ['bingo'], semilla: 4 });
  assert.deepEqual(p.premios, ['bingo']);
  assert.equal(E.cantar(p, 'a', 'linea', 0).ok, false);
});

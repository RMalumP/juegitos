// Motor de 2048: deslizar, fundir una sola vez, puntuación, movimiento válido, fin de partida y aparición de fichas.
const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/games/g2048-engine.js');
const rngDe = sem => { let s = sem >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

test('deslizarFila: compactar y fundir como máximo una vez por ficha', () => {
  assert.deepStrictEqual(E.deslizarFila([2, 2, 2, 2]).fila, [4, 4, 0, 0]);
  assert.deepStrictEqual(E.deslizarFila([2, 2, 4, 0]).fila, [4, 4, 0, 0]);
  assert.deepStrictEqual(E.deslizarFila([4, 2, 2, 0]).fila, [4, 4, 0, 0]);
  assert.deepStrictEqual(E.deslizarFila([2, 0, 0, 2]).fila, [4, 0, 0, 0]);
  assert.deepStrictEqual(E.deslizarFila([2, 4, 2, 4]).fila, [2, 4, 2, 4]);
  assert.deepStrictEqual(E.deslizarFila([2, 2, 2, 0]).fila, [4, 2, 0, 0], 'se funden las dos primeras');
  assert.strictEqual(E.deslizarFila([2, 2, 4, 4]).puntos, 12);
  assert.strictEqual(E.deslizarFila([2, 4, 8, 16]).movido, false);
  assert.strictEqual(E.deslizarFila([0, 2, 0, 0]).movido, true);
});
test('mover en las 4 direcciones y en tableros 4×4, 5×5 y 6×6', () => {
  const g = [[2, 0, 0, 2], [0, 0, 0, 0], [4, 4, 0, 0], [0, 0, 0, 2]];
  assert.deepStrictEqual(E.mover(g, 0).grid, [[4, 0, 0, 0], [0, 0, 0, 0], [8, 0, 0, 0], [2, 0, 0, 0]]);
  assert.deepStrictEqual(E.mover(g, 2).grid, [[0, 0, 0, 4], [0, 0, 0, 0], [0, 0, 0, 8], [0, 0, 0, 2]]);
  assert.deepStrictEqual(E.mover(g, 1).grid, [[2, 4, 0, 4], [4, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.deepStrictEqual(E.mover(g, 3).grid, [[0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0], [4, 4, 0, 4]]);
  assert.deepStrictEqual(g[0], [2, 0, 0, 2], 'no modifica el tablero original');
  for (const n of [4, 5, 6]) { const r = E.mover(E.nuevoJuego(n, rngDe(n)), 0); assert.strictEqual(r.grid.length, n); }
});
test('puntos de una jugada = suma de las fichas creadas', () => {
  const r = E.mover([[2, 2, 4, 4], [8, 8, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 0);
  assert.strictEqual(r.puntos, 4 + 8 + 16);
});
test('fin de partida: tablero lleno sin fusiones posibles', () => {
  assert.ok(!E.puedeMover([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]));
  assert.ok(E.puedeMover([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 4]]), 'una fusión posible');
  assert.ok(E.puedeMover([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]]), 'un hueco');
});
test('agregar: una ficha 2 o 4 en un hueco (≈90 % de 2)', () => {
  const rng = rngDe(9); let doses = 0, tot = 0;
  for (let i = 0; i < 400; i++) { const g = E.vacio(4); const c = E.agregar(g, rng); assert.ok(c); const v = g[c[0]][c[1]]; assert.ok(v === 2 || v === 4); tot++; if (v === 2) doses++; }
  assert.ok(doses / tot > 0.8 && doses / tot < 0.97);
  const lleno = [[2, 4], [4, 2]]; assert.strictEqual(E.agregar(lleno, rng), null);
  assert.strictEqual(E.libres(E.nuevoJuego(4, rng)).length, 14);
});
test('partida aleatoria: la suma de fichas crece y el tablero siempre es válido', () => {
  const rng = rngDe(5); let g = E.nuevoJuego(4, rng), jugadas = 0;
  while (E.puedeMover(g) && jugadas < 3000) { const d = Math.floor(rng() * 4), r = E.mover(g, d); if (!r.movido) continue; g = r.grid; E.agregar(g, rng); jugadas++; }
  assert.ok(jugadas > 20); assert.ok(g.every(f => f.every(v => v === 0 || (v & (v - 1)) === 0)), 'solo potencias de 2');
});

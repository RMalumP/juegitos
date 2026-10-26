/* js/games/mem-engine.js — Memoria (parejas): reglas puras (sin DOM; se prueba en Node con tests/fase4-engines.test.js).
   Estado: { filas, cols, cartas:[id…], halladas:[bool…], abiertas:[índices], turno, jugadores, puntos:[a,b], intentos, fase:'jugando'|'fin', pendiente }
   voltear(est, i) → 'abrir' | 'par' | 'fallo' | null.  Tras un 'fallo' las dos cartas siguen boca arriba hasta resolver(est): se tapan y pasa el turno (2 jugadores). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.MemEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function barajar(a, rng) { rng = rng || Math.random; for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function crear(filas, cols, jugadores, rng) {
    var n = filas * cols; if (n % 2) throw new Error('el número de cartas debe ser par');
    var ids = []; for (var k = 0; k < n / 2; k++) ids.push(k, k);
    return { filas: filas, cols: cols, cartas: barajar(ids, rng), halladas: Array(n).fill(false), abiertas: [], turno: 0, jugadores: jugadores === 2 ? 2 : 1,
      puntos: [0, 0], intentos: 0, fase: 'jugando', pendiente: false };
  }
  function voltear(e, i) {
    if (e.fase !== 'jugando' || e.pendiente || !(i >= 0 && i < e.cartas.length) || Math.floor(i) !== i || e.halladas[i] || e.abiertas.indexOf(i) >= 0) return null;
    e.abiertas.push(i);
    if (e.abiertas.length < 2) return 'abrir';
    e.intentos++;
    var a = e.abiertas[0], b = e.abiertas[1];
    if (e.cartas[a] === e.cartas[b]) {
      e.halladas[a] = e.halladas[b] = true; e.abiertas = []; e.puntos[e.turno]++;
      if (e.halladas.every(Boolean)) e.fase = 'fin';
      return 'par';
    }
    e.pendiente = true; return 'fallo';
  }
  function resolver(e) {
    if (!e.pendiente) return false;
    e.abiertas = []; e.pendiente = false; if (e.jugadores === 2) e.turno = 1 - e.turno; return true;
  }
  function ganador(e) { if (e.fase !== 'fin') return -1; if (e.jugadores === 1) return 0; return e.puntos[0] === e.puntos[1] ? 2 : e.puntos[0] > e.puntos[1] ? 0 : 1; }
  return { crear: crear, voltear: voltear, resolver: resolver, ganador: ganador };
});

/* js/games/g2048-engine.js — 2048: reglas puras (sin DOM; se prueba en Node con tests/g2048-engine.test.js).
   Tablero n×n como lista de filas; 0 = vacío. Direcciones: 0 izquierda · 1 arriba · 2 derecha · 3 abajo. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.G2048Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function vacio(n) { return Array.from({ length: n }, function () { return Array(n).fill(0); }); }
  function copiar(g) { return g.map(function (f) { return f.slice(); }); }
  /* desliza una fila hacia el principio: cada ficha se funde como mucho una vez por jugada */
  function deslizarFila(fila) {
    var v = fila.filter(function (x) { return x; }), out = [], puntos = 0;
    for (var i = 0; i < v.length; i++) {
      if (v[i] === v[i + 1]) { out.push(v[i] * 2); puntos += v[i] * 2; i++; } else out.push(v[i]);
    }
    while (out.length < fila.length) out.push(0);
    var movido = out.some(function (x, k) { return x !== fila[k]; });
    return { fila: out, puntos: puntos, movido: movido };
  }
  function lineas(g, dir) {                                   // cada línea ordenada «desde el lado hacia el que se mueve»
    var n = g.length, L = [];
    for (var i = 0; i < n; i++) {
      var l = [];
      for (var j = 0; j < n; j++) l.push(dir === 0 ? [i, j] : dir === 2 ? [i, n - 1 - j] : dir === 1 ? [j, i] : [n - 1 - j, i]);
      L.push(l);
    }
    return L;
  }
  function mover(g, dir) {
    var nuevo = copiar(g), puntos = 0, movido = false;
    lineas(g, dir).forEach(function (celdas) {
      var r = deslizarFila(celdas.map(function (c) { return g[c[0]][c[1]]; }));
      puntos += r.puntos; if (r.movido) movido = true;
      celdas.forEach(function (c, k) { nuevo[c[0]][c[1]] = r.fila[k]; });
    });
    return { grid: nuevo, puntos: puntos, movido: movido };
  }
  function libres(g) { var o = []; g.forEach(function (f, r) { f.forEach(function (v, c) { if (!v) o.push([r, c]); }); }); return o; }
  /* añade un 2 (90 %) o un 4 (10 %) en una casilla libre; devuelve la casilla o null */
  function agregar(g, rng) {
    rng = rng || Math.random;
    var l = libres(g); if (!l.length) return null;
    var c = l[Math.floor(rng() * l.length)]; g[c[0]][c[1]] = rng() < 0.9 ? 2 : 4; return c;
  }
  function puedeMover(g) { return [0, 1, 2, 3].some(function (d) { return mover(g, d).movido; }); }
  function maximo(g) { return Math.max.apply(null, g.map(function (f) { return Math.max.apply(null, f); })); }
  function nuevoJuego(n, rng) { var g = vacio(n); agregar(g, rng); agregar(g, rng); return g; }
  return { vacio: vacio, copiar: copiar, deslizarFila: deslizarFila, mover: mover, agregar: agregar, libres: libres, puedeMover: puedeMover, maximo: maximo, nuevoJuego: nuevoJuego };
});

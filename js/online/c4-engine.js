/* js/online/c4-engine.js — Conecta 4: reglas, árbitro e IA (sin DOM; tests/duelo-engines.test.js).
   Tablero 7 columnas × 6 filas, celdas 0..41 (fila*7 + columna, la fila 0 es la de arriba). 0 vacío · 1 jugador 0 · 2 jugador 1.
   Estado público completo (no hay información oculta): { tab, turno, fase:'jugando'|'fin', ganador:-1|0|1|2(empate), linea:[celdas], ultimo, n }. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.C4Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var C = 7, F = 6;
  function nuevo(op) { return { tab: Array(C * F).fill(0), turno: op && op.turno === 1 ? 1 : 0, fase: 'jugando', ganador: -1, linea: [], ultimo: -1, n: 0 }; }
  function copiar(e) { return JSON.parse(JSON.stringify(e)); }
  function filaLibre(tab, col) { for (var r = F - 1; r >= 0; r--) if (!tab[r * C + col]) return r; return -1; }
  function legales(e) { var o = []; if (e.fase !== 'jugando') return o; for (var c = 0; c < C; c++) if (filaLibre(e.tab, c) >= 0) o.push(c); return o; }
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  /* línea de 4 que pasa por la celda i (para el jugador v), o null */
  function lineaDe(tab, i, v) {
    var r0 = Math.floor(i / C), c0 = i % C;
    for (var d = 0; d < 4; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1], cel = [i];
      for (var s = -1; s <= 1; s += 2) for (var k = 1; k < 4; k++) {
        var r = r0 + dr * k * s, c = c0 + dc * k * s;
        if (r < 0 || r >= F || c < 0 || c >= C || tab[r * C + c] !== v) break; cel.push(r * C + c);
      }
      if (cel.length >= 4) return cel;
    }
    return null;
  }
  function jugar(e, col) {
    if (e.fase !== 'jugando' || !(col >= 0 && col < C) || Math.floor(col) !== col) return false;
    var r = filaLibre(e.tab, col); if (r < 0) return false;
    var i = r * C + col, v = e.turno + 1; e.tab[i] = v; e.ultimo = i; e.n++;
    var l = lineaDe(e.tab, i, v);
    if (l) { e.fase = 'fin'; e.ganador = e.turno; e.linea = l; }
    else if (e.n === C * F) { e.fase = 'fin'; e.ganador = 2; }
    else e.turno = 1 - e.turno;
    return true;
  }

  /* ---------- IA ---------- */
  function ganaraCon(tab, col, v) { var r = filaLibre(tab, col); if (r < 0) return false; var i = r * C + col; tab[i] = v; var w = !!lineaDe(tab, i, v); tab[i] = 0; return w; }
  var ORDEN = [3, 2, 4, 1, 5, 0, 6];
  function puntuar(tab, v) {                              // heurística: ventanas de 4 con piezas propias/ajenas + control del centro
    var o = 3 - v, s = 0, i;
    for (var r = 0; r < F; r++) if (tab[r * C + 3] === v) s += 3; else if (tab[r * C + 3] === o) s -= 3;
    for (var d = 0; d < 4; d++) for (var r0 = 0; r0 < F; r0++) for (var c0 = 0; c0 < C; c0++) {
      var m = 0, t = 0, ok = true;
      for (var k = 0; k < 4; k++) { var r = r0 + DIRS[d][0] * k, c = c0 + DIRS[d][1] * k; if (r < 0 || r >= F || c < 0 || c >= C) { ok = false; break; } var x = tab[r * C + c]; if (x === v) m++; else if (x === o) t++; }
      if (!ok || (m && t)) continue;
      if (m === 3) s += 5; else if (m === 2) s += 2; if (t === 3) s -= 4; else if (t === 2) s -= 1;
    }
    return s;
  }
  function negamax(tab, v, prof, alfa, beta, n) {          // valor desde el punto de vista de v (que mueve)
    var mejor = -Infinity, hay = false;
    for (var k = 0; k < 7; k++) {
      var c = ORDEN[k], r = filaLibre(tab, c); if (r < 0) continue; hay = true;
      var i = r * C + c; tab[i] = v;
      var val;
      if (lineaDe(tab, i, v)) val = 1000 + prof;           // gana antes = mejor
      else if (n + 1 === C * F) val = 0;
      else if (prof <= 1) val = -puntuar(tab, 3 - v) + 0;   // hoja: valoración del rival invertida
      else val = -negamax(tab, 3 - v, prof - 1, -beta, -alfa, n + 1);
      tab[i] = 0;
      if (val > mejor) mejor = val; if (mejor > alfa) alfa = mejor; if (alfa >= beta) break;
    }
    return hay ? mejor : 0;
  }
  function elegir(l, rng) { return l[Math.floor(rng() * l.length)]; }
  /* nivel 1 fácil (azar) · 2 normal (gana/bloquea/evita regalar) · 3 difícil (negamax profundidad 6) */
  function ia(nivel, e, rng) {
    rng = rng || Math.random;
    var leg = legales(e), v = e.turno + 1, tab = e.tab.slice(), o = 3 - v, c;
    if (!leg.length) return -1;
    if (nivel === 1) return elegir(leg, rng);
    for (var a = 0; a < leg.length; a++) if (ganaraCon(tab, leg[a], v)) return leg[a];
    for (a = 0; a < leg.length; a++) if (ganaraCon(tab, leg[a], o)) return leg[a];
    if (nivel === 2) {
      var seguras = leg.filter(function (col) {               // no jugar donde el rival gane justo encima
        var r = filaLibre(tab, col), i = r * C + col; tab[i] = v; var arriba = r > 0 && ganaraCon(tab, col, o); tab[i] = 0; return !arriba;
      });
      var pool = seguras.length ? seguras : leg, pesos = [];
      pool.forEach(function (col) { var p = 4 - Math.abs(col - 3); for (var k = 0; k < p; k++) pesos.push(col); });
      return elegir(pesos, rng);
    }
    var mejor = -Infinity, mejores = [];
    for (a = 0; a < leg.length; a++) {
      c = leg[a]; var r = filaLibre(tab, c), i = r * C + c; tab[i] = v;
      var val = -negamax(tab, o, 6, -Infinity, Infinity, e.n + 1); tab[i] = 0;
      if (val > mejor) { mejor = val; mejores = [c]; } else if (val === mejor) mejores.push(c);
    }
    return elegir(mejores, rng);
  }
  return { C: C, F: F, nuevo: nuevo, copiar: copiar, jugar: jugar, legales: legales, ia: ia };
});

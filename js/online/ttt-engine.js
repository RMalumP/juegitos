/* js/online/ttt-engine.js — Tres en raya: reglas, árbitro e IA (sin DOM; tests/duelo-engines.test.js).
   Celdas 0..8. 0 vacío · 1 jugador 0 (❌) · 2 jugador 1 (⭕). Estado público completo: { tab, turno, fase, ganador:-1|0|1|2(empate), linea, ultimo, n }. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TttEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function nuevo(op) { return { tab: Array(9).fill(0), turno: op && op.turno === 1 ? 1 : 0, fase: 'jugando', ganador: -1, linea: [], ultimo: -1, n: 0 }; }
  function copiar(e) { return JSON.parse(JSON.stringify(e)); }
  function lineaGanadora(tab) { for (var i = 0; i < L.length; i++) { var a = L[i]; if (tab[a[0]] && tab[a[0]] === tab[a[1]] && tab[a[1]] === tab[a[2]]) return a.slice(); } return null; }
  function legales(e) { var o = []; if (e.fase !== 'jugando') return o; for (var i = 0; i < 9; i++) if (!e.tab[i]) o.push(i); return o; }
  function jugar(e, i) {
    if (e.fase !== 'jugando' || !(i >= 0 && i < 9) || Math.floor(i) !== i || e.tab[i]) return false;
    e.tab[i] = e.turno + 1; e.ultimo = i; e.n++;
    var l = lineaGanadora(e.tab);
    if (l) { e.fase = 'fin'; e.ganador = e.turno; e.linea = l; } else if (e.n === 9) { e.fase = 'fin'; e.ganador = 2; } else e.turno = 1 - e.turno;
    return true;
  }
  function minimax(tab, v, yo, n) {                          // valor para `yo` cuando mueve v
    var l = lineaGanadora(tab); if (l) return tab[l[0]] === yo ? 10 - n : n - 10;
    if (n === 9) return 0;
    var mejor = v === yo ? -Infinity : Infinity;
    for (var i = 0; i < 9; i++) if (!tab[i]) {
      tab[i] = v; var val = minimax(tab, 3 - v, yo, n + 1); tab[i] = 0;
      if (v === yo ? val > mejor : val < mejor) mejor = val;
    }
    return mejor;
  }
  function elegir(l, rng) { return l[Math.floor(rng() * l.length)]; }
  /* nivel 1 fácil (azar) · 2 normal (gana/bloquea, centro y esquinas) · 3 difícil (perfecta: nunca pierde) */
  function ia(nivel, e, rng) {
    rng = rng || Math.random;
    var leg = legales(e), v = e.turno + 1, o = 3 - v, tab = e.tab.slice();
    if (!leg.length) return -1;
    if (nivel === 1) return elegir(leg, rng);
    function gana(i, x) { tab[i] = x; var w = !!lineaGanadora(tab); tab[i] = 0; return w; }
    var a; for (a = 0; a < leg.length; a++) if (gana(leg[a], v)) return leg[a];
    for (a = 0; a < leg.length; a++) if (gana(leg[a], o)) return leg[a];
    if (nivel === 2) {
      if (!tab[4]) return 4;
      var esq = leg.filter(function (i) { return i === 0 || i === 2 || i === 6 || i === 8; }); if (esq.length) return elegir(esq, rng);
      return elegir(leg, rng);
    }
    var mejor = -Infinity, mejores = [];
    leg.forEach(function (i) { tab[i] = v; var val = minimax(tab, o, v, e.n + 1); tab[i] = 0; if (val > mejor) { mejor = val; mejores = [i]; } else if (val === mejor) mejores.push(i); });
    return elegir(mejores, rng);
  }
  return { nuevo: nuevo, copiar: copiar, jugar: jugar, legales: legales, ia: ia };
});

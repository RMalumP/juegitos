/* js/games/wordle-engine.js — Wordle en español: reglas puras (sin DOM; tests/fase4-engines.test.js).
   Palabras de 5 letras sin tildes (la ñ cuenta como letra). evaluar() marca cada letra: 2 = verde (sitio correcto), 1 = amarilla (está en otro sitio), 0 = gris,
   respetando las letras repetidas como el Wordle original (una amarilla solo si quedan copias sin emparejar). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.WordleEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function normalizar(t) {
    return String(t || '').toLowerCase().replace(/ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'ñ');
  }
  function evaluar(sol, intento) {
    var n = sol.length, res = Array(n).fill(0), resto = {}, i;
    for (i = 0; i < n; i++) { if (intento[i] === sol[i]) res[i] = 2; else resto[sol[i]] = (resto[sol[i]] || 0) + 1; }
    for (i = 0; i < n; i++) if (res[i] !== 2 && resto[intento[i]] > 0) { res[i] = 1; resto[intento[i]]--; }
    return res;
  }
  /* palabra del día: misma para todo el mundo según la fecha (aaaa-mm-dd) y la lista de soluciones */
  function indiceDelDia(fecha, total) {
    var h = 2166136261;
    for (var i = 0; i < fecha.length; i++) { h ^= fecha.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h % total;
  }
  function fechaHoy(d) { d = d || new Date(); var p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  /* texto para compartir (sin revelar letras) */
  function compartir(titulo, filas, intentosMax, evaluaciones) {
    var ico = ['⬛', '🟨', '🟩'];
    return titulo + ' ' + (evaluaciones.length && evaluaciones[evaluaciones.length - 1].every(function (x) { return x === 2; }) ? evaluaciones.length : 'X') + '/' + intentosMax + '\n' +
      evaluaciones.map(function (e) { return e.map(function (x) { return ico[x]; }).join(''); }).join('\n');
  }
  /* color de cada letra en el teclado: el mejor resultado obtenido (2 > 1 > 0) */
  function estadoTeclas(intentos, evaluaciones) {
    var t = {};
    intentos.forEach(function (w, k) { for (var i = 0; i < w.length; i++) { var c = w[i], v = evaluaciones[k][i]; if (t[c] === undefined || v > t[c]) t[c] = v; } });
    return t;
  }
  return { normalizar: normalizar, evaluar: evaluar, indiceDelDia: indiceDelDia, fechaHoy: fechaHoy, compartir: compartir, estadoTeclas: estadoTeclas };
});

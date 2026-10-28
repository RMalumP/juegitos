/* js/online/simon-engine.js — Simon multijugador: rondas por eliminación (sin DOM; tests/fase4-engines.test.js).
   Todos comparten la misma secuencia. En cada ronda cada jugador vivo la repite; quien falla (o no contesta a tiempo) queda eliminado.
   Gana el último en pie; si en una ronda fallan todos los que quedaban, empatan entre ellos.
   Estado público completo: { seq, n, vel, vivos:[bool], resp:[null|bool], alcanzo:[n], fase:'jugando'|'fin', ganadores:[p], ronda }.
   `alcanzo[p]` = secuencias completadas por el jugador p. `ronda` = longitud de la secuencia que se juega ahora. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.SimonEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var BASE = [800, 600, 420];
  function color(rng) { return Math.floor((rng || Math.random)() * 4) & 3; }
  function nuevo(op) {
    op = op || {}; var n = Math.max(1, Math.min(8, op.n | 0 || 2)), rng = op.rng || Math.random, vel = op.vel >= 0 && op.vel <= 2 ? op.vel | 0 : 1;
    var v = []; for (var i = 0; i < n; i++) v.push(true);
    return { seq: [color(rng)], n: n, vel: vel, vivos: v, resp: v.map(function () { return null; }), alcanzo: v.map(function () { return 0; }), fase: 'jugando', ganadores: [], ronda: 1 };
  }
  function copiar(e) { return JSON.parse(JSON.stringify(e)); }
  function vivos(e) { var o = []; for (var i = 0; i < e.n; i++) if (e.vivos[i]) o.push(i); return o; }
  function pendientes(e) { return vivos(e).filter(function (p) { return e.resp[p] === null; }); }
  // ¿Es correcta la respuesta `r` (lista de colores pulsados) para la secuencia actual?
  function correcta(e, r) {
    if (!Array.isArray(r) || r.length !== e.seq.length) return false;
    for (var i = 0; i < r.length; i++) if (r[i] !== e.seq[i]) return false;
    return true;
  }
  /* El jugador p responde a la ronda `ronda` con los colores `r`. Devuelve false si no vale (fuera de partida, eliminado, ya respondió u otra ronda).
     Cuando han respondido todos los vivos se cierra la ronda (y, si sigue la partida, se añade un color con `rng`). */
  function responder(e, p, ronda, r, rng) {
    if (e.fase !== 'jugando' || !(p >= 0 && p < e.n) || (p | 0) !== p || !e.vivos[p] || e.resp[p] !== null || ronda !== e.ronda) return false;
    e.resp[p] = correcta(e, r);
    if (e.resp[p]) e.alcanzo[p] = e.seq.length;
    if (!pendientes(e).length) cerrar(e, rng);
    return true;
  }
  // Cierra la ronda: quien no ha respondido bien queda eliminado (también por tiempo). Devuelve el estado.
  function cerrar(e, rng) {
    if (e.fase !== 'jugando') return e;
    var antes = vivos(e), quedan = antes.filter(function (p) { return e.resp[p] === true; });
    antes.forEach(function (p) { if (e.resp[p] !== true) e.vivos[p] = false; });
    if (!quedan.length) { e.fase = 'fin'; e.ganadores = antes; return e; }   // fallan todos los que quedaban: empate entre ellos
    if (quedan.length === 1 && e.n > 1) { e.fase = 'fin'; e.ganadores = quedan; return e; }
    e.seq.push(color(rng)); e.ronda = e.seq.length;
    for (var i = 0; i < e.n; i++) e.resp[i] = null;
    return e;
  }
  // Duración de cada destello y de la pausa entre colores (ms) — la misma que en la partida de 1 jugador.
  function ritmo(vel, largo) { var dur = Math.max(BASE[vel] - 12 * (largo - 1), 200); return { dur: dur, pausa: Math.max(dur * 0.35, 90) }; }
  // Tiempo máximo (ms) que el anfitrión espera las respuestas de una ronda: ver la secuencia + 1,5 s por color + margen.
  function plazo(vel, largo) { var r = ritmo(vel, largo); return 1500 + largo * (r.dur + r.pausa) + largo * 1500 + 8000; }
  // Clasificación final: por secuencias completadas (de más a menos). Cada fila: { p, alcanzo, gana }.
  function clasificacion(e) {
    var o = []; for (var i = 0; i < e.n; i++) o.push({ p: i, alcanzo: e.alcanzo[i], gana: e.ganadores.indexOf(i) >= 0 });
    return o.sort(function (a, b) { return (b.gana - a.gana) || (b.alcanzo - a.alcanzo) || (a.p - b.p); });
  }
  return { nuevo: nuevo, copiar: copiar, vivos: vivos, pendientes: pendientes, correcta: correcta, responder: responder, cerrar: cerrar, ritmo: ritmo, plazo: plazo, clasificacion: clasificacion };
});

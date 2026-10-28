/* js/online/uno-engine.js — UNO: reglas, árbitro e IA (sin DOM; tests/uno-engine.test.js). Lo usan los tres modos: CPU, pasar el móvil y online.
   Baraja de 108 cartas: por color (r rojo · a amarillo · v verde · z azul) un 0, dos de cada número del 1 al 9 y dos de cada acción
   (S salta · R reversa · D toma dos); y 8 comodines negros: 4 «W» (cambio de color) y 4 «W4» (toma cuatro). Una carta es un texto: «r7», «aD», «W», «W4».
   Reglas (las del reglamento oficial que pasó el usuario):
     · Se juega una carta del mismo color, número o símbolo que la del pozo, o un comodín. Se puede robar aunque se tenga jugada: si la robada sirve,
       se puede jugar (solo esa) o pasar; si no sirve, el turno pasa solo.
     · +2 y +4 se acumulan (opción `acumular`): sobre un +2 vale otro +2 o un +4; sobre un +4, solo otro +4. Quien no puede (o no quiere) seguir roba todo y pierde el turno.
     · El +4 solo es legal sin cartas del color en juego. El siguiente puede retarlo: si era ilegal, quien lo tiró roba 4 (y el retador juega normal);
       si era legal, el retador roba 6 y pierde el turno.
     · Quien se queda con una carta debe decir «¡UNO!» (antes de jugar la penúltima o después, mientras nadie le pille): si le pillan, roba 2.
     · Con 2 jugadores la reversa hace de salta. Si se acaba el mazo, se baraja el pozo (menos la carta de arriba).
     · Fin: partida rápida (gana quien se queda sin cartas) o por puntos (meta 200 o 500): el ganador de la ronda suma las cartas de los demás
       (números su valor, acciones 20, comodines 50; si la última fue un +2/+4, el siguiente roba antes de contar).
   El azar va en el propio estado (`semilla`), así la partida se guarda y se recupera tal cual. `vista(s)` es lo público (sin manos ni mazo). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.UnoEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var COLORES = ['r', 'a', 'v', 'z'];
  var NOMBRE_COLOR = { r: 'rojo', a: 'amarillo', v: 'verde', z: 'azul' };
  var MANO = 7, MIN = 2, MAX = 10;

  /* ---------- cartas ---------- */
  function baraja() {
    var b = [];
    COLORES.forEach(function (c) {
      b.push(c + '0');
      for (var n = 1; n <= 9; n++) b.push(c + n, c + n);
      ['S', 'R', 'D'].forEach(function (x) { b.push(c + x, c + x); });
    });
    for (var k = 0; k < 4; k++) b.push('W', 'W4');
    return b;
  }
  function esComodin(c) { return c === 'W' || c === 'W4'; }
  function colorDe(c) { return esComodin(c) ? null : c[0]; }
  function valorDe(c) { return esComodin(c) ? c : c.slice(1); }
  function puntosDe(c) { if (esComodin(c)) return 50; var v = valorDe(c); return /^\d$/.test(v) ? +v : 20; }
  function nombreCarta(c) {
    if (c === 'W') return 'Comodín'; if (c === 'W4') return 'Comodín +4';
    var v = valorDe(c), t = { S: 'Salta', R: 'Reversa', D: '+2' }[v] || v;
    return t + ' ' + NOMBRE_COLOR[colorDe(c)];
  }

  /* ---------- azar dentro del estado (mulberry32) ---------- */
  function azar(s) {
    s.semilla = (s.semilla + 0x6D2B79F5) >>> 0;
    var t = s.semilla;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function barajar(s, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(azar(s) * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  /* ---------- estado ---------- */
  function crear(op, rng) {
    op = op || {};
    var n = Math.max(MIN, Math.min(MAX, op.n || (op.nombres ? op.nombres.length : 2)));
    var nombres = []; for (var i = 0; i < n; i++) nombres.push((op.nombres && op.nombres[i]) || 'Jugador ' + (i + 1));
    var meta = [0, 200, 500].indexOf(op.meta) >= 0 ? op.meta : 0;
    var s = {
      n: n, nombres: nombres, op: { meta: meta, acumular: op.acumular !== false },
      semilla: op.semilla !== undefined ? op.semilla >>> 0 : Math.floor((rng || Math.random)() * 4294967296) >>> 0,
      puntos: Array(n).fill(0), ronda: 0, repartidor: -1, ganador: -1, turnos: Array(n).fill(0), ev: 0, log: []
    };
    s.repartidor = op.repartidor >= 0 && op.repartidor < n ? (op.repartidor + n - 1) % n : Math.floor(azar(s) * n);
    repartir(s);
    return s;
  }
  function anotar(s, e) { s.ev++; e.ev = s.ev; s.log.push(e); if (s.log.length > 12) s.log.shift(); }
  function tope(s) { return s.pozo[s.pozo.length - 1]; }
  function sig(s, p, k) { return (((p + s.sentido * (k || 1)) % s.n) + s.n) % s.n; }

  function repartir(s) {
    s.ronda++; s.repartidor = (s.repartidor + 1) % s.n;
    s.mazo = barajar(s, baraja()); s.pozo = [];
    s.manos = []; for (var p = 0; p < s.n; p++) s.manos.push([]);
    for (var k = 0; k < MANO; k++) for (p = 0; p < s.n; p++) s.manos[p].push(s.mazo.pop());
    s.sentido = 1; s.acum = 0; s.acumTipo = null; s.robada = null; s.reto = null;
    s.uno = Array(s.n).fill(false); s.pillable = -1; s.ganadorRonda = -1; s.puntosRonda = 0; s.fase = 'jugando';
    var c = s.mazo.pop();
    while (c === 'W4') { s.mazo.push(c); barajar(s, s.mazo); c = s.mazo.pop(); }   // un +4 de salida vuelve al mazo
    s.pozo.push(c); s.color = colorDe(c);
    s.turno = sig(s, s.repartidor);
    var v = valorDe(c), primero = s.turno;
    if (v === 'D') { robarN(s, primero, 2); s.turno = sig(s, primero); }
    else if (v === 'S') s.turno = sig(s, primero);
    else if (v === 'R') { s.sentido = -1; s.turno = s.repartidor; }   // empieza quien repartió, hacia el otro lado
    else if (v === 'W') s.fase = 'color';                                     // el primero elige color y luego juega
    anotar(s, { t: 'ronda', r: s.ronda, c: c, p: primero });
  }

  function rebarajar(s) {
    if (s.pozo.length <= 1) return false;
    var arriba = s.pozo.pop(); s.mazo = barajar(s, s.pozo); s.pozo = [arriba];
    return true;
  }
  function robarN(s, p, k) {
    var r = 0;
    for (var i = 0; i < k; i++) {
      if (!s.mazo.length && !rebarajar(s)) break;
      s.manos[p].push(s.mazo.pop()); r++;
    }
    if (s.manos[p].length > 1) s.uno[p] = false;
    if (s.pillable === p && s.manos[p].length > 1) s.pillable = -1;
    return r;
  }
  function cerrarPillar(s, p) { if (s.pillable >= 0 && s.pillable !== p) s.pillable = -1; }

  /* ---------- validación ---------- */
  function encaja(s, c) {
    if (s.acum > 0) {
      if (!s.op.acumular) return false;
      return s.acumTipo === 'D' ? (valorDe(c) === 'D' || c === 'W4') : c === 'W4';
    }
    if (esComodin(c)) return true;
    var t = tope(s);
    return colorDe(c) === s.color || (!esComodin(t) && valorDe(c) === valorDe(t));
  }
  function puedeJugar(s, p, i) {
    if (s.fase !== 'jugando' || s.turno !== p || !Number.isInteger(i) || i < 0 || i >= s.manos[p].length) return false;
    if (s.robada !== null && i !== s.robada) return false;
    return encaja(s, s.manos[p][i]);
  }
  function jugables(s, p) { var o = []; if (s.fase !== 'jugando' || s.turno !== p) return o; for (var i = 0; i < s.manos[p].length; i++) if (puedeJugar(s, p, i)) o.push(i); return o; }
  /* Lo mismo a partir de lo público y la mano propia (invitados online; la carta robada es siempre la última de la mano). */
  function jugablesDe(v, mano, p) {
    if (!v || v.fase !== 'jugando' || v.turno !== p || !mano) return [];
    var pseudo = { acum: v.acum, acumTipo: v.acumTipo, op: v.op, color: v.color, pozo: [v.tope] }, o = [];
    for (var i = 0; i < mano.length; i++) if ((!v.robada || i === mano.length - 1) && encaja(pseudo, mano[i])) o.push(i);
    return o;
  }
  function err(m) { return { ok: false, error: m }; }

  /* ---------- acciones (todas devuelven { ok, error? }) ---------- */
  function jugar(s, p, i, color) {
    if (s.fase === 'color') return err('Primero elige el color');
    if (s.fase !== 'jugando') return err('La ronda ha terminado');
    if (s.turno !== p) return err('No es tu turno');
    if (!puedeJugar(s, p, i)) return err(s.robada !== null ? 'Solo puedes jugar la carta que has robado' : s.acum > 0 ? 'Tienes que robar ' + s.acum + (s.op.acumular ? ' o acumular' : '') : 'Esa carta no se puede jugar');
    var mano = s.manos[p], c = mano[i];
    if (esComodin(c) && COLORES.indexOf(color) < 0) return err('Elige un color');
    var ilegal = false;
    if (c === 'W4') for (var k = 0; k < mano.length; k++) if (k !== i && colorDe(mano[k]) === s.color) ilegal = true;
    var habiaAcum = s.acum > 0;
    mano.splice(i, 1); s.pozo.push(c); s.robada = null; s.reto = null; s.turnos[p]++;
    cerrarPillar(s, p);
    s.color = esComodin(c) ? color : colorDe(c);
    if (mano.length === 1 && !s.uno[p]) s.pillable = p;
    if (mano.length !== 1) s.uno[p] = false;
    anotar(s, { t: 'jugar', p: p, c: c, color: s.color });
    var v = valorDe(c);
    if (v === 'D') { s.acum += 2; s.acumTipo = 'D'; }
    else if (c === 'W4') { s.acum += 4; s.acumTipo = 'W4'; if (!habiaAcum) s.reto = { de: p, ilegal: ilegal }; }
    if (!mano.length) { finRonda(s, p); return { ok: true }; }
    if (v === 'S' || (v === 'R' && s.n === 2)) { if (v === 'R') s.sentido = -s.sentido; s.turno = sig(s, p, 2); }
    else { if (v === 'R') s.sentido = -s.sentido; s.turno = sig(s, p); }
    return { ok: true };
  }
  function robar(s, p) {
    if (s.fase !== 'jugando') return err('Ahora no se puede robar');
    if (s.turno !== p) return err('No es tu turno');
    if (s.robada !== null) return err('Ya has robado: juega esa carta o pasa');
    cerrarPillar(s, p); s.turnos[p]++;
    if (s.acum > 0) {
      var k = robarN(s, p, s.acum);
      anotar(s, { t: 'robar', p: p, k: k, castigo: true });
      s.acum = 0; s.acumTipo = null; s.reto = null; s.turno = sig(s, p);
      return { ok: true, k: k };
    }
    var r = robarN(s, p, 1);
    anotar(s, { t: 'robar', p: p, k: r });
    if (r && encaja(s, s.manos[p][s.manos[p].length - 1])) { s.robada = s.manos[p].length - 1; return { ok: true, k: r, jugable: true }; }
    s.turno = sig(s, p);
    return { ok: true, k: r, jugable: false };
  }
  function pasar(s, p) {
    if (s.fase !== 'jugando' || s.turno !== p) return err('No es tu turno');
    if (s.robada === null) return err('Antes tienes que robar');
    s.robada = null; anotar(s, { t: 'pasar', p: p }); s.turno = sig(s, p);
    return { ok: true };
  }
  function retar(s, p) {
    if (s.fase !== 'jugando' || s.turno !== p || !s.reto) return err('No hay ningún +4 que retar');
    var r = s.reto, k; s.reto = null; cerrarPillar(s, p);
    if (r.ilegal) {                                            // pillado: roba 4 quien lo tiró y el retador juega normal
      k = robarN(s, r.de, 4); s.acum = 0; s.acumTipo = null;
      anotar(s, { t: 'retar', p: p, q: r.de, gana: true, k: k });
      return { ok: true, gana: true };
    }
    k = robarN(s, p, s.acum + 2); s.acum = 0; s.acumTipo = null; s.turnos[p]++;
    anotar(s, { t: 'retar', p: p, q: r.de, gana: false, k: k });
    s.turno = sig(s, p);
    return { ok: true, gana: false };
  }
  function decirUno(s, p) {
    if (s.fase !== 'jugando' || p < 0 || p >= s.n) return err('Ahora no');
    var n = s.manos[p].length;
    if (n > 2 || n === 0 || (n === 2 && s.turno !== p)) return err('Solo con una carta, o con dos en tu turno');
    if (s.uno[p]) return { ok: true };
    s.uno[p] = true; if (s.pillable === p) s.pillable = -1;
    anotar(s, { t: 'uno', p: p });
    return { ok: true };
  }
  function pillar(s, q, p) {
    if (s.fase !== 'jugando' || s.pillable !== p || q === p || q < 0 || q >= s.n) return err('Ya no se le puede pillar');
    var k = robarN(s, p, 2); s.pillable = -1;
    anotar(s, { t: 'pillar', p: q, q: p, k: k });
    return { ok: true };
  }
  function elegirColor(s, p, c) {
    if (s.fase !== 'color' || s.turno !== p) return err('Ahora no se elige color');
    if (COLORES.indexOf(c) < 0) return err('Color no válido');
    s.color = c; s.fase = 'jugando'; anotar(s, { t: 'color', p: p, color: c });
    return { ok: true };
  }
  function finRonda(s, p) {
    if (s.acum > 0) { robarN(s, sig(s, p), s.acum); s.acum = 0; s.acumTipo = null; }   // el +2/+4 final también cuenta
    s.reto = null; s.pillable = -1; s.robada = null; s.ganadorRonda = p;
    var pts = 0; s.manos.forEach(function (m, k) { if (k !== p) m.forEach(function (c) { pts += puntosDe(c); }); });
    s.puntosRonda = pts;
    if (s.op.meta) s.puntos[p] += pts;
    if (!s.op.meta || s.puntos[p] >= s.op.meta) { s.fase = 'final'; s.ganador = p; } else s.fase = 'fin';
    anotar(s, { t: 'fin', p: p, pts: pts });
  }
  function siguienteRonda(s) { if (s.fase !== 'fin') return err('La ronda no ha terminado'); repartir(s); return { ok: true }; }

  /* Una acción con forma de mensaje ({ a:'jugar', i, color } · robar · pasar · retar · uno · pillar(q) · color(c)), la misma para la interfaz y el online. */
  function accion(s, p, m) {
    if (!m || typeof m.a !== 'string') return err('Acción no válida');
    switch (m.a) {
      case 'jugar': return jugar(s, p, m.i, m.color);
      case 'robar': return robar(s, p);
      case 'pasar': return pasar(s, p);
      case 'retar': return retar(s, p);
      case 'uno': return decirUno(s, p);
      case 'pillar': return pillar(s, p, m.q);
      case 'color': return elegirColor(s, p, m.c);
      default: return err('Acción no válida');
    }
  }

  /* ---------- lo público ---------- */
  function vista(s) {
    var fin = s.fase === 'fin' || s.fase === 'final';
    return {
      n: s.n, nombres: s.nombres.slice(), op: { meta: s.op.meta, acumular: s.op.acumular }, cuantas: s.manos.map(function (m) { return m.length; }),
      tope: tope(s), color: s.color, sentido: s.sentido, turno: s.turno, fase: s.fase, acum: s.acum, acumTipo: s.acumTipo,
      reto: s.reto ? { de: s.reto.de } : null, robada: s.robada !== null, uno: s.uno.slice(), pillable: s.pillable, mazo: s.mazo.length, pozo: s.pozo.length,
      puntos: s.puntos.slice(), ronda: s.ronda, ganadorRonda: s.ganadorRonda, puntosRonda: s.puntosRonda, ganador: s.ganador, turnos: s.turnos.slice(),
      ev: s.ev, log: s.log.slice(-6), manosFin: fin ? s.manos.map(function (m) { return m.slice(); }) : null
    };
  }
  function restaurar(o) {
    if (!o || !Array.isArray(o.manos) || !Array.isArray(o.mazo) || !Array.isArray(o.pozo) || !o.pozo.length || o.manos.length !== o.n || o.n < MIN || o.n > MAX) return null;
    var todas = o.mazo.concat(o.pozo); o.manos.forEach(function (m) { todas = todas.concat(m); });
    if (todas.length !== 108 || todas.slice().sort().join() !== baraja().sort().join()) return null;   // no falta ni sobra ninguna carta
    return JSON.parse(JSON.stringify(o));
  }

  /* ---------- IA (nivel 1 fácil · 2 normal · 3 difícil) ---------- */
  function colorFavorito(mano, rng) {
    var c = { r: 0, a: 0, v: 0, z: 0 }; mano.forEach(function (x) { var k = colorDe(x); if (k) c[k] += 1 + puntosDe(x) / 50; });
    var mejor = null; COLORES.forEach(function (k) { if (mejor === null || c[k] > c[mejor]) mejor = k; });
    return c[mejor] > 0 ? mejor : COLORES[Math.floor(rng() * 4)];
  }
  function ia(s, p, nivel, rng) {
    rng = rng || Math.random; nivel = nivel || 2;
    if (s.fase === 'color') return { a: 'color', c: colorFavorito(s.manos[p], rng) };
    if (s.fase !== 'jugando' || s.turno !== p) return null;
    var mano = s.manos[p], js = jugables(s, p), uno = mano.length === 2 && js.length > 0 && rng() < [0, 0.6, 0.9, 1][nivel];
    if (s.reto && nivel === 3) {                               // retar un +4: más probable cuanto más cartas le quedaban a quien lo tiró
      var quedan = s.manos[s.reto.de].length;
      if (!js.length && quedan >= 3 && rng() < 0.35) return { a: 'retar' };
    }
    if (s.robada !== null) return nivel === 1 && rng() < 0.2 ? { a: 'pasar' } : conColor({ a: 'jugar', i: s.robada, uno: uno });
    if (!js.length) return { a: 'robar' };
    if (s.acum > 0 && nivel === 1 && rng() < 0.4) return { a: 'robar' };
    if (nivel === 1) return conColor({ a: 'jugar', i: js[Math.floor(rng() * js.length)], uno: uno });
    var siguiente = s.manos[sig(s, p)].length, fav = colorFavorito(mano.filter(function (x, k) { return js.indexOf(k) < 0 || !esComodin(x); }), rng);
    var mejor = -1, nota = -Infinity;
    js.forEach(function (i) {
      var c = mano[i], v = valorDe(c), t = puntosDe(c) / 10;
      if (c === 'W4') t -= mano.length > 2 ? 12 : 0;            // el +4 se guarda (además puede ser ilegal y retarse)
      else if (c === 'W') t -= mano.length > 2 ? 8 : 0;
      else if (colorDe(c) === fav) t += 3;
      if ((v === 'D' || v === 'S' || v === 'R' || c === 'W4') && siguiente <= (nivel === 3 ? 3 : 2)) t += 10;   // frenar a quien está a punto de ganar
      if (nivel === 3 && v === 'D') t += 1;
      t += rng() * 0.5;
      if (t > nota) { nota = t; mejor = i; }
    });
    return conColor({ a: 'jugar', i: mejor, uno: uno });
    function conColor(m) {
      if (esComodin(mano[m.i])) m.color = colorFavorito(mano.filter(function (x, k) { return k !== m.i; }), rng);
      return m;
    }
  }

  /* Turno completo de una CPU: quizá pilla a quien no dijo «¡UNO!», dice el suyo si toca y juega. Devuelve la acción hecha (o null). */
  function turnoCpu(s, p, nivel, rng) {
    rng = rng || Math.random;
    if (s.pillable >= 0 && s.pillable !== p && rng() < [0, 0.3, 0.6, 0.9][nivel || 2]) pillar(s, p, s.pillable);
    var m = ia(s, p, nivel, rng); if (!m) return null;
    if (m.uno) decirUno(s, p);
    var r = accion(s, p, m);
    return r.ok ? m : null;
  }

  return {
    COLORES: COLORES, NOMBRE_COLOR: NOMBRE_COLOR, MANO: MANO, MIN: MIN, MAX: MAX,
    baraja: baraja, esComodin: esComodin, colorDe: colorDe, valorDe: valorDe, puntosDe: puntosDe, nombreCarta: nombreCarta,
    crear: crear, siguienteRonda: siguienteRonda, accion: accion, jugar: jugar, robar: robar, pasar: pasar, retar: retar, decirUno: decirUno, pillar: pillar, elegirColor: elegirColor,
    puedeJugar: puedeJugar, jugables: jugables, jugablesDe: jugablesDe, encaja: encaja, vista: vista, restaurar: restaurar, ia: ia, turnoCpu: turnoCpu, sig: sig
  };
});

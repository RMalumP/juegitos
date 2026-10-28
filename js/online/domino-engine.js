/* js/online/domino-engine.js — Dominó (doble seis, de 2 a 4 jugadores): reglas, árbitro e IA (sin DOM; tests/domino-engine.test.js).
   Fichas: id = a*10 + b con a <= b (0 = blanca … 66 = seis doble); 28 fichas, 7 por jugador. Con 2 o 3 jugadores sobra un pozo del que se roba
   cuando no se puede poner. La primera mano la abre quien tiene el doble más alto, poniéndolo; las siguientes, quien ganó la anterior (ficha libre).
   La mano acaba cuando alguien se queda sin fichas («domina») o con tranque (nadie puede poner ni robar): gana quien (o la pareja que) menos puntos
   tiene en la mano. El ganador se lleva los puntos de las manos de los rivales (por parejas, los de las cuatro manos). La partida acaba a `meta` puntos
   (0 = una sola mano). Con 4 jugadores, opción de parejas: 0 y 2 contra 1 y 3.
   Estado completo (solo el árbitro): { n, parejas, meta, manos:[[id]], pozo:[id], mesa:[{f,a,b}], turno, fase:'jugando'|'finMano'|'fin', pases,
   puntos:[…], mano, salida, obligada, ultimo, resultado, nj }. publico(e) quita las manos y el pozo (salvo al acabar la mano); vista(e,p) da la mano de p. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.DominoEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TODAS = []; for (var a = 0; a <= 6; a++) for (var b = a; b <= 6; b++) TODAS.push(a * 10 + b);
  var METAS = [0, 50, 100];
  function lados(f) { return [Math.floor(f / 10), f % 10]; }
  function valor(f) { return Math.floor(f / 10) + f % 10; }
  function esDoble(f) { return Math.floor(f / 10) === f % 10; }
  function esFicha(f) { return TODAS.indexOf(f) >= 0; }
  function suma(mano) { return mano.reduce(function (s, f) { return s + valor(f); }, 0); }
  function copiar(e) { return JSON.parse(JSON.stringify(e)); }
  function barajar(arr, rng) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  function equipo(e, p) { return e.parejas ? p % 2 : p; }
  function extremos(e) { return e.mesa.length ? [e.mesa[0].a, e.mesa[e.mesa.length - 1].b] : null; }

  function crear(op) {
    op = op || {};
    var n = Math.max(2, Math.min(4, op.n | 0 || 4)), parejas = n === 4 && !!op.parejas;
    var e = { n: n, parejas: parejas, meta: METAS.indexOf(op.meta) >= 0 ? op.meta : 0, manos: [], pozo: [], mesa: [], turno: 0, fase: 'jugando', pases: 0,
      puntos: Array(parejas ? 2 : n).fill(0), mano: 0, salida: -1, obligada: -1, ultimo: null, resultado: null, nj: 0, ganadorPartida: -1 };
    repartir(e, op.rng || Math.random);
    return e;
  }
  /* reparte una mano nueva. Primera mano: sale el doble más alto (y es obligado ponerlo). Siguientes: quien ganó la anterior. */
  function repartir(e, rng) {
    var siguiente = e.resultado && e.resultado.ganador >= 0 ? e.resultado.ganador : (e.salida >= 0 ? (e.salida + 1) % e.n : -1);
    for (var intento = 0; intento < 50; intento++) {
      var mazo = barajar(TODAS.slice(), rng || Math.random);
      e.manos = []; for (var p = 0; p < e.n; p++) e.manos.push(mazo.slice(p * 7, p * 7 + 7));
      e.pozo = mazo.slice(e.n * 7);
      if (e.mano > 0 && siguiente >= 0) { e.salida = siguiente; e.obligada = -1; break; }
      var mejor = -1, quien = -1;
      e.manos.forEach(function (m, i) { m.forEach(function (f) { if (esDoble(f) && f > mejor) { mejor = f; quien = i; } }); });
      if (quien >= 0) { e.salida = quien; e.obligada = mejor; break; }   // con 2 o 3 jugadores puede no haber dobles repartidos: se vuelve a repartir
    }
    e.mano++; e.mesa = []; e.turno = e.salida; e.fase = 'jugando'; e.pases = 0; e.ultimo = null; e.resultado = null;
    e.manos.forEach(function (m) { m.sort(function (x, y) { return x - y; }); });
  }

  /* jugadas posibles de p: [{ f, lado:'i'|'d' }] (con la mesa vacía, lado 'd'; si los dos extremos son iguales, solo 'd') */
  function legales(e, p) {
    var o = []; if (e.fase !== 'jugando' || p !== e.turno) return o;
    var mano = e.manos[p] || [], ex = extremos(e);
    mano.forEach(function (f) {
      if (!ex) { if (e.obligada < 0 || f === e.obligada) o.push({ f: f, lado: 'd' }); return; }
      var l = lados(f);
      if (ex[0] !== ex[1] && (l[0] === ex[0] || l[1] === ex[0])) o.push({ f: f, lado: 'i' });
      if (l[0] === ex[1] || l[1] === ex[1]) o.push({ f: f, lado: 'd' });
    });
    return o;
  }
  function puedeRobar(e, p) { return e.fase === 'jugando' && p === e.turno && e.pozo.length > 0 && legales(e, p).length === 0; }
  function puedePasar(e, p) { return e.fase === 'jugando' && p === e.turno && e.pozo.length === 0 && legales(e, p).length === 0; }

  function jugar(e, p, f, lado) {
    if (!Number.isInteger(f) || (lado !== 'i' && lado !== 'd')) return false;
    var ok = legales(e, p).some(function (j) { return j.f === f && j.lado === lado; });
    if (!ok) return false;
    var l = lados(f), ex = extremos(e), pieza;
    if (!ex) pieza = { f: f, a: l[0], b: l[1] };
    else if (lado === 'i') pieza = { f: f, a: l[1] === ex[0] ? l[0] : l[1], b: ex[0] };
    else pieza = { f: f, a: ex[1], b: l[0] === ex[1] ? l[1] : l[0] };
    if (lado === 'i') e.mesa.unshift(pieza); else e.mesa.push(pieza);
    e.manos[p].splice(e.manos[p].indexOf(f), 1);
    e.obligada = -1; e.pases = 0; e.nj++; e.ultimo = { p: p, tipo: 'juega', f: f, lado: lado };
    if (!e.manos[p].length) cerrarMano(e, p, false);
    else e.turno = (p + 1) % e.n;
    return true;
  }
  function robar(e, p) {
    if (!puedeRobar(e, p)) return false;
    var f = e.pozo.pop(); e.manos[p].push(f); e.manos[p].sort(function (x, y) { return x - y; });
    e.nj++; e.ultimo = { p: p, tipo: 'roba' };
    return true;
  }
  function pasar(e, p) {
    if (!puedePasar(e, p)) return false;
    e.pases++; e.nj++; e.ultimo = { p: p, tipo: 'pasa' };
    if (e.pases >= e.n) tranque(e); else e.turno = (p + 1) % e.n;
    return true;
  }
  /* tranque: gana el jugador (o la pareja) con menos puntos en la mano; si empatan los mejores, nadie se los lleva */
  function tranque(e) {
    var cuentas = e.manos.map(suma), grupos = {};
    cuentas.forEach(function (c, p) { var q = equipo(e, p); grupos[q] = (grupos[q] || 0) + c; });
    var claves = Object.keys(grupos).map(Number), min = Math.min.apply(null, claves.map(function (q) { return grupos[q]; }));
    var mejores = claves.filter(function (q) { return grupos[q] === min; });
    if (mejores.length > 1) { cerrarMano(e, -1, true); return; }
    // el jugador que «gana» el tranque: el de menos puntos dentro del equipo ganador (abre la mano siguiente)
    var ganador = -1; cuentas.forEach(function (c, p) { if (equipo(e, p) === mejores[0] && (ganador < 0 || c < cuentas[ganador])) ganador = p; });
    cerrarMano(e, ganador, true);
  }
  function cerrarMano(e, ganador, cerrada) {
    var cuentas = e.manos.map(suma), pts = 0;
    if (ganador >= 0) {
      cuentas.forEach(function (c, p) { if (e.parejas || p !== ganador) pts += c; });   // por parejas se cuentan las cuatro manos (también la del compañero)
      e.puntos[equipo(e, ganador)] += pts;
    }
    e.resultado = { ganador: ganador, equipo: ganador >= 0 ? equipo(e, ganador) : -1, puntos: pts, tranque: !!cerrada, cuentas: cuentas, manos: e.manos.map(function (m) { return m.slice(); }) };
    var mx = Math.max.apply(null, e.puntos);
    if (e.meta === 0 || mx >= e.meta) {
      e.fase = 'fin';
      // ganador de la partida: más puntos (con meta 0, el de esta mano; si fue empate sin ganador, -1)
      var lideres = []; e.puntos.forEach(function (v, q) { if (v === mx) lideres.push(q); });
      e.ganadorPartida = e.meta === 0 ? e.resultado.equipo : (lideres.length === 1 ? lideres[0] : -1);
      if (e.meta > 0 && lideres.length > 1) e.fase = 'finMano';  // empate a la meta: se juega otra mano
    } else e.fase = 'finMano';
  }
  function siguienteMano(e, rng) {
    if (e.fase !== 'finMano') return false;
    repartir(e, rng || Math.random); return true;
  }

  /* lo que ve todo el mundo: sin manos ni pozo (salvo al terminar la mano, que se enseñan) */
  function publico(e) {
    var o = { n: e.n, parejas: e.parejas, meta: e.meta, mesa: e.mesa.map(function (x) { return { f: x.f, a: x.a, b: x.b }; }), cuentas: e.manos.map(function (m) { return m.length; }),
      pozo: e.pozo.length, turno: e.turno, fase: e.fase, pases: e.pases, puntos: e.puntos.slice(), mano: e.mano, salida: e.salida, obligada: e.obligada,
      ultimo: e.ultimo ? Object.assign({}, e.ultimo) : null, resultado: e.resultado ? copiar(e.resultado) : null, nj: e.nj, ganadorPartida: e.ganadorPartida };
    return o;
  }
  function vista(e, p) { return { p: p, mano: (e.manos[p] || []).slice() }; }
  /* estado público + una mano → «estado» con la forma del completo, para usar legales() en el cliente (sin las manos ajenas) */
  function desdePublico(pub, p, mano) {
    var e = copiar(pub); e.manos = []; for (var i = 0; i < pub.n; i++) e.manos.push(i === p ? (mano || []).slice() : Array(pub.cuentas[i]).fill(-1));
    e.pozo = Array(pub.pozo).fill(-1); return e;
  }
  /* comprobación al recuperar un estado guardado */
  function restaurar(d) {
    if (!d || !Array.isArray(d.manos) || !Array.isArray(d.mesa) || !Array.isArray(d.pozo) || !(d.n >= 2 && d.n <= 4) || d.manos.length !== d.n) return null;
    var vistas = d.manos.reduce(function (a, m) { return a.concat(m); }, []).concat(d.pozo, d.mesa.map(function (x) { return x.f; }));
    if (vistas.length !== 28 || TODAS.some(function (f) { return vistas.indexOf(f) < 0; })) return null;
    return copiar(d);
  }

  /* IA. nivel 1: una jugada legal al azar. nivel 2: suelta las fichas gordas y los dobles, procura quedarse con números para los dos extremos
     y, por parejas, no cierra el número del compañero. Devuelve { a:'jugar', f, lado } | { a:'robar' } | { a:'pasar' } | null. */
  function ia(e, p, nivel, rng) {
    rng = rng || Math.random;
    if (e.fase !== 'jugando' || e.turno !== p) return null;
    var leg = legales(e, p);
    if (!leg.length) return puedeRobar(e, p) ? { a: 'robar' } : { a: 'pasar' };
    if (nivel === 1) { var j = leg[Math.floor(rng() * leg.length)]; return { a: 'jugar', f: j.f, lado: j.lado }; }
    var mano = e.manos[p], mejor = null, mejorV = -Infinity;
    leg.forEach(function (j) {
      var copia = copiar(e); copia.ultimo = null;
      var resto = mano.filter(function (f) { return f !== j.f; });
      if (!resto.length) { if (mejorV < 1e6) { mejorV = 1e6; mejor = j; } return; }
      jugar(copia, p, j.f, j.lado);
      var ex = extremos(copia), v = valor(j.f) * 2 + (esDoble(j.f) ? 6 : 0);
      // cuántas fichas me quedan que entran en algún extremo, y de cuántos números distintos dispongo
      var entran = resto.filter(function (f) { var l = lados(f); return l.indexOf(ex[0]) >= 0 || l.indexOf(ex[1]) >= 0; }).length;
      v += entran * 4;
      // los números de los extremos que no tengo: los rivales pueden cerrarme
      [ex[0], ex[1]].forEach(function (n) { if (!resto.some(function (f) { return lados(f).indexOf(n) >= 0; })) v -= 3; });
      // muchas fichas de ese número en la mesa: es fácil que el siguiente no tenga y pase (bien si es rival)
      var enMesa = function (n) { return copia.mesa.filter(function (x) { return x.a === n || x.b === n; }).length; };
      v += (enMesa(ex[0]) + enMesa(ex[1])) * 0.5;
      v += rng() * 0.5;
      if (v > mejorV) { mejorV = v; mejor = j; }
    });
    return { a: 'jugar', f: mejor.f, lado: mejor.lado };
  }
  /* aplica una acción ({ a, f, lado }) del jugador p */
  function accion(e, p, m) {
    if (!m) return false;
    if (m.a === 'jugar') return jugar(e, p, m.f, m.lado);
    if (m.a === 'robar') return robar(e, p);
    if (m.a === 'pasar') return pasar(e, p);
    return false;
  }

  return { TODAS: TODAS, METAS: METAS, crear: crear, legales: legales, puedeRobar: puedeRobar, puedePasar: puedePasar, jugar: jugar, robar: robar, pasar: pasar,
    accion: accion, siguienteMano: siguienteMano, publico: publico, vista: vista, desdePublico: desdePublico, restaurar: restaurar, copiar: copiar, ia: ia,
    lados: lados, valor: valor, esDoble: esDoble, esFicha: esFicha, suma: suma, equipo: equipo, extremos: extremos };
});

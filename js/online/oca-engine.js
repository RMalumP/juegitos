/* js/online/oca-engine.js — Juego de la Oca (63 casillas, de 2 a 4 jugadores, con 1 o 2 dados): reglas y árbitro (sin DOM; tests/oca-engine.test.js).
   Las fichas salen de la casilla 0 (la salida, fuera del tablero) y gana quien llega a la 63 con la cuenta exacta; si sobran puntos, rebota hacia atrás.
   Casillas: oca (5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59) → a la siguiente oca y vuelve a tirar; desde la 59 pasa a la 63 y tira
   para retroceder lo que saque (`oca59: 'rebota'`, el reglamento que nos dieron) o gana directamente (`oca59: 'gana'`). Puente 6 ↔ 12 y dados
   26 ↔ 53: a la otra y vuelve a tirar. Posada 19: pierde 1 turno. Pozo 31: no tira hasta que otro caiga en él o pasen 3 turnos.
   Laberinto 42 → 30. Cárcel 52: pierde 2 turnos. Calavera 58 → a la salida.
   Con 2 dados: un 9 en la primera tirada lleva a los dados (5 y 4 → 53, 6 y 3 → 26) y se vuelve a tirar; desde la casilla 60 se tira con un dado.
   Estado (público, no hay nada oculto): { n, dados, oca59, pos:[c], espera:[turnos], motivo:['posada'|'pozo'|'carcel'|''], meta:[bool], tiros:[n],
   turno, fase:'jugando'|'fin', ganador, ultimo, hist:[{p,t}], nj }. El texto de las jugadas no lleva el nombre: la interfaz lo antepone. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.OcaEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var FINAL = 63, OCAS = [5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59];
  var PUENTES = { 6: 12, 12: 6 }, DADOS = { 26: 53, 53: 26 };
  var ESPERA = { posada: 1, pozo: 3, carcel: 2 };
  var MAX_HIST = 30;

  /* tipo de cada casilla (para pintar el tablero y aplicar la regla) */
  function tipo(c) {
    if (c === 0) return 'salida';
    if (c === FINAL) return 'jardin';
    if (OCAS.indexOf(c) >= 0) return 'oca';
    if (PUENTES[c]) return 'puente';
    if (DADOS[c]) return 'dados';
    return { 19: 'posada', 31: 'pozo', 42: 'laberinto', 52: 'carcel', 58: 'calavera' }[c] || '';
  }
  var NOMBRES = { salida: 'la salida', jardin: 'el Jardín de la Oca', oca: 'la oca', puente: 'el puente', dados: 'los dados', posada: 'la posada', pozo: 'el pozo', laberinto: 'el laberinto', carcel: 'la cárcel', calavera: 'la calavera' };
  var DICHOS = {
    oca: 'De oca a oca y tiro porque me toca', puente: 'De puente a puente y tiro porque me lleva la corriente', dados: 'De dados a dados y tiro porque son cuadrados',
    posada: 'En la posada me quedo a descansar', pozo: 'En el pozo caí y hasta que otro me saque no salgo de aquí', laberinto: 'Del laberinto al 30',
    carcel: 'En la cárcel encerrado, dos turnos castigado', calavera: 'De la calavera, a la salida', jardin: '¡Al Jardín de la Oca llegué!'
  };

  function copiar(e) { return JSON.parse(JSON.stringify(e)); }
  function crear(op) {
    op = op || {};
    var n = Math.max(2, Math.min(4, op.n | 0 || 2)), rng = op.rng || Math.random;
    var e = { n: n, dados: op.dados === 2 ? 2 : 1, oca59: op.oca59 === 'gana' ? 'gana' : 'rebota', pos: [], espera: [], motivo: [], meta: [], tiros: [],
      turno: 0, fase: 'jugando', ganador: -1, ultimo: null, hist: [], nj: 0 };
    for (var i = 0; i < n; i++) { e.pos.push(0); e.espera.push(0); e.motivo.push(''); e.meta.push(false); e.tiros.push(0); }
    e.turno = op.turno >= 0 && op.turno < n ? op.turno | 0 : Math.floor(rng() * n);
    return e;
  }
  /* con 2 dados, a partir de la casilla 60 se tira con uno solo */
  function numDados(e, p) { return e.dados === 2 && e.pos[p] < 60 ? 2 : 1; }
  function anotar(e, p, t) { e.hist.unshift({ p: p, t: t }); if (e.hist.length > MAX_HIST) e.hist.length = MAX_HIST; }

  /* tira el jugador p (los dados se pueden forzar en las pruebas). Devuelve false si no le toca o los dados no valen. */
  function tirar(e, p, forzados, rng) {
    if (!e || e.fase !== 'jugando' || p !== e.turno) return false;
    var nd = numDados(e, p), d = [];
    if (forzados) {
      if (!Array.isArray(forzados) || forzados.length !== nd || !forzados.every(function (x) { return x === (x | 0) && x >= 1 && x <= 6; })) return false;
      d = forzados.slice();
    } else for (var k = 0; k < nd; k++) d.push(1 + Math.floor((rng || Math.random)() * 6));
    var suma = d[0] + (d[1] || 0), desde = e.pos[p], camino = [], saltos = [], txt = 'saca ' + (d.length === 2 ? d[0] + ' y ' + d[1] : d[0]);
    var primera = e.tiros[p] === 0; e.tiros[p]++;
    var c;
    if (d.length === 2 && primera && suma === 9) {
      // 9 en la primera tirada con dos dados: 5 y 4 → 53, 6 y 3 → 26, y vuelve a tirar (sin aplicar la casilla de destino)
      c = d.indexOf(5) >= 0 ? 53 : 26;
      saltos.push({ a: c, tipo: 'nueve' });
      e.pos[p] = c; e.meta[p] = false;
      var tx = txt + ' (9 en la primera tirada): ¡directo a los dados de la ' + c + '! Vuelve a tirar.';
      return cerrar(e, p, d, desde, camino, saltos, true, tx, 'dados');
    }
    if (e.meta[p]) {                                                      // en la 63 por la oca 59: retrocede lo que saque
      c = FINAL; for (var r = 0; r < suma; r++) camino.push(--c);
      e.meta[p] = false;
      txt += ' y retrocede desde la 63 hasta la ' + c;
    } else {
      c = desde; var dir = 1;
      for (var s = 0; s < suma; s++) { if (c === FINAL) dir = -1; c += dir; camino.push(c); }
      txt += c === FINAL ? ' y llega a la 63' : dir < 0 ? ', llega a la 63 y rebota hasta la ' + c : ' y llega a la ' + c;
    }
    e.pos[p] = c;
    return aplicar(e, p, d, desde, camino, saltos, txt);
  }

  /* regla de la casilla en la que ha caído p */
  function aplicar(e, p, d, desde, camino, saltos, txt) {
    var c = e.pos[p], t = tipo(c), otra = false, a;
    if (c === FINAL) {
      e.fase = 'fin'; e.ganador = p;
      return cerrar(e, p, d, desde, camino, saltos, false, txt + '. ¡Ha llegado al Jardín de la Oca y gana!', 'jardin');
    }
    if (t === 'oca') {
      var i = OCAS.indexOf(c);
      if (i < OCAS.length - 1) { a = OCAS[i + 1]; txt += ': ¡de oca a oca! Salta a la ' + a + ' y vuelve a tirar.'; }
      else if (e.oca59 === 'gana') {
        a = FINAL; e.pos[p] = a; saltos.push({ a: a, tipo: 'oca' }); e.fase = 'fin'; e.ganador = p;
        return cerrar(e, p, d, desde, camino, saltos, false, txt + ': ¡la última oca le lleva al Jardín y gana!', 'jardin');
      } else { a = FINAL; e.meta[p] = true; txt += ': ¡la última oca! Pasa a la 63 y vuelve a tirar para retroceder lo que saque.'; }
      e.pos[p] = a; saltos.push({ a: a, tipo: 'oca' }); otra = true;
    } else if (t === 'puente' || t === 'dados') {
      a = (t === 'puente' ? PUENTES : DADOS)[c]; e.pos[p] = a; saltos.push({ a: a, tipo: t }); otra = true;
      txt += ': ' + (t === 'puente' ? 'de puente a puente' : 'de dados a dados') + ', ' + (a > c ? 'avanza' : 'retrocede') + ' a la ' + a + ' y vuelve a tirar.';
    } else if (t === 'laberinto') {
      e.pos[p] = 30; saltos.push({ a: 30, tipo: t }); txt += ': se pierde en el laberinto y vuelve a la 30.';
    } else if (t === 'calavera') {
      e.pos[p] = 0; saltos.push({ a: 0, tipo: t }); txt += ': ¡la calavera! Vuelve a la salida.';
    } else if (t === 'posada' || t === 'carcel' || t === 'pozo') {
      e.espera[p] = ESPERA[t]; e.motivo[p] = t;
      if (t === 'pozo') {                                                  // quien estuviera en el pozo queda libre
        var libres = [];
        for (var q = 0; q < e.n; q++) if (q !== p && e.motivo[q] === 'pozo' && e.espera[q] > 0) { e.espera[q] = 0; e.motivo[q] = ''; libres.push(q); }
        txt += ': cae en el pozo y no tirará hasta que otro caiga en él o pasen 3 turnos.';
        saltos.push({ a: c, tipo: 'pozo', libres: libres });
      } else txt += t === 'posada' ? ': se queda en la posada y pierde 1 turno.' : ': ¡a la cárcel! Pierde 2 turnos.';
    } else txt += '.';
    return cerrar(e, p, d, desde, camino, saltos, otra, txt, t);
  }

  /* cierra la jugada: anota, y pasa el turno (saltando a quien esté en la posada, el pozo o la cárcel) salvo que repita */
  function cerrar(e, p, d, desde, camino, saltos, otra, txt, t) {
    anotar(e, p, txt);
    var pasan = [];
    if (e.fase === 'jugando' && !otra) {
      var sig = e.turno;
      for (var vuelta = 0; vuelta < 50; vuelta++) {
        sig = (sig + 1) % e.n;
        if (e.espera[sig] > 0) {
          e.espera[sig]--; var mot = e.motivo[sig];
          if (!e.espera[sig]) e.motivo[sig] = '';
          pasan.push({ p: sig, motivo: mot, quedan: e.espera[sig] });
          anotar(e, sig, 'pierde el turno (' + NOMBRES[mot] + (e.espera[sig] ? ', le ' + (e.espera[sig] === 1 ? 'queda 1' : 'quedan ' + e.espera[sig]) : ', ya podrá tirar la próxima vez') + ').');
          continue;
        }
        break;
      }
      e.turno = sig;
    }
    e.nj++;
    e.ultimo = { p: p, dados: d, desde: desde, camino: camino, saltos: saltos, otra: otra && e.fase === 'jugando', tipo: t || '', txt: txt, pasan: pasan, nj: e.nj };
    return true;
  }

  /* comprueba un estado recibido (partida guardada o copia del anfitrión) */
  function restaurar(x) {
    if (!x || typeof x !== 'object') return null;
    var n = x.n | 0;
    if (n < 2 || n > 4 || [1, 2].indexOf(x.dados) < 0 || ['gana', 'rebota'].indexOf(x.oca59) < 0) return null;
    var listas = ['pos', 'espera', 'motivo', 'meta', 'tiros'];
    for (var i = 0; i < listas.length; i++) if (!Array.isArray(x[listas[i]]) || x[listas[i]].length !== n) return null;
    if (!x.pos.every(function (c) { return c === (c | 0) && c >= 0 && c <= FINAL; })) return null;
    if (!(x.turno >= 0 && x.turno < n) || ['jugando', 'fin'].indexOf(x.fase) < 0) return null;
    var e = copiar(x); if (!Array.isArray(e.hist)) e.hist = [];
    return e;
  }

  return { FINAL: FINAL, OCAS: OCAS, ESPERA: ESPERA, NOMBRES: NOMBRES, DICHOS: DICHOS, tipo: tipo, crear: crear, numDados: numDados, tirar: tirar,
    copiar: copiar, publico: copiar, restaurar: restaurar };
});

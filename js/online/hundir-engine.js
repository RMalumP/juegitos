/* js/online/hundir-engine.js — Hundir la flota: reglas, árbitro de partida e IA. Sin DOM (se prueba en Node: tests/hundir-engine.test.js).
   Lo usan los tres modos: contra la CPU y 2 jugadores en un móvil (en la propia página) y el anfitrión del modo online.

   Tablero 10×10, celdas 0..99 (fila*10 + columna). Flota clásica: 5, 4, 3, 3, 2.
   Barco: { l: longitud, r: fila, c: columna, h: true si es horizontal }.
   Partida (la autoridad): { op:{tocar,repite}, flotas:[f0,f1], listos, fase:'colocando'|'jugando'|'fin', turno, shots:[[ [celda,res]… ],[…]], hund:[[celdas…],[…]], ganador, rendido }
     shots[p] = disparos de p al rival; res: 1 agua · 2 tocado · 3 hundido.   hund[p] = celdas de los barcos rivales hundidos por p.
   publico(pt) es lo único que ve el rival: no lleva las flotas hasta que termina la partida. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.HundirEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var N = 10, LONGS = [5, 4, 3, 3, 2];
  var NOMBRES = { 5: 'Portaaviones', 4: 'Acorazado', 3: 'Crucero', 2: 'Destructor' };

  function celdas(b) { var o = []; for (var k = 0; k < b.l; k++) o.push((b.r + (b.h ? 0 : k)) * N + (b.c + (b.h ? k : 0))); return o; }
  function entero(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function dentro(b) {
    if (!b || !entero(b.l) || !entero(b.r) || !entero(b.c)) return false;
    return b.r >= 0 && b.c >= 0 && (b.h ? b.c + b.l <= N && b.r < N : b.r + b.l <= N && b.c < N);
  }
  /* ¿es una flota legal? (longitudes exactas, dentro del tablero, sin solaparse y, si tocar=false, sin tocarse ni en diagonal) */
  function validarFlota(flota, tocar) {
    if (!Array.isArray(flota) || flota.length !== LONGS.length) return false;
    var ls = flota.map(function (b) { return b && b.l; }).sort(function (a, b) { return b - a; });
    if (ls.join() !== LONGS.join()) return false;
    var dueno = {};
    for (var i = 0; i < flota.length; i++) {
      if (!dentro(flota[i])) return false;
      var cs = celdas(flota[i]);
      for (var k = 0; k < cs.length; k++) { if (dueno[cs[k]] !== undefined) return false; dueno[cs[k]] = i; }
    }
    if (!tocar) {
      for (var c in dueno) {
        var r0 = Math.floor(c / N), c0 = c % N;
        for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
          var r1 = r0 + dr, c1 = c0 + dc; if (r1 < 0 || r1 >= N || c1 < 0 || c1 >= N) continue;
          var o = dueno[r1 * N + c1]; if (o !== undefined && o !== dueno[c]) return false;
        }
      }
    }
    return true;
  }
  /* ¿cabe `b` en la flota parcial `resto` (barcos ya colocados)? Sirve para la colocación a mano. */
  function cabeEn(b, resto, tocar) {
    if (!dentro(b)) return false;
    var ocu = {}; resto.forEach(function (x) { if (x) celdas(x).forEach(function (c) { ocu[c] = true; }); });
    var cs = celdas(b);
    for (var i = 0; i < cs.length; i++) {
      if (ocu[cs[i]]) return false;
      if (!tocar) {
        var r0 = Math.floor(cs[i] / N), c0 = cs[i] % N;
        for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) { var r1 = r0 + dr, c1 = c0 + dc; if (r1 >= 0 && r1 < N && c1 >= 0 && c1 < N && ocu[r1 * N + c1]) return false; }
      }
    }
    return true;
  }
  function flotaAleatoria(rng, tocar) {
    rng = rng || Math.random;
    for (var intento = 0; intento < 500; intento++) {
      var flota = [], ok = true;
      for (var i = 0; i < LONGS.length && ok; i++) {
        var puesto = false;
        for (var t = 0; t < 200 && !puesto; t++) {
          var h = rng() < 0.5, l = LONGS[i];
          var b = { l: l, r: Math.floor(rng() * (h ? N : N - l + 1)), c: Math.floor(rng() * (h ? N - l + 1 : N)), h: h };
          if (cabeEn(b, flota, tocar)) { flota.push(b); puesto = true; }
        }
        ok = puesto;
      }
      if (ok) return flota;
    }
    throw new Error('no se pudo colocar la flota');
  }
  /* texto corto para mandar la flota por la red: "l,r,c,h;…" */
  function codificar(flota) { return flota.map(function (b) { return b.l + ',' + b.r + ',' + b.c + ',' + (b.h ? 1 : 0); }).join(';'); }
  function decodificar(txt) {
    if (typeof txt !== 'string' || txt.length > 120) return null;
    var f = txt.split(';').map(function (p) { var a = p.split(',').map(Number); return { l: a[0], r: a[1], c: a[2], h: a[3] === 1 }; });
    return f.every(function (b) { return entero(b.l) && entero(b.r) && entero(b.c); }) ? f : null;
  }

  /* ---------- árbitro ---------- */
  function crear(op) {
    op = op || {};
    return { op: { tocar: op.tocar !== false, repite: !!op.repite }, flotas: [null, null], listos: [false, false], fase: 'colocando',
      turno: op.turno === 1 ? 1 : 0, shots: [[], []], hund: [[], []], ganador: -1, rendido: false };
  }
  function colocar(pt, p, flota) {
    if (pt.fase !== 'colocando' || pt.listos[p] || !validarFlota(flota, pt.op.tocar)) return false;
    pt.flotas[p] = flota.map(function (b) { return { l: b.l, r: b.r, c: b.c, h: !!b.h }; });
    pt.listos[p] = true; if (pt.listos[0] && pt.listos[1]) pt.fase = 'jugando';
    return true;
  }
  /* dispara p a la celda idx del rival. Devuelve null si no se puede (turno ajeno, fase, repetida) o { res, hundido, fin } */
  function disparar(pt, p, idx) {
    if (pt.fase !== 'jugando' || pt.turno !== p || !entero(idx) || idx < 0 || idx >= N * N) return null;
    if (pt.shots[p].some(function (s) { return s[0] === idx; })) return null;
    var q = 1 - p, flota = pt.flotas[q], bi = -1;
    for (var i = 0; i < flota.length; i++) if (celdas(flota[i]).indexOf(idx) >= 0) bi = i;
    var res = 1, hundido = null;
    if (bi >= 0) {
      res = 2; var cs = celdas(flota[bi]);
      var todas = cs.every(function (c) { return c === idx || pt.shots[p].some(function (s) { return s[0] === c; }); });
      if (todas) { res = 3; hundido = cs; pt.hund[p].push(cs); }
    }
    pt.shots[p].push([idx, res]);
    var fin = pt.hund[p].length === flota.length;
    if (fin) { pt.fase = 'fin'; pt.ganador = p; }
    else if (!(pt.op.repite && res >= 2)) pt.turno = q;
    return { res: res, hundido: hundido, fin: fin };
  }
  function rendir(pt, p) { if (pt.fase === 'fin') return false; pt.fase = 'fin'; pt.ganador = 1 - p; pt.rendido = true; return true; }
  /* lo que ve el rival: sin flotas hasta el final */
  function publico(pt) {
    return JSON.parse(JSON.stringify({ op: pt.op, fase: pt.fase, turno: pt.turno, listos: pt.listos, shots: pt.shots, hund: pt.hund,
      ganador: pt.ganador, rendido: pt.rendido, flotas: pt.fase === 'fin' ? pt.flotas : null }));
  }
  /* reconstruye la autoridad a partir de una copia guardada (recarga del anfitrión) */
  function restaurar(copia) { return JSON.parse(JSON.stringify(copia)); }

  /* ---------- vistas para pintar (siempre a partir de lo público + mi flota) ---------- */
  /* aguas enemigas vistas por p: 0 sin disparar · 1 agua · 2 tocado · 3 hundido · 4 barco rival revelado (fin de partida) */
  function aguas(pub, p) {
    var g = Array(N * N).fill(0);
    pub.shots[p].forEach(function (s) { g[s[0]] = s[1]; });
    pub.hund[p].forEach(function (cs) { cs.forEach(function (c) { g[c] = 3; }); });
    if (pub.flotas && pub.flotas[1 - p]) pub.flotas[1 - p].forEach(function (b) { celdas(b).forEach(function (c) { if (!g[c]) g[c] = 4; }); });
    return g;
  }
  /* mi tablero: 0 agua sin tocar · 1 agua disparada · 5 barco mío · 2 barco tocado · 3 barco hundido */
  function propio(pub, flota, p) {
    var g = Array(N * N).fill(0), dueno = {};
    (flota || []).forEach(function (b, i) { celdas(b).forEach(function (c) { g[c] = 5; dueno[c] = i; }); });
    var recibidos = pub.shots[1 - p];
    recibidos.forEach(function (s) { if (g[s[0]] === 5) g[s[0]] = 2; else g[s[0]] = 1; });
    pub.hund[1 - p].forEach(function (cs) { cs.forEach(function (c) { g[c] = 3; }); });
    return g;
  }

  /* ---------- IA ---------- */
  /* vista: { g: aguas(), restantes: [longitudes sin hundir] } — lo que sabe el disparador */
  function vistaIA(pub, p) {
    var hundidas = pub.hund[p].map(function (cs) { return cs.length; }), rest = LONGS.slice();
    hundidas.forEach(function (l) { var i = rest.indexOf(l); if (i >= 0) rest.splice(i, 1); });
    return { g: aguas({ shots: pub.shots, hund: pub.hund, flotas: null }, p), restantes: rest };
  }
  function libres(g) { var o = []; for (var i = 0; i < g.length; i++) if (g[i] === 0) o.push(i); return o; }
  function elegir(lista, rng) { return lista[Math.floor(rng() * lista.length)]; }
  function vecinos(i) {
    var r = Math.floor(i / N), c = i % N, o = [];
    if (r > 0) o.push(i - N); if (r < N - 1) o.push(i + N); if (c > 0) o.push(i - 1); if (c < N - 1) o.push(i + 1);
    return o;
  }
  function iaFacil(v, rng) { return elegir(libres(v.g), rng); }
  function iaNormal(v, rng) {
    var g = v.g, hits = []; for (var i = 0; i < g.length; i++) if (g[i] === 2) hits.push(i);
    if (hits.length) {
      var cand = [];
      hits.forEach(function (h) {
        vecinos(h).forEach(function (n) {
          if (g[n] !== 0) return;
          var dir = n - h, opuesta = vecinos(h).indexOf(h - dir) >= 0 ? h - dir : -1, linea = opuesta >= 0 && g[opuesta] === 2;   // seguir la línea de dos tocados
          cand.push({ n: n, peso: linea ? 4 : 1 });
        });
      });
      if (cand.length) { var bolsa = []; cand.forEach(function (c) { for (var k = 0; k < c.peso; k++) bolsa.push(c.n); }); return elegir(bolsa, rng); }
    }
    var lib = libres(g), par = lib.filter(function (c) { return (Math.floor(c / N) + c % N) % 2 === 0; });
    return elegir(par.length ? par : lib, rng);
  }
  function iaDificil(v, rng) {
    var g = v.g, prob = Array(N * N).fill(0), hayHits = g.some(function (x) { return x === 2; });
    v.restantes.forEach(function (l) {
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) for (var h = 0; h < 2; h++) {
        var b = { l: l, r: r, c: c, h: h === 0 };
        if (!dentro(b)) continue;
        var cs = celdas(b), ok = true, toc = 0;
        for (var k = 0; k < cs.length; k++) { var x = g[cs[k]]; if (x === 1 || x === 3) { ok = false; break; } if (x === 2) toc++; }
        if (!ok || (hayHits && !toc)) continue;
        var peso = hayHits ? Math.pow(8, toc) : 1;
        for (k = 0; k < cs.length; k++) if (g[cs[k]] === 0) prob[cs[k]] += peso;
      }
    });
    var mejor = -1, lista = [];
    for (var i = 0; i < prob.length; i++) { if (g[i] !== 0) continue; if (prob[i] > mejor) { mejor = prob[i]; lista = [i]; } else if (prob[i] === mejor) lista.push(i); }
    return lista.length ? elegir(lista, rng) : elegir(libres(g), rng);
  }
  /* nivel 1 fácil · 2 normal · 3 difícil */
  function ia(nivel, vista, rng) { rng = rng || Math.random; return (nivel === 3 ? iaDificil : nivel === 2 ? iaNormal : iaFacil)(vista, rng); }

  return { N: N, LONGS: LONGS, NOMBRES: NOMBRES, celdas: celdas, dentro: dentro, validarFlota: validarFlota, cabeEn: cabeEn, flotaAleatoria: flotaAleatoria,
    codificar: codificar, decodificar: decodificar, crear: crear, colocar: colocar, disparar: disparar, rendir: rendir, publico: publico, restaurar: restaurar,
    aguas: aguas, propio: propio, vistaIA: vistaIA, ia: ia };
});

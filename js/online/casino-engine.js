/* js/online/casino-engine.js — Motor de la mesa online de Póquer Texas Hold'em (sin DOM, probado en Node: tests/casino-engine.test.js).
   (La Ruleta y el Blackjack online usan los juegos ORIGINALES: js/online/j-ruleta.js y j-blackjack.js.)
   El motor vive en el anfitrión, que es la autoridad: reparte, valida cada acción y publica solo lo que cada jugador debe ver.
   Fichas virtuales, sin dinero real. Cartas: entero 0–51, rango = c % 13 (0 = «2» … 12 = «A»), palo = ⌊c / 13⌋.
   Funciona como módulo de Node (require) y como script de navegador (window.CasinoEngine). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CasinoEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const err = motivo => ({ ok: false, error: motivo }), bien = extra => Object.assign({ ok: true }, extra || {});
  const RANGOS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], PALOS = ['♠', '♥', '♦', '♣'];
  const rango = c => c % 13, palo = c => Math.floor(c / 13);
  const nombreCarta = c => RANGOS[rango(c)] + PALOS[palo(c)];
  function mazoBarajado(rng) {
    const m = Array.from({ length: 52 }, (_, i) => i);
    for (let i = 51; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; }
    return m;
  }
  const enteroPositivo = n => Number.isInteger(n) && n > 0;

  /* ===================================================================
                              PÓQUER (Texas Hold'em)
     =================================================================== */
  const cmpArr = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
  function evalCinco(cs) {                              // 5 cartas → [categoría, desempates…]
    const rs = cs.map(rango).sort((a, b) => b - a), color = cs.every(c => palo(c) === palo(cs[0]));
    const cuenta = {}; rs.forEach(r => { cuenta[r] = (cuenta[r] || 0) + 1; });
    const grupos = Object.keys(cuenta).map(Number).sort((a, b) => cuenta[b] - cuenta[a] || b - a);
    let recta = new Set(rs).size === 5 && rs[0] - rs[4] === 4 ? rs[0] : -1;
    if (recta < 0 && new Set(rs).size === 5 && rs[0] === 12 && rs[1] === 3) recta = 3;           // rueda A-2-3-4-5
    const forma = grupos.map(g => cuenta[g]).join('');
    if (recta >= 0 && color) return [8, recta];
    if (forma === '41') return [7, grupos[0], grupos[1]];
    if (forma === '32') return [6, grupos[0], grupos[1]];
    if (color) return [5].concat(rs);
    if (recta >= 0) return [4, recta];
    if (forma === '311') return [3].concat(grupos);
    if (forma === '221') return [2].concat(grupos);
    if (forma === '2111') return [1].concat(grupos);
    return [0].concat(rs);
  }
  function mejorMano(cs) {                               // 5 a 7 cartas → la mejor combinación de 5
    let mejor = null;
    const n = cs.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const v = evalCinco([cs[a], cs[b], cs[c], cs[d], cs[e]]);
      if (!mejor || cmpArr(v, mejor) > 0) mejor = v;
    }
    return mejor;
  }
  const NOMBRES_MANO = ['Carta alta', 'Pareja', 'Doble pareja', 'Trío', 'Escalera', 'Color', 'Full', 'Póquer', 'Escalera de color'];
  const nombreMano = v => v[0] === 8 && v[1] === 12 ? 'Escalera real' : NOMBRES_MANO[v[0]];       // como en el póquer offline

  const Poker = {
    nueva(jugadores, opt) {
      const o = opt || {}, fichas = o.fichas || 1000, cg = o.ciegaG || 20;
      const s = { fase: 'espera', mano: 0, boton: -1, ciegaG: cg, ciegaP: o.ciegaP || Math.max(1, Math.floor(cg / 2)), com: [], mazo: [], bote: 0, apuestaActual: 0, minSubida: cg, turno: null, resultado: null, ganador: null,
        jug: jugadores.map(j => ({ id: j.id, nombre: j.nombre, coins: fichas, hole: [], apostado: 0, total: 0, fold: false, mostro: false, allin: false, actuo: false, fuera: false })) };
      return s;
    },
    _vivos: s => s.jug.filter(j => !j.fuera),
    _enMano: s => s.jug.filter(j => !j.fuera && !j.fold),
    _siguiente(s, i, cond) { for (let k = 1; k <= s.jug.length; k++) { const j = s.jug[(i + k) % s.jug.length]; if (cond(j)) return (i + k) % s.jug.length; } return -1; },
    _puedeActuar: j => !j.fuera && !j.fold && !j.allin,
    _poner(s, j, cant) { const c = Math.min(cant, j.coins); j.coins -= c; j.apostado += c; j.total += c; s.bote += c; if (j.coins === 0) j.allin = true; return c; },
    // Reparte una mano nueva. Devuelve false si la partida ha terminado (solo queda un jugador con fichas).
    repartir(s, rng) {
      s.jug.forEach(j => { if (j.coins <= 0) j.fuera = true; });
      const vivos = Poker._vivos(s); if (vivos.length < 2) { s.fase = 'fin'; s.ganador = vivos[0] ? vivos[0].id : null; return err('La partida ha terminado.'); }
      s.mano++; s.mazo = mazoBarajado(rng); s.com = []; s.bote = 0; s.resultado = null; s.apuestaActual = 0; s.minSubida = s.ciegaG;
      s.jug.forEach(j => { j.hole = []; j.apostado = 0; j.total = 0; j.fold = false; j.mostro = false; j.allin = false; j.actuo = false; });
      // el primer repartidor se sortea (como en el offline); luego el botón pasa al siguiente con fichas
      s.boton = Poker._siguiente(s, s.boton < 0 ? Math.floor(rng() * s.jug.length) : s.boton, j => !j.fuera);
      const dosJug = vivos.length === 2;
      const sb = dosJug ? s.boton : Poker._siguiente(s, s.boton, j => !j.fuera), bb = Poker._siguiente(s, sb, j => !j.fuera);
      for (let k = 0; k < 2; k++) s.jug.forEach(j => { if (!j.fuera) j.hole.push(s.mazo.pop()); });
      Poker._poner(s, s.jug[sb], s.ciegaP); Poker._poner(s, s.jug[bb], s.ciegaG); s.sb = sb; s.bb = bb;
      s.apuestaActual = s.ciegaG; s.fase = 'preflop';
      s.turno = Poker._siguiente(s, bb, Poker._puedeActuar);
      if (s.turno < 0 || Poker._noQuedanApuestas(s)) Poker._cerrarRonda(s);
      return bien();
    },
    _noQuedanApuestas(s) {                                // nadie más puede apostar (todos all-in salvo uno que ya igualó)
      const act = s.jug.filter(Poker._puedeActuar); if (act.length === 0) return true;
      return act.length === 1 && s.jug.filter(j => !j.fuera && !j.fold).every(j => j.allin || j.apostado >= s.apuestaActual);
    },
    _rondaCompleta(s) { return s.jug.filter(Poker._puedeActuar).every(j => j.actuo && j.apostado === s.apuestaActual); },
    opciones(s, id) {                                      // qué puede hacer el jugador al que le toca
      const i = s.jug.findIndex(j => j.id === id), j = s.jug[i];
      if (!j || s.turno !== i) return null;
      const pagar = Math.min(s.apuestaActual - j.apostado, j.coins), maxTotal = j.apostado + j.coins;
      const minSubida = Math.min(s.apuestaActual + s.minSubida, maxTotal);
      return { puedeCheck: s.apuestaActual === j.apostado, pagar, puedeSubir: maxTotal > s.apuestaActual, minSubida, maxSubida: maxTotal };
    },
    accion(s, id, a) {
      const i = s.jug.findIndex(j => j.id === id); if (i < 0) return err('No estás en la mesa.');
      if (!['preflop', 'flop', 'turn', 'river'].includes(s.fase) || s.turno !== i) return err('No es tu turno.');
      const j = s.jug[i], op = Poker.opciones(s, id), tipo = a && a.a;
      if (tipo === 'fold') { j.fold = true; j.mostro = !!a.ver; }               // `ver`: enseña sus cartas al final de la mano
      else if (tipo === 'check') { if (!op.puedeCheck) return err('No puedes pasar: hay que igualar.'); j.actuo = true; }
      else if (tipo === 'call') { if (op.puedeCheck) { j.actuo = true; } else { Poker._poner(s, j, op.pagar); j.actuo = true; } }
      else if (tipo === 'raise' || tipo === 'allin') {
        const objetivo = tipo === 'allin' ? j.apostado + j.coins : a.m;
        if (!Number.isInteger(objetivo) || objetivo > j.apostado + j.coins) return err('Cantidad no válida.');
        if (tipo === 'allin' && objetivo <= s.apuestaActual) { Poker._poner(s, j, j.coins); j.actuo = true; Poker._tras(s, i); return bien(); }   // all-in corto: iguala con lo que le queda (como en el offline)
        if (objetivo <= s.apuestaActual) return err('Hay que subir más que la apuesta actual.');
        const todo = objetivo === j.apostado + j.coins;
        if (objetivo < s.apuestaActual + s.minSubida && !todo) return err('La subida mínima es de ' + (s.apuestaActual + s.minSubida) + '.');
        const subida = objetivo - s.apuestaActual;
        Poker._poner(s, j, objetivo - j.apostado);
        if (subida >= s.minSubida) s.minSubida = subida;     // una subida completa fija la nueva subida mínima (un all-in corto no la cambia)
        s.jug.forEach(o => { if (o !== j && Poker._puedeActuar(o)) o.actuo = false; });     // todos los demás deben responder a la nueva apuesta
        s.apuestaActual = Math.max(s.apuestaActual, j.apostado); j.actuo = true;
      } else return err('Acción no válida.');
      Poker._tras(s, i); return bien();
    },
    _tras(s, i) {
      const enMano = Poker._enMano(s);
      if (enMano.length === 1) { Poker._ganaSolo(s, enMano[0]); return; }
      if (Poker._rondaCompleta(s) || Poker._noQuedanApuestas(s)) { Poker._cerrarRonda(s); return; }
      s.turno = Poker._siguiente(s, i, Poker._puedeActuar);
    },
    _cerrarRonda(s) {
      s.jug.forEach(j => { j.apostado = 0; j.actuo = false; }); s.apuestaActual = 0; s.minSubida = s.ciegaG;
      const orden = ['preflop', 'flop', 'turn', 'river'], k = orden.indexOf(s.fase);
      if (k === 3 || (Poker._enMano(s).filter(Poker._puedeActuar).length < 2 && s.fase !== 'showdown')) {      // river terminado o nadie más puede apostar: se reparte lo que falte y se resuelve
        while (s.com.length < 5) s.com.push(s.mazo.pop());
        Poker._showdown(s); return;
      }
      s.fase = orden[k + 1]; s.mazo.pop();                                       // se quema una carta
      const n = s.fase === 'flop' ? 3 : 1; for (let t = 0; t < n; t++) s.com.push(s.mazo.pop());
      s.turno = Poker._siguiente(s, s.boton, Poker._puedeActuar);
      if (s.turno < 0) Poker._cerrarRonda(s);
    },
    _ganaSolo(s, j) { j.coins += s.bote; s.resultado = { motivo: 'todos se retiran', botes: [{ cantidad: s.bote, ganadores: [j.id] }], manos: {}, ganadores: [j.id], ganancias: { [j.id]: s.bote } }; s.bote = 0; s.fase = 'showdown'; s.turno = null; },
    _showdown(s) {
      const candidatos = Poker._enMano(s), manos = {}, niveles = [...new Set(s.jug.filter(j => j.total > 0).map(j => j.total))].sort((a, b) => a - b);
      candidatos.forEach(j => { const v = mejorMano(j.hole.concat(s.com)); manos[j.id] = { valor: v, nombre: nombreMano(v), hole: j.hole.slice() }; });
      const botes = [], ganancias = {}, cobra = (j, n) => { j.coins += n; ganancias[j.id] = (ganancias[j.id] || 0) + n; }; let previo = 0;
      for (const nivel of niveles) {                         // bote principal y botes secundarios según lo aportado por cada uno
        const aport = s.jug.reduce((t, j) => t + Math.max(0, Math.min(j.total, nivel) - previo), 0);
        const elegibles = candidatos.filter(j => j.total >= nivel);
        if (aport > 0 && elegibles.length) {
          let mejor = null, gan = [];
          elegibles.forEach(j => { const c = mejor ? cmpArr(manos[j.id].valor, mejor) : 1; if (c > 0) { mejor = manos[j.id].valor; gan = [j]; } else if (c === 0) gan.push(j); });
          const parte = Math.floor(aport / gan.length); let resto = aport - parte * gan.length;
          const primero = Poker._siguiente(s, s.boton, j => gan.includes(j));           // la ficha suelta, al primero a la izquierda del botón
          gan.forEach(j => cobra(j, parte));
          if (resto) { cobra(s.jug[primero], resto); resto = 0; }
          botes.push({ cantidad: aport, ganadores: gan.map(j => j.id) });
        } else if (aport > 0) { const d = candidatos[0]; if (d) cobra(d, aport); }
        previo = nivel;
      }
      const ganadores = [...new Set(botes.flatMap(b => b.ganadores))];
      s.resultado = { motivo: 'enfrentamiento', botes, manos: Object.fromEntries(Object.entries(manos).map(([id, m]) => [id, { nombre: m.nombre, hole: m.hole }])), ganadores, ganancias };
      s.bote = 0; s.fase = 'showdown'; s.turno = null;
    },
    saltar(s) { if (s.turno === null || s.turno < 0) return err('No hay turno.'); const op = Poker.opciones(s, s.jug[s.turno].id); return Poker.accion(s, s.jug[s.turno].id, { a: op.puedeCheck ? 'check' : 'fold' }); },
    // Vista pública: las cartas privadas solo se ven al acabar la mano: las de quienes llegan al enfrentamiento y las de quien se retiró enseñándolas.
    vista(s) {
      const v = JSON.parse(JSON.stringify(s)); delete v.mazo;
      v.jug.forEach(j => { j.nCartas = j.hole.length; if (!(s.fase === 'showdown' && s.resultado && (s.resultado.manos[j.id] || (j.fold && j.mostro)))) delete j.hole; });
      return v;
    }
  };

  return { rango, palo, nombreCarta, RANGOS, PALOS, mazoBarajado, mejorMano, evalCinco, cmpArr, NOMBRES_MANO, nombreMano, Poker };
});

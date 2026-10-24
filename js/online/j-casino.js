/* js/online/j-casino.js — Mesas online de Ruleta (2–6), Blackjack (2–4) y Póquer Texas Hold'em (2–6).
   El anfitrión ejecuta el motor (js/online/casino-engine.js, con tests) y publica lo que cada jugador debe ver: `mesa` (público) y, en el póquer, las cartas
   privadas de cada uno por su canal privado (`rol`). Los jugadores solo mandan acciones («apostar», «pedir», «subir 40»…); el anfitrión las valida con el
   motor. Si el anfitrión recarga la página, recupera la mesa desde su copia guardada. Fichas virtuales, sin dinero real. */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala, CE = window.CasinoEngine, esc = L.esc, mk = L.mk;
  var $ = function (id) { return document.getElementById(id); };
  var JUEGOS = ['blackjack', 'poker'];
  var st = { s: null, ronda: -1, ficha: 5, subida: 0, sigT: null, fasePrev: {} };
  var en = function (j) { return S.activo && S.juego === j; };
  var jugando = function (j) { return en(j) && (S.estado.phase === 'jugando' || S.estado.phase === 'fin') && !!S.estado.mesa; };
  function rng() { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }

  /* ---------- cartas ---------- */
  function carta(c, oculta) {
    if (c === null || c === undefined || oculta) return mk('span', 'olCarta atras', '🂠');
    var p = CE.palo(c), roja = p === 1 || p === 2;
    return mk('span', 'olCarta' + (roja ? ' roja' : ''), CE.RANGOS[CE.rango(c)] + CE.PALOS[p]);
  }
  function mano(cs, n) { var d = mk('span', 'olMano'); (cs || []).forEach(function (c) { d.appendChild(carta(c)); }); for (var i = (cs || []).length; i < (n || 0); i++) d.appendChild(mk('span', 'olCarta vacia', '')); return d; }
  function fichas(n) { return '<b>' + n + '</b> 🪙'; }

  /* ---------- publicar (anfitrión) ---------- */
  function vista(j) { var E = CE[j === 'ruleta' ? 'Ruleta' : j === 'blackjack' ? 'Blackjack' : 'Poker']; return E.vista(st.s); }
  function guardar() { S.guardarExtra({ juego: S.juego, eng: st.s }); }
  function holes() { // póquer: cada jugador recibe sus dos cartas por su canal privado
    var s = st.s; if (S.juego !== 'poker' || !s) return Promise.resolve();
    return Promise.all(s.jug.filter(function (j) { return j.id !== S.uid; }).map(function (j) { return S.enviar(j.id, { tipo: 'rol', hole: j.hole }); }));
  }
  function publicar(conHoles, extra) {
    guardar();
    return (conHoles ? holes() : Promise.resolve()).then(function () {
      return S.enviar('todos', Object.assign({ tipo: 'estado', mesa: vista(S.juego) }, extra || {}));
    }).catch(function () {});
  }
  function programarSiguiente(ms) {
    clearTimeout(st.sigT);
    st.sigT = setTimeout(function () { if (S.host && S.activo) siguiente(); }, ms);
  }
  function siguiente() {
    var s = st.s, j = S.juego; if (!s) return;
    if (j === 'ruleta') { CE.Ruleta.siguiente(s); publicar(); }
    else if (j === 'blackjack') { CE.Blackjack.siguiente(s); publicar(); }
    else if (j === 'poker') { var r = CE.Poker.repartir(s, rng); if (!r.ok && s.fase === 'fin') publicar(false, { phase: 'fin', resultado: 'Fin de la partida' }); else publicar(true); }
  }

  /* ---------- acciones: de los invitados (por mensaje) y del propio anfitrión (directas) ---------- */
  function ejecutar(id, m) {
    var s = st.s, j = S.juego, r = { ok: false, error: 'No válido' }; if (!s || !m) return r;
    if (j === 'ruleta') {
      var R = CE.Ruleta;
      if (m.a === 'apostar') r = R.apostar(s, id, { t: m.t, v: m.v, m: m.m });
      else if (m.a === 'limpiar') r = R.limpiar(s, id);
      else if (m.a === 'listo') { r = R.listo(s, id, m.v !== false); if (r.ok && R.todosListos(s)) { publicar(); setTimeout(function () { if (S.host && st.s === s && s.fase === 'apuestas') { R.girar(s, rng); publicar(); programarSiguiente(12000); } }, 500); return r; } }
      else if (m.a === 'girar' && id === S.uid) { r = R.girar(s, rng); if (r.ok) { publicar(); programarSiguiente(12000); return r; } }
    } else if (j === 'blackjack') {
      var B = CE.Blackjack;
      if (m.a === 'apostar') { r = B.apostar(s, id, m.m); if (r.ok && B.listosParaRepartir(s)) { B.repartir(s, rng); if (s.fase === 'resultado') programarSiguiente(10000); } }
      else if (m.a === 'quitar') r = B.quitarApuesta(s, id);
      else if (m.a === 'repartir' && id === S.uid) { r = B.repartir(s, rng, true); if (s.fase === 'resultado') programarSiguiente(10000); }
      else if (['pedir', 'plantar', 'doblar'].indexOf(m.a) >= 0) { r = B.accion(s, id, m.a); if (s.fase === 'resultado') programarSiguiente(10000); }
      else if (m.a === 'saltar' && id === S.uid) { r = B.saltar(s); if (s.fase === 'resultado') programarSiguiente(10000); }
    } else if (j === 'poker') {
      var P = CE.Poker;
      if (['fold', 'check', 'call', 'raise', 'allin'].indexOf(m.a) >= 0) r = P.accion(s, id, { a: m.a, m: m.m });
      else if (m.a === 'saltar' && id === S.uid) r = P.saltar(s);
      if (r.ok && s.fase === 'showdown') programarSiguiente(14000);
    }
    if (r.ok) publicar();
    return r;
  }
  function alMensaje(m) {
    if (!S.host || !JUEGOS.some(jugando) || m.tipo !== 'accion') return;
    var r = ejecutar(m.de, m);
    if (!r.ok && r.error) S.enviar(m.de, { tipo: 'evento', k: 'aviso', texto: r.error }).catch(function () {});
  }
  function actuar(m) {                                   // desde mi propia interfaz
    if (S.host) { var r = ejecutar(S.uid, m); if (!r.ok && r.error) S.toast(r.error); }
    else S.enviar('host', Object.assign({ tipo: 'accion' }, m)).catch(function (e) { S.toast(e.message); });
  }

  /* ---------- interfaz ---------- */
  function boton(txt, cls, fn, dis) { var b = L.boton(txt, cls || '', fn); b.className = 'olB ' + (cls || ''); b.disabled = !!dis; return b; }
  function mesaEl(j) {
    var win = $(S.JUEGOS[j].winId); if (!win) return null;
    var o = win.querySelector('.olMesa[data-j="' + j + '"]');
    if (!o) { o = mk('div', 'olMesa'); o.setAttribute('data-j', j); win.appendChild(o); }
    return o;
  }
  function yoJ(s) { return s.jug && (Array.isArray(s.jug) ? s.jug.filter(function (x) { return x.id === S.uid; })[0] : s.jug[S.uid]); }
  function cabecera(titulo, s) {
    var d = mk('div', 'olMCab'), yo = yoJ(s);
    d.innerHTML = '<span>' + titulo + ' · Sala «' + esc(S.sala) + '»</span><span>' + (yo ? 'Tus fichas: ' + fichas(yo.coins) : '') + '</span>';
    return d;
  }
  function pie(s) {
    var d = mk('div', 'olMPie');
    if (S.host) d.appendChild(boton('↩ Lobby', '', function () { if (confirm('¿Volver al lobby? Se pierde la mesa actual.')) { clearTimeout(st.sigT); st.s = null; L.volverAlLobby(['mesa', 'resultado']); } }));
    return d;
  }

  /* ----- ruleta ----- */
  var ROJO = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  function etiquetaApuesta(a) { return { pleno: 'Pleno ' + a.v, color: a.v === 'rojo' ? '🔴 Rojo' : '⚫ Negro', paridad: a.v === 'par' ? 'Par' : 'Impar', mitad: a.v === 'falta' ? '1–18' : '19–36', docena: a.v + 'ª docena', columna: a.v + 'ª columna' }[a.t]; }
  function pintarRuleta(o, s) {
    var yo = s.jug[S.uid], enApuestas = s.fase === 'apuestas';
    o.appendChild(cabecera('🎯 Ruleta', s));
    var res = mk('div', 'olRes');
    if (s.resultado) res.innerHTML = '<span class="olBola ' + s.resultado.color + '">' + s.resultado.n + '</span><span>Ha salido el <b>' + s.resultado.n + '</b> (' + s.resultado.color + ')</span>';
    else res.innerHTML = '<span class="olBola vacia">?</span><span>Haced vuestras apuestas</span>';
    o.appendChild(res);
    var h = mk('div', 'olHist'); s.hist.forEach(function (n) { h.appendChild(mk('span', 'olBolaM ' + CE.colorNum(n), String(n))); }); o.appendChild(h);
    if (yo) {
      var total = yo.apuestas.reduce(function (t, a) { return t + a.m; }, 0), libre = yo.coins - total;
      if (enApuestas && !yo.listo) {
        var fr = mk('div', 'olFichas'); [1, 5, 25, 100].forEach(function (f) { var b = boton(String(f), st.ficha === f ? 'on' : '', function () { st.ficha = f; pintar(); }); fr.appendChild(b); });
        o.appendChild(mk('div', 'olSub', 'Ficha: ' + st.ficha + ' · libres ' + libre)); o.appendChild(fr);
        var cuadro = mk('div', 'olRul');
        var cel = function (txt, a, cls) { var b = mk('button', 'olC ' + (cls || ''), txt); b.onclick = function () { actuar({ a: 'apostar', t: a.t, v: a.v, m: Math.min(st.ficha, libre) }); }; b.disabled = libre <= 0; return b; };
        cuadro.appendChild(cel('0', { t: 'pleno', v: 0 }, 'verde z'));
        for (var n = 1; n <= 36; n++) cuadro.appendChild(cel(String(n), { t: 'pleno', v: n }, ROJO.has(n) ? 'rojo' : 'negro'));
        o.appendChild(cuadro);
        var ext = mk('div', 'olExt');
        [['1ª doc.', { t: 'docena', v: 1 }], ['2ª doc.', { t: 'docena', v: 2 }], ['3ª doc.', { t: 'docena', v: 3 }], ['Col 1', { t: 'columna', v: 1 }], ['Col 2', { t: 'columna', v: 2 }], ['Col 3', { t: 'columna', v: 3 }],
          ['1–18', { t: 'mitad', v: 'falta' }], ['Par', { t: 'paridad', v: 'par' }], ['🔴 Rojo', { t: 'color', v: 'rojo' }], ['⚫ Negro', { t: 'color', v: 'negro' }], ['Impar', { t: 'paridad', v: 'impar' }], ['19–36', { t: 'mitad', v: 'pasa' }]].forEach(function (x) { ext.appendChild(cel(x[0], x[1], 'ext')); });
        o.appendChild(ext);
      }
      var mis = mk('div', 'olMis', yo.apuestas.length ? '<b>Tus apuestas:</b> ' + yo.apuestas.map(function (a) { return etiquetaApuesta(a) + ' ' + a.m; }).join(' · ') : (enApuestas ? 'Aún no has apostado.' : 'No apostaste.')); o.appendChild(mis);
      if (enApuestas) {
        var ac = mk('div', 'olFichas');
        if (!yo.listo) { ac.appendChild(boton('🧹 Limpiar', '', function () { actuar({ a: 'limpiar' }); }, !yo.apuestas.length)); ac.appendChild(boton('✔ Listo', 'ok', function () { actuar({ a: 'listo' }); })); }
        else ac.appendChild(boton('⏳ Esperando a los demás (deshacer)', '', function () { actuar({ a: 'listo', v: false }); }));
        o.appendChild(ac);
      }
    }
    var jug = mk('div', 'olJugs');
    s.orden.forEach(function (id) { var j = s.jug[id], neto = s.resultado ? s.resultado.pagos[id] : null; jug.appendChild(mk('div', 'olJ2' + (id === S.uid ? ' yo' : ''), '<span>' + esc(j.nombre) + (enApuestas && j.listo ? ' ✔' : '') + '</span><span>' + fichas(j.coins) + (neto !== null && neto !== undefined ? ' <i class="' + (neto >= 0 ? 'g' : 'p') + '">' + (neto >= 0 ? '+' : '') + neto + '</i>' : '') + '</span>')); });
    o.appendChild(jug);
    if (S.host) { var hb = mk('div', 'olMPie'); if (enApuestas) hb.appendChild(boton('🎡 Girar ya', 'ok', function () { actuar({ a: 'girar' }); })); else hb.appendChild(boton('▶ Siguiente ronda', 'ok', siguiente)); o.appendChild(hb); }
  }

  /* ----- blackjack ----- */
  function pintarBlackjack(o, s) {
    var yo = yoJ(s), fase = s.fase;
    o.appendChild(cabecera('🎰 Blackjack', s));
    var banca = mk('div', 'olBanca'); banca.appendChild(mk('div', 'olSub', 'BANCA' + (fase === 'resultado' ? ' · ' + s.resultado.banca + (s.resultado.bancaPasa ? ' (se pasa)' : '') : '')));
    banca.appendChild(mano(s.banca, 2)); o.appendChild(banca);
    var mesa = mk('div', 'olJugs');
    s.orden.forEach(function (id) {
      var j = s.jug[id], v = j.mano.length ? CE.valorMano(j.mano).total : '', neto = s.resultado ? s.resultado.pagos[id] : null;
      var f = mk('div', 'olJ2 col' + (id === S.uid ? ' yo' : '') + (s.turno === id ? ' turno' : ''));
      f.appendChild(mk('div', 'olJTop', '<span>' + (s.turno === id ? '👉 ' : '') + esc(j.nombre) + '</span><span>' + fichas(j.coins) + '</span>'));
      var m = mk('div', 'olJMano'); m.appendChild(mano(j.mano)); m.appendChild(mk('span', 'olVal', (v !== '' ? v : '') + (j.estado === 'pasa' ? ' · se pasa' : j.estado === 'blackjack' ? ' · BLACKJACK' : j.estado === 'planta' && fase === 'turnos' ? ' · plantado' : ''))); f.appendChild(m);
      f.appendChild(mk('div', 'olApu', j.apuesta ? 'Apuesta: <b>' + j.apuesta + '</b>' + (j.doblada ? ' (doblada)' : '') + (neto !== null && neto !== undefined ? ' → <i class="' + (neto >= 0 ? 'g' : 'p') + '">' + (neto > 0 ? 'gana ' + neto : neto === 0 ? 'empata' : 'pierde ' + (-neto)) + '</i>' : '') : (j.coins <= 0 ? 'Sin fichas' : '')));
      mesa.appendChild(f);
    });
    o.appendChild(mesa);
    if (yo && fase === 'apuestas') {
      var fr = mk('div', 'olFichas'); [1, 5, 25, 100].forEach(function (f) { fr.appendChild(boton('+' + f, '', function () { actuar({ a: 'apostar', m: Math.min(yo.coins, (yo.apuesta || 0) + f) }); }, yo.coins <= yo.apuesta)); });
      fr.appendChild(boton('🧹 Quitar', '', function () { actuar({ a: 'quitar' }); }, !yo.apuesta));
      o.appendChild(mk('div', 'olSub', yo.coins <= 0 ? 'Te has quedado sin fichas.' : 'Tu apuesta: ' + (yo.apuesta || 0) + ' (la ronda empieza cuando todos han apostado)')); if (yo.coins > 0) o.appendChild(fr);
    }
    if (yo && fase === 'turnos' && s.turno === S.uid) {
      var ac = mk('div', 'olFichas'); ac.appendChild(boton('Pedir', '', function () { actuar({ a: 'pedir' }); })); ac.appendChild(boton('Plantarme', 'ok', function () { actuar({ a: 'plantar' }); }));
      ac.appendChild(boton('Doblar', '', function () { actuar({ a: 'doblar' }); }, yo.mano.length !== 2 || yo.coins < yo.apuesta * 2)); o.appendChild(ac);
    } else if (fase === 'turnos') o.appendChild(mk('div', 'olSub', 'Turno de ' + esc(s.jug[s.turno].nombre)));
    if (S.host) {
      var hb = mk('div', 'olMPie');
      if (fase === 'apuestas') hb.appendChild(boton('▶ Repartir ya', 'ok', function () { actuar({ a: 'repartir' }); }));
      if (fase === 'turnos' && s.turno !== S.uid) hb.appendChild(boton('⏭ Saltar jugador', '', function () { actuar({ a: 'saltar' }); }));
      if (fase === 'resultado') hb.appendChild(boton('▶ Siguiente ronda', 'ok', siguiente));
      o.appendChild(hb);
    }
  }

  /* ----- póquer ----- */
  function pintarPoker(o, s) {
    var yo = yoJ(s), i = s.jug.findIndex(function (x) { return x.id === S.uid; }), turnoMio = s.turno === i && i >= 0;
    o.appendChild(cabecera('♠️ Póquer · mano ' + s.mano, s));
    var com = mk('div', 'olComun'); com.appendChild(mano(s.com, 5)); com.appendChild(mk('div', 'olBote', 'Bote: ' + fichas(s.bote) + ' · ' + ({ preflop: 'preflop', flop: 'flop', turn: 'turn', river: 'river', showdown: 'enfrentamiento', fin: 'fin' }[s.fase] || ''))); o.appendChild(com);
    var mesa = mk('div', 'olJugs');
    s.jug.forEach(function (j, k) {
      var rev = s.resultado && s.resultado.manos && s.resultado.manos[j.id], gana = s.resultado && s.resultado.ganadores.indexOf(j.id) >= 0;
      var f = mk('div', 'olJ2 col' + (j.id === S.uid ? ' yo' : '') + (s.turno === k ? ' turno' : '') + (j.fold || j.fuera ? ' off' : '') + (gana ? ' gana' : ''));
      f.appendChild(mk('div', 'olJTop', '<span>' + (s.turno === k ? '👉 ' : '') + (s.boton === k ? '🅓 ' : '') + esc(j.nombre) + (gana ? ' 🏆' : '') + '</span><span>' + fichas(j.coins) + '</span>'));
      var m = mk('div', 'olJMano');
      if (j.id === S.uid && S.estado.phase !== 'fin') { var h = S.host ? (st.s && st.s.jug[k].hole) : (S.rol && S.rol.hole); m.appendChild(h && h.length ? mano(h) : mano([], 2)); }
      else if (rev && rev.hole) m.appendChild(mano(rev.hole));
      else if (!j.fuera && !j.fold && j.nCartas) m.appendChild(mano([null, null]));
      m.appendChild(mk('span', 'olVal', (j.fuera ? 'Eliminado' : j.fold ? 'Retirado' : j.allin ? 'ALL-IN' : '') + (rev ? ' · ' + rev.nombre : '') + (j.apostado ? ' · apuesta ' + j.apostado : '')));
      f.appendChild(m); mesa.appendChild(f);
    });
    o.appendChild(mesa);
    if (s.resultado) o.appendChild(mk('div', 'olFin', s.resultado.botes.map(function (b) { return '🏆 ' + b.ganadores.map(function (id) { var j = s.jug.filter(function (x) { return x.id === id; })[0]; return esc(j ? j.nombre : '?'); }).join(' y ') + ' gana ' + b.cantidad; }).join('<br>')));
    if (s.fase === 'fin') o.appendChild(mk('div', 'olFin', '🏁 Fin de la partida' + (s.ganador ? ': gana ' + esc((s.jug.filter(function (x) { return x.id === s.ganador; })[0] || {}).nombre || '') : '')));
    if (turnoMio) {
      var op = S.host ? CE.Poker.opciones(st.s, S.uid) : opcionesDe(s, i);
      if (op) {
        if (!st.subida || st.subida < op.minSubida || st.subida > op.maxSubida) st.subida = op.minSubida;
        var ac = mk('div', 'olFichas');
        ac.appendChild(boton('Retirarme', 'mal', function () { actuar({ a: 'fold' }); }));
        ac.appendChild(boton(op.puedeCheck ? 'Pasar' : 'Igualar ' + op.pagar, 'ok', function () { actuar({ a: op.puedeCheck ? 'check' : 'call' }); }));
        ac.appendChild(boton('All-in (' + (yo.apostado + yo.coins) + ')', '', function () { actuar({ a: 'allin' }); }));
        o.appendChild(ac);
        if (op.puedeSubir) {
          var sub = mk('div', 'olSubir'), rg = mk('input'); rg.type = 'range'; rg.min = op.minSubida; rg.max = op.maxSubida; rg.value = st.subida;
          var num = mk('span', 'olSubN', 'Subir a ' + st.subida); rg.oninput = function () { st.subida = +rg.value; num.textContent = 'Subir a ' + st.subida; };
          sub.appendChild(rg); sub.appendChild(num); sub.appendChild(boton('Subir', '', function () { actuar({ a: 'raise', m: st.subida }); })); o.appendChild(sub);
        }
      }
    } else if (s.turno !== null && s.turno >= 0 && s.fase !== 'showdown') o.appendChild(mk('div', 'olSub', 'Turno de ' + esc(s.jug[s.turno].nombre)));
    if (S.host) {
      var hb = mk('div', 'olMPie');
      if (s.fase === 'showdown') hb.appendChild(boton('▶ Siguiente mano', 'ok', siguiente));
      else if (s.turno !== null && s.turno >= 0 && s.turno !== i) hb.appendChild(boton('⏭ Saltar jugador', '', function () { actuar({ a: 'saltar' }); }));
      o.appendChild(hb);
    }
  }
  // Los invitados calculan sus opciones con los datos públicos (el anfitrión vuelve a validar todo).
  function opcionesDe(s, i) {
    var j = s.jug[i], pagar = Math.min(s.apuestaActual - j.apostado, j.coins), maxTotal = j.apostado + j.coins;
    return { puedeCheck: s.apuestaActual === j.apostado, pagar: pagar, puedeSubir: maxTotal > s.apuestaActual, minSubida: Math.min(s.apuestaActual + s.minSubida, maxTotal), maxSubida: maxTotal };
  }

  function pintar() {
    JUEGOS.forEach(function (j) {
      var o = mesaEl(j); if (!o) return;
      var ver = jugando(j);
      o.style.display = ver ? 'flex' : 'none';
      if (!ver) return;
      var y = o.scrollTop; o.innerHTML = '';
      var s = S.host && st.s ? vista(j) : S.estado.mesa;
      if (!s) return;
      if (j === 'ruleta') pintarRuleta(o, s); else if (j === 'blackjack') pintarBlackjack(o, s); else pintarPoker(o, s);
      o.appendChild(pie(s)); o.scrollTop = y;
    });
  }

  /* ---------- lobby ---------- */
  function opciones(j) {
    return function (host, est) {
      var op = est.op || {}, nodos = [];
      if (!host) return [mk('div', 'olNota', 'Fichas iniciales: <b>' + (op.fichas || 1000) + '</b>' + (j === 'poker' ? ' · ciegas <b>' + (op.ciegaP || 10) + '/' + (op.ciegaG || 20) + '</b>' : '') + '.')];
      var f = mk('div', 'olOp'); f.appendChild(mk('span', '', 'Fichas:'));
      [500, 1000, 5000].forEach(function (n) { f.appendChild(L.boton(String(n), (op.fichas || 1000) === n ? 'on' : '', function () { S.enviar('todos', { tipo: 'estado', op: Object.assign({}, op, { fichas: n }) }).catch(function () {}); })); });
      nodos.push(f);
      if (j === 'poker') {
        var c = mk('div', 'olOp'); c.appendChild(mk('span', '', 'Ciegas:'));
        [[5, 10], [10, 20], [25, 50], [50, 100]].forEach(function (x) { c.appendChild(L.boton(x[0] + '/' + x[1], (op.ciegaG || 20) === x[1] ? 'on' : '', function () { S.enviar('todos', { tipo: 'estado', op: Object.assign({}, op, { ciegaP: x[0], ciegaG: x[1] }) }).catch(function () {}); })); });
        nodos.push(c);
      }
      nodos.push(mk('div', 'olNota', 'Fichas virtuales para jugar entre amigos, sin dinero real.'));
      return nodos;
    };
  }
  function preparar(j) {
    return function (ctx) {
      var op = ctx.op || {}, jugadores = ctx.jug.map(function (p) { return { id: p.id, nombre: p.nombre }; }), o = { fichas: op.fichas || 1000, ciegaP: op.ciegaP, ciegaG: op.ciegaG };
      clearTimeout(st.sigT);
      if (j === 'ruleta') st.s = CE.Ruleta.nueva(jugadores, o);
      else if (j === 'blackjack') st.s = CE.Blackjack.nueva(jugadores, o);
      else { st.s = CE.Poker.nueva(jugadores, o); CE.Poker.repartir(st.s, rng); }
      guardar();
      var roles = {}; if (j === 'poker') st.s.jug.forEach(function (x) { roles[x.id] = { hole: x.hole }; });
      return { estado: { mesa: vista(j), resultado: null, op: op }, roles: roles };
    };
  }
  function alEstado(est) {
    var j = S.juego; if (JUEGOS.indexOf(j) < 0) return;
    if (S.host && est.phase === 'jugando' && !st.s) {                     // el anfitrión recargó: recupera la mesa guardada
      var ex = S.leerExtra(); if (ex && ex.eng) { st.s = ex.eng; publicar(true); }
    }
    if (est.phase === 'lobby') { st.s = null; clearTimeout(st.sigT); }
    pintar();
  }
  function alCerrar() { st.s = null; clearTimeout(st.sigT); pintar(); }
  function alEvento(m) { if (m.k === 'aviso' && JUEGOS.indexOf(S.juego) >= 0) S.toast(m.texto); }

  JUEGOS.forEach(function (j) { L.registrar(j, { opciones: opciones(j), preparar: preparar(j), alEstado: alEstado, alCerrar: alCerrar }); });
  S.on('msg', alMensaje); S.on('rol', pintar); S.on('jug', pintar); S.on('evento', alEvento);
})();

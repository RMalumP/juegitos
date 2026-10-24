/* js/online/j-casino.js — Mesa online de Póquer Texas Hold'em (2–6). (La Ruleta y el Blackjack online usan los juegos originales: j-ruleta.js y j-blackjack.js.)
   El anfitrión ejecuta el motor (js/online/casino-engine.js, con tests) y publica lo que cada jugador debe ver: `mesa` (público) y, en el póquer, las cartas
   privadas de cada uno por su canal privado (`rol`). Los jugadores solo mandan acciones («apostar», «pedir», «subir 40»…); el anfitrión las valida con el
   motor. Si el anfitrión recarga la página, recupera la mesa desde su copia guardada. Fichas virtuales, sin dinero real. */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala, CE = window.CasinoEngine, esc = L.esc, mk = L.mk;
  var $ = function (id) { return document.getElementById(id); };
  var JUEGOS = ['poker'];
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
  function vista() { return CE.Poker.vista(st.s); }
  function guardar() { S.guardarExtra({ juego: S.juego, eng: st.s }); }
  function holes() { // póquer: cada jugador recibe sus dos cartas por su canal privado
    var s = st.s; if (S.juego !== 'poker' || !s) return Promise.resolve();
    return Promise.all(s.jug.filter(function (j) { return j.id !== S.uid; }).map(function (j) { return S.enviar(j.id, { tipo: 'rol', hole: j.hole }); }));
  }
  function publicar(conHoles, extra) {
    guardar();
    return (conHoles ? holes() : Promise.resolve()).then(function () {
      return S.enviar('todos', Object.assign({ tipo: 'estado', mesa: vista() }, extra || {}));
    }).catch(function () {});
  }
  function programarSiguiente(ms) {
    clearTimeout(st.sigT);
    st.sigT = setTimeout(function () { if (S.host && S.activo) siguiente(); }, ms);
  }
  function siguiente() {
    var s = st.s; if (!s) return;
    var r = CE.Poker.repartir(s, rng); if (!r.ok && s.fase === 'fin') publicar(false, { phase: 'fin', resultado: 'Fin de la partida' }); else publicar(true);
  }

  /* ---------- acciones: de los invitados (por mensaje) y del propio anfitrión (directas) ---------- */
  function ejecutar(id, m) {
    var s = st.s, r = { ok: false, error: 'No válido' }; if (!s || !m) return r;
    var P = CE.Poker;
    if (['fold', 'check', 'call', 'raise', 'allin'].indexOf(m.a) >= 0) r = P.accion(s, id, { a: m.a, m: m.m });
    else if (m.a === 'saltar' && id === S.uid) r = P.saltar(s);
    if (r.ok && s.fase === 'showdown') programarSiguiente(14000);
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
      var s = S.host && st.s ? vista() : S.estado.mesa;
      if (!s) return;
      pintarPoker(o, s);
      o.appendChild(pie(s)); o.scrollTop = y;
    });
  }

  /* ---------- lobby ---------- */
  function opciones(host, est) {
    var op = est.op || {}, nodos = [];
    if (!host) return [mk('div', 'olNota', 'Fichas iniciales: <b>' + (op.fichas || 1000) + '</b> · ciegas <b>' + (op.ciegaP || 10) + '/' + (op.ciegaG || 20) + '</b>.')];
    var f = mk('div', 'olOp'); f.appendChild(mk('span', '', 'Fichas:'));
    [500, 1000, 5000].forEach(function (n) { f.appendChild(L.boton(String(n), (op.fichas || 1000) === n ? 'on' : '', function () { S.enviar('todos', { tipo: 'estado', op: Object.assign({}, op, { fichas: n }) }).catch(function () {}); })); });
    nodos.push(f);
    var c = mk('div', 'olOp'); c.appendChild(mk('span', '', 'Ciegas:'));
    [[5, 10], [10, 20], [25, 50], [50, 100]].forEach(function (x) { c.appendChild(L.boton(x[0] + '/' + x[1], (op.ciegaG || 20) === x[1] ? 'on' : '', function () { S.enviar('todos', { tipo: 'estado', op: Object.assign({}, op, { ciegaP: x[0], ciegaG: x[1] }) }).catch(function () {}); })); });
    nodos.push(c);
    nodos.push(mk('div', 'olNota', 'Fichas virtuales para jugar entre amigos, sin dinero real.'));
    return nodos;
  }
  function preparar(ctx) {
    var op = ctx.op || {}, jugadores = ctx.jug.map(function (p) { return { id: p.id, nombre: p.nombre }; });
    clearTimeout(st.sigT);
    st.s = CE.Poker.nueva(jugadores, { fichas: op.fichas || 1000, ciegaP: op.ciegaP, ciegaG: op.ciegaG }); CE.Poker.repartir(st.s, rng); guardar();
    var roles = {}; st.s.jug.forEach(function (x) { roles[x.id] = { hole: x.hole }; });
    return { estado: { mesa: vista(), resultado: null, op: op }, roles: roles };
  }
  function alEstado(est) {
    if (S.juego !== 'poker') return;
    if (S.host && est.phase === 'jugando' && !st.s) {                     // el anfitrión recargó: recupera la mesa guardada
      var ex = S.leerExtra(); if (ex && ex.eng) { st.s = ex.eng; publicar(true); }
    }
    if (est.phase === 'lobby') { st.s = null; clearTimeout(st.sigT); }
    pintar();
  }
  function alCerrar() { st.s = null; clearTimeout(st.sigT); pintar(); }
  function alEvento(m) { if (m.k === 'aviso' && JUEGOS.indexOf(S.juego) >= 0) S.toast(m.texto); }

  L.registrar('poker', { opciones: opciones, preparar: preparar, alEstado: alEstado, alCerrar: alCerrar });
  S.on('msg', alMensaje); S.on('rol', pintar); S.on('jug', pintar); S.on('evento', alEvento);
})();

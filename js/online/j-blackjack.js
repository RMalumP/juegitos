/* js/online/j-blackjack.js — Blackjack ONLINE con el juego ORIGINAL (js/core.js + css/games/*): 6 barajas, dividir (hasta 4 manos), doblar, blackjack 3:2, la banca pide hasta 17,
   las mismas fichas (1 a 100), pestañas, mensajes y chuleta; de 2 a 6 jugadores. No se reescribe ninguna regla: el anfitrión ejecuta el juego original en su ventana
   y publica una «foto» del estado después de cada cambio (con la carta oculta de la banca TAPADA); los invitados la pintan con las funciones del propio juego y mandan sus
   intenciones (apostar, repartir, pedir, plantar, doblar, dividir), que el anfitrión valida —es su turno, hay fichas— y ejecuta con el código original.
   core.js es un script global, así que se engancha por sus nombres (Me, Se, we, Te, je, Ye, bjHit…) sin modificarlo.
   Reparte cuando todos los jugadores con fichas pulsan «Repartir» (el anfitrión puede repartir ya). Tras el resultado, cualquiera pulsa para seguir (o pasa solo a los 10 s). */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala;
  var $ = function (id) { return document.getElementById(id); };
  var FICHAS = [1, 5, 10, 25, 50, 100];
  var RB = { activo: false, ids: [], yo: -1, listos: {}, ronda: -1, fotoT: null, sigT: null, ultima: '', n: 0, ultimaN: 0, doneEn: 0, prevCont: [] };
  var en = function () { return S.activo && S.juego === 'blackjack'; };
  var esHost = function () { return S.host; };
  var o = { Oe: Oe, Ae: Ae, Ye: Ye, Ze: Ze, bjAddBet: bjAddBet, bjClearBet: bjClearBet, bjDeal: bjDeal, bjHit: bjHit, bjStand: bjStand, bjDouble: bjDouble, bjSplit: bjSplit };
  var envio = function (m) { S.enviar('host', Object.assign({ tipo: 'accion' }, m)).catch(function (e) { S.toast(e.message); }); };

  /* ---------- foto del estado ---------- */
  var cartaPub = function (c) { return c.hidden ? { hidden: true, s: '', v: '', cl: 'blk' } : { hidden: false, s: c.s, v: c.v, cl: c.cl }; };
  function fotoDe(completa) {
    return {
      Me: Me.map(function (p) { return { name: p.name, chips: p.chips, bet: p.bet, result: p.result, hands: p.hands.map(function (h) { return { c: h.map(function (c) { return completa ? { hidden: !!c.hidden, s: c.s, v: c.v, cl: c.cl } : cartaPub(c); }), bet: h.bet, result: h.result }; }) }; }),
      Se: Se.map(function (c) { return completa ? { hidden: !!c.hidden, s: c.s, v: c.v, cl: c.cl } : cartaPub(c); }), we: we, Te: Te, je: je, msg: $('bjMsgBar').textContent, listos: RB.listos
    };
  }
  function programarFoto() {
    clearTimeout(RB.fotoT);
    RB.fotoT = setTimeout(function () {
      if (!RB.activo || !esHost() || !en()) return;
      var f = fotoDe(false), txt = JSON.stringify(f); if (txt === RB.ultima) return; RB.ultima = txt;
      f.n = RB.n = Math.max(RB.n + 1, Date.now());
      S.guardarExtra({ juego: 'blackjack', bjFull: fotoDe(true) });                 // la copia completa (con la carta oculta) solo la guarda el anfitrión, para recuperar la mano si recarga
      S.enviar('todos', { tipo: 'estado', bjF: f }).catch(function () {});
    }, 70);
  }
  function reconstruir(f) {
    var cont = [];
    Me = f.Me.map(function (p, i) {
      cont[i] = [];
      return { name: p.name, chips: p.chips, bet: p.bet, result: p.result, hands: p.hands.map(function (h, k) {
        var prev = (RB.prevCont[i] || [])[k] || 0; cont[i][k] = h.c.length;
        var arr = h.c.map(function (c, j) { return { s: c.s, v: c.v, cl: c.cl, hidden: !!c.hidden, fresh: j >= prev }; });
        arr.bet = h.bet; arr.result = h.result; return arr; }) };
    });
    RB.prevCont = cont;
    Se = f.Se.map(function (c, j) { return { s: c.s, v: c.v, cl: c.cl, hidden: !!c.hidden, fresh: j >= (RB.prevSe || 0) }; }); RB.prevSe = Se.length;
  }
  function aplicarFoto(f) {
    if (!f || !Array.isArray(f.Me) || f.Me.length !== RB.ids.length) return;
    reconstruir(f); we = f.we; Te = f.Te; je = f.je; RB.listos = f.listos || {}; Pe = RB.yo >= 0 ? RB.yo : 0;
    Ye(); We(); Xe(je === 'bet' ? 'bet' : je === 'play' ? 'play' : 'done'); $('bjWrap').classList.toggle('bjDone', je === 'done');
    Ze(); Ve(f.msg || ''); botones();
  }
  function botones() {
    var d = $('bjDealBtn2'); if (!d) return;
    var listo = !!RB.listos[RB.yo];
    d.textContent = esHost() ? '🂠 Repartir ya' : (listo ? '⏳ Esperando…' : '✔ Listo');
    pintarBarra();
  }

  /* ---------- lo que piden los invitados (anfitrión): el mismo código del juego, para el jugador i ---------- */
  function apostarDe(i, m) {
    var p = Me[i]; if (je !== 'bet' || !p || FICHAS.indexOf(m) < 0) return false;
    var n = Math.min(m, p.chips - p.bet); if (n <= 0) return false; p.bet += n; RB.listos[i] = false; return true;
  }
  function borrarDe(i) { var p = Me[i]; if (je !== 'bet' || !p) return false; p.bet = 0; RB.listos[i] = false; return true; }
  function refrescar() { We(); Ye(); botones(); programarFoto(); }
  function repartirYa() { if (!esHost() || je !== 'bet') return; RB.listos = {}; o.bjDeal(); botones(); programarFoto(); }
  function comprobarListos() { if (je !== 'bet') return; if (Me.every(function (p, i) { return p.chips <= 0 || RB.listos[i]; })) repartirYa(); }
  function siguiente() { if (!esHost() || je !== 'done') return; clearTimeout(RB.sigT); o.Ae(); RB.listos = {}; Pe = RB.yo; We(); botones(); programarFoto(); }
  function turnoDe(i) { return je === 'play' && we === i; }
  function alMensaje(m) {
    if (!esHost() || !en() || !RB.activo || m.tipo !== 'accion' || typeof m.a !== 'string') return;
    var i = RB.ids.indexOf(m.de); if (i < 0) return;
    if (m.a === 'ap') { if (apostarDe(i, m.m)) refrescar(); }
    else if (m.a === 'bor') { if (borrarDe(i)) refrescar(); }
    else if (m.a === 'listo') { if (je === 'bet' && Me[i].chips > 0) { RB.listos[i] = true; refrescar(); comprobarListos(); } }
    else if (m.a === 'hit' && turnoDe(i)) o.bjHit();
    else if (m.a === 'stand' && turnoDe(i)) o.bjStand();
    else if (m.a === 'double' && turnoDe(i)) o.bjDouble();
    else if (m.a === 'split' && turnoDe(i)) o.bjSplit();
    else if (m.a === 'sig') { if (je === 'done' && Date.now() - RB.doneEn > 1500) siguiente(); }
  }

  /* ---------- envoltorios de las funciones del juego ---------- */
  bjAddBet = function (m) { if (!RB.activo) return o.bjAddBet(m); if (esHost()) { if (apostarDe(RB.yo, m)) refrescar(); } else envio({ a: 'ap', m: m }); };
  bjClearBet = function () { if (!RB.activo) return o.bjClearBet(); if (esHost()) { if (borrarDe(RB.yo)) refrescar(); } else envio({ a: 'bor' }); };
  bjDeal = function () { if (!RB.activo) return o.bjDeal(); if (esHost()) repartirYa(); else envio({ a: 'listo' }); };
  bjHit = function () { if (!RB.activo) return o.bjHit(); if (esHost()) { if (turnoDe(RB.yo)) o.bjHit(); } else if (turnoDe(RB.yo)) envio({ a: 'hit' }); };
  bjStand = function () { if (!RB.activo) return o.bjStand(); if (esHost()) { if (turnoDe(RB.yo)) o.bjStand(); } else if (turnoDe(RB.yo)) envio({ a: 'stand' }); };
  bjDouble = function () { if (!RB.activo) return o.bjDouble(); if (esHost()) { if (turnoDe(RB.yo)) o.bjDouble(); } else if (turnoDe(RB.yo)) envio({ a: 'double' }); };
  bjSplit = function () { if (!RB.activo) return o.bjSplit(); if (esHost()) { if (turnoDe(RB.yo)) o.bjSplit(); } else if (turnoDe(RB.yo)) envio({ a: 'split' }); };
  Ae = function () { if (!RB.activo) return o.Ae(); if (je !== 'done') return; if (esHost()) siguiente(); else envio({ a: 'sig' }); };
  Ye = function () {                                                              // cada vez que el juego se repinta, el anfitrión publica la foto
    o.Ye();
    if (RB.activo && esHost()) { if (je === 'done' && !RB.doneEn0) { RB.doneEn0 = true; RB.doneEn = Date.now(); clearTimeout(RB.sigT); RB.sigT = setTimeout(function () { if (je === 'done' && esHost() && RB.activo) siguiente(); }, 10000); } if (je !== 'done') RB.doneEn0 = false; programarFoto(); }
  };
  Ze = function () {                                                              // solo se puede jugar en el turno propio
    o.Ze();
    if (RB.activo && !(je === 'play' && we === RB.yo)) ['bjHitBtn', 'bjStandBtn', 'bjDoubleBtn', 'bjSplitBtn'].forEach(function (id) { $(id).disabled = true; });
  };
  if (typeof Ve === 'function') { var _Ve = Ve; Ve = function (t) { _Ve(t); if (RB.activo && esHost()) programarFoto(); }; }

  /* ---------- puesta en marcha y fin ---------- */
  function iniciar(bj) {
    RB.activo = true; RB.ids = bj.jug.map(function (j) { return j.id; }); RB.yo = RB.ids.indexOf(S.uid); RB.listos = {}; RB.ultima = ''; RB.prevCont = []; RB.prevSe = 0; RB.doneEn0 = false;
    He = bj.fichas; Ne = bj.jug.length; $('bjStartChips').value = bj.fichas; $('bjNCount').textContent = Ne;
    $('winBJ').classList.add('bjOnline');
    o.Oe();
    Me.forEach(function (p, i) { p.name = bj.jug[i].nombre; });
    Pe = RB.yo >= 0 ? RB.yo : 0; We(); Ye(); botones();
  }
  function salir() {
    if (!RB.activo) return; RB.activo = false; RB.ronda = -1; clearTimeout(RB.fotoT); clearTimeout(RB.sigT);
    $('winBJ').classList.remove('bjOnline'); var b = L.barra('winBJ'); if (b) b.classList.remove('on');
    Ne = 1; He = 1000; $('bjStartChips').value = 1000; $('bjNCount').textContent = 1; o.Oe();
  }
  function pintarBarra() {
    var b = L.barra('winBJ'); if (!b) return;
    if (!RB.activo || !en()) { b.classList.remove('on'); return; }
    b.innerHTML = '<span class="olBT">🌐 ' + L.esc(S.sala) + ' · ' + Me.length + ' jugadores · ' + (je === 'play' && Me[we] ? (we === RB.yo ? '👉 <b>Tu turno</b>' : 'turno de ' + L.esc(Me[we].name)) : je === 'bet' ? 'haced vuestras apuestas' : '') + '</span>';
    if (esHost()) { var v = L.boton('↩ Lobby', '', function () { if (confirm('¿Volver al lobby? Se pierde la mesa actual.')) L.volverAlLobby(['bj', 'bjF']); }); v.className = ''; b.appendChild(v); }
    b.classList.add('on');
  }

  /* ---------- lobby ---------- */
  function opciones(host, est) {
    var fich = (est.op && est.op.fichas) || 1000;
    if (!host) return [L.mk('div', 'olNota', 'Fichas iniciales: <b>' + fich + '</b>.')];
    var f = L.mk('div', 'olOp'); f.appendChild(L.mk('span', '', 'Fichas:'));
    [500, 1000, 5000].forEach(function (n) { f.appendChild(L.boton(String(n), fich === n ? 'on' : '', function () { S.enviar('todos', { tipo: 'estado', op: { fichas: n } }).catch(function () {}); })); });
    return [f, L.mk('div', 'olNota', 'Blackjack con las reglas del juego original (6 barajas, dividir, doblar, 3:2). Fichas virtuales, sin dinero real.')];
  }
  function preparar(ctx) { var op = ctx.op || {}; return { estado: { bj: { fichas: op.fichas || 1000, jug: ctx.jug.map(function (p) { return { id: p.id, nombre: p.nombre }; }) }, bjF: null, op: op } }; }
  function alEstado(est) {
    if (!en()) return;
    if (est.phase === 'lobby' || !est.bj) { salir(); return; }
    if (!RB.activo || RB.ronda !== est.ronda) {
      RB.ronda = est.ronda; iniciar(est.bj);
      if (esHost()) { var ex = S.leerExtra(), full = ex && ex.juego === 'blackjack' && ex.bjFull; if (full) { aplicarFoto(full); if (je === 'dealer') o.Ye(); } else if (est.bjF) aplicarFoto(est.bjF); programarFoto(); }
    }
    if (!esHost() && est.bjF && est.bjF.n !== RB.ultimaN) { RB.ultimaN = est.bjF.n; aplicarFoto(est.bjF); }
    pintarBarra();
  }
  function alCerrar() { salir(); }

  L.registrar('blackjack', { opciones: opciones, preparar: preparar, alEstado: alEstado, alCerrar: alCerrar });
  S.on('msg', alMensaje);
})();

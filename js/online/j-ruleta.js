/* js/online/j-ruleta.js — Ruleta ONLINE con el juego ORIGINAL (js/core.js + css/games/roul.css): el mismo tapete con todas las casillas (números, split, calle, trío,
   esquina, seisena, docenas, columnas, dobles, cero y 00), la misma rueda, historial, deshacer, repetir y chuleta; europea o americana; de 2 a 6 jugadores.
   No se reescribe ninguna regla: el anfitrión ejecuta el juego original en su ventana (apuestas, giro y pagos) y publica una «foto» del estado después de cada
   cambio; los invitados la pintan con las propias funciones del juego y mandan sus intenciones (apostar, deshacer, repetir, «listo», seguir), que el anfitrión
   valida y aplica con el mismo código de apuestas. core.js es un script global, así que se engancha por sus nombres (st, at, Ct, Pt…) sin modificarlo.
   Gira cuando todos los que han apostado pulsan «Girar»; el anfitrión puede girar ya. Tras el resultado, cualquiera pulsa «Siguiente» (o pasa solo a los 9 s). */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala;
  var $ = function (id) { return document.getElementById(id); };
  var SEL_ZONAS = '#roulBoard .roulCell, #roulOutside2 .roulCell, #roulCorners .roulCorner, #roulSplits .roulSplit, #roulStreets .roulStreet, #roulSixlines .roulSixline, #roulBaskets .roulTrio, #roulBoard .roulDblZone';
  var FICHAS = [1, 5, 10, 25, 50, 100];
  var RO = { activo: false, ids: [], yo: -1, listos: {}, iniciado: false, ronda: -1, fotoT: null, sigT: null, ultima: '', n: 0, resultadoEn: 0 };
  var en = function () { return S.activo && S.juego === 'ruleta'; };

  /* ---------- funciones originales de core.js (se conservan y se envuelven) ---------- */
  var o = { bt: bt, Ct: Ct, xt: xt, wt: wt, Ht: Ht, Pt: Pt, Lt: Lt, roulSpin: roulSpin, roulRepeatBets: roulRepeatBets };
  var envio = function (m) { S.enviar('host', Object.assign({ tipo: 'accion' }, m)).catch(function (e) { S.toast(e.message); }); };
  var esHost = function () { return S.host; };

  /* ---------- foto del estado (anfitrión → todos) ---------- */
  function foto() {
    return {
      st: JSON.parse(JSON.stringify(st)), nt: nt, rt: rt, ut: ut, pt: pt.slice(-60), mt: mt, listos: RO.listos,
      res: ut && pt.length ? pt[pt.length - 1] : null, msg: $('roulMsg').textContent, big: $('roulBigMsg').textContent, n: (RO.n = Math.max(RO.n + 1, Date.now()))
    };
  }
  function programarFoto() {
    clearTimeout(RO.fotoT);
    RO.fotoT = setTimeout(function () { if (!RO.activo || !esHost() || !en()) return; var f = foto(), txt = JSON.stringify(f, function (k, v) { return k === 'n' ? undefined : v; }); if (txt === RO.ultima) return; RO.ultima = txt; S.enviar('todos', { tipo: 'estado', rulF: f }).catch(function () {}); }, 60);
  }
  function aplicarFoto(f) {
    if (!f || !Array.isArray(f.st) || f.st.length !== RO.ids.length) return;
    var eraUt = ut;
    st = f.st; pt = Array.isArray(f.pt) ? f.pt.slice() : []; rt = !!f.rt; ut = !!f.ut; RO.listos = f.listos || {};
    if (ut && !eraUt && window.Vibra) window.Vibra.pulso(40);                                       // ha salido el número
    if (typeof f.mt === 'number' && f.mt !== mt) {                                  // la rueda gira con la misma animación del juego
      mt = f.mt;
      ['roulWheelInner', 'roulWheelInnerBig'].forEach(function (id) {
        var w = $(id); if (!f.rt) w.style.transition = 'none';                       // si no está girando (reconexión, recarga) se coloca sin animar
        w.style.transform = 'rotate(' + mt + 'deg)'; if (!f.rt) setTimeout(function () { w.style.transition = ''; }, 60);
      });
    }
    var r = f.res, res = $('roulResult'), big = $('roulResultBig');
    document.querySelectorAll('.winCell').forEach(function (e) { e.classList.remove('winCell'); });
    if (f.ut && r !== null && r !== undefined) {
      res.textContent = r; res.className = gt(r); big.textContent = r; big.className = gt(r);
      document.querySelectorAll(SEL_ZONAS).forEach(function (el) { if (Tt(kt(el), r)) el.classList.add('winCell'); });
    } else { res.textContent = '—'; res.className = ''; big.textContent = '—'; big.className = ''; }
    $('roulMsg').textContent = f.msg || ''; $('roulBigMsg').textContent = f.big || '';
    $('roulBigCloseHint').classList.toggle('show', !!f.ut);
    Nt(); Mt(); St(); Lt(); botones();
  }
  function botones() {                                                               // el botón Girar dice en qué punto está cada uno
    var btn = $('roulSpinBtn'), bb = $('roulBigSpinBtn'), rep = $('roulRepeatBtn'); if (!btn) return;
    var listo = !!RO.listos[RO.yo], txt;
    if (ut) { txt = '▶ Siguiente'; btn.disabled = false; bb.disabled = true; rep.disabled = true; }
    else if (rt) { txt = '🎯 Girando…'; btn.disabled = true; bb.disabled = true; rep.disabled = true; }
    else { txt = listo ? '⏳ Esperando…' : (esHost() ? '🎯 Girar ya' : '✔ Listo'); btn.disabled = false; bb.disabled = false; rep.disabled = false; }
    btn.textContent = txt; bb.textContent = ut ? '▶ Siguiente' : (rt ? '🎯 Girando…' : txt);
    if (!rt && !ut) {
      var falta = []; st.forEach(function (p, i) { if (Object.keys(p.bets).length && !RO.listos[i]) falta.push(p.name); });
      $('roulMsg').textContent = falta.length ? 'Faltan por pulsar «Girar»: ' + falta.join(', ') : (hayApuestas() ? 'Todos listos' : 'Coloca tus apuestas y pulsa Girar');
    }
    pintarBarra();
  }

  /* ---------- aplicar lo que piden los invitados (anfitrión): mismo código de apuestas que el juego, pero para el jugador i ---------- */
  function clavesValidas() { var s = {}; document.querySelectorAll(SEL_ZONAS).forEach(function (el) { s[kt(el)] = 1; }); return s; }
  function apostarDe(i, key, m) {
    var p = st[i]; if (!p || rt || ut || typeof key !== 'string' || !clavesValidas()[key] || !Number.isInteger(m) || FICHAS.indexOf(m) < 0 || p.coins < m) return false;
    p.bets[key] = (p.bets[key] || 0) + m; p.coins -= m; p.hist.push({ key: key, amt: m }); RO.listos[i] = false; return true;
  }
  function deshacerDe(i) { var p = st[i]; if (!p || rt || ut || !p.hist.length) return false; var h = p.hist.pop(); p.bets[h.key] -= h.amt; if (p.bets[h.key] <= 0) delete p.bets[h.key]; p.coins += h.amt; RO.listos[i] = false; return true; }
  function limpiarDe(i) { var p = st[i]; if (!p || rt || ut) return false; p.coins += Object.values(p.bets).reduce(function (a, b) { return a + b; }, 0); p.bets = {}; p.hist = []; RO.listos[i] = false; return true; }
  function repetirDe(i) {
    var p = st[i]; if (!p || rt || ut || !p.lastBets || !Object.keys(p.lastBets).length) return false;
    var tot = Object.values(p.lastBets).reduce(function (a, b) { return a + b; }, 0); if (p.coins < tot) return false;
    var v = clavesValidas(); if (!Object.keys(p.lastBets).every(function (k) { return v[k]; })) return false;
    Object.keys(p.lastBets).forEach(function (k) { p.bets[k] = (p.bets[k] || 0) + p.lastBets[k]; p.hist.push({ key: k, amt: p.lastBets[k] }); }); p.coins -= tot; RO.listos[i] = false; return true;
  }
  function refrescarLocal() { Mt(); St(); Lt(); botones(); programarFoto(); }
  function hayApuestas() { return st.some(function (p) { return Object.keys(p.bets).length > 0; }); }
  function girarYa() {
    if (!esHost() || rt || ut) return;
    if (!hayApuestas()) { $('roulMsg').textContent = 'Coloca al menos una apuesta'; refrescarLocal(); return; }
    RO.listos = {}; o.roulSpin(); botones(); programarFoto();
  }
  function comprobarListos() {
    if (rt || ut || !hayApuestas()) return;
    if (st.every(function (p, i) { return !Object.keys(p.bets).length || RO.listos[i]; })) girarYa();
  }
  function siguiente() {
    if (!esHost() || !ut) return; clearTimeout(RO.sigT);
    o.Ht(); RO.listos = {}; botones(); programarFoto();
  }
  function alMensaje(m) {
    if (!esHost() || !en() || !RO.activo || m.tipo !== 'accion' || typeof m.a !== 'string') return;
    var i = RO.ids.indexOf(m.de); if (i < 0) return;
    if (m.a === 'ap') { if (apostarDe(i, m.k, m.m)) refrescarLocal(); }
    else if (m.a === 'des') { if (deshacerDe(i)) refrescarLocal(); }
    else if (m.a === 'lim') { if (limpiarDe(i)) refrescarLocal(); }
    else if (m.a === 'rep') { if (repetirDe(i)) refrescarLocal(); }
    else if (m.a === 'listo') { if (!rt && !ut && Object.keys(st[i].bets).length) { RO.listos[i] = true; refrescarLocal(); comprobarListos(); } }
    else if (m.a === 'sig') { if (ut && Date.now() - RO.resultadoEn > 1500) siguiente(); }
  }

  /* ---------- envoltorios de las funciones del juego (los invitados mandan intenciones; el anfitrión las ejecuta) ---------- */
  Ct = function (el) {
    if (!RO.activo) return o.Ct(el);
    if (ut) return void Ht();
    if (rt) return;
    var key = kt(el);
    if (esHost()) { if (apostarDe(RO.yo, key, dt)) refrescarLocal(); else if (st[RO.yo].coins < dt) $('roulMsg').textContent = st[RO.yo].name + ' no tiene suficientes monedas'; }
    else envio({ a: 'ap', k: key, m: dt });
  };
  xt = function () { if (!RO.activo) return o.xt(); if (esHost()) { if (deshacerDe(RO.yo)) refrescarLocal(); } else envio({ a: 'des' }); };
  wt = function () { if (!RO.activo) return o.wt(); if (esHost()) { if (limpiarDe(RO.yo)) refrescarLocal(); } else envio({ a: 'lim' }); };
  roulRepeatBets = function () { if (!RO.activo) return o.roulRepeatBets(); if (esHost()) { if (repetirDe(RO.yo)) refrescarLocal(); } else envio({ a: 'rep' }); };
  roulSpin = function () {
    if (!RO.activo) return o.roulSpin();
    if (ut) return void Ht();
    if (rt) return;
    if (esHost()) girarYa(); else envio({ a: 'listo' });
  };
  Ht = function () {
    if (!RO.activo) return o.Ht();
    if (!ut) return;
    if (esHost()) siguiente(); else envio({ a: 'sig' });
  };
  Pt = function (n) {                                                                // fin del giro (solo ocurre en el anfitrión, que es quien gira)
    o.Pt(n);
    if (RO.activo && esHost()) {
      RO.resultadoEn = Date.now(); RO.listos = {}; programarFoto();
      clearTimeout(RO.sigT); RO.sigT = setTimeout(function () { if (ut && esHost() && RO.activo) siguiente(); }, 9000);
    }
  };
  Lt = function () { o.Lt(); if (RO.activo) document.querySelectorAll('#roulPlayerTabs .roulPTab').forEach(function (t) { t.onclick = null; }); };   // cada móvil controla solo a su jugador
  // enlaces que el juego guardó con la función original: se vuelven a enlazar con la versión envuelta
  $('roulUndo').onclick = function () { xt(); }; $('roulClearBets').onclick = function () { wt(); };
  $('roulBigSpinBtn').removeEventListener('click', o.roulSpin); $('roulBigSpinBtn').addEventListener('click', function () { roulSpin(); });
  // al terminar el giro del anfitrión el juego llama a Pt por su nombre: ya apunta a la versión envuelta

  /* ---------- puesta en marcha y fin ---------- */
  function iniciar(rul) {
    RO.activo = true; RO.ids = rul.jug.map(function (j) { return j.id; }); RO.yo = RO.ids.indexOf(S.uid); RO.listos = {}; RO.ultima = ''; RO.n = 0;
    nt = rul.modo === 'us' ? 'us' : 'eu'; ct = rul.jug.length; it = rul.fichas; $('roulStartCoins').value = rul.fichas; $('roulNCount').textContent = ct;
    $('roulModeEU').classList.toggle('sel', nt === 'eu'); $('roulModeUS').classList.toggle('sel', nt === 'us');
    $('winRoul').classList.add('rulOnline');
    o.bt();
    st.forEach(function (p, i) { p.name = rul.jug[i].nombre; });
    at = RO.yo >= 0 ? RO.yo : 0; Lt(); St(); Mt(); botones();
  }
  function salir() {
    if (!RO.activo) return; RO.activo = false; RO.iniciado = false; RO.ronda = -1; clearTimeout(RO.fotoT); clearTimeout(RO.sigT);
    $('winRoul').classList.remove('rulOnline'); var b = L.barra('winRoul'); if (b) b.classList.remove('on');
    nt = 'eu'; ct = 1; it = 1000; $('roulStartCoins').value = 1000; $('roulNCount').textContent = 1; $('roulModeEU').classList.add('sel'); $('roulModeUS').classList.remove('sel');
    document.querySelectorAll('.winCell').forEach(function (e) { e.classList.remove('winCell'); });
    o.bt();
  }
  function pintarBarra() {
    var b = L.barra('winRoul'); if (!b) return;
    if (!RO.activo || !en()) { b.classList.remove('on'); return; }
    b.innerHTML = '<span class="olBT">🌐 ' + L.esc(S.sala) + ' · ' + (nt === 'us' ? 'americana' : 'europea') + ' · ' + st.length + ' jugadores</span>';
    if (esHost()) { var v = L.boton('↩ Lobby', '', function () { if (confirm('¿Volver al lobby? Se pierde la mesa actual.')) L.volverAlLobby(['rul', 'rulF']); }); v.className = ''; b.appendChild(v); }
    b.classList.add('on');
  }

  /* ---------- lobby ---------- */
  function opciones(host, est) {
    var op = est.op || {}, modo = op.modo || 'eu', fich = op.fichas || 1000;
    if (!host) return [L.mk('div', 'olNota', 'Ruleta <b>' + (modo === 'us' ? 'americana (0 y 00)' : 'europea (0)') + '</b> · fichas iniciales: <b>' + fich + '</b>.')];
    var a = L.mk('div', 'olOp'); a.appendChild(L.mk('span', '', 'Ruleta:'));
    [['eu', 'Europea (0)'], ['us', 'Americana (0 y 00)']].forEach(function (k) { a.appendChild(L.boton(k[1], modo === k[0] ? 'on' : '', function () { S.enviar('todos', { tipo: 'estado', op: Object.assign({}, op, { modo: k[0] }) }).catch(function () {}); })); });
    var f = L.mk('div', 'olOp'); f.appendChild(L.mk('span', '', 'Fichas:'));
    [500, 1000, 5000].forEach(function (n) { f.appendChild(L.boton(String(n), fich === n ? 'on' : '', function () { S.enviar('todos', { tipo: 'estado', op: Object.assign({}, op, { fichas: n }) }).catch(function () {}); })); });
    return [a, f, L.mk('div', 'olNota', 'Fichas virtuales para jugar entre amigos, sin dinero real.')];
  }
  function preparar(ctx) {
    var op = ctx.op || {};
    return { estado: { rul: { modo: op.modo || 'eu', fichas: op.fichas || 1000, jug: ctx.jug.map(function (p) { return { id: p.id, nombre: p.nombre }; }) }, rulF: null, op: op } };
  }
  function alEstado(est) {
    if (!en()) return;
    if (est.phase === 'lobby' || !est.rul) { salir(); return; }
    if (!RO.activo || RO.ronda !== est.ronda) { RO.ronda = est.ronda; iniciar(est.rul); RO.iniciado = true; if (esHost() && est.rulF) aplicarFoto(est.rulF); else if (esHost()) programarFoto(); }
    if (!esHost() && est.rulF && est.rulF.n !== RO.ultimaN) { RO.ultimaN = est.rulF.n; aplicarFoto(est.rulF); }
    pintarBarra();
  }
  function alCerrar() { salir(); }

  L.registrar('ruleta', { opciones: opciones, preparar: preparar, alEstado: alEstado, alCerrar: alCerrar });
  S.on('msg', alMensaje);
})();

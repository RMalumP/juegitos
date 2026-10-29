/* js/online/j-simon.js — Simon ONLINE (2 a 6 jugadores, todos a la vez).
   Todos ven la misma secuencia en su móvil y la repiten al mismo tiempo; quien falla queda eliminado y gana el último en pie (js/online/simon-engine.js).
   El anfitrión es el árbitro: recibe la respuesta de cada uno ({a:'resp', ronda, r:[colores]}), la comprueba con el motor y publica el estado
   ({tipo:'estado', si}). Si alguien no contesta dentro del plazo de la ronda (o se ha desconectado) el anfitrión la cierra y lo elimina.
   La interfaz es la de js/games/simon.js (window.Simon.online). */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala;
  var r = { activo: false, ronda: -1, ids: [], nombres: [], yo: -1, est: null, pendiente: null, plazoT: null, plazoRonda: -1 };
  var Eng = function () { return window.SimonEngine; };
  var en = function () { return S.activo && S.juego === 'simon'; };
  var NOMBRE = ['Lenta', 'Normal', 'Rápida'];

  function esperarUI() {                                                     // la interfaz se carga bajo demanda (lazy-loader)
    return new Promise(function (ok, ko) {
      var n = 0;
      (function t() {
        if (window.Simon && window.Simon.online && Eng()) return ok(window.Simon.online);
        if (n === 0 && typeof window.initSim === 'function') { try { window.initSim(); } catch (e) { /* se reintenta */ } }
        if (++n > 100) return ko(new Error('No se pudo cargar el juego.'));
        setTimeout(t, 60);
      })();
    });
  }
  // Plazo de la ronda (solo el anfitrión): al acabar, quien no haya contestado queda eliminado
  function programarPlazo() {
    if (!S.host || !r.est) return;
    if (r.est.fase !== 'jugando') { clearTimeout(r.plazoT); r.plazoRonda = -1; return; }
    if (r.plazoRonda === r.est.ronda) return;
    clearTimeout(r.plazoT); r.plazoRonda = r.est.ronda;
    var ronda = r.est.ronda, ms = window.simPlazoMs || Eng().plazo(r.est.vel, r.est.seq.length);
    r.plazoT = setTimeout(function () {
      if (!r.activo || !r.est || r.est.ronda !== ronda || r.est.fase !== 'jugando') return;
      Eng().cerrar(r.est); publicar();
    }, ms);
  }
  function publicar() {
    if (!S.host || !r.est) return;
    S.guardarExtra({ juego: 'simon', ronda: r.ronda, est: r.est });
    S.enviar('todos', { tipo: 'estado', si: r.est }).catch(function () {});
    programarPlazo(); pintarBarra();
  }
  function responderHost(p, ronda, resp) {
    if (!r.est || !Eng().responder(r.est, p, ronda, resp)) return false;
    publicar(); return true;
  }
  function alMensaje(m) {
    if (!S.host || !en() || !r.activo || !r.est || m.tipo !== 'accion' || m.a !== 'resp') return;
    var p = r.ids.indexOf(m.de); if (p < 0) return;
    if (!responderHost(p, m.ronda, m.r)) publicar();                         // respuesta repetida, de otra ronda o de un eliminado: se reenvía el estado real
  }
  function acciones() {
    return {
      responder: function (ronda, resp) {
        if (S.host) responderHost(r.yo, ronda, resp);
        else S.enviar('host', { tipo: 'accion', a: 'resp', ronda: ronda, r: resp }).catch(function (e) { S.toast(e.message); });
      },
      lobby: function () { if (S.host && confirm('¿Volver al lobby? Se cierra esta partida.')) L.volverAlLobby(['si']); }
    };
  }
  function iniciar(est) {
    r.activo = true; r.ronda = est.ronda; r.plazoRonda = -1;
    r.ids = (est.asientos || []).map(function (a) { return a.id; }); r.nombres = (est.asientos || []).map(function (a) { return a.nombre; });
    r.yo = r.ids.indexOf(S.uid); r.est = null;
    if (S.host) {
      var e = r.pendiente; r.pendiente = null;
      if (!e) { var ex = S.leerExtra(); if (ex && ex.juego === 'simon' && ex.ronda === est.ronda && ex.est) e = ex.est; }
      if (!e) { S.toast('No se pudo recuperar la partida. Vuelve a empezar.'); r.activo = false; L.volverAlLobby(['si']); return; }
      r.est = e; programarPlazo();
    } else r.est = est.si;
    var cfg = Object.assign({ p: r.yo, nombres: r.nombres, host: S.host, est: r.est }, acciones());
    esperarUI().then(function (ui) { if (r.activo && r.ronda === est.ronda) ui.iniciar(cfg); }).catch(function (e) { S.toast(e.message); });
    pintarBarra();
  }
  function salir() {
    var estaba = r.activo; r.activo = false; r.ronda = -1; r.est = null; r.pendiente = null; clearTimeout(r.plazoT); r.plazoRonda = -1;
    var b = L.barra('winSim'); if (b) b.classList.remove('on');
    if (estaba && window.Simon && window.Simon.online) window.Simon.online.salir();
  }
  function pintarBarra() {
    var b = L.barra('winSim'); if (!b) return;
    if (!r.activo || !en() || !r.est) { b.classList.remove('on'); return; }
    var vivos = r.est.vivos.filter(Boolean).length;
    b.innerHTML = '<span class="olBT">🌐 ' + L.esc(S.sala) + ' · ' + r.est.n + ' jugadores · <b>' + vivos + '</b> en pie · ' + NOMBRE[r.est.vel] + '</span>';
    if (S.host) { var v = L.boton('↩ Lobby', '', function () { if (confirm('¿Volver al lobby? Se cierra esta partida.')) L.volverAlLobby(['si']); }); v.className = ''; b.appendChild(v); }
    b.classList.add('on');
  }
  function opciones(host, est) {
    var v = est.op && est.op.vel >= 0 && est.op.vel <= 2 ? est.op.vel : 1, f = L.mk('div', 'olFila');
    f.appendChild(L.mk('span', '', 'Velocidad:'));
    NOMBRE.forEach(function (t, i) {
      var b = L.boton(t, v === i ? 'on' : '', host ? function () { S.enviar('todos', { tipo: 'estado', op: Object.assign({}, est.op, { vel: i }) }).catch(function () {}); } : null);
      b.disabled = !host; f.appendChild(b);
    });
    return [f, L.mk('div', 'olNota', 'Todos repiten la secuencia a la vez. Quien falla o tarda demasiado queda eliminado; gana el último en pie.')];
  }
  function preparar(ctx) {
    var op = ctx.op || {}, e = Eng().nuevo({ n: ctx.jug.length, vel: op.vel >= 0 && op.vel <= 2 ? op.vel : 1 });
    r.pendiente = e;                                                          // la copia con autoridad se queda en el anfitrión
    return { estado: { si: e, op: op } };
  }
  function alEstado(est) {
    if (!en()) return;
    if (est.phase === 'lobby' || !est.si) { salir(); return; }
    if (!r.activo || r.ronda !== est.ronda) { iniciar(est); return; }
    if (!S.host) r.est = est.si;
    esperarUI().then(function (ui) { if (r.activo) ui.estado(S.host ? r.est : est.si); }).catch(function () {});
    pintarBarra();
  }
  L.registrar('simon', { opciones: opciones, preparar: preparar, alEstado: alEstado, alCerrar: salir });
  S.on('msg', alMensaje);
})();

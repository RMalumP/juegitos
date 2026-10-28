/* js/online/j-duelo.js — Conecta 4 y Tres en raya ONLINE (2 jugadores). Un solo adaptador para los dos (cada uno con su motor).
   Sin información oculta: el estado completo de la partida es público. El anfitrión es el árbitro: valida cada jugada del invitado
   (es su turno, es legal) con el mismo motor (js/online/c4-engine.js, ttt-engine.js) y publica el estado nuevo ({tipo:'estado', du}).
   La interfaz es la de js/games/duelo.js (window.Duelo.online[id]). */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala;
  var JUEGOS = {
    c4: { Name: 'C4', win: 'winC4', motor: function () { return window.C4Engine; } },
    ttt: { Name: 'Ttt', win: 'winTtt', motor: function () { return window.TttEngine; } }
  };
  var R = {};
  Object.keys(JUEGOS).forEach(function (id) {
    var J = JUEGOS[id], r = R[id] = { activo: false, ronda: -1, ids: [], nombres: [], yo: -1, est: null, pendiente: null };
    var en = function () { return S.activo && S.juego === id; };
    var esHost = function () { return S.host; };
    var enviarHost = function (m) { S.enviar('host', Object.assign({ tipo: 'accion' }, m)).catch(function (e) { S.toast(e.message); }); };

    function esperarUI() {                                                   // la interfaz se carga bajo demanda (lazy-loader)
      return new Promise(function (ok, ko) {
        var n = 0;
        (function t() {
          if (window.Duelo && window.Duelo.online[id] && J.motor()) return ok(window.Duelo.online[id]);
          if (n === 0 && typeof window['init' + J.Name] === 'function') { try { window['init' + J.Name](); } catch (e) { /* se reintenta */ } }
          if (++n > 100) return ko(new Error('No se pudo cargar el juego.'));
          setTimeout(t, 60);
        })();
      });
    }
    function publicar() {
      if (!esHost() || !r.est) return;
      S.guardarExtra({ juego: id, ronda: r.ronda, est: r.est });
      S.enviar('todos', { tipo: 'estado', du: r.est }).catch(function () {});
      pintarBarra();
    }
    function jugarHost(p, j) {
      if (!r.est || r.est.turno !== p || !J.motor().jugar(r.est, j)) return false;
      publicar(); return true;
    }
    function alMensaje(m) {
      if (!esHost() || !en() || !r.activo || !r.est || m.tipo !== 'accion' || m.a !== 'jugar') return;
      var p = r.ids.indexOf(m.de); if (p < 0) return;
      if (!jugarHost(p, m.j)) publicar();                                     // jugada ilegal o fuera de turno: se reenvía el estado real
    }
    function acciones() {
      return {
        jugar: function (j) { if (esHost()) jugarHost(r.yo, j); else enviarHost({ a: 'jugar', j: j }); },
        lobby: function () { if (esHost() && confirm('¿Volver al lobby? Se cierra esta partida.')) L.volverAlLobby(['du']); }
      };
    }
    function iniciar(est) {
      r.activo = true; r.ronda = est.ronda;
      r.ids = (est.asientos || []).map(function (a) { return a.id; }); r.nombres = (est.asientos || []).map(function (a) { return a.nombre; });
      r.yo = r.ids.indexOf(S.uid); r.est = null;
      if (esHost()) {
        var e = r.pendiente; r.pendiente = null;
        if (!e) { var ex = S.leerExtra(); if (ex && ex.juego === id && ex.ronda === est.ronda && ex.est) e = ex.est; }
        if (!e) { S.toast('No se pudo recuperar la partida. Vuelve a empezar.'); r.activo = false; L.volverAlLobby(['du']); return; }
        r.est = e;
      } else r.est = est.du;
      var cfg = Object.assign({ p: r.yo, nombres: r.nombres, host: esHost(), est: r.est }, acciones());
      esperarUI().then(function (ui) { if (r.activo && r.ronda === est.ronda) ui.iniciar(cfg); }).catch(function (e) { S.toast(e.message); });
      pintarBarra();
    }
    function salir() {
      var estaba = r.activo; r.activo = false; r.ronda = -1; r.est = null; r.pendiente = null;
      var b = L.barra(J.win); if (b) b.classList.remove('on');
      if (estaba && window.Duelo && window.Duelo.online[id]) window.Duelo.online[id].salir();
    }
    function pintarBarra() {
      var b = L.barra(J.win); if (!b) return;
      if (!r.activo || !en()) { b.classList.remove('on'); return; }
      b.innerHTML = '<span class="olBT">🌐 ' + L.esc(S.sala) + ' · contra ' + L.esc(r.nombres[1 - r.yo] || 'rival') + '</span>';
      if (esHost()) { var v = L.boton('↩ Lobby', '', function () { if (confirm('¿Volver al lobby? Se cierra esta partida.')) L.volverAlLobby(['du']); }); v.className = ''; b.appendChild(v); }
      b.classList.add('on');
    }
    function preparar() {
      var e = J.motor().nuevo({ turno: Math.random() < 0.5 ? 0 : 1 });
      r.pendiente = e;                                                        // la copia con autoridad se queda en el anfitrión
      return { estado: { du: e } };
    }
    function alEstado(est) {
      if (!en()) return;
      if (est.phase === 'lobby' || !est.du) { salir(); return; }
      if (!r.activo || r.ronda !== est.ronda) { iniciar(est); return; }
      if (!esHost()) r.est = est.du;
      esperarUI().then(function (ui) { if (r.activo) ui.estado(est.du); }).catch(function () {});
      pintarBarra();
    }
    L.registrar(id, { opciones: function () { return [L.mk('div', 'olNota', 'Quién empieza se decide al azar.')]; }, preparar: preparar, alEstado: alEstado, alCerrar: salir });
    S.on('msg', alMensaje);
  });
})();

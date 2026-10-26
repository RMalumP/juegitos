/* js/online/j-hundir.js — Hundir la flota ONLINE (2 jugadores).
   · El anfitrión es el árbitro: guarda la partida completa (con las dos flotas) SOLO en memoria y en Sala.guardarExtra (copia que únicamente conserva el anfitrión).
   · Estado público (`hf`, a todos): fase, turno, quién está listo, disparos con su resultado y barcos hundidos. No lleva ninguna flota hasta que termina la partida.
   · Vista privada (`rol`, solo a cada jugador): su propia flota, para recuperarla si recarga la página.
   · El invitado manda sus intenciones ({tipo:'accion', a:'colocar'|'disparar'|'rendir'}); el anfitrión las valida con el mismo motor
     (js/online/hundir-engine.js) y publica el estado. La interfaz es la de js/games/hundir.js (window.Hundir.online). */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala, HE = window.HundirEngine;
  var R = { activo: false, ronda: -1, ids: [], nombres: [], yo: -1, pt: null, pendiente: null, flota: null, op: { tocar: true, repite: false } };
  var en = function () { return S.activo && S.juego === 'hundir'; };
  var esHost = function () { return S.host; };
  var enviarHost = function (m) { S.enviar('host', Object.assign({ tipo: 'accion' }, m)).catch(function (e) { S.toast(e.message); }); };

  /* La interfaz del juego se carga bajo demanda (lazy-loader): si aún no está, se pide y se espera. */
  function esperarUI() {
    return new Promise(function (ok, ko) {
      var n = 0;
      (function t() {
        if (window.Hundir && window.Hundir.online) return ok(window.Hundir.online);
        if (n === 0 && typeof window.initHundir === 'function') { try { window.initHundir(); } catch (e) { /* se reintenta */ } }
        if (++n > 100) return ko(new Error('No se pudo cargar Hundir la flota.'));
        setTimeout(t, 60);
      })();
    });
  }

  /* ---------- árbitro (anfitrión) ---------- */
  function publicar() {
    if (!esHost() || !R.pt) return;
    S.guardarExtra({ juego: 'hundir', ronda: R.ronda, pt: R.pt });
    S.enviar('todos', { tipo: 'estado', hf: HE.publico(R.pt) }).catch(function () {});
    pintarBarra();
  }
  function hostColocar(p, flota) {
    if (!flota || !HE.colocar(R.pt, p, flota)) return false;
    if (p === R.yo) R.flota = flota;
    publicar(); return true;
  }
  function alMensaje(m) {
    if (!esHost() || !en() || !R.activo || !R.pt || m.tipo !== 'accion' || typeof m.a !== 'string') return;
    var p = R.ids.indexOf(m.de); if (p < 0) return;
    if (m.a === 'colocar') {
      var flota = HE.decodificar(m.f);
      if (hostColocar(p, flota)) S.enviar(m.de, { tipo: 'rol', hundir: { flota: HE.codificar(flota) } }).catch(function () {});
      else publicar();                                                    // petición inválida: se le reenvía el estado real
    } else if (m.a === 'disparar') { HE.disparar(R.pt, p, m.c); publicar(); }
    else if (m.a === 'rendir') { if (HE.rendir(R.pt, p)) publicar(); }
  }

  /* ---------- puesta en marcha y fin ---------- */
  function acciones() {
    return {
      colocar: function (txt) { if (esHost()) hostColocar(R.yo, HE.decodificar(txt)); else enviarHost({ a: 'colocar', f: txt }); },
      disparar: function (i) { if (esHost()) { HE.disparar(R.pt, R.yo, i); publicar(); } else enviarHost({ a: 'disparar', c: i }); },
      rendir: function () { if (esHost()) { if (HE.rendir(R.pt, R.yo)) publicar(); } else enviarHost({ a: 'rendir' }); },
      lobby: function () { if (esHost() && confirm('¿Volver al lobby? Se cierra esta partida.')) L.volverAlLobby(['hf']); }
    };
  }
  function iniciar(est) {
    R.activo = true; R.ronda = est.ronda;
    R.ids = (est.asientos || []).map(function (a) { return a.id; });
    R.nombres = (est.asientos || []).map(function (a) { return a.nombre; });
    R.yo = R.ids.indexOf(S.uid);
    R.op = est.op || R.op; R.flota = null; R.pt = null;
    if (esHost()) {
      var pt = R.pendiente; R.pendiente = null;
      if (!pt) { var ex = S.leerExtra(); if (ex && ex.juego === 'hundir' && ex.ronda === est.ronda && ex.pt) pt = HE.restaurar(ex.pt); }
      if (!pt) { S.toast('No se pudo recuperar la partida de Hundir la flota. Vuelve a empezar.'); R.activo = false; L.volverAlLobby(['hf']); return; }
      R.pt = pt; R.flota = pt.flotas[R.yo] || null;
    } else if (S.rol && S.rol.hundir && S.rol.hundir.flota) R.flota = HE.decodificar(S.rol.hundir.flota);
    var cfg = Object.assign({ p: R.yo, nombres: R.nombres, host: esHost(), op: R.op, pub: est.hf, flota: R.flota }, acciones());
    esperarUI().then(function (ui) { if (R.activo && R.ronda === est.ronda) { ui.iniciar(cfg); ui.publico(est.hf); } }).catch(function (e) { S.toast(e.message); });
    pintarBarra();
  }
  function salir() {
    var estaba = R.activo; R.activo = false; R.ronda = -1; R.pt = null; R.pendiente = null; R.flota = null;
    var b = L.barra('winHundir'); if (b) b.classList.remove('on');
    if (estaba && window.Hundir && window.Hundir.online) window.Hundir.online.salir();
  }
  function pintarBarra() {
    var b = L.barra('winHundir'); if (!b) return;
    if (!R.activo || !en()) { b.classList.remove('on'); return; }
    var rival = R.nombres[1 - R.yo] || 'rival';
    b.innerHTML = '<span class="olBT">🌐 ' + L.esc(S.sala) + ' · contra ' + L.esc(rival) + '</span>';
    if (esHost()) { var v = L.boton('↩ Lobby', '', function () { if (confirm('¿Volver al lobby? Se cierra esta partida.')) L.volverAlLobby(['hf']); }); v.className = ''; b.appendChild(v); }
    b.classList.add('on');
  }

  /* ---------- lobby ---------- */
  function opciones(host, est) {
    var op = est.op || { tocar: true, repite: false };
    if (!host) return [L.mk('div', 'olNota', 'Barcos tocándose: <b>' + (op.tocar !== false ? 'sí' : 'no') + '</b> · Repetir turno al acertar: <b>' + (op.repite ? 'sí' : 'no') + '</b>')];
    function envia(n) { S.enviar('todos', { tipo: 'estado', op: Object.assign({ tocar: op.tocar !== false, repite: !!op.repite }, n) }).catch(function () {}); }
    var f1 = L.mk('div', 'olOp'); f1.appendChild(L.mk('span', '', 'Barcos tocándose:'));
    f1.appendChild(L.boton('Sí', op.tocar !== false ? 'on' : '', function () { envia({ tocar: true }); }));
    f1.appendChild(L.boton('No', op.tocar === false ? 'on' : '', function () { envia({ tocar: false }); }));
    var f2 = L.mk('div', 'olOp'); f2.appendChild(L.mk('span', '', 'Repetir turno al acertar:'));
    f2.appendChild(L.boton('No', !op.repite ? 'on' : '', function () { envia({ repite: false }); }));
    f2.appendChild(L.boton('Sí', op.repite ? 'on' : '', function () { envia({ repite: true }); }));
    return [f1, f2, L.mk('div', 'olNota', 'Cada jugador coloca su flota en secreto: el rival solo ve los disparos y los barcos que hunde.')];
  }
  function preparar(ctx) {
    var op = ctx.op || {};
    var pt = HE.crear({ tocar: op.tocar !== false, repite: !!op.repite, turno: Math.random() < 0.5 ? 0 : 1 });
    R.pendiente = pt;                                                    // la copia completa se queda en el anfitrión
    return { estado: { hf: HE.publico(pt), op: { tocar: pt.op.tocar, repite: pt.op.repite } } };
  }
  function alEstado(est) {
    if (!en()) return;
    if (est.phase === 'lobby' || !est.hf) { salir(); return; }
    if (!R.activo || R.ronda !== est.ronda) { iniciar(est); return; }
    esperarUI().then(function (ui) { if (R.activo) ui.publico(est.hf); }).catch(function () {});
    pintarBarra();
  }
  function alCerrar() { salir(); }

  L.registrar('hundir', { opciones: opciones, preparar: preparar, alEstado: alEstado, alCerrar: alCerrar });
  S.on('msg', alMensaje);
  S.on('rol', function (r) {                                              // mi flota (por si recargo la página)
    if (!R.activo || !r || !r.hundir || !r.hundir.flota) return;
    var f = HE.decodificar(r.hundir.flota); if (!f) return;
    R.flota = f; if (window.Hundir && window.Hundir.online) window.Hundir.online.flota(f);
  });
})();

/* js/online/j-uno.js — UNO ONLINE (2 a 8 jugadores, con asientos de CPU opcionales).
   · El anfitrión es el árbitro: guarda la partida completa (manos y mazo) SOLO en memoria y en Sala.guardarExtra (copia que únicamente conserva él),
     y juega por las CPU.
   · Estado público (`uno`, a todos): UnoEngine.vista (carta de arriba, color, turno, cuántas cartas tiene cada uno…). Ninguna mano hasta el final de la ronda.
   · Vista privada (`rol`, solo a cada jugador): su mano.
   · Los invitados mandan acciones ({tipo:'accion', a:'jugar'|'robar'|'pasar'|'retar'|'uno'|'pillar'|'color'}); el anfitrión las valida con el mismo motor
     (js/online/uno-engine.js) y publica. La interfaz es la de js/games/uno.js (window.Uno.online). */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala, UE = window.UnoEngine;
  var R = { activo: false, ronda: -1, ids: [], cpus: [], nivel: 2, yo: -1, s: null, pendiente: null, timer: null };
  var en = function () { return S.activo && S.juego === 'uno'; };
  var esHost = function () { return S.host; };
  var ui = function () { return window.Uno && window.Uno.online; };

  /* La interfaz del juego se carga bajo demanda (lazy-loader): si aún no está, se pide y se espera. */
  function esperarUI() {
    return new Promise(function (ok, ko) {
      var n = 0;
      (function t() {
        if (ui()) return ok(ui());
        if (n === 0 && typeof window.initUno === 'function') { try { window.initUno(); } catch (e) { /* se reintenta */ } }
        if (++n > 100) return ko(new Error('No se pudo cargar el UNO.'));
        setTimeout(t, 60);
      })();
    });
  }

  /* ---------- árbitro (anfitrión) ---------- */
  function publicar() {
    if (!esHost() || !R.s) return;
    S.guardarExtra({ juego: 'uno', ronda: R.ronda, s: R.s });
    var manos = R.ids.map(function (id, p) { return id === S.uid || R.cpus[p] ? null : S.enviar(id, { tipo: 'rol', uno: { p: p, mano: R.s.manos[p] } }); });
    Promise.all(manos).then(function () { return S.enviar('todos', { tipo: 'estado', uno: UE.vista(R.s) }); }).catch(function () {});
    if (ui() && R.yo >= 0) ui().mano(R.s.manos[R.yo]);
    programarCpu();
  }
  function programarCpu() {
    clearTimeout(R.timer);
    var s = R.s; if (!esHost() || !s || (s.fase !== 'jugando' && s.fase !== 'color') || !R.cpus[s.turno]) return;
    R.timer = setTimeout(function () {
      if (!R.activo || R.s !== s || !R.cpus[s.turno]) return;
      if (UE.turnoCpu(s, s.turno, R.nivel)) publicar();
    }, R.retardo || 1000);
  }
  function alMensaje(m) {
    if (!esHost() || !en() || !R.activo || !R.s || m.tipo !== 'accion' || typeof m.a !== 'string') return;
    var p = R.ids.indexOf(m.de); if (p < 0) return;
    var r = UE.accion(R.s, p, { a: m.a, i: m.i, color: m.color, q: m.q, c: m.c });
    if (r.ok) publicar(); else S.enviar(m.de, { tipo: 'evento', k: 'aviso', texto: r.error }).catch(function () {});
  }

  /* ---------- puesta en marcha y fin ---------- */
  function acciones() {
    return {
      actuar: function (m) {
        if (esHost()) { var r = UE.accion(R.s, R.yo, m); if (r.ok) publicar(); else S.toast(r.error); }
        else S.enviar('host', Object.assign({ tipo: 'accion' }, m)).catch(function (e) { S.toast(e.message); });
      },
      siguiente: function () { if (esHost() && R.s && UE.siguienteRonda(R.s).ok) publicar(); },
      revancha: function () { if (esHost()) L.empezar('uno'); },
      lobby: function () { if (esHost() && confirm('¿Volver al lobby? Se cierra esta partida.')) L.volverAlLobby(['uno', 'unoAsientos']); }
    };
  }
  function iniciar(est) {
    var as = est.unoAsientos || [];
    R.activo = true; R.ronda = est.ronda; R.s = null;
    R.ids = as.map(function (a) { return a.id; }); R.cpus = as.map(function (a) { return !!a.cpu; });
    R.yo = R.ids.indexOf(S.uid); R.nivel = (est.op && est.op.nivel) || 2;
    var mano = null;
    if (esHost()) {
      var s = R.pendiente; R.pendiente = null;
      if (!s) { var ex = S.leerExtra(); if (ex && ex.juego === 'uno' && ex.ronda === est.ronda) s = UE.restaurar(ex.s); }
      if (!s) { S.toast('No se pudo recuperar la partida de UNO. Vuelve a empezar.'); R.activo = false; L.volverAlLobby(['uno', 'unoAsientos']); return; }
      R.s = s; mano = s.manos[R.yo];
    } else if (S.rol && S.rol.uno) mano = S.rol.uno.mano;
    var cfg = Object.assign({ p: R.yo, host: esHost(), cpus: R.cpus, pub: est.uno, mano: mano }, acciones());
    var ronda = est.ronda;
    esperarUI().then(function (u) { if (R.activo && R.ronda === ronda) { u.iniciar(cfg); if (esHost()) publicar(); } }).catch(function (e) { S.toast(e.message); });
    pintarBarra();
  }
  function salir() {
    var estaba = R.activo; R.activo = false; R.ronda = -1; R.s = null; R.pendiente = null; clearTimeout(R.timer);
    var b = L.barra('winUno'); if (b) b.classList.remove('on');
    if (estaba && ui()) ui().salir();
  }
  function pintarBarra() {
    var b = L.barra('winUno'); if (!b) return;
    if (!R.activo || !en()) { b.classList.remove('on'); return; }
    b.innerHTML = '<span class="olBT">🌐 ' + L.esc(S.sala) + ' · ' + R.ids.length + ' jugadores' + (R.cpus.some(Boolean) ? ' (con CPU)' : '') + '</span>';
    if (esHost()) { var v = L.boton('↩ Lobby', '', acciones().lobby); v.className = ''; b.appendChild(v); }
    b.classList.add('on');
  }

  /* ---------- lobby ---------- */
  function opDe(est) {
    var op = est.op || {};
    return { meta: [0, 200, 500].indexOf(op.meta) >= 0 ? op.meta : 0, acumular: op.acumular !== false, cpus: Math.max(0, Math.min(6, op.cpus | 0)), nivel: [1, 2, 3].indexOf(op.nivel) >= 0 ? op.nivel : 2 };
  }
  function opciones(host, est) {
    var op = opDe(est), meta = op.meta ? 'a ' + op.meta + ' puntos' : 'rápida', niv = ['', 'fácil', 'normal', 'difícil'][op.nivel];
    if (!host) return [L.mk('div', 'olNota', 'Partida <b>' + meta + '</b> · acumular +2/+4: <b>' + (op.acumular ? 'sí' : 'no') + '</b> · CPU: <b>' + (op.cpus ? op.cpus + ' (' + niv + ')' : 'ninguna') + '</b>')];
    function envia(n) { S.enviar('todos', { tipo: 'estado', op: Object.assign({}, op, n) }).catch(function () {}); }
    var f0 = L.mk('div', 'olOp'); f0.appendChild(L.mk('span', '', 'Final:'));
    [[0, 'Rápida'], [200, 'A 200'], [500, 'A 500']].forEach(function (x) { f0.appendChild(L.boton(x[1], op.meta === x[0] ? 'on' : '', function () { envia({ meta: x[0] }); })); });
    var f1 = L.mk('div', 'olOp'); f1.appendChild(L.mk('span', '', 'Acumular +2/+4:'));
    f1.appendChild(L.boton('Sí', op.acumular ? 'on' : '', function () { envia({ acumular: true }); }));
    f1.appendChild(L.boton('No', !op.acumular ? 'on' : '', function () { envia({ acumular: false }); }));
    var libres = Math.max(0, 8 - S.jug.length);
    var f2 = L.mk('div', 'olOp'); f2.appendChild(L.mk('span', '', 'CPU:'));
    for (var k = 0; k <= Math.min(6, libres); k++) (function (k) { f2.appendChild(L.boton(String(k), Math.min(op.cpus, libres) === k ? 'on' : '', function () { envia({ cpus: k }); })); })(k);
    var f3 = L.mk('div', 'olOp'); f3.appendChild(L.mk('span', '', 'Nivel CPU:'));
    [[1, 'Fácil'], [2, 'Normal'], [3, 'Difícil']].forEach(function (x) { f3.appendChild(L.boton(x[1], op.nivel === x[0] ? 'on' : '', function () { envia({ nivel: x[0] }); })); });
    return [f0, f1, f2, f3, L.mk('div', 'olNota', 'Cada uno ve solo su mano; el anfitrión reparte, valida cada jugada y juega por las CPU. Máximo 8 en la mesa.')];
  }
  function preparar(ctx) {
    var op = opDe({ op: ctx.op || {} }), as = ctx.jug.map(function (p) { return { id: p.id, nombre: p.nombre }; });
    for (var k = 1; k <= op.cpus && as.length < 8; k++) as.push({ id: 'cpu:' + k, nombre: 'CPU ' + k, cpu: true });
    var s = UE.crear({ n: as.length, nombres: as.map(function (a) { return a.nombre; }), meta: op.meta, acumular: op.acumular });
    R.pendiente = s;                                                     // la copia completa se queda en el anfitrión
    var roles = {}; as.forEach(function (a, p) { if (!a.cpu) roles[a.id] = { uno: { p: p, mano: s.manos[p] } }; });
    return { estado: { uno: UE.vista(s), unoAsientos: as, op: op }, roles: roles };
  }
  function alEstado(est) {
    if (!en()) return;
    if (est.phase === 'lobby' || !est.uno) { salir(); return; }
    if (!R.activo || R.ronda !== est.ronda) { iniciar(est); return; }
    esperarUI().then(function (u) { if (R.activo) { u.publico(est.uno); if (esHost() && R.s) u.mano(R.s.manos[R.yo]); } }).catch(function () {});
    pintarBarra();
  }
  function alCerrar() { salir(); }
  function alEvento(m) { if (m.k === 'aviso' && en()) S.toast(m.texto); }

  L.registrar('uno', { opciones: opciones, preparar: preparar, alEstado: alEstado, alCerrar: alCerrar });
  S.on('msg', alMensaje); S.on('evento', alEvento);
  S.on('rol', function (r) { if (R.activo && r && r.uno && ui()) ui().mano(r.uno.mano); });
  window.unoOnlineRetardo = function (ms) { R.retardo = ms; };
})();

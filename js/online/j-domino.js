/* js/online/j-domino.js — Dominó ONLINE (2 a 4 personas, y el anfitrión puede sentar hasta 2 CPU mientras la mesa no pase de 4).
   · El anfitrión es el árbitro: guarda la partida completa (todas las manos y el pozo) SOLO en memoria y en Sala.guardarExtra, y juega por las CPU.
   · Estado público (`dm`, a todos): mesa, fichas que le quedan a cada uno, pozo, turno, puntos y, al acabar la mano, las manos descubiertas.
     `dmAs` son los asientos: [{ id|null, nombre, cpu }].
   · Vista privada (`rol`, solo a cada persona): su propia mano, que también sirve para recuperarla si recarga la página.
   · Los invitados mandan sus intenciones ({ tipo:'accion', a:'jugar'|'robar'|'pasar'|'siguiente' }); el anfitrión las valida con el mismo motor
     (js/online/domino-engine.js). La interfaz es la de js/games/domino.js (window.Domino.online). */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala, DE = window.DominoEngine;
  var R = { activo: false, ronda: -1, as: [], yo: -1, pt: null, pendiente: null, enviadas: {}, cpuT: null, mano: [] };
  var en = function () { return S.activo && S.juego === 'domino'; };
  var esHost = function () { return S.host; };
  var enviarHost = function (m) { S.enviar('host', Object.assign({ tipo: 'accion' }, m)).catch(function (e) { S.toast(e.message); }); };

  function esperarUI() {                                                   // la interfaz se carga bajo demanda (lazy-loader)
    return new Promise(function (ok, ko) {
      var n = 0;
      (function t() {
        if (window.Domino && window.Domino.online) return ok(window.Domino.online);
        if (n === 0 && typeof window.initDomino === 'function') { try { window.initDomino(); } catch (e) { /* se reintenta */ } }
        if (++n > 100) return ko(new Error('No se pudo cargar el dominó.'));
        setTimeout(t, 60);
      })();
    });
  }

  /* ---------- árbitro (anfitrión) ---------- */
  function publicar() {
    if (!esHost() || !R.pt) return;
    S.guardarExtra({ juego: 'domino', ronda: R.ronda, pt: R.pt });
    // primero la mano privada de cada persona (solo si ha cambiado), después el estado público
    R.as.forEach(function (a, i) {
      if (a.cpu || !a.id) return;
      var m = R.pt.manos[i].slice(), txt = JSON.stringify(m);
      if (a.id === S.uid) { R.mano = m; if (window.Domino) window.Domino.online.mano(m); return; }
      if (R.enviadas[a.id] === txt) return;
      R.enviadas[a.id] = txt;
      S.enviar(a.id, { tipo: 'rol', domino: { p: i, mano: m, ronda: R.ronda } }).catch(function () {});
    });
    var pub = DE.publico(R.pt);
    if (window.Domino) window.Domino.online.publico(pub);
    S.enviar('todos', { tipo: 'estado', dm: pub }).catch(function () {});
    pintarBarra();
    turnoCpu();
  }
  function turnoCpu() {
    clearTimeout(R.cpuT);
    var e = R.pt; if (!esHost() || !e || e.fase !== 'jugando' || !R.as[e.turno] || !R.as[e.turno].cpu) return;
    var p = e.turno, nj = e.nj;
    R.cpuT = setTimeout(function () {
      if (!R.activo || R.pt !== e || e.fase !== 'jugando' || e.turno !== p || e.nj !== nj) return;
      if (DE.accion(e, p, DE.ia(e, p, 2))) publicar();
    }, window.dominoRapido ? 30 : 900);
  }
  function hostAccion(p, m) {
    if (!R.pt || !m) return false;
    if (m.a === 'siguiente') { if (!R.as[p] || R.as[p].id !== S.uid || !DE.siguienteMano(R.pt)) return false; publicar(); return true; }   // la siguiente mano la reparte el anfitrión
    if (R.as[p] && R.as[p].cpu) return false;
    var acc = { a: m.a, f: m.f, lado: m.lado };
    if (!DE.accion(R.pt, p, acc)) return false;
    publicar(); return true;
  }
  function alMensaje(m) {
    if (!esHost() || !en() || !R.activo || !R.pt || m.tipo !== 'accion' || typeof m.a !== 'string') return;
    var p = -1; R.as.forEach(function (a, i) { if (a.id && a.id === m.de) p = i; });
    if (p < 0) return;
    if (!hostAccion(p, m)) {                                              // jugada inválida o fuera de turno: se le reenvía lo real
      var a = R.as[p]; delete R.enviadas[a.id]; publicar();
    }
  }

  /* ---------- puesta en marcha y fin ---------- */
  function acciones() {
    return {
      accion: function (m) { if (esHost()) hostAccion(R.yo, m); else enviarHost(m); },
      siguiente: function () { if (esHost()) hostAccion(R.yo, { a: 'siguiente' }); },
      lobby: function () { if (esHost() && confirm('¿Volver al lobby? Se cierra esta partida.')) L.volverAlLobby(['dm', 'dmAs']); }
    };
  }
  function iniciar(est) {
    R.activo = true; R.ronda = est.ronda; R.as = est.dmAs || []; R.enviadas = {}; R.pt = null; R.mano = [];
    R.yo = -1; R.as.forEach(function (a, i) { if (a.id && a.id === S.uid) R.yo = i; });
    if (esHost()) {
      var pt = R.pendiente; R.pendiente = null;
      if (!pt) { var ex = S.leerExtra(); if (ex && ex.juego === 'domino' && ex.ronda === est.ronda && ex.pt) pt = DE.restaurar(ex.pt); }
      if (!pt) { S.toast('No se pudo recuperar la partida de dominó. Vuelve a empezar.'); R.activo = false; L.volverAlLobby(['dm', 'dmAs']); return; }
      R.pt = pt; R.mano = pt.manos[R.yo] ? pt.manos[R.yo].slice() : [];
    } else if (S.rol && S.rol.domino && S.rol.domino.ronda === est.ronda) R.mano = S.rol.domino.mano || [];
    var cfg = Object.assign({ p: R.yo, jug: R.as.map(function (a) { return { nombre: a.nombre, cpu: !!a.cpu }; }), host: esHost(), pub: esHost() ? DE.publico(R.pt) : est.dm, mano: R.mano }, acciones());
    var ronda = est.ronda;
    esperarUI().then(function (ui) {
      if (!R.activo || R.ronda !== ronda) return;
      ui.iniciar(cfg);
      if (esHost()) publicar();                                           // reparte las manos (y sigue si le toca a una CPU)
    }).catch(function (e) { S.toast(e.message); });
    pintarBarra();
  }
  function salir() {
    var estaba = R.activo; R.activo = false; R.ronda = -1; R.pt = null; R.pendiente = null; R.enviadas = {}; clearTimeout(R.cpuT);
    var b = L.barra('winDomino'); if (b) b.classList.remove('on');
    if (estaba && window.Domino && window.Domino.online) window.Domino.online.salir();
  }
  function pintarBarra() {
    var b = L.barra('winDomino'); if (!b) return;
    if (!R.activo || !en()) { b.classList.remove('on'); return; }
    var dm = esHost() && R.pt ? DE.publico(R.pt) : S.estado.dm, txt = '🌐 ' + L.esc(S.sala);
    if (dm && dm.fase === 'jugando' && R.as[dm.turno]) txt += ' · ' + (dm.turno === R.yo ? '👉 <b>Tu turno</b>' : 'turno de ' + (R.as[dm.turno].cpu ? '🤖 ' : '') + L.esc(R.as[dm.turno].nombre));
    if (dm && dm.parejas && R.yo >= 0) txt += ' · pareja con ' + L.esc((R.as[(R.yo + 2) % 4] || {}).nombre || '');
    b.innerHTML = '<span class="olBT">' + txt + '</span>';
    if (esHost()) { var v = L.boton('↩ Lobby', '', function () { if (confirm('¿Volver al lobby? Se cierra esta partida.')) L.volverAlLobby(['dm', 'dmAs']); }); v.className = ''; b.appendChild(v); }
    b.classList.add('on');
  }

  /* ---------- lobby ---------- */
  function opDe(est, humanos) {                                          // opciones con valores por defecto, ajustadas a las personas de la sala
    var op = est.op || {}, maxCpu = Math.max(0, Math.min(2, 4 - humanos));
    var cpu = Math.max(0, Math.min(maxCpu, op.cpu | 0)), n = humanos + cpu;
    return { cpu: cpu, maxCpu: maxCpu, n: n, parejas: n === 4 && op.parejas !== false, juntos: !!op.juntos, meta: DE.METAS.indexOf(op.meta) >= 0 ? op.meta : 50 };
  }
  function opciones(host, est) {
    var humanos = S.jug.length, op = opDe(est, humanos), META = { 0: '1 mano', 50: 'a 50 puntos', 100: 'a 100 puntos' };
    var resumen = op.n + ' jugadores (' + humanos + (humanos === 1 ? ' persona' : ' personas') + (op.cpu ? ' + ' + op.cpu + ' CPU' : '') + ') · ' + META[op.meta] + (op.parejas ? ' · por parejas' : '');
    if (!host) return [L.mk('div', 'olNota', 'Partida: <b>' + L.esc(resumen) + '</b>')];
    function envia(n) { S.enviar('todos', { tipo: 'estado', op: Object.assign({ cpu: op.cpu, parejas: op.parejas, meta: op.meta, juntos: op.juntos }, n) }).catch(function () {}); }
    var f0 = L.mk('div', 'olOp'); f0.appendChild(L.mk('span', '', 'CPU:'));
    [0, 1, 2].forEach(function (k) { var b = L.boton(String(k), op.cpu === k ? 'on' : '', function () { envia({ cpu: k }); }); b.disabled = k > op.maxCpu; f0.appendChild(b); });
    var f1 = L.mk('div', 'olOp'); f1.appendChild(L.mk('span', '', 'Partida:'));
    [[0, '1 mano'], [50, 'A 50'], [100, 'A 100']].forEach(function (k) { f1.appendChild(L.boton(k[1], op.meta === k[0] ? 'on' : '', function () { envia({ meta: k[0] }); })); });
    var nodos = [f0, f1];
    if (op.n === 4) {
      var f2 = L.mk('div', 'olOp'); f2.appendChild(L.mk('span', '', 'Por parejas:'));
      f2.appendChild(L.boton('Sí', op.parejas ? 'on' : '', function () { envia({ parejas: true }); }));
      f2.appendChild(L.boton('No', !op.parejas ? 'on' : '', function () { envia({ parejas: false }); }));
      nodos.push(f2);
      if (op.parejas && humanos === 2 && op.cpu === 2) {
        var f3 = L.mk('div', 'olOp'); f3.appendChild(L.mk('span', '', 'Las 2 personas:'));
        f3.appendChild(L.boton('Rivales', !op.juntos ? 'on' : '', function () { envia({ juntos: false }); }));
        f3.appendChild(L.boton('En la misma pareja', op.juntos ? 'on' : '', function () { envia({ juntos: true }); }));
        nodos.push(f3);
      }
    }
    nodos.push(L.mk('div', 'olNota', 'Partida: <b>' + L.esc(resumen) + '</b>. ' + (op.maxCpu ? 'Hasta ' + op.maxCpu + ' CPU: juegan en el móvil del anfitrión.' : 'La mesa está completa: no caben CPU.') + ' Cada uno ve solo sus fichas.'));
    return nodos;
  }
  function preparar(ctx) {
    var humanos = ctx.jug, op = opDe({ op: ctx.op || {} }, humanos.length), as = humanos.map(function (p) { return { id: p.id, nombre: p.nombre, cpu: false }; });
    for (var k = 0; k < op.cpu; k++) as.push({ id: null, nombre: 'CPU ' + (k + 1), cpu: true });
    if (op.parejas && op.juntos && humanos.length === 2 && op.cpu === 2) as = [as[0], as[2], as[1], as[3]];   // personas en los asientos 1 y 3: compañeros
    var pt = DE.crear({ n: as.length, parejas: op.parejas, meta: op.meta });
    R.pendiente = pt;                                                     // la copia completa se queda en el anfitrión
    var roles = {};                                                       // cada persona recibe su mano antes de empezar
    as.forEach(function (a, i) { if (!a.cpu) roles[a.id] = { domino: { p: i, mano: pt.manos[i].slice(), ronda: (ctx.estado.ronda || 0) + 1 } }; });
    return { estado: { dm: DE.publico(pt), dmAs: as, op: { cpu: op.cpu, parejas: op.parejas, meta: op.meta, juntos: op.juntos } }, roles: roles };
  }
  function alEstado(est) {
    if (!en()) return;
    if (est.phase === 'lobby' || !est.dm || !est.dmAs) { salir(); return; }
    if (!R.activo || R.ronda !== est.ronda) { iniciar(est); return; }
    if (!esHost()) esperarUI().then(function (ui) { if (R.activo) ui.publico(est.dm); }).catch(function () {});
    pintarBarra();
  }

  L.registrar('domino', { opciones: opciones, preparar: preparar, alEstado: alEstado, alCerrar: salir });
  S.on('msg', alMensaje);
  S.on('rol', function (r) {                                              // mi mano (también al recargar la página)
    if (!R.activo || esHost() || !r || !r.domino || !Array.isArray(r.domino.mano) || r.domino.ronda !== R.ronda) return;
    R.mano = r.domino.mano; if (window.Domino && window.Domino.online) window.Domino.online.mano(R.mano);
  });
})();

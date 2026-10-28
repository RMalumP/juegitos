/* js/online/j-oca.js — Juego de la Oca ONLINE (2 a 4 personas, y el anfitrión puede sentar CPU mientras la mesa no pase de 4).
   · El anfitrión es el árbitro: tira los dados por todos (nadie puede trucarlos), juega por las CPU y guarda la partida en Sala.guardarExtra
     para recuperarla si recarga la página.
   · Estado público (`oc`, a todos): la partida entera (en la oca no hay nada oculto). `ocAs` son los asientos: [{ id|null, nombre, cpu }].
   · Los invitados solo piden tirar ({ tipo:'accion', a:'tirar' }); el anfitrión lo valida con el mismo motor (js/online/oca-engine.js).
     La interfaz es la de js/games/oca.js (window.Oca.online). */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala, OE = window.OcaEngine;
  var R = { activo: false, ronda: -1, as: [], yo: -1, pt: null, pendiente: null, cpuT: null };
  var en = function () { return S.activo && S.juego === 'oca'; };
  var esHost = function () { return S.host; };

  function esperarUI() {                                                   // la interfaz se carga bajo demanda (lazy-loader)
    return new Promise(function (ok, ko) {
      var n = 0;
      (function t() {
        if (window.Oca && window.Oca.online) return ok(window.Oca.online);
        if (n === 0 && typeof window.initOca === 'function') { try { window.initOca(); } catch (e) { /* se reintenta */ } }
        if (++n > 100) return ko(new Error('No se pudo cargar el juego de la oca.'));
        setTimeout(t, 60);
      })();
    });
  }

  /* ---------- árbitro (anfitrión) ---------- */
  function publicar() {
    if (!esHost() || !R.pt) return;
    S.guardarExtra({ juego: 'oca', ronda: R.ronda, pt: R.pt });
    var pub = OE.publico(R.pt);
    if (window.Oca) window.Oca.online.publico(pub);
    S.enviar('todos', { tipo: 'estado', oc: pub }).catch(function () {});
    pintarBarra();
    turnoCpu();
  }
  function turnoCpu() {
    clearTimeout(R.cpuT);
    var e = R.pt; if (!esHost() || !e || e.fase !== 'jugando' || !R.as[e.turno] || !R.as[e.turno].cpu) return;
    var p = e.turno, nj = e.nj;
    // da tiempo a que se vea la jugada anterior (la ficha avanza casilla a casilla)
    var espera = window.ocaRapido ? 30 : 1100 + (e.ultimo ? 150 * e.ultimo.camino.length + 800 * e.ultimo.saltos.length : 0);
    R.cpuT = setTimeout(function () {
      if (!R.activo || R.pt !== e || e.fase !== 'jugando' || e.turno !== p || e.nj !== nj) return;
      if (OE.tirar(e, p)) publicar();
    }, espera);
  }
  function hostTirar(p) {
    if (!R.pt || !R.as[p] || R.as[p].cpu) return false;
    if (!OE.tirar(R.pt, p)) return false;
    publicar(); return true;
  }
  function alMensaje(m) {
    if (!esHost() || !en() || !R.activo || !R.pt || m.tipo !== 'accion' || m.a !== 'tirar') return;
    var p = -1; R.as.forEach(function (a, i) { if (a.id && a.id === m.de) p = i; });
    if (p < 0) return;
    if (!hostTirar(p)) publicar();                                          // fuera de turno: se reenvía lo real
  }

  /* ---------- puesta en marcha y fin ---------- */
  function volver() { if (esHost() && confirm('¿Volver al lobby? Se cierra esta partida.')) L.volverAlLobby(['oc', 'ocAs']); }
  function iniciar(est) {
    R.activo = true; R.ronda = est.ronda; R.as = est.ocAs || []; R.pt = null;
    R.yo = -1; R.as.forEach(function (a, i) { if (a.id && a.id === S.uid) R.yo = i; });
    if (esHost()) {
      var pt = R.pendiente; R.pendiente = null;
      if (!pt) { var ex = S.leerExtra(); if (ex && ex.juego === 'oca' && ex.ronda === est.ronda && ex.pt) pt = OE.restaurar(ex.pt); }
      if (!pt && est.oc) pt = OE.restaurar(est.oc);                      // el estado público es la partida entera
      if (!pt) { S.toast('No se pudo recuperar la partida de la oca. Vuelve a empezar.'); R.activo = false; L.volverAlLobby(['oc', 'ocAs']); return; }
      R.pt = pt;
    }
    var cfg = { p: R.yo, jug: R.as.map(function (a) { return { nombre: a.nombre, cpu: !!a.cpu }; }), host: esHost(), pub: esHost() ? OE.publico(R.pt) : est.oc,
      tirar: function () { if (esHost()) hostTirar(R.yo); else S.enviar('host', { tipo: 'accion', a: 'tirar' }).catch(function (e) { S.toast(e.message); }); },
      lobby: volver };
    var ronda = est.ronda;
    esperarUI().then(function (ui) {
      if (!R.activo || R.ronda !== ronda) return;
      ui.iniciar(cfg);
      if (esHost()) publicar();                                           // y sigue si le toca a una CPU
    }).catch(function (e) { S.toast(e.message); });
    pintarBarra();
  }
  function salir() {
    var estaba = R.activo; R.activo = false; R.ronda = -1; R.pt = null; R.pendiente = null; clearTimeout(R.cpuT);
    var b = L.barra('winOca'); if (b) b.classList.remove('on');
    if (estaba && window.Oca && window.Oca.online) window.Oca.online.salir();
  }
  function pintarBarra() {
    var b = L.barra('winOca'); if (!b) return;
    if (!R.activo || !en()) { b.classList.remove('on'); return; }
    var oc = esHost() && R.pt ? R.pt : S.estado.oc, txt = '🌐 ' + L.esc(S.sala);
    if (oc && oc.fase === 'jugando' && R.as[oc.turno]) txt += ' · ' + (oc.turno === R.yo ? '👉 <b>Tu turno</b>' : 'turno de ' + (R.as[oc.turno].cpu ? '🤖 ' : '') + L.esc(R.as[oc.turno].nombre));
    b.innerHTML = '<span class="olBT">' + txt + '</span>';
    if (esHost()) { var v = L.boton('↩ Lobby', '', volver); v.className = ''; b.appendChild(v); }
    b.classList.add('on');
  }

  /* ---------- lobby ---------- */
  function opDe(est, humanos) {                                          // opciones con valores por defecto, ajustadas a las personas de la sala
    var op = est.op || {}, maxCpu = Math.max(0, 4 - humanos);
    return { cpu: Math.max(0, Math.min(maxCpu, op.cpu | 0)), maxCpu: maxCpu, dados: op.dados === 2 ? 2 : 1, oca59: op.oca59 === 'gana' ? 'gana' : 'rebota' };
  }
  function opciones(host, est) {
    var humanos = S.jug.length, op = opDe(est, humanos), n = humanos + op.cpu;
    var resumen = n + ' jugadores (' + humanos + (humanos === 1 ? ' persona' : ' personas') + (op.cpu ? ' + ' + op.cpu + ' CPU' : '') + ') · ' + (op.dados === 2 ? '2 dados' : '1 dado') + ' · oca 59: ' + (op.oca59 === 'gana' ? 'gana' : 'pasa a la 63 y retrocede');
    if (!host) return [L.mk('div', 'olNota', 'Partida: <b>' + L.esc(resumen) + '</b>')];
    function envia(x) { S.enviar('todos', { tipo: 'estado', op: Object.assign({ cpu: op.cpu, dados: op.dados, oca59: op.oca59 }, x) }).catch(function () {}); }
    var f0 = L.mk('div', 'olOp'); f0.appendChild(L.mk('span', '', 'CPU:'));
    [0, 1, 2, 3].forEach(function (k) { var b = L.boton(String(k), op.cpu === k ? 'on' : '', function () { envia({ cpu: k }); }); b.disabled = k > op.maxCpu; f0.appendChild(b); });
    var f1 = L.mk('div', 'olOp'); f1.appendChild(L.mk('span', '', 'Dados:'));
    f1.appendChild(L.boton('1 dado', op.dados === 1 ? 'on' : '', function () { envia({ dados: 1 }); }));
    f1.appendChild(L.boton('2 dados', op.dados === 2 ? 'on' : '', function () { envia({ dados: 2 }); }));
    var f2 = L.mk('div', 'olOp'); f2.appendChild(L.mk('span', '', 'Oca 59:'));
    f2.appendChild(L.boton('Pasa a la 63 y retrocede', op.oca59 === 'rebota' ? 'on' : '', function () { envia({ oca59: 'rebota' }); }));
    f2.appendChild(L.boton('Gana', op.oca59 === 'gana' ? 'on' : '', function () { envia({ oca59: 'gana' }); }));
    return [f0, f1, f2, L.mk('div', 'olNota', 'Partida: <b>' + L.esc(resumen) + '</b>. ' + (op.maxCpu ? 'Las CPU juegan en el móvil del anfitrión, que tira los dados por todos.' : 'La mesa está completa: no caben CPU.'))];
  }
  function preparar(ctx) {
    var humanos = ctx.jug, op = opDe({ op: ctx.op || {} }, humanos.length), as = humanos.map(function (p) { return { id: p.id, nombre: p.nombre, cpu: false }; });
    for (var k = 0; k < op.cpu; k++) as.push({ id: null, nombre: 'CPU ' + (k + 1), cpu: true });
    var pt = OE.crear({ n: as.length, dados: op.dados, oca59: op.oca59 });
    R.pendiente = pt;
    return { estado: { oc: OE.publico(pt), ocAs: as, op: { cpu: op.cpu, dados: op.dados, oca59: op.oca59 } } };
  }
  function alEstado(est) {
    if (!en()) return;
    if (est.phase === 'lobby' || !est.oc || !est.ocAs) { salir(); return; }
    if (!R.activo || R.ronda !== est.ronda) { iniciar(est); return; }
    if (!esHost()) esperarUI().then(function (ui) { if (R.activo) ui.publico(est.oc); }).catch(function () {});
    pintarBarra();
  }

  L.registrar('oca', { opciones: opciones, preparar: preparar, alEstado: alEstado, alCerrar: salir });
  S.on('msg', alMensaje);
})();

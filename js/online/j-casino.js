/* js/online/j-casino.js — Póquer Texas Hold'em ONLINE (2–8) con la mesa del juego ORIGINAL (js/core.js + css/games/poker.css): los mismos asientos con D/SB/BB,
   las cartas dibujadas, el panel de subida (− / +, deslizador, Mín, ½ Bote, Bote, Máx), la pregunta de enseñar las cartas al retirarse, «Toca la pantalla para
   continuar», la ventana «Resultado de la mano», la de «Fin de la partida» y la chuleta «📋 Manos». (La Ruleta y el Blackjack online también usan los juegos originales.)
   El anfitrión ejecuta el motor (js/online/casino-engine.js, con tests) y publica lo que cada jugador debe ver: `mesa` (público) y las dos cartas de cada uno por su
   canal privado (`rol`). Los jugadores solo mandan acciones («igualar», «subir a 80»…); el anfitrión las valida con el motor. Si el anfitrión recarga la página,
   recupera la mesa desde su copia guardada. core.js es un script global: el panel de subida se reutiliza dándole sus variables (Ot, $t, Zt, Ut, Dt, Kt, qt) y los
   botones del juego (pkAct, pkConfirmFold) se envuelven, como en j-blackjack.js. Fichas virtuales, sin dinero real. */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala, CE = window.CasinoEngine, esc = L.esc, mk = L.mk;
  var $ = function (id) { return document.getElementById(id); };
  var APUESTAS = ['preflop', 'flop', 'turn', 'river'];
  var st = { s: null, activo: false, sigT: null, listos: {}, visto: '', clave: '', ver: true, manoVer: -1, revealEn: 0, eraMio: false };
  var en = function () { return S.activo && S.juego === 'poker'; };
  var jugando = function () { return en() && (S.estado.phase === 'jugando' || S.estado.phase === 'fin') && !!S.estado.mesa; };
  function rng() { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }
  var o = { pkAct: pkAct, pkConfirmFold: pkConfirmFold, ovClick: $('pkOverlayBtn').onclick };

  /* ---------- cartas (las del juego original) ---------- */
  function cartaJ(c) { var p = CE.palo(c); return { s: CE.PALOS[p], v: CE.RANGOS[CE.rango(c)], cl: p === 1 || p === 2 ? 'red' : 'blk' }; }
  function mini(c) { return Rn(cartaJ(c)); }
  function tapada(cls) { return mk('div', 'pkMini ' + cls); }
  function grande(c) {
    var k = cartaJ(c), d = mk('div', 'pkBig ' + k.cl + (st.ver ? ' flip' : ''));
    d.innerHTML = '<div class="pkBack">🂠</div><div class="pkFace"><div class="pkct">' + k.v + k.s + '</div><div class="pkcm">' + l(k.v, k.s, k.cl, 1.2) + '</div><div class="pkcb">' + k.v + k.s + '</div></div>';
    d.onclick = function () { st.ver = !st.ver; document.querySelectorAll('#pkHole .pkBig').forEach(function (e) { e.classList.toggle('flip', st.ver); }); pista(); };
    return d;
  }
  function pista() { $('pkRevealHint').textContent = (miTurno() ? '' : 'Tus cartas · ') + (st.ver ? '👆 Toca tus cartas para ocultarlas' : '👆 Toca tus cartas para verlas'); }

  /* ---------- publicar (anfitrión) ---------- */
  function vista() { return CE.Poker.vista(st.s); }
  function guardar() { S.guardarExtra({ juego: 'poker', eng: st.s }); }
  function holes() { // cada jugador recibe sus dos cartas por su canal privado
    var s = st.s; if (!s) return Promise.resolve();
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
    var s = st.s; if (!s || s.fase !== 'showdown') return;
    clearTimeout(st.sigT); st.listos = {};
    var r = CE.Poker.repartir(s, rng); if (!r.ok && s.fase === 'fin') publicar(false, { phase: 'fin', resultado: 'Fin de la partida' }); else publicar(true);
  }
  function comprobarListos() {                          // la mano siguiente sale cuando todos los que siguen con fichas han pulsado «Siguiente mano»
    var s = st.s; if (!s || s.fase !== 'showdown') return;
    if (s.jug.every(function (j) { return j.coins <= 0 || st.listos[j.id]; })) siguiente();
  }

  /* ---------- acciones: de los invitados (por mensaje) y del propio anfitrión (directas) ---------- */
  function ejecutar(id, m) {
    var s = st.s, r = { ok: false, error: 'No válido' }; if (!s || !m) return r;
    var P = CE.Poker;
    if (['fold', 'check', 'call', 'raise', 'allin'].indexOf(m.a) >= 0) r = P.accion(s, id, { a: m.a, m: m.m, ver: !!m.ver });
    else if (m.a === 'saltar' && id === S.uid) r = P.saltar(s);
    else if (m.a === 'sig') { if (s.fase === 'showdown') { if (id === S.uid) siguiente(); else { st.listos[id] = true; comprobarListos(); } } return { ok: true }; }
    if (r.ok && s.fase === 'showdown') { st.listos = {}; programarSiguiente(20000); }
    if (r.ok) publicar();
    return r;
  }
  function alMensaje(m) {
    if (!S.host || !jugando() || m.tipo !== 'accion') return;
    var r = ejecutar(m.de, m);
    if (!r.ok && r.error) S.enviar(m.de, { tipo: 'evento', k: 'aviso', texto: r.error }).catch(function () {});
  }
  function actuar(m) {                                   // desde mi propia interfaz
    if (S.host) { var r = ejecutar(S.uid, m); if (!r.ok && r.error) S.toast(r.error); }
    else S.enviar('host', Object.assign({ tipo: 'accion' }, m)).catch(function (e) { S.toast(e.message); });
  }

  /* ---------- envoltorios de los botones del juego ---------- */
  pkAct = function (a) {
    if (!st.activo) return o.pkAct(a);
    if (!miTurno()) return;
    pkCloseRaise();
    if (a === 'fold') { $('pkFoldDlg').classList.add('show'); return; }
    if (a === 'raise') actuar({ a: 'raise', m: Kt });
    else actuar({ a: a });
  };
  pkConfirmFold = function (ver) {
    if (!st.activo) return o.pkConfirmFold(ver);
    $('pkFoldDlg').classList.remove('show');
    if (miTurno()) actuar({ a: 'fold', ver: !!ver });
  };
  $('pkOverlayBtn').onclick = function () {
    if (!st.activo) return o.ovClick.call(this);
    $('pkOverlay').classList.remove('show');
    if (mesa().fase === 'fin' || S.estado.phase === 'fin') { if (S.host) L.volverAlLobby(['mesa', 'resultado']); return; }
    actuar({ a: 'sig' });
    if (!S.host) $('pkMsg').textContent = '⏳ Esperando a los demás para la siguiente mano…';
  };
  $('pokerWrap').addEventListener('click', function (e) {     // «Toca la pantalla para continuar», como en el offline
    if (!st.activo || st.etapa !== 'reveal' || Date.now() - st.revealEn < 400) return;
    if (e.target.closest('#pkOverlay') || e.target.closest('#pkFoldDlg') || e.target.closest('#pkCheatSheet')) return;
    st.manoVer = mesa().mano; pintar();
  });

  /* ---------- interfaz: la mesa del juego original ---------- */
  function mesa() { return (S.host && st.s ? vista() : S.estado.mesa) || {}; }
  function yoI(s) { return (s.jug || []).findIndex(function (x) { return x.id === S.uid; }); }
  function miHole(s, i) { return S.host ? (st.s && st.s.jug[i] && st.s.jug[i].hole) : (S.rol && S.rol.hole); }
  function miTurno() { var s = mesa(), i = yoI(s); return i >= 0 && s.turno === i && APUESTAS.indexOf(s.fase) >= 0; }
  function nombreDe(s, id) { var j = (s.jug || []).filter(function (x) { return x.id === id; })[0]; return j ? j.nombre : '?'; }
  function boteVisible(s) { return s.fase === 'showdown' && s.resultado ? s.resultado.botes.reduce(function (t, b) { return t + b.cantidad; }, 0) : s.bote; }

  // El panel de subida del juego (Hn, pkOpenRaise, pkRaiseQuick…) lee estas variables de core.js.
  function variablesDelJuego(s, i) {
    Ot = s.jug.map(function (j) { return { name: j.nombre, coins: j.coins, bet: j.apostado, hole: [], folded: j.fold, allIn: j.allin, out: j.fuera, acted: j.actuo }; });
    $t = i; Zt = s.apuestaActual; Ut = s.minSubida; Dt = s.bote; qt = s.ciegaG; Jt = s.ciegaP;
  }

  function pintarAsientos(s, i, etapa) {
    var fin = etapa === 'reveal' || etapa === 'handover', res = s.resultado || {}, manos = res.manos || {}, gan = res.ganadores || [];
    $('pkStageLbl').textContent = s.fase === 'showdown' ? 'SHOWDOWN' : (s.fase || '').toUpperCase();
    $('pkPot').textContent = 'Bote: 💰' + boteVisible(s);
    var b = $('pkBoard'); b.innerHTML = '';
    for (var k = 0; k < 5; k++) b.appendChild(s.com[k] !== undefined ? mini(s.com[k]) : mk('div', 'pkBoardSlot'));
    var cont = $('pkSeats'); cont.innerHTML = '';
    s.jug.forEach(function (j, k) {
      var gana = fin && gan.indexOf(j.id) >= 0;
      var d = mk('div', 'pkSeat' + (s.turno === k && APUESTAS.indexOf(s.fase) >= 0 ? ' active' : '') + (j.fold && !j.fuera ? ' folded' : '') + (j.fuera ? ' out' : '') + (gana ? ' winner' : '') + (k === i ? ' pkYo' : ''));
      var badge = k === s.boton ? '<div class="pkBadge d">D</div>' : k === s.sb ? '<div class="pkBadge sb">SB</div>' : k === s.bb ? '<div class="pkBadge bb">BB</div>' : '<div class="pkBadge empty"></div>';
      var estado = j.fuera ? '<span class="pkSeatStatus fold">Eliminado</span>' : etapa === 'handover' && gana ? '<span class="pkSeatStatus winS">GANA</span>' : j.fold ? '<span class="pkSeatStatus fold">Retirado</span>' : j.allin ? '<span class="pkSeatStatus allin">ALL IN</span>' : '';
      d.innerHTML = badge + '<span class="pkSeatName">' + esc(j.nombre) + (k === i ? ' (tú)' : '') + '</span><span class="pkSeatCoins">💰' + j.coins + '</span><span class="pkSeatBet">' + (j.apostado > 0 ? '▸' + j.apostado : '') + '</span>' + estado;
      if (!j.fuera && j.nCartas) {
        var c = mk('span', 'pkSeatCards'), h = j.hole || (fin && k === i && j.fold && j.mostro ? miHole(s, i) : null);
        if (fin && h && h.length) {
          h.forEach(function (x) { c.appendChild(mini(x)); });
          if (manos[j.id] && !j.fold) c.appendChild(mk('span', 'pkSeatHand', esc(manos[j.id].nombre)));
        } else for (var n = 0; n < j.nCartas; n++) c.appendChild(tapada(fin && j.fold ? 'hiddenCard' : 'faceDown'));
        d.appendChild(c);
      }
      cont.appendChild(d);
    });
  }

  function pintarTurno(s, i) {
    var t = $('pkTurn');
    if (APUESTAS.indexOf(s.fase) < 0) { t.style.display = 'none'; return; }
    t.style.display = 'flex';
    var yo = s.jug[i], tj = s.jug[s.turno], mio = miTurno();
    $('pkTurnName').textContent = mio ? 'Tu turno  ·  💰' + yo.coins : tj ? '⏳ Turno de ' + tj.nombre + '  ·  💰' + tj.coins : '';
    var hole = $('pkHole'); hole.innerHTML = '';
    var h = i >= 0 && !yo.fuera ? miHole(s, i) : null;
    if (h && h.length && !yo.fold) h.forEach(function (c) { hole.appendChild(grande(c)); });
    $('pkRevealHint').style.display = h && h.length && !yo.fold ? '' : 'none'; pista();
    var acc = $('pkActions'), lbl = $('pkToCallLbl');
    if (!mio) {
      acc.style.display = 'none'; $('pkRaisePanel').classList.remove('show');
      lbl.textContent = (yo && yo.fold ? 'Te has retirado de esta mano' : yo && yo.allin ? 'Vas ALL IN' : 'Esperando a ' + (tj ? tj.nombre : '…')) + '  ·  Bote: ' + s.bote;
      return;
    }
    var pagar = s.apuestaActual - yo.apostado;
    lbl.textContent = pagar > 0 ? 'Para igualar: ' + Math.min(pagar, yo.coins) + '  ·  Bote: ' + s.bote : 'Sin apuesta — puedes pasar  ·  Bote: ' + s.bote;
    $('pkCheckBtn').textContent = pagar <= 0 ? 'Pasar' : 'Igualar ' + Math.min(pagar, yo.coins) + (pagar >= yo.coins ? ' (all-in)' : '');
    var max = yo.apostado + yo.coins;
    $('pkRaiseBtn').disabled = !(max > s.apuestaActual && yo.coins > Math.max(0, pagar));
    $('pkAllinBtn').disabled = yo.coins <= 0;
    var clave = s.mano + '|' + s.fase + '|' + s.turno + '|' + s.apuestaActual;
    if (clave !== st.clave) { st.clave = clave; pkCloseRaise(); }                       // el panel de subida se queda abierto mientras siga siendo tu turno
    else if (!$('pkRaisePanel').classList.contains('show')) acc.style.display = 'flex';
  }

  function pintarFinal(s, etapa) {
    var ov = $('pkOverlay'), hint = $('pkContinueHint');
    hint.classList.toggle('show', etapa === 'reveal');
    if (etapa === 'fin') {
      var g = s.jug.filter(function (x) { return x.id === s.ganador; })[0] || s.jug.reduce(function (a, b) { return a.coins >= b.coins ? a : b; });
      $('pkOverlayBig').textContent = '👑'; $('pkOverlayTitle').textContent = 'Fin de la partida';
      $('pkOverlayMsg').textContent = '¡' + g.nombre + ' gana la partida con 💰' + g.coins + '!';
      $('pkOverlayBtn').textContent = S.host ? '↩ Volver a la sala' : 'Cerrar';
      if (st.visto !== 'fin') { st.visto = 'fin'; ov.classList.add('show'); }
      return;
    }
    if (etapa !== 'handover') { ov.classList.remove('show'); return; }
    var res = s.resultado, gn = res.ganancias || {};
    var lineas = Object.keys(gn).map(function (id) { return nombreDe(s, id) + ' (+' + gn[id] + ') ' + (res.motivo === 'todos se retiran' ? '— los demás se retiraron' : (res.manos[id] ? res.manos[id].nombre : '')); });
    $('pkOverlayBig').textContent = '🏆'; $('pkOverlayTitle').textContent = 'Resultado de la mano';
    $('pkOverlayMsg').textContent = (res.motivo === 'todos se retiran' ? '' : 'Showdown\n') + lineas.join('\n');
    $('pkOverlayBtn').textContent = 'Siguiente mano';
    var k = 'mano' + s.mano; if (st.visto !== k) { st.visto = k; ov.classList.add('show'); }
  }

  function pintar() {
    if (!st.activo) return;
    var s = mesa(); if (!s.jug) return;
    var i = yoI(s), turnoMio = miTurno();
    if (s.mano !== st.manoNueva) { st.manoNueva = s.mano; st.ver = true; $('pkMsg').textContent = ''; $('pkFoldDlg').classList.remove('show'); }
    var etapa = s.fase === 'fin' || S.estado.phase === 'fin' ? 'fin' : s.fase === 'showdown' ? (st.manoVer === s.mano ? 'handover' : 'reveal') : 'juego';
    if (etapa === 'reveal' && st.etapa !== 'reveal') st.revealEn = Date.now();
    st.etapa = etapa;
    variablesDelJuego(s, i);
    pintarAsientos(s, i, etapa);
    pintarTurno(s, i);
    pintarFinal(s, etapa);
    if (turnoMio && !st.eraMio && window.Vibra) window.Vibra.pulso([30, 40, 30]);                   // te toca
    st.eraMio = turnoMio;
    pintarBarra(s, i);
  }
  function pintarBarra(s, i) {
    var b = L.barra('winPoker'); if (!b) return;
    var tj = APUESTAS.indexOf(s.fase) >= 0 ? s.jug[s.turno] : null;
    b.innerHTML = '<span class="olBT">🌐 ' + esc(S.sala) + ' · mano ' + s.mano + ' · ciegas ' + s.ciegaP + '/' + s.ciegaG + (tj ? ' · ' + (s.turno === i ? '👉 <b>Tu turno</b>' : 'turno de ' + esc(tj.nombre)) : '') + '</span>';
    if (S.host) {
      if (tj && s.turno !== i) { var sk = L.boton('⏭ Saltar', '', function () { actuar({ a: 'saltar' }); }); sk.className = ''; sk.title = 'Pasa o retira al jugador que no responde'; b.appendChild(sk); }
      var v = L.boton('↩ Lobby', '', function () { if (confirm('¿Volver al lobby? Se pierde la mesa actual.')) { clearTimeout(st.sigT); st.s = null; L.volverAlLobby(['mesa', 'resultado']); } }); v.className = ''; b.appendChild(v);
    }
    b.classList.add('on');
  }

  /* ---------- puesta en marcha y fin ---------- */
  function activar() {
    if (st.activo) return;
    st.activo = true; st.visto = ''; st.clave = ''; st.manoVer = -1; st.manoNueva = -1; st.etapa = '';
    Vt(); Gt = 'idle';                                    // la partida offline se cierra; «idle» deja quietos sus atajos (tocar para seguir, guardar)
    $('winPoker').classList.add('pkOnline');
    $('pkSetup').style.display = 'none'; $('pkPeek').classList.remove('show'); $('pkTable').classList.add('show');
  }
  function salir() {
    if (!st.activo) return;
    st.activo = false; clearTimeout(st.sigT); st.listos = {};
    $('winPoker').classList.remove('pkOnline'); $('pkFoldDlg').classList.remove('show'); $('pkContinueHint').classList.remove('show'); $('pkMsg').textContent = '';
    $('pkActions').style.display = 'flex'; $('pkRevealHint').style.display = '';
    var b = L.barra('winPoker'); if (b) b.classList.remove('on');
    Vt();
  }

  /* ---------- lobby ---------- */
  function opciones(host, est) {
    var op = est.op || {}, nodos = [];
    if (!host) return [mk('div', 'olNota', 'Monedas por jugador: <b>' + (op.fichas || 1000) + '</b> · ciegas <b>' + (op.ciegaP || 10) + '/' + (op.ciegaG || 20) + '</b>.')];
    var f = mk('div', 'olOp'); f.appendChild(mk('span', '', 'Monedas:'));
    [500, 1000, 2000, 5000].forEach(function (n) { f.appendChild(L.boton(String(n), (op.fichas || 1000) === n ? 'on' : '', function () { S.enviar('todos', { tipo: 'estado', op: Object.assign({}, op, { fichas: n }) }).catch(function () {}); })); });
    nodos.push(f);
    var c = mk('div', 'olOp'); c.appendChild(mk('span', '', 'Ciegas:'));
    [[5, 10], [10, 20], [25, 50], [50, 100]].forEach(function (x) { c.appendChild(L.boton(x[0] + '/' + x[1], (op.ciegaG || 20) === x[1] ? 'on' : '', function () { S.enviar('todos', { tipo: 'estado', op: Object.assign({}, op, { ciegaP: x[0], ciegaG: x[1] }) }).catch(function () {}); })); });
    nodos.push(c);
    nodos.push(mk('div', 'olNota', 'La misma mesa y las mismas reglas que el póquer offline. Fichas virtuales para jugar entre amigos, sin dinero real.'));
    return nodos;
  }
  function preparar(ctx) {
    var op = ctx.op || {}, jugadores = ctx.jug.map(function (p) { return { id: p.id, nombre: p.nombre }; });
    clearTimeout(st.sigT); st.listos = {};
    st.s = CE.Poker.nueva(jugadores, { fichas: op.fichas || 1000, ciegaP: op.ciegaP, ciegaG: op.ciegaG }); CE.Poker.repartir(st.s, rng); guardar();
    var roles = {}; st.s.jug.forEach(function (x) { roles[x.id] = { hole: x.hole }; });
    return { estado: { mesa: vista(), resultado: null, op: op }, roles: roles };
  }
  function alEstado(est) {
    if (!en()) return;
    if (S.host && est.phase === 'jugando' && !st.s) {                     // el anfitrión recargó: recupera la mesa guardada
      var ex = S.leerExtra(); if (ex && ex.eng) { st.s = ex.eng; publicar(true); if (st.s.fase === 'showdown') programarSiguiente(20000); }
    }
    if (est.phase === 'lobby') { st.s = null; clearTimeout(st.sigT); }
    if (jugando()) { activar(); pintar(); } else salir();
  }
  function alCerrar() { st.s = null; clearTimeout(st.sigT); salir(); }
  function alEvento(m) { if (m.k === 'aviso' && en()) S.toast(m.texto); }

  L.registrar('poker', { opciones: opciones, preparar: preparar, alEstado: alEstado, alCerrar: alCerrar });
  S.on('msg', alMensaje); S.on('rol', pintar); S.on('jug', pintar); S.on('evento', alEvento);
})();

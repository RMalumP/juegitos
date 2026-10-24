/* js/online/j-parchis.js — Parchís online (2 a 4 jugadores, con bots opcionales para completar la mesa).
   El motor del juego vive dentro del iframe de Parchís (games/parchis.js) y NO se reescribe: el anfitrión lo ejecuta tal cual (dados, jugadas, bots) y publica
   una «foto» del estado (`g`) después de cada cambio; los invitados la pintan con las funciones del propio juego. Los invitados solo mandan sus intenciones
   («tirar», «mover la ficha N»); el anfitrión las valida (es su turno, la ficha puede moverse) antes de ejecutarlas.
   Recarga: el anfitrión recupera su motor desde la última foto y los invitados vuelven a recibirla. Colores: 2 jugadores = opuestos (rojo/amarillo). */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala;
  var $ = function (id) { return document.getElementById(id); };
  var st = { activa: false, ronda: -1, iniciado: false, tablero: false, pubT: null, ultimaFoto: '' };
  var ORDEN_COLORES = [0, 2, 1, 3];
  var NOMBRES = ['Rojo', 'Verde', 'Amarillo', 'Azul'], EMOJI = ['🔴', '🟢', '🟡', '🔵'];

  var en = function () { return S.activo && S.juego === 'parchis'; };
  var jugando = function () { return en() && S.estado.phase === 'jugando'; };
  var online = function () { return en() && S.estado.phase !== 'lobby' && !!S.estado.mesa; };
  var miAsiento = function () { var m = S.estado.mesa; if (!m) return -1; for (var i = 0; i < m.length; i++) if (m[i].id === S.uid) return i; return -1; };
  var G = function (w) { return w.eval('G'); };

  function esperarFrame() {
    return new Promise(function (ok, ko) {
      var n = 0;
      (function t() {
        var f = $('parchisFrame'), w = f && f.contentWindow;
        if (w && typeof w.startGame === 'function' && typeof w.roll === 'function' && w.document && w.document.getElementById('start')) { ok(w); return; }
        if (++n > 300) { ko(new Error('Parchís no ha cargado')); return; }
        setTimeout(t, 40);
      })();
    });
  }

  /* ---------- enganche del iframe ---------- */
  function enganchar(w) {
    if (w.__ol) return;
    var o = w.__ol = { roll: w.roll, play: w.play, render: w.render, checkWin: w.checkWin };
    w.roll = function () {
      if (!online()) return o.roll.apply(this, arguments);
      var g = G(w); if (!g || g.finished || g.phase !== 'roll' || g.busy || miAsiento() !== g.turn) return;
      if (S.host) o.roll(); else S.enviar('host', { tipo: 'accion', a: 'roll' }).catch(function (e) { S.toast(e.message); });
    };
    w.play = function (ti) {
      if (!online()) return o.play.apply(this, arguments);
      var g = G(w); if (!g || g.finished || g.phase !== 'move' || g.busy || miAsiento() !== g.turn) return;
      if (S.host) o.play(ti); else S.enviar('host', { tipo: 'accion', a: 'play', ti: ti }).catch(function (e) { S.toast(e.message); });
    };
    w.render = function () {
      var r = o.render.apply(this, arguments);
      if (online()) { retocar(w); if (S.host) programarFoto(w); }
      return r;
    };
    w.checkWin = function () { var r = o.checkWin.apply(this, arguments); if (online() && S.host) programarFoto(w); return r; };
    // los botones guardaron la función original: se vuelven a enlazar con la versión enganchada
    var d = w.document; d.getElementById('rollBtn').onclick = w.roll; d.getElementById('dice').onclick = w.roll;
    var est = d.createElement('style'); est.id = 'olEstilo'; est.textContent = '.ol #newBtn,.ol #againBtn{display:none!important}'; d.head.appendChild(est);
  }
  // En línea: solo ven aros de «puedes mover» en el turno propio; el botón de tirar solo vale en el turno propio.
  function retocar(w) {
    var d = w.document, g = G(w); if (!g) return;
    var mio = miAsiento() === g.turn;
    if (!mio) d.querySelectorAll('#tokens .ring,#tokens .hit').forEach(function (e) { e.remove(); });
    if (!mio) d.querySelectorAll('#tokens .movable').forEach(function (e) { e.classList.remove('movable'); e.removeAttribute('onclick'); });
    d.getElementById('rollBtn').disabled = !(mio && g.phase === 'roll' && !g.busy && !g.finished);
    d.getElementById('dice').classList.toggle('disabled', !(mio && g.phase === 'roll' && !g.finished));
    var m = S.estado.mesa && S.estado.mesa[g.turn];
    if (m && m.nombre) d.getElementById('turnName').textContent = g.seats[g.turn].name + ' · ' + m.nombre;
    pintarBarra(w);
  }

  /* ---------- anfitrión: motor y fotos ---------- */
  function empezarMotor(w, est) {
    var mesa = est.mesa;
    w.eval('cfg.n=' + mesa.length + ';cfg.mode="hot";cfg.startMode="out";cfg.colors=' + JSON.stringify(mesa.map(function (m) { return m.color; })));
    w.startGame();
    var g = G(w); mesa.forEach(function (m, i) { g.seats[i].cpu = !!m.cpu; });
    w.document.getElementById('game').classList.remove('hidden'); w.document.getElementById('setup').classList.add('hidden');
    w.render(); w.maybeCpu();
  }
  function foto(w) {
    var g = G(w), d = w.document;
    return { s: { seats: g.seats.map(function (s) { return { color: s.color, name: s.name, cpu: s.cpu, tokens: s.tokens.slice() }; }), turn: g.turn, phase: g.phase, value: g.value, pending: g.pending.slice(), sixStreak: g.sixStreak, lastSixToken: g.lastSixToken, rolledSix: g.rolledSix, busy: false, finished: g.finished },
      msg: d.getElementById('msg').textContent, win: g.finished ? d.getElementById('winText').textContent : '' };
  }
  function programarFoto(w) {
    clearTimeout(st.pubT);
    st.pubT = setTimeout(function () {
      if (!online() || !S.host) return;
      var f = foto(w), txt = JSON.stringify(f);
      if (txt === st.ultimaFoto) return; st.ultimaFoto = txt;
      var extra = { tipo: 'estado', g: f };
      if (f.s.finished && S.estado.phase !== 'fin') { extra.phase = 'fin'; extra.resultado = f.win; }
      S.enviar('todos', extra).catch(function () {});
    }, 90);
  }
  function restaurar(w, f) { // el anfitrión recargó: recupera su motor desde la última foto
    aplicarFoto(w, f); G(w).busy = false;
    var g = G(w);
    if (!g.finished && g.seats[g.turn].cpu) { if (g.phase === 'roll') w.maybeCpu(); else if (g.phase === 'move') setTimeout(w.cpuMove, 600); }
  }
  function alMensaje(m) {
    if (!S.host || !jugando() || m.tipo !== 'accion') return;
    var mesa = S.estado.mesa || [], idx = -1; mesa.forEach(function (x, i) { if (x.id === m.de) idx = i; });
    if (idx < 0) return;
    esperarFrame().then(function (w) {
      var g = G(w); if (!g || g.finished || g.turn !== idx || g.seats[idx].cpu || g.busy) return;
      if (m.a === 'roll' && g.phase === 'roll') w.__ol.roll();
      else if (m.a === 'play' && g.phase === 'move' && Number.isInteger(m.ti) && m.ti >= 0 && m.ti < 4) {
        var v = g.value, eff = (v === 6 && g.seats[idx].tokens.every(function (r) { return r !== -1; })) ? 7 : v;
        if (w.legalTokensEff(g.seats[idx], eff).some(function (x) { return x.ti === m.ti; })) w.__ol.play(m.ti);
      }
    });
  }

  /* ---------- invitados (y recuperación): pintar la foto con las funciones del propio juego ---------- */
  function aplicarFoto(w, f) {
    var d = w.document; w.eval('G=' + JSON.stringify(f.s));
    if (!st.tablero) { d.getElementById('setup').classList.add('hidden'); d.getElementById('game').classList.remove('hidden'); w.buildBoard(); st.tablero = true; }
    var g = G(w);
    w.render();
    d.getElementById('msg').textContent = f.msg || '';
    w.drawDice(g.phase === 'roll' ? 0 : g.value);
    if (g.finished) { d.getElementById('winText').textContent = f.win || '🏆'; d.getElementById('overlay').classList.add('show'); } else d.getElementById('overlay').classList.remove('show');
  }

  /* ---------- sincronización con el estado de la sala ---------- */
  function sincronizar(w, est) {
    var d = w.document;
    if (est.phase === 'lobby' || !est.mesa) {
      if (st.activa) {
        st.activa = false; st.iniciado = false; st.tablero = false; st.ronda = -1; st.ultimaFoto = '';
        d.body.classList.remove('ol'); d.getElementById('game').classList.add('hidden'); d.getElementById('setup').classList.remove('hidden'); d.getElementById('overlay').classList.remove('show');
        var b0 = L.barra('winParchis'); if (b0) b0.classList.remove('on');
      }
      return;
    }
    if (!st.activa || st.ronda !== est.ronda) { st.activa = true; st.ronda = est.ronda; st.iniciado = false; st.tablero = false; st.ultimaFoto = ''; d.body.classList.add('ol'); }
    if (S.host) {
      if (!st.iniciado) { st.iniciado = true; if (est.g) restaurar(w, est.g); else empezarMotor(w, est); }
    } else if (est.g) { aplicarFoto(w, est.g); }
    else d.getElementById('msg').textContent = 'Esperando a que el anfitrión empiece…';
    pintarBarra(w);
  }
  function pintarBarra(w) {
    var b = L.barra('winParchis'); if (!b) return;
    if (!online()) { b.classList.remove('on'); return; }
    var mesa = S.estado.mesa, yo = miAsiento(), txt = '🌐 ' + L.esc(S.sala);
    if (yo >= 0) txt += ' · eres ' + EMOJI[mesa[yo].color] + ' <b>' + NOMBRES[mesa[yo].color] + '</b>';
    var g = w && G(w);
    if (S.estado.phase === 'fin' && S.estado.resultado) txt += ' · ' + L.esc(S.estado.resultado);
    else if (g && g.seats && g.seats[g.turn]) txt += ' · ' + (g.turn === yo ? '👉 <b>Tu turno</b>' : 'turno de ' + EMOJI[g.seats[g.turn].color] + ' ' + L.esc(mesa[g.turn].nombre));
    b.innerHTML = '<span class="olBT">' + txt + '</span>';
    if (S.host) { var vol = L.boton('↩ Lobby', '', function () { if (confirm('¿Volver al lobby? Se pierde la partida actual.')) L.volverAlLobby(['mesa', 'g', 'resultado']); }); vol.className = ''; b.appendChild(vol); }
    b.classList.add('on');
  }

  /* ---------- lobby ---------- */
  function opciones(host, est) {
    var op = (est.op && est.op.bots) || 'no', n = S.jug.length;
    if (!host) return [L.mk('div', 'olNota', 'Bots para completar la mesa: <b>' + (op === 'si' ? 'sí (hasta 4 jugadores)' : 'no') + '</b>.')];
    var f = L.mk('div', 'olOp'); f.appendChild(L.mk('span', '', 'Bots:'));
    [['no', 'Solo personas'], ['si', 'Completar a 4 con bots']].forEach(function (k) { f.appendChild(L.boton(k[1], op === k[0] ? 'on' : '', function () { S.enviar('todos', { tipo: 'estado', op: { bots: k[0] } }).catch(function () {}); })); });
    return [f, L.mk('div', 'olNota', 'Colores por orden de llegada. Con 2 personas y sin bots, rojo contra amarillo (opuestos).')];
  }
  function preparar(ctx) {
    var bots = ctx.op && ctx.op.bots === 'si', humanos = ctx.jug, n = bots ? 4 : humanos.length, mesa = [];
    for (var i = 0; i < n; i++) {
      var p = humanos[i], color = ORDEN_COLORES[i];
      mesa.push({ id: p ? p.id : null, nombre: p ? p.nombre : 'Bot ' + (i - humanos.length + 1), color: color, cpu: !p });
    }
    return { estado: { mesa: mesa, g: null, resultado: null, op: ctx.op || {} } };
  }
  function alEstado(est) { if (!en()) return; esperarFrame().then(function (w) { enganchar(w); sincronizar(w, est); }).catch(function (e) { S.toast(e.message); }); }
  function alCerrar() { st.activa = false; st.iniciado = false; st.tablero = false; st.ronda = -1; var b = L.barra('winParchis'); if (b) b.classList.remove('on'); esperarFrame().then(function (w) { var d = w.document; d.body.classList.remove('ol'); d.getElementById('game').classList.add('hidden'); d.getElementById('setup').classList.remove('hidden'); d.getElementById('overlay').classList.remove('show'); }).catch(function () {}); }

  L.registrar('parchis', { opciones: opciones, preparar: preparar, alEstado: alEstado, alCerrar: alCerrar });
  S.on('msg', alMensaje);
})();

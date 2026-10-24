/* js/online/j-tablero.js — Ajedrez y Damas online (2 jugadores: anfitrión + 1 invitado).
   Los motores del juego viven dentro del iframe de la «Mesa de Juegos» (games/chess.js). Aquí NO se reescribe ninguna regla: se engancha el iframe
   (mismo origen) para que cada jugada local se envíe y cada jugada remota se aplique con las propias funciones del juego.
   · El anfitrión es la autoridad: valida cada jugada del invitado con las reglas del motor (turno, legalidad), la aplica y publica la lista completa de jugadas.
   · Estado público: colores {id: 'w'|'b'}, jugadas [...], resultado. Quien recarga la página reconstruye la partida repitiendo la lista de jugadas.
   · Color: al azar por defecto; el anfitrión puede elegirlo en el lobby antes de empezar. */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala;
  var $ = function (id) { return document.getElementById(id); };
  var st = { activa: false, ronda: -1, aplicadas: 0, remoto: false, jugadas: [], w: null, hook: null };

  var es = function (j) { return S.activo && S.juego === j; };
  var enTablero = function () { return es('ajedrez') || es('damas'); };
  var jugando = function () { return enTablero() && S.estado.phase === 'jugando'; };
  var miColor = function () { var c = S.estado.colores; return c ? c[S.uid] : null; };       // 'w' | 'b'
  var nombreColor = function (c) { return c === 'w' ? 'Blancas' : 'Negras'; };
  var colTurno = function (w) { return S.juego === 'ajedrez' ? w.__ol.chess.turn : (w.__ol.ck.turn === 1 ? 'w' : 'b'); };
  var colAjedrez = function (c) { return c === 'w' ? 'w' : 'b'; };

  function esperarFrame() {
    return new Promise(function (ok, ko) {
      var n = 0;
      (function t() {
        var f = $('chessFrame'), w = f && f.contentWindow;
        if (w && typeof w.executeChessMove === 'function' && typeof w.executeCkMove === 'function' && w.document && w.document.getElementById('checkersBoard') && w.document.getElementById('checkersBoard').parentNode) {
          try { w.eval('chess'); w.eval('ck'); ok(w); return; } catch (e) { /* aún no */ }
        }
        if (++n > 300) { ko(new Error('El tablero no ha cargado')); return; }
        setTimeout(t, 40);
      })();
    });
  }

  /* ---------- enganche del iframe ---------- */
  function enganchar(w) {
    if (w.__ol) return;
    var o = w.__ol = { chess: w.eval('chess'), ck: w.eval('ck'), execAj: w.executeChessMove, execCk: w.executeCkMove, clickAj: w.chessClick, clickCk: w.checkersClick, initAj: w.initChess, initCk: w.initCheckers };
    w.executeChessMove = function (fr, fc, tr, tc, flag, promo) {
      var n = o.chess.history.length, r = o.execAj.apply(this, arguments);
      if (!st.remoto && es('ajedrez') && jugando() && o.chess.history.length > n) { st.aplicadas++; enviarJugada({ a: 'aj', fr: fr, fc: fc, tr: tr, tc: tc, fl: flag || null, pr: promo || null }); }
      pintarBarra(); return r;
    };
    w.executeCkMove = function (mv) {
      var r = o.execCk.apply(this, arguments);
      if (!st.remoto && es('damas') && jugando()) { st.aplicadas++; enviarJugada({ a: 'ck', fr: mv.fr, fc: mv.fc, r: mv.r, c: mv.c, mv: { fr: mv.fr, fc: mv.fc, r: mv.r, c: mv.c, type: mv.type, capR: mv.capR, capC: mv.capC } }); }
      pintarBarra(); return r;
    };
    w.chessClick = function (r, c) {
      if (es('ajedrez') && jugando()) {
        if (colTurno(w) !== miColor()) return;
        if (o.chess.viewIndex < o.chess.history.length - 1) { S.toast('Estás viendo una jugada anterior: pulsa ⏭ para volver'); return; }
      }
      return o.clickAj.apply(this, arguments);
    };
    w.checkersClick = function (r, c) {
      if (es('damas') && jugando()) {
        if (colTurno(w) !== miColor()) return;
        if (o.ck.viewIndex < o.ck.history.length - 1) { S.toast('Estás viendo una jugada anterior: pulsa ⏭ para volver'); return; }
      }
      return o.clickCk.apply(this, arguments);
    };
    w.initChess = function () { if (es('ajedrez') && S.estado.phase !== 'lobby' && !st.remoto) { S.toast('En una partida online solo el anfitrión puede volver al lobby'); return; } return o.initAj.apply(this, arguments); };
    w.initCheckers = function () { if (es('damas') && S.estado.phase !== 'lobby' && !st.remoto) { S.toast('En una partida online solo el anfitrión puede volver al lobby'); return; } return o.initCk.apply(this, arguments); };
  }

  /* ---------- jugadas ---------- */
  function enviarJugada(j) {
    if (S.host) { st.jugadas.push(j); publicar(); }
    else S.enviar('host', Object.assign({ tipo: 'jugada' }, j)).catch(function (e) { S.toast(e.message); });
  }
  function publicar(extra) { return S.enviar('todos', Object.assign({ tipo: 'estado', jugadas: st.jugadas.slice() }, extra || {})).catch(function () {}); }
  function aplicar(w, j) {
    var o = w.__ol; st.remoto = true;
    try {
      if (j.a === 'aj') {
        if (o.chess.viewIndex < o.chess.history.length - 1) w.chessNavLast();
        o.chess.selected = null; o.chess.possibleMoves = [];
        w.executeChessMove(j.fr, j.fc, j.tr, j.tc, j.fl || undefined, j.pr || undefined);
      } else {
        if (o.ck.viewIndex < o.ck.history.length - 1) w.ckNavLast();
        o.ck.selected = null; o.ck.possibleMoves = o.ck.mustCapture ? o.ck.possibleMoves : [];
        w.executeCkMove({ fr: j.mv.fr, fc: j.mv.fc, r: j.mv.r, c: j.mv.c, type: j.mv.type, capR: j.mv.capR, capC: j.mv.capC });
      }
    } finally { st.remoto = false; }
  }
  /* El anfitrión comprueba la jugada del invitado con las reglas del propio motor y se queda con SU versión de la jugada. */
  function validar(w, m, col) {
    var o = w.__ol, ent = function (x) { return Number.isInteger(x) && x >= 0 && x < 8; };
    if (m.a === 'aj') {
      if (!es('ajedrez') || o.chess.gameOver || o.chess.turn !== colAjedrez(col) || !ent(m.fr) || !ent(m.fc) || !ent(m.tr) || !ent(m.tc)) return null;
      var b = o.chess.board, p = b[m.fr][m.fc];
      if (!p || p === ' ' || w.colorOf(p) !== o.chess.turn) return null;
      var mv = w.legalMoves(b, m.fr, m.fc, o.chess.enPassant, o.chess.castling).find(function (x) { return x.r === m.tr && x.c === m.tc; });
      if (!mv) return null;
      var prom = p.toUpperCase() === 'P' && (m.tr === 0 || m.tr === 7), pr = prom ? ('QRBN'.indexOf(m.pr) >= 0 && m.pr ? m.pr : 'Q') : null;
      return { a: 'aj', fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc, fl: mv.flag || null, pr: pr };
    }
    if (m.a === 'ck') {
      if (!es('damas') || o.ck.gameOver || o.ck.turn !== (col === 'w' ? 1 : 2) || !ent(m.fr) || !ent(m.fc) || !ent(m.r) || !ent(m.c)) return null;
      var cand = o.ck.mustCapture ? o.ck.possibleMoves.find(function (x) { return x.r === m.r && x.c === m.c && (x.fr === undefined || (x.fr === m.fr && x.fc === m.fc)); })
        : w.ckAllMoves(o.ck.board, o.ck.turn).find(function (x) { return x.fr === m.fr && x.fc === m.fc && x.r === m.r && x.c === m.c; });
      if (!cand) return null;
      return { a: 'ck', mv: { fr: cand.fr === undefined ? m.fr : cand.fr, fc: cand.fc === undefined ? m.fc : cand.fc, r: cand.r, c: cand.c, type: cand.type, capR: cand.capR, capC: cand.capC } };
    }
    return null;
  }
  function alMensaje(m) {
    if (!S.host || !jugando() || (m.tipo !== 'jugada' && m.tipo !== 'accion')) return;
    var col = S.estado.colores && S.estado.colores[m.de]; if (!col) return;
    if (m.tipo === 'accion') { if (m.a === 'rendirse') terminar(col === 'w' ? 'b' : 'w', 'por abandono'); return; }
    esperarFrame().then(function (w) {
      enganchar(w);
      var j = validar(w, m, col);
      if (!j) { publicar(); return; }                    // jugada no válida: se reenvía el estado para que el invitado se resincronice
      aplicar(w, j); st.aplicadas++; st.jugadas.push(j); publicar(); pintarBarra();
    });
  }
  function terminar(ganador, motivo) { S.enviar('todos', { tipo: 'estado', phase: 'fin', resultado: { gana: ganador, motivo: motivo } }).catch(function () {}); }

  /* ---------- tablero ---------- */
  function reiniciar(w) {
    var o = w.__ol; st.remoto = true;
    try { if (S.juego === 'ajedrez') o.initAj.call(w); else o.initCk.call(w); } finally { st.remoto = false; }
  }
  function orientar(w, c) { // el jugador de negras ve su lado abajo
    var o = w.__ol, negras = c === 'b';
    if (S.juego === 'ajedrez') { o.chess.rotationMode = negras ? 1 : 0; w.applyRotationMode(); w.renderChessBoard(); w.updateChessUI(); }
    else {
      var d = w.document, est = d.getElementById('olEstilo');
      if (!est) { est = d.createElement('style'); est.id = 'olEstilo'; d.head.appendChild(est); }
      est.textContent = negras ? '#checkersBoard{transform:rotate(180deg)}#checkersBoard .cell>*{transform:rotate(180deg)}#checkersLabelsLeft,#checkersLabelsBottom{visibility:hidden}' : '';
    }
  }
  function sincronizar(w, est) {
    var o = w.__ol;
    if (est.phase === 'lobby' || !est.colores) {
      if (st.activa) { st.activa = false; st.ronda = -1; reiniciar(w); orientar(w, 'w'); var b0 = L.barra('winChess'); if (b0) b0.classList.remove('on'); }
      return;
    }
    var js = est.jugadas || [];
    if (!st.activa || st.ronda !== est.ronda || js.length < st.aplicadas) {      // partida nueva, o recarga: se reconstruye repitiendo las jugadas
      st.activa = true; st.ronda = est.ronda; st.aplicadas = 0; reiniciar(w); orientar(w, miColor());
    }
    if (S.host) st.jugadas = js.slice();
    while (st.aplicadas < js.length) { aplicar(w, js[st.aplicadas]); st.aplicadas++; }
    if (est.phase === 'fin' && est.resultado) {
      if (S.juego === 'ajedrez') { o.chess.gameOver = true; w.updateChessUI(); } else { o.ck.gameOver = true; w.updateCheckersUI(); }
    }
    pintarBarra();
  }
  function pintarBarra() {
    var b = L.barra('winChess'); if (!b) return;
    if (!enTablero() || S.estado.phase === 'lobby' || !S.estado.colores) { b.classList.remove('on'); return; }
    var w = $('chessFrame').contentWindow, c = miColor(), est = S.estado, txt;
    if (est.phase === 'fin' && est.resultado) txt = '🏁 Gana <b>' + nombreColor(est.resultado.gana) + '</b> ' + L.esc(est.resultado.motivo || '');
    else {
      var fin = (S.juego === 'ajedrez' ? w.__ol.chess.gameOver : w.__ol.ck.gameOver);
      var turno = colTurno(w);
      txt = fin ? '🏁 Partida terminada' : (turno === c ? '👉 <b>Tu turno</b>' : '⏳ Turno del rival');
    }
    b.innerHTML = '<span class="olBT">🌐 ' + L.esc(S.sala) + ' · juegas con <b>' + nombreColor(c) + '</b> · ' + txt + '</span>';
    if (est.phase === 'jugando') {
      var rend = L.boton('🏳️ Rendirse', '', function () { if (!confirm('¿Rendirte?')) return; if (S.host) terminar(c === 'w' ? 'b' : 'w', 'por abandono'); else S.enviar('host', { tipo: 'accion', a: 'rendirse' }).catch(function () {}); });
      rend.className = ''; b.appendChild(rend);
    }
    if (S.host) { var vol = L.boton('↩ Lobby', '', function () { if (confirm('¿Volver al lobby? Se pierde la partida actual.')) L.volverAlLobby(['colores', 'jugadas', 'resultado']); }); vol.className = ''; b.appendChild(vol); }
    b.classList.add('on');
  }

  /* ---------- lobby ---------- */
  function opciones(host, est) {
    var op = (est.op && est.op.color) || 'azar', fila = L.mk('div', 'olOp'), etiquetas = { azar: '🎲 Azar', w: '⬜ Blancas', b: '⬛ Negras' };
    if (!host) return [L.mk('div', 'olNota', 'El anfitrión juega con: <b>' + etiquetas[op] + '</b> (el invitado juega con el otro color).')];
    fila.appendChild(L.mk('span', '', 'El anfitrión juega con:'));
    ['azar', 'w', 'b'].forEach(function (k) {
      var b = L.boton(etiquetas[k], op === k ? 'on' : '', function () { S.enviar('todos', { tipo: 'estado', op: { color: k } }).catch(function () {}); });
      fila.appendChild(b);
    });
    return [fila];
  }
  function preparar(ctx) {
    var elegido = (ctx.op && ctx.op.color) || 'azar', c = elegido === 'azar' ? (Math.random() < 0.5 ? 'w' : 'b') : elegido;
    var invitado = ctx.jug.filter(function (p) { return !p.esAnfitrion; })[0], colores = {};
    colores[ctx.uid] = c; if (invitado) colores[invitado.id] = c === 'w' ? 'b' : 'w';
    st.jugadas = [];
    return { estado: { colores: colores, jugadas: [], resultado: null, op: ctx.op } };
  }
  function alEstado(est) { if (!enTablero()) return; esperarFrame().then(function (w) { enganchar(w); sincronizar(w, est); }).catch(function (e) { S.toast(e.message); }); }
  function alCerrar() { st.activa = false; st.ronda = -1; var b = L.barra('winChess'); if (b) b.classList.remove('on'); esperarFrame().then(function (w) { if (!w.__ol) return; reiniciar(w); orientar(w, 'w'); }).catch(function () {}); }

  ['ajedrez', 'damas'].forEach(function (j) { L.registrar(j, { opciones: opciones, preparar: preparar, alEstado: alEstado, alCerrar: alCerrar }); });
  S.on('msg', alMensaje);
})();

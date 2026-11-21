/* js/online/lobby.js — Lobby de cada juego con sala online (Ajedrez, Damas, Parchís, Ruleta, Blackjack, Póquer, Hundir la flota, Conecta 4, Tres en raya, Dominó, Ahorcado, Simon, UNO, Oca).
   Se carga solo cuando hace falta (botón «🌐 Conectar» de un juego, o al entrar en una sala). Pinta, sobre la ventana del propio juego:
   la sala, los asientos (con el límite de jugadores del juego), los botones de compartir y QR, las opciones del juego y «Empezar».
   Cada juego registra su parte con JuegosOnline.registrar(id, { opciones(esHost, estado) → nodos, preparar(ctx) → { estado, roles }, alEstado(estado) }). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  var S = function () { return window.Sala; };
  var REG = {};
  var ultimaFase = {};

  function ensure(j) {
    var d = S().JUEGOS[j], win = d && $(d.winId); if (!win) return null;
    var o = win.querySelector('.olLobby[data-j="' + j + '"]');   // un lobby por juego (Ajedrez y Damas comparten ventana)
    if (!o) { o = mk('div', 'olLobby'); o.setAttribute('data-j', j); win.appendChild(o); }
    return o;
  }
  function boton(txt, cls, fn) { var b = mk('button', 'olBtn ' + (cls || ''), txt); if (fn) b.onclick = fn; return b; }

  function render(j) {
    var o = ensure(j); if (!o) return;
    var sala = S(), est = sala.estado, d = sala.JUEGOS[j];
    var visible = sala.activo && sala.juego === j && est.phase === 'lobby';
    o.style.display = visible ? 'flex' : 'none';
    if (!visible) return;
    var host = sala.host, jug = sala.jug.slice().sort(function (a, b) { return a.orden - b.orden; });
    o.innerHTML = '';
    o.appendChild(mk('div', 'olCab', '<div class="olT">' + d.icono + ' ' + esc(d.nombre) + '</div><div class="olS">Sala «' + esc(sala.sala) + '» · ' + (host ? '👑 Eres el anfitrión' : '🎟️ Invitado') + '</div>'));
    if (host) {
      var c = mk('div', 'olFila');
      c.appendChild(boton('🔗 Compartir', '', function () { sala.compartir(); }));
      c.appendChild(boton('▦ QR', '', function () { sala.qr(); }));
      o.appendChild(c);
      o.appendChild(mk('div', 'olNota', '⚠️ El enlace y el QR incluyen la contraseña de la sala.'));
    }
    o.appendChild(mk('div', 'olSub', 'Jugadores ' + jug.length + ' / ' + d.max));
    var lista = mk('div', 'olLista');
    for (var i = 0; i < d.max && i < 8; i++) {
      var p = jug[i];
      var f = mk('div', 'olJ' + (p ? (p.conectado ? '' : ' off') : ' libre'), '<span class="olN">' + (i + 1) + '</span><span class="olNom">' + (p ? esc(p.nombre) + (p.yo ? ' (tú)' : '') : 'Esperando jugador…') + '</span><span class="olTag">' + (p && p.esAnfitrion ? '👑' : '') + '</span>');
      if (p && host && !p.esAnfitrion) {
        var x = mk('button', 'olX', '✕'); x.title = 'Expulsar';
        (function (pp) { x.onclick = function () { if (confirm('¿Expulsar a ' + pp.nombre + '?')) sala.expulsar(pp.id).catch(function (e) { sala.toast(e.message); }); }; })(p);
        f.appendChild(x);
      }
      lista.appendChild(f);
    }
    o.appendChild(lista);
    var reg = REG[j];
    var ops = reg && reg.opciones ? reg.opciones(host, est) : [];
    if (ops && ops.length) { o.appendChild(mk('div', 'olSub', 'Opciones')); ops.forEach(function (n) { o.appendChild(n); }); }
    if (host) {
      var go = boton('▶ Empezar partida', 'olGrande', function () { empezar(j); });
      go.disabled = jug.length < d.min;
      o.appendChild(go);
      if (jug.length < d.min) o.appendChild(mk('div', 'olNota', 'Hacen falta al menos ' + d.min + ' jugadores.'));
    } else o.appendChild(mk('div', 'olEspera', 'Esperando a que el anfitrión empiece la partida…'));
    o.appendChild(boton('⏏ ' + (host ? 'Cerrar la sala' : 'Salir de la sala'), 'olSalir', function () { if (confirm(host ? '¿Cerrar la sala? Todos saldrán.' : '¿Salir de la sala?')) sala.salir(); }));
  }

  async function empezar(j) {
    var sala = S(), est = sala.estado, jug = sala.jug.slice().sort(function (a, b) { return a.orden - b.orden; });
    var reg = REG[j], ctx = { jug: jug, op: est.op || {}, estado: est, uid: sala.uid };
    try {
      var pre = reg && reg.preparar ? await reg.preparar(ctx) : {};
      var roles = (pre && pre.roles) || {};
      for (var id in roles) { if (id === sala.uid) continue; await sala.enviar(id, Object.assign({ tipo: 'rol' }, roles[id])); }
      await sala.enviar('todos', Object.assign({ tipo: 'estado', phase: 'jugando', ronda: (est.ronda || 0) + 1, asientos: jug.map(function (p) { return { id: p.id, nombre: p.nombre }; }) }, (pre && pre.estado) || {}));
    } catch (e) { sala.toast(e.message || 'No se pudo empezar la partida'); }
  }
  // Vuelve al lobby del juego (anfitrión): borra las vistas privadas y deja la sala lista para otra partida.
  async function volverAlLobby(extraNulos) {
    var sala = S(); if (!sala.host) return;
    for (var i = 0; i < sala.jug.length; i++) { var p = sala.jug[i]; if (!p.esAnfitrion) await sala.enviar(p.id, { tipo: 'rol', vacio: true }); }
    var anular = { asientos: null }; (extraNulos || []).forEach(function (k) { anular[k] = null; });
    await sala.enviar('todos', Object.assign({ tipo: 'estado', phase: 'lobby' }, anular));
  }
  function todos() { Object.keys(S().JUEGOS).forEach(function (j) { if (j !== 'bingo' && $(S().JUEGOS[j].winId)) render(j); }); }
  function alEstado(est) {
    var j = S().juego;
    if (j && REG[j] && REG[j].alEstado) { try { REG[j].alEstado(est, ultimaFase[j]); } catch (e) { console.error(e); } }
    if (j) ultimaFase[j] = est.phase;
    todos();
  }
  // Cada grupo de juegos tiene su adaptador (js/online/j-<grupo>.js), que se carga al entrar en la sala de ese juego.
  var ARCH = { ajedrez: 'tablero', damas: 'tablero', parchis: 'parchis', ruleta: 'ruleta', blackjack: 'blackjack', poker: 'casino', hundir: 'hundir', c4: 'duelo', ttt: 'duelo', domino: 'domino', ahorcado: 'ahorcado', simon: 'simon', uno: 'uno', oca: 'oca' }, cargados = {};
  function cargarAdaptador(j) {
    var a = ARCH[j]; if (!a) return Promise.resolve();
    function cargar(archivo) {
      return new Promise(function (ok, ko) {
        var sc = document.createElement('script'); sc.src = new URL('js/online/' + archivo, document.baseURI).href;
        sc.onload = ok; sc.onerror = function () { ko(new Error('No se pudo cargar el modo online de este juego.')); };
        document.head.appendChild(sc);
      });
    }
    if (!cargados[a]) cargados[a] = (a === 'casino' ? cargar('casino-engine.js') : a === 'hundir' ? cargar('hundir-engine.js') : a === 'domino' ? cargar('domino-engine.js') : a === 'simon' ? cargar('simon-engine.js') : a === 'uno' ? cargar('uno-engine.js') : a === 'oca' ? cargar('oca-engine.js') : Promise.resolve()).then(function () { return cargar('j-' + a + '.js'); }).catch(function (e) { delete cargados[a]; throw e; });
    return cargados[a];
  }
  function mostrar(j) { return cargarAdaptador(j).then(function () { render(j); }); }
  // Barra de estado online bajo el título de la ventana del juego (sala, turno, botones propios del juego).
  function barra(winId) {
    var win = $(winId); if (!win) return null;
    var b = win.querySelector('.olBarra');
    if (!b) { b = mk('div', 'olBarra'); var ref = win.querySelector('.menuBar') || win.querySelector('.winReopen'); ref.parentNode.insertBefore(b, ref.nextSibling); }
    return b;
  }
  // Abandono a mitad de partida (fallo C2): si un jugador sentado sale de la sala (o el anfitrión le expulsa), el anfitrión avisa a todos y,
  // si el juego sabe seguir sin él (alAbandono devuelve true: p. ej. una CPU ocupa su asiento), la partida continúa; si no, se vuelve al lobby.
  // Si solo se ha desconectado, se le espera, pero al minuto se avisa al anfitrión de que puede expulsarle desde la ventana de la sala.
  var NULOS = { ahorcado: ['ah'], blackjack: ['bj', 'bjF'], poker: ['mesa', 'resultado'], c4: ['du'], ttt: ['du'], hundir: ['hf'], ruleta: ['rul', 'rulF'],
    ajedrez: ['colores', 'jugadas', 'resultado', 'reloj'], damas: ['colores', 'jugadas', 'resultado', 'reloj'], uno: ['uno', 'unoAsientos'], domino: ['dm', 'dmAs'],
    oca: ['oc', 'ocAs'], parchis: ['mesa', 'g', 'resultado'], simon: ['si'] };
  var fuera = {}, offDesde = {}, vistos = {};
  function avisarTodos(texto) { var sala = S(); sala.toast(texto); sala.enviar('todos', { tipo: 'evento', k: 'olAviso', texto: texto }).catch(function () {}); }
  function revisarAbandonos() {
    var sala = S(), est = sala.estado, j = sala.juego;
    sala.jug.forEach(function (p) { vistos[p.id] = true; });
    if (!sala.activo || !sala.host || !j || !REG[j] || !est.asientos || est.phase === 'lobby') { fuera = {}; offDesde = {}; return; }
    // Solo cuenta como «se ha ido» quien ya hemos visto en la lista de esta página: al recargar, la lista tarda un momento en llegar.
    var presentes = {}, cerrada = false; sala.jug.forEach(function (p) { presentes[p.id] = p; });
    if (!presentes[sala.uid]) return;
    est.asientos.forEach(function (a) {
      if (cerrada || !a || !a.id || a.id === sala.uid) return;
      var p = presentes[a.id], clave = est.ronda + ':' + a.id;
      if (p) {                                                              // sigue en la sala: ¿lleva mucho desconectado?
        if (p.conectado) { delete offDesde[a.id]; return; }
        if (!offDesde[a.id]) offDesde[a.id] = { t: Date.now(), avisado: false };
        var o = offDesde[a.id];
        if (!o.avisado && Date.now() - o.t > 60000) { o.avisado = true; sala.toast('⏳ ' + a.nombre + ' lleva un minuto desconectado. Puedes esperarle o expulsarle desde la ventana de la sala (📶).'); }
        return;
      }
      if (fuera[clave] || !vistos[a.id]) return;
      fuera[clave] = true; delete offDesde[a.id];
      if (est.phase === 'fin') { avisarTodos('👋 ' + a.nombre + ' ha salido de la sala.'); return; }
      var sigue = false;
      try { sigue = !!(REG[j].alAbandono && REG[j].alAbandono(a.id, a.nombre)); } catch (e) { console.error(e); }
      if (sigue) avisarTodos('👋 ' + a.nombre + ' ha salido de la sala. ' + (sigue === 'nada' ? 'La partida sigue sin él.' : 'Una CPU juega en su lugar.'));
      else { cerrada = true; avisarTodos('👋 ' + a.nombre + ' ha salido de la sala: la partida se cierra. Podéis empezar otra desde el lobby.'); volverAlLobby(NULOS[j] || []); }
    });
  }
  setInterval(function () { if (S().activo && S().host) revisarAbandonos(); }, 5000);   // para el aviso de desconexión larga
  function registrar(j, reg) { REG[j] = reg; if (S().activo && S().juego === j) alEstado(S().estado); else todos(); }

  S().on('estado', alEstado); S().on('jug', function () { revisarAbandonos(); todos(); }); S().on('con', todos);
  S().on('evento', function (m) { if (m && m.k === 'olAviso' && typeof m.texto === 'string' && !S().host) S().toast(m.texto); });
  S().on('cierre', function () { ultimaFase = {}; Object.keys(REG).forEach(function (j) { if (REG[j].alCerrar) { try { REG[j].alCerrar(); } catch (e) { console.error(e); } } }); todos(); });
  window.JuegosOnline = { barra: barra, cargarAdaptador: cargarAdaptador, mostrar: mostrar, registrar: registrar, render: todos, volverAlLobby: volverAlLobby, empezar: empezar, mk: mk, esc: esc, boton: boton };
  todos();
})();

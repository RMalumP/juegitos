/* js/online/lobby.js — Lobby de cada juego con sala online (Ajedrez, Damas, Parchís, Ruleta, Blackjack, Póquer, Hundir la flota).
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
  var ARCH = { ajedrez: 'tablero', damas: 'tablero', parchis: 'parchis', ruleta: 'ruleta', blackjack: 'blackjack', poker: 'casino', hundir: 'hundir', c4: 'duelo', ttt: 'duelo' }, cargados = {};
  function cargarAdaptador(j) {
    var a = ARCH[j]; if (!a) return Promise.resolve();
    function cargar(archivo) {
      return new Promise(function (ok, ko) {
        var sc = document.createElement('script'); sc.src = new URL('js/online/' + archivo, document.baseURI).href;
        sc.onload = ok; sc.onerror = function () { ko(new Error('No se pudo cargar el modo online de este juego.')); };
        document.head.appendChild(sc);
      });
    }
    if (!cargados[a]) cargados[a] = (a === 'casino' ? cargar('casino-engine.js') : a === 'hundir' ? cargar('hundir-engine.js') : Promise.resolve()).then(function () { return cargar('j-' + a + '.js'); }).catch(function (e) { delete cargados[a]; throw e; });
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
  function registrar(j, reg) { REG[j] = reg; if (S().activo && S().juego === j) alEstado(S().estado); else todos(); }

  S().on('estado', alEstado); S().on('jug', todos); S().on('con', todos);
  S().on('cierre', function () { ultimaFase = {}; Object.keys(REG).forEach(function (j) { if (REG[j].alCerrar) { try { REG[j].alCerrar(); } catch (e) { console.error(e); } } }); todos(); });
  window.JuegosOnline = { barra: barra, cargarAdaptador: cargarAdaptador, mostrar: mostrar, registrar: registrar, render: todos, volverAlLobby: volverAlLobby, empezar: empezar, mk: mk, esc: esc, boton: boton };
  todos();
})();

/* ahorcado.js — Juegos XP: el Ahorcado. Reglas: js/games/ahorcado-engine.js; palabras al azar: las soluciones del Wordle (js/games/wordle-palabras.js).
   Modos: «Solo» (palabra al azar del Wordle, con estadísticas), «2 jugadores» en un móvil (uno escribe la palabra y pasa el móvil; se turnan)
   y online (js/online/j-ahorcado.js → window.Ahorcado.online), donde un jugador escribe la palabra y el resto de la sala la adivina por turnos. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var E = window.AhorcadoEngine, P = window.WORDLE_PALABRAS || { sol: '' };
  var SOL = P.sol.split(' ').filter(Boolean), TECLADO = ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'];
  var modo = 'solo', est = null, msgT = null, wrap = null;
  var dos = { escribe: 0, puntos: [0, 0], nombres: ['Jugador 1', 'Jugador 2'] };
  var ol = null, olEst = null, miPalabra = null, escritaEn = -1;  // online: configuración del adaptador, vista pública, la palabra que escribí yo y en qué ronda
  var stats = { jugadas: 0, ganadas: 0, racha: 0, mejorRacha: 0 };
  try { var ss = JSON.parse(localStorage.getItem('ahorcadoStats')); if (ss) stats = Object.assign(stats, ss); } catch (e) { /* sin estadísticas */ }
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }
  function guardarStats() { try { localStorage.setItem('ahorcadoStats', JSON.stringify(stats)); } catch (e) { /* nada */ } }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function alAzar() { return SOL.length ? SOL[Math.floor(Math.random() * SOL.length)] : 'juego'; }

  var DIBUJO = '<svg viewBox="0 0 120 130" aria-hidden="true">' +
    '<path class="ahoHorca" d="M10 124 H80 M28 124 V8 H82 V20 M28 30 L48 8"/>' +
    '<circle class="ahoP" data-i="0" cx="82" cy="31" r="11"/>' +
    '<path class="ahoP" data-i="1" d="M82 42 V78"/>' +
    '<path class="ahoP" data-i="2" d="M82 52 L66 66"/>' +
    '<path class="ahoP" data-i="3" d="M82 52 L98 66"/>' +
    '<path class="ahoP" data-i="4" d="M82 78 L69 102"/>' +
    '<path class="ahoP" data-i="5" d="M82 78 L95 102"/></svg>';

  function construir() {
    wrap = $('ahoWrap'); if (!wrap || wrap.firstChild) return;
    wrap.innerHTML =
      '<div id="ahoCab"><div id="ahoModos"><button type="button" class="ahoModo" data-m="solo">Solo</button><button type="button" class="ahoModo" data-m="dos">2 jugadores</button></div><div id="ahoMarcador"></div></div>' +
      '<div id="ahoJugs"></div><div id="ahoInfo"></div><div id="ahoDibujo">' + DIBUJO + '<div id="ahoVidas"></div></div>' +
      '<div id="ahoPalabra"></div><div id="ahoKeys"></div><div id="ahoMsg"></div>' +
      '<div id="ahoEscribir" class="ahoCapa"><h2 id="ahoEscT">Escribe la palabra secreta</h2><div class="ahoSub" id="ahoEscS"></div>' +
      '<div id="ahoEscFila"><input id="ahoInput" type="text" maxlength="30" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Palabra secreta">' +
      '<button type="button" id="ahoVer" title="Ver la palabra" aria-label="Ver la palabra">👁</button></div><div id="ahoEscErr"></div>' +
      '<div class="ahoBotones"><button type="button" class="ahoBtn" id="ahoAzar">🎲 Al azar</button><button type="button" class="ahoBtn ahoOk" id="ahoListo">✔ Listo</button></div>' +
      '<div class="ahoSub">De ' + E.MIN_LETRAS + ' a ' + E.MAX_LETRAS + ' letras, sin números. Puedes poner varias palabras; las tildes no cuentan.</div></div>' +
      '<div id="ahoFin" class="ahoCapa"><h1 id="ahoFinT"></h1><div id="ahoFinP"></div><div class="ahoSub" id="ahoFinS"></div><div class="ahoBotones" id="ahoFinB"></div></div>';
    var k = $('ahoKeys');
    TECLADO.forEach(function (fila) {
      var d = document.createElement('div'); d.className = 'ahoTFila';
      fila.split('').forEach(function (ch) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'ahoTecla'; b.dataset.k = ch; b.textContent = ch.toUpperCase();
        b.addEventListener('click', function () { letra(ch); });
        d.appendChild(b);
      });
      k.appendChild(d);
    });
    wrap.querySelectorAll('.ahoModo').forEach(function (b) { b.addEventListener('click', function () { if (modo !== 'online') empezar(b.dataset.m); }); });
    $('ahoVer').addEventListener('click', function () { $('ahoInput').classList.toggle('visible'); $('ahoInput').focus(); });
    $('ahoAzar').addEventListener('click', function () { $('ahoInput').value = alAzar().toUpperCase(); $('ahoEscErr').textContent = ''; });
    $('ahoListo').addEventListener('click', listo);
    $('ahoInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); listo(); } });
    $('ahoInput').addEventListener('input', function () { $('ahoEscErr').textContent = ''; });
  }

  function aviso(t, ms) { var a = $('ahoMsg'); a.textContent = t; a.classList.add('show'); clearTimeout(msgT); msgT = setTimeout(function () { a.classList.remove('show'); }, ms || 1500); }

  /* ---------- pintar (local u online) ---------- */
  function vista() {                                             // lo que se pinta: la partida local o la vista pública online
    if (modo === 'online') return olEst && olEst.fase !== 'escribiendo' ? olEst : null;
    return est ? E.publico(est) : null;
  }
  function puedoJugar() {
    if (modo === 'online') return !!(olEst && olEst.fase === 'jugando' && olEst.turno === ol.p);
    return !!(est && est.fase === 'jugando' && !$('ahoEscribir').classList.contains('show') && !(window.PasarMovil && window.PasarMovil.activa()));
  }
  function pintar() {
    if (!wrap) return;
    var v = vista(), fallos = v ? v.fallos : 0, max = v ? v.max : E.MAX_FALLOS;
    wrap.querySelectorAll('.ahoP').forEach(function (p) { p.classList.toggle('on', +p.dataset.i < fallos); });
    $('ahoDibujo').classList.toggle('muerto', !!(v && v.fase === 'pierde'));
    $('ahoVidas').textContent = v ? '❤️'.repeat(Math.max(0, max - fallos)) + '🖤'.repeat(Math.min(max, fallos)) : '';
    var pal = $('ahoPalabra'); pal.innerHTML = '';
    if (v) {
      pal.style.setProperty('--n', Math.max(6, Math.min(14, v.mascara.length)));
      var g = null;                                              // cada palabra va en un grupo que no se parte al cambiar de línea
      v.mascara.forEach(function (c) {
        if (c === ' ') { g = null; return; }
        if (!g) { g = document.createElement('span'); g.className = 'ahoGrupo'; pal.appendChild(g); }
        var s = document.createElement('span');
        s.className = 'ahoL' + (c ? ' vista' : '') + (v.fase === 'pierde' && c && v.letras.indexOf(c) < 0 ? ' faltaba' : '');
        s.textContent = c ? c.toUpperCase() : ''; g.appendChild(s);
      });
    } else pal.innerHTML = '<span class="ahoEspera">…</span>';
    var puede = puedoJugar(), letras = v ? v.letras : [];
    var enPal = v ? v.mascara.concat(v.palabra ? v.palabra.split('') : []) : [];
    wrap.querySelectorAll('.ahoTecla').forEach(function (b) {
      var l = b.dataset.k, usada = letras.indexOf(l) >= 0;
      b.className = 'ahoTecla' + (usada ? (enPal.indexOf(l) >= 0 ? ' bien' : ' mal') : '');
      b.disabled = !puede || usada;
    });
    wrap.querySelectorAll('.ahoModo').forEach(function (b) { b.classList.toggle('sel', b.dataset.m === modo); });
    $('ahoModos').style.display = modo === 'online' ? 'none' : '';
    pintarMarcador(); pintarInfo();
  }
  function pintarMarcador() {
    var m = $('ahoMarcador'), j = $('ahoJugs');
    if (modo === 'solo') { m.textContent = 'Racha ' + stats.racha + ' · Mejor ' + stats.mejorRacha; j.innerHTML = ''; j.style.display = 'none'; return; }
    m.textContent = '';
    var lista = modo === 'dos' ? dos.nombres.map(function (n, i) { return { n: n, pts: dos.puntos[i], escribe: i === dos.escribe, turno: est && est.fase === 'jugando' && i !== dos.escribe }; })
      : (ol ? ol.nombres.map(function (n, i) { return { n: n + (i === ol.p ? ' (tú)' : ''), pts: olEst && olEst.puntos ? olEst.puntos[i] || 0 : 0, escribe: olEst && i === olEst.escribe, turno: olEst && olEst.fase === 'jugando' && i === olEst.turno }; }) : []);
    j.innerHTML = lista.map(function (x) { return '<span class="ahoJ' + (x.turno ? ' turno' : '') + '">' + (x.escribe ? '✍️ ' : '') + esc(x.n) + ' <b>' + x.pts + '</b></span>'; }).join('');
    j.style.display = '';
  }
  function pintarInfo() {
    var t = '';
    if (modo === 'solo') t = est && est.fase === 'jugando' ? 'Adivina la palabra del Wordle (' + est.pal.length + ' letras)' : '';
    else if (modo === 'dos') t = est && est.fase === 'jugando' ? 'Adivina ' + dos.nombres[1 - dos.escribe] + ' · la palabra es de ' + dos.nombres[dos.escribe] : dos.nombres[dos.escribe] + ' escribe la palabra';
    else if (ol && olEst) {
      var quien = function (i) { return i === ol.p ? 'ti' : (ol.nombres[i] || 'otro'); };
      if (olEst.fase === 'escribiendo') t = olEst.escribe === ol.p ? 'Te toca escribir la palabra' : (ol.nombres[olEst.escribe] || 'Alguien') + ' está escribiendo la palabra…';
      else if (olEst.fase === 'jugando') t = olEst.turno === ol.p ? '¡Tu turno! Elige una letra' : 'Turno de ' + quien(olEst.turno) + (olEst.escribe === ol.p && miPalabra && escritaEn === olEst.rn ? ' · tu palabra: ' + miPalabra.toUpperCase() : '');
      if (olEst.ultimo && olEst.fase === 'jugando') t = (olEst.ultimo.p === ol.p ? 'Has' : (ol.nombres[olEst.ultimo.p] || 'Alguien') + ' ha') + ' dicho la ' + olEst.ultimo.l.toUpperCase() + (olEst.ultimo.ok ? ' ✔' : ' ✘') + ' · ' + t;
    }
    $('ahoInfo').textContent = t;
  }

  /* ---------- jugar una letra ---------- */
  function letra(l) {
    if (!puedoJugar()) return;
    if (modo === 'online') { if (olEst.letras.indexOf(l) < 0) ol.letra(l); return; }
    var r = E.probar(est, l); if (!r) return;
    vib(r.acierto ? 12 : 40);
    if (!r.acierto) { var d = $('ahoDibujo'); d.classList.remove('sacude'); void d.offsetWidth; d.classList.add('sacude'); }
    pintar();
    if (est.fase !== 'jugando') terminar();
  }
  function terminar() {
    var gano = est.fase === 'gana';
    if (modo === 'solo') {
      stats.jugadas++; if (gano) { stats.ganadas++; stats.racha++; stats.mejorRacha = Math.max(stats.mejorRacha, stats.racha); } else stats.racha = 0;
      guardarStats();
      setTimeout(function () {
        fin(gano ? '¡Salvado!' : '¡Ahorcado!', est.pal, (gano ? 'Con ' + est.fallos + ' fallo' + (est.fallos === 1 ? '' : 's') + '. ' : '') + 'Jugadas ' + stats.jugadas + ' · Victorias ' + Math.round(100 * stats.ganadas / stats.jugadas) + '% · Racha ' + stats.racha + ' (mejor ' + stats.mejorRacha + ')',
          [['▶ Otra palabra', function () { empezar('solo'); }]]);
      }, window.ahorRapido ? 10 : 700);
    } else {
      var adivina = 1 - dos.escribe;
      dos.puntos[gano ? adivina : dos.escribe]++;
      var sig = 1 - dos.escribe;
      setTimeout(function () {
        fin(gano ? '¡' + dos.nombres[adivina] + ' la ha adivinado!' : '¡' + dos.nombres[adivina] + ' ahorcado!', est.pal, 'Punto para ' + dos.nombres[gano ? adivina : dos.escribe] + '. Marcador: ' + dos.nombres[0] + ' ' + dos.puntos[0] + ' · ' + dos.nombres[1] + ' ' + dos.puntos[1],
          [['▶ Siguiente: escribe ' + dos.nombres[sig], function () { dos.escribe = sig; rondaDos(); }]]);
      }, window.ahorRapido ? 10 : 700);
    }
  }
  function fin(titulo, palabra, sub, botones) {
    $('ahoFinT').textContent = titulo; $('ahoFinP').textContent = palabra ? palabra.toUpperCase() : ''; $('ahoFinS').textContent = sub || '';
    var b = $('ahoFinB'); b.innerHTML = '';
    (botones || []).forEach(function (x) {
      var e = document.createElement('button'); e.type = 'button'; e.className = 'ahoBtn ahoOk'; e.textContent = x[0];
      if (x[1]) e.addEventListener('click', x[1]); else e.disabled = true;
      if (x[2]) e.dataset.r = x[2];
      b.appendChild(e);
    });
    $('ahoFin').classList.add('show');
  }
  function cerrarCapas() { $('ahoFin').classList.remove('show'); $('ahoEscribir').classList.remove('show'); if (window.PasarMovil) window.PasarMovil.quitar(); }

  /* ---------- escribir la palabra secreta ---------- */
  function pedirPalabra(titulo, sub) {
    $('ahoEscT').textContent = titulo; $('ahoEscS').textContent = sub || '';
    var i = $('ahoInput'); i.value = ''; i.classList.remove('visible'); $('ahoEscErr').textContent = '';
    $('ahoEscribir').classList.add('show');
    if (!('ontouchstart' in window)) setTimeout(function () { try { i.focus(); } catch (e) { /* nada */ } }, 50);
  }
  function listo() {
    var r = E.validar($('ahoInput').value);
    if (!r.ok) { $('ahoEscErr').textContent = r.error; vib(40); return; }
    $('ahoInput').blur(); $('ahoEscribir').classList.remove('show');
    if (modo === 'online') { miPalabra = r.palabra; escritaEn = olEst.rn; ol.palabra(r.palabra); pintar(); return; }
    est = E.nuevo(r.palabra); pintar();
    var adivina = dos.nombres[1 - dos.escribe];
    if (window.PasarMovil) window.PasarMovil.mostrar({ contenedor: wrap, icono: '🪢', titulo: 'Pasa el móvil a ' + adivina, texto: 'Que ' + dos.nombres[dos.escribe] + ' no le chive la palabra.', boton: 'Soy ' + adivina + ' · Jugar' }).then(pintar);
    pintar();
  }
  function rondaDos() {
    cerrarCapas(); est = null; pintar();
    pedirPalabra(dos.nombres[dos.escribe] + ': escribe la palabra', 'Que ' + dos.nombres[1 - dos.escribe] + ' no mire. Luego le pasas el móvil.');
  }

  function empezar(m) {
    if (modo === 'online') return;
    cerrarCapas(); modo = m;
    if (m === 'solo') { est = E.nuevo(alAzar()); pintar(); return; }
    if (m === 'dos') { dos.escribe = 0; dos.puntos = [0, 0]; rondaDos(); }
  }

  document.addEventListener('keydown', function (e) {
    var w = $('winAhor'); if (!w || w.classList.contains('hidden') || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key && e.key.length === 1) { var k = E.normalizar(e.key); if (E.esLetra(k)) { e.preventDefault(); letra(k); } }
  });

  /* ---------- online (lo maneja js/online/j-ahorcado.js) ---------- */
  function olPintar() {
    if (!olEst) return;
    var yoEscribo = olEst.fase === 'escribiendo' && olEst.escribe === ol.p;
    if (olEst.fase === 'escribiendo') {
      $('ahoFin').classList.remove('show');
      if (yoEscribo && !$('ahoEscribir').classList.contains('show') && escritaEn !== olEst.rn) { miPalabra = null; pedirPalabra('Escribe la palabra secreta', 'La adivinarán ' + ol.nombres.filter(function (n, i) { return i !== ol.p; }).join(', ') + '.'); }
      if (!yoEscribo) $('ahoEscribir').classList.remove('show');
    } else $('ahoEscribir').classList.remove('show');
    pintar();
    if (olEst.fase === 'gana' || olEst.fase === 'pierde') {
      var gano = olEst.fase === 'gana', ult = olEst.ultimo, pts = ol.nombres.map(function (n, i) { return n + ' ' + (olEst.puntos[i] || 0); }).join(' · ');
      var t = gano ? (ult && ult.p === ol.p ? '¡La has adivinado!' : '¡' + (ol.nombres[ult ? ult.p : 0] || 'Alguien') + ' la ha adivinado!') : (olEst.escribe === ol.p ? '¡Los has ahorcado!' : '¡Ahorcados!');
      var bot = ol.host ? [['▶ Siguiente ronda', function () { $('ahoFin').classList.remove('show'); ol.siguiente(); }, 'otra'], ['↩ Lobby', function () { ol.lobby(); }, 'lobby']] : [['Esperando al anfitrión…', null, 'otra']];
      if (!$('ahoFin').classList.contains('show') || $('ahoFin').dataset.n !== String(olEst.n)) fin(t, olEst.palabra, 'Escribe ahora ' + (ol.nombres[olEst.siguiente] || 'otro') + '. Puntos: ' + pts, bot);
      $('ahoFin').dataset.n = olEst.n;
    } else $('ahoFin').classList.remove('show');
  }
  window.Ahorcado = {
    online: {
      iniciar: function (cfg) {
        construir(); cerrarCapas(); ol = cfg; olEst = cfg.est; modo = 'online'; miPalabra = null; escritaEn = -1; olPintar();
      },
      estado: function (e) { if (modo !== 'online') return; olEst = e; olPintar(); },
      salir: function () { if (modo !== 'online') return; ol = null; olEst = null; miPalabra = null; modo = 'solo'; cerrarCapas(); est = E.nuevo(alAzar()); pintar(); }
    }
  };

  construir();
  if ($('ahorNewGame')) $('ahorNewGame').addEventListener('click', function () { if (modo === 'online') aviso('En una partida online la ronda la pasa el anfitrión'); else empezar(modo); });
  window.initAhor = function () { construir(); if (!est && modo !== 'online') empezar('solo'); else pintar(); };
  window.pauseAhor = function () { /* sin reloj */ };
  window.ahorEstado = function () {
    return { modo: modo, fase: modo === 'online' ? (olEst && olEst.fase) : est && est.fase, pal: est && est.pal, mascara: vista() ? vista().mascara.slice() : [], letras: vista() ? vista().letras.slice() : [], fallos: vista() ? vista().fallos : 0,
      escribiendo: $('ahoEscribir').classList.contains('show'), dos: JSON.parse(JSON.stringify(dos)), est: olEst, stats: Object.assign({}, stats) };
  };
})();

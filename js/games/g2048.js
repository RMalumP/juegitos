/* g2048.js — Juegos XP: 2048 en tableros de 4×4, 5×5 y 6×6 (js/games/g2048-engine.js).
   Teclado (flechas / WASD) y deslizamiento táctil con Pointer Events. Deshacer una jugada. Mejor puntuación por tamaño (g2048Best_<n>). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var E = window.G2048Engine;
  var n = 4, grid, score = 0, best = 0, prev = null, over = false, ganado = false, seguir = false, nueva = null;
  try { var sn = parseInt(localStorage.getItem('g2048Size'), 10); if (sn >= 4 && sn <= 6) n = sn; } catch (e) { /* sin ajustes */ }
  function lsBest() { try { return parseInt(localStorage.getItem('g2048Best_' + n), 10) || 0; } catch (e) { return 0; } }
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }

  function pintar() {
    var b = $('g48Board'); b.style.setProperty('--n', n); b.innerHTML = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      var v = grid[r][c], t = document.createElement('div');
      t.className = 'g48T' + (v ? ' v' + Math.min(v, 4096) + (v > 4096 ? ' vmax' : '') : '') + (nueva && nueva[0] === r && nueva[1] === c ? ' nuevo' : '');
      t.textContent = v || ''; t.dataset.v = v; b.appendChild(t);
    }
    $('g48Score').textContent = score; $('g48Best').textContent = best; $('g48Max').textContent = E.maximo(grid);
    document.querySelectorAll('.g48Sz').forEach(function (e) { e.classList.toggle('sel', +e.dataset.n === n); });
    $('g48Undo').style.opacity = prev ? 1 : 0.4;
  }
  /* partida a medias: el botón «Guardar» la guarda y se retoma al abrir el juego */
  function guardarPartida() {
    if (!window.Partida || !grid) return;
    if (over) { window.Partida.aviso('La partida ya ha terminado'); return; }
    window.Partida.guardar('g2048', { n: n, grid: grid, score: score, prev: prev, ganado: ganado });
    window.Partida.aviso('💾 Partida guardada');
  }
  function restaurar() {
    var d = window.Partida && window.Partida.tomar('g2048');
    if (!d || !(d.n >= 4 && d.n <= 6) || !Array.isArray(d.grid) || d.grid.length !== d.n) return false;
    var bien = function (g) { return Array.isArray(g) && g.length === d.n && g.every(function (f) { return Array.isArray(f) && f.length === d.n && f.every(function (v) { return typeof v === 'number' && v >= 0; }); }); };
    if (!bien(d.grid) || (d.prev && !bien(d.prev.grid)) || !E.puedeMover(d.grid)) return false;
    n = d.n; best = lsBest(); grid = E.copiar(d.grid); score = +d.score || 0; prev = d.prev ? { grid: E.copiar(d.prev.grid), score: +d.prev.score || 0 } : null;
    over = false; ganado = !!d.ganado; seguir = ganado; nueva = null; $('g48Over').classList.remove('show'); pintar();
    return true;
  }
  function nuevoJuego() {
    if (window.Partida) window.Partida.borrar('g2048');      // lo guardado se borra al empezar otra partida o al perder
    best = lsBest(); grid = E.nuevoJuego(n); score = 0; prev = null; over = false; ganado = false; seguir = false; nueva = null;
    $('g48Over').classList.remove('show'); pintar();
  }
  function fin(t, s, cont) {
    $('g48OverT').textContent = t; $('g48OverS').textContent = s; $('g48Cont').style.display = cont ? '' : 'none'; $('g48Over').classList.add('show');
  }
  function mover(dir) {
    if (over || !$('g48Over') || $('g48Over').classList.contains('show')) return;
    var r = E.mover(grid, dir); if (!r.movido) return;
    prev = { grid: E.copiar(grid), score: score };
    grid = r.grid; score += r.puntos; nueva = E.agregar(grid);
    if (score > best) { best = score; try { localStorage.setItem('g2048Best_' + n, best); } catch (e) { /* nada */ } }
    if (r.puntos) vib(12);
    pintar();
    if (!ganado && !seguir && E.maximo(grid) >= 2048) { ganado = true; vib([0, 40, 60, 40]); fin('🏆 ¡2048!', 'Has llegado a 2048. Puntos: ' + score, true); return; }
    if (!E.puedeMover(grid)) { over = true; if (window.Partida) window.Partida.borrar('g2048'); vib(200); fin('FIN DE LA PARTIDA', 'Puntos: ' + score + ' · Ficha mayor: ' + E.maximo(grid), false); }
  }
  function deshacer() { if (!prev || over) return; grid = prev.grid; score = prev.score; prev = null; nueva = null; $('g48Over').classList.remove('show'); pintar(); }

  /* teclado: solo con la ventana visible */
  var DIR = { izq: 0, arr: 1, der: 2, aba: 3 };
  var TK = window.Teclas.crear({ id: 'g2048', ventana: 'winG2048', titulo: '2048', acciones: [
    { id: 'izq', etiqueta: 'Izquierda', def: 'ArrowLeft', alt: ['KeyA'] }, { id: 'arr', etiqueta: 'Arriba', def: 'ArrowUp', alt: ['KeyW'] },
    { id: 'der', etiqueta: 'Derecha', def: 'ArrowRight', alt: ['KeyD'] }, { id: 'aba', etiqueta: 'Abajo', def: 'ArrowDown', alt: ['KeyS'] },
    { id: 'deshacer', etiqueta: 'Deshacer', def: 'KeyZ' }, { id: 'ok', etiqueta: 'Aceptar (fin de partida)', def: 'Enter' }] });
  document.addEventListener('keydown', function (e) {
    var w = $('winG2048'); if (!w || w.classList.contains('hidden')) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var a = TK.accion(e.code); if (!a) return;
    if (a in DIR) { e.preventDefault(); if (!e.repeat) mover(DIR[a]); }
    else if (a === 'deshacer' && !e.repeat) deshacer();
    else if (a === 'ok' && !e.repeat && $('g48Over').classList.contains('show')) { e.preventDefault(); if (ganado && !over) $('g48Cont').click(); else $('g48Again').click(); }
  });
  /* deslizar con el dedo (o el ratón) por toda la ventana: el gesto se resuelve al superar el umbral, sin esperar a soltar */
  var p0 = null, tz = $('g48Wrap');
  tz.style.touchAction = 'none';
  tz.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('button, .ctrlToggle, #g48Over')) return;
    p0 = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  tz.addEventListener('pointermove', function (e) {
    if (!p0 || p0.id !== e.pointerId) return;
    var dx = e.clientX - p0.x, dy = e.clientY - p0.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    p0 = null; e.preventDefault();
    mover(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 0) : (dy > 0 ? 3 : 1));
  });
  function soltar(e) { if (p0 && p0.id === e.pointerId) p0 = null; }
  tz.addEventListener('pointerup', soltar);
  tz.addEventListener('pointercancel', soltar);

  /* botones en pantalla (como la cruceta del Snake) */
  document.querySelectorAll('.g48CtrlBtn').forEach(function (b) {
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); b.classList.add('pressed'); mover(+b.dataset.d); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('pressed'); }); });
  });

  document.querySelectorAll('.g48Sz').forEach(function (b) { b.addEventListener('click', function () { n = +b.dataset.n; try { localStorage.setItem('g2048Size', n); } catch (e) { /* nada */ } nuevoJuego(); }); });
  $('g48NewGame').addEventListener('click', nuevoJuego); $('g48Again').addEventListener('click', nuevoJuego);
  $('g48Undo').addEventListener('click', deshacer);
  $('g48Save').addEventListener('click', guardarPartida);
  $('g48Cont').addEventListener('click', function () { seguir = true; $('g48Over').classList.remove('show'); });
  window.initG2048 = function () { if (!grid && !restaurar()) nuevoJuego(); };
  window.g2048StartNew = nuevoJuego;
  window.pauseG2048 = function () { /* sin reloj: la partida espera */ };
  window.g2048Estado = function () { return { n: n, grid: E.copiar(grid), score: score, best: best, over: over, ganado: ganado }; };
  window.g2048Poner = function (g) { grid = E.copiar(g); n = g.length; pintar(); };   // solo pruebas
})();

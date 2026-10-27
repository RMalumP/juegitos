/* memoria.js — Juegos XP: Memoria (parejas) en 4×4, 5×4 y 6×6, para 1 o 2 jugadores en el mismo móvil (js/games/mem-engine.js).
   1 jugador: cronómetro y mejor tiempo por tamaño (memBest_<filas>x<cols>). 2 jugadores: quien acierta repite; gana quien más parejas junte. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var E = window.MemEngine;
  var FIGURAS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐙', '🦋', '🐢', '🐧', '🍎', '🍓', '⚽', '🚀', '🎸', '🌵'];
  var TAM = { '4x4': [4, 4], '4x5': [4, 5], '6x6': [6, 6] };
  var tam = '4x4', jug = 1, est = null, t0 = 0, tTimer = null, seg = 0, rtimer = null;
  try { var s = localStorage.getItem('memTam'); if (TAM[s]) tam = s; var j = parseInt(localStorage.getItem('memJug'), 10); if (j === 2) jug = 2; } catch (e) { /* sin ajustes */ }
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }
  function mejor() { try { return parseFloat(localStorage.getItem('memBest_' + tam)) || 0; } catch (e) { return 0; } }
  function fmt(s) { var m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }

  function pintar() {
    var b = $('memBoard'), f = TAM[tam][0], c = TAM[tam][1];
    if (b.children.length !== est.cartas.length || b.dataset.tam !== tam) {
      b.innerHTML = ''; b.dataset.tam = tam; b.style.setProperty('--c', c); b.style.setProperty('--f', f);
      est.cartas.forEach(function (_, i) { var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'memCarta'; bt.dataset.i = i; bt.addEventListener('click', function () { clic(i); }); b.appendChild(bt); });
    }
    Array.prototype.forEach.call(b.children, function (bt, i) {
      var visible = est.halladas[i] || est.abiertas.indexOf(i) >= 0;
      bt.className = 'memCarta' + (visible ? ' up' : '') + (est.halladas[i] ? ' ok' : '');
      bt.textContent = visible ? FIGURAS[est.cartas[i]] : '';
      bt.disabled = est.halladas[i];
    });
    $('memIntentos').textContent = est.intentos;
    $('memTiempo').textContent = fmt(seg);
    $('memMejor').textContent = jug === 1 && mejor() ? fmt(mejor()) : '–';
    var tur = $('memTurno');
    if (jug === 2) { tur.textContent = est.fase === 'fin' ? '' : '👤 Turno del jugador ' + (est.turno + 1) + ' · ' + est.puntos[0] + ' – ' + est.puntos[1]; } else tur.textContent = 'Parejas: ' + est.halladas.filter(Boolean).length / 2 + ' / ' + est.cartas.length / 2;
    document.querySelectorAll('.memTam').forEach(function (e) { e.classList.toggle('sel', e.dataset.t === tam); });
    document.querySelectorAll('.memJug').forEach(function (e) { e.classList.toggle('sel', +e.dataset.j === jug); });
  }
  /* partida a medias: el botón «Guardar» la guarda y se retoma al abrir el juego */
  function guardarPartida() {
    if (!window.Partida || !est) return;
    if (est.fase === 'fin') { window.Partida.aviso('La partida ya ha terminado'); return; }
    window.Partida.guardar('memoria', { tam: tam, jug: jug, est: est, seg: t0 ? (Date.now() - t0) / 1000 : seg });
    window.Partida.aviso('💾 Partida guardada');
  }
  function restaurar() {
    var d = window.Partida && window.Partida.cargar('memoria');
    if (!d || !TAM[d.tam] || !d.est || d.est.fase !== 'jugando' || !Array.isArray(d.est.cartas) || d.est.cartas.length !== TAM[d.tam][0] * TAM[d.tam][1]) return false;
    clearTimeout(rtimer); clearInterval(tTimer);
    tam = d.tam; jug = d.jug === 2 ? 2 : 1; est = d.est; est.abiertas = []; seg = +d.seg || 0; t0 = 0;
    if (seg > 0) { t0 = Date.now() - seg * 1000; tTimer = setInterval(function () { seg = (Date.now() - t0) / 1000; $('memTiempo').textContent = fmt(seg); }, 250); }
    $('memOver').classList.remove('show'); pintar();
    return true;
  }
  function nueva() {
    clearTimeout(rtimer); clearInterval(tTimer);
    est = E.crear(TAM[tam][0], TAM[tam][1], jug); seg = 0; t0 = 0; $('memOver').classList.remove('show'); pintar();
  }
  function clic(i) {
    if (!est || est.fase !== 'jugando') return;
    if (!t0) { t0 = Date.now(); tTimer = setInterval(function () { seg = (Date.now() - t0) / 1000; $('memTiempo').textContent = fmt(seg); }, 250); }
    var r = E.voltear(est, i); if (!r) return;
    vib(r === 'par' ? [0, 20, 30, 20] : 8); pintar();
    if (r === 'fallo') { rtimer = setTimeout(function () { E.resolver(est); pintar(); }, window.memRapido ? 30 : 900); }
    else if (est.fase === 'fin') fin();
  }
  function fin() {
    clearInterval(tTimer); seg = (Date.now() - t0) / 1000; pintar();
    var tit, sub;
    if (jug === 1) {
      var m = mejor(), nuevo = !m || seg < m;
      if (nuevo) { try { localStorage.setItem('memBest_' + tam, seg.toFixed(2)); } catch (e) { /* nada */ } }
      tit = nuevo ? '🏆 ¡Nuevo récord!' : '🎉 ¡Completado!'; sub = 'Tiempo ' + fmt(seg) + ' · ' + est.intentos + ' intentos' + (m && !nuevo ? ' · récord ' + fmt(m) : '');
    } else { var g = E.ganador(est); tit = g === 2 ? '🤝 Empate' : '🏆 Gana el jugador ' + (g + 1); sub = est.puntos[0] + ' – ' + est.puntos[1] + ' parejas · ' + est.intentos + ' intentos'; }
    $('memOverT').textContent = tit; $('memOverS').textContent = sub; $('memOver').classList.add('show'); vib([0, 40, 60, 40, 60, 40]);
    pintar();
  }
  document.querySelectorAll('.memTam').forEach(function (b) { b.addEventListener('click', function () { tam = b.dataset.t; try { localStorage.setItem('memTam', tam); } catch (e) { /* nada */ } nueva(); }); });
  document.querySelectorAll('.memJug').forEach(function (b) { b.addEventListener('click', function () { jug = +b.dataset.j; try { localStorage.setItem('memJug', jug); } catch (e) { /* nada */ } nueva(); }); });
  $('memSave').addEventListener('click', guardarPartida);
  $('memNewGame').addEventListener('click', nueva); $('mem-again').addEventListener('click', nueva);
  window.initMem = function () { if (!est && !restaurar()) nueva(); };
  window.memStartNew = nueva;
  window.pauseMem = function () { /* el cronómetro sigue solo mientras haya una partida iniciada */ };
  window.memEstado = function () { return est && JSON.parse(JSON.stringify(est)); };
})();

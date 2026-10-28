/* simon.js — Juegos XP: Simon (memoria de secuencias de colores y sonidos). 3 velocidades, récord por velocidad (simBest_<n>).
   Se toca/clica cada color o se usan las teclas 1-4 (también Q W A S). Sonidos con Web Audio. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var FREQ = [392, 330, 262, 196], BASE = [800, 600, 420], NOMBRE = ['Lenta', 'Normal', 'Rápida'];
  var vel = 1, seq = [], pos = 0, fase = 'menu', ronda = 0, mejor = 0, ac = null, tm = [];
  try { var sv = parseInt(localStorage.getItem('simVel'), 10); if (sv >= 0 && sv <= 2) vel = sv; } catch (e) { /* sin ajustes */ }
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }
  function leerMejor() { try { return parseInt(localStorage.getItem('simBest_' + vel), 10) || 0; } catch (e) { return 0; } }
  function esp(ms) { return window.simRapido ? ms / 25 : ms; }
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } return ac; }
  function tono(f, ms, tipo) {
    if (!audio()) return; if (ac.state === 'suspended') ac.resume();
    var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = tipo || 'sine'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.start(t); o.stop(t + ms / 1000 + 0.02);
  }
  function encender(i, ms) {
    var p = document.querySelector('.simPad[data-i="' + i + '"]'); if (!p) return;
    p.classList.add('on'); tono(FREQ[i], Math.max(ms, 120)); setTimeout(function () { p.classList.remove('on'); }, Math.max(esp(ms), 40));
  }
  function limpiar() { tm.forEach(clearTimeout); tm = []; }
  function pintar() {
    $('simRonda').textContent = ronda; $('simMejor').textContent = mejor;
    $('simEstado').textContent = fase === 'muestra' ? '👀 Memoriza…' : fase === 'turno' ? '👉 Tu turno (' + pos + '/' + seq.length + ')' : fase === 'fin' ? '' : 'Pulsa EMPEZAR';
    document.querySelectorAll('.simVel').forEach(function (b) { b.classList.toggle('sel', +b.dataset.v === vel); });
    $('simPads').classList.toggle('bloq', fase !== 'turno');
  }
  function mostrar() {
    fase = 'muestra'; pos = 0; pintar();
    var dur = Math.max(BASE[vel] - 12 * (seq.length - 1), 200), pausa = Math.max(dur * 0.35, 90), t = esp(600);
    seq.forEach(function (c) { tm.push(setTimeout(function () { encender(c, dur); }, t)); t += esp(dur + pausa); });
    tm.push(setTimeout(function () { fase = 'turno'; pos = 0; pintar(); }, t));
  }
  function siguiente() { seq.push(Math.floor(Math.random() * 4)); ronda = seq.length; pintar(); mostrar(); }
  function empezar() { limpiar(); seq = []; ronda = 0; mejor = leerMejor(); $('simOver').classList.remove('show'); $('simStart').style.display = 'none'; audio(); tm.push(setTimeout(siguiente, esp(400))); fase = 'muestra'; pintar(); }
  function pulsar(i) {
    if (fase !== 'turno') return;
    if (i !== seq[pos]) { fallo(); return; }
    encender(i, 250); vib(8); pos++;
    if (pos === seq.length) { fase = 'muestra'; pintar(); vib([0, 25, 40, 25]); tm.push(setTimeout(siguiente, esp(900))); } else pintar();
  }
  function fallo() {
    fase = 'fin'; limpiar(); tono(110, 600, 'sawtooth'); vib(200);
    var conseguida = Math.max(seq.length - 1, 0), m = leerMejor();
    if (conseguida > m) { try { localStorage.setItem('simBest_' + vel, conseguida); } catch (e) { /* nada */ } mejor = conseguida; }
    $('simOverT').textContent = conseguida > m && conseguida > 0 ? '🏆 ¡Nuevo récord!' : 'FIN DE LA PARTIDA';
    $('simOverS').textContent = 'Secuencia completada: ' + conseguida + ' · Mejor (' + NOMBRE[vel] + '): ' + Math.max(m, conseguida);
    $('simOver').classList.add('show'); pintar();
  }
  document.querySelectorAll('.simPad').forEach(function (p) {
    p.addEventListener('pointerdown', function (e) { e.preventDefault(); pulsar(+p.dataset.i); });
    p.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });
  var TECLAS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, KeyQ: 0, KeyW: 1, KeyA: 2, KeyS: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };
  document.addEventListener('keydown', function (e) {
    var w = $('winSim'); if (!w || w.classList.contains('hidden') || e.repeat) return;
    if (e.code in TECLAS) { e.preventDefault(); pulsar(TECLAS[e.code]); }
    else if (e.code === 'Enter') { if (fase === 'menu' || fase === 'fin') empezar(); }
  });
  document.querySelectorAll('.simVel').forEach(function (b) { b.addEventListener('click', function () { if (fase === 'muestra' || fase === 'turno') return; vel = +b.dataset.v; try { localStorage.setItem('simVel', vel); } catch (e) { /* nada */ } mejor = leerMejor(); pintar(); }); });
  $('simGo').addEventListener('click', empezar); $('simAgain').addEventListener('click', empezar);
  $('simNewGame').addEventListener('click', function () { limpiar(); fase = 'menu'; $('simOver').classList.remove('show'); $('simStart').style.display = 'flex'; mejor = leerMejor(); pintar(); });
  window.initSim = function () { mejor = leerMejor(); pintar(); };
  window.simStartNew = function () { $('simNewGame').click(); };
  window.pauseSim = function () { if (fase === 'muestra' || fase === 'turno') { limpiar(); fase = 'menu'; $('simStart').style.display = 'flex'; pintar(); } };
  window.simEstado = function () { return { fase: fase, seq: seq.slice(), pos: pos, ronda: ronda, mejor: mejor, vel: vel }; };
})();

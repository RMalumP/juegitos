/* wordle.js — Juegos XP: Wordle en español (6 intentos, palabras de 5 letras; ñ incluida). Palabra del día (igual para todos según la fecha) o modo libre.
   Estadísticas y la partida del día se guardan en el móvil. Listas: js/games/wordle-palabras.js. Reglas: js/games/wordle-engine.js. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var E = window.WordleEngine, P = window.WORDLE_PALABRAS || { sol: '', ok: '' };
  var SOL = P.sol.split(' '), VALIDAS = {}; SOL.concat(P.ok.split(' ')).forEach(function (w) { VALIDAS[w] = true; });
  var FILAS = 6, N = 5, TECLADO = ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'];
  var modo = 'dia', sol = '', intentos = [], evals = [], actual = '', fase = 'jugando', ocupado = false, msgT = null;
  var stats = { jugadas: 0, ganadas: 0, racha: 0, mejorRacha: 0 };
  try { var ss = JSON.parse(localStorage.getItem('wordleStats')); if (ss) stats = Object.assign(stats, ss); } catch (e) { /* sin estadísticas */ }
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }
  function guardarStats() { try { localStorage.setItem('wordleStats', JSON.stringify(stats)); } catch (e) { /* nada */ } }
  function palabraDelDia() { return SOL[E.indiceDelDia(E.fechaHoy(), SOL.length)]; }

  function construir() {
    var t = $('wrdBoard'); t.innerHTML = '';
    for (var r = 0; r < FILAS; r++) { var f = document.createElement('div'); f.className = 'wrdFila'; for (var c = 0; c < N; c++) { var x = document.createElement('div'); x.className = 'wrdCasilla'; f.appendChild(x); } t.appendChild(f); }
    var k = $('wrdKeys'); k.innerHTML = '';
    TECLADO.forEach(function (fila, i) {
      var d = document.createElement('div'); d.className = 'wrdTFila';
      if (i === 2) d.appendChild(tecla('Enter', 'ENVIAR', 'wide'));
      fila.split('').forEach(function (ch) { d.appendChild(tecla(ch, ch.toUpperCase())); });
      if (i === 2) d.appendChild(tecla('Back', '⌫', 'wide'));
      k.appendChild(d);
    });
  }
  function tecla(v, txt, cl) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'wrdTecla' + (cl ? ' ' + cl : ''); b.dataset.k = v; b.textContent = txt;
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); entrar(v); });
    return b;
  }
  function pintar() {
    var filas = $('wrdBoard').children;
    for (var r = 0; r < FILAS; r++) {
      var cas = filas[r].children, w = r < intentos.length ? intentos[r] : r === intentos.length ? actual : '';
      for (var c = 0; c < N; c++) {
        var cl = 'wrdCasilla', ch = w[c] || '';
        if (r < intentos.length) cl += ' e' + evals[r][c]; else if (ch) cl += ' llena';
        cas[c].className = cl; cas[c].textContent = ch.toUpperCase();
      }
    }
    var st = E.estadoTeclas(intentos, evals);
    document.querySelectorAll('.wrdTecla').forEach(function (b) { var v = st[b.dataset.k]; b.className = 'wrdTecla' + (b.classList.contains('wide') ? ' wide' : '') + (v !== undefined ? ' e' + v : ''); });
    document.querySelectorAll('.wrdModo').forEach(function (b) { b.classList.toggle('sel', b.dataset.m === modo); });
  }
  function aviso(t, ms) { var a = $('wrdMsg'); a.textContent = t; a.classList.add('show'); clearTimeout(msgT); msgT = setTimeout(function () { a.classList.remove('show'); }, ms || 1600); }
  function sacudir() { var f = $('wrdBoard').children[intentos.length]; if (f) { f.classList.remove('sacude'); void f.offsetWidth; f.classList.add('sacude'); } vib(60); }

  function entrar(v) {
    if (fase !== 'jugando' || ocupado) return;
    if (v === 'Enter') return enviar();
    if (v === 'Back') { actual = actual.slice(0, -1); pintar(); return; }
    if (actual.length < N && /^[a-zñ]$/.test(v)) { actual += v; pintar(); }
  }
  function enviar() {
    if (actual.length < N) { aviso('Faltan letras'); sacudir(); return; }
    if (!VALIDAS[actual]) { aviso('No está en la lista de palabras'); sacudir(); return; }
    var ev = E.evaluar(sol, actual); intentos.push(actual); evals.push(ev); actual = '';
    guardarPartida(); pintar(); vib(12);
    if (ev.every(function (x) { return x === 2; })) terminar(true);
    else if (intentos.length === FILAS) terminar(false);
  }
  function terminar(gano) {
    fase = gano ? 'gana' : 'pierde';
    if (modo === 'dia') {                                    // solo la palabra del día cuenta para las estadísticas
      stats.jugadas++; if (gano) { stats.ganadas++; stats.racha++; stats.mejorRacha = Math.max(stats.mejorRacha, stats.racha); } else stats.racha = 0;
      guardarStats();
    }
    guardarPartida();
    setTimeout(function () { mostrarFin(gano); }, window.wordleRapido ? 10 : 900);
  }
  function mostrarFin(gano) {
    $('wrdOverT').textContent = gano ? ['¡Genial!', '¡Increíble!', '¡Muy bien!', '¡Bien hecho!', '¡Por poco!', '¡Uf, justo!'][intentos.length - 1] : 'Era «' + sol.toUpperCase() + '»';
    $('wrdOverS').textContent = (gano ? 'La has acertado en ' + intentos.length + ' intento' + (intentos.length > 1 ? 's' : '') + '.' : 'Otra vez será.') + (modo === 'dia' ? '  ·  Jugadas ' + stats.jugadas + ' · Victorias ' + (stats.jugadas ? Math.round(100 * stats.ganadas / stats.jugadas) : 0) + '% · Racha ' + stats.racha + ' (mejor ' + stats.mejorRacha + ')' : '');
    $('wrdShare').style.display = modo === 'dia' ? '' : 'none'; $('wrdOver').classList.add('show');
  }
  function guardarPartida() {
    if (modo !== 'dia') return;
    try { localStorage.setItem('wordleDia', JSON.stringify({ fecha: E.fechaHoy(), intentos: intentos, fase: fase })); } catch (e) { /* nada */ }
  }
  function empezar(m) {
    modo = m; actual = ''; intentos = []; evals = []; fase = 'jugando'; $('wrdOver').classList.remove('show');
    if (m === 'dia') {
      sol = palabraDelDia();
      try {
        var g = JSON.parse(localStorage.getItem('wordleDia'));
        if (g && g.fecha === E.fechaHoy() && Array.isArray(g.intentos)) { g.intentos.forEach(function (w) { intentos.push(w); evals.push(E.evaluar(sol, w)); }); fase = g.fase || 'jugando'; }
      } catch (e) { /* partida nueva */ }
    } else sol = SOL[Math.floor(Math.random() * SOL.length)];
    pintar();
    if (fase !== 'jugando') setTimeout(function () { mostrarFin(fase === 'gana'); }, 300);
  }
  document.addEventListener('keydown', function (e) {
    var w = $('winWord'); if (!w || w.classList.contains('hidden') || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.code === 'Enter') { e.preventDefault(); if ($('wrdOver').classList.contains('show')) return; entrar('Enter'); }
    else if (e.code === 'Backspace') { e.preventDefault(); entrar('Back'); }
    else if (e.key && e.key.length === 1) { var k = E.normalizar(e.key); if (/^[a-zñ]$/.test(k)) entrar(k); }
  });
  document.querySelectorAll('.wrdModo').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.m === 'libre' || b.dataset.m === 'dia') empezar(b.dataset.m); }); });
  $('wordNewGame').addEventListener('click', function () { empezar('libre'); });
  $('wrdAgain').addEventListener('click', function () { empezar('libre'); });
  $('wrdShare').addEventListener('click', function () {
    var txt = E.compartir('Wordle ES ' + E.fechaHoy(), FILAS, FILAS, evals);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { aviso('Resultado copiado'); }, function () { aviso(txt, 4000); }); else aviso(txt, 4000);
  });
  construir();
  window.initWord = function () { if (!sol) empezar('dia'); };
  window.wordStartNew = function () { empezar('libre'); };
  window.pauseWord = function () { /* sin reloj */ };
  window.wordleEstado = function () { return { modo: modo, sol: sol, intentos: intentos.slice(), fase: fase, actual: actual, stats: Object.assign({}, stats) }; };
})();

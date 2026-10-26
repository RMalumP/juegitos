/* flappy.js — Juegos XP: Flappy (un toque / clic / Espacio para aletear). 3 dificultades (hueco y velocidad de las tuberías), récord por dificultad (flapBest_<n>).
   Física a paso fijo de 60 Hz. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('flapC'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  var GROUND = 48, BX = 76, R = 11, PW = 46, SEP = 170;
  var DIF = [{ n: 'Fácil', gap: 150, vel: 1.7, grav: 0.34 }, { n: 'Normal', gap: 128, vel: 2.1, grav: 0.38 }, { n: 'Difícil', gap: 108, vel: 2.6, grav: 0.42 }];
  var dif = 1, by = H / 2, vy = 0, pipes = [], score = 0, best = 0, fase = 'listo', raf = null, acc = 0, last = 0, suelo = 0, aleteo = 0;
  try { var sd = parseInt(localStorage.getItem('flapDif'), 10); if (sd >= 0 && sd <= 2) dif = sd; } catch (e) { /* sin ajustes */ }
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }
  function leerMejor() { try { return parseInt(localStorage.getItem('flapBest_' + dif), 10) || 0; } catch (e) { return 0; } }

  function reiniciar() { by = H / 2; vy = 0; pipes = []; score = 0; fase = 'listo'; best = leerMejor(); $('flapOver').classList.remove('show'); hud(); }
  function hud() { $('flap-scoreEl').textContent = score; $('flap-bestEl').textContent = best; document.querySelectorAll('.flapDif').forEach(function (b) { b.classList.toggle('sel', +b.dataset.d === dif); }); }
  function nuevaTuberia(x) { var d = DIF[dif], min = 60, max = H - GROUND - d.gap - 60; pipes.push({ x: x, gy: min + Math.random() * (max - min), pasada: false }); }
  function aletear() {
    if (fase === 'listo') { fase = 'jugando'; nuevaTuberia(W + 30); }
    if (fase !== 'jugando') return;
    vy = -6.3; aleteo = 8; vib(6);
  }
  function morir() {
    if (fase === 'muerto') return; fase = 'muerto'; vib(150);
    if (score > best) { best = score; try { localStorage.setItem('flapBest_' + dif, best); } catch (e) { /* nada */ } }
    var medalla = score >= 30 ? '🥇 Oro' : score >= 20 ? '🥈 Plata' : score >= 10 ? '🥉 Bronce' : '';
    $('flapOverT').textContent = 'GAME OVER'; $('flapOverS').textContent = 'Puntos: ' + score + ' · Mejor (' + DIF[dif].n + '): ' + best + (medalla ? ' · ' + medalla : '');
    $('flapOver').classList.add('show'); hud();
  }
  function step() {
    var d = DIF[dif]; suelo = (suelo + (fase === 'muerto' ? 0 : d.vel)) % 24; if (aleteo > 0) aleteo--;
    if (fase === 'listo') { by = H / 2 + Math.sin(Date.now() / 220) * 6; return; }
    if (fase === 'muerto') { if (by < H - GROUND - R) { vy += d.grav; by += vy; if (by > H - GROUND - R) by = H - GROUND - R; } return; }
    vy = Math.min(vy + d.grav, 9); by += vy;
    pipes.forEach(function (p) { p.x -= d.vel; });
    if (pipes.length && pipes[0].x < -PW - 4) pipes.shift();
    var ult = pipes[pipes.length - 1]; if (!ult || ult.x < W - SEP) nuevaTuberia(ult ? ult.x + SEP : W + 30);
    pipes.forEach(function (p) { if (!p.pasada && p.x + PW < BX - R) { p.pasada = true; score++; vib(10); hud(); } });
    if (by + R >= H - GROUND || by - R <= 0) { by = Math.max(by, R); return morir(); }
    for (var i = 0; i < pipes.length; i++) {
      var p = pipes[i];
      if (BX + R > p.x && BX - R < p.x + PW && (by - R < p.gy || by + R > p.gy + d.gap)) return morir();
    }
  }
  function dibujar() {
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#4ec0ca'); g.addColorStop(1, '#a8e6f0'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff55'; [[40, 90, 26], [150, 60, 20], [230, 120, 24]].forEach(function (c) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, 7); ctx.arc(c[0] + 24, c[1] + 4, c[2] * 0.8, 0, 7); ctx.fill(); });
    var gap = DIF[dif].gap;
    pipes.forEach(function (p) {
      ctx.fillStyle = '#5cb85c'; ctx.fillRect(p.x, 0, PW, p.gy); ctx.fillRect(p.x, p.gy + gap, PW, H - GROUND - p.gy - gap);
      ctx.fillStyle = '#3d8b3d'; ctx.fillRect(p.x - 3, p.gy - 16, PW + 6, 16); ctx.fillRect(p.x - 3, p.gy + gap, PW + 6, 16);
      ctx.fillStyle = '#ffffff30'; ctx.fillRect(p.x + 6, 0, 6, p.gy - 16); ctx.fillRect(p.x + 6, p.gy + gap + 16, 6, H - GROUND - p.gy - gap - 16);
    });
    ctx.fillStyle = '#ded895'; ctx.fillRect(0, H - GROUND, W, GROUND); ctx.fillStyle = '#73bf2e'; ctx.fillRect(0, H - GROUND, W, 8);
    ctx.fillStyle = '#c9c081'; for (var x = -suelo; x < W; x += 24) ctx.fillRect(x, H - GROUND + 14, 12, 4);
    ctx.save(); ctx.translate(BX, by); ctx.rotate(Math.max(-0.5, Math.min(1.2, vy * 0.08)));
    ctx.fillStyle = '#f7d51d'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
    ctx.fillStyle = '#f08c00'; ctx.beginPath(); ctx.ellipse(-3, aleteo > 0 ? -2 : 3, 6, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, -3, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(6, -3, 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8501a'; ctx.beginPath(); ctx.moveTo(8, 1); ctx.lineTo(16, 3); ctx.lineTo(8, 6); ctx.fill(); ctx.restore();
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.font = 'bold 34px Arial';
    if (fase !== 'listo') { ctx.strokeText(score, W / 2, 56); ctx.fillText(score, W / 2, 56); }
    else { ctx.font = 'bold 15px Arial'; ctx.lineWidth = 3; ctx.strokeText('Toca o pulsa ESPACIO', W / 2, H / 2 + 60); ctx.fillText('Toca o pulsa ESPACIO', W / 2, H / 2 + 60); }
  }
  function bucle(t) {
    var now = t || performance.now(); acc += Math.min(now - (last || now), 100); last = now;
    var n = 0; while (acc >= 1000 / 60 && n < 6) { step(); acc -= 1000 / 60; n++; }
    dibujar(); raf = requestAnimationFrame(bucle);
  }
  function arrancar() { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(bucle); }
  var area = $('flapCanvasWrap');
  area.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('#flapOver')) return; e.preventDefault(); aletear(); });
  var TK = window.Teclas.crear({ id: 'flap', ventana: 'winFlap', titulo: 'Flappy', acciones: [
    { id: 'aletear', etiqueta: 'Aletear', def: 'Space', alt: ['ArrowUp', 'KeyW'] }, { id: 'reiniciar', etiqueta: 'Reiniciar (al morir)', def: 'Enter' }] });
  document.addEventListener('keydown', function (e) {
    var w = $('winFlap'); if (!w || w.classList.contains('hidden')) return;
    var a = TK.accion(e.code); if (!a) return;
    if (a === 'aletear') { e.preventDefault(); if (!e.repeat) { if (fase === 'muerto') return; aletear(); } }
    else if (a === 'reiniciar' && !e.repeat && fase === 'muerto') reiniciar();
  });
  document.querySelectorAll('.flapDif').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); dif = +b.dataset.d; try { localStorage.setItem('flapDif', dif); } catch (er) { /* nada */ } reiniciar(); }); });
  $('flap-again').addEventListener('click', reiniciar); $('flapNewGame').addEventListener('click', reiniciar);
  document.addEventListener('visibilitychange', function () { if (document.hidden && fase === 'jugando') { cancelAnimationFrame(raf); } else if (!document.hidden && $('winFlap') && !$('winFlap').classList.contains('hidden')) arrancar(); });
  window.initFlap = function () { reiniciar(); arrancar(); };
  window.flapStartNew = reiniciar;
  window.pauseFlap = function () { cancelAnimationFrame(raf); };
  window.flapEstado = function () {
    var sig = pipes.find(function (p) { return p.x + PW >= BX - R; });
    return { fase: fase, score: score, by: by, vy: vy, dif: dif, gapY: sig ? sig.gy + DIF[dif].gap / 2 : null, sigX: sig ? sig.x : null, best: best };
  };
  window.flapAletear = aletear;
})();

/* breakout.js — Juegos XP: Breakout con 15 niveles (patrones de ladrillos, ladrillos de 2-3 golpes y cápsulas).
   Pala con el dedo/ratón (arrastrar) o teclado (← → / A D); toque o Espacio lanzan la bola; P pausa. Récord en localStorage (brkBest). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('brkC'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  var COLS = 10, BW = 32, BH = 14, TOP = 36, PY = 396, PH = 10, R = 5, MAXLVL = 15;
  var COLORES = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#ecf0f1'];
  var level = 1, startLevel = 1, score = 0, lives = 3, best = 0;
  var bricks = [], balls = [], caps = [], paddle = { x: W / 2, w: 56 }, objetivoX = null, pegada = true;
  var ancha = 0, lenta = 0;                                   // temporizadores (fotogramas) de las cápsulas
  var running = false, paused = false, over = false, raf = null, aviso = '', avisoT = 0;
  var teclas = { l: false, r: false };
  try { best = parseInt(localStorage.getItem('brkBest'), 10) || 0; } catch (e) { /* sin ajustes */ }
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- niveles ---------- */
  function patron(l) {                                        // matriz filas×10 con la vida de cada ladrillo (0 = hueco)
    var filas = Math.min(4 + Math.floor((l - 1) / 3), 8), forma = (l - 1) % 6, g = [];
    for (var r = 0; r < filas; r++) {
      var fila = [];
      for (var c = 0; c < COLS; c++) {
        var v = 1;
        if (forma === 1) v = (r + c) % 2 === 0 ? 1 : 0;                                 // tablero de ajedrez
        else if (forma === 2) v = Math.abs(c - 4.5) < (2 + 2 * r) / 2 ? 1 : 0;           // pirámide (ensancha hacia abajo)
        else if (forma === 3) v = r % 2 === 0 ? 1 : (c % 3 === 1 ? 0 : 1);              // rayas con huecos
        else if (forma === 4) v = Math.abs(c - 4.5) + Math.abs(r - (filas - 1) / 2) <= filas / 2 + 1.5 ? 1 : 0;   // rombo
        else if (forma === 5) v = c === 0 || c === COLS - 1 || r % 2 === 0 ? 1 : 0;     // marco
        if (v && l >= 4 && r < Math.min(Math.floor((l - 1) / 3), 3)) v = l >= 10 && r === 0 ? 3 : 2;   // arriba, ladrillos duros
        fila.push(v);
      }
      g.push(fila);
    }
    return g;
  }
  function velBase() { return Math.min(3.6 + 0.14 * level, 6); }
  function construirNivel() {
    bricks = []; caps = []; balls = []; ancha = 0; lenta = 0; paddle.w = 56; pegada = true;
    patron(level).forEach(function (fila, r) { fila.forEach(function (v, c) { if (v) bricks.push({ x: c * BW, y: TOP + r * BH, hp: v, max: v, r: r }); }); });
    if (!bricks.length) bricks.push({ x: 0, y: TOP, hp: 1, max: 1, r: 0 });
    nuevaBola();
  }
  function nuevaBola() { balls = [{ x: paddle.x, y: PY - R - 1, vx: 0, vy: 0 }]; pegada = true; }
  function lanzar() {
    if (!pegada || !balls.length) return; pegada = false;
    var s = velBase(), a = (Math.random() * 0.5 - 0.25); balls[0].vx = s * Math.sin(a); balls[0].vy = -s * Math.cos(a);
  }
  function hud() { $('brk-scoreEl').textContent = ' ' + score; $('brk-livesEl').textContent = lives; $('brk-levelEl').textContent = level; }

  /* ---------- física ---------- */
  function velActual(b) { var s = Math.hypot(b.vx, b.vy), t = velBase() * (lenta > 0 ? 0.7 : 1) * (1 + Math.min(0.15, (hitsPala * 0.004))); return { s: s, t: t }; }
  var hitsPala = 0;
  function golpeLadrillo(br) {
    br.hp--; vib(8);
    if (br.hp <= 0) {
      score += 10 * br.max; hud(); br.muerto = true;
      var rnd = Math.random();
      if (rnd < 0.14) caps.push({ x: br.x + BW / 2, y: br.y, t: ['W', 'M', 'S'][Math.floor(Math.random() * 3)] });
      else if (rnd < 0.17) caps.push({ x: br.x + BW / 2, y: br.y, t: 'L' });
    } else score += 2;
  }
  function pasoBola(b) {
    var n = 2;                                                 // dos subpasos: la bola nunca atraviesa un ladrillo
    for (var k = 0; k < n; k++) {
      b.x += b.vx / n; b.y += b.vy / n;
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); } else if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); }
      if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); }
      if (b.vy > 0 && b.y + R >= PY && b.y - R <= PY + PH && b.x >= paddle.x - paddle.w / 2 - R && b.x <= paddle.x + paddle.w / 2 + R) {
        var rel = clamp((b.x - paddle.x) / (paddle.w / 2), -1, 1), s = Math.hypot(b.vx, b.vy) || velBase();
        hitsPala++; var t = velActual(b).t; s = Math.max(s, t);
        b.vx = s * rel * 0.85; b.vy = -Math.sqrt(Math.max(s * s - b.vx * b.vx, s * s * 0.12)); b.y = PY - R; vib(6);
      }
      for (var i = 0; i < bricks.length; i++) {
        var br = bricks[i]; if (br.muerto) continue;
        var cx = clamp(b.x, br.x, br.x + BW), cy = clamp(b.y, br.y, br.y + BH), dx = b.x - cx, dy = b.y - cy;
        if (dx * dx + dy * dy < R * R) {
          if (Math.abs(dx) > Math.abs(dy)) b.vx = (dx > 0 ? 1 : -1) * Math.abs(b.vx); else b.vy = (dy > 0 ? 1 : -1) * Math.abs(b.vy);
          if (dx === 0 && dy === 0) b.vy = -b.vy;
          golpeLadrillo(br); break;
        }
      }
    }
  }
  function efecto(t) {
    if (t === 'W') { ancha = 60 * 14; aviso = 'PALA ANCHA'; }
    else if (t === 'S') { lenta = 60 * 10; aviso = 'BOLA LENTA'; balls.forEach(function (b) { var f = 0.7; b.vx *= f; b.vy *= f; }); }
    else if (t === 'L') { lives = Math.min(lives + 1, 6); hud(); aviso = '+1 VIDA'; }
    else if (t === 'M') {
      aviso = 'MULTIBOLA'; var base = balls.slice();
      base.forEach(function (b) { if (pegada) return; for (var k = -1; k <= 1; k += 2) { var a = Math.atan2(b.vy, b.vx) + k * 0.4, s = Math.hypot(b.vx, b.vy); balls.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s }); } });
    }
    avisoT = 90; vib([0, 30, 30, 30]);
  }
  function step() {
    if (paused || over) return;
    if (teclas.l) objetivoX = (objetivoX == null ? paddle.x : objetivoX) - 6;
    if (teclas.r) objetivoX = (objetivoX == null ? paddle.x : objetivoX) + 6;
    if (objetivoX != null) { paddle.x += clamp(objetivoX - paddle.x, -14, 14); objetivoX = clamp(objetivoX, paddle.w / 2, W - paddle.w / 2); }
    if (ancha > 0) { ancha--; paddle.w = Math.min(88, paddle.w + 2); } else paddle.w = Math.max(56, paddle.w - 2);
    if (lenta > 0) lenta--; if (avisoT > 0) avisoT--;
    paddle.x = clamp(paddle.x, paddle.w / 2, W - paddle.w / 2);
    if (pegada) { if (balls[0]) { balls[0].x = paddle.x; balls[0].y = PY - R - 1; } }
    else balls.forEach(pasoBola);
    bricks = bricks.filter(function (b) { return !b.muerto; });
    balls = balls.filter(function (b) { return b.y < H + R; });
    for (var i = caps.length - 1; i >= 0; i--) {
      var c = caps[i]; c.y += 2;
      if (c.y + 6 >= PY && c.y - 6 <= PY + PH && Math.abs(c.x - paddle.x) <= paddle.w / 2 + 6) { efecto(c.t); caps.splice(i, 1); }
      else if (c.y > H + 10) caps.splice(i, 1);
    }
    if (!balls.length) {
      lives--; hud(); vib(120); hitsPala = 0;
      if (lives <= 0) return finPartida();
      ancha = 0; lenta = 0; caps = []; nuevaBola();
    } else if (!bricks.length) {
      level++; score += 100; hud(); aviso = 'NIVEL ' + level; avisoT = 100; vib([0, 40, 60, 40]); hitsPala = 0; construirNivel(); hud();
    }
  }
  function finPartida() {
    over = true; running = false;
    if (score > best) { best = score; try { localStorage.setItem('brkBest', best); } catch (e) { /* nada */ } }
    $('brkOverT').textContent = 'GAME OVER'; $('brkOverS').textContent = 'Puntos: ' + score + '  ·  Nivel: ' + level + '  ·  Mejor: ' + best;
    $('brkOver').classList.add('show');
  }

  /* ---------- dibujo ---------- */
  function dibujar() {
    ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, W, H);
    bricks.forEach(function (b) {
      ctx.fillStyle = b.max === 3 ? (b.hp === 3 ? '#7f8c8d' : b.hp === 2 ? '#95a5a6' : '#bdc3c7') : COLORES[b.r % COLORES.length];
      if (b.max === 2 && b.hp === 1) ctx.globalAlpha = 0.6;
      ctx.fillRect(b.x + 1, b.y + 1, BW - 2, BH - 2); ctx.globalAlpha = 1;
      if (b.max > 1) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(b.x + 2.5, b.y + 2.5, BW - 5, BH - 5); }
    });
    caps.forEach(function (c) {
      ctx.fillStyle = c.t === 'L' ? '#e74c3c' : c.t === 'W' ? '#3498db' : c.t === 'M' ? '#f1c40f' : '#9b59b6';
      ctx.fillRect(c.x - 9, c.y - 6, 18, 12); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Courier New'; ctx.textAlign = 'center'; ctx.fillText(c.t === 'L' ? '♥' : c.t, c.x, c.y + 4);
    });
    ctx.fillStyle = '#ecf0f1'; ctx.fillRect(paddle.x - paddle.w / 2, PY, paddle.w, PH);
    ctx.fillStyle = '#fff'; balls.forEach(function (b) { ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, Math.PI * 2); ctx.fill(); });
    ctx.textAlign = 'center';
    if (pegada && running && !paused) { ctx.fillStyle = '#9fb3c8'; ctx.font = '11px Courier New'; ctx.fillText('toca o pulsa ESPACIO para lanzar', W / 2, PY - 30); }
    if (avisoT > 0) { ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 16px Courier New'; ctx.fillText(aviso, W / 2, H / 2); }
    if (paused) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Courier New'; ctx.fillText('PAUSA', W / 2, H / 2); }
  }
  var acc = 0, last = 0;
  function bucle(t) {
    var now = t || performance.now(); acc += Math.min(now - (last || now), 100); last = now;
    var g = 0; while (acc >= 1000 / 60 && g < 6) { step(); acc -= 1000 / 60; g++; }
    dibujar(); if (running) raf = requestAnimationFrame(bucle);
  }

  /* ---------- partida ---------- */
  function nueva() {
    level = startLevel; score = 0; lives = 3; over = false; paused = false; hitsPala = 0; objetivoX = null; paddle.x = W / 2;
    $('brkStart').style.display = 'none'; $('brkOver').classList.remove('show');
    construirNivel(); hud(); running = true; last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(bucle);
  }
  function pausar(p) { if (!running || over) return; paused = p; if (!p) { last = 0; } dibujar(); }
  window.pauseBrk = function () { pausar(true); };
  window.initBrk = function () { if (!running) { balls = []; bricks = []; dibujar(); } };
  window.brkStartNew = function () { $('brkStart').style.display = 'flex'; running = false; over = false; cancelAnimationFrame(raf); };
  window.brkEstado = function () { return { level: level, score: score, lives: lives, bricks: bricks.length, balls: balls.length, bx: balls[0] ? balls[0].x : null, by: balls[0] ? balls[0].y : null, paddle: paddle.x, pegada: pegada, running: running, over: over, caps: caps.length }; };
  window.brkMoverA = function (x) { objetivoX = x; };                  // solo pruebas
  window.brkLanzar = lanzar;

  /* ---------- entrada ---------- */
  function xDe(e) { var r = cv.getBoundingClientRect(); return (e.clientX - r.left) * (W / r.width); }
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', function (e) { if (!running) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* nada */ } if (paused) { pausar(false); return; } objetivoX = xDe(e); lanzar(); });
  cv.addEventListener('pointermove', function (e) { if (running && (e.buttons || e.pointerType === 'touch' || e.pointerType === 'mouse')) objetivoX = xDe(e); });
  document.addEventListener('keydown', function (e) {
    var w = $('winBrk'); if (!w || w.classList.contains('hidden')) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { teclas.l = true; e.preventDefault(); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { teclas.r = true; e.preventDefault(); }
    else if (e.code === 'Space') { e.preventDefault(); if (running && !e.repeat) { if (paused) pausar(false); else lanzar(); } }
    else if (e.code === 'KeyP' && !e.repeat) pausar(!paused);
    else if (e.code === 'Enter' && !e.repeat) { if (!running) nueva(); }
  });
  document.addEventListener('keyup', function (e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') teclas.l = false; else if (e.code === 'ArrowRight' || e.code === 'KeyD') teclas.r = false; });
  window.addEventListener('blur', function () { teclas.l = teclas.r = false; });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pausar(true); });
  $('brk-startBtn').addEventListener('click', nueva); $('brk-restartBtn').addEventListener('click', function () { $('brkOver').classList.remove('show'); window.brkStartNew(); });
  $('brkNewGame').addEventListener('click', window.brkStartNew);
  (function () {
    var g = $('brkLevelGrid'); function marcar() { g.querySelectorAll('.brkLevelCell').forEach(function (c) { c.classList.toggle('selected', +c.textContent === startLevel); }); }
    for (var i = 1; i <= MAXLVL; i++) { var c = document.createElement('div'); c.className = 'brkLevelCell'; c.textContent = i; c.addEventListener('click', (function (n) { return function () { startLevel = n; marcar(); }; })(i)); g.appendChild(c); }
    marcar();
  })();
})();

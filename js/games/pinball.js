/* pinball.js — Juegos XP: Pinball espacial, inspirado en el pinball de escritorio de Windows XP (gráficos y sonidos propios).
   Mesa vertical con 2 flippers, lanzador con muelle, 3 bumpers, slingshots, 3 carriles superiores (multiplicador), 4 dianas abatibles,
   agujero negro y rangos (de Cadete a Almirante; al llegar a Capitán, bola extra). 3 bolas; récord con saveRecord('pinball').
   Teclado: Z / ← flipper izquierdo, M / → derecho, Espacio / ↓ lanzador (mantén para cargar), P pausa, Intro nueva partida.
   Táctil: mitad izquierda o derecha de la mesa = flipper; con la bola en el lanzador, la mitad derecha carga el muelle (suelta para lanzar).
   Física de paso fijo a 60 pasos/s con 8 subpasos (la bola nunca atraviesa un muro). Pausa al minimizar o cambiar de pestaña. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('pinC'), ctx = cv.getContext('2d'), W = 360, H = 600, dpr = 1;
  var R = 7, G = 0.25, SUB = 8, VMAX = 20, CARRIL = 322, MUELLE = 578, LANE_Y = 78;
  var RANGOS = ['CADETE', 'ALFÉREZ', 'TENIENTE', 'CAPITÁN', 'COMANDANTE', 'ALMIRANTE'];
  var CARRILES = [130, 166, 202];
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- mesa ---------- */
  var muros = [];                                             // segmentos con grosor: {ax, ay, bx, by, r, e (rebote), k (patada), t}
  function muro(ax, ay, bx, by, o) {
    var m = { ax: ax, ay: ay, bx: bx, by: by, r: 1.5, e: 0.45, k: 0, t: 'm' };
    for (var p in o) m[p] = o[p];
    muros.push(m); return m;
  }
  (function () {                                              // cúpula superior: arco de centro (180,180) y radio 170
    var n = 28, px = 10, py = 180;
    for (var i = 1; i <= n; i++) { var a = Math.PI + Math.PI * i / n, x = 180 + 170 * Math.cos(a), y = 180 + 170 * Math.sin(a); muro(px, py, x, y); px = x; py = y; }
  })();
  muro(10, 180, 10, 420); muro(350, 180, 350, 612); muro(CARRIL, 140, CARRIL, 612);
  muro(10, 420, 96, 508); muro(CARRIL, 420, 236, 508);         // guías hacia los flippers
  var slings = [0, 1].map(function (lado) {                    // slingshots: triángulo con tapa; la cara interior da una patada
    var X = function (x) { return lado ? 332 - x : x; };
    muro(X(10), 350, X(32), 366); muro(X(32), 366, X(32), 442); muro(X(32), 442, X(80), 474);
    return muro(X(80), 474, X(32), 366, { e: 0.5, k: 3, t: 's', flash: 0 });
  });
  [112, 148, 184, 220].forEach(function (x) { muro(x, 60, x, 94, { r: 3, e: 0.4 }); });   // separadores de los carriles
  var puerta = { ax: CARRIL, ay: 140, bx: 350, by: 120, r: 1.5, e: 0.3, k: 0 };          // la bola no vuelve al carril del lanzador
  var bumpers = [{ x: 126, y: 178 }, { x: 206, y: 178 }, { x: 166, y: 236 }].map(function (b) { b.r = 17; b.flash = 0; return b; });
  var dianas = [0, 1, 2, 3].map(function (i) { return { ax: 316, ay: 250 + i * 24, bx: 316, by: 268 + i * 24, r: 3, e: 0.4, k: 0, abajo: false }; });
  var agujero = { x: 52, y: 300 };
  function flipper(x, rest, up) { return { x: x, y: 516, ang: rest, rest: rest, up: up, w: 0, on: false, L: 56 }; }
  var fl = flipper(104, 0.5, -0.45), fr = flipper(228, Math.PI - 0.5, Math.PI + 0.45);

  /* ---------- estado ---------- */
  var score = 0, bola = 1, extra = 0, mult = 1, misiones = 0, rango = 0, best = 0;
  var lit = [false, false, false], bolaAct = null, espera = 0, reponerDianas = 0, carga = 0, cargando = false;
  var running = false, paused = false, over = false, raf = null, aviso = '', avisoT = 0, tick = 0;
  var tecla = { l: false, r: false, p: false }, punteros = {};
  try { best = (typeof loadRecord === 'function' && loadRecord('pinball')) || 0; } catch (e) { /* sin récord */ }

  /* ---------- sonido (Web Audio, sintetizado) ---------- */
  var audio = null, mudo = false;
  try { mudo = localStorage.getItem('pinMudo') === '1'; } catch (e) { /* sin ajustes */ }
  function ac() {
    if (!audio) try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
    if (audio && audio.state === 'suspended') audio.resume();
    return audio;
  }
  function tono(f1, f2, dur, tipo, vol, retraso) {
    if (mudo) return; var a = ac(); if (!a) return;
    var t = a.currentTime + (retraso || 0), o = a.createOscillator(), g = a.createGain();
    o.type = tipo || 'square'; o.frequency.setValueAtTime(f1, t); if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  var SON = {
    flipper: function () { tono(140, 70, 0.05, 'square', 0.05); },
    bumper: function () { tono(620, 300, 0.09, 'square', 0.06); },
    sling: function () { tono(330, 200, 0.07, 'triangle', 0.08); },
    carril: function () { tono(880, 1320, 0.1, 'sine', 0.07); },
    diana: function () { tono(240, 120, 0.1, 'sawtooth', 0.05); },
    lanzar: function () { tono(90, 420, 0.25, 'sawtooth', 0.05); },
    agujero: function () { tono(700, 60, 0.6, 'sine', 0.09); },
    expulsar: function () { tono(80, 900, 0.3, 'square', 0.05); },
    perder: function () { [392, 330, 262, 196].forEach(function (f, i) { tono(f, f * 0.97, 0.16, 'triangle', 0.08, i * 0.14); }); },
    premio: function () { [523, 659, 784, 1047].forEach(function (f, i) { tono(f, f, 0.1, 'square', 0.05, i * 0.08); }); }
  };
  function ponerSonido() { var b = $('pinSonido'); if (b) b.textContent = mudo ? '🔇 Sonido' : '🔊 Sonido'; }

  /* ---------- puntos y objetivos ---------- */
  function hud() { $('pin-scoreEl').textContent = score; $('pin-bolaEl').textContent = bola + (extra ? '+' + extra : ''); $('pin-multEl').textContent = '×' + mult; }
  function sumar(n) { score += n; hud(); }
  function avisar(t, dur) { aviso = t; avisoT = dur || 90; }
  function mision(texto) {
    misiones++; var nuevo = Math.min(RANGOS.length - 1, Math.floor(misiones / 2));
    if (nuevo > rango) {
      rango = nuevo; sumar(10000 * rango); SON.premio(); vib([0, 40, 40, 40]);
      if (rango === 3) { extra++; hud(); avisar('¡' + RANGOS[rango] + '! BOLA EXTRA', 140); } else avisar('¡ASCENSO! ' + RANGOS[rango], 120);
    } else avisar(texto);
  }
  function encenderCarril(i) {
    if (lit[i]) { sumar(100); return; }
    lit[i] = true; sumar(500 * mult); SON.carril();
    if (lit[0] && lit[1] && lit[2]) {
      lit = [false, false, false]; sumar(2000 * mult); SON.premio();
      if (mult < 5) mult++; hud(); mision('MULTIPLICADOR ×' + mult);
    }
  }
  function rotarCarriles(dir) { lit = dir < 0 ? [lit[1], lit[2], lit[0]] : [lit[2], lit[0], lit[1]]; }
  function tumbarDiana(d) {
    d.abajo = true; sumar(750 * mult); SON.diana(); vib(10);
    if (dianas.every(function (x) { return x.abajo; })) { sumar(5000 * mult); SON.premio(); reponerDianas = 60; mision('DIANAS COMPLETAS'); }
  }

  /* ---------- física ---------- */
  function cercano(ax, ay, bx, by, x, y) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
    t = clamp(t, 0, 1); return [ax + dx * t, ay + dy * t, t];
  }
  /* Choque de la bola con un punto de radio rad que se mueve a (ux, uy). Devuelve la velocidad de impacto (0 si no hay choque). */
  function choque(b, px, py, rad, e, ux, uy, kick) {
    var dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy, rr = R + rad;
    if (d2 >= rr * rr) return 0;
    var d = Math.sqrt(d2) || 0.0001, nx = d2 ? dx / d : 0, ny = d2 ? dy / d : -1;
    b.x = px + nx * rr; b.y = py + ny * rr;
    var vn = (b.vx - ux) * nx + (b.vy - uy) * ny;
    if (vn >= 0) return 0;
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    if (kick && -vn > 2.5) { b.vx += nx * kick; b.vy += ny * kick; }
    return -vn;
  }
  function contraMuro(b, m) { var c = cercano(m.ax, m.ay, m.bx, m.by, b.x, b.y); return choque(b, c[0], c[1], m.r, m.e, 0, 0, m.k); }
  function puntaFlipper(f) { return [f.x + Math.cos(f.ang) * f.L, f.y + Math.sin(f.ang) * f.L]; }
  function contraFlipper(b, f) {
    var p = puntaFlipper(f), c = cercano(f.x, f.y, p[0], p[1], b.x, b.y), rad = 9 - 4 * c[2];
    return choque(b, c[0], c[1], rad, 0.3, -f.w * (c[1] - f.y), f.w * (c[0] - f.x), 0);
  }
  function enLanzador() { return !!bolaAct && bolaAct.enCarril && bolaAct.y > MUELLE - 60; }
  function subpaso(b) {
    fl.ang += fl.w / SUB; fr.ang += fr.w / SUB;
    if (b.capt > 0) return;
    b.vy += G / SUB; b.vx *= 0.9998; b.vy *= 0.9998;
    var yAnt = b.y;
    b.x += b.vx / SUB; b.y += b.vy / SUB;
    if (b.enCarril && b.x < CARRIL - 4) b.enCarril = false;
    for (var i = 0; i < muros.length; i++) {
      var m = muros[i], imp = contraMuro(b, m);
      if (imp > 2.5 && m.t === 's') { m.flash = 8; sumar(50); SON.sling(); vib(6); }
    }
    if (!b.enCarril) contraMuro(b, puerta);
    if (b.x > CARRIL) { var my = MUELLE + carga * 22; choque(b, clamp(b.x, CARRIL, 350), my, 1.5, 0.2, 0, 0, 0); }
    dianas.forEach(function (d) { if (!d.abajo && contraMuro(b, d) > 0.8) tumbarDiana(d); });
    bumpers.forEach(function (u) { if (choque(b, u.x, u.y, u.r, 0.5, 0, 0, 5) > 0) { u.flash = 10; sumar(100 * mult); SON.bumper(); vib(8); } });
    contraFlipper(b, fl); contraFlipper(b, fr);
    if ((b.y - LANE_Y) * (yAnt - LANE_Y) <= 0) CARRILES.forEach(function (x, k) { if (Math.abs(b.x - x) < 15) encenderCarril(k); });
    if (b.noHole > 0) b.noHole--;
    else if (Math.hypot(b.x - agujero.x, b.y - agujero.y) < 10) {
      b.capt = 70; b.x = agujero.x; b.y = agujero.y; b.vx = b.vy = 0; sumar(2500 * mult); SON.agujero(); vib([0, 20, 40, 20]); mision('AGUJERO NEGRO');
    }
    var s = Math.hypot(b.vx, b.vy); if (s > VMAX) { b.vx *= VMAX / s; b.vy *= VMAX / s; }
  }
  function moverFlipper(f) {
    var obj = f.on ? f.up : f.rest, v = f.on ? 0.32 : 0.18, d = obj - f.ang;
    f.w = clamp(d, -v, v);
  }
  function nuevaBola() { bolaAct = { x: (CARRIL + 350) / 2, y: MUELLE - R - 2, vx: 0, vy: 0, enCarril: true, capt: 0, noHole: 0 }; }
  function lanzar() {
    var c = carga; carga = 0;
    if (!enLanzador()) return;
    var b = bolaAct; b.y = Math.min(b.y, MUELLE - R - 2); b.vy = -(8 + 12 * c); b.vx = 0; SON.lanzar(); vib(15);
  }
  function perderBola() {
    bolaAct = null; SON.perder(); vib(120); lit = [false, false, false]; mult = 1;
    if (extra > 0) { extra--; avisar('BOLA EXTRA', 100); }
    else if (bola >= 3) return finPartida();
    else { bola++; avisar('BOLA ' + bola, 100); }
    hud(); espera = 70;
  }
  function paso() {
    if (!running || paused || over) return;
    tick++;
    moverFlipper(fl); moverFlipper(fr);
    if (cargando) carga = Math.min(1, carga + 1 / 50);
    bumpers.forEach(function (u) { if (u.flash > 0) u.flash--; });
    slings.forEach(function (s) { if (s.flash > 0) s.flash--; });
    if (avisoT > 0) avisoT--;
    if (reponerDianas > 0 && --reponerDianas === 0) dianas.forEach(function (d) { d.abajo = false; });
    if (!bolaAct) { fl.ang += fl.w; fr.ang += fr.w; if (espera > 0 && --espera === 0) nuevaBola(); return; }
    var b = bolaAct;
    for (var k = 0; k < SUB; k++) subpaso(b);
    if (b.capt > 0 && --b.capt === 0) { b.vx = 6.5; b.vy = -5; b.noHole = 40; SON.expulsar(); }
    if (!isFinite(b.x) || !isFinite(b.y)) nuevaBola();
    else if (b.y > H + 15 || b.x < -20 || b.x > W + 20) perderBola();
  }
  function finPartida() {
    over = true; running = false; cargando = false; carga = 0;
    var rec = typeof saveRecord === 'function' ? saveRecord('pinball', score) : { best: Math.max(best, score), isNew: score > best };
    best = rec.best || 0;
    $('pinOverS').innerHTML = 'Puntos: <b>' + score + '</b><br>Rango: ' + RANGOS[rango] + '<br>' + (rec.isNew ? '🏆 ¡Nuevo récord!' : 'Récord: ' + best);
    $('pinOver').classList.add('show'); dibujar();
  }

  /* ---------- dibujo ---------- */
  var capa = document.createElement('canvas');
  function trazo(c, m) { c.beginPath(); c.moveTo(m.ax, m.ay); c.lineTo(m.bx, m.by); c.stroke(); }
  function prepararFondo() {
    capa.width = W * dpr; capa.height = H * dpr;
    var c = capa.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a0f2e'); g.addColorStop(0.55, '#170f4a'); g.addColorStop(1, '#05030f');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    [[90, 150, 130, 'rgba(160,60,220,.28)'], [250, 430, 120, 'rgba(30,170,200,.22)'], [180, 330, 90, 'rgba(240,90,140,.12)']].forEach(function (n) {
      var r = c.createRadialGradient(n[0], n[1], 0, n[0], n[1], n[2]); r.addColorStop(0, n[3]); r.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = r; c.fillRect(0, 0, W, H);
    });
    var s = 11; function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    for (var i = 0; i < 110; i++) { c.fillStyle = 'rgba(255,255,255,' + (0.25 + rnd() * 0.6).toFixed(2) + ')'; var z = rnd() < 0.12 ? 2 : 1; c.fillRect(rnd() * W, rnd() * H, z, z); }
    var pl = c.createRadialGradient(150, 370, 4, 166, 384, 40); pl.addColorStop(0, '#7fb6ff'); pl.addColorStop(0.7, '#2b3f9a'); pl.addColorStop(1, '#141c4d');
    c.globalAlpha = 0.55; c.fillStyle = pl; c.beginPath(); c.arc(166, 384, 36, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#9fd8ff'; c.lineWidth = 2; c.beginPath(); c.ellipse(166, 384, 60, 13, -0.25, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    c.fillStyle = '#04040c';                                   // fuera de la mesa
    c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, H); c.lineTo(350, H); c.lineTo(350, 180); c.arc(180, 180, 170, 0, Math.PI, true); c.lineTo(10, H); c.lineTo(0, H); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(CARRIL, 140, 350 - CARRIL, H - 140);   // carril del lanzador
    c.fillStyle = 'rgba(180,210,255,.18)'; c.font = 'bold 15px Courier New'; c.textAlign = 'center';
    c.fillText('MISIÓN', 166, 452); c.fillText('ESPACIAL', 166, 470);
    c.font = 'bold 9px Courier New'; c.fillStyle = 'rgba(255,220,120,.5)';
    c.save(); c.translate(336, 400); c.rotate(-Math.PI / 2); c.fillText('LANZAR ▲', 0, 3); c.restore();
    slings.forEach(function (m, lado) {                        // relleno de los slingshots
      var X = function (x) { return lado ? 332 - x : x; };
      c.fillStyle = 'rgba(255,90,170,.25)'; c.beginPath(); c.moveTo(X(32), 366); c.lineTo(X(32), 442); c.lineTo(X(80), 474); c.closePath(); c.fill();
    });
    c.lineCap = 'round'; c.lineWidth = 3; c.strokeStyle = '#4fd8ff'; c.shadowColor = '#4fd8ff'; c.shadowBlur = 8;
    muros.forEach(function (m) { if (m.t !== 's') trazo(c, m); });
    c.strokeStyle = '#7aa0ff'; c.shadowColor = '#7aa0ff'; trazo(c, puerta);
    c.shadowBlur = 0;
    c.fillStyle = '#05050f'; c.strokeStyle = '#a86bff'; c.lineWidth = 2;   // borde del agujero negro
    c.beginPath(); c.arc(agujero.x, agujero.y, 13, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  function texto(t, x, y, tam, color) { ctx.font = 'bold ' + tam + 'px Courier New'; ctx.fillStyle = color; ctx.fillText(t, x, y); }
  function dibujarFlipper(f) {
    var p = puntaFlipper(f), nx = -Math.sin(f.ang), ny = Math.cos(f.ang);
    ctx.fillStyle = '#ffcc33'; ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(f.x + nx * 9, f.y + ny * 9); ctx.lineTo(p[0] + nx * 5, p[1] + ny * 5);
    ctx.arc(p[0], p[1], 5, f.ang + Math.PI / 2, f.ang - Math.PI / 2, true); ctx.lineTo(f.x - nx * 9, f.y - ny * 9);
    ctx.arc(f.x, f.y, 9, f.ang - Math.PI / 2, f.ang + Math.PI / 2, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a3b00'; ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  function dibujar() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(capa, 0, 0, W, H);
    ctx.textAlign = 'center';
    CARRILES.forEach(function (x, i) {                         // luces de los carriles
      ctx.fillStyle = lit[i] ? '#ffd23f' : '#3a3560'; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = lit[i] ? 10 : 0;
      ctx.beginPath(); ctx.arc(x, 108, 5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur = 0;
    for (var m = 2; m <= 5; m++) texto('×' + m, 112 + (m - 2) * 36, 298, 12, mult >= m ? '#ffd23f' : 'rgba(255,255,255,.18)');
    texto(RANGOS[rango], 166, 322, 12, 'rgba(140,220,255,.75)');
    var giro = tick * 0.08;                                    // agujero negro
    ctx.strokeStyle = 'rgba(190,120,255,.8)'; ctx.lineWidth = 1.5;
    for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(agujero.x, agujero.y, 4 + k * 3, giro + k * 2, giro + k * 2 + 3.6); ctx.stroke(); }
    dianas.forEach(function (d) {
      if (d.abajo) { ctx.fillStyle = 'rgba(255,80,80,.18)'; ctx.fillRect(d.ax - 1, d.ay, 4, d.by - d.ay); return; }
      ctx.fillStyle = '#ff4d5e'; ctx.shadowColor = '#ff4d5e'; ctx.shadowBlur = 8; ctx.fillRect(d.ax - 3, d.ay, 6, d.by - d.ay); ctx.shadowBlur = 0;
    });
    bumpers.forEach(function (u) {
      var g = ctx.createRadialGradient(u.x - 5, u.y - 6, 2, u.x, u.y, u.r);
      g.addColorStop(0, u.flash ? '#ffffff' : '#9ff7ff'); g.addColorStop(0.6, u.flash ? '#7ff' : '#18a6c9'); g.addColorStop(1, '#0a3b6b');
      ctx.fillStyle = g; ctx.shadowColor = '#4ff'; ctx.shadowBlur = u.flash ? 22 : 8;
      ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#e8fdff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(u.x, u.y, u.r - 5, 0, Math.PI * 2); ctx.stroke();
    });
    slings.forEach(function (s) {
      ctx.strokeStyle = s.flash ? '#ffffff' : '#ff5aa8'; ctx.shadowColor = '#ff5aa8'; ctx.shadowBlur = s.flash ? 16 : 6; ctx.lineWidth = 4; ctx.lineCap = 'round'; trazo(ctx, s);
    });
    ctx.shadowBlur = 0;
    dibujarFlipper(fl); dibujarFlipper(fr);
    var my = MUELLE + carga * 22;                              // muelle del lanzador
    ctx.strokeStyle = '#c8c8d8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(336, my + 4);
    for (var z = 1; z <= 8; z++) ctx.lineTo(z % 2 ? 330 : 342, my + 4 + (H - my - 4) * z / 8);
    ctx.stroke();
    ctx.fillStyle = cargando ? '#ff9a3a' : '#e0e0f0'; ctx.fillRect(CARRIL + 3, my, 350 - CARRIL - 6, 5);
    if (bolaAct) {
      var b = bolaAct, gb = ctx.createRadialGradient(b.x - 2.5, b.y - 3, 1, b.x, b.y, R);
      gb.addColorStop(0, '#ffffff'); gb.addColorStop(0.5, '#c9d2e0'); gb.addColorStop(1, '#5d6678');
      ctx.globalAlpha = b.capt > 0 ? 0.35 + 0.3 * Math.sin(tick * 0.4) : 1;
      ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (running && !paused && enLanzador() && !cargando && tick % 60 < 40) {
      texto('MANTÉN ESPACIO', 166, 560, 11, '#ffd23f'); texto('o la mitad derecha', 166, 574, 10, '#ffd23f');
    }
    if (avisoT > 0) { ctx.shadowColor = '#000'; ctx.shadowBlur = 6; texto(aviso, 166, 140, 16, '#ffd23f'); ctx.shadowBlur = 0; }
    if (paused) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H); texto('PAUSA', W / 2, H / 2, 24, '#fff'); texto('toca o pulsa ESPACIO', W / 2, H / 2 + 22, 11, '#9fb3c8'); }
  }
  function prepararLienzo() {
    var d = Math.min(2, window.devicePixelRatio || 1);
    if (d === dpr && capa.listo) return;
    dpr = d; capa.listo = true; cv.width = W * dpr; cv.height = H * dpr; prepararFondo(); dibujar();
  }
  var acc = 0, last = 0;
  function bucle(t) {
    var now = t || performance.now(); acc += Math.min(now - (last || now), 100); last = now;
    var g = 0; while (acc >= 1000 / 60 && g < 6) { paso(); acc -= 1000 / 60; g++; }
    dibujar(); if (running) raf = requestAnimationFrame(bucle);
  }

  /* ---------- partida ---------- */
  function nueva() {
    score = 0; bola = 1; extra = 0; mult = 1; misiones = 0; rango = 0; lit = [false, false, false]; espera = 0; reponerDianas = 0; carga = 0;
    dianas.forEach(function (d) { d.abajo = false; }); fl.ang = fl.rest; fr.ang = fr.rest; tick = 0; avisoT = 0;
    over = false; paused = false; $('pinStart').style.display = 'none'; $('pinOver').classList.remove('show');
    nuevaBola(); hud(); ac(); actualizarControles();
    running = true; last = 0; acc = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(bucle);
  }
  function pausar(p) {
    if (!running || over) return; paused = p;
    if (p) { tecla.l = tecla.r = tecla.p = false; punteros = {}; actualizarControles(); carga = 0; } else last = 0;
    dibujar();
  }
  function mostrarRecord() { var r = $('pinRecord'); if (r) r.textContent = best ? 'Récord: ' + best : ''; }
  window.pausePin = function () { pausar(true); };
  window.initPin = function () { prepararLienzo(); mostrarRecord(); if (!running) dibujar(); };
  window.pinStartNew = function () {
    running = false; over = false; paused = false; cancelAnimationFrame(raf); bolaAct = null;
    $('pinOver').classList.remove('show'); $('pinStart').style.display = 'flex'; mostrarRecord(); dibujar();
  };
  /* solo pruebas */
  window.pinEstado = function () {
    var b = bolaAct;
    return { score: score, bola: bola, extra: extra, mult: mult, rango: rango, running: running, paused: paused, over: over, carga: carga,
      hayBola: !!b, bx: b ? b.x : null, by: b ? b.y : null, vy: b ? b.vy : null, enCarril: b ? b.enCarril : null,
      flipL: fl.ang, flipR: fr.ang, dianas: dianas.filter(function (d) { return d.abajo; }).length, carriles: lit.slice(), tick: tick };
  };
  window.pinColocar = function (x, y, vx, vy) { if (!bolaAct) nuevaBola(); var b = bolaAct; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.enCarril = x > CARRIL; b.capt = 0; };

  /* ---------- entrada ---------- */
  function actualizarControles() {
    var lados = { l: tecla.l, r: tecla.r, p: tecla.p };
    for (var id in punteros) lados[punteros[id]] = true;
    if (lados.l && !fl.on) { rotarCarriles(-1); SON.flipper(); }
    if (lados.r && !fr.on) { rotarCarriles(1); SON.flipper(); }
    fl.on = lados.l; fr.on = lados.r;
    var antes = cargando; cargando = lados.p && running && !paused;
    if (antes && !cargando) lanzar();
  }
  var zona = $('pinCanvasWrap');
  zona.style.touchAction = 'none';
  zona.addEventListener('pointerdown', function (e) {
    if (!running || over || (e.target.closest && e.target.closest('button'))) return;
    e.preventDefault();
    if (paused) { pausar(false); return; }
    var r = cv.getBoundingClientRect(), lado = e.clientX < r.left + r.width / 2 ? 'l' : 'r';
    if (lado === 'r' && enLanzador()) lado = 'p';
    punteros[e.pointerId] = lado; try { zona.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
    actualizarControles();
  });
  function soltar(e) { if (punteros[e.pointerId]) { delete punteros[e.pointerId]; actualizarControles(); } }
  zona.addEventListener('pointerup', soltar); zona.addEventListener('pointercancel', soltar);
  zona.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  var TK = window.Teclas.crear({ id: 'pin', ventana: 'winPin', titulo: 'Pinball', acciones: [
    { id: 'izq', etiqueta: 'Flipper izquierdo', def: 'KeyZ', alt: ['ArrowLeft', 'ShiftLeft'] },
    { id: 'der', etiqueta: 'Flipper derecho', def: 'KeyM', alt: ['ArrowRight', 'ShiftRight', 'Slash'] },
    { id: 'lanzar', etiqueta: 'Lanzador (mantén)', def: 'Space', alt: ['ArrowDown'] },
    { id: 'pausa', etiqueta: 'Pausa', def: 'KeyP' }, { id: 'nueva', etiqueta: 'Nueva partida (al terminar)', def: 'Enter' }] });
  window.pinTeclas = TK;
  document.addEventListener('keydown', function (e) {
    var w = $('winPin'); if (!w || w.classList.contains('hidden')) return;
    var a = TK.accion(e.code); if (!a) return;
    if (a === 'izq' || a === 'der' || a === 'lanzar') e.preventDefault();
    if (e.repeat) return;
    if (a === 'pausa') pausar(!paused);
    else if (a === 'nueva') { if (!running) nueva(); }
    else if (paused) { if (a === 'lanzar') pausar(false); }
    else { tecla[a === 'izq' ? 'l' : a === 'der' ? 'r' : 'p'] = true; actualizarControles(); }
  });
  document.addEventListener('keyup', function (e) {
    var a = TK.accion(e.code), k = a === 'izq' ? 'l' : a === 'der' ? 'r' : a === 'lanzar' ? 'p' : null;
    if (k && tecla[k]) { tecla[k] = false; actualizarControles(); }
  });
  window.addEventListener('blur', function () { tecla.l = tecla.r = tecla.p = false; punteros = {}; actualizarControles(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pausar(true); });
  window.addEventListener('resize', prepararLienzo);
  $('pin-startBtn').addEventListener('click', nueva);
  $('pin-restartBtn').addEventListener('click', nueva);
  $('pinNewGame').addEventListener('click', window.pinStartNew);
  $('pinSonido').addEventListener('click', function () {
    mudo = !mudo; try { localStorage.setItem('pinMudo', mudo ? '1' : '0'); } catch (e) { /* nada */ }
    ponerSonido(); if (!mudo) SON.carril();
  });
  ponerSonido(); prepararLienzo(); mostrarRecord();
})();

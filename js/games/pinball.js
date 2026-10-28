/* pinball.js — Juegos XP: Pinball espacial al estilo del pinball de escritorio de Windows XP (gráficos y sonidos propios, dibujados en canvas).
   Mesa vertical con barandillas rojas, 2 flippers blancos, lanzador con muelle, 4 bumpers grandes y 3 pequeños en la zona morada,
   slingshots, 3 carriles superiores (multiplicador), 3 dianas abatibles, agujero negro, rampa morada (devuelve la bola al flipper izquierdo),
   carril rojo de órbita (sube por la derecha y deja la bola en los carriles de arriba) y el círculo central de 16 luces (hiperespacio).
   Rangos de Cadete a Almirante (al llegar a Capitán, bola extra). 3 bolas; récord con saveRecord('pinball').
   Teclado: Z / ← flipper izquierdo, M / → derecho, Espacio / ↓ lanzador (mantén para cargar), P pausa, Intro nueva partida.
   Táctil: mitad izquierda o derecha de la mesa = flipper; con la bola en el lanzador, la mitad derecha carga el muelle (suelta para lanzar).
   Física de paso fijo a 60 pasos/s con 8 subpasos (la bola nunca atraviesa un muro). Pausa al minimizar o cambiar de pestaña. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('pinC'), ctx = cv.getContext('2d'), W = 360, H = 600, dpr = 1;
  var R = 7, G = 0.25, SUB = 8, VMAX = 20, CARRIL = 322, MUELLE = 578, LANE_Y = 60, CX = 167;
  var RANGOS = ['CADETE', 'ALFÉREZ', 'TENIENTE', 'CAPITÁN', 'COMANDANTE', 'ALMIRANTE'];
  var CARRILES = [153, 183, 213];
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- mesa ---------- */
  var muros = [];                                             // segmentos con grosor: {ax, ay, bx, by, r, e (rebote), k (patada), t}
  function muro(ax, ay, bx, by, o) {
    var m = { ax: ax, ay: ay, bx: bx, by: by, r: 1.5, e: 0.45, k: 0, t: 'm' };
    for (var p in o) m[p] = o[p];
    muros.push(m); return m;
  }
  function arco(cx, cy, r, a0, a1, n) {                       // arco hecho de segmentos; devuelve sus puntos
    var pts = [];
    for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    for (var j = 1; j < pts.length; j++) muro(pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1], { t: 'b' });
    return pts;
  }
  var contorno = [[12, 446], [12, 100]]                       // borde exterior (barandilla roja) de abajo a la izquierda hasta el lanzador
    .concat(arco(92, 100, 80, Math.PI, Math.PI * 1.5, 12).slice(1))
    .concat(arco(262, 108, 88, Math.PI * 1.5, Math.PI * 2, 14)).concat([[350, 612]]);
  muro(12, 446, 12, 100, { t: 'b' }); muro(92, 20, 262, 20, { t: 'b' });
  muro(350, 108, 350, 612, { t: 'b' }); muro(CARRIL, 150, CARRIL, 612, { t: 'b' });
  muro(12, 446, 104, 518, { t: 'b' }); muro(CARRIL, 446, 230, 518, { t: 'b' });        // guías hacia los flippers
  var slings = [0, 1].map(function (lado) {                    // slingshots: la cara interior da una patada
    var X = function (x) { return lado ? 2 * CX - x : x; };
    muro(X(40), 392, X(40), 446, { t: 'g' }); muro(X(40), 446, X(92), 482, { t: 'g' });
    return muro(X(92), 482, X(40), 392, { e: 0.5, k: 3, t: 's', flash: 0, lado: lado });
  });
  [138, 168, 198, 228].forEach(function (x) { muro(x, 44, x, 76, { r: 3, e: 0.4, t: 'g' }); });   // separadores de los carriles
  var puerta = { ax: CARRIL, ay: 150, bx: 350, by: 128, r: 1.5, e: 0.3, k: 0 };          // la bola no vuelve al carril del lanzador
  var bumpers = [{ x: 62, y: 96, r: 14 }, { x: 160, y: 140, r: 16 }, { x: 214, y: 134, r: 16 }, { x: 188, y: 186, r: 16 },
    { x: 40, y: 300, r: 10, p: 1 }, { x: 76, y: 316, r: 10, p: 1 }, { x: 46, y: 346, r: 10, p: 1 }].map(function (b) { b.flash = 0; return b; });
  var dianas = [0, 1, 2].map(function (i) { return { ax: 316, ay: 296 + i * 24, bx: 316, by: 314 + i * 24, r: 3, e: 0.4, k: 0, abajo: false }; });
  var agujero = { x: 132, y: 204 };
  /* rampas: si la bola entra por la boca subiendo, la llevan por su recorrido y la sueltan al final */
  var rampas = [
    { id: 'rampa', x: 120, y: 256, r: 13, pts: 1500, color: '#8a5cd6', aviso: 'RAMPA',
      ruta: [[120, 256], [104, 212], [86, 172], [62, 146], [36, 156], [22, 196], [22, 262], [24, 330], [26, 382]], sal: [0, 2] },
    { id: 'orbita', x: 300, y: 264, r: 14, pts: 2000, color: '#c8262a', aviso: 'ÓRBITA',
      ruta: [[300, 264], [306, 196], [300, 126], [282, 76], [250, 40], [214, 28], [183, 32]], sal: [-0.5, 2] }
  ];
  rampas.forEach(function (r) {
    r.largo = 0; r.tramos = [];
    for (var i = 1; i < r.ruta.length; i++) { var l = Math.hypot(r.ruta[i][0] - r.ruta[i - 1][0], r.ruta[i][1] - r.ruta[i - 1][1]); r.tramos.push(l); r.largo += l; }
  });
  function puntoRampa(r, d) {
    for (var i = 0; i < r.tramos.length; i++) {
      if (d <= r.tramos[i]) { var t = d / r.tramos[i], a = r.ruta[i], b = r.ruta[i + 1]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
      d -= r.tramos[i];
    }
    return r.ruta[r.ruta.length - 1];
  }
  function flipper(x, rest, up) { return { x: x, y: 532, ang: rest, rest: rest, up: up, w: 0, on: false, L: 50 }; }
  var fl = flipper(108, 0.5, -0.45), fr = flipper(2 * CX - 108, Math.PI - 0.5, Math.PI + 0.45);
  var LUCES = 16;

  /* ---------- estado ---------- */
  var score = 0, bola = 1, extra = 0, mult = 1, misiones = 0, rango = 0, best = 0, luces = 0;
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
    rampa: function () { tono(300, 1200, 0.45, 'triangle', 0.07); },
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
  function encenderLuz(n) {                                    // círculo central: 16 luces = hiperespacio
    luces += n;
    if (luces >= LUCES) { luces = 0; sumar(5000 * mult); SON.premio(); mision('HIPERESPACIO'); }
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
    d.abajo = true; sumar(750 * mult); SON.diana(); vib(10); encenderLuz(1);
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
  function enLanzador() { return !!bolaAct && bolaAct.enCarril && !bolaAct.rampa && bolaAct.y > MUELLE - 60; }
  function subpaso(b) {
    fl.ang += fl.w / SUB; fr.ang += fr.w / SUB;
    if (b.capt > 0 || b.rampa) return;
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
    bumpers.forEach(function (u) {
      if (choque(b, u.x, u.y, u.r, 0.5, 0, 0, u.p ? 4 : 5) > 0) { u.flash = 10; sumar((u.p ? 150 : 100) * mult); SON.bumper(); vib(8); encenderLuz(u.p ? 0 : 1); }
    });
    contraFlipper(b, fl); contraFlipper(b, fr);
    if ((b.y - LANE_Y) * (yAnt - LANE_Y) <= 0) CARRILES.forEach(function (x, k) { if (Math.abs(b.x - x) < 14) encenderCarril(k); });
    if (b.noHole > 0) b.noHole--;
    else if (Math.hypot(b.x - agujero.x, b.y - agujero.y) < 10) {
      b.capt = 70; b.x = agujero.x; b.y = agujero.y; b.vx = b.vy = 0; sumar(2500 * mult); SON.agujero(); vib([0, 20, 40, 20]); encenderLuz(3); mision('AGUJERO NEGRO');
      return;
    }
    if (b.noRampa > 0) b.noRampa--;
    else rampas.forEach(function (r) {
      if (!b.rampa && b.vy < -2.5 && Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
        b.rampa = r; b.dist = 0; b.velRampa = Math.max(5, Math.min(9, Math.hypot(b.vx, b.vy) * 0.6));
        sumar(r.pts * mult); SON.rampa(); vib(15); encenderLuz(2); avisar(r.aviso, 60);
      }
    });
    var s = Math.hypot(b.vx, b.vy); if (s > VMAX) { b.vx *= VMAX / s; b.vy *= VMAX / s; }
  }
  function moverFlipper(f) {
    var obj = f.on ? f.up : f.rest, v = f.on ? 0.32 : 0.18, d = obj - f.ang;
    f.w = clamp(d, -v, v);
  }
  function nuevaBola() { bolaAct = { x: (CARRIL + 350) / 2, y: MUELLE - R - 2, vx: 0, vy: 0, enCarril: true, capt: 0, noHole: 0, noRampa: 0, rampa: null }; }
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
    if (b.rampa) {                                             // la bola recorre la rampa
      b.dist += b.velRampa; var p = puntoRampa(b.rampa, b.dist); b.x = p[0]; b.y = p[1];
      if (b.dist >= b.rampa.largo) { b.vx = b.rampa.sal[0]; b.vy = b.rampa.sal[1]; b.rampa = null; b.noRampa = 40; }
    }
    if (b.capt > 0 && --b.capt === 0) { b.vx = 4; b.vy = 5.5; b.noHole = 40; SON.expulsar(); }
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
  function poli(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); }
  function pintarRampa(c, r, ancho) {                          // banda elevada con rayas
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = ancho + 6; poli(c, r.ruta.map(function (p) { return [p[0] + 3, p[1] + 4]; })); c.stroke();
    c.strokeStyle = r.color; c.lineWidth = ancho + 4; poli(c, r.ruta); c.stroke();
    c.strokeStyle = r.id === 'rampa' ? '#c9b2ff' : '#7a1012'; c.lineWidth = ancho - 4; poli(c, r.ruta); c.stroke();
    c.setLineDash([3, 6]); c.strokeStyle = r.id === 'rampa' ? '#6d45b8' : '#e8c070'; c.lineWidth = ancho - 8; poli(c, r.ruta); c.stroke(); c.setLineDash([]);
  }
  function flecha(c, x, y, ang, color) {
    c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = color;
    c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-5, 5); c.closePath(); c.fill(); c.restore();
  }
  function prepararFondo() {
    capa.width = W * dpr; capa.height = H * dpr;
    var c = capa.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#2a0f3c'; c.fillRect(0, 0, W, H);           // fuera de la mesa
    var mesa = contorno.concat([[CARRIL, 612], [CARRIL, 446], [230, 518], [234, 612], [100, 612], [104, 518]]);
    var g = c.createRadialGradient(CX, 330, 30, CX, 330, 360); g.addColorStop(0, '#23307a'); g.addColorStop(0.6, '#161d55'); g.addColorStop(1, '#0b0f33');
    c.save(); poli(c, mesa); c.closePath(); c.fillStyle = g; c.fill(); c.clip();
    var s = 7; function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    c.strokeStyle = 'rgba(110,150,240,.28)'; c.lineCap = 'round';   // vetas azules (grietas de energía)
    for (var v = 0; v < 26; v++) {
      var x = rnd() * W, y = 60 + rnd() * 500, a = rnd() * Math.PI * 2; c.lineWidth = 1 + rnd() * 2.2; c.beginPath(); c.moveTo(x, y);
      for (var k = 0; k < 7; k++) { a += (rnd() - 0.5) * 1.4; x += Math.cos(a) * 16; y += Math.sin(a) * 16; c.lineTo(x, y); }
      c.stroke();
    }
    var pc = c.createRadialGradient(CX, 380, 4, CX, 380, 58);  // círculo central (pozo de gravedad)
    pc.addColorStop(0, '#4fd2e0'); pc.addColorStop(0.45, '#1d6f9c'); pc.addColorStop(1, '#0c1f55');
    c.fillStyle = 'rgba(40,60,140,.55)'; c.beginPath(); c.arc(CX, 380, 66, 0, Math.PI * 2); c.fill();
    c.fillStyle = pc; c.beginPath(); c.arc(CX, 380, 46, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5e3aa8';                                    // zona morada de la izquierda
    c.beginPath(); c.moveTo(12, 268); c.quadraticCurveTo(70, 252, 104, 286); c.quadraticCurveTo(112, 340, 84, 372); c.quadraticCurveTo(46, 388, 12, 380); c.closePath(); c.fill();
    c.strokeStyle = '#9b7be0'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#4b2a8c';                                    // estrella morada entre los flippers
    for (var p = 0; p < 7; p++) {
      var ang = Math.PI * (1.15 + 0.7 * p / 6), lx = CX + Math.cos(ang) * 120, ly = 612 + Math.sin(ang) * 120;
      c.beginPath(); c.moveTo(CX - 14 + p * 4, 612); c.lineTo(lx, ly); c.lineTo(CX - 6 + p * 4, 612); c.closePath(); c.fill();
    }
    var gl = c.createLinearGradient(CARRIL, 0, 350, 0);         // tubo del lanzador
    gl.addColorStop(0, '#4a2a12'); gl.addColorStop(0.5, '#8a5a2c'); gl.addColorStop(1, '#3a200c');
    c.fillStyle = gl; c.fillRect(CARRIL, 150, 350 - CARRIL, H - 150);
    c.fillStyle = '#f2d23a'; for (var yb = 210; yb < 560; yb += 90) c.fillRect(CARRIL + 2, yb, 350 - CARRIL - 4, 7);
    c.restore();
    c.fillStyle = '#9b1b1f';                                    // esquinas rojas de abajo
    poli(c, [[12, 446], [104, 518], [100, 612], [12, 612]]); c.closePath(); c.fill();
    poli(c, [[CARRIL, 446], [230, 518], [234, 612], [CARRIL, 612]]); c.closePath(); c.fill();
    c.fillStyle = '#c2332f'; poli(c, [[12, 470], [80, 532], [80, 612], [12, 612]]); c.closePath(); c.fill();
    poli(c, [[CARRIL, 470], [254, 532], [254, 612], [CARRIL, 612]]); c.closePath(); c.fill();
    slings.forEach(function (m, lado) {                        // slingshots: triángulo rojo con luz azul
      var X = function (x) { return lado ? 2 * CX - x : x; };
      c.fillStyle = '#2b1030'; poli(c, [[X(40), 392], [X(40), 446], [X(92), 482]]); c.closePath(); c.fill();
      c.strokeStyle = '#c8262a'; c.lineWidth = 4; c.lineJoin = 'round'; c.stroke();
      var lz = c.createRadialGradient(X(56), 440, 1, X(56), 440, 12); lz.addColorStop(0, '#e8f6ff'); lz.addColorStop(1, 'rgba(90,160,255,0)');
      c.fillStyle = lz; c.beginPath(); c.arc(X(56), 440, 12, 0, Math.PI * 2); c.fill();
    });
    c.lineCap = 'round'; c.lineJoin = 'round';                 // barandillas
    c.strokeStyle = '#5a0a0c'; c.lineWidth = 9; poli(c, contorno); c.stroke();
    c.strokeStyle = '#c8262a'; c.lineWidth = 6; poli(c, contorno); c.stroke();
    c.strokeStyle = '#ff7b5c'; c.lineWidth = 1.5; poli(c, contorno); c.stroke();
    muros.forEach(function (m) {
      if (m.t === 'b') { c.strokeStyle = '#c8262a'; c.lineWidth = 5; trazo(c, m); }
      else if (m.t === 'g') { c.strokeStyle = '#b8b8c8'; c.lineWidth = 3; trazo(c, m); }
    });
    c.strokeStyle = '#ff7b5c'; c.lineWidth = 1.2; muros.forEach(function (m) { if (m.t === 'b') trazo(c, m); });
    c.strokeStyle = '#d0d0dc'; c.lineWidth = 3; trazo(c, puerta);
    c.fillStyle = '#f2d23a';                                    // luces amarillas decorativas
    [[96, 250], [110, 236], [278, 300], [270, 316], [262, 332], [60, 420], [274, 420], [138, 92], [228, 92]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 3, 0, Math.PI * 2); c.fill(); });
    flecha(c, 136, 274, -2.0, '#7fd0ff'); flecha(c, 286, 290, -1.6, '#7fd0ff'); flecha(c, 150, 228, -2.4, '#7fd0ff');
    pintarRampa(c, rampas[1], 14);
    pintarRampa(c, rampas[0], 16);
    c.fillStyle = '#05050f'; c.strokeStyle = '#7a7a90'; c.lineWidth = 3;   // embudo del agujero negro
    c.beginPath(); c.arc(agujero.x, agujero.y, 13, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  function texto(t, x, y, tam, color) { ctx.font = 'bold ' + tam + 'px Courier New'; ctx.fillStyle = color; ctx.fillText(t, x, y); }
  function dibujarBumper(u) {
    var r = u.r;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(u.x + 2, u.y + 3, r + 1, 0, Math.PI * 2); ctx.fill();
    var gb = ctx.createLinearGradient(u.x - r, u.y, u.x + r, u.y); gb.addColorStop(0, '#9a9aa8'); gb.addColorStop(0.5, '#ffffff'); gb.addColorStop(1, '#8a8a98');
    ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = u.flash ? '#ff9a3a' : '#c8262a'; ctx.beginPath();          // estrella roja
    for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8 + tick * 0.01, rr = i % 2 ? r * 0.55 : r * 0.82; ctx[i ? 'lineTo' : 'moveTo'](u.x + Math.cos(a) * rr, u.y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
    var gc = ctx.createRadialGradient(u.x - r * 0.15, u.y - r * 0.2, 1, u.x, u.y, r * 0.48);
    gc.addColorStop(0, u.flash ? '#ffffff' : '#9fc8ff'); gc.addColorStop(1, u.flash ? '#7fd8ff' : '#1a3cc8');
    ctx.fillStyle = gc; ctx.shadowColor = '#6fb8ff'; ctx.shadowBlur = u.flash ? 18 : 0;
    ctx.beginPath(); ctx.arc(u.x, u.y, r * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  function dibujarFlipper(f) {
    var p = puntaFlipper(f), nx = -Math.sin(f.ang), ny = Math.cos(f.ang);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(f.x + 2, f.y + 4, 9, 0, Math.PI * 2); ctx.arc(p[0] + 2, p[1] + 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4f4fa'; ctx.strokeStyle = '#d0183a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(f.x + nx * 9, f.y + ny * 9); ctx.lineTo(p[0] + nx * 5, p[1] + ny * 5);
    ctx.arc(p[0], p[1], 5, f.ang + Math.PI / 2, f.ang - Math.PI / 2, true); ctx.lineTo(f.x - nx * 9, f.y - ny * 9);
    ctx.arc(f.x, f.y, 9, f.ang - Math.PI / 2, f.ang + Math.PI / 2, true); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.fillStyle = '#7a1020'; ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  function luz(x, y, r, on, color, apagado) {
    ctx.fillStyle = on ? color : apagado; ctx.shadowColor = color; ctx.shadowBlur = on ? 8 : 0;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  function dibujarBola(b) {
    var gb = ctx.createRadialGradient(b.x - 2.5, b.y - 3, 1, b.x, b.y, R);
    gb.addColorStop(0, '#ffffff'); gb.addColorStop(0.5, '#c9d2e0'); gb.addColorStop(1, '#4d5668');
    ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, Math.PI * 2); ctx.fill();
  }
  function dibujar() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(capa, 0, 0, W, H);
    ctx.textAlign = 'center';
    for (var i = 0; i < LUCES; i++) {                         // anillo de 16 luces azules
      var a = -Math.PI / 2 + i * Math.PI * 2 / LUCES; luz(CX + Math.cos(a) * 56, 380 + Math.sin(a) * 56, 4.5, i < luces, '#8fd0ff', '#24406e');
    }
    for (var m = 1; m <= 5; m++) {                             // anillo interior amarillo: multiplicador
      var am = -Math.PI / 2 + (m - 1) * Math.PI * 2 / 5; luz(CX + Math.cos(am) * 32, 380 + Math.sin(am) * 32, 4, mult >= m, '#ffe14a', '#5a5420');
    }
    luz(CX, 380, 4, tick % 40 < 20, '#ffe14a', '#5a5420');
    texto(RANGOS[rango], CX, 448, 10, 'rgba(200,230,255,.8)');
    CARRILES.forEach(function (x, k) { luz(x, 86, 4.5, lit[k], '#ffe14a', '#4a4630'); });
    var giro = tick * 0.08;                                    // agujero negro
    ctx.strokeStyle = 'rgba(190,120,255,.85)'; ctx.lineWidth = 1.5;
    for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(agujero.x, agujero.y, 3 + k * 3, giro + k * 2, giro + k * 2 + 3.6); ctx.stroke(); }
    dianas.forEach(function (d) {
      if (d.abajo) { ctx.fillStyle = 'rgba(255,210,60,.25)'; ctx.fillRect(d.ax - 1, d.ay, 4, d.by - d.ay); return; }
      ctx.fillStyle = '#f2d23a'; ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 1; ctx.fillRect(d.ax - 4, d.ay, 7, d.by - d.ay); ctx.strokeRect(d.ax - 4, d.ay, 7, d.by - d.ay);
    });
    bumpers.forEach(dibujarBumper);
    slings.forEach(function (s) {
      ctx.strokeStyle = s.flash ? '#ffffff' : '#f0e6e6'; ctx.shadowColor = '#fff'; ctx.shadowBlur = s.flash ? 14 : 0; ctx.lineWidth = 3; ctx.lineCap = 'round'; trazo(ctx, s);
    });
    ctx.shadowBlur = 0;
    dibujarFlipper(fl); dibujarFlipper(fr);
    var my = MUELLE + carga * 22;                              // muelle del lanzador
    ctx.strokeStyle = '#d8d8e4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(336, my + 4);
    for (var z = 1; z <= 8; z++) ctx.lineTo(z % 2 ? 330 : 342, my + 4 + (H - my - 4) * z / 8);
    ctx.stroke();
    ctx.fillStyle = cargando ? '#ff9a3a' : '#e0e0f0'; ctx.fillRect(CARRIL + 3, my, 350 - CARRIL - 6, 5);
    if (bolaAct) {
      var b = bolaAct;
      if (b.capt > 0) { ctx.globalAlpha = 0.35 + 0.3 * Math.sin(tick * 0.4); dibujarBola(b); ctx.globalAlpha = 1; }
      else if (b.rampa) { ctx.save(); ctx.translate(b.x, b.y); ctx.scale(1.15, 1.15); ctx.translate(-b.x, -b.y); dibujarBola(b); ctx.restore(); }
      else dibujarBola(b);
    }
    if (running && !paused && enLanzador() && !cargando && tick % 60 < 40) {
      texto('MANTÉN ESPACIO', CX, 568, 11, '#ffe14a'); texto('o la mitad derecha', CX, 582, 10, '#ffe14a');
    }
    if (avisoT > 0) { ctx.shadowColor = '#000'; ctx.shadowBlur = 6; texto(aviso, CX, 290, 16, '#ffe14a'); ctx.shadowBlur = 0; }
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
    score = 0; bola = 1; extra = 0; mult = 1; misiones = 0; rango = 0; luces = 0; lit = [false, false, false]; espera = 0; reponerDianas = 0; carga = 0;
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
      hayBola: !!b, bx: b ? b.x : null, by: b ? b.y : null, vy: b ? b.vy : null, enCarril: b ? b.enCarril : null, rampa: b && b.rampa ? b.rampa.id : null,
      flipL: fl.ang, flipR: fr.ang, dianas: dianas.filter(function (d) { return d.abajo; }).length, carriles: lit.slice(), luces: luces, tick: tick };
  };
  window.pinColocar = function (x, y, vx, vy) { if (!bolaAct) nuevaBola(); var b = bolaAct; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.enCarril = x > CARRIL; b.capt = 0; b.rampa = null; b.noRampa = 0; };

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

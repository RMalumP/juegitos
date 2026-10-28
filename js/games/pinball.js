/* pinball.js — Juegos XP: Pinball espacial al estilo del pinball de escritorio de Windows XP (gráficos y sonidos propios, dibujados en canvas).
   Mesa vertical con barandillas rojas, 2 flippers blancos, lanzador con muelle, 4 bumpers grandes y 3 pequeños en la zona morada,
   slingshots, 3 carriles superiores (multiplicador), 3 dianas abatibles, agujero negro, rampa morada (devuelve la bola al flipper izquierdo),
   carril rojo de órbita (sube por la derecha y deja la bola en los carriles de arriba) y el círculo central de 24 luces (hiperespacio), órbita gris, objetivo verde, asteroides, calles de entrada y salida con salva bolas y misiones.
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
  function arco(cx, cy, r, a0, a1, n, t) {                    // arco hecho de segmentos; devuelve sus puntos
    var pts = [];
    for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    for (var j = 1; j < pts.length; j++) muro(pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1], { t: t || 'b' });
    return pts;
  }
  var contorno = [[12, 612], [12, 100]]                       // borde exterior (barandilla roja) de abajo a la izquierda hasta el lanzador
    .concat(arco(92, 100, 80, Math.PI, Math.PI * 1.5, 12).slice(1))
    .concat(arco(262, 108, 88, Math.PI * 1.5, Math.PI * 2, 14)).concat([[350, 612]]);
  muro(12, 612, 12, 100, { t: 'b' }); muro(92, 20, 262, 20, { t: 'b' });
  var orbitaGris = [[34, 168]].concat(arco(92, 100, 58, Math.PI, Math.PI * 1.5, 10, 'g'));   // órbita gris de arriba a la izquierda
  muro(34, 168, 34, 100, { t: 'g' }); muro(12, 196, 36, 222, { t: 'b' });                    // y desviador a su salida
  muro(350, 108, 350, 612, { t: 'b' }); muro(CARRIL, 150, CARRIL, 612, { t: 'b' });
  var slings = [0, 1].map(function (lado) {                    // calles de salida (fuera) y de entrada (hacia el flipper) y slingshots
    var X = function (x) { return lado ? 2 * CX - x : x; };
    muro(X(33), 440, X(33), 486, { t: 'g', r: 2 }); muro(X(33), 486, X(104), 518, { t: 'b' });
    muro(X(57), 400, X(57), 452, { t: 'g' }); muro(X(57), 452, X(100), 488, { t: 'g' });
    return muro(X(100), 488, X(57), 400, { e: 0.5, k: 3, t: 's', flash: 0, lado: lado });
  });
  var CALLE_Y = 466, calles = [0, 0, 0, 0];                    // luces de las calles: salida izq., entrada izq., entrada der., salida der.
  [138, 168, 198, 228].forEach(function (x) { muro(x, 44, x, 76, { r: 3, e: 0.4, t: 'g' }); });   // separadores de los carriles
  var puerta = { ax: CARRIL, ay: 150, bx: 350, by: 128, r: 1.5, e: 0.3, k: 0 };          // la bola no vuelve al carril del lanzador
  var bumpers = [{ x: 80, y: 120, r: 13 }, { x: 160, y: 140, r: 16 }, { x: 214, y: 134, r: 16 }, { x: 188, y: 186, r: 16 },
    { x: 46, y: 294, r: 10, p: 1 }, { x: 92, y: 306, r: 10, p: 1 }, { x: 66, y: 338, r: 10, p: 1 }].map(function (b) { b.flash = 0; return b; });
  /* plataforma morada elevada: solo se entra por la rampa (la bola pasa a nivel 1) y se sale por el agujero del mango */
  var PLAT = [[12, 236], [60, 246], [100, 262], [122, 286], [124, 316], [110, 344], [88, 366], [70, 388], [60, 410], [44, 410], [36, 396], [12, 380]];
  PLAT.forEach(function (p, i) {
    var q = PLAT[(i + 1) % PLAT.length];
    muro(p[0], p[1], q[0], q[1], { t: 'p', n: i === 8 ? 0 : i === 11 ? 1 : 2 });   // 8: boca del agujero (solo cierra por fuera); 11: lado de la pared
  });
  var salidaPlat = { x: 52, y: 401 }, callesPlat = [26, 44, 62], litPlat = [false, false, false];
  var dianas = [0, 1, 2].map(function (i) { return { ax: 316, ay: 296 + i * 24, bx: 316, by: 314 + i * 24, r: 3, e: 0.4, k: 0, abajo: false }; });
  var agujero = { x: 132, y: 204 };
  var verde = { x: 120, y: 102, r: 7, flash: 0 };             // objetivo verde redondo
  /* rampas: si la bola entra por la boca subiendo, la llevan por su recorrido y la sueltan al final */
  var rampas = [
    { id: 'rampa', x: 130, y: 262, r: 13, pts: 1500, color: '#8a5cd6', aviso: 'RAMPA', nivel: 1,
      ruta: [[130, 262], [118, 222], [102, 192], [78, 178], [56, 188], [40, 214], [34, 252]], sal: [2.2, 1] },
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
  var LUCES = 24;
  var rocas = [{ x: 252, y: 204, r: 8 }, { x: 272, y: 228, r: 7 }, { x: 246, y: 236, r: 6 }];   // asteroides

  /* ---------- estado ---------- */
  var salva = 0;                                               // salva bolas (redespliegue) los primeros 8 s de cada bola
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
  /* misiones: solo cuenta la misión actual; cada 2 cumplidas se sube de rango */
  var MISIONES = [{ id: 'carriles', t: 'Enciende los 3 carriles de arriba' }, { id: 'rampa', t: 'Sube por la rampa morada' },
    { id: 'dianas', t: 'Tumba las 3 dianas amarillas' }, { id: 'orbita', t: 'Recorre la órbita roja' }, { id: 'verde', t: 'Golpea el objetivo verde' },
    { id: 'agujero', t: 'Entra en el agujero negro' }, { id: 'hiper', t: 'Enciende las 24 luces del hiperespacio' }];
  var actual = 0, textoPanel = '';
  function panel() {
    var t = !running && !over ? 'Pulsa iniciar' : over ? 'Fin de la partida' : !bolaAct || enLanzador() ? 'Esperando despliegue' : 'Misión: ' + MISIONES[actual].t;
    if (t !== textoPanel) { textoPanel = t; $('pinMision').textContent = t; }
  }
  function mision(texto, id) {
    if (MISIONES[actual].id !== id) { avisar(texto, 60); return; }
    misiones++; actual = (actual + 1) % MISIONES.length; sumar(5000 * (rango + 1)); panel();
    var nuevo = Math.min(RANGOS.length - 1, Math.floor(misiones / 2));
    if (nuevo > rango) {
      rango = nuevo; sumar(10000 * rango); SON.premio(); vib([0, 40, 40, 40]);
      if (rango === 3) { extra++; hud(); avisar('¡' + RANGOS[rango] + '! BOLA EXTRA', 140); } else avisar('¡ASCENSO! ' + RANGOS[rango], 120);
    } else { SON.premio(); avisar('MISIÓN CUMPLIDA', 100); }
  }
  function encenderLuz(n) {                                    // círculo central: 24 luces = hiperespacio
    luces += n;
    if (luces >= LUCES) { luces = 0; sumar(5000 * mult); SON.premio(); mision('HIPERESPACIO', 'hiper'); }
  }
  function encenderCarril(i) {
    if (lit[i]) { sumar(100); return; }
    lit[i] = true; sumar(500 * mult); SON.carril();
    if (lit[0] && lit[1] && lit[2]) {
      lit = [false, false, false]; sumar(2000 * mult); SON.premio();
      if (mult < 5) mult++; hud(); mision('MULTIPLICADOR ×' + mult, 'carriles');
    }
  }
  function rotarCarriles(dir) { lit = dir < 0 ? [lit[1], lit[2], lit[0]] : [lit[2], lit[0], lit[1]]; }
  function tumbarDiana(d) {
    d.abajo = true; sumar(750 * mult); SON.diana(); vib(10); encenderLuz(1);
    if (dianas.every(function (x) { return x.abajo; })) { sumar(5000 * mult); SON.premio(); reponerDianas = 60; mision('DIANAS COMPLETAS', 'dianas'); }
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
    if (b.enCarril && b.x < CARRIL - 4) { b.enCarril = false; if (!b.desplegada) { b.desplegada = true; salva = 480; } }
    if (b.nivel === 1) return pasoPlataforma(b, yAnt);
    for (var i = 0; i < muros.length; i++) {
      var m = muros[i]; if (m.n === 1) continue;
      var imp = contraMuro(b, m);
      if (imp > 2.5 && m.t === 's') { m.flash = 8; sumar(50); SON.sling(); vib(6); }
    }
    if (!b.enCarril) contraMuro(b, puerta);
    if (b.x > CARRIL) { var my = MUELLE + carga * 22; choque(b, clamp(b.x, CARRIL, 350), my, 1.5, 0.2, 0, 0, 0); }
    dianas.forEach(function (d) { if (!d.abajo && contraMuro(b, d) > 0.8) tumbarDiana(d); });
    bumpers.forEach(function (u) {
      if (u.p) return;
      if (choque(b, u.x, u.y, u.r, 0.5, 0, 0, u.p ? 4 : 5) > 0) { u.flash = 10; sumar((u.p ? 150 : 100) * mult); SON.bumper(); vib(8); encenderLuz(u.p ? 0 : 1); }
    });
    if (choque(b, verde.x, verde.y, verde.r, 0.6, 0, 0, 0) > 1) { verde.flash = 20; sumar(1000 * mult); SON.carril(); vib(10); encenderLuz(1); mision('OBJETIVO VERDE', 'verde'); }
    rocas.forEach(function (o) { if (choque(b, o.x, o.y, o.r, 0.5, 0, 0, 0) > 1.5) { sumar(200 * mult); SON.diana(); } });
    contraFlipper(b, fl); contraFlipper(b, fr);
    if ((b.y - CALLE_Y) * (yAnt - CALLE_Y) <= 0 && b.vy > 0 && !b.enCarril) {
      var k2 = b.x < 33 ? 0 : b.x < 57 ? 1 : b.x > 2 * CX - 33 ? 3 : b.x > 2 * CX - 57 ? 2 : -1;
      if (k2 >= 0) { calles[k2] = 30; sumar((k2 === 0 || k2 === 3 ? 500 : 300) * mult); SON.carril(); encenderLuz(1); }
    }
    if ((b.y - LANE_Y) * (yAnt - LANE_Y) <= 0) CARRILES.forEach(function (x, k) { if (Math.abs(b.x - x) < 14) encenderCarril(k); });
    if (b.noHole > 0) b.noHole--;
    else if (Math.hypot(b.x - agujero.x, b.y - agujero.y) < 10) {
      b.capt = 70; b.x = agujero.x; b.y = agujero.y; b.vx = b.vy = 0; sumar(2500 * mult); SON.agujero(); vib([0, 20, 40, 20]); encenderLuz(3); mision('AGUJERO NEGRO', 'agujero');
      return;
    }
    if (b.noRampa > 0) b.noRampa--;
    else rampas.forEach(function (r) {
      if (!b.rampa && b.vy < -2.5 && Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
        b.rampa = r; b.dist = 0; b.velRampa = Math.max(5, Math.min(9, Math.hypot(b.vx, b.vy) * 0.6));
        sumar(r.pts * mult); SON.rampa(); vib(15); encenderLuz(2); mision(r.aviso, r.id);
      }
    });
    var s = Math.hypot(b.vx, b.vy); if (s > VMAX) { b.vx *= VMAX / s; b.vy *= VMAX / s; }
  }
  function pasoPlataforma(b, yAnt) {                          // la bola sobre la plataforma morada
    muros.forEach(function (m) { if (m.n) contraMuro(b, m); });
    bumpers.forEach(function (u) {
      if (u.p && choque(b, u.x, u.y, u.r, 0.5, 0, 0, 4) > 0) { u.flash = 10; sumar(150 * mult); SON.bumper(); vib(8); }
    });
    if ((b.y - 266) * (yAnt - 266) <= 0) callesPlat.forEach(function (x, k) {
      if (Math.abs(b.x - x) < 8 && !litPlat[k]) {
        litPlat[k] = true; sumar(500 * mult); SON.carril();
        if (litPlat.every(Boolean)) { litPlat = [false, false, false]; sumar(3000 * mult); encenderLuz(3); avisar('PLATAFORMA', 70); }
      }
    });
    if (Math.hypot(b.x - salidaPlat.x, b.y - salidaPlat.y) < 8) {   // agujero del mango: vuelve a la mesa por la calle de entrada izquierda
      b.nivel = 0; b.x = 45; b.y = 426; b.vx = 0; b.vy = 2.5; b.noRampa = 30; SON.expulsar(); vib(15);
    }
    var s = Math.hypot(b.vx, b.vy); if (s > VMAX) { b.vx *= VMAX / s; b.vy *= VMAX / s; }
  }
  function moverFlipper(f) {
    var obj = f.on ? f.up : f.rest, v = f.on ? 0.32 : 0.18, d = obj - f.ang;
    f.w = clamp(d, -v, v);
  }
  function nuevaBola() { bolaAct = { x: (CARRIL + 350) / 2, y: MUELLE - R - 2, vx: 0, vy: 0, enCarril: true, capt: 0, noHole: 0, noRampa: 0, rampa: null, nivel: 0 }; }
  function lanzar() {
    var c = carga; carga = 0;
    if (!enLanzador()) return;
    var b = bolaAct; b.y = Math.min(b.y, MUELLE - R - 2); b.vy = -(8 + 12 * c); b.vx = 0; SON.lanzar(); vib(15);
  }
  function perderBola() {
    if (salva > 0) { salva = 0; bolaAct = null; espera = 40; avisar('REDESPLIEGUE', 100); SON.expulsar(); vib(40); return; }
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
    if (verde.flash > 0) verde.flash--;
    if (avisoT > 0) avisoT--;
    if (tick % 10 === 0) panel();
    if (salva > 0 && bolaAct && !bolaAct.enCarril) salva--;
    for (var q = 0; q < 4; q++) if (calles[q] > 0) calles[q]--;
    if (reponerDianas > 0 && --reponerDianas === 0) dianas.forEach(function (d) { d.abajo = false; });
    if (!bolaAct) { fl.ang += fl.w; fr.ang += fr.w; if (espera > 0 && --espera === 0) nuevaBola(); return; }
    var b = bolaAct;
    for (var k = 0; k < SUB; k++) subpaso(b);
    if (b.rampa) {                                             // la bola recorre la rampa
      b.dist += b.velRampa; var p = puntoRampa(b.rampa, b.dist); b.x = p[0]; b.y = p[1];
      if (b.dist >= b.rampa.largo) { b.vx = b.rampa.sal[0]; b.vy = b.rampa.sal[1]; b.nivel = b.rampa.nivel || 0; b.rampa = null; b.noRampa = 40; }
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
    $('pinOver').classList.add('show'); panel(); dibujar();
  }

  /* ---------- dibujo ---------- */
  var capa = document.createElement('canvas'), capaR = document.createElement('canvas');
  function trazo(c, m) { c.beginPath(); c.moveTo(m.ax, m.ay); c.lineTo(m.bx, m.by); c.stroke(); }
  function poli(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); }
  function cohete(c, x, y, ang) {                               // cohete rosa de la zona de la rampa
    c.save(); c.translate(x, y); c.rotate(ang);
    c.fillStyle = '#e04aa8'; c.beginPath(); c.moveTo(22, 0); c.quadraticCurveTo(10, -9, -14, -7); c.lineTo(-14, 7); c.quadraticCurveTo(10, 9, 22, 0); c.fill();
    c.fillStyle = '#ff9ad8'; c.beginPath(); c.moveTo(-6, -7); c.lineTo(-18, -15); c.lineTo(-12, -6); c.fill(); c.beginPath(); c.moveTo(-6, 7); c.lineTo(-18, 15); c.lineTo(-12, 6); c.fill();
    c.fillStyle = '#7fd0ff'; c.beginPath(); c.arc(8, 0, 3.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(-14, -4); c.lineTo(-24, 0); c.lineTo(-14, 4); c.fill();
    c.restore();
  }
  /* Rampas elevadas: el recorrido se suaviza (Catmull-Rom) y se dibuja como una pieza ancha con sombra, soportes, paredes y piso con volumen */
  function suavizar(pts) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      var n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 3));
      for (var k = 0; k < n; k++) {
        var t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function cinta(c, pts, anchoDe, f, dx, dy) {                  // polígono de la cinta a una fracción f del ancho
    var izq = [], der = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      var nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, w = anchoDe(i / (pts.length - 1)) * f / 2, o = dx ? dx(i / (pts.length - 1)) : 0;
      izq.push([pts[i][0] + nx * w + o, pts[i][1] + ny * w + (dy ? dy(i / (pts.length - 1)) : 0)]);
      der.push([pts[i][0] - nx * w + o, pts[i][1] - ny * w + (dy ? dy(i / (pts.length - 1)) : 0)]);
    }
    poli(c, izq.concat(der.reverse())); c.closePath();
    return { izq: izq, der: der.reverse() };
  }
  function pintarRampa(c, r, est) {
    var pts = suavizar(r.ruta), alto = function (t) { return Math.sin(Math.PI * Math.min(1, t * 1.25)) * est.alto; };
    var sx = function (t) { return alto(t) * 0.45; }, sy = function (t) { return alto(t) * 0.75; };
    c.fillStyle = 'rgba(0,0,10,.45)'; cinta(c, pts, est.ancho, 1.05, sx, sy); c.fill();          // sombra sobre la mesa
    c.fillStyle = '#8a8a9a';                                    // soportes
    for (var t = 0.18; t < 0.95; t += 0.22) {
      var i = Math.round(t * (pts.length - 1)), p = pts[i];
      c.fillRect(p[0] - 2, p[1], 4, sy(t) + 2); c.fillStyle = '#5a5a68'; c.fillRect(p[0] + 1, p[1], 1, sy(t) + 2); c.fillStyle = '#8a8a9a';
    }
    c.fillStyle = est.pared; cinta(c, pts, est.ancho, 1, null, function () { return 3; }); c.fill();   // cara inferior de la pared
    c.fillStyle = est.borde; cinta(c, pts, est.ancho, 1); c.fill();
    var fp = est.fPiso || 0.74;
    c.fillStyle = est.piso; cinta(c, pts, est.ancho, fp); c.fill();
    c.fillStyle = est.luz; cinta(c, pts, est.ancho, fp * 0.5); c.fill();
    if (est.brillo) { c.fillStyle = est.brillo; cinta(c, pts, est.ancho, 0.12, function () { return -2; }, function () { return -2; }); c.fill(); }
    var bordes = cinta(c, pts, est.ancho, 1);                   // remate claro de las paredes
    c.strokeStyle = est.remate; c.lineWidth = 1.5;
    poli(c, bordes.izq); c.stroke(); poli(c, bordes.der); c.stroke();
    var bi = cinta(c, pts, est.ancho, fp);                    // arista interior oscura
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; poli(c, bi.izq); c.stroke(); poli(c, bi.der); c.stroke();
    var a0 = Math.atan2(pts[3][1] - pts[0][1], pts[3][0] - pts[0][0]), w0 = est.ancho(0) / 2 + 4;   // boca de entrada abierta
    c.save(); c.translate(pts[0][0], pts[0][1]); c.rotate(a0);
    c.fillStyle = est.borde; c.beginPath(); c.moveTo(4, -w0 + 2); c.lineTo(-8, -w0 - 2); c.lineTo(-8, w0 + 2); c.lineTo(4, w0 - 2); c.closePath(); c.fill();
    c.fillStyle = 'rgba(10,5,30,.75)'; c.beginPath(); c.ellipse(-2, 0, 4, w0 - 6, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = est.labio; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, -w0 - 2); c.lineTo(-8, w0 + 2); c.stroke();
    c.restore();
    return pts;
  }
  function flecha(c, x, y, ang, color) {
    c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = color;
    c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-5, 5); c.closePath(); c.fill(); c.restore();
  }
  function pintarPlataforma(c) {                              // plataforma morada elevada (va en la capa de rampas)
    c.fillStyle = 'rgba(0,0,10,.5)'; poli(c, PLAT.map(function (p) { return [p[0] + 5, p[1] + 7]; })); c.closePath(); c.fill();   // sombra
    c.fillStyle = '#2a1060'; poli(c, PLAT.map(function (p) { return [p[0], p[1] + 4]; })); c.closePath(); c.fill();                 // canto
    var gp = c.createLinearGradient(12, 240, 124, 400); gp.addColorStop(0, '#9a7ad8'); gp.addColorStop(0.5, '#7a56c0'); gp.addColorStop(1, '#5e3aa8');
    c.save(); poli(c, PLAT); c.closePath(); c.fillStyle = gp; c.fill(); c.clip();
    c.strokeStyle = 'rgba(60,20,120,.45)'; c.lineWidth = 7;    // galones oscuros
    for (var g = 0; g < 7; g++) { c.beginPath(); c.moveTo(0, 230 + g * 28); c.lineTo(70, 262 + g * 28); c.lineTo(140, 230 + g * 28); c.stroke(); }
    c.restore();
    c.strokeStyle = '#e8dcff'; c.lineWidth = 2.5; poli(c, PLAT.slice(0, 8)); c.stroke(); poli(c, PLAT.slice(9)); c.stroke();      // canto claro
    callesPlat.forEach(function (x) {                          // 3 calles blancas con postes rojos
      c.fillStyle = '#f4f4fa'; c.fillRect(x - 3, 258, 6, 14); c.strokeStyle = '#5a2a10'; c.lineWidth = 1; c.strokeRect(x - 3, 258, 6, 14);
    });
    c.fillStyle = '#d42a2a'; [35, 53].forEach(function (x) { c.fillRect(x - 2, 254, 4, 16); });
    c.fillStyle = '#e02a4a'; [296, 308, 320].forEach(function (y) { c.beginPath(); c.ellipse(116, y, 3, 4.5, 0, 0, Math.PI * 2); c.fill(); });   // luces rojas del borde
    c.fillStyle = '#18083a'; c.beginPath(); c.arc(salidaPlat.x, salidaPlat.y, 8, 0, Math.PI * 2); c.fill();                       // agujero del mango
    c.strokeStyle = '#c4a8ff'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#7fd0ff'; flecha(c, 34, 314, 1.9, '#7fd0ff'); flecha(c, 70, 366, 2.0, '#7fd0ff');
  }
  function prepararRampas() {
    capaR.width = W * dpr; capaR.height = H * dpr;
    var c = capaR.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.lineJoin = 'round'; c.lineCap = 'round';
    var orb = pintarRampa(c, rampas[1], { ancho: function (t) { return t < 0.06 ? 30 - t * 100 : 24; }, alto: 14, fPiso: 0.52,
      pared: '#4a0608', borde: '#c8262a', piso: '#5e5e6c', luz: '#8a8a98', brillo: null, remate: '#ff8a70', labio: '#ffd23f' });
    c.fillStyle = '#ffd23f';                                    // luces doradas por el centro de la órbita
    for (var i = 4; i < orb.length - 2; i += 4) { c.beginPath(); c.arc(orb[i][0], orb[i][1], 2, 0, Math.PI * 2); c.fill(); }
    pintarPlataforma(c);
    var ram = pintarRampa(c, rampas[0], { ancho: function (t) { return t < 0.1 ? 34 - t * 80 : 26 - t * 6; }, alto: 22,
      pared: '#2a1060', borde: '#6a40c0', piso: '#9a72e0', luz: '#c4a8ff', brillo: 'rgba(255,255,255,.55)', remate: '#e8dcff', labio: '#ffffff' });
    c.lineCap = 'round'; c.lineJoin = 'round';                 // galones morado oscuro de la rampa
    for (var f = 0.1; f < 0.92; f += 0.09) {
      var i = Math.round(f * (ram.length - 1)), p0 = ram[i], p1 = ram[Math.min(ram.length - 1, i + 2)], a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), w = 10 - f * 3;
      var nx = -Math.sin(a), ny = Math.cos(a), ax = Math.cos(a) * 5, ay = Math.sin(a) * 5;
      c.strokeStyle = 'rgba(70,30,140,.75)'; c.lineWidth = 3.5; c.beginPath();
      c.moveTo(p0[0] + nx * w - ax, p0[1] + ny * w - ay); c.lineTo(p0[0] + ax, p0[1] + ay); c.lineTo(p0[0] - nx * w - ax, p0[1] - ny * w - ay); c.stroke();
    }
  }
  function prepararFondo() {
    capa.width = W * dpr; capa.height = H * dpr;
    var c = capa.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#2a0f3c'; c.fillRect(0, 0, W, H);           // fuera de la mesa
    var mesa = contorno.concat([[CARRIL, 612]]);
    var g = c.createRadialGradient(CX, 330, 30, CX, 330, 360); g.addColorStop(0, '#23307a'); g.addColorStop(0.6, '#161d55'); g.addColorStop(1, '#0b0f33');
    c.save(); poli(c, mesa); c.closePath(); c.fillStyle = g; c.fill(); c.clip();
    var s = 7; function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    c.strokeStyle = 'rgba(110,150,240,.28)'; c.lineCap = 'round';   // vetas azules (grietas de energía)
    for (var v = 0; v < 26; v++) {
      var x = rnd() * W, y = 60 + rnd() * 500, a = rnd() * Math.PI * 2; c.lineWidth = 1 + rnd() * 2.2; c.beginPath(); c.moveTo(x, y);
      for (var k = 0; k < 7; k++) { a += (rnd() - 0.5) * 1.4; x += Math.cos(a) * 16; y += Math.sin(a) * 16; c.lineTo(x, y); }
      c.stroke();
    }
    [[292, 56, 20], [304, 214, 16]].forEach(function (p) {     // planetas rojo oscuro
      var gp = c.createRadialGradient(p[0] - p[2] * 0.4, p[1] - p[2] * 0.4, 2, p[0], p[1], p[2]);
      gp.addColorStop(0, '#c86a6a'); gp.addColorStop(0.5, '#6e1f2a'); gp.addColorStop(1, '#2a0a14');
      c.fillStyle = gp; c.beginPath(); c.arc(p[0], p[1], p[2], 0, Math.PI * 2); c.fill();
    });
    c.fillStyle = '#b81e24';                                    // franja roja con flechas azules hacia la órbita
    poli(c, [[222, 352], [282, 262], [304, 254], [298, 280], [244, 360]]); c.closePath(); c.fill();
    c.strokeStyle = '#ff6a50'; c.lineWidth = 1.5; c.stroke();
    for (var fa = 0; fa < 4; fa++) flecha(c, 240 + fa * 13, 334 - fa * 20, -1.0, fa === 3 ? '#cfefff' : '#3fa8ff');
    var pc = c.createRadialGradient(CX, 380, 4, CX, 380, 58);  // círculo central (pozo de gravedad)
    pc.addColorStop(0, '#4fd2e0'); pc.addColorStop(0.45, '#1d6f9c'); pc.addColorStop(1, '#0c1f55');
    c.fillStyle = 'rgba(40,60,140,.55)'; c.beginPath(); c.arc(CX, 380, 68, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(120,170,255,.5)'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = pc; c.beginPath(); c.arc(CX, 380, 46, 0, Math.PI * 2); c.fill();
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
    [0, 1].forEach(function (lado) {                           // parte de abajo: esquinas rojas, aletas naranjas, calles
      var X = function (x) { return lado ? 2 * CX - x : x; };
      c.fillStyle = '#9b1b1f'; poli(c, [[X(35), 488], [X(104), 520], [X(104), 612], [X(35), 612]]); c.closePath(); c.fill();
      c.fillStyle = '#c2332f'; poli(c, [[X(35), 512], [X(84), 534], [X(84), 612], [X(35), 612]]); c.closePath(); c.fill();
      c.strokeStyle = '#5a0a0c'; c.lineWidth = 2; poli(c, [[X(35), 512], [X(84), 534], [X(84), 612]]); c.stroke();
      c.save(); c.translate(X(70), 494); c.rotate(lado ? -0.42 : 0.42);       // aleta naranja (criatura) sobre la guía
      var ga = c.createLinearGradient(-30, 0, 30, 0); ga.addColorStop(0, '#6a2a0a'); ga.addColorStop(0.6, '#d0702a'); ga.addColorStop(1, '#f0a050');
      c.fillStyle = ga; c.beginPath(); c.ellipse(0, -4, 30, 7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a1404'; c.beginPath(); c.arc(lado ? -22 : 22, -5, 2.5, 0, Math.PI * 2); c.fill(); c.restore();
      c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(X(16), 520); c.lineTo(X(30), 520); c.lineTo(X(23), 534); c.closePath(); c.fill();   // flecha de la calle de salida
      c.fillStyle = '#f4f4fa'; [X(22.5), X(45)].forEach(function (x) { c.fillRect(x - 3, CALLE_Y - 8, 6, 16); });
    });
    c.save(); c.translate(120, 410); c.rotate(0.6); c.fillStyle = '#d42a2a'; c.fillRect(-9, -2.5, 18, 5); c.fillRect(-2.5, -9, 5, 18); c.restore();   // equis roja
    slings.forEach(function (m, lado) {                        // slingshots: triángulo rojo con luz azul
      var X = function (x) { return lado ? 2 * CX - x : x; };
      c.fillStyle = '#2b1030'; poli(c, [[X(57), 400], [X(57), 452], [X(100), 488]]); c.closePath(); c.fill();
      c.strokeStyle = '#c8262a'; c.lineWidth = 4; c.lineJoin = 'round'; c.stroke();
      var lz = c.createRadialGradient(X(70), 448, 1, X(70), 448, 11); lz.addColorStop(0, '#e8f6ff'); lz.addColorStop(1, 'rgba(90,160,255,0)');
      c.fillStyle = lz; c.beginPath(); c.arc(X(70), 448, 11, 0, Math.PI * 2); c.fill();
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
    c.strokeStyle = '#4a4a58'; c.lineWidth = 8; poli(c, orbitaGris); c.stroke();     // barandilla gris de la órbita izquierda
    c.strokeStyle = '#b8b8c8'; c.lineWidth = 5; poli(c, orbitaGris); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1; poli(c, orbitaGris); c.stroke();
    c.fillStyle = '#e02a2a'; orbitaGris.forEach(function (p, i) { if (i % 3 === 1) { c.beginPath(); c.arc(p[0], p[1], 3, 0, Math.PI * 2); c.fill(); } });
    [138, 168, 198, 228].forEach(function (x) {                // postes rojos y blancos de los carriles
      c.fillStyle = '#ffffff'; c.fillRect(x - 3, 52, 6, 22); c.fillStyle = '#d42a2a'; c.fillRect(x - 3, 44, 6, 8); c.fillRect(x - 3, 74, 6, 4);
    });
    c.fillStyle = '#f2d23a';                                    // luces amarillas decorativas
    [[45, 430], [CX * 2 - 45, 430], [22.5, 430], [CX * 2 - 22.5, 430], [138, 92], [228, 92]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 3, 0, Math.PI * 2); c.fill(); });
    flecha(c, 136, 274, -2.0, '#7fd0ff'); flecha(c, 286, 290, -1.6, '#7fd0ff'); flecha(c, 150, 228, -2.4, '#7fd0ff');
    var gpk = c.createLinearGradient(80, 205, 116, 255);         // carril rosa en forma de cohete, con bandas amarillas
    gpk.addColorStop(0, '#ff7ad0'); gpk.addColorStop(1, '#b8288a');
    c.save(); c.translate(98, 230); c.rotate(0.95);
    c.fillStyle = gpk; c.beginPath(); c.moveTo(-30, -9); c.lineTo(20, -9); c.lineTo(34, 0); c.lineTo(20, 9); c.lineTo(-30, 9); c.quadraticCurveTo(-38, 0, -30, -9); c.fill();
    c.strokeStyle = '#ffd23f'; c.lineWidth = 4; [-18, -4, 10].forEach(function (x) { c.beginPath(); c.moveTo(x, -9); c.lineTo(x + 4, 9); c.stroke(); });
    flecha(c, 24, 0, 0, '#7fd0ff'); c.restore();
    var ge = c.createLinearGradient(agujero.x - 26, 0, agujero.x + 26, 0);   // embudo gris del agujero negro
    ge.addColorStop(0, '#5a5a6a'); ge.addColorStop(0.5, '#c8c8d4'); ge.addColorStop(1, '#4a4a58');
    c.fillStyle = ge; c.beginPath(); c.moveTo(agujero.x - 26, agujero.y - 26); c.lineTo(agujero.x + 22, agujero.y - 30);
    c.lineTo(agujero.x + 12, agujero.y + 4); c.lineTo(agujero.x - 12, agujero.y + 6); c.closePath(); c.fill();
    c.fillStyle = '#05050f'; c.strokeStyle = '#7a7a90'; c.lineWidth = 3;
    c.beginPath(); c.arc(agujero.x, agujero.y, 13, 0, Math.PI * 2); c.fill(); c.stroke();
    rocas.forEach(function (o) {                               // asteroides marrones con cráteres
      var gr = c.createRadialGradient(o.x - o.r * 0.4, o.y - o.r * 0.4, 1, o.x, o.y, o.r + 2);
      gr.addColorStop(0, '#b08868'); gr.addColorStop(1, '#4a3022'); c.fillStyle = gr;
      c.beginPath(); for (var i = 0; i < 9; i++) { var a = i * Math.PI * 2 / 9, rr = (o.r + 1.5) * (i % 2 ? 0.85 : 1.05); c[i ? 'lineTo' : 'moveTo'](o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr); }
      c.closePath(); c.fill(); c.fillStyle = 'rgba(40,20,10,.6)'; c.beginPath(); c.arc(o.x + 2, o.y - 1, o.r * 0.25, 0, Math.PI * 2); c.fill();
    });
  }
  function texto(t, x, y, tam, color) { ctx.font = 'bold ' + tam + 'px Courier New'; ctx.fillStyle = color; ctx.fillText(t, x, y); }
  function dibujarBumper(u) {
    var r = u.r;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(u.x + 2, u.y + 3, r + 1, 0, Math.PI * 2); ctx.fill();
    var gb = ctx.createLinearGradient(u.x - r, u.y, u.x + r, u.y); gb.addColorStop(0, '#9a9aa8'); gb.addColorStop(0.5, '#ffffff'); gb.addColorStop(1, '#8a8a98');
    ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = u.flash ? '#ff9a3a' : u.p ? '#1a2468' : '#c8262a'; ctx.beginPath();   // estrella roja (azul marino con pinchos en la plataforma)
    for (var i = 0; i < (u.p ? 24 : 16); i++) { var a = i * Math.PI / (u.p ? 12 : 8) + tick * 0.01, rr = i % 2 ? r * 0.6 : r * (u.p ? 0.95 : 0.82); ctx[i ? 'lineTo' : 'moveTo'](u.x + Math.cos(a) * rr, u.y + Math.sin(a) * rr); }
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
      var a = -Math.PI / 2 + i * Math.PI * 2 / LUCES; luz(CX + Math.cos(a) * 58, 380 + Math.sin(a) * 58, 4, i < luces, '#8fd0ff', '#2a4a86');
    }
    for (var m = 0; m < 10; m++) {                             // anillo interior amarillo: multiplicador (2 luces por nivel)
      var am = -Math.PI / 2 + m * Math.PI * 2 / 10; luz(CX + Math.cos(am) * 34, 380 + Math.sin(am) * 34, 3.5, m < mult * 2, '#ffe14a', '#5a5420');
    }
    luz(CX, 380, 4, tick % 40 < 20, '#ffe14a', '#5a5420');
    texto(RANGOS[rango], CX, 448, 10, 'rgba(200,230,255,.8)');
    CARRILES.forEach(function (x, k) { luz(x, 86, 4.5, lit[k], '#ffe14a', '#4a4630'); });
    [22.5, 45, 2 * CX - 45, 2 * CX - 22.5].forEach(function (x, k) { luz(x, 440, 3.5, calles[k] > 0, '#ffe14a', '#5a5420'); });
    luz(CX, 586, 3.5, tick % 50 < 25, '#ffe14a', '#5a5420');   // luz entre los flippers
    if (salva > 0 && (salva > 120 || tick % 20 < 10)) texto('REDESPLIEGUE', CX, 597, 9, '#7fe0ff');
    var giro = tick * 0.08;                                    // agujero negro
    ctx.strokeStyle = 'rgba(190,120,255,.85)'; ctx.lineWidth = 1.5;
    for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(agujero.x, agujero.y, 3 + k * 3, giro + k * 2, giro + k * 2 + 3.6); ctx.stroke(); }
    dianas.forEach(function (d) {
      if (d.abajo) { ctx.fillStyle = 'rgba(255,210,60,.25)'; ctx.fillRect(d.ax - 1, d.ay, 4, d.by - d.ay); return; }
      ctx.fillStyle = '#f2d23a'; ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 1; ctx.fillRect(d.ax - 4, d.ay, 7, d.by - d.ay); ctx.strokeRect(d.ax - 4, d.ay, 7, d.by - d.ay);
    });
    bumpers.forEach(function (u) { if (!u.p) dibujarBumper(u); });
    var gv = ctx.createRadialGradient(verde.x - 2, verde.y - 2, 1, verde.x, verde.y, verde.r + 3);   // objetivo verde
    gv.addColorStop(0, verde.flash ? '#ffffff' : '#b6ff9a'); gv.addColorStop(0.6, '#2fae3a'); gv.addColorStop(1, '#0d4a18');
    ctx.fillStyle = '#d8d8e0'; ctx.beginPath(); ctx.arc(verde.x, verde.y, verde.r + 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = gv; ctx.shadowColor = '#6f6'; ctx.shadowBlur = verde.flash ? 14 : 0; ctx.beginPath(); ctx.arc(verde.x, verde.y, verde.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
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
    var b = bolaAct;                                           // la bola pasa por debajo de las rampas salvo cuando va por ellas
    if (b && !b.rampa && !b.nivel) { if (b.capt > 0) { ctx.globalAlpha = 0.35 + 0.3 * Math.sin(tick * 0.4); dibujarBola(b); ctx.globalAlpha = 1; } else dibujarBola(b); }
    ctx.drawImage(capaR, 0, 0, W, H);
    bumpers.forEach(function (u) { if (u.p) dibujarBumper(u); });   // la plataforma y lo que hay encima van sobre la capa de rampas
    callesPlat.forEach(function (x, k) { luz(x, 250, 3, litPlat[k], '#ffe14a', '#5a5420'); });
    if (b && b.nivel === 1 && !b.rampa) dibujarBola(b);
    if (b && b.rampa) { ctx.save(); ctx.translate(b.x, b.y); ctx.scale(1.2, 1.2); ctx.translate(-b.x, -b.y); dibujarBola(b); ctx.restore(); }
    if (running && !paused && enLanzador() && !cargando && tick % 60 < 40) {
      texto('MANTÉN ESPACIO', CX, 568, 11, '#ffe14a'); texto('o la mitad derecha', CX, 582, 10, '#ffe14a');
    }
    if (avisoT > 0) { ctx.shadowColor = '#000'; ctx.shadowBlur = 6; texto(aviso, CX, 290, 16, '#ffe14a'); ctx.shadowBlur = 0; }
    if (paused) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H); texto('PAUSA', W / 2, H / 2, 24, '#fff'); texto('toca o pulsa ESPACIO', W / 2, H / 2 + 22, 11, '#9fb3c8'); }
  }
  function prepararLienzo() {
    var d = Math.min(2, window.devicePixelRatio || 1);
    if (d === dpr && capa.listo) return;
    dpr = d; capa.listo = true; cv.width = W * dpr; cv.height = H * dpr; prepararFondo(); prepararRampas(); dibujar();
  }
  var acc = 0, last = 0;
  function bucle(t) {
    var now = t || performance.now(); acc += Math.min(now - (last || now), 100); last = now;
    var g = 0; while (acc >= 1000 / 60 && g < 6) { paso(); acc -= 1000 / 60; g++; }
    dibujar(); if (running) raf = requestAnimationFrame(bucle);
  }

  /* ---------- partida ---------- */
  function nueva() {
    score = 0; bola = 1; extra = 0; mult = 1; misiones = 0; rango = 0; luces = 0; salva = 0; actual = 0; litPlat = [false, false, false]; lit = [false, false, false]; espera = 0; reponerDianas = 0; carga = 0;
    dianas.forEach(function (d) { d.abajo = false; }); fl.ang = fl.rest; fr.ang = fr.rest; tick = 0; avisoT = 0;
    over = false; paused = false; $('pinStart').style.display = 'none'; $('pinOver').classList.remove('show');
    nuevaBola(); hud(); ac(); actualizarControles();
    running = true; panel(); last = 0; acc = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(bucle);
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
    $('pinOver').classList.remove('show'); $('pinStart').style.display = 'flex'; mostrarRecord(); panel(); dibujar();
  };
  /* solo pruebas */
  window.pinEstado = function () {
    var b = bolaAct;
    return { score: score, bola: bola, extra: extra, mult: mult, rango: rango, running: running, paused: paused, over: over, carga: carga,
      hayBola: !!b, bx: b ? b.x : null, by: b ? b.y : null, vy: b ? b.vy : null, enCarril: b ? b.enCarril : null, rampa: b && b.rampa ? b.rampa.id : null, nivel: b ? b.nivel : null,
      flipL: fl.ang, flipR: fr.ang, dianas: dianas.filter(function (d) { return d.abajo; }).length, mision: MISIONES[actual].id, misiones: misiones, carriles: lit.slice(), luces: luces, tick: tick };
  };
  window.pinColocar = function (x, y, vx, vy) { if (!bolaAct) nuevaBola(); var b = bolaAct; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.enCarril = x > CARRIL; b.capt = 0; b.rampa = null; b.noRampa = 0; b.nivel = 0; salva = 0; };

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

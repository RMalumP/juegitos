/* tetris.js — Juegos XP. Control y reglas rehechos:
   · Una sola entrada: teclado, botones y gestos se convierten en acciones (left, right, soft, hard, rotCW, rotCCW, hold)
     y varias fuentes a la vez (tecla + botón) no duplican la velocidad.
   · DAS/ARR dentro del bucle de juego (sin setInterval), con prioridad a la última dirección pulsada.
     Un toque corto mueve una sola casilla; al soltar la pieza se para en el acto.
   · Pointer Events con captura para botones y gestos (sin touch* ni click fantasma).
   · Reglas: rotación SRS con kicks, bolsa de 7 piezas, lock delay de 500 ms (máx. 15 reinicios) y soft drop con puntos.
   · Ajustes (DAS, ARR, SDF, control táctil) en ⚙ Opciones (js/opciones.js). Teclas reasignables (tetKeyMap). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('tet-bc'), ctx = cv.getContext('2d');
  var nctx = $('tetNC').getContext('2d'), hctx = $('tetHC').getContext('2d');
  var COLS = 10, ROWS = 20, CELL = 20, LOCK_MS = 500, MAX_RESETS = 15;
  var wrap = $('tetBoardWrap'), inner = $('tetBoardInner');

  function fit() {
    var w = wrap.clientWidth, h = wrap.clientHeight, aw, ah;
    if (w / h > 0.5) { ah = h; aw = 0.5 * ah; } else { aw = w; ah = 2 * aw; }
    inner.style.width = aw + 'px'; inner.style.height = ah + 'px';
    cv.style.width = aw + 'px'; cv.style.height = ah + 'px';
  }
  fit(); window.addEventListener('resize', fit);

  /* ---------- piezas (orden y colores originales: I O T S Z J L) ---------- */
  var COLORS = ['#00f0f0', '#f0a000', '#a000f0', '#00f000', '#f00000', '#0000f0', '#f0f000'];
  var BASE = [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[1, 1], [1, 1]],
    [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  ];
  function girar(m) { var n = m.length; return m.map(function (_, r) { return m[r].map(function (_, c) { return m[n - 1 - c][r]; }); }); }
  var ESTADOS = BASE.map(function (m) { var s = [m]; for (var i = 1; i < 4; i++) s.push(girar(s[i - 1])); return s; });

  /* kicks SRS: [dx, dy] con y hacia arriba (se invierte al aplicar) */
  var KICK_JLSTZ = {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
  };
  var KICK_I = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], '0>3': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]
  };

  /* ---------- estado ---------- */
  var board, cur = null, queue = [], holdT = null, canHold = true;
  var score = 0, level = 1, lines = 0, startLevel = 1;
  var playing = false, paused = false, raf = 0, lastT = 0;
  var gravAcc = 0, lockT = 0, lockResets = 0, lowestY = 0, grounded = false, congelado = false;
  var musicOn = true, sfxOn = true, ac = null, musicTimer = null, musicIdx = 0, musicRunning = false;

  function tetBase(l) { return Math.max(80, Math.round(1e3 * Math.pow(0.85, l - 1))); }
  function opt(k, def) { return (window.Opciones && window.Opciones.get(k)) || def; }
  function hayTactil() { return !!(window.Opciones && window.Opciones.tactil()); }
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }

  function vacio() { return Array.from({ length: ROWS }, function () { return Array(COLS).fill(0); }); }
  board = vacio();

  function cabe(t, r, x, y) {
    var m = ESTADOS[t][r];
    for (var i = 0; i < m.length; i++) for (var j = 0; j < m[i].length; j++) if (m[i][j]) {
      var cx = x + j, cy = y + i;
      if (cx < 0 || cx >= COLS || cy >= ROWS || (cy >= 0 && board[cy][cx])) return false;
    }
    return true;
  }

  /* ---------- bolsa de 7 ---------- */
  function rellenar() {
    while (queue.length < 7) {
      var b = [0, 1, 2, 3, 4, 5, 6];
      for (var i = 6; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = b[i]; b[i] = b[j]; b[j] = t; }
      queue = queue.concat(b);
    }
  }
  function tomar() { rellenar(); var t = queue.shift(); rellenar(); return t; }

  /* ---------- pieza activa ---------- */
  function aparecer(t) {
    cur = { t: t, r: 0, x: t === 1 ? 4 : 3, y: -1 };
    gravAcc = 0; lockT = 0; lockResets = 0; lowestY = cur.y; grounded = false;
    if (!cabe(cur.t, cur.r, cur.x, cur.y)) { finPartida(); return false; }
    grounded = !cabe(cur.t, cur.r, cur.x, cur.y + 1);
    return true;
  }
  /* tras mover o girar: si está apoyada se reinicia el lock delay (con tope) */
  function tocado() {
    var g = !cabe(cur.t, cur.r, cur.x, cur.y + 1);
    if (g) { if (lockResets < MAX_RESETS) { lockT = 0; lockResets++; } } else lockT = 0;
    grounded = g;
  }
  function mover(dx) {
    if (!playing || !cur || !cabe(cur.t, cur.r, cur.x + dx, cur.y)) return false;
    cur.x += dx; tocado(); return true;
  }
  function rotar(dir) {
    if (!playing || !cur || cur.t === 1) return false;
    var to = (cur.r + dir + 4) % 4, tabla = (cur.t === 0 ? KICK_I : KICK_JLSTZ)[cur.r + '>' + to];
    for (var k = 0; k < tabla.length; k++) {
      var nx = cur.x + tabla[k][0], ny = cur.y - tabla[k][1];
      if (cabe(cur.t, to, nx, ny)) { cur.r = to; cur.x = nx; cur.y = ny; if (cur.y > lowestY) { lowestY = cur.y; lockResets = 0; } tocado(); return true; }
    }
    return false;
  }
  function bajarUno(conPunto) {
    if (!playing || !cur || !cabe(cur.t, cur.r, cur.x, cur.y + 1)) return false;
    cur.y++; if (conPunto) score++;
    if (cur.y > lowestY) { lowestY = cur.y; lockResets = 0; }
    lockT = 0; grounded = !cabe(cur.t, cur.r, cur.x, cur.y + 1); hud(); return true;
  }
  function caidaFuerte() {
    if (!playing || !cur) return;
    var d = 0; while (cabe(cur.t, cur.r, cur.x, cur.y + 1)) { cur.y++; d++; }
    score += 2 * d; fijar();
  }
  function guardar() {
    if (!playing || !cur || !canHold) return;
    canHold = false;
    var t = cur.t;
    if (holdT === null) { holdT = t; aparecer(tomar()); } else { var h = holdT; holdT = t; aparecer(h); }
    dibujarPrevias();
  }

  /* ---------- fijar pieza y líneas ---------- */
  function fijar() {
    var m = ESTADOS[cur.t][cur.r];
    for (var i = 0; i < m.length; i++) for (var j = 0; j < m[i].length; j++) if (m[i][j] && cur.y + i >= 0) board[cur.y + i][cur.x + j] = COLORS[cur.t];
    pitido(220, 0.06, 0.08);
    var n = 0;
    for (var y = ROWS - 1; y >= 0; y--) if (board[y].every(function (c) { return c; })) { board.splice(y, 1); board.unshift(Array(COLS).fill(0)); n++; y++; }
    if (n) {
      [880, 1047, 1319].forEach(function (f, k) { pitido(f, 0.12, 0.15, 0.06 * k); });
      vib(n >= 4 ? [0, 30, 40, 30, 40, 30, 40, 30] : 30 * n);
      score += [0, 100, 300, 500, 800][n] * level; lines += n;
      level = startLevel + Math.floor(lines / 10);
    }
    canHold = true; hud();
    if (aparecer(tomar())) dibujarPrevias();
  }
  function hud() {
    $('tet-score-el').textContent = score; $('tet-level-el').textContent = level; $('tet-lines-el').textContent = lines;
  }

  /* ---------- sonido ---------- */
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } return ac; }
  function pitido(freq, gain, dur, delay) {
    if (!sfxOn || !audio()) return;
    var o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + (delay || 0);
    o.connect(g); g.connect(ac.destination); o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  var MEL = [[659, 150], [494, 75], [523, 75], [587, 150], [523, 75], [494, 75], [440, 150], [440, 75], [523, 75], [659, 150], [587, 75], [523, 75], [494, 225], [523, 75], [587, 150], [659, 150], [523, 150], [440, 150], [440, 150], [587, 150], [698, 75], [880, 150], [784, 75], [698, 75], [659, 225], [523, 75], [659, 150], [587, 75], [523, 75], [494, 150], [494, 75], [523, 75], [587, 150], [659, 150], [523, 150], [440, 150], [440, 150]];
  function musicaNota() {
    if (!musicRunning || !musicOn || !ac) return;
    var n = MEL[musicIdx % MEL.length], o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination); o.type = 'triangle'; o.frequency.value = n[0];
    g.gain.setValueAtTime(0.15, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + n[1] / 1e3 * 0.9);
    o.start(ac.currentTime); o.stop(ac.currentTime + n[1] / 1e3);
    musicIdx++; musicTimer = setTimeout(musicaNota, n[1]);
  }
  function musicaOn() { if (ac && !musicRunning) { musicRunning = true; musicIdx = 0; musicaNota(); } }
  function musicaOff() { musicRunning = false; if (musicTimer) clearTimeout(musicTimer); musicTimer = null; }

  /* ---------- dibujo ---------- */
  function celda(c, x, y, g, s) {
    g.fillStyle = c; g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.strokeRect(x * s + 1, y * s + 1, s - 2, s - 2);
  }
  function dibujar() {
    ctx.fillStyle = '#0d0d1a'; ctx.fillRect(0, 0, 200, 400);
    ctx.strokeStyle = '#1e1e3a'; ctx.lineWidth = 0.5;
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) if (board[y][x]) celda(board[y][x], x, y, ctx, CELL);
    if (!cur) return;
    var m = ESTADOS[cur.t][cur.r], gy = cur.y;
    while (cabe(cur.t, cur.r, cur.x, gy + 1)) gy++;
    for (var i = 0; i < m.length; i++) for (var j = 0; j < m[i].length; j++) if (m[i][j]) {
      if (gy + i >= 0) { ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect((cur.x + j) * CELL + 1, (gy + i) * CELL + 1, CELL - 2, CELL - 2); }
    }
    for (i = 0; i < m.length; i++) for (j = 0; j < m[i].length; j++) if (m[i][j] && cur.y + i >= 0) celda(COLORS[cur.t], cur.x + j, cur.y + i, ctx, CELL);
  }
  function pieza60(g, t, alfa) {
    g.fillStyle = '#0d0d1a'; g.fillRect(0, 0, 60, 60);
    if (t === null || t === undefined) return;
    var m = ESTADOS[t][0], r0 = 9, r1 = -1, c0 = 9, c1 = -1;
    m.forEach(function (f, i) { f.forEach(function (v, j) { if (v) { r0 = Math.min(r0, i); r1 = Math.max(r1, i); c0 = Math.min(c0, j); c1 = Math.max(c1, j); } }); });
    var w = (c1 - c0 + 1) * 12, h = (r1 - r0 + 1) * 12, ox = Math.floor((60 - w) / 2), oy = Math.floor((60 - h) / 2);
    g.globalAlpha = alfa; g.fillStyle = COLORS[t];
    m.forEach(function (f, i) { f.forEach(function (v, j) { if (v) { var px = ox + (j - c0) * 12, py = oy + (i - r0) * 12; g.fillRect(px + 1, py + 1, 10, 10); g.strokeStyle = 'rgba(255,255,255,0.2)'; g.strokeRect(px + 1, py + 1, 10, 10); } }); });
    g.globalAlpha = 1;
  }
  function dibujarPrevias() { pieza60(nctx, queue[0], 1); pieza60(hctx, holdT, canHold ? 1 : 0.4); }

  /* ---------- entrada unificada ---------- */
  var Input = (function () {
    var held = { left: {}, right: {}, soft: {} }, dir = 0, dasT = 0, arrT = 0;
    function algunaFuente(a) { for (var k in held[a]) return true; return false; }
    function pulsar(a, src) {
      if (!playing) return;
      if (a === 'left' || a === 'right' || a === 'soft') {
        var primera = !algunaFuente(a); held[a][src] = 1;
        if (!primera) return;
        if (a === 'soft') { bajarUno(true); gravAcc = 0; return; }   // soft drop: una casilla al pulsar y luego a ritmo acelerado
        dir = a === 'left' ? -1 : 1; dasT = 0; arrT = 0; mover(dir);           // la última dirección pulsada manda
      } else if (a === 'hard') caidaFuerte();
      else if (a === 'rotCW') rotar(1);
      else if (a === 'rotCCW') rotar(-1);
      else if (a === 'hold') guardar();
    }
    function soltar(a, src) {
      if (!held[a]) return;
      delete held[a][src];
      if (a === 'soft' || algunaFuente(a)) return;
      if (dir === (a === 'left' ? -1 : 1)) {
        var otra = a === 'left' ? 'right' : 'left';
        if (algunaFuente(otra)) { dir = otra === 'left' ? -1 : 1; dasT = 0; arrT = 0; } else { dir = 0; dasT = 0; arrT = 0; }
      }
    }
    function actualizar(dt) {
      if (!dir) return;
      dasT += dt; if (dasT < opt('das', 160)) return;
      arrT += dt; var arr = Math.max(opt('arr', 45), 8);
      while (arrT >= arr) { arrT -= arr; if (!mover(dir)) { arrT = 0; break; } }
    }
    function reiniciar() { held = { left: {}, right: {}, soft: {} }; dir = 0; dasT = 0; arrT = 0; }
    return { pulsar: pulsar, soltar: soltar, actualizar: actualizar, reiniciar: reiniciar, soft: function () { return algunaFuente('soft'); } };
  })();

  /* ---------- bucle ---------- */
  function paso(dt) {
    if (!cur) return;
    Input.actualizar(dt);
    if (congelado) { dibujar(); return; }
    var gi = tetBase(level), soft = Input.soft();
    if (soft) gi = Math.max(gi / opt('sdf', 20), 12);
    gravAcc += dt;
    while (gravAcc >= gi) { gravAcc -= gi; if (!bajarUno(soft)) { gravAcc = 0; break; } }
    grounded = !cabe(cur.t, cur.r, cur.x, cur.y + 1);
    if (grounded) { lockT += dt; if (lockT >= LOCK_MS) fijar(); } else lockT = 0;
  }
  function bucle(now) {
    if (!playing) return;
    var dt = Math.min(now - (lastT || now), 100); lastT = now;
    paso(dt); dibujar();
    raf = requestAnimationFrame(bucle);
  }
  function arrancarBucle() { cancelAnimationFrame(raf); lastT = performance.now(); raf = requestAnimationFrame(bucle); }

  /* ---------- ayuda y pantallas ---------- */
  function ayuda() {
    var k = '← → mover &nbsp;·&nbsp; ↑ rotar &nbsp;·&nbsp; Z rotar ↺<br>↓ bajar &nbsp;·&nbsp; Espacio: caer &nbsp;·&nbsp; C: guardar';
    var t = '<br><br>📱 arrastra = mover · toca = rotar<br>desliza ↓ = caer · desliza ↑ = guardar<br>2 dedos = rotar ↺';
    return k + (hayTactil() ? t : '<br><br>Menú ⚙ Opciones: activa el control táctil');
  }
  function mostrarMenu() {
    playing = false; paused = false; Input.reiniciar(); musicaOff(); cancelAnimationFrame(raf);
    $('tetOverlay').style.display = 'flex'; $('tet-ov-title').textContent = 'TETRIS';
    $('tet-ov-sub').innerHTML = ayuda(); $('tet-ov-btn').textContent = 'INICIAR'; tetSel('flex');
  }
  function tetSel(v) { var e = $('tetLevelSelect'); if (e) e.style.display = v; }
  function finPartida() {
    playing = false; Input.reiniciar(); musicaOff(); cancelAnimationFrame(raf); vib(200);
    $('tet-ov-title').textContent = 'GAME OVER';
    var rec = recordText(saveRecord('tetris', score));
    $('tet-ov-sub').innerHTML = 'Puntuación: ' + score + '<br>Nivel: ' + level + '<br>Líneas: ' + lines + (rec ? '<br>' + rec : '');
    $('tet-ov-btn').textContent = 'REINICIAR'; $('tetOverlay').style.display = 'flex'; tetSel('flex');
  }
  function iniciarOReanudar() {
    if (paused) {
      paused = false; playing = true; $('tetOverlay').style.display = 'none';
      if (musicOn) { audio(); musicaOn(); }
      arrancarBucle(); return;
    }
    audio(); board = vacio(); score = 0; level = startLevel; lines = 0; holdT = null; canHold = true; queue = []; rellenar();
    playing = true; paused = false; Input.reiniciar();
    $('tetOverlay').style.display = 'none'; hud();
    aparecer(tomar()); dibujarPrevias();
    musicaOff(); if (musicOn) musicaOn();
    arrancarBucle();
  }
  function pausar() {
    if (!playing) return;
    playing = false; paused = true; Input.reiniciar(); musicaOff(); cancelAnimationFrame(raf);
    $('tetOverlay').style.display = 'flex'; $('tet-ov-title').textContent = 'PAUSA';
    $('tet-ov-sub').innerHTML = 'Puntuación: ' + score + '<br>Nivel: ' + level + '<br>Líneas: ' + lines;
    $('tet-ov-btn').textContent = 'CONTINUAR'; tetSel('none');
  }

  /* selector de nivel inicial */
  (function () {
    var g = $('tetLevelGrid'); if (!g) return;
    function marcar() { g.querySelectorAll('.tetLevelCell').forEach(function (c) { c.classList.toggle('selected', +c.textContent === startLevel); }); }
    for (var i = 1; i <= 15; i++) {
      var c = document.createElement('div'); c.className = 'tetLevelCell'; c.textContent = i;
      c.addEventListener('click', (function (n) { return function () { startLevel = n; marcar(); }; })(i));
      g.appendChild(c);
    }
    marcar();
  })();

  /* ---------- teclado ---------- */
  var DEF = { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', rotate: 'ArrowUp', rotateCCW: 'KeyZ', drop: 'Space', hold: 'KeyC', newgame: 'Enter' };
  var keys = Object.assign({}, DEF);
  try { var sv = localStorage.getItem('tetKeyMap'); if (sv) keys = Object.assign({}, DEF, JSON.parse(sv)); } catch (e) { /* sin ajustes */ }
  var ACCION = { left: 'left', right: 'right', down: 'soft', rotate: 'rotCW', rotateCCW: 'rotCCW', drop: 'hard', hold: 'hold' };
  function accionDe(code) { for (var k in ACCION) if (keys[k] === code) return ACCION[k]; return null; }
  function ventanaVisible() { var w = $('winTetris'); return !!w && !w.classList.contains('hidden'); }
  function modalAbierto() { var m = $('tetRemapModal'), o = $('optModal'); return (m && m.classList.contains('active')) || (o && o.classList.contains('show')); }
  function enCampo(t) { return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }

  document.addEventListener('keydown', function (e) {
    if (!ventanaVisible() || modalAbierto() || enCampo(e.target)) return;
    if (e.code === keys.newgame) {
      if (e.repeat) return; e.preventDefault();
      if (playing) mostrarMenu(); else iniciarOReanudar();
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (e.repeat) return;
      if (playing) { e.preventDefault(); pausar(); } else if (paused) { e.preventDefault(); iniciarOReanudar(); }
      return;
    }
    if (!playing) return;
    var a = accionDe(e.code); if (!a) return;
    e.preventDefault();
    if (e.repeat) return;                                // la repetición la hace el bucle (DAS/ARR), no el sistema
    Input.pulsar(a, 'k' + e.code);
  });
  document.addEventListener('keyup', function (e) { var a = accionDe(e.code); if (a) Input.soltar(a, 'k' + e.code); });
  window.addEventListener('blur', function () { Input.reiniciar(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { Input.reiniciar(); pausar(); } });

  /* ---------- botones en pantalla (Pointer Events con captura) ---------- */
  function enlazarBoton(id, accion) {
    var b = $(id); if (!b) return;
    function bajar(e) { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) { /* nada */ } b.classList.add('pressed'); Input.pulsar(accion, 'b' + id + e.pointerId); }
    function subir(e) { b.classList.remove('pressed'); Input.soltar(accion, 'b' + id + e.pointerId); }
    b.addEventListener('pointerdown', bajar);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { b.addEventListener(ev, subir); });
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  enlazarBoton('tet-b-left', 'left'); enlazarBoton('tet-b-right', 'right'); enlazarBoton('tet-b-down', 'soft');
  enlazarBoton('tet-b-up', 'rotCW'); enlazarBoton('tet-b-hold', 'hold'); enlazarBoton('tetBDrop', 'hard');

  /* ---------- gestos en el tablero (solo con el control táctil activado) ---------- */
  (function () {
    var ptr = {};
    cv.style.touchAction = 'none';
    function celdaPx() { return cv.getBoundingClientRect().width / COLS || 20; }
    function numPunteros() { return Object.keys(ptr).length; }
    cv.addEventListener('pointerdown', function (e) {
      if (!playing || !hayTactil()) return;
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
      if (numPunteros() >= 1) { rotar(-1); for (var k in ptr) ptr[k].usado = true; ptr[e.pointerId] = { usado: true }; return; }   // segundo dedo: girar ↺
      ptr[e.pointerId] = { x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, t0: performance.now(), ax: 0, ay: 0, modo: '', usado: false };
    });
    cv.addEventListener('pointermove', function (e) {
      var p = ptr[e.pointerId]; if (!p || p.usado || !playing) return;
      var c = celdaPx(), dx = e.clientX - p.lx, dy = e.clientY - p.ly; p.lx = e.clientX; p.ly = e.clientY;
      var tx = e.clientX - p.x0, ty = e.clientY - p.y0;
      if (!p.modo && Math.hypot(tx, ty) > 0.5 * c) p.modo = Math.abs(ty) > 1.5 * Math.abs(tx) ? 'v' : 'h';
      if (p.modo === 'h') {
        p.ax += dx;
        while (Math.abs(p.ax) >= 0.9 * c) { var s = p.ax > 0 ? 1 : -1; p.ax -= s * 0.9 * c; mover(s); }
      } else if (p.modo === 'v') {
        if (dy > 0) p.ay += dy;
        while (p.ay >= 0.9 * c) { p.ay -= 0.9 * c; bajarUno(true); }
      }
    });
    function fin(e, cancelado) {
      var p = ptr[e.pointerId]; delete ptr[e.pointerId];
      if (!p || p.usado || cancelado || !playing) return;
      var c = celdaPx(), dt = performance.now() - p.t0, tx = e.clientX - p.x0, ty = e.clientY - p.y0;
      if (Math.hypot(tx, ty) < 0.5 * c && dt < 280) rotar(1);                                  // toque = girar
      else if (ty > 3 * c && dt < 300 && Math.abs(tx) < 0.6 * ty) caidaFuerte();                // deslizar rápido abajo = caer
      else if (ty < -2 * c && dt < 350 && Math.abs(tx) < 0.6 * -ty) guardar();                  // deslizar rápido arriba = guardar
    }
    cv.addEventListener('pointerup', function (e) { fin(e, false); });
    cv.addEventListener('pointercancel', function (e) { fin(e, true); });
    window.addEventListener('opciones', function () {
      if (!hayTactil()) ptr = {};
      if (!playing && !paused && $('tet-ov-title').textContent === 'TETRIS') $('tet-ov-sub').innerHTML = ayuda();   // la ayuda del menú sigue al ajuste
    });
  })();

  /* ---------- botones del menú, música y efectos ---------- */
  $('tet-ov-btn').addEventListener('click', iniciarOReanudar);
  $('tetStartSideBtn').addEventListener('click', mostrarMenu);
  window.tetShowMenu = mostrarMenu;
  $('tet-music-btn').addEventListener('click', function () {
    audio(); musicOn = !musicOn;
    $('tet-music-btn').innerHTML = '♩ Música<br>' + (musicOn ? 'ON' : 'OFF');
    if (musicOn && playing) { musicaOff(); musicaOn(); } else if (!musicOn) musicaOff();
  });
  $('tet-sfx-btn').addEventListener('click', function () { sfxOn = !sfxOn; $('tet-sfx-btn').innerHTML = '♪ Efectos<br>' + (sfxOn ? 'ON' : 'OFF'); });

  /* ---------- reasignar teclas ---------- */
  var NOMBRES = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Enter: 'Enter', KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyJ: 'J', KeyK: 'K', KeyL: 'L', KeyI: 'I', KeyC: 'C', KeyZ: 'Z', KeyX: 'X' };
  function nombreTecla(c) { return NOMBRES[c] || String(c).replace(/^Key/, '').replace(/^Digit/, ''); }
  var FILAS = [['left', 'Mover ←'], ['right', 'Mover →'], ['down', 'Bajar ↓'], ['rotate', 'Girar ↻'], ['rotateCCW', 'Girar ↺'], ['hold', 'Guardar'], ['drop', 'Caída'], ['newgame', 'Nueva partida']];
  function abrirRemap() {
    var m = $('tetRemapModal'), cont = $('tetRemapKeys'); cont.innerHTML = '';
    FILAS.forEach(function (f) {
      var fila = document.createElement('div'); fila.className = 'tetRemapRow';
      var et = document.createElement('div'); et.className = 'tetRemapLabel'; et.textContent = f[1];
      var bt = document.createElement('div'); bt.className = 'tetRemapKey'; bt.textContent = nombreTecla(keys[f[0]]); bt.dataset.action = f[0];
      bt.addEventListener('click', function () {
        bt.classList.add('waiting'); bt.textContent = 'Pulsa tecla...';
        function captura(ev) {
          ev.preventDefault(); ev.stopPropagation();
          document.removeEventListener('keydown', captura, true); bt.classList.remove('waiting');
          if (ev.code !== 'Escape') {                       // Esc cancela; si la tecla ya era de otra acción, se intercambian
            for (var k in keys) if (k !== f[0] && keys[k] === ev.code) keys[k] = keys[f[0]];
            keys[f[0]] = ev.code;
          }
          abrirRemap();
        }
        document.addEventListener('keydown', captura, true);
      });
      fila.appendChild(et); fila.appendChild(bt); cont.appendChild(fila);
    });
    var o = document.createElement('div'); o.className = 'tetRemapRow'; o.style.cssText = 'margin-top:6px;border-top:1px solid #4a4a8a;padding-top:8px';
    var l = document.createElement('div'); l.className = 'tetRemapLabel'; l.style.cssText = 'width:auto;flex:1'; l.textContent = 'Control táctil, DAS y ARR: ⚙ Opciones';
    var b = document.createElement('div'); b.className = 'tetRemapKey'; b.textContent = '⚙'; b.addEventListener('click', function () { cerrarRemap(); if (window.Opciones) window.Opciones.abrir('Tetris'); });
    o.appendChild(l); o.appendChild(b); cont.appendChild(o);
    m.classList.add('active');
  }
  function cerrarRemap() {
    $('tetRemapModal').classList.remove('active');
    try { localStorage.setItem('tetKeyMap', JSON.stringify(keys)); } catch (e) { /* nada */ }
  }
  $('tetRemapBtn').addEventListener('click', abrirRemap);
  $('tet-remap-close').addEventListener('click', cerrarRemap);
  $('tet-remap-reset').addEventListener('click', function () { keys = Object.assign({}, DEF); abrirRemap(); });
  $('tetRemapModal').addEventListener('click', function (e) { if (e.target.id === 'tetRemapModal') cerrarRemap(); });

  /* ---------- exportado ---------- */
  window.initTetris = function () {
    fit(); dibujar(); pieza60(nctx, null, 1); pieza60(hctx, null, 1);
    if ($('tetOverlay').style.display !== 'none') $('tet-ov-sub').innerHTML = ayuda();
  };
  window.pauseTetris = pausar;
  /* solo lectura / pruebas */
  window.tetEstado = function () { return cur ? { t: cur.t, r: cur.r, x: cur.x, y: cur.y, score: score, level: level, lines: lines, playing: playing, grounded: grounded } : { playing: playing, score: score, level: level, lines: lines }; };
  window.tetCongelar = function (v) { congelado = !!v; };
})();

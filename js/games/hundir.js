/* hundir.js — Juegos XP: Hundir la flota.
   Tres modos con la MISMA interfaz y el mismo árbitro (js/online/hundir-engine.js):
     · Contra la CPU (fácil · normal · difícil)
     · 2 jugadores en un mismo móvil: se pasan el teléfono con una tapa (js/pasar-movil.js) entre colocaciones y turnos
     · Online, 2 jugadores (sala): el anfitrión es el árbitro y el rival no recibe tu flota (js/online/j-hundir.js)
   Todo se pinta a partir de lo PÚBLICO de la partida (HundirEngine.publico) más la flota propia, así el modo online no filtra nada. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var HE = window.HundirEngine, N = 10;                      // N = lado del tablero de la partida actual (6-15)
  var LETRAS = 'ABCDEFGHIJKLMNO';

  var U = { modo: null, nivel: 2, op: { tocar: true, repite: false }, nombres: ['Tú', 'CPU'], pt: null, pub: null, mia: null, actor: 0, p: 0,
    draft: [], sel: 0, h: true, msg: '', ultimo: -1, bloqueado: false, online: null, fin: false, timer: null,
    cfg: { n: 10, flota: HE.LONGS.slice() },                   // tablero y flota de la partida en curso
    conf: { pl: 'clasica', n: 10, cuenta: { 1: 0, 2: 1, 3: 2, 4: 1, 5: 1, 6: 0 } } };   // lo elegido en el menú (cpu / 2 jugadores)
  try { var sn = parseInt(localStorage.getItem('hunNivel'), 10); if (sn >= 1 && sn <= 3) U.nivel = sn; } catch (e) { /* sin ajustes */ }
  try { var so = JSON.parse(localStorage.getItem('hunOp')); if (so) U.op = { tocar: so.tocar !== false, repite: !!so.repite }; } catch (e) { /* sin ajustes */ }
  try { var sc = JSON.parse(localStorage.getItem('hunCfg')); if (sc && sc.cuenta && HE.validarConfig({ n: sc.n, flota: flotaDeCuenta(sc.cuenta) }).ok) U.conf = sc; } catch (e) { /* sin ajustes */ }
  function guardarAjustes() { try { localStorage.setItem('hunNivel', U.nivel); localStorage.setItem('hunOp', JSON.stringify(U.op)); localStorage.setItem('hunCfg', JSON.stringify(U.conf)); } catch (e) { /* nada */ } }
  function flotaDeCuenta(cuenta) { var f = []; for (var l = HE.L_MAX; l >= HE.L_MIN; l--) for (var k = 0; k < (cuenta[l] || 0); k++) f.push(l); return f; }
  function cuentaDeFlota(flota) { var c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; flota.forEach(function (l) { c[l]++; }); return c; }
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }

  /* ---------- tableros ---------- */
  var celdasEnemigo = [], celdasPropio = [];
  function construir(cont, lista, alClic, alPasar) {
    cont.innerHTML = ''; lista.length = 0;
    cont.style.gridTemplateColumns = '1.4em repeat(' + N + ',1fr)'; cont.style.setProperty('--hn', N);
    var vacia = document.createElement('div'); vacia.className = 'hunEt'; cont.appendChild(vacia);
    for (var c = 0; c < N; c++) { var h = document.createElement('div'); h.className = 'hunEt'; h.textContent = c + 1; cont.appendChild(h); }
    for (var r = 0; r < N; r++) {
      var f = document.createElement('div'); f.className = 'hunEt'; f.textContent = LETRAS[r]; cont.appendChild(f);
      for (c = 0; c < N; c++) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'hunC'; b.dataset.i = r * N + c;
        b.setAttribute('aria-label', LETRAS[r] + (c + 1));
        if (alClic) b.addEventListener('click', (function (i) { return function () { alClic(i); }; })(r * N + c));
        if (alPasar) { b.addEventListener('pointerenter', (function (i) { return function () { alPasar(i); }; })(r * N + c)); }
        cont.appendChild(b); lista.push(b);
      }
    }
    if (alPasar) cont.addEventListener('pointerleave', function () { alPasar(-1); });
  }

  /* ---------- datos a pintar ---------- */
  function publicoActual() {
    if (U.modo === 'online') return U.pub;
    return U.pt ? HE.publico(U.pt) : null;
  }
  function jugadorVista(pub) {                        // quién mira la pantalla
    if (U.modo === 'online') return U.p;
    if (U.modo === 'cpu') return 0;
    return U.actor;
  }
  function miFlota(p) {
    if (U.modo === 'online') return U.mia;
    return U.pt && U.pt.flotas[p];
  }
  function fase(pub) { return pub ? pub.fase : (U.modo ? 'colocando' : 'menu'); }

  /* ---------- pintado ---------- */
  /* barcos distinguibles: contorno grueso en los lados donde el vecino no es del mismo barco + un tono distinto para cada barco contiguo */
  function clasesBarcos(barcos) {
    var dueno = {}, tono = [];
    barcos.forEach(function (cs, k) { cs.forEach(function (c) { dueno[c] = k; }); });
    barcos.forEach(function (cs, k) {
      var usado = {};
      cs.forEach(function (c) {
        [c % N > 0 ? c - 1 : -1, c % N < N - 1 ? c + 1 : -1, c - N, c + N].forEach(function (v) { var o = dueno[v]; if (o != null && o !== k && tono[o] != null) usado[tono[o]] = true; });
      });
      var t = 0; while (usado[t]) t++; tono[k] = t % 4;
    });
    var cl = {};
    Object.keys(dueno).forEach(function (key) {
      var c = +key, k = dueno[c], x = ' sc' + tono[k];
      if (c < N || dueno[c - N] !== k) x += ' bt';
      if (c >= N * (N - 1) || dueno[c + N] !== k) x += ' bb';
      if (c % N === 0 || dueno[c - 1] !== k) x += ' bl';
      if (c % N === N - 1 || dueno[c + 1] !== k) x += ' br';
      cl[c] = x;
    });
    return cl;
  }
  function limpiarCeldas(lista) { lista.forEach(function (b) { b.className = 'hunC'; b.disabled = false; }); }
  function pintarEnemigo(pub, p, puedeDisparar) {
    var g = HE.aguas(pub, p);
    var extra = clasesBarcos(pub.flotas && pub.flotas[1 - p] ? pub.flotas[1 - p].map(function (b) { return HE.celdas(b, N); }) : pub.hund[p]);
    celdasEnemigo.forEach(function (b, i) {
      var v = g[i], cl = 'hunC' + (extra[i] || '');
      if (v === 1) cl += ' agua'; else if (v === 2) cl += ' toc'; else if (v === 3) cl += ' hund'; else if (v === 4) cl += ' rev';
      if (i === U.ultimo) cl += ' ultimo';
      b.className = cl; b.disabled = !(puedeDisparar && v === 0);
    });
  }
  function pintarPropio(pub, p, colocando) {
    var g;
    if (colocando) {
      g = Array(N * N).fill(0);
      U.draft.forEach(function (b) { if (b) HE.celdas(b, N).forEach(function (c) { g[c] = 5; }); });
    } else g = HE.propio(pub || { shots: [[], []], hund: [[], []] }, miFlota(p), p);
    var flota = colocando ? U.draft.filter(function (b) { return b; }) : (miFlota(p) || []);
    var extra = clasesBarcos(flota.map(function (b) { return HE.celdas(b, N); }));
    celdasPropio.forEach(function (b, i) {
      var v = g[i], cl = 'hunC' + (extra[i] || '');
      if (v === 5) cl += ' barco'; else if (v === 2) cl += ' barco toc'; else if (v === 3) cl += ' barco hund'; else if (v === 1) cl += ' agua';
      b.className = cl; b.disabled = !colocando;
    });
  }
  function nombre(p) { return U.nombres[p] || ('Jugador ' + (p + 1)); }
  function estadoTexto(pub) {
    var f = fase(pub), p = jugadorVista(pub);
    if (!pub || f === 'colocando') {
      if (U.modo === 'online' && pub && pub.listos[p]) return '⏳ Flota lista. Esperando a que ' + nombre(1 - p) + ' coloque la suya…';
      return '⚓ ' + (U.modo === 'local' ? nombre(U.actor) + ': coloca tu flota' : 'Coloca tu flota') + '. Elige un barco, toca una casilla y gira con ↻.';
    }
    if (f === 'fin') return pub.ganador === p ? '🏆 ¡Has ganado!' : (U.modo === 'local' ? '🏆 Gana ' + nombre(pub.ganador) : '💀 Has perdido');
    var mio = pub.turno === p;
    if (U.modo === 'cpu') return mio ? '🎯 Tu turno: toca una casilla de las aguas enemigas' : '🤖 Dispara la CPU…';
    if (U.modo === 'local') return U.bloqueado ? '📱 Pasa el móvil a ' + nombre(1 - U.actor) : '🎯 ' + nombre(U.actor) + ': elige dónde disparar';
    return mio ? '🎯 Tu turno: dispara' : '⏳ Dispara ' + nombre(1 - p) + '…';
  }
  function pintarBotones(pub, colocando) {
    var b = $('hunBtns'); b.innerHTML = '';
    function boton(txt, fn, extra, dis) { var e = document.createElement('button'); e.type = 'button'; e.className = 'hunBtn ' + (extra || ''); e.textContent = txt; e.disabled = !!dis; e.addEventListener('click', fn); b.appendChild(e); return e; }
    var p = jugadorVista(pub);
    if (colocando) {
      var espera = U.modo === 'online' && pub && pub.listos[p];
      if (espera) return;
      boton(U.h ? '↻ Horizontal' : '↻ Vertical', function () { U.h = !U.h; pintar(); }, 'giro');
      boton('🎲 Aleatorio', function () { aleatorio(); });
      boton('🗑 Borrar', function () { U.draft = Array(U.cfg.flota.length).fill(null); U.sel = 0; pintar(); });
      boton('✔ Listo', listo, 'ok', U.draft.some(function (x) { return !x; }));
      return;
    }
    if (pub && pub.fase === 'jugando') {
      if (U.modo === 'local' && U.bloqueado) boton('📱 Pasar el móvil', pasarTurno, 'ok');
      boton('🏳 Rendirse', rendirse, 'mal');
    }
  }
  function pintarBarcos(colocando) {
    var c = $('hunShips'); c.innerHTML = '';
    c.style.display = colocando && !(U.modo === 'online' && U.pub && U.pub.listos[U.p]) ? 'flex' : 'none';
    if (!colocando) return;
    U.cfg.flota.forEach(function (l, i) {
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'hunBarco' + (U.draft[i] ? ' puesto' : '') + (U.sel === i ? ' sel' : '');
      b.innerHTML = '<span class=hunPuntos>' + '■'.repeat(l) + '</span><span class=hunNom>' + (HE.NOMBRES[l] || '') + '</span>';
      b.addEventListener('click', function () { U.sel = i; pintar(); });
      c.appendChild(b);
    });
  }
  function pintar() {
    var pub = publicoActual(), f = fase(pub), p = jugadorVista(pub);
    var colocando = U.modo && (f === 'colocando') && !(U.modo === 'online' && pub && pub.listos[p]) ;
    var esperando = U.modo === 'online' && f === 'colocando' && pub && pub.listos[p];
    $('hunEnemyBox').style.display = (f === 'jugando' || f === 'fin') ? '' : 'none';
    $('hunOwnBox').style.display = U.modo ? '' : 'none';
    $('hunOwnBox').classList.toggle('grande', f === 'colocando');
    $('hunOwnTit').textContent = (U.modo === 'local' && f === 'colocando' ? nombre(U.actor) + ' · ' : '') + 'Tu flota';
    $('hunEnemyTit').textContent = 'Aguas enemigas' + (U.modo === 'cpu' ? ' (CPU)' : '');
    var puede = f === 'jugando' && pub.turno === p && !U.bloqueado && !(U.modo === 'online' && !U.online);
    if (f === 'jugando' || f === 'fin') pintarEnemigo(pub, p, puede && f === 'jugando');
    if (f === 'colocando' && !esperando) pintarPropio(pub, p, true);
    else if (U.modo) pintarPropio(pub, p, false);
    pintarBarcos(colocando); pintarBotones(pub, colocando);
    $('hunStatus').textContent = U.modo ? (U.msg ? U.msg + '  ' : '') + estadoTexto(pub) : '';
    $('hunInfo').textContent = U.modo === 'cpu' ? 'CPU · ' + ['', 'Fácil', 'Normal', 'Difícil'][U.nivel] : U.modo === 'local' ? '2 jugadores · un móvil' : U.modo === 'online' ? '🌐 ' + (window.Sala && window.Sala.sala || 'online') : '';
    marcarCursor(colocando && !esperando ? celdasPropio : (puede && f === 'jugando') ? celdasEnemigo : null);
    if (f === 'fin' && !U.fin) mostrarFin(pub, p);
  }

  /* ---------- teclado: cursor + acciones reasignables ---------- */
  var K = { on: false, i: 0 };
  var TK = window.Teclas.crear({ id: 'hun', ventana: 'winHundir', titulo: 'Hundir la flota', acciones: [
    { id: 'arriba', etiqueta: 'Cursor arriba', def: 'ArrowUp', alt: ['KeyW'] }, { id: 'abajo', etiqueta: 'Cursor abajo', def: 'ArrowDown', alt: ['KeyS'] },
    { id: 'izq', etiqueta: 'Cursor izquierda', def: 'ArrowLeft', alt: ['KeyA'] }, { id: 'der', etiqueta: 'Cursor derecha', def: 'ArrowRight', alt: ['KeyD'] },
    { id: 'accion', etiqueta: 'Colocar / disparar', def: 'Space' }, { id: 'girar', etiqueta: 'Girar barco', def: 'KeyR' },
    { id: 'siguiente', etiqueta: 'Siguiente barco', def: 'KeyE' }, { id: 'aleatorio', etiqueta: 'Aleatorio', def: 'KeyQ' },
    { id: 'borrar', etiqueta: 'Borrar flota', def: 'Backspace' }, { id: 'listo', etiqueta: 'Listo', def: 'Enter' }] });
  window.hunTeclas = TK;
  function marcarCursor(lista) {
    celdasPropio.concat(celdasEnemigo).forEach(function (b) { b.classList.remove('cursor'); });
    if (!lista || !K.on) return;
    if (K.i >= N * N) K.i = 0;
    if (lista[K.i]) lista[K.i].classList.add('cursor');
    if (lista === celdasPropio) previsualizar(K.i);
  }
  function teclaHundir(e) {
    var w = $('winHundir'); if (!w || w.classList.contains('hidden') || !U.modo) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector('.pmCubierta') || $('hunFin').style.display === 'flex') return;
    var om = $('optModal'); if (om && om.classList.contains('show')) return;
    var a = TK.accion(e.code); if (!a) return;
    var pub = publicoActual(), f = fase(pub), col = enColocacion(), p = jugadorVista(pub);
    var dispara = f === 'jugando' && pub.turno === p && !U.bloqueado && !(U.modo === 'online' && !U.online);
    if (!col && !dispara) return;
    e.preventDefault();
    var dr = { arriba: [-1, 0], abajo: [1, 0], izq: [0, -1], der: [0, 1] }[a];
    if (dr) {
      if (!K.on) K.on = true;
      else { var r = Math.floor(K.i / N) + dr[0], c = K.i % N + dr[1]; K.i = Math.max(0, Math.min(N - 1, r)) * N + Math.max(0, Math.min(N - 1, c)); }
      pintar(); return;
    }
    if (e.repeat) return;
    if (a === 'accion') { K.on = true; if (col) clicColocar(K.i); else if (celdasEnemigo[K.i] && !celdasEnemigo[K.i].disabled) clicEnemigo(K.i); return; }
    if (!col) return;
    if (a === 'girar') { U.h = !U.h; K.on = true; pintar(); }
    else if (a === 'siguiente') {
      var n = U.cfg.flota.length;
      for (var k = 1; k <= n; k++) { var j = ((U.sel < 0 ? -1 : U.sel) + k) % n; if (!U.draft[j]) { U.sel = j; break; } }
      pintar();
    }
    else if (a === 'aleatorio') aleatorio();
    else if (a === 'borrar') { U.draft = Array(U.cfg.flota.length).fill(null); U.sel = 0; pintar(); }
    else if (a === 'listo') listo();
  }
  document.addEventListener('keydown', teclaHundir);
  $('hunWrap').addEventListener('pointerdown', function () { if (K.on) { K.on = false; pintar(); } });

  /* ---------- colocación ---------- */
  var previa = -1;
  function previsualizar(i) {
    celdasPropio.forEach(function (b) { b.classList.remove('prevOk', 'prevMal'); });
    previa = i; if (i < 0 || !enColocacion()) return;
    var b = barcoEn(i); if (!b) return;
    var ok = HE.cabeEn(b.barco, resto(U.sel), opcionesRegla().tocar, N);
    HE.celdas(b.barco, N).forEach(function (c) { if (celdasPropio[c]) celdasPropio[c].classList.add(ok ? 'prevOk' : 'prevMal'); });
  }
  function enColocacion() { var pub = publicoActual(); return U.modo && fase(pub) === 'colocando' && !(U.modo === 'online' && pub && pub.listos[U.p]); }
  function resto(sin) { return U.draft.filter(function (b, k) { return b && k !== sin; }); }
  function barcoEn(i) {                                      // barco seleccionado con su casilla «ancla» en la celda i (se ajusta para que quepa)
    if (U.sel == null || U.sel < 0) return null;
    var l = U.cfg.flota[U.sel], r = Math.floor(i / N), c = i % N;
    if (U.h) c = Math.min(c, N - l); else r = Math.min(r, N - l);
    return { barco: { l: l, r: r, c: c, h: U.h } };
  }
  function opcionesRegla() { return U.modo === 'online' ? ((U.pub && U.pub.op) || (U.online && U.online.op) || { tocar: true, repite: false }) : U.op; }
  function clicColocar(i) {
    if (!enColocacion()) return;
    // tocar un barco ya colocado lo recoge
    for (var k = 0; k < U.draft.length; k++) if (U.draft[k] && HE.celdas(U.draft[k], N).indexOf(i) >= 0) { U.sel = k; U.draft[k] = null; U.msg = ''; pintar(); return; }
    if (U.sel == null || U.sel < 0 || U.draft[U.sel]) { var libre = U.draft.findIndex(function (x) { return !x; }); if (libre < 0) return; U.sel = libre; }
    var b = barcoEn(i).barco;
    if (!HE.cabeEn(b, resto(U.sel), opcionesRegla().tocar, N)) { U.msg = '⚠ Ahí no cabe' + (opcionesRegla().tocar ? '' : ' (los barcos no pueden tocarse)') + '.'; vib(30); pintar(); return; }
    U.draft[U.sel] = b; U.msg = '';
    var sig = U.draft.findIndex(function (x) { return !x; }); U.sel = sig < 0 ? -1 : sig;
    pintar();
  }
  function aleatorio() { U.draft = HE.flotaAleatoria(null, opcionesRegla().tocar, U.cfg); U.sel = -1; U.msg = ''; pintar(); }
  function listo() {
    if (U.draft.some(function (x) { return !x; })) return;
    var flota = U.draft.map(function (b) { return { l: b.l, r: b.r, c: b.c, h: !!b.h }; });
    if (!HE.validarFlota(flota, opcionesRegla().tocar, U.cfg)) { U.msg = '⚠ La flota no es válida.'; pintar(); return; }
    U.msg = '';
    if (U.modo === 'cpu') { HE.colocar(U.pt, 0, flota); U.draft = []; empezarDisparos(); return; }
    if (U.modo === 'local') {
      HE.colocar(U.pt, U.actor, flota); U.draft = [];
      if (U.actor === 0) { U.actor = 1; ocultar(); PasarMovil.mostrar({ contenedor: $('hunWrap'), titulo: 'Pasa el móvil a ' + nombre(1), texto: 'Ahora colocará su flota. ¡Sin mirar la pantalla del otro!', boton: 'Soy ' + nombre(1) + ' · Colocar' }).then(function () { nuevoDraft(); pintar(); }); }
      else { ocultar(); U.actor = U.pt.turno; PasarMovil.mostrar({ contenedor: $('hunWrap'), titulo: 'Pasa el móvil a ' + nombre(U.actor), texto: 'Empieza la batalla. Le toca disparar a ' + nombre(U.actor) + '.', boton: 'Soy ' + nombre(U.actor) + ' · Disparar' }).then(function () { empezarDisparos(); }); }
      return;
    }
    if (U.modo === 'online') { U.mia = flota; U.draft = []; U.online.colocar(HE.codificar(flota)); pintar(); }
  }
  function nuevoDraft() { U.draft = Array(U.cfg.flota.length).fill(null); U.sel = 0; U.h = true; U.msg = ''; }
  function ocultar() {                                      // vacía los tableros antes de pasar el móvil (nada que espiar tras la tapa)
    limpiarCeldas(celdasEnemigo); limpiarCeldas(celdasPropio);
    $('hunStatus').textContent = ''; $('hunShips').style.display = 'none'; $('hunBtns').innerHTML = '';
    $('hunEnemyBox').style.display = 'none';
  }

  /* ---------- disparos ---------- */
  function textoRes(r, quien, i) {
    var casilla = LETRAS[Math.floor(i / N)] + (i % N + 1);
    if (r.res === 1) return quien + ' → ' + casilla + ': 💧 agua.';
    if (r.res === 2) return quien + ' → ' + casilla + ': 🔥 ¡tocado!';
    return quien + ' → ' + casilla + ': 💥 ¡hundido! (' + (HE.NOMBRES[r.hundido.length] || 'barco') + ')';
  }
  function empezarDisparos() {
    U.fin = false; U.bloqueado = false; U.ultimo = -1; U.msg = '';
    pintar();
    if (U.modo === 'cpu' && U.pt.turno === 1) turnoCPU();
  }
  function clicEnemigo(i) {
    var pub = publicoActual(); if (!U.modo || !pub || pub.fase !== 'jugando') return;
    var p = jugadorVista(pub);
    if (pub.turno !== p || U.bloqueado) { U.msg = '⏳ No es tu turno.'; pintar(); return; }
    if (U.modo === 'online') { U.ultimo = i; U.online.disparar(i); return; }
    var r = HE.disparar(U.pt, p, i); if (!r) return;
    U.ultimo = i; U.msg = textoRes(r, nombre(p), i); vib(r.res === 1 ? 15 : [0, 30, 30, 30]);
    var pub2 = HE.publico(U.pt);
    if (pub2.fase === 'fin') { pintar(); return; }
    if (U.modo === 'cpu') { pintar(); if (U.pt.turno === 1) turnoCPU(); return; }
    if (U.pt.turno !== p) U.bloqueado = true;               // pasa el turno: el jugador ve el resultado y pasa el móvil
    pintar();
  }
  function turnoCPU() {
    clearTimeout(U.timer);
    U.timer = setTimeout(function () {
      if (U.modo !== 'cpu' || !U.pt || U.pt.fase !== 'jugando' || U.pt.turno !== 1) return;
      var idx = HE.ia(U.nivel, HE.vistaIA(HE.publico(U.pt), 1)), r = HE.disparar(U.pt, 1, idx);
      if (r) { U.ultimo = -1; U.msg = textoRes(r, 'CPU', idx); vib(r.res === 1 ? 10 : [0, 40, 40]); }
      pintar();
      if (U.pt.fase === 'jugando' && U.pt.turno === 1) turnoCPU();
    }, window.hundirRapido ? 15 : 700);
  }
  function pasarTurno() {
    if (U.modo !== 'local' || !U.bloqueado) return;
    var sig = U.pt.turno; ocultar();
    PasarMovil.mostrar({ contenedor: $('hunWrap'), titulo: 'Pasa el móvil a ' + nombre(sig), texto: 'Le toca disparar a ' + nombre(sig) + '.', boton: 'Soy ' + nombre(sig) + ' · Disparar' }).then(function () {
      U.actor = sig; U.bloqueado = false; U.ultimo = -1; U.msg = ''; pintar();
    });
  }
  function rendirse() {
    if (!confirm('¿Rendirte? Perderás la partida.')) return;
    if (U.modo === 'online') { U.online.rendir(); return; }
    var p = jugadorVista(publicoActual()); HE.rendir(U.pt, p); U.msg = ''; pintar();
  }

  /* ---------- fin de partida ---------- */
  function mostrarFin(pub, p) {
    U.fin = true; clearTimeout(U.timer);
    var gano = pub.ganador === p, local = U.modo === 'local';
    $('hunFinT').textContent = local ? '🏆 Gana ' + nombre(pub.ganador) : gano ? '🏆 ¡VICTORIA!' : '💀 DERROTA';
    $('hunFinS').textContent = (pub.rendido ? (gano ? 'Tu rival se ha rendido.' : 'Te has rendido.') : (gano || local ? 'Has hundido toda la flota enemiga.' : 'Han hundido toda tu flota.')) + ' Disparos: ' + pub.shots[0].length + ' · ' + pub.shots[1].length + '.';
    var b = $('hunFinBtn');
    if (U.modo === 'online') { b.textContent = U.online && U.online.host ? '↩ Volver al lobby' : '⏳ Esperando al anfitrión'; b.disabled = !(U.online && U.online.host); }
    else { b.textContent = '▶ JUGAR DE NUEVO'; b.disabled = false; }
    $('hunFin').style.display = 'flex'; vib(gano ? [0, 40, 60, 40, 60, 40] : 200);
  }
  $('hunFinBtn').addEventListener('click', function () {
    $('hunFin').style.display = 'none';
    if (U.modo === 'online') { if (U.online && U.online.host) U.online.lobby(); return; }
    menu();
  });
  $('hunFinVer').addEventListener('click', function () { $('hunFin').style.display = 'none'; });

  /* ---------- menú ---------- */
  function menu() {
    clearTimeout(U.timer); PasarMovil.quitar();
    U.modo = null; U.pt = null; U.pub = null; U.fin = false; U.bloqueado = false; U.draft = []; U.online = null;
    $('hunFin').style.display = 'none'; $('hunMenu').style.display = 'flex'; marcarMenu();
    ocultar(); $('hunOwnBox').style.display = 'none'; $('hunStatus').textContent = ''; $('hunInfo').textContent = '';
  }
  function marcarMenu() {
    pintarConf();
    document.querySelectorAll('#hunMenu [data-nivel]').forEach(function (b) { b.classList.toggle('sel', +b.dataset.nivel === U.nivel); });
    document.querySelectorAll('#hunMenu [data-reg]').forEach(function (b) {
      var valor = b.dataset.reg === 'tocar' ? U.op.tocar : U.op.repite;
      b.classList.toggle('sel', valor === (b.dataset.v === '1'));
    });
  }
  /* ---------- configuración de la partida (tamaño del tablero y flota) ---------- */
  function plantilla(id) { return HE.PLANTILLAS.filter(function (p) { return p.id === id; })[0]; }
  function confActual() { return HE.validarConfig({ n: U.conf.n, flota: flotaDeCuenta(U.conf.cuenta), tocar: U.op.tocar }); }
  (function construirEditor() {
    var ed = $('hunBarcosEd'); if (!ed) return;
    for (var l = HE.L_MIN; l <= HE.L_MAX; l++) {
      var f = document.createElement('span'); f.className = 'hunBe';
      f.innerHTML = '<span class=hunBeL>' + '■'.repeat(l) + '</span><button type=button class=hunOpt data-bl=' + l + ' data-d=-1>−</button><b id=hunBc' + l + '>0</b><button type=button class=hunOpt data-bl=' + l + ' data-d=1>+</button>';
      ed.appendChild(f);
    }
  })();
  function pintarConf() {
    var c = confActual(), pers = U.conf.pl === 'custom', flota = flotaDeCuenta(U.conf.cuenta);
    document.querySelectorAll('#hunMenu [data-plantilla]').forEach(function (b) { b.classList.toggle('sel', b.dataset.plantilla === U.conf.pl); });
    $('hunPers').classList.toggle('show', pers);
    $('hunNval').textContent = U.conf.n + '×' + U.conf.n;
    for (var l = HE.L_MIN; l <= HE.L_MAX; l++) $('hunBc' + l).textContent = U.conf.cuenta[l] || 0;
    $('hunResumen').textContent = U.conf.n + '×' + U.conf.n + ' · ' + flota.length + ' barcos (' + flota.reduce(function (a, x) { return a + x; }, 0) + ' casillas): ' + flota.join(' ');
    $('hunCfgMsg').textContent = c.ok ? '' : '⚠ ' + c.msg;
    document.querySelectorAll('#hunMenu [data-modo="cpu"], #hunMenu [data-modo="local"]').forEach(function (b) { b.disabled = !c.ok; });
  }
  document.querySelectorAll('#hunMenu [data-plantilla]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = b.dataset.plantilla, p = plantilla(id);
      U.conf.pl = id; if (p) { U.conf.n = p.n; U.conf.cuenta = cuentaDeFlota(p.flota); }
      guardarAjustes(); marcarMenu();
    });
  });
  document.querySelectorAll('#hunMenu [data-nstep]').forEach(function (b) {
    b.addEventListener('click', function () { U.conf.n = Math.max(HE.N_MIN, Math.min(HE.N_MAX, U.conf.n + (+b.dataset.nstep))); U.conf.pl = 'custom'; guardarAjustes(); marcarMenu(); });
  });
  $('hunBarcosEd').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-bl]'); if (!b) return;
    var l = +b.dataset.bl; U.conf.cuenta[l] = Math.max(0, Math.min(4, (U.conf.cuenta[l] || 0) + (+b.dataset.d))); U.conf.pl = 'custom'; guardarAjustes(); marcarMenu();
  });
  function empezar(modo) {
    $('hunMenu').style.display = 'none'; $('hunFin').style.display = 'none';
    U.modo = modo; U.fin = false; U.bloqueado = false; U.ultimo = -1; U.msg = ''; U.online = null;
    var turno = Math.random() < 0.5 ? 0 : 1, cf = HE.validarConfig({ n: U.conf.n, flota: flotaDeCuenta(U.conf.cuenta), tocar: U.op.tocar });
    if (!cf.ok) { menu(); return; }
    aplicarCfg(cf);
    U.pt = HE.crear({ tocar: U.op.tocar, repite: U.op.repite, turno: turno, n: cf.n, flota: cf.flota }); nuevoDraft(); U.actor = 0; U.p = 0;
    if (modo === 'cpu') { U.nombres = ['Tú', 'CPU']; HE.colocar(U.pt, 1, HE.flotaAleatoria(null, U.op.tocar, U.cfg)); }
    else U.nombres = ['Jugador 1', 'Jugador 2'];
    $('hunOwnBox').style.display = ''; pintar();
  }
  document.querySelectorAll('#hunMenu [data-modo]').forEach(function (b) {
    b.addEventListener('click', function () {
      var m = b.dataset.modo;
      if (m === 'online') { var c = document.querySelector('[data-conectar=hundir]'); if (c) c.click(); return; }
      empezar(m);
    });
  });
  document.querySelectorAll('#hunMenu [data-nivel]').forEach(function (b) { b.addEventListener('click', function () { U.nivel = +b.dataset.nivel; guardarAjustes(); marcarMenu(); }); });
  document.querySelectorAll('#hunMenu [data-reg]').forEach(function (b) {
    b.addEventListener('click', function () { if (b.dataset.reg === 'tocar') U.op.tocar = b.dataset.v === '1'; else U.op.repite = b.dataset.v === '1'; guardarAjustes(); marcarMenu(); });
  });
  $('hunNewGame').addEventListener('click', function () {
    if (U.modo === 'online') { if (window.Sala) window.Sala.toast('En línea: el anfitrión puede volver al lobby con «↩ Lobby» y cualquiera puede salir de la sala.'); return; }
    menu();
  });

  /* ---------- interfaz para el modo online (la usa js/online/j-hundir.js) ---------- */
  window.Hundir = { online: {
    iniciar: function (cfg) {                               // { p, nombres, host, op, enviar: {colocar, disparar, rendir, lobby} }
      clearTimeout(U.timer); PasarMovil.quitar();
      U.modo = 'online'; U.p = cfg.p; U.nombres = cfg.nombres; U.online = { host: !!cfg.host, op: cfg.op, colocar: cfg.colocar, disparar: cfg.disparar, rendir: cfg.rendir, lobby: cfg.lobby };
      U.pub = cfg.pub || null; U.mia = cfg.flota || null; U.fin = false; U.bloqueado = false; U.ultimo = -1; U.msg = '';
      if (U.pub && U.pub.op) aplicarCfg(U.pub.op);
      nuevoDraft(); $('hunMenu').style.display = 'none'; $('hunFin').style.display = 'none'; $('hunOwnBox').style.display = ''; pintar();
    },
    publico: function (pub) {
      if (U.modo !== 'online') return;
      var antes = U.pub; U.pub = pub; if (pub.op) aplicarCfg(pub.op);
      if (antes && antes.fase === 'fin' && pub.fase !== 'fin') { U.fin = false; $('hunFin').style.display = 'none'; }
      if (antes && pub.shots) {                              // aviso del último disparo rival
        var rival = pub.shots[1 - U.p], previo = antes.shots ? antes.shots[1 - U.p].length : 0;
        if (rival.length > previo) { var s = rival[rival.length - 1]; U.msg = textoRes({ res: s[1], hundido: s[1] === 3 ? (pub.hund[1 - U.p].slice(-1)[0] || []) : null }, nombre(1 - U.p), s[0]); vib(s[1] === 1 ? 10 : [0, 40, 40]); }
        var mio = pub.shots[U.p]; if (mio.length > (antes.shots ? antes.shots[U.p].length : 0)) { var t = mio[mio.length - 1]; U.ultimo = t[0]; U.msg = textoRes({ res: t[1], hundido: t[1] === 3 ? (pub.hund[U.p].slice(-1)[0] || []) : null }, 'Tú', t[0]); }
      }
      pintar();
    },
    flota: function (f) { U.mia = f; pintar(); },
    salir: function () { if (U.modo === 'online') menu(); },
    activo: function () { return U.modo === 'online'; }
  } };

  /* ---------- ventana ---------- */
  function iniciarTableros() {
    construir($('hunEnemy'), celdasEnemigo, clicEnemigo);
    construir($('hunOwn'), celdasPropio, clicColocar, previsualizar);
  }
  /* fija tablero y flota de la partida; si cambia el tamaño se reconstruyen las dos cuadrículas */
  function aplicarCfg(c) {
    var n = c.n || 10, flota = (c.flota || HE.LONGS).slice().sort(function (a, b) { return b - a; });
    U.cfg = { n: n, flota: flota };
    if (n !== N) { N = n; iniciarTableros(); }
  }
  iniciarTableros();
  window.initHundir = function () { if (!U.modo) menu(); };
  window.hundirStartNew = menu;
  window.pauseHundir = function () { /* la partida espera: no hay reloj */ };
  /* solo lectura / pruebas */
  window.hundirEstado = function () { return { modo: U.modo, actor: U.actor, p: U.p, fase: fase(publicoActual()), draft: U.draft.slice(), pt: U.pt && JSON.parse(JSON.stringify(U.pt)), bloqueado: U.bloqueado, nivel: U.nivel }; };
})();

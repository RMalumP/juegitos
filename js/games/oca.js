/* js/games/oca.js — Juegos XP: Juego de la Oca de 2 a 4 jugadores, con 1 o 2 dados. Motor: js/online/oca-engine.js (sin DOM, con tests).
   Mezcla de los dos juegos de la oca que nos pasaron: el tablero en espiral, la CPU, los dichos y el registro de jugadas de uno, y los dados
   con cubilete y el turno por colores del otro. Modos: local (cada asiento es una persona o la CPU; todos ven el mismo tablero, así que no hace
   falta pasar el móvil a escondidas) y online (js/online/j-oca.js → Oca.online: el anfitrión tira los dados por todos y juega por las CPU).
   La ficha avanza casilla a casilla y luego salta (oca, puente, dados, laberinto, calavera). 💾 Guardar la partida local (js/partida.js). */
(function () {
  'use strict';
  var O = window.OcaEngine;
  var $ = function (id) { return document.getElementById(id); };
  var raiz = $('ocaWrap');
  var COLS = 7, FILAS = 9;                                                 // 63 casillas en espiral (vertical, para el móvil)
  var COLORES = [['#e53935', 'Rojo'], ['#1e88e5', 'Azul'], ['#fdd835', 'Amarillo'], ['#43a047', 'Verde']];
  var TIPOS = { cpu: '🤖 CPU', per: '👤 Persona', no: '— Nadie' };
  var ICONOS = { salida: '🚩', jardin: '🏆', puente: '🌉', dados: '🎲', posada: '🏨', pozo: '🕳️', laberinto: '🌀', carcel: '⛓️', calavera: '💀' };
  var ESTADO_ICO = { posada: '🏨', pozo: '🕳️', carcel: '⛓️' };
  var OCA_SVG = '<svg viewBox="0 0 24 24" aria-hidden=true><path d="M7 18.5c-3.2 0-4.6-2.6-3.3-5 1.3-2.3 4.9-2.1 7.8-1.6 1.6.3 2.8-.5 2.8-2.2V6.4C14.3 4.4 15.8 3 17.4 3S20 4.2 20 5.6c0 1-.6 1.6-1.4 2-.7.4-1.1 1-1.1 1.9v2.8c0 4.2-3.8 6.2-8.2 6.2z" fill=#fff stroke=#333 stroke-width=1.2 stroke-linejoin=round /><path d="M19.7 4.7l3 1.2-3 .9z" fill=#f39c12 stroke=#a35a00 stroke-width=.5 /><circle cx=17.7 cy=5 r=.75 fill=#111 /><path d="M6.5 14.6c2 .5 4.3.2 5.6-1" fill=none stroke=#888 stroke-width=1 stroke-linecap=round /><path d="M8.5 18.5v3h-1.6M11.5 18.5v3h-1.6" fill=none stroke=#f39c12 stroke-width=1.2 stroke-linecap=round /></svg>';
  var PUNTOS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  var HUECO = [[0.29, 0.33], [0.71, 0.33], [0.29, 0.74], [0.71, 0.74]];    // sitio de cada ficha dentro de la casilla
  var CONF0 = { asientos: ['tu', 'cpu', 'no', 'no'], dados: 1, oca59: 'rebota' };
  var U = { modo: null, conf: null, jug: [], est: null, vista: null, vis: [], visNj: 0, cola: [], anim: false, animT: [], timer: null, pausa: false, online: null, p: -1, finVisto: '', eraMio: false, hist: false };
  try { U.conf = JSON.parse(localStorage.getItem('ocaConf')); } catch (e) { U.conf = null; }
  if (!U.conf || !Array.isArray(U.conf.asientos) || U.conf.asientos.length !== 4) U.conf = JSON.parse(JSON.stringify(CONF0));
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }
  function rapido() { return !!window.ocaRapido; }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* coordenadas de cada casilla: espiral desde la esquina de abajo a la izquierda hacia el centro */
  var POS = [null];
  (function () {
    var arriba = 0, abajo = FILAS - 1, izq = 0, der = COLS - 1, k, r;
    function poner(f, c) { POS.push({ f: f, c: c }); }
    while (arriba <= abajo && izq <= der) {
      for (k = izq; k <= der; k++) poner(abajo, k); abajo--;
      for (r = abajo; r >= arriba; r--) poner(r, der); der--;
      if (arriba <= abajo) { for (k = der; k >= izq; k--) poner(arriba, k); arriba++; }
      if (izq <= der) { for (r = arriba; r <= abajo; r++) poner(r, izq); izq++; }
    }
  })();

  raiz.classList.add('ocWrap');
  raiz.innerHTML = '<div class=ocHeader><span class=ocTit>JUEGO DE LA OCA</span><span class=ocInfo></span></div>' +
    '<div class=ocJugs></div><div class=ocZona><div class=ocTablero></div></div>' +
    '<div class=ocPie><div class=ocUlt></div><div class=ocFila><div class=ocDados></div><button type=button class=ocTirar>🎲 Tirar</button><button type=button class=ocVerHist title="Historial de jugadas" aria-label="Historial de jugadas">📜</button></div><div class=ocEstado></div></div>' +
    '<div class=ocHist><div class=ocHistCab><b>📜 Jugadas</b><button type=button class=ocOpt data-r=cerrarHist>✕</button></div><ol></ol></div>' +
    '<div class=ocMenu><h1>' + OCA_SVG + ' JUEGO DE LA OCA</h1><div class=ocSub>De 2 a 4 jugadores. Tira los dados y llega la primera a la casilla 63 con la cuenta exacta. «De oca a oca y tiro porque me toca».</div>' +
    '<div class=ocAsientos></div>' +
    '<div class=ocRow data-k=dados>Dados:<button class=ocOpt data-v=1>1 dado</button><button class=ocOpt data-v=2>2 dados</button></div>' +
    '<div class=ocRow data-k=oca59>Oca 59:<button class=ocOpt data-v=rebota>Pasa a la 63 y retrocede</button><button class=ocOpt data-v=gana>Gana</button></div>' +
    '<button class=ocBig data-r=jugar>▶ Jugar</button><button class=ocBig data-r=online>🌐 Online · 2 a 4 (con CPU)</button>' +
    '<button class=ocOpt data-r=reglas>📖 Reglas</button><div class=ocReglas></div></div>' +
    '<div class=ocFin><h1></h1><div class=ocSub></div><div class=ocPuestos></div><div class=ocBtns><button class=ocBig data-r=otra></button><button class=ocOpt data-r=menu>Menú</button><button class=ocOpt data-r=ver>Ver el tablero</button></div></div>';
  var q = function (s) { return raiz.querySelector(s); };
  q('.ocReglas').innerHTML = '<ul>' + [
    '<b>Oca</b> (5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54 y 59): a la siguiente oca y vuelves a tirar. Desde la 59 pasas a la 63 y tiras para retroceder lo que saques (o, si lo eliges, ganas).',
    '<b>Puente</b> (6 y 12) y <b>dados</b> (26 y 53): al otro y vuelves a tirar.',
    '<b>Posada</b> (19): pierdes 1 turno. <b>Cárcel</b> (52): pierdes 2.',
    '<b>Pozo</b> (31): no tiras hasta que otro caiga en él o pasen 3 turnos.',
    '<b>Laberinto</b> (42): vuelves a la 30. <b>Calavera</b> (58): a la salida.',
    '<b>63</b>: hay que llegar justo; lo que sobre, se retrocede.',
    '<b>Con 2 dados</b>: un 9 en la primera tirada lleva a los dados (5 y 4 → 53, 6 y 3 → 26) y se vuelve a tirar. Desde la casilla 60 se tira con un solo dado.'
  ].map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';

  /* ---------- tablero ---------- */
  var tablero = q('.ocTablero'), fichas = [];
  (function () {
    for (var c = 1; c <= O.FINAL; c++) {
      var t = O.tipo(c), d = document.createElement('div'), p = POS[c];
      d.className = 'ocC' + (t ? ' t-' + t : '') + (c % 2 ? '' : ' par');
      d.style.gridRow = p.f + 1; d.style.gridColumn = p.c + 1;
      d.innerHTML = '<span class=ocN>' + c + '</span>' + (t === 'oca' ? '<span class="ocI oca">' + OCA_SVG + '</span>' : ICONOS[t] ? '<span class=ocI>' + ICONOS[t] + '</span>' : '');
      d.title = c + (t ? ' · ' + O.NOMBRES[t] : '');
      tablero.appendChild(d);
    }
    var s = document.createElement('div'); s.className = 'ocC t-salida ocSalida'; s.style.gridRow = FILAS + 1; s.style.gridColumn = '1 / ' + (COLS + 1);
    s.innerHTML = '<span class=ocI>🚩</span><span class=ocSalTxt>SALIDA</span>'; tablero.appendChild(s);
    for (var i = 0; i < 4; i++) { var f = document.createElement('div'); f.className = 'ocFicha'; f.style.background = COLORES[i][0]; f.style.display = 'none'; tablero.appendChild(f); fichas.push(f); }
  })();
  function medir() {                                                       // la casilla más grande que quepa (7 × 10 con la salida)
    var z = q('.ocZona'), W = z.clientWidth - 6, H = z.clientHeight - 6;
    var u = Math.max(18, Math.floor(Math.min(W / COLS, H / (FILAS + 1))));
    tablero.style.width = u * COLS + 'px'; tablero.style.height = u * (FILAS + 1) + 'px'; tablero.style.setProperty('--u', u + 'px');
  }
  function centro(c, i, n) {                                               // posición (en %) de la ficha i en la casilla c
    if (c <= 0) { var x = (COLS - n) / 2 + i + 0.5; return [x / COLS * 100, (FILAS + 0.5) / (FILAS + 1) * 100]; }
    var p = POS[c], h = HUECO[i];
    return [(p.c + h[0]) / COLS * 100, (p.f + h[1]) / (FILAS + 1) * 100];
  }
  function pintarFichas(e) {
    fichas.forEach(function (f, i) {
      if (!e || i >= e.n) { f.style.display = 'none'; return; }
      var xy = centro(U.vis[i] || 0, i, e.n);
      f.style.display = ''; f.style.left = xy[0] + '%'; f.style.top = xy[1] + '%';
      f.classList.toggle('turno', e.fase === 'jugando' && e.turno === i && !U.anim);
      f.classList.toggle('meta', e.fase === 'fin' && e.ganador === i);
      f.textContent = esCpu(i) ? '🤖' : '';
    });
  }

  /* ---------- datos de la partida ---------- */
  function vista() { return U.vista; }
  function nombre(i) { return (U.jug[i] && U.jug[i].nombre) || COLORES[i][1]; }
  function esCpu(i) { return !!(U.jug[i] && U.jug[i].cpu); }
  function humanosLocales() { return U.jug.filter(function (j) { return !j.cpu; }).length; }
  function miTurno() {
    var e = vista(); if (!e || e.fase !== 'jugando' || U.anim || U.cola.length) return false;
    if (U.modo === 'online') return e.turno === U.p;
    return U.modo === 'local' && !esCpu(e.turno);
  }
  function tu(i) { return (U.modo === 'online' && i === U.p) || (U.modo === 'local' && humanosLocales() === 1 && !esCpu(i)); }

  /* ---------- pintar ---------- */
  function pintar() {
    var e = vista();
    q('.ocInfo').textContent = !U.modo || !e ? '' : (U.modo === 'online' ? '🌐 ' + ((window.Sala && window.Sala.sala) || 'online') + ' · ' : '') + (e.dados === 2 ? '2 dados' : '1 dado');
    pintarJugs(e); pintarFichas(e); pintarPie(e);
    if (e && e.fase === 'fin' && !U.anim) mostrarFin(e); else q('.ocFin').style.display = 'none';
    if (U.hist) pintarHist(e);
  }
  function pintarJugs(e) {
    var r = q('.ocJugs'); r.innerHTML = '';
    if (!e) return;
    for (var i = 0; i < e.n; i++) {
      var c = document.createElement('div'), est = e.espera[i] > 0 ? ESTADO_ICO[e.motivo[i]] + ' ' + e.espera[i] : e.meta[i] ? '⤺' : '';
      c.className = 'ocJug' + (e.fase === 'jugando' && e.turno === i ? ' turno' : '') + (e.fase === 'fin' && e.ganador === i ? ' gana' : '');
      c.style.setProperty('--col', COLORES[i][0]);
      c.innerHTML = '<i></i><span class=ocJN>' + (esCpu(i) ? '🤖 ' : '') + esc(nombre(i)) + (U.modo === 'online' && i === U.p ? ' (tú)' : '') + '</span><b>' + (U.vis[i] ? U.vis[i] : '🚩') + '</b>' + (est ? '<span class=ocJE title="Turnos sin tirar">' + est + '</span>' : '');
      r.appendChild(c);
    }
  }
  function dado(v) {
    var d = document.createElement('span'); d.className = 'ocDado';
    for (var i = 0; i < 9; i++) { var p = document.createElement('i'); if (v && PUNTOS[v].indexOf(i) >= 0) p.className = 'p'; d.appendChild(p); }
    d.setAttribute('aria-label', v ? 'Dado: ' + v : 'Dado');
    return d;
  }
  function pintarDados(vals) { var c = q('.ocDados'); c.innerHTML = ''; vals.forEach(function (v) { c.appendChild(dado(v)); }); }
  function pintarPie(e) {
    var b = q('.ocTirar'), est = q('.ocEstado'), ult = q('.ocUlt');
    if (!e) { b.disabled = true; est.textContent = ''; ult.innerHTML = ''; return; }
    var mio = miTurno(); b.disabled = !mio;
    if (mio && !U.eraMio && !U.anim) vib([30, 40, 30]);
    U.eraMio = mio;
    var nd = O.numDados(e, e.turno);
    if (!U.anim) pintarDados(e.ultimo && e.ultimo.dados.length === nd ? e.ultimo.dados : nd === 2 ? [0, 0] : [0]);
    b.textContent = '🎲 Tirar' + (nd === 2 ? ' los dados' : ' el dado');
    var t = e.turno, txt = '';
    if (e.fase === 'fin') txt = q('.ocFin').style.display === 'none' && !U.anim ? '👆 Toca aquí para ver el resultado' : '';
    else if (U.anim) txt = '';
    else if (mio) txt = (U.modo === 'local' && humanosLocales() > 1 ? '👉 Tira ' + nombre(t) : '👉 Tu turno') + (e.ultimo && e.ultimo.p === t && e.ultimo.otra ? ': ¡vuelves a tirar!' : '') + (e.meta[t] ? ' (retrocedes lo que saques)' : '');
    else txt = (esCpu(t) ? '🤖 Tira ' : '⏳ Le toca a ') + nombre(t) + '…';
    est.textContent = txt; est.style.setProperty('--col', COLORES[t][0]);
    var u = e.ultimo;
    if (u && !U.anim) {
      var h = '<span class=ocQuien style="--col:' + COLORES[u.p][0] + '"><i></i>' + esc(tu(u.p) ? 'Tú' : nombre(u.p)) + '</span> ' + esc(u.txt);
      if (O.DICHOS[u.tipo] && u.tipo !== 'jardin') h += '<em>«' + O.DICHOS[u.tipo] + '»</em>';
      if (u.saltos.some(function (s) { return s.tipo === 'pozo' && s.libres.length; })) h += '<span class=ocPasa>🪢 Sale del pozo: ' + u.saltos[0].libres.map(function (x) { return esc(nombre(x)); }).join(', ') + '</span>';
      u.pasan.forEach(function (x) { h += '<span class=ocPasa>' + ESTADO_ICO[x.motivo] + ' ' + esc(nombre(x.p)) + ' pierde el turno</span>'; });
      ult.innerHTML = h;
    } else if (!u) ult.innerHTML = '<span class=ocPasa>Empieza ' + esc(nombre(e.turno)) + '</span>';
  }
  function pintarHist(e) {
    var ol = q('.ocHist ol'); ol.innerHTML = '';
    ((e && e.hist) || []).forEach(function (h) {
      var li = document.createElement('li'); li.style.setProperty('--col', COLORES[h.p][0]);
      li.innerHTML = '<i></i><b>' + esc(nombre(h.p)) + '</b> ' + esc(h.t); ol.appendChild(li);
    });
  }
  q('.ocVerHist').addEventListener('click', function () { U.hist = !U.hist; q('.ocHist').style.display = U.hist ? 'flex' : 'none'; if (U.hist) pintarHist(vista()); });
  q('[data-r=cerrarHist]').addEventListener('click', function () { U.hist = false; q('.ocHist').style.display = 'none'; });

  /* ---------- animación: dados, casilla a casilla y saltos ---------- */
  function tras(ms, fn) { U.animT.push(setTimeout(fn, ms)); }
  function pararAnim() { U.animT.forEach(clearTimeout); U.animT = []; U.anim = false; U.cola = []; }
  function recibir(e) { U.cola.push(O.copiar(e)); if (!U.anim) siguiente(); }
  function siguiente() {
    var e = U.cola.shift(); if (!e) { U.anim = false; pintar(); avanzar(); return; }
    var u = e.ultimo, anterior = U.vista;
    U.vista = e;
    if (!u || u.nj !== U.visNj + 1 || rapido() || !anterior) { U.vis = e.pos.slice(); U.visNj = e.nj; siguiente(); return; }
    U.anim = true; pintar();
    var p = u.p, t = 0, PASO = 150;
    for (var k = 0; k < 6; k++) tras(t += 70, function () { pintarDados(u.dados.map(function () { return 1 + Math.floor(Math.random() * 6); })); });
    tras(t += 70, function () { pintarDados(u.dados); q('.ocDados').classList.add('ya'); vib(12); });
    t += 250;
    u.camino.forEach(function (c) { tras(t += PASO, function () { U.vis[p] = c; pintarFichas(e); pintarJugs(e); }); });
    u.saltos.forEach(function (s) {
      if (s.tipo === 'pozo') return;
      tras(t += 380, function () { fichas[p].classList.add('salta'); U.vis[p] = s.a; pintarFichas(e); pintarJugs(e); vib(20); });
      t += 420;
    });
    tras(t += 300, function () { fichas[p].classList.remove('salta'); q('.ocDados').classList.remove('ya'); U.vis = e.pos.slice(); U.visNj = e.nj; siguiente(); });
  }

  /* ---------- jugar ---------- */
  function tirar() {
    if (!miTurno()) return;
    if (U.modo === 'online') { q('.ocTirar').disabled = true; U.online.tirar(); return; }   // el anfitrión contesta enseguida con la tirada
    if (O.tirar(U.est, U.est.turno)) { vib(10); recibir(U.est); }
  }
  q('.ocTirar').addEventListener('click', tirar);
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== ' ' && ev.key !== 'Enter') return;
    var w = $('winOca'); if (!w || w.classList.contains('hidden') || !w.offsetParent) return;
    var a = document.activeElement; if (a && (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(a.tagName) || a.isContentEditable)) return;
    if (miTurno()) { ev.preventDefault(); tirar(); }
  });
  /* local: tirada de la CPU */
  function avanzar() {
    clearTimeout(U.timer);
    if (U.modo !== 'local' || !U.est || U.pausa || U.anim) return;
    var e = U.est;
    if (e.fase !== 'jugando' || !esCpu(e.turno)) return;
    U.timer = setTimeout(function () {
      if (U.modo !== 'local' || U.est !== e || e.fase !== 'jugando' || !esCpu(e.turno) || U.pausa || U.anim) return;
      O.tirar(e, e.turno); recibir(e);
    }, rapido() ? 5 : 700);
  }

  /* ---------- final ---------- */
  function mostrarFin(e) {
    var clave = e.nj + ':' + e.ganador, f = q('.ocFin');
    if (U.finVisto !== clave) {
      U.finVisto = clave; clearTimeout(U.timer);
      if (U.modo === 'local' && window.Partida) window.Partida.borrar('oca');
      f.style.display = 'flex'; f.dataset.oculto = ''; vib(tu(e.ganador) || U.modo === 'local' && !esCpu(e.ganador) ? [0, 40, 60, 40, 60, 80] : 60);
    } else if (f.dataset.oculto === clave) return;
    f.style.display = 'flex';
    f.querySelector('h1').textContent = '🏆 ' + (tu(e.ganador) ? '¡Has ganado!' : '¡Gana ' + nombre(e.ganador) + '!');
    f.querySelector('.ocSub').textContent = '«' + O.DICHOS.jardin + '»';
    var orden = []; for (var i = 0; i < e.n; i++) orden.push(i);
    orden.sort(function (a, b) { return (b === e.ganador) - (a === e.ganador) || e.pos[b] - e.pos[a]; });
    var c = f.querySelector('.ocPuestos'); c.innerHTML = '';
    orden.forEach(function (j, k) {
      var r = document.createElement('div'); r.className = 'ocPuesto' + (j === e.ganador ? ' gana' : ''); r.style.setProperty('--col', COLORES[j][0]);
      r.innerHTML = '<span>' + (k + 1) + '.º</span><i></i><b>' + esc(nombre(j)) + '</b><span>' + (j === e.ganador ? 'casilla 63' : e.pos[j] ? 'casilla ' + e.pos[j] : 'en la salida') + ' · ' + e.tiros[j] + ' tiradas</span>';
      c.appendChild(r);
    });
    var b = f.querySelector('[data-r=otra]'), mn = f.querySelector('[data-r=menu]');
    if (U.modo === 'online') { var host = U.online && U.online.host; b.textContent = host ? '↩ Volver al lobby' : '⏳ Esperando al anfitrión'; b.disabled = !host; mn.style.display = 'none'; }
    else { b.textContent = '▶ Otra partida'; b.disabled = false; mn.style.display = ''; }
  }
  q('.ocFin [data-r=otra]').addEventListener('click', function () {
    if (U.modo === 'online') { if (U.online && U.online.host) U.online.lobby(); return; }
    empezar();
  });
  q('.ocFin [data-r=menu]').addEventListener('click', menu);
  q('.ocFin [data-r=ver]').addEventListener('click', function () { var f = q('.ocFin'); f.style.display = 'none'; f.dataset.oculto = U.finVisto; pintar(); });
  q('.ocEstado').addEventListener('click', function () { var e = vista(); if (e && e.fase === 'fin' && !U.anim) { q('.ocFin').dataset.oculto = ''; mostrarFin(e); } });

  /* ---------- menú y partida local ---------- */
  function guardarConf() { try { localStorage.setItem('ocaConf', JSON.stringify(U.conf)); } catch (e) { /* sin almacenamiento */ } }
  function boton(txt, fn, cls) { var b = document.createElement('button'); b.type = 'button'; b.className = cls || 'ocOpt'; b.textContent = txt; b.addEventListener('click', fn); return b; }
  function pintarMenu() {
    var a = q('.ocAsientos'); a.innerHTML = '';
    U.conf.asientos.forEach(function (t, i) {
      var r = document.createElement('div'); r.className = 'ocRow';
      var et = document.createElement('span'); et.className = 'ocAs'; et.style.setProperty('--col', COLORES[i][0]); et.innerHTML = '<i></i>' + COLORES[i][1] + ':'; r.appendChild(et);
      if (i === 0) { r.appendChild(Object.assign(document.createElement('span'), { className: 'ocOpt sel', textContent: '👤 Tú' })); a.appendChild(r); return; }
      ['cpu', 'per', 'no'].forEach(function (k) {
        if (k === 'no' && i === 1) return;                                // al menos 2 jugadores
        var b = boton(TIPOS[k], function () { U.conf.asientos[i] = k; guardarConf(); pintarMenu(); }, 'ocOpt' + (t === k ? ' sel' : ''));
        b.dataset.asiento = i; b.dataset.tipo = k; r.appendChild(b);
      });
      a.appendChild(r);
    });
    raiz.querySelectorAll('.ocMenu [data-k]').forEach(function (row) {
      var v = String(U.conf[row.dataset.k]);
      row.querySelectorAll('[data-v]').forEach(function (b) { b.classList.toggle('sel', b.dataset.v === v); });
    });
  }
  raiz.querySelectorAll('.ocMenu [data-k]').forEach(function (row) {
    row.querySelectorAll('[data-v]').forEach(function (b) {
      b.addEventListener('click', function () { var k = row.dataset.k; U.conf[k] = k === 'dados' ? +b.dataset.v : b.dataset.v; guardarConf(); pintarMenu(); });
    });
  });
  q('.ocMenu [data-r=jugar]').addEventListener('click', function () { empezar(); });
  q('.ocMenu [data-r=online]').addEventListener('click', function () { var c = document.querySelector('[data-conectar=oca]'); if (c) c.click(); });
  q('.ocMenu [data-r=reglas]').addEventListener('click', function () { q('.ocReglas').classList.toggle('on'); });
  function jugadoresDeConf() {
    var personas = 0, nc = 0, out = [];
    U.conf.asientos.forEach(function (t) { if (t === 'tu' || t === 'per') personas++; });
    U.conf.asientos.forEach(function (t) {
      if (t === 'no') return;
      if (t === 'cpu') { nc++; out.push({ nombre: 'CPU ' + nc, cpu: true }); return; }
      out.push({ nombre: personas === 1 ? 'Tú' : COLORES[out.length][1], cpu: false });
    });
    return out;
  }
  function limpiar() { clearTimeout(U.timer); pararAnim(); U.vista = null; U.vis = []; U.visNj = 0; U.finVisto = ''; U.eraMio = false; U.hist = false; q('.ocHist').style.display = 'none'; }
  function empezar() {
    if (window.Partida) window.Partida.borrar('oca');
    limpiar();
    U.modo = 'local'; U.online = null; U.p = -1;
    U.jug = jugadoresDeConf();
    U.est = O.crear({ n: U.jug.length, dados: U.conf.dados, oca59: U.conf.oca59 });
    q('.ocMenu').style.display = 'none'; q('.ocFin').style.display = 'none'; medir(); recibir(U.est);
  }
  function menu() {
    limpiar();
    U.modo = null; U.est = null; U.online = null; U.jug = [];
    q('.ocFin').style.display = 'none'; q('.ocMenu').style.display = 'flex'; q('.ocReglas').classList.remove('on'); pintarMenu(); pintar();
  }
  function guardarPartida() {
    if (!window.Partida) return;
    if (U.modo === 'online') { window.Partida.aviso('Una partida online no se puede guardar'); return; }
    if (U.modo !== 'local' || !U.est || U.est.fase === 'fin') { window.Partida.aviso('No hay ninguna partida en curso'); return; }
    window.Partida.guardar('oca', { est: O.copiar(U.est), jug: U.jug });
    window.Partida.aviso('💾 Partida guardada');
  }
  function restaurar() {
    var d = window.Partida && window.Partida.tomar('oca'), est = d && O.restaurar(d.est);
    if (!est || !Array.isArray(d.jug) || d.jug.length !== est.n) return false;
    limpiar(); U.modo = 'local'; U.online = null; U.est = est; U.jug = d.jug; U.p = -1;
    q('.ocMenu').style.display = 'none'; medir(); recibir(U.est);
    return true;
  }
  $('ocaNewGame').addEventListener('click', function () {
    if (U.modo === 'online') { if (window.Sala) window.Sala.toast('En línea: el anfitrión puede volver al lobby con «↩ Lobby» y cualquiera puede salir de la sala.'); return; }
    if (window.Partida) window.Partida.borrar('oca');
    menu();
  });
  $('ocaSave').addEventListener('click', guardarPartida);
  var reT = null; window.addEventListener('resize', function () { clearTimeout(reT); reT = setTimeout(medir, 100); });
  if (window.ResizeObserver) new ResizeObserver(function () { medir(); }).observe(q('.ocZona'));   // el pie cambia de alto según el texto de la jugada

  /* ---------- interfaz para el adaptador online (js/online/j-oca.js) ---------- */
  window.Oca = { online: {
    iniciar: function (c) {                                               // { p, jug:[{nombre,cpu}], host, pub, tirar, lobby }
      limpiar();
      U.modo = 'online'; U.est = null; U.p = c.p; U.jug = c.jug;
      U.online = { host: !!c.host, tirar: c.tirar, lobby: c.lobby };
      q('.ocMenu').style.display = 'none'; q('.ocFin').style.display = 'none'; medir();
      if (c.pub) recibir(c.pub); else pintar();
    },
    publico: function (p) {
      if (U.modo !== 'online' || !p) return;
      var ult = U.cola.length ? U.cola[U.cola.length - 1] : U.vista;
      if (ult && ult.nj === p.nj) return;                                // repetido
      recibir(p);
    },
    salir: function () { if (U.modo === 'online') menu(); },
    activo: function () { return U.modo === 'online'; }
  } };
  window.initOca = function () { if (!U.modo && !restaurar()) menu(); medir(); };
  window.pauseOca = function () { U.pausa = true; clearTimeout(U.timer); };
  window.resumeOca = function () { U.pausa = false; medir(); if (U.modo) pintar(); avanzar(); };
  window.ocaEstado = function () { var e = vista(); return { modo: U.modo, p: U.p, anim: U.anim || U.cola.length > 0, vista: e && O.copiar(e), vis: U.vis.slice(), jug: U.jug, est: U.est && O.copiar(U.est) }; };
  menu();
})();

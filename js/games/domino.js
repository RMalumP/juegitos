/* js/games/domino.js — Juegos XP: Dominó (doble seis) de 2 a 4 jugadores. Motor: js/online/domino-engine.js (sin DOM, con tests).
   Modos: local (cada asiento es una persona o la CPU; con varias personas en el móvil sale «Pasa el móvil» para que nadie vea la mano ajena)
   y online (js/online/j-domino.js → Domino.online: el anfitrión es el árbitro y puede sentar hasta 2 CPU). Partida a 1 mano, 50 o 100 puntos;
   con 4 jugadores, por parejas (1.º y 3.º contra 2.º y 4.º). 💾 Guardar la partida local (js/partida.js) y récord de la mejor mano (js/records.js). */
(function () {
  'use strict';
  var D = window.DominoEngine;
  var $ = function (id) { return document.getElementById(id); };
  var raiz = $('dominoWrap');
  var NIVELES = ['', 'Fácil', 'Normal'], METAS = [[0, '1 mano'], [50, 'A 50'], [100, 'A 100']], TIPOS = { cpu: '🤖 CPU', per: '👤 Persona', no: '— Nadie' };
  var CONF0 = { asientos: ['tu', 'cpu', 'cpu', 'cpu'], parejas: true, meta: 50, nivel: 2 };
  var U = { modo: null, conf: null, jug: [], est: null, pub: null, mano: [], p: 0, vistaP: 0, sel: -1, timer: null, finVisto: '', recVisto: '', online: null, pausa: false, eraMio: false };
  try { U.conf = JSON.parse(localStorage.getItem('domConf')); } catch (e) { U.conf = null; }
  if (!U.conf || !Array.isArray(U.conf.asientos) || U.conf.asientos.length !== 4) U.conf = JSON.parse(JSON.stringify(CONF0));
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }
  function rapido() { return window.dominoRapido ? 10 : 0; }

  raiz.classList.add('doWrap');
  raiz.innerHTML = '<div class=doHeader><span class=doTit>DOMINÓ</span><span class=doInfo></span></div>' +
    '<div class=doRivales></div><div class=doMesa></div>' +
    '<div class=doPie><div class=doEstado></div><div class=doAcc></div><div class=doMano></div></div>' +
    '<div class=doMenu><h1>DOMINÓ</h1><div class=doSub>Doble seis, de 2 a 4 jugadores. Pon fichas que casen con un extremo de la mesa; si no puedes, robas (con menos de 4) o pasas. Gana quien se queda sin fichas o, si se cierra, quien menos puntos tiene.</div>' +
    '<div class=doAsientos></div>' +
    '<div class=doRow data-k=parejas>Con 4, por parejas:<button class=doOpt data-v=1>Sí</button><button class=doOpt data-v=0>No</button></div>' +
    '<div class=doRow data-k=meta>Partida:' + METAS.map(function (m) { return '<button class=doOpt data-v=' + m[0] + '>' + m[1] + '</button>'; }).join('') + '</div>' +
    '<div class=doRow data-k=nivel>CPU:<button class=doOpt data-v=1>Fácil</button><button class=doOpt data-v=2>Normal</button></div>' +
    '<button class=doBig data-r=jugar>▶ Jugar</button><button class=doBig data-r=online>🌐 Online · 2 a 4 (hasta 2 CPU)</button><div class=doRec></div></div>' +
    '<div class=doFin><h1></h1><div class=doSub></div><div class=doCuentas></div><div class=doBtns><button class=doBig data-r=otra></button><button class=doOpt data-r=menu>Menú</button><button class=doOpt data-r=ver>Ver la mesa</button></div></div>';
  var q = function (s) { return raiz.querySelector(s); };

  /* ---------- fichas ---------- */
  var PUNTOS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }, SEIS_H = [0, 1, 2, 6, 7, 8];
  function mitad(v, horiz) {
    var m = document.createElement('span'); m.className = 'doM';
    var pts = v === 6 && horiz ? SEIS_H : PUNTOS[v];
    for (var i = 0; i < 9; i++) { var c = document.createElement('i'); if (pts.indexOf(i) >= 0) c.className = 'p'; m.appendChild(c); }
    return m;
  }
  function ficha(a, b, horiz, tag) {
    var f = document.createElement(tag || 'span'); f.className = 'doF ' + (horiz ? 'h' : 'v');
    if (tag === 'button') f.type = 'button';
    f.appendChild(mitad(a, horiz)); f.appendChild(mitad(b, horiz));
    f.setAttribute('aria-label', a + ' y ' + b);
    return f;
  }

  /* ---------- datos de la partida (local u online) ---------- */
  function pub() { return U.modo === 'online' ? U.pub : (U.est ? D.publico(U.est) : null); }
  function nombre(i) { return (U.jug[i] && U.jug[i].nombre) || 'Jugador ' + (i + 1); }
  function esCpu(i) { return !!(U.jug[i] && U.jug[i].cpu); }
  function humanosLocales() { return U.jug.filter(function (j) { return !j.cpu; }).length; }
  function manoDe(p) { return (U.modo === 'online' ? (p === U.p ? U.mano : null) : (U.est ? U.est.manos[p] : null)) || []; }
  function estadoPara(p) { return U.modo === 'online' ? D.desdePublico(U.pub, U.p, U.mano) : U.est; }
  function yo() { return U.modo === 'online' ? U.p : U.vistaP; }
  function miTurno() { var e = pub(); return !!e && e.fase === 'jugando' && e.turno === yo() && yo() >= 0 && !esCpu(yo()) && !(window.PasarMovil && window.PasarMovil.activa()); }
  function equipoTxt(e, q) { return e.parejas ? (q === 0 ? 'Pareja A' : 'Pareja B') : nombre(q); }
  function quienGana(e, q) { // texto de quién gana (jugador o pareja q) desde el punto de vista de quien mira
    var m = yo(), mio = m >= 0 && (e.parejas ? m % 2 === q : m === q) && (U.modo === 'online' || humanosLocales() === 1);
    if (mio) return e.parejas ? 'Tu pareja' : 'Tú';
    return e.parejas ? equipoTxt(e, q) + ' (' + nombre(q) + ' y ' + nombre(q + 2) + ')' : nombre(q);
  }

  /* ---------- pintar ---------- */
  function pintar() {
    var e = pub();
    q('.doInfo').textContent = !U.modo ? '' : (U.modo === 'online' ? '🌐 ' + ((window.Sala && window.Sala.sala) || 'online') + ' · ' : '') + (e ? 'Mano ' + e.mano + (e.meta ? ' · a ' + e.meta : '') : '');
    pintarRivales(e); pintarMesa(e); pintarPie(e);
    if (e && (e.fase === 'finMano' || e.fase === 'fin')) mostrarFin(e); else q('.doFin').style.display = 'none';
  }
  function marcador(e, i) { return e.parejas ? '' : '<span class=doPts>' + e.puntos[i] + '</span>'; }
  function pintarRivales(e) {
    var r = q('.doRivales'); r.innerHTML = '';
    if (!e) return;
    var m = yo() < 0 ? 0 : yo();
    if (e.parejas) {
      var mi = m % 2, eq = document.createElement('div'); eq.className = 'doEquipos';
      eq.innerHTML = '<span class="eq' + mi + '">' + (U.modo === 'online' || humanosLocales() === 1 ? 'Nosotros' : equipoTxt(e, mi)) + ' <b>' + e.puntos[mi] + '</b></span><span class="eq' + (1 - mi) + '">' + (U.modo === 'online' || humanosLocales() === 1 ? 'Ellos' : equipoTxt(e, 1 - mi)) + ' <b>' + e.puntos[1 - mi] + '</b></span>';
      r.appendChild(eq);
    }
    for (var k = 1; k < e.n; k++) {
      var i = (m + k) % e.n, c = document.createElement('div');
      c.className = 'doRival' + (e.turno === i && e.fase === 'jugando' ? ' turno' : '') + (e.parejas ? ' eq' + (i % 2) : '');
      var dorsos = ''; for (var d = 0; d < Math.min(e.cuentas[i], 12); d++) dorsos += '<i></i>';
      var ult = e.ultimo && e.ultimo.p === i && e.fase === 'jugando' ? (e.ultimo.tipo === 'pasa' ? ' · pasó' : e.ultimo.tipo === 'roba' ? ' · robó' : '') : '';
      c.innerHTML = '<span class=doRN>' + (esCpu(i) ? '🤖 ' : '') + esc(nombre(i)) + (e.parejas && i % 2 === m % 2 ? ' 🤝' : '') + '</span>' + marcador(e, i) +
        '<span class=doDorsos>' + dorsos + '</span><span class=doCnt>' + e.cuentas[i] + ult + '</span>';
      r.appendChild(c);
    }
  }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* la mesa en serpiente: filas de izquierda a derecha y de derecha a izquierda; se busca el tamaño de ficha más grande que quepa */
  function pintarMesa(e) {
    var el = q('.doMesa'); el.innerHTML = '';
    if (!e) return;
    if (!e.mesa.length) {
      var t = document.createElement('div'); t.className = 'doVacia';
      t.textContent = e.fase === 'jugando' ? (e.obligada >= 0 ? 'Sale ' + nombre(e.turno) + ' con el ' + Math.floor(e.obligada / 10) + ' doble' : 'Sale ' + nombre(e.turno)) : '';
      el.appendChild(t);
    }
    var W = el.clientWidth - 12, H = el.clientHeight - 12, items = e.mesa.map(function (x) { return { x: x, w: x.a === x.b ? 1 : 2 }; });
    var u, filas;
    for (u = 40; u >= 12; u--) {
      var cap = Math.max(2, Math.floor((W + 3) / (u + 3 / 2))); filas = [[]]; var ancho = 0;
      items.forEach(function (it) { if (ancho + it.w > cap && filas[filas.length - 1].length) { filas.push([]); ancho = 0; } filas[filas.length - 1].push(it); ancho += it.w; });
      if (filas.length * (2 * u + 6) <= H || u === 12) break;
    }
    el.style.setProperty('--u', u + 'px');
    var obj = objetivos(e), primero = 0;
    filas.forEach(function (fila, r) {
      var f = document.createElement('div'); f.className = 'doFila' + (r % 2 ? ' rev' : '');
      fila.forEach(function (it, k) {
        var x = it.x, idx = primero + k, doble = x.a === x.b;
        var t = doble ? ficha(x.a, x.b, false) : (r % 2 ? ficha(x.b, x.a, true) : ficha(x.a, x.b, true));
        if (e.ultimo && e.ultimo.tipo === 'juega' && e.ultimo.f === x.f) t.classList.add('ult');
        var lado = idx === 0 && obj.indexOf('i') >= 0 ? 'i' : idx === e.mesa.length - 1 && obj.indexOf('d') >= 0 ? 'd' : '';
        if (e.mesa.length === 1 && obj.length) lado = obj[0];
        if (lado) { t.classList.add('obj'); t.addEventListener('click', (function (l) { return function () { poner(U.sel, l); }; })(lado)); }
        f.appendChild(t);
      });
      primero += fila.length;
      el.appendChild(f);
    });
  }
  function objetivos(e) { // lados posibles para la ficha seleccionada
    if (U.sel < 0 || !miTurno()) return [];
    return D.legales(estadoPara(yo()), yo()).filter(function (j) { return j.f === U.sel; }).map(function (j) { return j.lado; });
  }
  function pintarPie(e) {
    var est = q('.doEstado'), acc = q('.doAcc'), mano = q('.doMano'); acc.innerHTML = ''; mano.innerHTML = '';
    if (!e) { est.textContent = ''; return; }
    var m = yo(), mio = miTurno(), ce = estadoPara(m), leg = mio ? D.legales(ce, m) : [];
    if (mio && !U.eraMio) vib([30, 40, 30]);
    U.eraMio = mio;
    var txt = '';
    if (e.fase !== 'jugando') txt = q('.doFin').style.display === 'none' ? '👆 Toca aquí para ver el resultado' : '';
    else if (mio) {
      if (U.sel >= 0) txt = '¿En qué extremo la pones?';
      else if (leg.length) txt = e.obligada >= 0 ? '👉 Sales tú: pon el ' + Math.floor(e.obligada / 10) + ' doble' : '👉 Tu turno: pon una ficha';
      else txt = e.pozo ? '👉 No puedes poner: roba del pozo' : '👉 No puedes poner: pasas';
    } else txt = (esCpu(e.turno) ? '🤖 Piensa ' : '⏳ Juega ') + nombre(e.turno) + '…';
    var u = e.ultimo;
    if (u && e.fase === 'jugando' && u.p !== m) txt += '  ·  ' + nombre(u.p) + (u.tipo === 'pasa' ? ' pasó' : u.tipo === 'roba' ? ' robó' : ' puso el ' + Math.floor(u.f / 10) + '-' + u.f % 10);
    est.textContent = txt;
    if (mio && U.sel >= 0) {
      var ex = D.extremos(ce);
      objetivos(e).forEach(function (l) { acc.appendChild(boton(l === 'i' ? '◀ En el ' + ex[0] : 'En el ' + ex[1] + ' ▶', function () { poner(U.sel, l); })); });
      acc.appendChild(boton('✕', function () { U.sel = -1; pintar(); }, 'doOpt'));
    } else if (mio && !leg.length) acc.appendChild(e.pozo ? boton('🂠 Robar (' + e.pozo + ' en el pozo)', function () { hacer({ a: 'robar' }); }) : boton('Pasar ⏭', function () { hacer({ a: 'pasar' }); }));
    else if (e.pozo && e.fase === 'jugando') acc.appendChild(Object.assign(document.createElement('span'), { className: 'doPozo', textContent: 'Pozo: ' + e.pozo }));
    if (m < 0) return;
    var cab = document.createElement('div'); cab.className = 'doYo';
    cab.innerHTML = (U.modo === 'online' || humanosLocales() === 1 ? 'Tus fichas' : 'Fichas de <b>' + esc(nombre(m)) + '</b>') + (e.parejas ? '' : ' · <b>' + e.puntos[m] + '</b> puntos');
    mano.appendChild(cab);
    var fila = document.createElement('div'); fila.className = 'doFichas';
    manoDe(m).forEach(function (f) {
      var l = D.lados(f), b = ficha(l[0], l[1], false, 'button'), ok = leg.some(function (j) { return j.f === f; });
      b.classList.toggle('jugable', ok); b.classList.toggle('sel', f === U.sel); b.disabled = !ok;
      b.addEventListener('click', function () { elegir(f); });
      fila.appendChild(b);
    });
    mano.appendChild(fila);
  }
  function boton(txt, fn, cls) { var b = document.createElement('button'); b.type = 'button'; b.className = cls || 'doBtn'; b.textContent = txt; b.addEventListener('click', fn); return b; }

  /* ---------- jugar ---------- */
  function elegir(f) {
    if (!miTurno()) return;
    if (U.sel === f) { U.sel = -1; pintar(); return; }
    var lados = D.legales(estadoPara(yo()), yo()).filter(function (j) { return j.f === f; });
    if (!lados.length) return;
    if (lados.length === 1) { poner(f, lados[0].lado); return; }
    U.sel = f; vib(8); pintar();
  }
  function poner(f, lado) { if (f >= 0) hacer({ a: 'jugar', f: f, lado: lado }); }
  function hacer(m) {
    if (!miTurno()) return;
    U.sel = -1;
    if (U.modo === 'online') { U.online.accion(m); return; }
    if (!D.accion(U.est, yo(), m)) { pintar(); return; }
    vib(10); pintar(); avanzar();
  }
  /* local: turno de la CPU, «pasa el móvil» entre personas, o final de la mano */
  function avanzar() {
    clearTimeout(U.timer);
    if (U.modo !== 'local' || !U.est || U.pausa) return;
    var e = U.est;
    if (e.fase !== 'jugando') { pintar(); return; }
    if (esCpu(e.turno)) {
      U.timer = setTimeout(function () {
        if (U.modo !== 'local' || U.est !== e || e.fase !== 'jugando' || !esCpu(e.turno) || U.pausa) return;
        D.accion(e, e.turno, D.ia(e, e.turno, U.conf.nivel)); pintar(); avanzar();
      }, rapido() || (e.ultimo && e.ultimo.tipo === 'roba' && e.ultimo.p === e.turno ? 450 : 800));
      return;
    }
    if (e.turno !== U.vistaP && humanosLocales() > 1 && window.PasarMovil) {
      var sig = e.turno; U.vistaP = -1; pintar();
      window.PasarMovil.mostrar({ contenedor: raiz, icono: '📱', titulo: 'Pasa el móvil a ' + nombre(sig), texto: 'Le toca a ' + nombre(sig) + '. ¡Que nadie más mire sus fichas!', boton: 'Soy ' + nombre(sig) + ' · Ver mis fichas' })
        .then(function () { if (U.modo === 'local' && U.est === e) { U.vistaP = sig; pintar(); } });
      return;
    }
    if (e.turno !== U.vistaP) { U.vistaP = e.turno; pintar(); }
  }

  /* ---------- final de mano / partida ---------- */
  function mostrarFin(e) {
    var clave = e.mano + ':' + e.nj + ':' + e.fase;
    var f = q('.doFin'), r = e.resultado; if (!r) return;
    if (U.finVisto !== clave) {
      U.finVisto = clave; clearTimeout(U.timer); if (window.PasarMovil) window.PasarMovil.quitar();
      if (U.modo === 'local' && e.fase === 'fin' && window.Partida) window.Partida.borrar('domino');
      f.style.display = 'flex'; vib(r.ganador >= 0 && (U.modo === 'online' ? D.equipo(e, U.p) === r.equipo : true) ? [0, 40, 60, 40] : 60);
    } else if (f.dataset.oculto === clave) return;
    var gana = r.ganador >= 0 ? quienGana(e, r.equipo) : '';
    var h = r.ganador < 0 ? '🔒 Tranque sin ganador' : (r.tranque ? '🔒 Tranque: ' : '🏆 ') + (gana === 'Tú' ? (r.tranque ? 'ganas tú' : '¡Has dominado!') : gana === 'Tu pareja' ? (r.tranque ? 'gana tu pareja' : '¡Domina tu pareja!') : (r.tranque ? 'gana ' : 'Domina ') + gana);
    var sub = r.ganador >= 0 ? '+' + r.puntos + ' puntos' + (e.parejas ? ' para ' + equipoTxt(e, r.equipo) : '') : 'Empate a puntos: nadie se los lleva.';
    if (e.fase === 'fin') {
      var g = e.ganadorPartida, txt = g < 0 ? 'Partida empatada' : e.meta ? '🏆 Partida para ' + quienGana(e, g).replace(/^Tú$/, 'ti').replace(/^Tu pareja$/, 'tu pareja') : '';
      if (txt) sub += ' · ' + txt;
    }
    // récord de la mejor mano: solo contra la CPU (una persona en el móvil)
    if (U.modo === 'local' && humanosLocales() === 1 && r.ganador >= 0 && D.equipo(e, 0) === r.equipo && typeof saveRecord === 'function' && U.recVisto !== clave) {
      U.recVisto = clave; var rec = saveRecord('domino', r.puntos); f.dataset.rec = recordText(rec);
    } else if (U.recVisto !== clave) f.dataset.rec = '';
    f.querySelector('h1').textContent = h;
    f.querySelector('.doSub').textContent = sub + (f.dataset.rec ? ' · ' + f.dataset.rec : '');
    var c = f.querySelector('.doCuentas'); c.innerHTML = '';
    for (var i = 0; i < e.n; i++) {
      var fila = document.createElement('div'); fila.className = 'doCuenta' + (e.parejas ? ' eq' + (i % 2) : '') + (i === r.ganador ? ' gana' : '');
      fila.innerHTML = '<span class=doCN>' + esc(nombre(i)) + '</span>';
      var fs = document.createElement('span'); fs.className = 'doCF';
      (r.manos[i] || []).forEach(function (x) { var l = D.lados(x); fs.appendChild(ficha(l[0], l[1], false)); });
      fila.appendChild(fs);
      fila.appendChild(Object.assign(document.createElement('span'), { className: 'doCP', textContent: r.cuentas[i] + (e.parejas ? '' : ' · total ' + e.puntos[i]) }));
      c.appendChild(fila);
    }
    if (e.parejas) c.appendChild(Object.assign(document.createElement('div'), { className: 'doCuenta tot', textContent: 'Pareja A ' + e.puntos[0] + ' · Pareja B ' + e.puntos[1] }));
    var b = f.querySelector('[data-r=otra]'), mn = f.querySelector('[data-r=menu]');
    if (U.modo === 'online') {
      var host = U.online && U.online.host;
      b.textContent = !host ? '⏳ Esperando al anfitrión' : e.fase === 'fin' ? '↩ Volver al lobby' : '▶ Siguiente mano'; b.disabled = !host; mn.style.display = 'none';
    } else { b.textContent = e.fase === 'fin' ? '▶ Nueva partida' : '▶ Siguiente mano'; b.disabled = false; mn.style.display = ''; }
  }
  q('.doFin [data-r=otra]').addEventListener('click', function () {
    var e = pub(); if (!e) return;
    if (U.modo === 'online') { if (U.online && U.online.host) { if (e.fase === 'fin') U.online.lobby(); else U.online.siguiente(); } return; }
    if (e.fase === 'fin') { empezar(); return; }
    D.siguienteMano(U.est); U.vistaP = humanosLocales() > 1 ? -2 : 0; q('.doFin').style.display = 'none'; pintar(); avanzar();
  });
  q('.doFin [data-r=menu]').addEventListener('click', menu);
  q('.doFin [data-r=ver]').addEventListener('click', function () { var f = q('.doFin'); f.style.display = 'none'; f.dataset.oculto = U.finVisto; pintar(); });
  q('.doEstado').addEventListener('click', function () { var e = pub(); if (e && e.fase !== 'jugando') { q('.doFin').dataset.oculto = ''; mostrarFin(e); q('.doFin').style.display = 'flex'; } });

  /* ---------- menú y partida local ---------- */
  function guardarConf() { try { localStorage.setItem('domConf', JSON.stringify(U.conf)); } catch (e) { /* sin almacenamiento */ } }
  function pintarMenu() {
    var a = q('.doAsientos'); a.innerHTML = '';
    U.conf.asientos.forEach(function (t, i) {
      var r = document.createElement('div'); r.className = 'doRow';
      r.appendChild(Object.assign(document.createElement('span'), { className: 'doAs', textContent: 'Jugador ' + (i + 1) + ':' }));
      if (i === 0) { r.appendChild(Object.assign(document.createElement('span'), { className: 'doOpt sel', textContent: '👤 Tú' })); a.appendChild(r); return; }
      ['cpu', 'per', 'no'].forEach(function (k) {
        if (k === 'no' && i === 1) return;                                  // al menos 2 jugadores
        var b = boton(TIPOS[k], function () { U.conf.asientos[i] = k; guardarConf(); pintarMenu(); }, 'doOpt' + (t === k ? ' sel' : ''));
        b.dataset.asiento = i; b.dataset.tipo = k; r.appendChild(b);
      });
      a.appendChild(r);
    });
    var n = U.conf.asientos.filter(function (t) { return t !== 'no'; }).length;
    raiz.querySelectorAll('.doMenu [data-k]').forEach(function (row) {
      var k = row.dataset.k, v = k === 'parejas' ? (U.conf.parejas ? 1 : 0) : U.conf[k];
      row.querySelectorAll('[data-v]').forEach(function (b) { b.classList.toggle('sel', +b.dataset.v === v); });
      if (k === 'parejas') row.style.opacity = n === 4 ? 1 : 0.45;
    });
    var best = typeof loadRecord === 'function' ? loadRecord('domino') : null;
    q('.doRec').textContent = best ? '🏆 Mejor mano contra la CPU: ' + best + ' puntos' : '';
  }
  raiz.querySelectorAll('.doMenu [data-k]').forEach(function (row) {
    row.querySelectorAll('[data-v]').forEach(function (b) {
      b.addEventListener('click', function () { var k = row.dataset.k; U.conf[k] = k === 'parejas' ? b.dataset.v === '1' : +b.dataset.v; guardarConf(); pintarMenu(); });
    });
  });
  q('.doMenu [data-r=jugar]').addEventListener('click', function () { empezar(); });
  q('.doMenu [data-r=online]').addEventListener('click', function () { var c = document.querySelector('[data-conectar=domino]'); if (c) c.click(); });
  function jugadoresDeConf() {
    var as = U.conf.asientos.filter(function (t) { return t !== 'no'; }), personas = as.filter(function (t) { return t !== 'cpu'; }).length, nc = 0, np = 0;
    return as.map(function (t, i) {
      if (t === 'cpu') { nc++; return { nombre: 'CPU ' + nc, cpu: true }; }
      np++; return { nombre: personas === 1 ? 'Tú' : 'Jugador ' + (i + 1), cpu: false };
    });
  }
  function empezar() {
    if (window.Partida) window.Partida.borrar('domino');
    clearTimeout(U.timer); if (window.PasarMovil) window.PasarMovil.quitar();
    U.modo = 'local'; U.online = null; U.pub = null; U.sel = -1; U.finVisto = ''; U.recVisto = '';
    U.jug = jugadoresDeConf();
    U.est = D.crear({ n: U.jug.length, parejas: U.conf.parejas, meta: U.conf.meta });
    U.vistaP = humanosLocales() > 1 ? -2 : 0;
    q('.doMenu').style.display = 'none'; q('.doFin').style.display = 'none'; pintar(); avanzar();
  }
  function menu() {
    clearTimeout(U.timer); if (window.PasarMovil) window.PasarMovil.quitar();
    U.modo = null; U.est = null; U.pub = null; U.online = null; U.sel = -1; U.jug = [];
    q('.doFin').style.display = 'none'; q('.doMenu').style.display = 'flex'; pintarMenu(); pintar();
  }
  function guardarPartida() {
    if (!window.Partida) return;
    if (U.modo === 'online') { window.Partida.aviso('Una partida online no se puede guardar'); return; }
    if (U.modo !== 'local' || !U.est || U.est.fase === 'fin') { window.Partida.aviso('No hay ninguna partida en curso'); return; }
    window.Partida.guardar('domino', { est: D.copiar(U.est), jug: U.jug, nivel: U.conf.nivel });
    window.Partida.aviso('💾 Partida guardada');
  }
  function restaurar() {
    var d = window.Partida && window.Partida.tomar('domino'), est = d && D.restaurar(d.est);
    if (!est || !Array.isArray(d.jug) || d.jug.length !== est.n) return false;
    clearTimeout(U.timer); U.modo = 'local'; U.online = null; U.est = est; U.jug = d.jug; U.sel = -1; U.finVisto = ''; U.recVisto = '';
    if (d.nivel === 1 || d.nivel === 2) U.conf.nivel = d.nivel;
    U.vistaP = humanosLocales() > 1 ? -2 : U.jug.findIndex(function (j) { return !j.cpu; });
    q('.doMenu').style.display = 'none'; pintar(); avanzar();
    return true;
  }
  $('dominoNewGame').addEventListener('click', function () {
    if (U.modo === 'online') { if (window.Sala) window.Sala.toast('En línea: el anfitrión puede volver al lobby con «↩ Lobby» y cualquiera puede salir de la sala.'); return; }
    if (window.Partida) window.Partida.borrar('domino');
    menu();
  });
  $('dominoSave').addEventListener('click', guardarPartida);
  var reT = null; window.addEventListener('resize', function () { clearTimeout(reT); reT = setTimeout(function () { if (U.modo) pintarMesa(pub()); }, 120); });

  /* ---------- interfaz para el adaptador online (js/online/j-domino.js) ---------- */
  window.Domino = { online: {
    iniciar: function (c) {                                        // { p, jug:[{nombre,cpu}], host, pub, mano, accion, siguiente, lobby }
      clearTimeout(U.timer); if (window.PasarMovil) window.PasarMovil.quitar();
      U.modo = 'online'; U.est = null; U.p = c.p; U.jug = c.jug; U.pub = c.pub; U.mano = c.mano || []; U.sel = -1; U.finVisto = ''; U.eraMio = false;
      U.online = { host: !!c.host, accion: c.accion, siguiente: c.siguiente, lobby: c.lobby };
      q('.doMenu').style.display = 'none'; q('.doFin').style.display = 'none'; pintar();
    },
    publico: function (p) {
      if (U.modo !== 'online' || !p) return;
      if (U.pub && p.nj !== U.pub.nj) U.sel = -1;
      U.pub = p; pintar();
    },
    mano: function (m) { if (U.modo !== 'online' || !Array.isArray(m)) return; U.mano = m; pintar(); },
    salir: function () { if (U.modo === 'online') menu(); },
    activo: function () { return U.modo === 'online'; }
  } };
  window.initDomino = function () { if (!U.modo && !restaurar()) menu(); };
  window.pauseDomino = function () { U.pausa = true; clearTimeout(U.timer); };
  window.resumeDomino = function () { U.pausa = false; if (U.modo) pintar(); if (U.modo === 'local' && !(window.PasarMovil && window.PasarMovil.activa())) avanzar(); };
  window.dominoEstado = function () { var e = pub(); return { modo: U.modo, p: yo(), pub: e && JSON.parse(JSON.stringify(e)), mano: manoDe(yo()).slice(), jug: U.jug, est: U.est && D.copiar(U.est) }; };
  menu();
})();

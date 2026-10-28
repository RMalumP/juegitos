/* uno.js — Juegos XP: UNO (108 cartas, reglas en js/online/uno-engine.js).
   Tres modos con la MISMA interfaz y el mismo árbitro:
     · 🤖 Contra la CPU: de 1 a 7 rivales (fácil · normal · difícil).
     · 📱 Pasar el móvil (como el Póquer): de 2 a 8 personas en un móvil, con CPU opcionales; una tapa (js/pasar-movil.js) oculta la mano entre turnos.
     · 🌐 Online (sala): el anfitrión es el árbitro y cada uno recibe solo su mano; asientos de CPU opcionales (js/online/j-uno.js).
   Todo se pinta a partir de lo PÚBLICO de la partida (UnoEngine.vista) más la mano de quien mira, así el online no filtra nada.
   La partida contra la CPU o en un móvil se guarda con «💾 Guardar» (Partida 'uno'); contra la CPU se lleva la cuenta de victorias y el récord de turnos. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var UE = window.UnoEngine;
  var NIVELES = ['', 'Fácil', 'Normal', 'Difícil'];
  var U = { modo: null, s: null, jug: [], visor: 0, timer: null, tapa: false, online: null, pub: null, mano: [], p: 0, eraMio: false, comodin: -1, retardo: 900,
    conf: { modo: 'cpu', rivales: 3, nivel: 2, personas: 2, cpus: 0, meta: 0, acumular: true, nombres: [] } };
  try { var g = JSON.parse(localStorage.getItem('unoConf')); if (g && typeof g === 'object') Object.assign(U.conf, g); } catch (e) { /* sin ajustes */ }
  function guardarConf() { try { localStorage.setItem('unoConf', JSON.stringify(U.conf)); } catch (e) { /* nada */ } }
  function leerStats() { try { var o = JSON.parse(localStorage.getItem('unoStats')); return o && typeof o.jugadas === 'number' ? o : { jugadas: 0, ganadas: 0 }; } catch (e) { return { jugadas: 0, ganadas: 0 }; } }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function boton(txt, cls, fn) { var b = mk('button', cls, txt); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function vib(p) { if (window.Vibra) window.Vibra.pulso(p); }

  /* ---------- estructura ---------- */
  var wrap = $('unoWrap');
  wrap.innerHTML = '<div id="unoHeader"><span>UNO</span><span id="unoInfo"></span></div>' +
    '<div id="unoMesa"><div id="unoRivales"></div><div id="unoCentro"><button type="button" id="unoMazo" class="unoCarta dorso" aria-label="Robar del mazo"><span class="unoOv">UNO</span></button>' +
    '<div id="unoPozo"></div><div id="unoRumbo"><span id="unoMazoN"></span><span id="unoColorAct"></span><span id="unoSentido"></span><span id="unoAcum"></span></div></div>' +
    '<div id="unoEstado"></div><div id="unoLog"></div><div id="unoAcc"></div><div id="unoManoTit"></div><div id="unoMano"></div></div>' +
    '<div id="unoMenu"></div><div id="unoElegir"><div class="unoElT">Elige el color</div><div class="unoElC"></div><button type="button" class="unoNo">Cancelar</button></div><div id="unoFin"></div>';
  ['r', 'a', 'v', 'z'].forEach(function (c) {
    $('unoElegir').querySelector('.unoElC').appendChild(boton(UE.NOMBRE_COLOR[c], 'unoElB c-' + c, function () { elegido(c); }));
  });
  $('unoElegir').querySelector('.unoNo').addEventListener('click', function () { U.comodin = -1; $('unoElegir').style.display = 'none'; });
  $('unoMazo').addEventListener('click', function () { var v = vistaAct(); if (puedoActuar(v) && !v.robada && v.fase === 'jugando') actuar({ a: 'robar' }); });

  /* ---------- carta ---------- */
  var ETI = { S: '⊘', R: '⇄', D: '+2', W: '', W4: '+4' };
  function etiqueta(c) { var v = UE.valorDe(c); return v in ETI ? ETI[v] : v; }
  function carta(c, cls) {
    var b = mk('button', 'unoCarta ' + (UE.esComodin(c) ? 'negra' : 'c-' + UE.colorDe(c)) + (cls ? ' ' + cls : ''));
    b.type = 'button'; b.dataset.c = c; b.setAttribute('aria-label', UE.nombreCarta(c));
    b.innerHTML = '<span class="unoOv">' + etiqueta(c) + '</span><i class="unoEsq">' + etiqueta(c) + '</i>';
    return b;
  }
  var ORDEN = { r: 0, a: 1, v: 2, z: 3 }, VAL = { S: 10, R: 11, D: 12, W: 20, W4: 21 };
  function clave(c) { return (UE.esComodin(c) ? 4 : ORDEN[UE.colorDe(c)]) * 100 + (VAL[UE.valorDe(c)] !== undefined ? VAL[UE.valorDe(c)] : +UE.valorDe(c)); }

  /* ---------- lo que se ve: lo público + la mano de quien mira ---------- */
  function vistaAct() { return U.modo === 'online' ? U.pub : U.s ? UE.vista(U.s) : null; }
  function yo() { return U.modo === 'online' ? U.p : U.visor; }
  function manoAct() { return U.modo === 'online' ? U.mano : U.s ? U.s.manos[U.visor] : []; }
  function esCpu(p) { return U.modo === 'online' ? !!(U.online && U.online.cpus && U.online.cpus[p]) : !!(U.jug[p] && U.jug[p].cpu); }
  function nombre(p, v) { return (v || vistaAct()).nombres[p] || 'Jugador ' + (p + 1); }
  function puedoActuar(v) { return !!v && !U.tapa && v.turno === yo() && (v.fase === 'jugando' || v.fase === 'color') && !esCpu(yo()) && !(U.modo === 'online' && !U.online); }
  function jugablesAct(v) { return U.modo === 'online' ? UE.jugablesDe(v, U.mano, U.p) : U.s ? UE.jugables(U.s, U.visor) : []; }

  function textoEv(e, v) {
    if (!e) return '';
    var n = function (p) { return esc(nombre(p, v)); };
    switch (e.t) {
      case 'ronda': return 'Ronda ' + e.r + ': sale ' + UE.nombreCarta(e.c) + '.';
      case 'jugar': return n(e.p) + ' juega ' + UE.nombreCarta(e.c) + (UE.esComodin(e.c) ? ' → ' + UE.NOMBRE_COLOR[e.color] : '') + '.';
      case 'robar': return n(e.p) + (e.castigo ? ' roba ' + e.k + ' y pierde el turno.' : e.k ? ' roba una carta.' : ' no puede robar: el mazo está vacío.');
      case 'pasar': return n(e.p) + ' pasa.';
      case 'uno': return '📣 ' + n(e.p) + ': «¡UNO!»';
      case 'pillar': return '🚨 ' + n(e.p) + ' pilla a ' + n(e.q) + ' sin decir «¡UNO!»: roba 2.';
      case 'retar': return '⚖️ ' + n(e.p) + ' reta el +4 de ' + n(e.q) + (e.gana ? ': era ilegal, ' + n(e.q) + ' roba 4.' : ': era legal, ' + n(e.p) + ' roba ' + e.k + '.');
      case 'color': return n(e.p) + ' elige ' + UE.NOMBRE_COLOR[e.color] + '.';
      case 'fin': return '🏆 ' + n(e.p) + ' se queda sin cartas.';
    }
    return '';
  }

  /* ---------- pintar ---------- */
  function pintar() {
    var v = vistaAct(), en = !!U.modo && !!v;
    $('unoMesa').style.display = en ? 'flex' : 'none';
    $('unoMenu').style.display = U.modo ? 'none' : 'flex';
    $('unoInfo').textContent = !U.modo ? '' : (U.modo === 'cpu' ? '🤖 CPU · ' + NIVELES[U.conf.nivel] : U.modo === 'local' ? '📱 Un móvil' : '🌐 ' + ((window.Sala && window.Sala.sala) || 'online')) +
      (v ? ' · ronda ' + v.ronda + (v.op.meta ? ' · a ' + v.op.meta + ' pts' : '') : '');
    if (!en) return;
    var me = yo(), mano = manoAct() || [], mio = puedoActuar(v), js = mio && v.fase === 'jugando' ? jugablesAct(v) : [];
    if (mio && !U.eraMio) vib([30, 40, 30]);
    U.eraMio = mio;
    /* rivales, en el orden en que juegan desde mí */
    var riv = $('unoRivales'); riv.innerHTML = '';
    for (var k = 1; k < v.n; k++) {
      var p = (me + k * (v.sentido || 1) + v.n * 2) % v.n;
      var d = mk('div', 'unoRival' + (v.turno === p ? ' turno' : '') + (v.cuantas[p] === 1 ? ' ultima' : ''));
      d.innerHTML = '<span class="unoRN">' + (v.turno === p ? '👉 ' : '') + (esCpu(p) ? '🤖 ' : '') + esc(nombre(p, v)) + '</span><span class="unoRC"><i class="mini"></i>×' + v.cuantas[p] + '</span>' +
        (v.uno[p] && v.cuantas[p] === 1 ? '<span class="unoBadge">UNO</span>' : '') + (v.op.meta ? '<span class="unoRP">' + v.puntos[p] + ' pts</span>' : '');
      riv.appendChild(d);
    }
    /* centro */
    var pozo = $('unoPozo'); pozo.innerHTML = ''; if (v.tope) pozo.appendChild(carta(v.tope, 'tope'));
    $('unoMazo').disabled = !(mio && v.fase === 'jugando' && !v.robada);
    $('unoMazo').querySelector('.unoOv').textContent = 'UNO';
    $('unoMazoN').textContent = '🂠 ' + v.mazo;
    $('unoColorAct').className = 'c-' + v.color; $('unoColorAct').textContent = v.color ? UE.NOMBRE_COLOR[v.color] : '';
    $('unoSentido').textContent = v.sentido === 1 ? '↻' : '↺';
    $('unoAcum').textContent = v.acum ? '+' + v.acum : '';
    /* estado */
    var est;
    if (v.fase === 'fin' || v.fase === 'final') est = '🏆 ' + esc(nombre(v.ganadorRonda, v)) + ' gana la ronda.';
    else if (mio) {
      if (v.fase === 'color') est = 'Te toca empezar: elige el color.';
      else if (v.acum) est = '¡Te toca robar ' + v.acum + '!' + (js.length ? ' O acumula otro ' + (v.acumTipo === 'D' ? '+2 o +4' : '+4') + '.' : '') + (v.reto ? ' También puedes retar el +4.' : '');
      else if (v.robada) est = 'Has robado una carta que sirve: juégala o pasa.';
      else est = 'Tu turno: juega una carta' + (js.length ? '' : ' (no tienes ninguna que sirva)') + ' o roba.';
    } else est = (U.tapa ? '' : 'Turno de ' + esc(nombre(v.turno, v)) + (esCpu(v.turno) ? ' 🤖…' : '…'));
    $('unoEstado').innerHTML = est; $('unoEstado').classList.toggle('mio', mio);
    var ult = v.log && v.log[v.log.length - 1]; $('unoLog').innerHTML = textoEv(ult, v);
    /* acciones */
    var acc = $('unoAcc'); acc.innerHTML = '';
    if (mio && v.fase === 'color') acc.appendChild(boton('🎨 Elegir color', 'unoB ok', function () { U.comodin = -2; $('unoElegir').style.display = 'flex'; }));
    if (mio && v.fase === 'jugando') {
      if (!v.robada) acc.appendChild(boton(v.acum ? '🂠 Robar ' + v.acum : '🂠 Robar', 'unoB', function () { actuar({ a: 'robar' }); }));
      else acc.appendChild(boton('⏭ Pasar', 'unoB', function () { actuar({ a: 'pasar' }); }));
      if (v.reto) acc.appendChild(boton('⚖️ Retar el +4', 'unoB mal', function () { actuar({ a: 'retar' }); }));
    }
    var puedeUno = !U.tapa && !esCpu(me) && v.fase === 'jugando' && !v.uno[me] && ((mano.length === 2 && mio && js.length) || (mano.length === 1 && v.pillable === me));
    if (puedeUno) acc.appendChild(boton('📣 ¡UNO!', 'unoB uno', function () { actuar({ a: 'uno' }); }));
    if (!U.tapa && v.fase === 'jugando' && v.pillable >= 0 && v.pillable !== me && !esCpu(me))
      acc.appendChild(boton('🚨 ¡' + esc(nombre(v.pillable, v)) + ' no ha dicho UNO!', 'unoB mal', function () { actuar({ a: 'pillar', q: v.pillable }); }));
    /* mano */
    var tapada = U.tapa || esCpu(me);
    $('unoManoTit').textContent = tapada ? '' : (U.modo === 'local' ? 'Mano de ' + nombre(me, v) : 'Tu mano') + ' · ' + mano.length + (mano.length === 1 ? ' carta' : ' cartas') + (v.op.meta ? ' · ' + v.puntos[me] + ' pts' : '');
    var cont = $('unoMano'); cont.innerHTML = '';
    if (!tapada) {
      var idx = mano.map(function (c, i) { return i; }).sort(function (a, b) { return clave(mano[a]) - clave(mano[b]) || a - b; });
      idx.forEach(function (i) {
        var ok = js.indexOf(i) >= 0, b = carta(mano[i], (mio && v.fase === 'jugando' ? (ok ? 'puede' : 'no') : '') + (v.robada && mio && i === mano.length - 1 ? ' robada' : ''));
        b.dataset.i = i; b.disabled = !ok;
        b.addEventListener('click', function () { tocar(i); });
        cont.appendChild(b);
      });
    }
    cont.classList.toggle('muchas', mano.length > 14);
    pintarFin(v);
  }

  function tocar(i) {
    var v = vistaAct(), mano = manoAct(); if (!puedoActuar(v) || v.fase !== 'jugando') return;
    if (UE.esComodin(mano[i])) { U.comodin = i; $('unoElegir').style.display = 'flex'; return; }
    actuar({ a: 'jugar', i: i });
  }
  function elegido(c) {
    $('unoElegir').style.display = 'none';
    var i = U.comodin; U.comodin = -1;
    if (i === -2) actuar({ a: 'color', c: c }); else if (i >= 0) actuar({ a: 'jugar', i: i, color: c });
  }

  /* ---------- fin de ronda / partida ---------- */
  function pintarFin(v) {
    var f = $('unoFin');
    if (!(v.fase === 'fin' || v.fase === 'final') || U.tapa) { f.style.display = 'none'; return; }
    f.style.display = 'flex'; f.innerHTML = '';
    var g = v.ganadorRonda, final = v.fase === 'final';
    f.appendChild(mk('div', 'unoFT', final ? '🏆 ¡' + esc(nombre(v.ganador, v)) + ' gana la partida!' : '🏁 ' + esc(nombre(g, v)) + ' gana la ronda ' + v.ronda));
    if (v.op.meta) f.appendChild(mk('div', 'unoFS', '+' + v.puntosRonda + ' puntos · meta ' + v.op.meta));
    if (U.extraFin) f.appendChild(mk('div', 'unoFS', U.extraFin));
    var t = mk('div', 'unoFL');
    for (var p = 0; p < v.n; p++) {
      var fila = mk('div', 'unoFJ' + (p === g ? ' gana' : ''));
      fila.appendChild(mk('span', 'unoFN', (p === g ? '🏆 ' : '') + (esCpu(p) ? '🤖 ' : '') + esc(nombre(p, v)) + (v.op.meta ? ' · <b>' + v.puntos[p] + '</b>' : '')));
      var m = mk('span', 'unoFM'); ((v.manosFin && v.manosFin[p]) || []).forEach(function (c) { m.appendChild(carta(c, 'mini')); });
      fila.appendChild(m); t.appendChild(fila);
    }
    f.appendChild(t);
    var bs = mk('div', 'unoFB');
    if (U.modo === 'online') {
      if (U.online && U.online.host) {
        if (!final) bs.appendChild(boton('▶ Siguiente ronda', 'unoB ok', function () { U.online.siguiente(); }));
        else bs.appendChild(boton('🔁 Revancha', 'unoB ok', function () { U.online.revancha(); }));
        bs.appendChild(boton('↩ Lobby', 'unoB', function () { U.online.lobby(); }));
      } else bs.appendChild(mk('div', 'unoFS', '⏳ Esperando al anfitrión…'));
    } else {
      if (!final) bs.appendChild(boton('▶ Siguiente ronda', 'unoB ok', function () { UE.siguienteRonda(U.s); U.extraFin = ''; arrancar(); }));
      else bs.appendChild(boton('🔁 Otra partida', 'unoB ok', function () { empezar(U.modo); }));
      bs.appendChild(boton('☰ Menú', 'unoB', menu));
    }
    f.appendChild(bs);
  }

  /* ---------- jugar (CPU y un móvil) ---------- */
  function actuar(m) {
    if (U.modo === 'online') { if (U.online) U.online.actuar(m); return; }
    if (!U.s) return;
    var r = UE.accion(U.s, U.visor, m);
    if (!r.ok) { if (window.Partida) window.Partida.aviso(r.error); return; }
    if (m.a === 'jugar' || m.a === 'robar') vib(15);
    despues();
  }
  function despues() {
    clearTimeout(U.timer);
    var s = U.s; if (!s) return;
    if (s.fase === 'fin' || s.fase === 'final') { finRonda(); pintar(); return; }
    var t = s.turno;
    if (U.jug[t].cpu) { pintar(); programarCpu(); return; }
    if (U.modo === 'local' && t !== U.visor) { pasarA(t); return; }
    pintar();
  }
  function programarCpu() {
    clearTimeout(U.timer);
    if (U.pausado) return;
    U.timer = setTimeout(function () {
      var s = U.s; if (!s || U.modo === 'online' || U.tapa) return;
      var t = s.turno; if (!U.jug[t] || !U.jug[t].cpu || (s.fase !== 'jugando' && s.fase !== 'color')) return;
      UE.turnoCpu(s, t, U.jug[t].nivel || 2);
      despues();
    }, U.retardo);
  }
  function pasarA(t) {
    U.tapa = true; pintar();
    var v = vistaAct(), ult = v.log[v.log.length - 1];
    PasarMovil.mostrar({ contenedor: wrap, icono: '🃏', titulo: 'Pasa el móvil a ' + nombre(t), texto: textoEv(ult, v).replace(/<[^>]+>/g, '') || 'Le toca a ' + nombre(t) + '.', boton: 'Soy ' + nombre(t) + ' · Ver mis cartas' })
      .then(function () { if (!U.s) return; U.tapa = false; U.visor = t; despues(); });
  }
  function finRonda() {
    var s = U.s; U.extraFin = '';
    if (s.fase !== 'final') return;
    if (window.Partida) window.Partida.borrar('uno');
    if (U.modo === 'cpu' && !U.contada) {
      U.contada = true;
      var st = leerStats(); st.jugadas++; if (s.ganador === 0) st.ganadas++;
      try { localStorage.setItem('unoStats', JSON.stringify(st)); } catch (e) { /* nada */ }
      if (s.ganador === 0 && !s.op.meta && typeof saveRecord === 'function') {
        var rec = saveRecord('uno', s.turnos[0], true);
        U.extraFin = 'Has ganado en ' + s.turnos[0] + ' turnos. ' + recordText(rec, function (n) { return n + ' turnos'; });
      }
    }
  }
  function arrancar() {                                    // tras repartir: quién mira y quién juega
    U.tapa = false; U.contada = false; clearTimeout(U.timer); PasarMovil.quitar();
    var t = U.s.turno;
    if (U.modo === 'local') {
      var h = U.jug[t].cpu ? primerHumano() : t;
      U.visor = h; U.tapa = true; pintar();
      PasarMovil.mostrar({ contenedor: wrap, icono: '🃏', titulo: 'Ronda ' + U.s.ronda + ' · pasa el móvil a ' + nombre(h), texto: 'Cada uno ve solo sus cartas. Cuando acabes tu turno, pasa el móvil.', boton: 'Soy ' + nombre(h) + ' · Ver mis cartas' })
        .then(function () { if (!U.s) return; U.tapa = false; despues(); });
      return;
    }
    despues();
  }
  function primerHumano() { var s = U.s; for (var k = 0; k < s.n; k++) { var p = (s.turno + k * s.sentido + s.n * 2) % s.n; if (!U.jug[p].cpu) return p; } return 0; }

  function empezar(modo) {
    clearTimeout(U.timer); PasarMovil.quitar();
    if (window.Partida) window.Partida.borrar('uno');
    var c = U.conf, jug = [];
    if (modo === 'cpu') {
      jug.push({ nombre: 'Tú' });
      for (var k = 1; k <= c.rivales; k++) jug.push({ nombre: 'CPU ' + k, cpu: true, nivel: c.nivel });
    } else {
      for (k = 0; k < c.personas; k++) jug.push({ nombre: (c.nombres[k] || '').trim().slice(0, 14) || 'Jugador ' + (k + 1) });
      for (k = 1; k <= c.cpus; k++) jug.push({ nombre: 'CPU ' + k, cpu: true, nivel: c.nivel });
    }
    U.modo = modo; U.jug = jug; U.online = null; U.pub = null; U.visor = 0; $('unoFin').style.display = 'none';
    U.s = UE.crear({ n: jug.length, nombres: jug.map(function (j) { return j.nombre; }), meta: c.meta, acumular: c.acumular, repartidor: modo === 'cpu' ? jug.length - 1 : undefined });
    arrancar();
  }

  /* ---------- menú ---------- */
  function menu() {
    clearTimeout(U.timer); PasarMovil.quitar();
    U.modo = null; U.s = null; U.online = null; U.pub = null; U.tapa = false;
    $('unoFin').style.display = 'none'; $('unoElegir').style.display = 'none';
    pintarMenu(); pintar();
  }
  function fila(txt) { var f = mk('div', 'unoRow'); f.appendChild(mk('span', 'unoRL', txt)); return f; }
  function opcion(f, txt, on, fn) { f.appendChild(boton(txt, 'unoOpt' + (on ? ' on' : ''), function () { fn(); guardarConf(); pintarMenu(); })); }
  function contador(f, val, min, max, fn) {
    f.appendChild(boton('−', 'unoOpt', function () { if (val > min) { fn(val - 1); guardarConf(); pintarMenu(); } }));
    f.appendChild(mk('b', 'unoNum', String(val)));
    f.appendChild(boton('+', 'unoOpt', function () { if (val < max) { fn(val + 1); guardarConf(); pintarMenu(); } }));
  }
  function pintarMenu() {
    var m = $('unoMenu'), c = U.conf; m.innerHTML = '';
    m.appendChild(mk('h1', '', '<span class="u1">U</span><span class="u2">N</span><span class="u3">O</span>'));
    m.appendChild(mk('div', 'sub', '108 cartas · quédate sin cartas antes que nadie.<br>Mismo color, número o símbolo; los comodines van sobre cualquiera.'));
    var tabs = mk('div', 'unoTabs');
    [['cpu', '🤖 Contra la CPU'], ['local', '📱 Pasar el móvil']].forEach(function (x) { tabs.appendChild(boton(x[1], 'unoTab' + (c.modo === x[0] ? ' on' : ''), function () { c.modo = x[0]; guardarConf(); pintarMenu(); })); });
    tabs.appendChild(boton('🌐 Online', 'unoTab', function () { var b = document.querySelector('#winUno [data-conectar]'); if (b) b.click(); }));
    m.appendChild(tabs);
    var f;
    if (c.modo === 'cpu') { f = fila('Rivales:'); contador(f, c.rivales, 1, 7, function (n) { c.rivales = n; }); m.appendChild(f); }
    else {
      f = fila('Personas:'); contador(f, c.personas, 2, 8, function (n) { c.personas = n; if (c.personas + c.cpus > 8) c.cpus = 8 - c.personas; }); m.appendChild(f);
      f = fila('CPU:'); contador(f, c.cpus, 0, 8 - c.personas, function (n) { c.cpus = n; }); m.appendChild(f);
      var ns = mk('div', 'unoNombres');
      for (var k = 0; k < c.personas; k++) {
        var inp = mk('input'); inp.type = 'text'; inp.maxLength = 14; inp.placeholder = 'Jugador ' + (k + 1); inp.value = c.nombres[k] || '';
        (function (k) { inp.addEventListener('change', function (e) { c.nombres[k] = e.target.value; guardarConf(); }); })(k);
        ns.appendChild(inp);
      }
      m.appendChild(ns);
    }
    if (c.modo === 'cpu' || c.cpus > 0) { f = fila('Dificultad:'); [1, 2, 3].forEach(function (n) { opcion(f, NIVELES[n], c.nivel === n, function () { c.nivel = n; }); }); m.appendChild(f); }
    f = fila('Final:'); [[0, 'Rápida'], [200, 'A 200 pts'], [500, 'A 500 pts']].forEach(function (x) { opcion(f, x[1], c.meta === x[0], function () { c.meta = x[0]; }); }); m.appendChild(f);
    f = fila('Acumular +2/+4:'); opcion(f, 'Sí', c.acumular, function () { c.acumular = true; }); opcion(f, 'No', !c.acumular, function () { c.acumular = false; }); m.appendChild(f);
    m.appendChild(boton('▶ Empezar', 'unoBig', function () { empezar(c.modo); }));
    var st = leerStats(), rec = typeof loadRecord === 'function' ? loadRecord('uno') : null;
    m.appendChild(mk('div', 'unoStats', st.jugadas ? 'Contra la CPU: ganadas ' + st.ganadas + ' de ' + st.jugadas + (rec ? ' · récord: ganar en ' + rec + ' turnos' : '') : 'Partida rápida: gana el primero que se quede sin cartas. Por puntos: el ganador de cada ronda suma las cartas de los demás.'));
    m.appendChild(mk('div', 'unoReglas', '<b>Reglas:</b> si no puedes (o no quieres) jugar, roba una; si sirve, puedes jugarla. +2 y +4 se acumulan (opción). El +4 solo vale sin cartas del color en juego: el siguiente puede retarlo. Con dos cartas pulsa <b>«¡UNO!»</b> antes de jugar: si te pillan sin decirlo, robas 2. Con 2 jugadores, la reversa hace de salta.'));
  }

  /* ---------- partida a medias ---------- */
  function guardarPartida() {
    if (!window.Partida) return;
    if (U.modo === 'online') { window.Partida.aviso('Una partida online no se puede guardar'); return; }
    if (!U.s || U.s.fase === 'final') { window.Partida.aviso('No hay ninguna partida en curso'); return; }
    window.Partida.guardar('uno', { modo: U.modo, jug: U.jug, visor: U.visor, conf: { nivel: U.conf.nivel }, s: JSON.parse(JSON.stringify(U.s)) });
    window.Partida.aviso('💾 Partida guardada');
  }
  function restaurar() {
    var d = window.Partida && window.Partida.tomar('uno'); if (!d || (d.modo !== 'cpu' && d.modo !== 'local') || !Array.isArray(d.jug)) return false;
    var s = UE.restaurar(d.s); if (!s || s.n !== d.jug.length || s.fase === 'final') return false;
    U.modo = d.modo; U.jug = d.jug; U.s = s; U.online = null; U.pub = null; U.visor = d.modo === 'cpu' ? 0 : (d.visor | 0) % s.n;
    if (s.fase === 'fin') { U.tapa = false; pintar(); return true; }
    if (U.modo === 'local') {
      var h = U.jug[s.turno].cpu ? primerHumano() : s.turno; U.tapa = true; pintar();
      PasarMovil.mostrar({ contenedor: wrap, icono: '🃏', titulo: 'Partida recuperada', texto: 'Le toca a ' + nombre(s.turno) + '.', boton: 'Soy ' + nombre(h) + ' · Ver mis cartas' })
        .then(function () { if (!U.s) return; U.tapa = false; U.visor = h; despues(); });
    } else despues();
    return true;
  }

  /* ---------- online (lo usa js/online/j-uno.js) ---------- */
  window.Uno = { online: {
    iniciar: function (cfg) {
      clearTimeout(U.timer); PasarMovil.quitar();
      U.modo = 'online'; U.s = null; U.tapa = false; U.p = cfg.p; U.online = cfg; U.pub = cfg.pub || null; U.mano = cfg.mano || []; U.eraMio = false;
      $('unoElegir').style.display = 'none'; pintar();
    },
    publico: function (v) { if (U.modo !== 'online') return; U.pub = v; pintar(); },
    mano: function (m) { if (U.modo !== 'online') return; U.mano = m || []; pintar(); },
    salir: function () { if (U.modo === 'online') menu(); },
    activo: function () { return U.modo === 'online'; }
  } };

  $('unoNewGame').addEventListener('click', function () {
    if (U.modo === 'online') { if (window.Sala) window.Sala.toast('En línea: el anfitrión puede volver al lobby con «↩ Lobby» y cualquiera puede salir de la sala.'); return; }
    if (window.Partida) window.Partida.borrar('uno');
    menu();
  });
  $('unoSave').addEventListener('click', guardarPartida);
  window.initUno = function () { if (!U.modo && !restaurar()) menu(); };
  window.pauseUno = function () { U.pausado = true; clearTimeout(U.timer); };
  window.resumeUno = function () { U.pausado = false; if (U.s && U.modo !== 'online' && !U.tapa && U.jug[U.s.turno] && U.jug[U.s.turno].cpu) programarCpu(); };
  /* solo lectura / pruebas */
  window.unoEstado = function () { return { modo: U.modo, visor: U.visor, tapa: U.tapa, p: U.p, s: U.s && JSON.parse(JSON.stringify(U.s)), pub: U.pub, mano: (manoAct() || []).slice(), jug: U.jug }; };
  window.unoRetardo = function (ms) { U.retardo = ms; };
})();

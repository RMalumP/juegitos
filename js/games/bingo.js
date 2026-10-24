/* bingo.js — Juegos XP: Bingo de 90 bolas.
   · Un único modo para cantar las bolas («Bolero»): bombo animado, tablero 1–90, voz, modo automático y «Comprobar cartones». El Bolero puede añadirse
     cartones propios (0–6) que salen debajo y juega con ellos a la vez; con 0 sirve para partidas con cartones físicos.
   · Online (App «Multijugador», js/online/sala.js): el anfitrión es el Bolero y cada jugador tiene sus cartones en su móvil. El anfitrión reparte los cartones,
     saca las bolas y comprueba cada «¡Línea!» / «¡Bingo!» contra los cartones que él mismo ha repartido (nadie puede cantar en falso, tampoco él).
   · Cada cartón tiene un número único en toda la partida («Cartón Nº 7»). Un canto falso borra de ese cartón las casillas marcadas que no han salido.
   Reglas y comprobación de premios: js/bingo/engine.js (sin DOM, con tests). */
(function () {
  'use strict';
  var E = window.BingoEngine, LS = 'juegitos.bingo.';
  var $ = function (id) { return document.getElementById(id); };
  function lsGet(k) { try { return localStorage.getItem(LS + k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(LS + k, v); } catch (e) { /* sin almacenamiento */ } }
  function lsDel(k) { try { localStorage.removeItem(LS + k); } catch (e) { /* nada */ } }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function toast(m) { if (window.Sala) window.Sala.toast(m); }
  function parse(s, fb) { try { var v = JSON.parse(s); return v === undefined || v === null ? fb : v; } catch (e) { return fb; } }

  var B = {
    vista: 'menu',                 // sin sala: 'menu' | 'juego'
    voz: lsGet('voz') !== '0', vozJ: lsGet('vozj') === '1', autoMarca: lsGet('automarca') === '1',
    seg: +lsGet('seg') || 6, auto: false, autoT: null,
    p: null,                       // partida del Bolero (engine): bombo secreto, bolas, cartones repartidos (también los suyos), premios
    cfg: { linea: true, host: +lsGet('carthost') || 0 }, ronda: 0, anuncio: null,
    nCart: +lsGet('ncart') || 0,   // cartones propios del Bolero en local
    vistoN: 0, hostListo: false, quiere: 1
  };
  var online = function () { return !!(window.Sala && window.Sala.activo); };
  var esHost = function () { return online() && window.Sala.host; };
  var esJugadorOnline = function () { return online() && !window.Sala.host; };
  var uid = function () { return online() ? window.Sala.uid : 'yo'; };
  var miNombre = function () { return online() ? (window.Sala.nombre || 'Bolero') : 'Yo'; };

  /* ---------- voz y avisos ---------- */
  function decir(n) {
    if (!('speechSynthesis' in window)) return;
    try {
      var d = n >= 10 ? '. ' + String(n).split('').join(', ') : '';
      var u = new SpeechSynthesisUtterance(n + d); u.lang = 'es-ES'; u.rate = 0.9;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    } catch (e) { /* sin voz */ }
  }
  function decirTexto(t) {
    if (!('speechSynthesis' in window)) return;
    try { var u = new SpeechSynthesisUtterance(t); u.lang = 'es-ES'; window.speechSynthesis.speak(u); } catch (e) { /* sin voz */ }
  }
  function vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* nada */ } }

  /* ---------- piezas de interfaz ---------- */
  function bola(n, cls) { return mk('div', 'bgBola ' + (cls || '') + ' c' + E.columnaDe(n), '<span>' + n + '</span>'); }
  function tablero(salidas, ultima) {
    var t = mk('div', 'bgTablero');
    for (var n = 1; n <= 90; n++) t.appendChild(mk('div', 'bgT' + (salidas.has(n) ? ' sal' : '') + (n === ultima ? ' ult' : ''), String(n)));
    return t;
  }
  function cabeceraBola(bolas) {
    var c = mk('div', 'bgCabBola');
    var ult = bolas.length ? bolas[bolas.length - 1] : null;
    var grande = mk('div', 'bgGrande');
    if (ult) grande.appendChild(bola(ult, 'grande nueva')); else grande.innerHTML = '<div class="bgBola grande vacia"><span>?</span></div>';
    var lado = mk('div', 'bgLado');
    lado.innerHTML = '<div class="bgCuenta">Bola <b>' + bolas.length + '</b> de 90</div>';
    var prev = mk('div', 'bgPrev');
    bolas.slice(-6, -1).reverse().forEach(function (n) { prev.appendChild(bola(n, 'mini')); });
    lado.appendChild(prev);
    c.appendChild(grande); c.appendChild(lado);
    return c;
  }
  function boton(txt, cls, fn) { var b = mk('button', 'bgBtn ' + (cls || ''), txt); if (fn) b.onclick = fn; return b; }
  function interruptor(txt, activo, fn) { var b = mk('button', 'bgSw' + (activo ? ' on' : ''), txt); b.onclick = fn; return b; }
  function stepper(valor, min, max, etiqueta, cambiar) {
    var pas = mk('div', 'bgStep');
    var menos = boton('−', '', function () { if (valor > min) cambiar(valor - 1); }), mas = boton('+', '', function () { if (valor < max) cambiar(valor + 1); });
    menos.disabled = valor <= min; mas.disabled = valor >= max;
    pas.appendChild(menos); pas.appendChild(mk('div', 'bgStepN', '<b>' + valor + '</b><small>' + etiqueta + '</small>')); pas.appendChild(mas);
    return pas;
  }
  function cartonEl(c, marc) {
    var caja = mk('div', 'bgCarton'), grid = mk('div', 'bgCartonG');
    for (var f = 0; f < 3; f++) for (var k = 0; k < 9; k++) {
      var n = c[f][k];
      grid.appendChild(mk('div', 'bgC' + (n ? '' : ' vacio') + (n && marc.has(n) ? ' marc' : ''), n ? String(n) : ''));
    }
    caja.appendChild(grid);
    return caja;
  }
  function faltaTxt(f) {
    if (f.bingo === 0) return '¡cartón lleno!';
    return (f.linea === 0 ? 'línea completa' : f.linea === 1 ? 'falta 1 para línea' : 'faltan ' + f.linea + ' para línea') + ' · ' + f.bingo + ' para bingo';
  }
  function wrap() { return $('bingoWrap'); }
  function pintar(nodos) { var w = wrap(); if (!w) return; var y = w.scrollTop; w.innerHTML = ''; nodos.forEach(function (n) { if (n) w.appendChild(n); }); w.scrollTop = y; }
  function overlay(titulo, nodos) {
    var w = $('winBingo'), viejo = w.querySelector('.bgOverlay'); if (viejo) viejo.remove();
    var o = mk('div', 'bgOverlay'), caja = mk('div', 'bgOvBox'), cab = mk('div', 'bgOvCab', '<b>' + esc(titulo) + '</b>');
    var x = mk('button', 'bgOvX', '✕'); x.onclick = function () { o.remove(); }; cab.appendChild(x);
    var cuerpo = mk('div', 'bgOvCuerpo'); nodos.forEach(function (n) { cuerpo.appendChild(n); });
    caja.appendChild(cab); caja.appendChild(cuerpo); o.appendChild(caja); w.appendChild(o);
    return o;
  }

  /* ---------- datos de la partida (jugador online o Bolero/local) ---------- */
  function ganadosPub(p) {
    var g = {};
    Object.keys(p.ganados).forEach(function (k) { g[k] = { nombres: p.ganados[k].ganadores.map(function (x) { return x.nombre; }), bola: p.ganados[k].bola, total: p.ganados[k].total }; });
    return g;
  }
  function bolasActuales() { return esJugadorOnline() ? (window.Sala.estado.bolas || []) : (B.p ? B.p.bolas : []); }
  function premiosActuales() { return esJugadorOnline() ? (window.Sala.estado.premios || ['linea', 'bingo']) : (B.p ? B.p.premios : ['linea', 'bingo']); }
  function ganadosActuales() { return esJugadorOnline() ? (window.Sala.estado.ganados || {}) : (B.p ? ganadosPub(B.p) : {}); }
  function misCartones() {
    if (esJugadorOnline()) { var r = window.Sala.rol; return r && r.cartones && r.cartones.length ? { cartones: r.cartones, nums: r.nums || [] } : null; }
    var p = B.p, c = p && p.cartones[uid()];
    return c && c.length ? { cartones: c, nums: p.nums[uid()] } : null;
  }
  /* marcas a mano: se guardan por partida, así sobreviven a recargar la página */
  function claveMarcas() {
    if (esJugadorOnline()) return 'marcas.' + window.Sala.sala + '.' + (window.Sala.estado.ronda || 0) + '.' + window.Sala.uid;
    return 'marcas.' + (online() ? window.Sala.sala : 'local') + '.' + (B.p ? B.p.semilla : 0) + '.' + uid();
  }
  function marcasObj() { return parse(lsGet(claveMarcas()), {}); }
  function guardarMarcas(m) { lsSet(claveMarcas(), JSON.stringify(m)); }
  // Tras un canto falso: se quitan del cartón las casillas marcadas que NO han salido (las correctas se quedan).
  function quitarFalsas(idx, motivo) {
    var m = marcasObj(), lista = m[idx] || [], falsas = E.marcasFalsas(lista, bolasActuales()), txt = motivo || '';
    if (falsas.length) {
      m[idx] = lista.filter(function (n) { return falsas.indexOf(n) < 0; }); guardarMarcas(m);
      txt += ' Se ' + (falsas.length === 1 ? 'ha quitado 1 casilla mal marcada' : 'han quitado ' + falsas.length + ' casillas mal marcadas') + '.';
    }
    if (txt) toast(txt.trim());
    vibrar(200); render();
  }

  /* ---------- cartones propios (jugador online, Bolero online o local) ---------- */
  function bloquesCartones() {
    var mis = misCartones(); if (!mis) return [];
    var bolas = bolasActuales(), sal = new Set(bolas), premios = premiosActuales(), ganados = ganadosActuales(), marcas = marcasObj(), fin = esJugadorOnline() ? window.Sala.estado.phase === 'fin' : !!(B.p && B.p.fin);
    var n = [];
    mis.cartones.forEach(function (c, i) {
      var man = new Set(marcas[i] || []);
      var efect = B.autoMarca ? new Set(Array.from(man).concat(E.numerosDe(c).filter(function (x) { return sal.has(x); }))) : man;
      var bloque = mk('div', 'bgBloque');
      bloque.appendChild(mk('div', 'bgBCab', '<b>Cartón Nº ' + (mis.nums[i] || i + 1) + '</b><span>' + (bolas.length ? faltaTxt(E.faltan(c, sal)) : '') + '</span>'));
      var caja = cartonEl(c, efect);
      Array.prototype.forEach.call(caja.querySelectorAll('.bgC:not(.vacio)'), function (el) {
        var num = +el.textContent;
        el.onclick = function () { var m = marcasObj(), s = new Set(m[i] || []); if (s.has(num)) s.delete(num); else s.add(num); m[i] = Array.from(s); guardarMarcas(m); render(); };
      });
      bloque.appendChild(caja);
      var acc = mk('div', 'bgFila');
      var lineaLista = E.filasCompletas(c, efect).length > 0, bingoListo = E.esBingo(c, efect);
      if (premios.indexOf('linea') >= 0) { var bl = boton('¡LÍNEA!', 'cantar' + (lineaLista && !ganados.linea ? ' lista' : ''), function () { cantarMio('linea', i); }); bl.disabled = !!ganados.linea || fin; acc.appendChild(bl); }
      var bb = boton('¡BINGO!', 'cantar' + (bingoListo && !ganados.bingo ? ' lista' : ''), function () { cantarMio('bingo', i); }); bb.disabled = !!ganados.bingo || fin; acc.appendChild(bb);
      bloque.appendChild(acc); n.push(bloque);
    });
    return n;
  }
  function cantarMio(premio, idx) {
    if (esJugadorOnline()) window.Sala.enviar('host', { tipo: 'cantar', premio: premio, c: idx }).catch(function (e) { toast(e.message); });
    else resolverCanto(uid(), premio, idx);
  }
  function ajustesCartones() {
    var f = mk('div', 'bgFila');
    f.appendChild(interruptor('Marcado automático', B.autoMarca, function () { B.autoMarca = !B.autoMarca; lsSet('automarca', B.autoMarca ? '1' : '0'); render(); }));
    return f;
  }
  function seccionMisCartones() {
    var b = bloquesCartones(); if (!b.length) return [];
    return [mk('div', 'bgSub', '🎟️ Mis cartones'), ajustesCartones()].concat(b);
  }

  /* =====================================================================
                         BOLERO (local y anfitrión)
     ===================================================================== */
  function guardarBolero() {
    if (online()) { if (esHost()) window.Sala.guardarExtra({ juego: 'bingo', p: B.p, cfg: B.cfg, ronda: B.ronda }); return; }
    if (B.p) lsSet('bolero', JSON.stringify(B.p)); else lsDel('bolero');
  }
  function publicarEstado(extra) {
    var p = B.p, pub = { juego: 'bingo', bolas: p ? p.bolas.slice() : null };
    if (p) { pub.premios = p.premios; pub.ganados = ganadosPub(p); }
    Object.assign(pub, extra || {});
    return window.Sala.enviar('todos', Object.assign({ tipo: 'estado' }, pub));
  }
  function premiosCfg() { return B.cfg.linea ? ['linea', 'bingo'] : ['bingo']; }
  function nuevaLocal() {
    pararAuto();
    B.p = E.nuevaPartida({ jugadores: [{ id: 'yo', nombre: 'Yo', cartones: B.nCart }], premios: premiosCfg() });
    B.vista = 'juego'; B.vistoN = 0; guardarBolero(); render();
  }
  function sacar() {
    if (!B.p) return;
    var b = E.sacar(B.p);
    if (b === null) { pararAuto(); toast(B.p.fin ? 'La partida ha terminado' : 'Ya han salido las 90 bolas'); render(); return; }
    B.vistoN = B.p.bolas.length;
    if (B.voz) decir(b);
    vibrar(25);
    guardarBolero();
    if (esHost()) publicarEstado().catch(function (e) { toast(e.message); });
    render();
  }
  function pararAuto() { B.auto = false; clearInterval(B.autoT); B.autoT = null; }
  function alternarAuto() {
    if (B.auto) { pararAuto(); render(); return; }
    B.auto = true; sacar();
    B.autoT = setInterval(function () { if (!B.p || B.p.fin || B.p.bolas.length >= 90) { pararAuto(); render(); return; } sacar(); }, B.seg * 1000);
    render();
  }
  function salirLocal() {
    if (!confirm('¿Terminar la partida? Se pierden las bolas que han salido.')) return;
    pararAuto(); B.p = null; B.vista = 'menu'; guardarBolero(); render();
  }
  // Un canto (de otro jugador, o propio del Bolero) se valida con los cartones que el propio Bolero ha repartido.
  function resolverCanto(id, premio, idx) {
    if (!B.p) return;
    var r = E.cantar(B.p, id, premio, idx | 0);
    if (!r.ok) {
      if (id === uid()) quitarFalsas(idx, r.motivo);
      else window.Sala.enviar(id, { tipo: 'evento', k: 'falso', texto: r.motivo, c: idx | 0 }).catch(function () {});
      return;
    }
    pararAuto(); guardarBolero();
    var nombres = r.ganadores.map(function (g) { return g.nombre; });
    B.anuncio = { premio: r.premio, nombres: nombres };
    if (B.voz) decirTexto((r.premio === 'linea' ? 'Línea de ' : 'Bingo de ') + nombres.join(' y '));
    vibrar([60, 40, 60]);
    if (esHost()) {
      publicarEstado(B.p.fin ? { phase: 'fin' } : {}).then(function () {
        return window.Sala.enviar('todos', { tipo: 'evento', k: 'premio', premio: r.premio, nombres: nombres });
      }).catch(function () {});
    }
    render();
  }
  function ajustes() {
    var f = mk('div', 'bgFila');
    f.appendChild(interruptor('🔊 Voz', B.voz, function () { B.voz = !B.voz; lsSet('voz', B.voz ? '1' : '0'); if (!B.voz && window.speechSynthesis) window.speechSynthesis.cancel(); render(); }));
    var sel = mk('select', 'bgSel');
    [3, 5, 6, 8, 12, 20].forEach(function (s) { var o = mk('option', '', 'cada ' + s + ' s'); o.value = s; if (s === B.seg) o.selected = true; sel.appendChild(o); });
    sel.onchange = function () { B.seg = +sel.value; lsSet('seg', B.seg); if (B.auto) { pararAuto(); alternarAuto(); } };
    f.appendChild(sel);
    return f;
  }
  function bannerPremios() {
    var p = B.p, g = ganadosActuales(), b = mk('div', 'bgPremios');
    (p ? p.premios : ['linea', 'bingo']).forEach(function (k) {
      var x = g[k];
      b.appendChild(mk('div', 'bgPrem' + (x ? ' hecho' : ''), '<b>' + (k === 'linea' ? 'Línea' : 'Bingo') + '</b><span>' + (x ? '🏆 ' + esc(x.nombres.join(', ')) + ' · bola ' + x.bola : 'sin cantar') + '</span>'));
    });
    return b;
  }
  function vistaBolero() {
    var bolas = B.p ? B.p.bolas : [], sal = new Set(bolas), n = [];
    n.push(cabeceraBola(bolas));
    n.push(bannerPremios());
    var fin = B.p.fin || bolas.length >= 90;
    if (B.p.fin) n.push(mk('div', 'bgFin', '🏆 ¡Bingo de ' + esc(((ganadosActuales().bingo || { nombres: [] }).nombres).join(' y ')) + '!'));
    var acc = mk('div', 'bgFila');
    var sb = boton(fin ? 'Fin de la partida' : '🎱 Sacar bola', 'grande', fin ? null : sacar); sb.disabled = fin; acc.appendChild(sb);
    acc.appendChild(boton(B.auto ? '⏸ Pausar' : '▶ Automático', B.auto ? 'on' : '', alternarAuto));
    n.push(acc); n.push(ajustes());
    n.push(tablero(sal, bolas.length ? bolas[bolas.length - 1] : 0));
    var pie = mk('div', 'bgFila');
    pie.appendChild(boton('🔍 Comprobar cartones', '', comprobar));
    pie.appendChild(boton(esHost() ? '⏹ Terminar' : '⏹ Terminar', '', esHost() ? terminarPartida : salirLocal));
    n.push(pie);
    return n.concat(seccionMisCartones());
  }

  /* ---------- comprobar cartones (el Bolero mira los cartones por su número) ---------- */
  function comprobar() {
    var lista = B.p ? E.listarCartones(B.p) : [], nodos = [];
    if (lista.length) {
      nodos.push(mk('div', 'bgSub', 'Toca un cartón para verlo con las bolas que han salido.'));
      lista.forEach(function (it) {
        var fila = mk('button', 'bgCk' + (it.faltan.bingo === 0 ? ' bingo' : it.faltan.linea === 0 ? ' linea' : ''), '<b>Nº ' + it.num + '</b><span>' + esc(it.nombre) + '</span><small>' + faltaTxt(it.faltan) + '</small>');
        fila.onclick = function () { detalleCarton(it); };
        nodos.push(fila);
      });
    } else nodos.push(mk('div', 'bgVacio', 'Nadie tiene cartones en esta partida.'));
    nodos.push(boton('✍️ Cartón físico (escribir sus números)', '', cartonFisico));
    overlay('Comprobar cartones', nodos);
  }
  function detalleCarton(it) {
    var sal = new Set(B.p.bolas), lineas = E.filasCompletas(it.carton, sal), bingo = E.esBingo(it.carton, sal);
    var nodos = [mk('div', 'bgCkCab', 'Cartón <b>Nº ' + it.num + '</b> · ' + esc(it.nombre)), cartonEl(it.carton, sal)];
    nodos.push(mk('div', 'bgVeredicto ' + (lineas.length ? 'si' : 'no'), (lineas.length ? '✅ Línea completa (fila ' + lineas.map(function (f) { return f + 1; }).join(', ') + ')' : '❌ Sin línea todavía')));
    nodos.push(mk('div', 'bgVeredicto ' + (bingo ? 'si' : 'no'), bingo ? '✅ Cartón lleno: ¡BINGO!' : '❌ Sin bingo (' + faltaTxt(it.faltan).split(' · ')[1] + ')'));
    nodos.push(boton('← Volver a la lista', '', comprobar));
    overlay('Cartón Nº ' + it.num, nodos);
  }
  function cartonFisico() {
    var t = prompt('Escribe los números del cartón (la línea de 5, o el cartón entero de 15), separados por espacios o comas:');
    if (!t) return;
    var nums = t.split(/[^0-9]+/).filter(Boolean).map(Number).filter(function (n) { return n >= 1 && n <= 90; });
    if (!nums.length) { toast('No he entendido ningún número'); return; }
    var sal = new Set(B.p ? B.p.bolas : []), faltan = nums.filter(function (n) { return !sal.has(n); });
    alert(faltan.length ? 'Faltan por salir: ' + faltan.join(', ') + '. De ' + nums.length + ' números, han salido ' + (nums.length - faltan.length) + '.' : '✅ Correcto: han salido los ' + nums.length + ' números.');
  }

  /* ---------- anfitrión: lobby, reparto, cantos ---------- */
  function hostIniciar() {
    if (B.hostListo) return; B.hostListo = true;
    B.cfg.host = +lsGet('carthost') || 0;
    var ex = window.Sala.leerExtra();
    if (ex && ex.juego === 'bingo' && ex.p) { // el anfitrión recargó la página a mitad de partida
      B.p = ex.p; B.cfg = Object.assign(B.cfg, ex.cfg || {}); B.ronda = ex.ronda || 0; B.vistoN = B.p.bolas.length;
      toast('Partida recuperada');
      return;
    }
    B.p = null;
    if (ex && ex.juego === 'bingo') B.cfg = Object.assign(B.cfg, ex.cfg || {});
    B.ronda = (ex && ex.ronda) || (window.Sala.estado.ronda || 0);
    window.Sala.enviar('todos', { tipo: 'estado', juego: 'bingo', phase: 'lobby', ronda: B.ronda, cartones: {} }).catch(function () {});
  }
  function solicitudDe(id) { var c = window.Sala.estado.cartones; return Math.max(1, Math.min(E.MAX_CARTONES, (c && c[id]) | 0 || 1)); }
  function empezar() {
    var invitados = window.Sala.jug.filter(function (j) { return !j.esAnfitrion; });
    if (!invitados.length) { toast('Aún no se ha unido nadie'); return; }
    var js = invitados.map(function (j) { return { id: j.id, nombre: j.nombre, cartones: solicitudDe(j.id) }; });
    js.unshift({ id: window.Sala.uid, nombre: miNombre(), cartones: B.cfg.host });  // el Bolero juega con sus cartones propios (0 = ninguno)
    B.p = E.nuevaPartida({ jugadores: js, premios: premiosCfg() });
    B.ronda++; B.vistoN = 0;
    var envios = invitados.map(function (j) { return window.Sala.enviar(j.id, { tipo: 'rol', ronda: B.ronda, cartones: B.p.cartones[j.id], nums: B.p.nums[j.id] }); });
    Promise.all(envios).then(function () {
      guardarBolero();
      return publicarEstado({ phase: 'jugando', ronda: B.ronda, cartones: null, bolas: [] });
    }).catch(function (e) { toast(e.message); });
  }
  function reiniciarSala() {
    pararAuto();
    var js = window.Sala.jug.filter(function (j) { return !j.esAnfitrion; });
    Promise.all(js.map(function (j) { return window.Sala.enviar(j.id, { tipo: 'rol', ronda: B.ronda, cartones: [], nums: [] }); })).then(function () {
      B.p = null; B.vistoN = 0; guardarBolero();
      return window.Sala.enviar('todos', { tipo: 'estado', juego: 'bingo', phase: 'lobby', ronda: B.ronda, bolas: null, premios: null, ganados: null, cartones: {} });
    }).catch(function (e) { toast(e.message); });
  }
  function terminarPartida() { if (confirm('¿Terminar la partida y volver a la sala de espera?')) reiniciarSala(); }
  function alMensaje(m) {
    if (!esHost()) return;
    var est = window.Sala.estado;
    if (m.tipo === 'solicitud' && est.phase === 'lobby') {
      var n = Math.max(1, Math.min(E.MAX_CARTONES, m.cartones | 0 || 1)), c = Object.assign({}, est.cartones || {}); c[m.de] = n;
      window.Sala.enviar('todos', { tipo: 'estado', cartones: c }).catch(function () {});
    } else if (m.tipo === 'cantar' && est.phase === 'jugando' && B.p) resolverCanto(m.de, m.premio, m.c);
  }
  function vistaHostLobby() {
    var n = [];
    n.push(mk('div', 'bgSala', '<div class="bgSalaT">🎱 Sala «' + esc(window.Sala.sala) + '»</div><div class="bgSalaS">Eres el <b>Bolero</b>. Comparte la sala: quien abra el enlace o el QR solo tiene que poner su nombre.</div>'));
    var comp = mk('div', 'bgFila');
    comp.appendChild(boton('🔗 Compartir', '', function () { window.Sala.compartir(); }));
    comp.appendChild(boton('▦ QR', '', function () { window.Sala.qr(); }));
    n.push(comp);
    n.push(mk('div', 'bgNota', '⚠️ El enlace y el QR incluyen la contraseña de la sala.'));
    var lista = mk('div', 'bgLista'), hay = 0;
    window.Sala.jug.forEach(function (j) {
      if (j.esAnfitrion) return; hay++;
      lista.appendChild(mk('div', 'bgJ' + (j.conectado ? '' : ' off'), '<span>' + esc(j.nombre) + '</span><b>' + solicitudDe(j.id) + ' 🎟️</b>'));
    });
    if (!hay) lista.appendChild(mk('div', 'bgVacio', 'Esperando jugadores…'));
    n.push(lista);
    n.push(mk('div', 'bgSub', 'Mis cartones (yo también juego)'));
    n.push(stepper(B.cfg.host, 0, E.MAX_CARTONES, B.cfg.host === 1 ? 'cartón' : 'cartones', function (v) { B.cfg.host = v; lsSet('carthost', v); render(); }));
    var op = mk('div', 'bgFila');
    op.appendChild(interruptor('Premio de línea', B.cfg.linea, function () { B.cfg.linea = !B.cfg.linea; render(); }));
    op.appendChild(interruptor('🔊 Voz', B.voz, function () { B.voz = !B.voz; lsSet('voz', B.voz ? '1' : '0'); render(); }));
    n.push(op);
    var go = boton('▶ Empezar partida', 'grande', empezar); go.disabled = !hay; n.push(go);
    return n;
  }
  function vistaHostFin() {
    var est = window.Sala.estado, n = [bannerPremios()];
    n.push(mk('div', 'bgFin', '🏆 ¡Bingo de ' + esc((((est.ganados || {}).bingo || { nombres: [] }).nombres).join(' y ')) + '!<br><small>' + (est.bolas || []).length + ' bolas</small>'));
    n.push(cabeceraBola(est.bolas || []));
    n.push(boton('🔍 Comprobar cartones', '', comprobar));
    n.push(boton('↺ Nueva partida', 'grande', reiniciarSala));
    return n.concat(seccionMisCartones());
  }

  /* =====================================================================
                              JUGADOR (online)
     ===================================================================== */
  function vistaJugador() {
    var est = window.Sala.estado, n = [];
    if (est.juego && est.juego !== 'bingo') return [mk('div', 'bgVacio', 'La sala está jugando a otro juego.')];
    if (!est.phase || est.phase === 'lobby') {
      n.push(mk('div', 'bgSala', '<div class="bgSalaT">🎟️ Sala «' + esc(window.Sala.sala) + '»</div><div class="bgSalaS">Esperando a que el Bolero empiece la partida.</div>'));
      var quiere = est.cartones && est.cartones[window.Sala.uid] ? est.cartones[window.Sala.uid] : B.quiere;
      n.push(mk('div', 'bgSub', '¿Cuántos cartones quieres?'));
      n.push(stepper(quiere, 1, E.MAX_CARTONES, quiere === 1 ? 'cartón' : 'cartones', pedir));
      var lista = mk('div', 'bgLista');
      window.Sala.jug.forEach(function (j) { lista.appendChild(mk('div', 'bgJ' + (j.conectado ? '' : ' off'), '<span>' + esc(j.nombre) + (j.esAnfitrion ? ' 👑' : '') + '</span>')); });
      n.push(lista);
      return n;
    }
    var bolas = est.bolas || [], ganados = est.ganados || {};
    n.push(cabeceraBola(bolas)); n.push(bannerPremios());
    var f = mk('div', 'bgFila');
    f.appendChild(interruptor('🔊 Voz', B.vozJ, function () { B.vozJ = !B.vozJ; lsSet('vozj', B.vozJ ? '1' : '0'); render(); }));
    n.push(f);
    if (est.phase === 'fin') n.push(mk('div', 'bgFin', '🏆 ¡Bingo de ' + esc(((ganados.bingo || {}).nombres || []).join(' y ')) + '!<br><small>Espera a que el Bolero empiece otra partida.</small>'));
    var b = seccionMisCartones();
    if (!b.length) n.push(mk('div', 'bgVacio', 'No tienes cartones en esta partida.')); else b.forEach(function (x) { n.push(x); });
    return n;
  }
  function pedir(n) {
    n = Math.max(1, Math.min(E.MAX_CARTONES, n)); B.quiere = n; lsSet('ncart-online', n);
    window.Sala.enviar('host', { tipo: 'solicitud', cartones: n }).catch(function (e) { toast(e.message); });
    render();
  }

  /* =====================================================================
                              menú local
     ===================================================================== */
  function vistaMenu() {
    var n = [mk('div', 'bgTitulo', '🎱 BINGO<br><small>90 bolas · 3×9</small>')];
    var g = parse(lsGet('bolero'), null);
    if (g && g.bombo && !g.fin && g.bolas.length < 90 && g.bolas.length) {
      n.push(boton('▶ Continuar partida<small>' + g.bolas.length + ' bolas · ' + ((g.cartones.yo || []).length ? (g.cartones.yo.length + ' cartón' + (g.cartones.yo.length > 1 ? 'es' : '') + ' tuyos') : 'sin cartones propios') + '</small>', 'menu', function () { B.p = g; B.vista = 'juego'; B.vistoN = g.bolas.length; render(); }));
    }
    n.push(mk('div', 'bgSub', 'Mis cartones (para jugar yo también mientras canto las bolas)'));
    n.push(stepper(B.nCart, 0, E.MAX_CARTONES, B.nCart === 0 ? 'solo canto bolas' : (B.nCart === 1 ? 'cartón' : 'cartones'), function (v) { B.nCart = v; lsSet('ncart', v); render(); }));
    var op = mk('div', 'bgFila');
    op.appendChild(interruptor('Premio de línea', B.cfg.linea, function () { B.cfg.linea = !B.cfg.linea; render(); }));
    n.push(op);
    n.push(boton('🎱 Empezar partida<small>' + (B.nCart ? 'Cantas las bolas y juegas con tus cartones' : 'Solo cantas las bolas (cartones físicos)') + '</small>', 'menu', nuevaLocal));
    n.push(boton('📡 Multijugador<small>Cada uno con su móvil · misma wifi</small>', 'menu', function () { window.Sala.abrir(); }));
    return n;
  }

  /* =====================================================================
                                    render
     ===================================================================== */
  function render() {
    if (!wrap()) return;
    var nodos;
    if (online()) {
      var est = window.Sala.estado;
      if (est.juego && est.juego !== 'bingo') {
        nodos = [mk('div', 'bgVacio', 'Esta sala es de otro juego.'), boton('Ir al juego de la sala', 'grande', function () { window.Sala.irAlJuego(); })];
      } else if (esHost()) {
        hostIniciar();
        nodos = est.phase === 'fin' ? vistaHostFin() : (est.phase === 'jugando' && B.p ? vistaBolero() : vistaHostLobby());
        if (est.phase === 'jugando') nodos.unshift(anuncioEl());
      } else { nodos = vistaJugador(); nodos.unshift(anuncioEl()); }
    } else {
      nodos = B.vista === 'juego' && B.p ? vistaBolero() : vistaMenu();
      if (B.vista === 'juego') nodos.unshift(anuncioEl());
    }
    $('bingoMenuSala').classList.toggle('on', online());
    pintar((nodos || []).filter(Boolean));
  }
  function anuncioEl() {
    if (!B.anuncio) return null;
    var a = B.anuncio, d = mk('div', 'bgAnuncio', '🏆 ¡' + (a.premio === 'linea' ? 'LÍNEA' : 'BINGO') + '!<br><b>' + esc(a.nombres.join(' y ')) + '</b>');
    d.onclick = function () { B.anuncio = null; render(); };
    return d;
  }

  /* ---------- eventos de la sala ---------- */
  function alEstado(est) {
    if (esHost()) { render(); return; }
    var bolas = est.bolas || [];
    if (bolas.length > B.vistoN && est.phase === 'jugando') { var ult = bolas[bolas.length - 1]; vibrar(30); if (B.vozJ) decir(ult); }
    B.vistoN = bolas.length;
    render();
  }
  function alEvento(m) {
    if (m.k === 'premio') {
      B.anuncio = { premio: m.premio, nombres: m.nombres || [] };
      if (B.vozJ) decirTexto((m.premio === 'linea' ? 'Línea de ' : 'Bingo de ') + (m.nombres || []).join(' y '));
      vibrar([60, 40, 60]); render();
    } else if (m.k === 'falso') quitarFalsas(m.c | 0, m.texto || 'No es válido.');
  }

  function init() {
    if (!E) { console.error('Bingo: falta js/bingo/engine.js'); return; }
    $('bingoMenuInicio').onclick = function () { if (online()) { toast('Estás en una sala: sal de ella para volver al inicio'); return; } pararAuto(); B.vista = 'menu'; render(); };
    $('bingoMenuSala').onclick = function () { window.Sala.abrir(); };
    $('bingoMenuVoz').onclick = function () { B.voz = !B.voz; B.vozJ = B.voz; lsSet('voz', B.voz ? '1' : '0'); lsSet('vozj', B.voz ? '1' : '0'); toast(B.voz ? '🔊 Voz activada' : '🔇 Voz desactivada'); render(); };
    B.quiere = +lsGet('ncart-online') || 1;
    if (window.Sala) {
      window.Sala.usarEn('bingo');
      window.Sala.on('estado', alEstado); window.Sala.on('rol', function () { render(); });
      window.Sala.on('jug', function () { render(); }); window.Sala.on('con', function () { render(); });
      window.Sala.on('evento', alEvento); window.Sala.on('msg', alMensaje);
      window.Sala.on('cierre', function () { B.hostListo = false; B.p = null; B.anuncio = null; B.vistoN = 0; pararAuto(); B.vista = 'menu'; render(); });
    }
    var w = $('winBingo');
    new MutationObserver(function () { if (!w.classList.contains('hidden')) render(); }).observe(w, { attributes: true, attributeFilter: ['class'] });
    render();
  }
  window.initBingo = init;
  window.initBingo.__lazy = false;
  window.BingoUI = { estado: B, render: render, sacar: sacar };
})();

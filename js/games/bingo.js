/* bingo.js — Juegos XP: Bingo de 90 bolas.
   · Local: «Bolero» (bombo animado, tablero 1–90, voz, comprobar cartón) y «Mis cartones» (cartones 3×9 que se marcan a toque, con aviso de línea y bingo).
   · Online (App «Sala online», js/online/sala.js): el anfitrión es el Bolero, cada jugador tiene sus cartones en su móvil. El anfitrión reparte los cartones,
     saca las bolas y comprueba cada «¡Línea!» / «¡Bingo!» contra los cartones que él mismo ha repartido (nadie puede cantar en falso).
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
    vista: 'menu',                 // sin sala: 'menu' | 'bolero' | 'cartones'
    voz: lsGet('voz') !== '0', vozJ: lsGet('vozj') === '1', autoMarca: lsGet('automarca') === '1',
    seg: +lsGet('seg') || 6, auto: false, autoT: null,
    p: null,                       // partida del Bolero (engine): bombo secreto, bolas, cartones repartidos, premios
    cfg: { linea: true }, ronda: 0, anuncio: null,
    loc: null,                     // cartones locales {cartones:[], marcas:[[n,…]], nombre}
    nCart: +lsGet('ncart') || 1, vistoN: 0, hostListo: false, quiere: 1
  };
  var online = function () { return !!(window.Sala && window.Sala.activo); };
  var esHost = function () { return online() && window.Sala.host; };

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
  function bola(n, cls) { var b = mk('div', 'bgBola ' + (cls || '') + ' c' + E.columnaDe(n), '<span>' + n + '</span>'); return b; }
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
  function cartonEl(c, marc, o) {
    o = o || {};
    var caja = mk('div', 'bgCarton'), grid = mk('div', 'bgCartonG');
    for (var f = 0; f < 3; f++) for (var k = 0; k < 9; k++) {
      var n = c[f][k], cel = mk('div', 'bgC' + (n ? '' : ' vacio') + (n && marc.has(n) ? ' marc' : '') + (n && o.salidas && o.salidas.has(n) ? ' sal' : ''), n ? String(n) : '');
      if (n && o.tap) (function (nn, el) { el.onclick = function () { o.tap(nn, el); }; })(n, cel);
      grid.appendChild(cel);
    }
    caja.appendChild(grid);
    return caja;
  }
  function wrap() { return $('bingoWrap'); }
  function pintar(nodos) { var w = wrap(); if (!w) return; w.innerHTML = ''; nodos.forEach(function (n) { if (n) w.appendChild(n); }); w.scrollTop = w.scrollTop; }

  /* =====================================================================
                              BOLERO (local y anfitrión)
     ===================================================================== */
  function guardarBolero() {
    if (online()) { if (esHost()) window.Sala.guardarExtra({ juego: 'bingo', p: B.p, cfg: B.cfg, ronda: B.ronda }); return; }
    if (B.p) lsSet('bolero', JSON.stringify(B.p)); else lsDel('bolero');
  }
  function publicarEstado(extra) {
    var p = B.p;
    var pub = { juego: 'bingo', bolas: p ? p.bolas.slice() : null };
    if (p) { pub.premios = p.premios; pub.ganados = {}; Object.keys(p.ganados).forEach(function (k) { pub.ganados[k] = { nombres: p.ganados[k].ganadores.map(function (g) { return g.nombre; }), bola: p.ganados[k].bola, total: p.ganados[k].total }; }); }
    Object.assign(pub, extra || {});
    return window.Sala.enviar('todos', Object.assign({ tipo: 'estado' }, pub));
  }
  function nuevoBombo() { B.p = E.nuevaPartida({ jugadores: [], premios: ['bingo'] }); B.vistoN = 0; guardarBolero(); }
  function sacar() {
    if (!B.p) nuevoBombo();
    var b = E.sacar(B.p);
    if (b === null) { pararAuto(); toast('Ya han salido las 90 bolas'); render(); return; }
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
  function nuevaLocal() {
    if (B.p && B.p.bolas.length && !confirm('¿Empezar un bombo nuevo? Se pierden las bolas que han salido.')) return;
    pararAuto(); nuevoBombo(); render();
  }
  function comprobar() {
    var t = prompt('Escribe los números del cartón (la línea de 5, o el cartón entero de 15), separados por espacios o comas:');
    if (!t) return;
    var nums = t.split(/[^0-9]+/).filter(Boolean).map(Number).filter(function (n) { return n >= 1 && n <= 90; });
    if (!nums.length) { toast('No he entendido ningún número'); return; }
    var sal = new Set(B.p ? B.p.bolas : []);
    var faltan = nums.filter(function (n) { return !sal.has(n); });
    alert(faltan.length ? 'Faltan por salir: ' + faltan.join(', ') + '. De ' + nums.length + ' números, han salido ' + (nums.length - faltan.length) + '.' : '✅ Correcto: han salido los ' + nums.length + ' números.');
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
  function vistaBolero() {
    var bolas = B.p ? B.p.bolas : [], sal = new Set(bolas), n = [];
    var lobbyOnline = esHost() && window.Sala.estado.phase === 'lobby';
    n.push(cabeceraBola(bolas));
    if (esHost()) n.push(bannerPremios());
    var fin = (B.p && B.p.fin) || bolas.length >= 90;
    var acc = mk('div', 'bgFila');
    acc.appendChild(boton(fin ? 'Fin de la partida' : '🎱 Sacar bola', 'grande', fin ? null : sacar));
    if (fin) acc.firstChild.disabled = true;
    acc.appendChild(boton(B.auto ? '⏸ Pausar' : '▶ Automático', B.auto ? 'on' : '', alternarAuto));
    n.push(acc);
    n.push(ajustes());
    n.push(tablero(sal, bolas.length ? bolas[bolas.length - 1] : 0));
    var pie = mk('div', 'bgFila');
    pie.appendChild(boton('🔍 Comprobar cartón', '', comprobar));
    if (esHost()) pie.appendChild(boton('⏹ Terminar', '', terminarPartida)); else pie.appendChild(boton('↺ Bombo nuevo', '', nuevaLocal));
    n.push(pie);
    return lobbyOnline ? null : n;
  }
  function bannerPremios() {
    var e = window.Sala.estado, g = e.ganados || {}, b = mk('div', 'bgPremios');
    (e.premios || ['linea', 'bingo']).forEach(function (k) {
      var x = g[k];
      b.appendChild(mk('div', 'bgPrem' + (x ? ' hecho' : ''), '<b>' + (k === 'linea' ? 'Línea' : 'Bingo') + '</b><span>' + (x ? '🏆 ' + esc(x.nombres.join(', ')) + ' · bola ' + x.bola : 'sin cantar') + '</span>'));
    });
    return b;
  }

  /* ---------- anfitrión: lobby, reparto, cantos ---------- */
  function hostIniciar() {
    if (B.hostListo) return; B.hostListo = true;
    var ex = window.Sala.leerExtra();
    if (ex && ex.juego === 'bingo' && ex.p) { // el anfitrión recargó la página a mitad de partida
      B.p = ex.p; B.cfg = ex.cfg || B.cfg; B.ronda = ex.ronda || 0; B.vistoN = B.p.bolas.length;
      toast('Partida recuperada');
      return;
    }
    if (ex && ex.juego === 'bingo') B.cfg = ex.cfg || B.cfg;
    B.ronda = (ex && ex.ronda) || (window.Sala.estado.ronda || 0);
    window.Sala.enviar('todos', { tipo: 'estado', juego: 'bingo', phase: 'lobby', ronda: B.ronda, cartones: {} }).catch(function () {});
  }
  function solicitudDe(id) { var c = window.Sala.estado.cartones; return Math.max(1, Math.min(E.MAX_CARTONES, (c && c[id]) | 0 || 1)); }
  function empezar() {
    var js = window.Sala.jug.filter(function (j) { return !j.esAnfitrion; }).map(function (j) { return { id: j.id, nombre: j.nombre, cartones: solicitudDe(j.id) }; });
    if (!js.length) { toast('Aún no se ha unido nadie'); return; }
    B.p = E.nuevaPartida({ jugadores: js, premios: B.cfg.linea ? ['linea', 'bingo'] : ['bingo'] });
    B.ronda++; B.vistoN = 0;
    var envios = js.map(function (j) { return window.Sala.enviar(j.id, { tipo: 'rol', ronda: B.ronda, cartones: B.p.cartones[j.id] }); });
    Promise.all(envios).then(function () {
      guardarBolero();
      return publicarEstado({ phase: 'jugando', ronda: B.ronda, cartones: null, bolas: [] });
    }).catch(function (e) { toast(e.message); });
  }
  function terminarPartida() {
    if (!confirm('¿Terminar la partida y volver a la sala de espera?')) return;
    pararAuto();
    var js = window.Sala.jug.filter(function (j) { return !j.esAnfitrion; });
    Promise.all(js.map(function (j) { return window.Sala.enviar(j.id, { tipo: 'rol', ronda: B.ronda, cartones: [] }); })).then(function () {
      B.p = null; B.vistoN = 0; guardarBolero();
      return window.Sala.enviar('todos', { tipo: 'estado', juego: 'bingo', phase: 'lobby', ronda: B.ronda, bolas: null, premios: null, ganados: null, cartones: {} });
    }).catch(function (e) { toast(e.message); });
  }
  function alMensaje(m) {
    if (!esHost()) return;
    var est = window.Sala.estado;
    if (m.tipo === 'solicitud' && est.phase === 'lobby') {
      var n = Math.max(1, Math.min(E.MAX_CARTONES, m.cartones | 0 || 1)), c = Object.assign({}, est.cartones || {}); c[m.de] = n;
      window.Sala.enviar('todos', { tipo: 'estado', cartones: c }).catch(function () {});
    } else if (m.tipo === 'cantar' && est.phase === 'jugando' && B.p) {
      var r = E.cantar(B.p, m.de, m.premio, m.c | 0);
      if (!r.ok) { window.Sala.enviar(m.de, { tipo: 'evento', k: 'falso', texto: r.motivo }).catch(function () {}); return; }
      pararAuto(); guardarBolero();
      var nombres = r.ganadores.map(function (g) { return g.nombre; });
      B.anuncio = { premio: r.premio, nombres: nombres };
      if (B.voz) decirTexto((r.premio === 'linea' ? 'Línea de ' : 'Bingo de ') + nombres.join(' y '));
      vibrar([60, 40, 60]);
      publicarEstado(B.p.fin ? { phase: 'fin' } : {}).then(function () {
        return window.Sala.enviar('todos', { tipo: 'evento', k: 'premio', premio: r.premio, nombres: nombres });
      }).catch(function () {});
      render();
    }
  }
  function vistaHostLobby() {
    var est = window.Sala.estado, n = [];
    var cab = mk('div', 'bgSala', '<div class="bgSalaT">🎱 Sala «' + esc(window.Sala.sala) + '»</div><div class="bgSalaS">Eres el <b>Bolero</b>. Los jugadores se unen desde el icono 📡 Multijugador con el nombre y la contraseña de la sala.</div>');
    n.push(cab);
    var lista = mk('div', 'bgLista'), hay = 0;
    window.Sala.jug.forEach(function (j) {
      if (j.esAnfitrion) return; hay++;
      lista.appendChild(mk('div', 'bgJ' + (j.conectado ? '' : ' off'), '<span>' + esc(j.nombre) + '</span><b>' + solicitudDe(j.id) + ' 🎟️</b>'));
    });
    if (!hay) lista.appendChild(mk('div', 'bgVacio', 'Esperando jugadores…'));
    n.push(lista);
    var op = mk('div', 'bgFila');
    op.appendChild(interruptor('Premio de línea', B.cfg.linea, function () { B.cfg.linea = !B.cfg.linea; guardarBolero(); render(); }));
    op.appendChild(interruptor('🔊 Voz', B.voz, function () { B.voz = !B.voz; lsSet('voz', B.voz ? '1' : '0'); render(); }));
    n.push(op);
    var go = boton('▶ Empezar partida', 'grande', empezar); go.disabled = !hay; n.push(go);
    n.push(boton('📡 Abrir la sala (QR / enlace)', '', window.Sala.abrir));
    return n;
  }
  function vistaHostFin() {
    var n = [bannerPremios()];
    n.push(mk('div', 'bgFin', '🏆 ¡Bingo de ' + esc(((window.Sala.estado.ganados || {}).bingo || { nombres: [] }).nombres.join(' y ')) + '!<br><small>' + (window.Sala.estado.bolas || []).length + ' bolas</small>'));
    n.push(cabeceraBola(window.Sala.estado.bolas || []));
    n.push(boton('↺ Nueva partida', 'grande', terminarPartidaSinPreguntar));
    return n;
  }
  function terminarPartidaSinPreguntar() { var c = window.confirm; window.confirm = function () { return true; }; try { terminarPartida(); } finally { window.confirm = c; } }

  /* =====================================================================
                              JUGADOR (online)
     ===================================================================== */
  function claveMarcas() { return 'marcas.' + window.Sala.sala + '.' + (window.Sala.estado.ronda || 0) + '.' + window.Sala.uid; }
  function marcasDe() { return parse(lsGet(claveMarcas()), {}); }
  function guardarMarcas(m) { lsSet(claveMarcas(), JSON.stringify(m)); }
  function cantar(premio, idx) { window.Sala.enviar('host', { tipo: 'cantar', premio: premio, c: idx }).catch(function (e) { toast(e.message); }); }
  function faltaTxt(f) {
    if (f.bingo === 0) return '¡cartón lleno!';
    return (f.linea === 0 ? 'línea completa' : f.linea === 1 ? 'falta 1 para línea' : 'faltan ' + f.linea + ' para línea') + ' · ' + f.bingo + ' para bingo';
  }
  function cartonesJugador(cartones, salidasArr, estPremios, ganados, marcasObj, guardar, ctxClave) {
    var n = [], sal = new Set(salidasArr);
    cartones.forEach(function (c, i) {
      var man = new Set(marcasObj[i] || []);
      var efect = B.autoMarca ? new Set(Array.from(man).concat(salidasArr.filter(function (x) { return E.numerosDe(c).indexOf(x) >= 0; }))) : man;
      var faltan = E.faltan(c, sal);
      var bloque = mk('div', 'bgBloque');
      var cab = mk('div', 'bgBCab', '<b>Cartón ' + (i + 1) + '</b><span>' + (salidasArr.length ? faltaTxt(faltan) : '') + '</span>');
      bloque.appendChild(cab);
      bloque.appendChild(cartonEl(c, efect, { salidas: null, tap: function (num, el) {
        var m = new Set(marcasObj[i] || []); if (m.has(num)) m.delete(num); else m.add(num);
        marcasObj[i] = Array.from(m); guardar(marcasObj); render();
      } }));
      var acc = mk('div', 'bgFila');
      var lineaLista = E.filasCompletas(c, efect).length > 0, bingoListo = E.esBingo(c, efect);
      if (estPremios.indexOf('linea') >= 0) {
        var bl = boton('¡LÍNEA!', 'cantar' + (lineaLista && !ganados.linea ? ' lista' : ''), function () { ctxClave('linea', i); });
        bl.disabled = !!ganados.linea; acc.appendChild(bl);
      }
      var bb = boton('¡BINGO!', 'cantar' + (bingoListo && !ganados.bingo ? ' lista' : ''), function () { ctxClave('bingo', i); });
      bb.disabled = !!ganados.bingo; acc.appendChild(bb);
      bloque.appendChild(acc);
      n.push(bloque);
    });
    return n;
  }
  function vistaJugador() {
    var est = window.Sala.estado, rol = window.Sala.rol, n = [];
    if (est.juego && est.juego !== 'bingo') return [mk('div', 'bgVacio', 'La sala está jugando a otro juego.')];
    if (!est.phase || est.phase === 'lobby') {
      n.push(mk('div', 'bgSala', '<div class="bgSalaT">🎟️ Sala «' + esc(window.Sala.sala) + '»</div><div class="bgSalaS">Esperando a que el Bolero empiece la partida.</div>'));
      var quiere = est.cartones && est.cartones[window.Sala.uid] ? est.cartones[window.Sala.uid] : B.quiere;
      var pas = mk('div', 'bgStep');
      var menos = boton('−', '', function () { pedir(quiere - 1); }), mas = boton('+', '', function () { pedir(quiere + 1); });
      pas.appendChild(menos); pas.appendChild(mk('div', 'bgStepN', '<b>' + quiere + '</b><small>cartón' + (quiere > 1 ? 'es' : '') + '</small>')); pas.appendChild(mas);
      n.push(mk('div', 'bgSub', '¿Cuántos cartones quieres?')); n.push(pas);
      var lista = mk('div', 'bgLista');
      window.Sala.jug.forEach(function (j) { lista.appendChild(mk('div', 'bgJ' + (j.conectado ? '' : ' off'), '<span>' + esc(j.nombre) + (j.esAnfitrion ? ' 👑' : '') + '</span>')); });
      n.push(lista);
      return n;
    }
    var bolas = est.bolas || [], ganados = est.ganados || {};
    n.push(cabeceraBola(bolas));
    n.push(bannerPremios());
    var f = mk('div', 'bgFila');
    f.appendChild(interruptor('Marcado automático', B.autoMarca, function () { B.autoMarca = !B.autoMarca; lsSet('automarca', B.autoMarca ? '1' : '0'); render(); }));
    f.appendChild(interruptor('🔊 Voz', B.vozJ, function () { B.vozJ = !B.vozJ; lsSet('vozj', B.vozJ ? '1' : '0'); render(); }));
    n.push(f);
    if (est.phase === 'fin') n.push(mk('div', 'bgFin', '🏆 ¡Bingo de ' + esc(((ganados.bingo || {}).nombres || []).join(' y ')) + '!<br><small>Espera a que el Bolero empiece otra partida.</small>'));
    var cartones = rol && rol.cartones && rol.cartones.length ? rol.cartones : null;
    if (!cartones) { n.push(mk('div', 'bgVacio', 'No tienes cartones en esta partida.')); return n; }
    cartonesJugador(cartones, bolas, est.premios || ['linea', 'bingo'], ganados, marcasDe(), guardarMarcas, est.phase === 'fin' ? function () {} : cantar).forEach(function (x) { n.push(x); });
    return n;
  }
  function pedir(n) {
    n = Math.max(1, Math.min(E.MAX_CARTONES, n)); B.quiere = n; lsSet('ncart', n);
    window.Sala.enviar('host', { tipo: 'solicitud', cartones: n }).catch(function (e) { toast(e.message); });
    render();
  }

  /* =====================================================================
                              LOCAL: menú y «Mis cartones»
     ===================================================================== */
  function vistaMenu() {
    var n = [mk('div', 'bgTitulo', '🎱 BINGO<br><small>90 bolas · 3×9</small>')];
    n.push(boton('🎱 Soy el Bolero<small>Saca las bolas con el bombo</small>', 'menu', function () { B.vista = 'bolero'; if (!B.p) { var g = parse(lsGet('bolero'), null); B.p = g && g.bombo ? g : null; } if (!B.p) nuevoBombo(); render(); }));
    n.push(boton('🎟️ Mis cartones<small>Marca tus cartones mientras otro canta</small>', 'menu', function () { B.vista = 'cartones'; cargarLocal(); render(); }));
    n.push(boton('📡 Jugar online con amigos<small>Cada uno con su móvil · misma wifi</small>', 'menu', window.Sala ? window.Sala.abrir : null));
    return n;
  }
  function cargarLocal() { if (!B.loc) { B.loc = parse(lsGet('local'), null); if (!B.loc || !B.loc.cartones) generarLocal(B.nCart); } }
  function generarLocal(n) {
    B.nCart = Math.max(1, Math.min(E.MAX_CARTONES, n)); lsSet('ncart', B.nCart);
    B.loc = { cartones: E.generarCartones(B.nCart, Math.random), marcas: [] }; lsSet('local', JSON.stringify(B.loc));
  }
  function vistaLocal() {
    cargarLocal();
    var n = [], ctl = mk('div', 'bgStep');
    ctl.appendChild(boton('−', '', function () { if (B.nCart > 1) { generarLocal(B.nCart - 1); render(); } }));
    ctl.appendChild(mk('div', 'bgStepN', '<b>' + B.nCart + '</b><small>cartón' + (B.nCart > 1 ? 'es' : '') + '</small>'));
    ctl.appendChild(boton('+', '', function () { if (B.nCart < E.MAX_CARTONES) { generarLocal(B.nCart + 1); render(); } }));
    n.push(ctl);
    var fila = mk('div', 'bgFila');
    fila.appendChild(boton('🔄 Cartones nuevos', '', function () { if (confirm('¿Cambiar tus cartones? Se borran las marcas.')) { generarLocal(B.nCart); render(); } }));
    fila.appendChild(boton('🧹 Quitar marcas', '', function () { B.loc.marcas = []; lsSet('local', JSON.stringify(B.loc)); render(); }));
    n.push(fila);
    n.push(mk('div', 'bgSub', 'Toca los números según los vaya cantando el Bolero.'));
    var vacio = { linea: false, bingo: false };
    cartonesJugador(B.loc.cartones, [], ['linea', 'bingo'], vacio, B.loc.marcas, function (m) { B.loc.marcas = m; lsSet('local', JSON.stringify(B.loc)); }, function (premio, i) {
      var m = new Set(B.loc.marcas[i] || []), c = B.loc.cartones[i];
      var ok = premio === 'linea' ? E.filasCompletas(c, m).length > 0 : E.esBingo(c, m);
      alert(ok ? '✅ ' + (premio === 'linea' ? '¡Línea!' : '¡BINGO!') + ' Dilo en voz alta, el Bolero lo comprobará.' : 'Todavía no tienes ' + (premio === 'linea' ? 'ninguna fila completa' : 'el cartón lleno') + ' en ese cartón.');
    }).forEach(function (x) { n.push(x); });
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
      if (esHost()) {
        hostIniciar();
        nodos = est.phase === 'fin' ? vistaHostFin() : (est.phase === 'jugando' ? vistaBolero() : vistaHostLobby());
        if (est.phase === 'jugando') nodos.unshift(anuncioEl());
      } else { nodos = vistaJugador(); nodos.unshift(anuncioEl()); }
    } else nodos = B.vista === 'bolero' ? vistaBolero() : B.vista === 'cartones' ? vistaLocal() : vistaMenu();
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
    } else if (m.k === 'falso') { toast(m.texto || 'No es válido'); vibrar(200); }
  }

  function init() {
    if (!E) { console.error('Bingo: falta js/bingo/engine.js'); return; }
    $('bingoMenuInicio').onclick = function () { if (online()) { toast('Estás en una sala: sal de ella para volver al inicio'); return; } pararAuto(); B.vista = 'menu'; render(); };
    $('bingoMenuSala').onclick = function () { window.Sala.abrir(); };
    $('bingoMenuVoz').onclick = function () { B.voz = !B.voz; B.vozJ = B.voz; lsSet('voz', B.voz ? '1' : '0'); lsSet('vozj', B.voz ? '1' : '0'); toast(B.voz ? '🔊 Voz activada' : '🔇 Voz desactivada'); render(); };
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

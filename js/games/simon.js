/* simon.js — Juegos XP: Simon (memoria de secuencias de colores y sonidos). 3 velocidades, récord por velocidad (simBest_<n>).
   Se toca/clica cada color o se usan las teclas 1-4 (también Q W A S). Sonidos con Web Audio.
   Modos: 1 jugador · varios en el mismo móvil (2-4, por turnos con «pasa el móvil») · online (2-6, todos a la vez; js/online/j-simon.js → Simon.online).
   En los modos de varios jugadores las rondas son por eliminación (js/online/simon-engine.js): quien falla queda fuera y gana el último en pie. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var FREQ = [392, 330, 262, 196], BASE = [800, 600, 420], NOMBRE = ['Lenta', 'Normal', 'Rápida'];
  var vel = 1, seq = [], pos = 0, fase = 'menu', ronda = 0, mejor = 0, ac = null, tm = [];
  // Varios jugadores: modo 'solo' | 'local' | 'online'; est = estado del motor; actor = a quién le toca (local); yo = mi asiento (online)
  var modo = 'solo', M = { est: null, nombres: [], actor: -1, yo: -1, resp: [], online: null, rondaVista: -1, nLocal: 2, aviso: '' }, gen = 0;
  try { var sv = parseInt(localStorage.getItem('simVel'), 10); if (sv >= 0 && sv <= 2) vel = sv; } catch (e) { /* sin ajustes */ }
  try { var sn = parseInt(localStorage.getItem('simJugadores'), 10); if (sn >= 2 && sn <= 4) M.nLocal = sn; } catch (e) { /* sin ajustes */ }
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }
  function leerMejor() { try { return parseInt(localStorage.getItem('simBest_' + vel), 10) || 0; } catch (e) { return 0; } }
  function esp(ms) { return window.simRapido ? ms / 25 : ms; }
  function multi() { return modo === 'local' || modo === 'online'; }
  function velJuego() { return multi() && M.est ? M.est.vel : vel; }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nombre(p) { return M.nombres[p] || 'Jugador ' + (p + 1); }
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } return ac; }
  function tono(f, ms, tipo) {
    if (!audio()) return; if (ac.state === 'suspended') ac.resume();
    var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = tipo || 'sine'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.start(t); o.stop(t + ms / 1000 + 0.02);
  }
  function encender(i, ms) {
    var p = document.querySelector('.simPad[data-i="' + i + '"]'); if (!p) return;
    p.classList.add('on'); tono(FREQ[i], Math.max(ms, 120)); setTimeout(function () { p.classList.remove('on'); }, Math.max(esp(ms), 40));
  }
  function limpiar() { tm.forEach(clearTimeout); tm = []; gen++; }
  function textoEstado() {
    if (fase === 'muestra') return '👀 ' + (modo === 'local' ? nombre(M.actor) + ', memoriza…' : 'Memoriza…');
    if (fase === 'turno') return '👉 ' + (modo === 'local' ? nombre(M.actor) : 'Tu turno') + ' (' + pos + '/' + seq.length + ')';
    if (fase === 'espera') return M.aviso;
    return fase === 'fin' ? '' : 'Pulsa EMPEZAR';
  }
  function pintarJugadores() {
    var c = $('simJug'); if (!c) return;
    c.style.display = multi() && M.est ? 'flex' : 'none';
    if (!multi() || !M.est) return;
    var e = M.est, h = '';
    for (var p = 0; p < e.n; p++) {
      var ico = !e.vivos[p] ? (e.ganadores.indexOf(p) >= 0 ? '🏆' : '❌') : e.ganadores.indexOf(p) >= 0 ? '🏆' : e.resp[p] === true ? '✅' : modo === 'local' && p === M.actor ? '👉' : '⏳';
      var cls = 'simJ' + (e.vivos[p] || e.ganadores.indexOf(p) >= 0 ? '' : ' fuera') + ((modo === 'local' && p === M.actor) || (modo === 'online' && p === M.yo) ? ' yo' : '');
      h += '<span class="' + cls + '" data-p="' + p + '">' + ico + ' ' + esc(nombre(p)) + (modo === 'online' && p === M.yo ? ' (tú)' : '') + ' <b>' + e.alcanzo[p] + '</b></span>';
    }
    c.innerHTML = h;
  }
  function pintar() {
    $('simRonda').textContent = ronda;
    var labs = document.querySelectorAll('#simHeader .simLab');
    if (labs[1]) labs[1].textContent = multi() ? 'EN PIE' : 'MEJOR';
    $('simMejor').textContent = multi() && M.est ? M.est.vivos.filter(Boolean).length + '/' + M.est.n : mejor;
    $('simEstado').textContent = textoEstado();
    document.querySelectorAll('.simVel').forEach(function (b) { b.classList.toggle('sel', +b.dataset.v === velJuego()); b.disabled = modo === 'online'; });
    $('simPads').classList.toggle('bloq', fase !== 'turno');
    $('simWrap').classList.toggle('simMulti', multi());
    pintarJugadores();
  }
  // Enseña `seq` y pasa a 'turno'; `listo` se llama al final de la muestra
  function mostrar(listo) {
    fase = 'muestra'; pos = 0; M.resp = []; pintar();
    var dur = Math.max(BASE[velJuego()] - 12 * (seq.length - 1), 200), pausa = Math.max(dur * 0.35, 90), t = esp(600);
    seq.forEach(function (c) { tm.push(setTimeout(function () { encender(c, dur); }, t)); t += esp(dur + pausa); });
    tm.push(setTimeout(function () { fase = 'turno'; pos = 0; pintar(); if (listo) listo(); }, t));
  }

  /* ---------- 1 jugador ---------- */
  function siguiente() { seq.push(Math.floor(Math.random() * 4)); ronda = seq.length; pintar(); mostrar(); }
  function ocultarMenus() { $('simOver').classList.remove('show'); $('simStart').style.display = 'none'; if (window.PasarMovil) window.PasarMovil.quitar(); }
  function empezar() { limpiar(); modo = 'solo'; M.est = null; seq = []; ronda = 0; mejor = leerMejor(); ocultarMenus(); audio(); tm.push(setTimeout(siguiente, esp(400))); fase = 'muestra'; pintar(); }
  function pulsar(i) {
    if (fase !== 'turno') return;
    if (multi()) { pulsarMulti(i); return; }
    if (i !== seq[pos]) { fallo(); return; }
    encender(i, 250); vib(8); pos++;
    if (pos === seq.length) { fase = 'muestra'; pintar(); vib([0, 25, 40, 25]); tm.push(setTimeout(siguiente, esp(900))); } else pintar();
  }
  function fallo() {
    fase = 'fin'; limpiar(); tono(110, 600, 'sawtooth'); vib(200);
    var conseguida = Math.max(seq.length - 1, 0), m = leerMejor();
    if (conseguida > m) { try { localStorage.setItem('simBest_' + vel, conseguida); } catch (e) { /* nada */ } mejor = conseguida; }
    $('simOverT').textContent = conseguida > m && conseguida > 0 ? '🏆 ¡Nuevo récord!' : 'FIN DE LA PARTIDA';
    $('simOverS').textContent = 'Secuencia completada: ' + conseguida + ' · Mejor (' + NOMBRE[vel] + '): ' + Math.max(m, conseguida);
    $('simAgain').textContent = '▶ OTRA VEZ'; $('simAgain').disabled = false;
    $('simOver').classList.add('show'); pintar();
  }

  /* ---------- varios jugadores (común) ---------- */
  function Eng() { return window.SimonEngine; }
  // Pulsación en una partida de varios: se apunta; al fallar o completar la secuencia se entrega la respuesta
  function pulsarMulti(i) {
    M.resp.push(i);
    if (i !== seq[pos]) { tono(110, 450, 'sawtooth'); vib(200); entregar(false); return; }
    encender(i, 250); vib(8); pos++;
    if (pos === seq.length) { vib([0, 25, 40, 25]); entregar(true); } else pintar();
  }
  function entregar(bien) {
    var r = M.resp.slice(), p = modo === 'local' ? M.actor : M.yo;
    fase = 'espera';
    if (modo === 'local') {
      M.aviso = bien ? '✅ ¡Bien, ' + nombre(p) + '!' : '❌ ¡Fallo! ' + nombre(p) + ' queda eliminado';
      Eng().responder(M.est, p, M.est.ronda, r); pintar();
      var g = gen; tm.push(setTimeout(function () { if (g === gen) turnoLocal(); }, esp(bien ? 900 : 1600)));
    } else {
      M.aviso = bien ? '✅ ¡Bien! Esperando a los demás…' : '❌ ¡Fallo! Quedas eliminado';
      pintar(); if (M.online) M.online.responder(M.est.ronda, r);
    }
  }
  function finMulti() {
    limpiar(); fase = 'fin'; if (window.PasarMovil) window.PasarMovil.quitar();
    var e = M.est, g = e.ganadores, cl = Eng().clasificacion(e);
    var yoGano = modo === 'online' && g.indexOf(M.yo) >= 0;
    $('simOverT').textContent = g.length === 1 ? (modo === 'online' ? (yoGano ? '🏆 ¡Has ganado!' : '🏆 Gana ' + nombre(g[0])) : '🏆 ¡Gana ' + nombre(g[0]) + '!') : '🤝 Empate' + (yoGano ? ' (estás entre los ganadores)' : '');
    $('simOverS').innerHTML = cl.map(function (f, k) { return (f.gana ? '🏆' : (k + 1) + 'º') + ' ' + esc(nombre(f.p)) + ' · ' + f.alcanzo + ' secuencia' + (f.alcanzo === 1 ? '' : 's'); }).join('<br>');
    var b = $('simAgain');
    if (modo === 'online') { b.textContent = M.online && M.online.host ? '↩ Volver al lobby' : '⏳ Esperando al anfitrión'; b.disabled = !(M.online && M.online.host); }
    else { b.textContent = '▶ OTRA VEZ'; b.disabled = false; }
    $('simOver').classList.add('show'); tono(g.length === 1 ? 523 : 330, 500, 'triangle'); pintar();
  }

  /* ---------- varios en el mismo móvil ---------- */
  function pintarLocal() {
    document.querySelectorAll('.simN').forEach(function (b) { b.classList.toggle('sel', +b.dataset.n === M.nLocal); });
    var c = $('simNombres'), prev = [].map.call(c.querySelectorAll('input'), function (i) { return i.value; });
    c.innerHTML = '';
    for (var p = 0; p < M.nLocal; p++) {
      var i = document.createElement('input'); i.maxLength = 16; i.placeholder = 'Jugador ' + (p + 1); i.autocomplete = 'off'; i.setAttribute('aria-label', 'Nombre del jugador ' + (p + 1));
      i.value = prev[p] !== undefined ? prev[p] : (M.nombresLocal && M.nombresLocal[p]) || ''; c.appendChild(i);
    }
  }
  function abrirLocal(si) { $('simModos').style.display = si ? 'none' : 'flex'; $('simLocal').style.display = si ? 'flex' : 'none'; if (si) pintarLocal(); }
  function empezarLocal(nombres) {
    if (!Eng()) return;
    limpiar(); modo = 'local'; M.online = null;
    M.nombres = nombres; M.nombresLocal = nombres.slice();
    try { localStorage.setItem('simNombres', JSON.stringify(nombres)); localStorage.setItem('simJugadores', nombres.length); } catch (e) { /* nada */ }
    M.est = Eng().nuevo({ n: nombres.length, vel: vel }); ocultarMenus(); audio(); turnoLocal();
  }
  // Le toca al primer jugador vivo que aún no ha repetido la secuencia de esta ronda: tapa «pasa el móvil» y después la muestra
  function turnoLocal() {
    limpiar();
    var e = M.est; if (e.fase === 'fin') { finMulti(); return; }
    var p = Eng().pendientes(e)[0]; M.actor = p; seq = e.seq.slice(); ronda = e.ronda;
    fase = 'espera'; M.aviso = '📱 Turno de ' + nombre(p); pintar();
    var g = gen;
    var tapa = window.PasarMovil ? window.PasarMovil.mostrar({ contenedor: $('simWrap'), icono: '🟢', titulo: 'Turno de ' + nombre(p), texto: 'Ronda ' + e.ronda + ': memoriza ' + e.seq.length + ' color' + (e.seq.length === 1 ? '' : 'es') + ' y repítelos.', boton: 'Soy ' + nombre(p) + ' · Ver' }) : Promise.resolve();
    tapa.then(function () { if (g === gen && modo === 'local') mostrar(); });
  }

  /* ---------- online (lo maneja js/online/j-simon.js) ---------- */
  function estadoOnline(e) {
    M.est = e; seq = e.seq.slice(); ronda = e.ronda;
    if (e.fase === 'fin') { finMulti(); return; }
    $('simOver').classList.remove('show');
    if (M.rondaVista === e.ronda) { pintar(); return; }                       // misma ronda: solo cambia quién ha contestado
    var antes = M.rondaVista; M.rondaVista = e.ronda; limpiar();
    var vivo = M.yo >= 0 && e.vivos[M.yo];
    if (!vivo) { fase = 'espera'; M.aviso = M.yo >= 0 ? '👀 Eliminado · mirando la partida' : '👀 Mirando la partida'; pintar(); return; }
    if (e.resp[M.yo] !== null) { fase = 'espera'; M.aviso = '⏳ Esperando a los demás…'; pintar(); return; }
    fase = 'espera'; M.aviso = antes > 0 ? '✅ ¡Ronda superada! Ronda ' + e.ronda : '🌐 ¡Empieza! Ronda ' + e.ronda; pintar();
    var g = gen; tm.push(setTimeout(function () { if (g === gen && modo === 'online') { audio(); mostrar(); } }, esp(antes > 0 ? 1100 : 800)));
  }
  window.Simon = {
    online: {
      iniciar: function (c) {
        limpiar(); modo = 'online'; M.yo = c.p; M.nombres = c.nombres || []; M.rondaVista = -1;
        M.online = { host: !!c.host, responder: c.responder, lobby: c.lobby };
        ocultarMenus(); estadoOnline(c.est);
      },
      estado: function (e) { if (modo === 'online') estadoOnline(e); },
      salir: function () { if (modo === 'online') menu(); },
      activo: function () { return modo === 'online'; }
    }
  };

  function menu() {
    limpiar(); fase = 'menu'; modo = 'solo'; M.est = null; M.online = null; M.rondaVista = -1; seq = []; ronda = 0;
    if (window.PasarMovil) window.PasarMovil.quitar();
    $('simOver').classList.remove('show'); $('simStart').style.display = 'flex'; abrirLocal(false); mejor = leerMejor(); pintar();
  }

  document.querySelectorAll('.simPad').forEach(function (p) {
    p.addEventListener('pointerdown', function (e) { e.preventDefault(); pulsar(+p.dataset.i); });
    p.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });
  var TECLAS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, KeyQ: 0, KeyW: 1, KeyA: 2, KeyS: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };
  document.addEventListener('keydown', function (e) {
    var w = $('winSim'); if (!w || w.classList.contains('hidden') || e.repeat) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.code in TECLAS) { e.preventDefault(); pulsar(TECLAS[e.code]); }
    else if (e.code === 'Enter') { if (modo === 'solo' && (fase === 'menu' || fase === 'fin') && $('simLocal').style.display !== 'flex') empezar(); }
  });
  document.querySelectorAll('.simVel').forEach(function (b) { b.addEventListener('click', function () { if (fase !== 'menu' && fase !== 'fin' || modo === 'online') return; vel = +b.dataset.v; try { localStorage.setItem('simVel', vel); } catch (e) { /* nada */ } mejor = leerMejor(); pintar(); }); });
  $('simGo').addEventListener('click', empezar);
  $('simAgain').addEventListener('click', function () {
    if (modo === 'online') { if (M.online && M.online.host) M.online.lobby(); return; }
    if (modo === 'local') { empezarLocal(M.nombres.slice()); return; }
    empezar();
  });
  $('simLocalBtn').addEventListener('click', function () { abrirLocal(true); });
  $('simLocalVolver').addEventListener('click', function () { abrirLocal(false); });
  $('simOnlineBtn').addEventListener('click', function () { var c = document.querySelector('[data-conectar=simon]'); if (c) c.click(); });
  document.querySelectorAll('.simN').forEach(function (b) { b.addEventListener('click', function () { M.nLocal = +b.dataset.n; pintarLocal(); }); });
  $('simLocalGo').addEventListener('click', function () {
    var nombres = [].map.call($('simNombres').querySelectorAll('input'), function (i, p) { return i.value.trim().slice(0, 16) || 'Jugador ' + (p + 1); });
    empezarLocal(nombres);
  });
  $('simNewGame').addEventListener('click', function () {
    if (modo === 'online') { if (window.Sala) window.Sala.toast('En línea: el anfitrión puede volver al lobby con «↩ Lobby» y cualquiera puede salir de la sala.'); return; }
    menu();
  });
  try { var nl = JSON.parse(localStorage.getItem('simNombres') || 'null'); if (Array.isArray(nl)) M.nombresLocal = nl.map(String); } catch (e) { /* sin nombres */ }
  window.initSim = function () { if (fase === 'menu') mejor = leerMejor(); pintar(); };
  window.simStartNew = function () { $('simNewGame').click(); };
  // Al minimizar: en solitario se corta la partida; en el mismo móvil se repite el turno del jugador; en línea sigue (el anfitrión tiene un plazo)
  window.pauseSim = function () {
    if (fase !== 'muestra' && fase !== 'turno') return;
    if (modo === 'local') { turnoLocal(); return; }
    if (modo === 'online') return;
    limpiar(); fase = 'menu'; $('simStart').style.display = 'flex'; pintar();
  };
  window.simEstado = function () { return { fase: fase, seq: seq.slice(), pos: pos, ronda: ronda, mejor: mejor, vel: vel, modo: modo, actor: M.actor, yo: M.yo, multi: M.est ? Eng().copiar(M.est) : null }; };
})();

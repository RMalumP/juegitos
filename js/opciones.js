/* js/opciones.js — Opciones de la app (⚙ en la barra de tareas) y detección de móvil / ordenador.
   · Control táctil: Automático (se detecta el dispositivo), Activado o Desactivado.
       Móvil  → gestos y controles en pantalla activos.
       Ordenador → teclado; los controles en pantalla quedan PLEGADOS (no se eliminan) y los gestos desactivados.
   · Repetición de Tetris: DAS (retardo), ARR (velocidad) y SDF (caída suave).
   API: window.Opciones { get(k), set(k,v), tactil(), detectado(), on(fn), abrir(), cerrar() }.
   Los ajustes se guardan en localStorage (juegitos.opc). */
(function () {
  'use strict';
  var LS = 'juegitos.opc';
  var DEF = { tactil: 'auto', das: 160, arr: 45, sdf: 20 };
  var LIM = { das: [60, 400], arr: [8, 150], sdf: [5, 40] };
  var cfg = {}, oyentes = [], modal = null;

  function copiar() { for (var k in DEF) cfg[k] = DEF[k]; }
  function cargar() {
    copiar();
    try {
      var s = JSON.parse(localStorage.getItem(LS));
      if (s && typeof s === 'object') for (var k in DEF) if (k in s) cfg[k] = s[k];
    } catch (e) { /* sin ajustes guardados */ }
    if (['auto', 'si', 'no'].indexOf(cfg.tactil) < 0) cfg.tactil = 'auto';
    for (var n in LIM) { var v = +cfg[n]; cfg[n] = isNaN(v) ? DEF[n] : Math.max(LIM[n][0], Math.min(LIM[n][1], Math.round(v))); }
  }
  function guardar() { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) { /* nada */ } }

  function detectar() {
    try {
      if (window.matchMedia('(pointer: coarse)').matches) return true;
      return window.matchMedia('(hover: none)').matches && navigator.maxTouchPoints > 0;
    } catch (e) { return false; }
  }
  var detectado = detectar();
  function tactil() { return cfg.tactil === 'si' ? true : cfg.tactil === 'no' ? false : detectado; }

  function emitir(k) {
    oyentes.slice().forEach(function (fn) { try { fn(cfg, k); } catch (e) { /* un oyente roto no debe parar a los demás */ } });
    try { window.dispatchEvent(new CustomEvent('opciones', { detail: { clave: k } })); } catch (e) { /* nada */ }
  }
  function plegarControles(modo) {
    if (typeof window.ctrlAplicarDefecto === 'function') window.ctrlAplicarDefecto(!tactil(), modo);
  }
  function set(k, v) {
    if (!(k in DEF)) return;
    if (k === 'tactil') { cfg.tactil = ['auto', 'si', 'no'].indexOf(v) < 0 ? 'auto' : v; }
    else cfg[k] = Math.max(LIM[k][0], Math.min(LIM[k][1], Math.round(+v) || DEF[k]));
    guardar();
    if (k === 'tactil') plegarControles(cfg.tactil === 'auto' ? 'borrar' : 'forzar');
    emitir(k);
    pintar();
  }

  /* ---- ventana ---- */
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function construir() {
    modal = el('div'); modal.id = 'optModal';
    var box = el('div'); box.id = 'optBox';
    var tit = el('div'); tit.id = 'optTitle';
    var tt = el('span', '', '⚙ Opciones'); tt.id = 'optTitleTxt'; tit.appendChild(tt);
    var x = el('span', '', '✕'); x.id = 'optClose'; tit.appendChild(x);
    var body = el('div'); body.id = 'optBody';

    body.appendChild(el('div', 'optH', 'Control táctil'));
    var grupo = el('div', 'optRadios');
    [['auto', 'Automático'], ['si', 'Activado'], ['no', 'Desactivado']].forEach(function (o) {
      var b = el('button', 'optRadio', o[1]); b.type = 'button'; b.setAttribute('data-v', o[0]);
      b.addEventListener('click', function () { set('tactil', o[0]); });
      grupo.appendChild(b);
    });
    body.appendChild(grupo);
    var det = el('div', 'optNota'); det.id = 'optDet'; body.appendChild(det);

    var sec = el('div', 'optSec'); sec.id = 'optSecTetris';                      // solo se ve al abrir Opciones desde Tetris
    sec.appendChild(el('div', 'optH', 'Tetris · repetición de teclas y botones'));
    [['das', 'Retardo (DAS)', 'ms'], ['arr', 'Velocidad (ARR)', 'ms'], ['sdf', 'Caída suave (SDF)', '×']].forEach(function (o) {
      var fila = el('div', 'optFila');
      fila.appendChild(el('span', 'optEt', o[1]));
      var r = document.createElement('input'); r.type = 'range'; r.min = LIM[o[0]][0]; r.max = LIM[o[0]][1]; r.id = 'opt-' + o[0];
      r.addEventListener('input', function () { set(o[0], r.value); });
      var v = el('span', 'optVal'); v.id = 'optv-' + o[0]; v.setAttribute('data-u', o[2]);
      fila.appendChild(r); fila.appendChild(v); sec.appendChild(fila);
    });
    sec.appendChild(el('div', 'optNota', 'Menos retardo y menos ARR = la pieza se mueve antes y más rápido al mantener pulsado. Un toque corto siempre mueve una sola casilla.'));
    body.appendChild(sec);
    var rst = el('button', 'optBtn', 'Restaurar valores'); rst.type = 'button'; rst.id = 'optReset';
    rst.addEventListener('click', function () { cfg.das = DEF.das; cfg.arr = DEF.arr; cfg.sdf = DEF.sdf; set('tactil', 'auto'); });
    body.appendChild(rst);

    box.appendChild(tit); box.appendChild(body); modal.appendChild(box);
    modal.addEventListener('click', function (e) { if (e.target === modal) cerrar(); });
    x.addEventListener('click', cerrar);
    document.body.appendChild(modal);
  }
  function pintar() {
    if (!modal) return;
    modal.querySelectorAll('.optRadio').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-v') === cfg.tactil); });
    var d = document.getElementById('optDet');
    if (d) d.textContent = 'Dispositivo detectado: ' + (detectado ? 'móvil / tableta (táctil)' : 'ordenador (teclado)') +
      '. Ahora mismo: ' + (tactil() ? 'gestos y controles en pantalla activos.' : 'teclado; controles en pantalla plegados y gestos desactivados.');
    ['das', 'arr', 'sdf'].forEach(function (k) {
      var r = document.getElementById('opt-' + k), v = document.getElementById('optv-' + k);
      if (r) r.value = cfg[k];
      if (v) v.textContent = cfg[k] + ' ' + v.getAttribute('data-u');
    });
  }
  /* abrir('Tetris') muestra además los ajustes propios de ese juego; sin argumento, solo los generales */
  function abrir(juego) {
    if (!modal) construir();
    modal.setAttribute('data-juego', juego || '');
    document.getElementById('optSecTetris').style.display = juego === 'Tetris' ? '' : 'none';
    document.getElementById('optTitleTxt').textContent = '⚙ Opciones' + (juego ? ' · ' + juego : '');
    pintar(); modal.classList.add('show');
  }
  function cerrar() { if (modal) modal.classList.remove('show'); }

  function iniciar() {
    /* «⚙ Opciones» en el menú de cada juego que usa control táctil / controles en pantalla (los que tienen barra de controles plegable) */
    document.querySelectorAll('.win').forEach(function (win) {
      var barra = win.querySelector('.menuBar'), nombre = win.id.replace(/^win/, '');
      if (!barra || !win.querySelector('.ctrlToggle') || document.getElementById('optItem' + nombre)) return;
      var it = el('span', 'mItem', '⚙ Opciones'); it.id = 'optItem' + nombre;
      it.addEventListener('click', function () { abrir(nombre); });
      barra.appendChild(it);
    });
    plegarControles('respetar');
  }

  cargar();
  window.Opciones = {
    get: function (k) { return cfg[k]; },
    set: set, tactil: tactil, detectado: function () { return detectado; },
    on: function (fn) { oyentes.push(fn); }, abrir: abrir, cerrar: cerrar
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

/* js/teclas.js — reasignación de teclas común (Breakout, 2048, Flappy, Hundir).
   Teclas.crear({ id, ventana:'winBrk', acciones:[{ id, etiqueta, def, alt:[...] }] }) devuelve
     T.accion(code)   → id de la acción de esa tecla (o null; null también con el modal abierto)
     T.codigo(accion) → código de la tecla principal actual
   Lo reasignable es la tecla principal; `alt` son teclas fijas secundarias (WASD…) que valen mientras otra acción no las use.
   El ajuste se guarda en localStorage como «<id>KeyMap». «⌨ Reasignar» se añade al menú de la ventana. */
(function () {
  'use strict';
  var modal = null, filas = null, actual = null;

  var NOMBRES = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Espacio', Enter: 'Intro', Backspace: 'Retroceso', Escape: 'Esc', Delete: 'Supr', Tab: 'Tab' };
  function nombre(c) { return NOMBRES[c] || String(c).replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Núm '); }

  function css() {
    if (document.getElementById('tkCss')) return;
    var s = document.createElement('style'); s.id = 'tkCss';
    s.textContent = '#tkModal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;align-items:center;justify-content:center}' +
      '#tkModal.active{display:flex}' +
      '#tkBox{background:#1a1a2e;border:2px solid #4a4a8a;border-radius:10px;padding:14px;width:min(92vw,340px);max-height:88vh;overflow:auto;color:#fff;font-family:Arial,sans-serif}' +
      '#tkBox h3{margin:0 0 4px;font-size:16px}#tkBox p{margin:0 0 10px;font-size:12px;opacity:.75}' +
      '.tkRow{display:flex;align-items:center;gap:8px;margin:4px 0}.tkLbl{flex:1;font-size:14px}' +
      '.tkKey{min-width:96px;text-align:center;padding:6px 8px;background:#2b2b55;border:1px solid #6a6aaa;border-radius:5px;cursor:pointer;font-size:13px}' +
      '.tkKey.waiting{background:#7a5c00;border-color:#ffe08a}' +
      '.tkBtns{display:flex;gap:8px;margin-top:12px}.tkBtns button{flex:1;padding:8px;border-radius:5px;border:1px solid #6a6aaa;background:#2b2b55;color:#fff;cursor:pointer;font-size:14px}';
    document.head.appendChild(s);
  }
  function construir() {
    css();
    modal = document.createElement('div'); modal.id = 'tkModal';
    modal.innerHTML = '<div id="tkBox"><h3 id="tkTitulo">⌨ Reasignar teclas</h3><p>Pulsa una acción y luego la tecla nueva (Esc cancela). Si ya la usaba otra acción, se intercambian.</p><div id="tkFilas"></div>' +
      '<div class="tkBtns"><button id="tkReset" type="button">Restablecer</button><button id="tkListo" type="button">Listo</button></div></div>';
    document.body.appendChild(modal);
    filas = modal.querySelector('#tkFilas');
    modal.addEventListener('click', function (e) { if (e.target === modal) cerrar(); });
    modal.querySelector('#tkListo').addEventListener('click', cerrar);
    modal.querySelector('#tkReset').addEventListener('click', function () { if (actual) { actual.reset(); pintar(); } });
  }
  function pintar() {
    filas.innerHTML = '';
    actual.acciones.forEach(function (a) {
      var f = document.createElement('div'); f.className = 'tkRow';
      var l = document.createElement('span'); l.className = 'tkLbl'; l.textContent = a.etiqueta;
      var b = document.createElement('div'); b.className = 'tkKey'; b.setAttribute('role', 'button'); b.dataset.accion = a.id; b.textContent = nombre(actual.mapa[a.id]);
      b.addEventListener('click', function () {
        if (b.classList.contains('waiting')) return;
        b.classList.add('waiting'); b.textContent = 'Pulsa tecla...';
        function captura(ev) {
          ev.preventDefault(); ev.stopPropagation();
          document.removeEventListener('keydown', captura, true);
          if (ev.code !== 'Escape') actual.asignar(a.id, ev.code);
          pintar();
        }
        document.addEventListener('keydown', captura, true);
      });
      f.appendChild(l); f.appendChild(b); filas.appendChild(f);
    });
  }
  function abrir(T) {
    if (!modal) construir();
    actual = T; modal.querySelector('#tkTitulo').textContent = '⌨ Reasignar teclas' + (T.titulo ? ' · ' + T.titulo : '');
    pintar(); modal.classList.add('active');
  }
  function cerrar() { if (modal) modal.classList.remove('active'); if (actual) actual.guardar(); }
  function abierto() { return !!(modal && modal.classList.contains('active')); }

  function crear(cfg) {
    var DEF = {}; cfg.acciones.forEach(function (a) { DEF[a.id] = a.def; });
    var clave = cfg.id + 'KeyMap', mapa = Object.assign({}, DEF);
    try {
      var sv = JSON.parse(localStorage.getItem(clave) || 'null');
      if (sv && typeof sv === 'object') for (var k in DEF) if (typeof sv[k] === 'string') mapa[k] = sv[k];
    } catch (e) { /* valores por defecto */ }
    var T = {
      acciones: cfg.acciones, mapa: mapa, titulo: cfg.titulo || '',
      guardar: function () { try { localStorage.setItem(clave, JSON.stringify(mapa)); } catch (e) { /* nada */ } },
      reset: function () { for (var k in DEF) mapa[k] = DEF[k]; T.guardar(); },
      asignar: function (acc, code) {                          // si otra acción ya tenía esa tecla, se intercambian
        for (var k in mapa) if (k !== acc && mapa[k] === code) mapa[k] = mapa[acc];
        mapa[acc] = code; T.guardar();
      },
      codigo: function (acc) { return mapa[acc]; },
      accion: function (code) {
        if (abierto()) return null;
        for (var k in mapa) if (mapa[k] === code) return k;
        for (var i = 0; i < cfg.acciones.length; i++) {
          var a = cfg.acciones[i];
          if (a.alt && a.alt.indexOf(code) >= 0) return a.id;
        }
        return null;
      },
      abrir: function () { abrir(T); }
    };
    var win = cfg.ventana && document.getElementById(cfg.ventana), barra = win && win.querySelector('.menuBar');
    if (barra && !document.getElementById('tkItem' + cfg.ventana)) {
      var it = document.createElement('span'); it.className = 'mItem'; it.id = 'tkItem' + cfg.ventana; it.textContent = '⌨ Reasignar';
      it.addEventListener('click', T.abrir); barra.appendChild(it);
    }
    return T;
  }
  window.Teclas = { crear: crear, abierto: abierto, nombre: nombre };
})();

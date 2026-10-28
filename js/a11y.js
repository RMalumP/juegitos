/* a11y.js — Juegos XP: accesibilidad. Los botones de la interfaz son <div> con estilos propios: sin cambiar su aspecto, se les da rol de botón,
   foco con el tabulador, activación con Enter/Espacio y un nombre para los que solo tienen un icono. Si añades una clase de botón nueva, ponla en BUTTONS. */
(function () {
  'use strict';
  var BUTTONS = [
    '.choiceBtn', '.deskIcon', '.deskToolBtn', '.wbtn', '.taskChip', '.winReopen', '.mItem', '.oBtn', '.diffBtn', '.ctrlToggle',
    '.sudActBtn', '.sudDiffBtn', '.sudNumBtn', '.pacLevelBtn', '.bjChip', '.bjNBtn', '.roulChip', '.roulNBtn', '.roulModeBtn',
    '.roulHistBtn', '.pkNBtn', '.pkPeekNavBtn', '.diceNBtn',
    '#startBtn', '#creditsBtn', '#creditsClose', '#dataClose', '#vibToggle', '#tbHideBtn', '#tbReopen', '#smiley', '#flagToggle'
  ].join(',');
  var LABELS = {
    '_': 'Minimizar', '✕': 'Cerrar', '©': 'Créditos', '▾': 'Ocultar barra de tareas', '▼': 'Ocultar barra de tareas',
    '▲': 'Mostrar barra de tareas', '📳': 'Vibración', '📴': 'Vibración'
  };
  function enhance(el) {
    if (el.hasAttribute('role')) return;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    var label = el.getAttribute('title') || LABELS[el.textContent.trim()];
    if (label && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', label);
  }
  function scan(root) {
    if (root.matches && root.matches(BUTTONS)) enhance(root);
    if (root.querySelectorAll) root.querySelectorAll(BUTTONS).forEach(enhance);
  }
  scan(document.body);
  // Algunos botones se crean al abrir cada juego.
  new MutationObserver(function (records) {
    records.forEach(function (r) { r.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); });
  }).observe(document.body, { childList: true, subtree: true });

  // Mientras se ve la pantalla «¿Qué quieres jugar?», el escritorio de detrás no recibe el foco del tabulador.
  var start = document.getElementById('startScreen'),
    behind = ['desktopArea', 'taskbar'].map(function (id) { return document.getElementById(id); });
  function syncInert() {
    var open = start.style.display !== 'none' && getComputedStyle(start).display !== 'none';
    behind.forEach(function (el) { if (el) el.inert = open; });
  }
  if (start) {
    syncInert();
    new MutationObserver(syncInert).observe(start, { attributes: true, attributeFilter: ['style'] });
  }

  // Botones que recibieron el foco con el tabulador (no con un toque o clic).
  var keyboardFocused = new WeakSet(), lastPointer = 0;
  document.addEventListener('pointerdown', function () { lastPointer = Date.now(); }, true);
  document.addEventListener('focusin', function (e) {
    if (Date.now() - lastPointer > 300) keyboardFocused.add(e.target); else keyboardFocused.delete(e.target);
  }, true);

  document.addEventListener('keydown', function (e) {
    var el = e.target;
    // Solo si el foco llegó con el teclado: tras tocar un botón con el ratón o el dedo, Espacio/Enter siguen siendo controles del juego.
    if ((e.key !== 'Enter' && e.key !== ' ') || !el.getAttribute || el.getAttribute('role') !== 'button' || !keyboardFocused.has(el)) return;
    if (el.tagName === 'BUTTON') return;                        // los <button> ya se activan solos
    e.preventDefault();
    // Los iconos del escritorio se abren con doble clic.
    el.click();
    if (el.classList.contains('deskIcon')) el.click();
  });
})();

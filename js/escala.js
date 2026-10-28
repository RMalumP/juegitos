/* js/escala.js — Tamaño de la interfaz en ordenador.
   · Solo con ratón (puntero fino) y ventana ≥ 900×640: se agranda toda la ventana de juego según la ALTURA disponible (--ui = altura/760, entre 1 y 1.8).
     Así los juegos verticales (Tetris…) crecen en altura sin ensancharse. En móvil y tableta --ui vale 1 y nada cambia.
   · Cada ventana lleva data-forma: «vertical» (columna estrecha), «ancho» o «completo» (ver css/core.css).
   El zoom del navegador (Ctrl +/−) se respeta: se recalcula al cambiar el tamaño de la ventana. */
(function () {
  'use strict';
  var FORMAS = {
    vertical: ['Tetris', 'Brk', 'Pin', 'Flap', 'Word', 'Pac', 'Frog', 'Hundir', 'G2048', 'Mem', 'Sim', 'C4', 'Ttt', 'Snk', 'Sud', 'Dice'],
    ancho: ['Inv', 'Ast', 'Pong', 'Mine', 'Sol', 'Carta', 'BJ', 'Roul', 'Poker', 'Uno', 'Bingo', 'Sala'],
    completo: ['Chess', 'Parchis']
  };
  var raiz = document.documentElement;
  function esEscritorio() {
    try { return window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 900 && window.innerHeight >= 640; } catch (e) { return false; }
  }
  function aplicar() {
    var esc = esEscritorio(), s = esc ? Math.max(1, Math.min(1.8, window.innerHeight / 760)) : 1;
    raiz.style.setProperty('--ui', s.toFixed(3)); raiz.style.setProperty('--ui-menu', Math.min(s, 1.3).toFixed(3)); raiz.classList.toggle('escritorio', esc);
    var ayuda = document.querySelector('#startBox span[style*="font-size:10px"]');
    if (ayuda) ayuda.textContent = (esc ? 'Doble clic' : 'Doble tap') + ' en iconos para cambiar de juego';
    window.dispatchEvent(new Event('escala'));
  }
  function formas() {
    Object.keys(FORMAS).forEach(function (f) {
      FORMAS[f].forEach(function (n) { var w = document.getElementById('win' + n); if (w) w.setAttribute('data-forma', f); });
    });
  }
  formas(); aplicar();
  window.addEventListener('resize', aplicar);
  /* Una ventana oculta mide 0×0: si algo dispara «resize» mientras tanto (p. ej. cambiar el control táctil desde otro juego), el juego ajustaría su lienzo a 0 px.
     Al volver a mostrarse una ventana se lanza un «resize» para que cada juego recalcule su tamaño. */
  var obs = new MutationObserver(function (ms) {
    var mostrada = false;
    ms.forEach(function (m) { var w = m.target, oculto = w.classList.contains('hidden'); if (w._oculto === true && !oculto) mostrada = true; w._oculto = oculto; });
    if (mostrada) requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  });
  document.querySelectorAll('.win').forEach(function (w) { w._oculto = w.classList.contains('hidden'); obs.observe(w, { attributes: true, attributeFilter: ['class'] }); });
  window.Escala = { valor: function () { return parseFloat(raiz.style.getPropertyValue('--ui')) || 1; }, aplicar: aplicar };
})();

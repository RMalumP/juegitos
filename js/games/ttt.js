/* ttt.js — Juegos XP: Tres en raya (motor: js/online/ttt-engine.js; interfaz y modos: js/games/duelo.js). */
(function () {
  'use strict';
  window.Duelo.crear({
    id: 'ttt', Name: 'Ttt', wrap: 'tttWrap', titulo: 'TRES EN RAYA', motor: window.TttEngine, fichas: ['❌', '⭕'], nombres: ['Equis', 'Círculos'],
    ayuda: 'Consigue tres símbolos en línea antes que tu rival.',
    tablero: function (el, jugar) {
      el.classList.add('tttTab');
      var celdas = [];
      for (var i = 0; i < 9; i++) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'tttCelda'; b.setAttribute('aria-label', 'Casilla ' + (i + 1));
        b.addEventListener('click', (function (k) { return function () { jugar(k); }; })(i));
        el.appendChild(b); celdas.push(b);
      }
      return { actualizar: function (est, puede) {
        celdas.forEach(function (b, i) {
          var v = est ? est.tab[i] : 0;
          b.textContent = v === 1 ? '❌' : v === 2 ? '⭕' : '';
          b.className = 'tttCelda' + (v === 1 ? ' x' : v === 2 ? ' o' : '') + (est && i === est.ultimo ? ' ult' : '') + (est && est.linea.indexOf(i) >= 0 ? ' gana' : '');
          b.disabled = !puede || !!v;
        });
      } };
    }
  });
})();

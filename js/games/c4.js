/* c4.js — Juegos XP: Conecta 4 (motor: js/online/c4-engine.js; interfaz y modos: js/games/duelo.js). */
(function () {
  'use strict';
  var C = 7, F = 6;
  window.Duelo.crear({
    id: 'c4', Name: 'C4', wrap: 'c4Wrap', titulo: 'CONECTA 4', motor: window.C4Engine, fichas: ['🔴', '🟡'], nombres: ['Rojas', 'Amarillas'],
    ayuda: 'Deja caer fichas por las columnas y junta cuatro en línea: horizontal, vertical o diagonal.',
    tablero: function (el, jugar) {
      el.classList.add('c4Tab');
      var celdas = [];
      for (var r = 0; r < F; r++) for (var c = 0; c < C; c++) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'c4Celda'; b.dataset.c = c; b.setAttribute('aria-label', 'Columna ' + (c + 1));
        b.addEventListener('click', (function (col) { return function () { jugar(col); }; })(c));
        el.appendChild(b); celdas.push(b);
      }
      return { actualizar: function (est, puede) {
        celdas.forEach(function (b, i) {
          var v = est ? est.tab[i] : 0, cl = 'c4Celda' + (v === 1 ? ' r' : v === 2 ? ' y' : '');
          if (est && i === est.ultimo) cl += ' ult'; if (est && est.linea.indexOf(i) >= 0) cl += ' gana';
          b.className = cl; b.disabled = !puede;
        });
      } };
    }
  });
})();

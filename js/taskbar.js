/* taskbar.js — Juegos XP: la zona de botones de la barra de tareas (#taskChips) se desplaza en horizontal cuando hay muchos juegos abiertos;
   al activarse un botón se lleva a la vista. */
(function () {
  'use strict';
  var z = document.getElementById('taskChips'); if (!z) return;
  new MutationObserver(function (ms) {
    ms.forEach(function (m) { var c = m.target; if (c.classList && c.classList.contains('active') && !c.classList.contains('hidden') && c.scrollIntoView) c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
  }).observe(z, { subtree: true, attributes: true, attributeFilter: ['class'] });
})();

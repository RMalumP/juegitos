/* taskbar.js — Juegos XP: la zona de botones de la barra de tareas (#taskChips) se desplaza en horizontal cuando hay muchos juegos abiertos;
   al activarse un botón se lleva a la vista. */
(function () {
  'use strict';
  var z = document.getElementById('taskChips'); if (!z) return;
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      var c = m.target; if (!c.classList || !c.classList.contains('active') || c.classList.contains('hidden')) return;
      // solo se desplaza #taskChips en horizontal: scrollIntoView movía también la página hacia arriba cuando la barra estaba plegada (fuera de la pantalla)
      var zr = z.getBoundingClientRect(), cr = c.getBoundingClientRect();
      if (cr.left < zr.left) z.scrollLeft -= zr.left - cr.left; else if (cr.right > zr.right) z.scrollLeft += cr.right - zr.right;
    });
  }).observe(z, { subtree: true, attributes: true, attributeFilter: ['class'] });
})();

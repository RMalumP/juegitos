/* js/pasar-movil.js — «Pasa el móvil» (varios jugadores en un mismo dispositivo, como el Póquer sin conexión).
   Tapa a pantalla completa, opaca, que oculta lo que haya detrás hasta que el siguiente jugador la toca.
     PasarMovil.mostrar({ contenedor, icono, titulo, texto, boton }) → Promise que se resuelve cuando el jugador pulsa el botón.
     PasarMovil.activa() → true mientras hay una tapa visible · PasarMovil.quitar() → la retira sin resolver.
   El botón se activa tras PasarMovil.retardo (700 ms) para evitar toques sueltos de quien acaba de jugar. Los estilos están en css/core.css (.pmCubierta). */
(function () {
  'use strict';
  var actual = null;

  function quitar() { if (actual && actual.el.parentNode) actual.el.parentNode.removeChild(actual.el); actual = null; }
  function mostrar(op) {
    op = op || {};
    quitar();
    var host = op.contenedor || document.body;
    var el = document.createElement('div'); el.className = 'pmCubierta'; el.setAttribute('role', 'dialog');
    var ico = document.createElement('div'); ico.className = 'pmIcono'; ico.textContent = op.icono || '📱';
    var t = document.createElement('div'); t.className = 'pmTitulo'; t.textContent = op.titulo || 'Pasa el móvil';
    var x = document.createElement('div'); x.className = 'pmTexto'; x.textContent = op.texto || 'Que el otro jugador no vea la pantalla.';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'pmBoton'; b.textContent = op.boton || 'Ya lo tengo · Ver'; b.disabled = true;
    el.appendChild(ico); el.appendChild(t); el.appendChild(x); el.appendChild(b);
    host.appendChild(el);
    return new Promise(function (resolve) {
      var listo = setTimeout(function () { b.disabled = false; }, window.PasarMovil.retardo);
      b.addEventListener('click', function () { clearTimeout(listo); if (actual && actual.el === el) quitar(); resolve(); });
      actual = { el: el };
    });
  }
  window.PasarMovil = { mostrar: mostrar, quitar: quitar, activa: function () { return !!actual; }, retardo: 700 };
})();

/* controls-toggle.js: plegar/desplegar los controles en pantalla de cada juego — Juegos XP.
   Los controles no desaparecen: se pueden ocultar para liberar el hueco y que la
   pantalla de juego se agrande (cada juego recalcula su lienzo al recibir 'resize').
   El estado plegado se recuerda en localStorage (uiCtrlCollapsed: {idDestino: true|false}).
   Si no hay preferencia guardada, js/opciones.js decide el valor por defecto con
   window.ctrlAplicarDefecto: plegados en ordenador (hay teclado), desplegados en móvil. */
(function () {
  'use strict';
  var KEY = 'uiCtrlCollapsed', reg = {}, guardado = leer();

  function leer() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function escribir() { try { localStorage.setItem(KEY, JSON.stringify(guardado)); } catch (e) { /* sin almacenamiento */ } }
  function aplicar(id, plegado) {
    var r = reg[id]; if (!r) return;
    r.dest.classList.toggle('ctHidden', !!plegado);
    r.btn.classList.toggle('collapsed', !!plegado);
  }

  document.querySelectorAll('.ctrlToggle').forEach(function (btn) {
    var id = btn.getAttribute('data-target'), dest = id && document.getElementById(id);
    if (!dest) return;
    reg[id] = { btn: btn, dest: dest };
    if (guardado[id]) aplicar(id, true);
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var plegar = !dest.classList.contains('ctHidden');
      aplicar(id, plegar);
      guardado[id] = plegar; escribir();
      window.dispatchEvent(new Event('resize'));
    });
  });

  /* Valor por defecto de todos los controles.
     modo 'respetar' (por defecto): lo guardado manda y el resto toma `plegar`.
     modo 'forzar': todos pasan a `plegar` y se guarda (elección explícita en Opciones).
     modo 'borrar': se olvida lo guardado y todos toman `plegar` (vuelta a «Automático»). */
  window.ctrlAplicarDefecto = function (plegar, modo) {
    for (var id in reg) {
      if (modo === 'forzar') guardado[id] = !!plegar;
      else if (modo === 'borrar') delete guardado[id];
      aplicar(id, guardado[id] === undefined ? plegar : guardado[id]);
    }
    if (modo === 'forzar' || modo === 'borrar') escribir();
    window.dispatchEvent(new Event('resize'));
  };
})();

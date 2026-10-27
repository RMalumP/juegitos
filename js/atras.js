/* js/atras.js — botón «atrás» del móvil (y del navegador).
   Mientras haya algo que cerrar, el historial lleva UNA entrada extra: «atrás» la consume y cierra la capa superior
     modal abierto → menú de inicio («¿Qué quieres jugar?») → ventana de conexión (vuelve al juego) → ventana de juego (se minimiza).
   Cuando no queda nada que cerrar, «atrás» sale de la web app como siempre (sin confirmación).
   Chrome ignora las entradas de historial creadas sin gesto del usuario: la primera se crea en la primera interacción (al soltar el dedo o la tecla: con activación del usuario). */
(function () {
  'use strict';
  var empujada = false, ignorar = 0, interactuado = false, pendiente = false;
  var $ = function (id) { return document.getElementById(id); };
  var visible = function (el) { return !!el && getComputedStyle(el).display !== 'none'; };

  function modales() {
    return Array.prototype.filter.call(document.querySelectorAll('[id$="Modal"]'), function (m) {
      return m.classList.contains('show') || m.classList.contains('active');
    });
  }
  function ventanaSuperior() {
    var mejor = null, mz = -1;
    Array.prototype.forEach.call(document.querySelectorAll('.win'), function (w) {
      if (w.classList.contains('hidden') || !visible(w)) return;
      var z = parseInt(getComputedStyle(w).zIndex, 10) || 0;
      if (z >= mz) { mz = z; mejor = w; }
    });
    return mejor;
  }
  /* capa superior cerrable: { tipo, el } o null */
  function capa() {
    var m = modales(); if (m.length) return { tipo: 'modal', el: m[m.length - 1] };
    var ss = $('startScreen'); if (visible(ss)) return { tipo: 'inicio', el: ss };
    var w = ventanaSuperior(); if (!w) return null;
    return { tipo: w.id === 'winSala' ? 'sala' : 'ventana', el: w };
  }
  function cerrar() {
    var c = capa(); if (!c) return false;
    if (c.tipo === 'modal') {
      if (c.el.id === 'optModal' && window.Opciones) window.Opciones.cerrar();
      else if (c.el.id === 'tkModal') { var l = $('tkListo'); if (l) l.click(); else c.el.classList.remove('active'); }
      else if (c.el.id === 'creditsModal') { var x = $('creditsClose'); if (x) x.click(); else c.el.classList.remove('show'); }
      else c.el.click();                                          // los modales cierran al pulsar sobre el fondo
    } else if (c.tipo === 'inicio') c.el.click();               // pulsar el fondo del menú lo cierra
    else if (c.tipo === 'sala') { var v = $('salaVolver'), cl = $('btnCloseSala'); if (v) v.click(); else if (cl) cl.click(); }
    else { var n = c.el.id.replace(/^win/, ''), mn = $('btnMin' + n) || $('btnClose' + n); if (mn) mn.click(); else c.el.classList.add('hidden'); }
    return true;
  }

  function sincronizar() {
    if (ignorar > 0) return;                                     // hay un history.back() nuestro pendiente
    var hay = !!capa();
    if (hay && !empujada && interactuado) {
      try { history.pushState({ atras: 1 }, '', location.href); empujada = true; } catch (e) { /* nada */ }
    } else if (!hay && empujada) {
      empujada = false; ignorar = 1; history.back();
    }
  }
  function programar() { if (pendiente) return; pendiente = true; setTimeout(function () { pendiente = false; sincronizar(); }, 0); }

  window.addEventListener('popstate', function () {
    if (ignorar > 0) { ignorar--; sincronizar(); return; }
    if (!empujada) return;                                       // un «atrás» ajeno a nuestra entrada: nada que hacer
    empujada = false;
    cerrar();
    sincronizar();                                               // si aún queda otra capa, se vuelve a empujar la entrada
  });

  function primera() {
    if (interactuado) return; interactuado = true;
    document.removeEventListener('pointerup', primera, true); document.removeEventListener('click', primera, true); document.removeEventListener('keydown', primera, true);
    sincronizar();
  }
  /* En pantallas táctiles la activación del usuario llega al SOLTAR el dedo (pointerdown no cuenta): una entrada creada antes
     la ignora Chrome al pulsar «atrás» y la web se cierra entera. */
  document.addEventListener('pointerup', primera, true);
  document.addEventListener('click', primera, true);
  document.addEventListener('keydown', primera, true);

  function observar() {
    var mo = new MutationObserver(programar), opt = { attributes: true, attributeFilter: ['class', 'style'] }, vistos = [];
    function atar(el) { if (el && vistos.indexOf(el) < 0) { vistos.push(el); mo.observe(el, opt); } }
    Array.prototype.forEach.call(document.querySelectorAll('.win'), atar);
    atar($('startScreen'));
    function modalesNuevos() { Array.prototype.forEach.call(document.querySelectorAll('[id$="Modal"]'), atar); }
    modalesNuevos();
    new MutationObserver(function () { modalesNuevos(); programar(); }).observe(document.body, { childList: true });
  }
  window.Atras = { capa: function () { var c = capa(); return c && c.tipo; }, cerrar: cerrar, entrada: function () { return empujada; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observar); else observar();
})();

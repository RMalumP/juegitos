/* js/pantalla.js — Pantalla completa: oculta la barra de notificaciones del móvil (y la de navegación) mientras juegas.
   · Instalada como app (manifest «display: fullscreen») ya viene a pantalla completa en Android.
   · En el navegador se activa con el primer toque (los navegadores solo la permiten tras un gesto) y con el botón ⛶ de la barra.
   · Si sales de la pantalla completa a propósito (gesto del sistema), se desactiva hasta que pulses ⛶ otra vez.
   · iPhone/iPad no tienen API de pantalla completa para páginas: allí el botón no aparece (instala la app para ocultar la barra). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LS = 'juegitos.pantallaCompleta';
  var el = document.documentElement;
  var puede = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  var enModo = function (m) { try { return window.matchMedia('(display-mode: ' + m + ')').matches; } catch (e) { return false; } };
  var yaCompleta = function () { return !!(document.fullscreenElement || document.webkitFullscreenElement) || enModo('fullscreen'); };
  var quiere = function () { try { return localStorage.getItem(LS) !== '0'; } catch (e) { return true; } };
  var guardar = function (v) { try { localStorage.setItem(LS, v ? '1' : '0'); } catch (e) { /* nada */ } };
  var intentando = false;

  function entrar() {
    if (!puede || yaCompleta()) return Promise.resolve();
    try {
      var r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
      return Promise.resolve(r).catch(function () { /* el navegador no lo permite ahora */ });
    } catch (e) { return Promise.resolve(); }
  }
  function salir() { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* nada */ } }
  function pintar() { var b = $('fsToggle'); if (!b) return; b.classList.toggle('off', !(quiere() && yaCompleta())); b.title = yaCompleta() ? 'Salir de la pantalla completa' : 'Pantalla completa (oculta la barra de notificaciones)'; }

  function iniciar() {
    var b = $('fsToggle');
    if (!puede || enModo('fullscreen')) { if (b) b.style.display = 'none'; return; }            // sin API (iPhone) o ya instalada a pantalla completa
    if (b) b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (yaCompleta()) { guardar(false); salir(); } else { guardar(true); entrar(); }
      setTimeout(pintar, 200);
    });
    // primer toque: entra a pantalla completa (si no se ha desactivado)
    var primero = function () { if (quiere() && !intentando) { intentando = true; entrar().then(function () { intentando = false; pintar(); }); } };
    document.addEventListener('pointerdown', primero, { passive: true });
    document.addEventListener('fullscreenchange', function () {
      if (!yaCompleta() && intentando === false && document.visibilityState === 'visible') { /* salida del usuario */ guardar(false); }
      pintar();
    });
    pintar();
  }
  window.Pantalla = { entrar: entrar, salir: salir, activa: yaCompleta, soporta: function () { return puede; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

/* js/pantalla.js — Pantalla completa por defecto: la app ocupa toda la pantalla, también la zona de la barra de notificaciones.
   · Instalada como app: el manifest pide «display: fullscreen» (y la página usa viewport-fit=cover + márgenes seguros, ver css/sala.css).
   · En el navegador: con el primer toque la app pide la pantalla completa (los navegadores solo la permiten tras un gesto). No hay botón: si sales con el gesto
     del sistema no se vuelve a pedir hasta que recargues la página.
   · iPhone/iPad no tienen API de pantalla completa para páginas web: allí solo se consigue instalando la app. */
(function () {
  'use strict';
  var el = document.documentElement;
  var puede = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  var enModo = function (m) { try { return window.matchMedia('(display-mode: ' + m + ')').matches; } catch (e) { return false; } };
  var yaCompleta = function () { return !!(document.fullscreenElement || document.webkitFullscreenElement) || enModo('fullscreen'); };
  var quiere = true, entrando = false;

  function entrar() {
    if (!puede || yaCompleta()) return Promise.resolve();
    try { return Promise.resolve((el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' })).catch(function () { /* ahora no se permite */ }); }
    catch (e) { return Promise.resolve(); }
  }
  function iniciar() {
    if (!puede || enModo('fullscreen')) return;                                       // sin API (iPhone) o ya instalada a pantalla completa
    document.addEventListener('pointerdown', function () {
      if (quiere && !entrando) { entrando = true; entrar().then(function () { entrando = false; }); }
    }, { passive: true });
    document.addEventListener('fullscreenchange', function () { if (!yaCompleta() && !entrando) quiere = false; });   // salida a propósito: no insistir
  }
  window.Pantalla = { entrar: entrar, activa: yaCompleta, soporta: function () { return puede; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

/* js/vibracion.js — Vibración de la app, en un solo sitio.
   · Respeta el interruptor 📳 de la barra (y se acuerda de él al recargar).
   · Vibra también al tocar casillas, cartones, números de la ruleta, menús… (el juego original solo vibraba con botones, iconos y fichas).
   · Los juegos originales (Tetris, Snake…) y los modos online usan esta misma función: window.vibrate(ms) y window.Vibra.pulso(ms | patrón).
   · iPhone/iPad: Safari no tiene la API de vibración. Dentro de un toque, se usa el «háptico» del interruptor nativo de iOS 17.4+ (sin patrones largos);
     los avisos que llegan sin tocar nada (p. ej. una bola nueva) no pueden vibrar ahí. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LS = 'juegitos.vibracion';
  var soportaApi = typeof navigator.vibrate === 'function';
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var tactil = false, lab = null;

  function activada() { var t = $('vibToggle'); return !t || !t.classList.contains('off'); }
  function haptico() {                                 // truco de iOS 17.4+: al pulsar un interruptor nativo, el sistema da un toque háptico
    try {
      if (!lab) {
        lab = document.createElement('label'); lab.setAttribute('aria-hidden', 'true'); lab.style.cssText = 'position:fixed;left:-200px;top:-200px;opacity:0;pointer-events:none';
        var i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); lab.appendChild(i); document.body.appendChild(lab);
      }
      lab.click();
    } catch (e) { /* sin háptico */ }
  }
  function pulso(patron) {
    if (!activada()) return false;
    try {
      if (soportaApi) return navigator.vibrate(patron);
      if (ios) {                                       // en iOS solo hay un «toque»: un pulso por cada vibración del patrón
        var arr = [].concat(patron), t = 0;
        arr.forEach(function (ms, k) { if (k % 2 === 0) setTimeout(haptico, t); t += +ms || 0; });
        return true;
      }
    } catch (e) { /* nada */ }
    return false;
  }
  window.Vibra = { pulso: pulso, activada: activada, soporta: function () { return soportaApi || ios; } };
  window.vibrate = function (ms) { pulso(ms); };       // las funciones originales del juego llaman a vibrate(…) por su nombre

  // Elementos que el juego original no cubría (los botones, iconos, fichas, etc. ya vibran con su propio código)
  var EXTRA = '.bgC,.bgT,.roulCell,.roulCorner,.roulSplit,.roulStreet,.roulSixline,.roulTrio,.roulDblZone,.bjCard,.mItem,.deskToolBtn,#trayNet,.olJ,.olC,.olCk';
  function iniciar() {
    var d = $('desktop') || document.body;
    d.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest(EXTRA)) pulso(12); }, { passive: true });
    var t = $('vibToggle');
    if (t) {
      try { if (localStorage.getItem(LS) === '0' && activada()) t.click(); } catch (e) { /* sin almacenamiento */ }   // se acuerda de «desactivada»
      t.addEventListener('click', function () {
        setTimeout(function () {
          try { localStorage.setItem(LS, activada() ? '1' : '0'); } catch (e) { /* nada */ }
          if (activada() && !(soportaApi || ios) && window.Sala) window.Sala.toast('Este navegador no permite vibrar (por ejemplo, iPhone con otro navegador distinto de Safari).');
        }, 0);
      });
      if (!(soportaApi || ios)) t.title = 'Vibración (este navegador no la permite)';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

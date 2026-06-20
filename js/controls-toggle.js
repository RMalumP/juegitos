/* controls-toggle.js: plegar/desplegar los controles en pantalla de cada juego
   (Pac-Man, Invaders, Snake, Asteroids y Tetris) — Juegos XP.
   Los controles no desaparecen: se pueden ocultar para liberar el hueco y que la
   pantalla de juego se agrande (cada juego recalcula su lienzo al recibir 'resize').
   El estado plegado se recuerda en localStorage. */
(function(){var c="uiCtrlCollapsed";function o(){try{return JSON.parse(localStorage.getItem(c))||{}}catch{return{}}}function l(t){try{localStorage.setItem(c,JSON.stringify(t))}catch{}}var a=o();function n(t,e,r){t.classList.toggle("ctHidden",r),e.classList.toggle("collapsed",r)}document.querySelectorAll(".ctrlToggle").forEach(function(t){var e=t.getAttribute("data-target"),r=e&&document.getElementById(e);r&&(a[e]&&n(r,t,!0),t.addEventListener("click",function(s){s.stopPropagation();var i=!r.classList.contains("ctHidden");n(r,t,i),a[e]=i,l(a),window.dispatchEvent(new Event("resize"))}))})})();

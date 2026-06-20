/* window-bars.js: ocultar/mostrar barra de título de cada ventana — Juegos XP. Código original sin cambios (solo separado en archivos). */
(function(){
// Hide/show title bar for each window (like taskbar hide)
function initBarToggle(win){var title=win.querySelector(`.winTitle`);if(title){var hideBtn=title.querySelector(`.wbtn.hidebar`),reopen=win.querySelector(`.winReopen`);hideBtn&&(hideBtn.addEventListener(`click`,function(e){e.stopPropagation(),win.classList.add(`barHidden`),reopen&&reopen.classList.add(`show`)}),reopen&&reopen.addEventListener(`click`,function(e){e.stopPropagation(),win.classList.remove(`barHidden`),reopen.classList.remove(`show`)}))}}document.querySelectorAll(`.win`).forEach(initBarToggle)})();
;
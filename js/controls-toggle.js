/* controls-toggle.js: plegar/desplegar los controles en pantalla de cada juego
   (Pac-Man, Invaders, Snake, Asteroids y Tetris) — Juegos XP.
   Los controles no desaparecen: se pueden ocultar para liberar el hueco y que la
   pantalla de juego se agrande (cada juego recalcula su lienzo al recibir 'resize').
   El estado plegado se recuerda en localStorage. */
(function(){
  var KEY='uiCtrlCollapsed';
  function read(){try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(e){return{};}}
  function write(st){try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}}
  var state=read();
  function apply(target,btn,collapsed){
    target.classList.toggle('ctHidden',collapsed);
    btn.classList.toggle('collapsed',collapsed);
  }
  document.querySelectorAll('.ctrlToggle').forEach(function(btn){
    var id=btn.getAttribute('data-target');
    var target=id&&document.getElementById(id);
    if(!target)return;
    // estado recordado al cargar (se aplica antes de abrir el juego)
    if(state[id])apply(target,btn,true);
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var collapsed=!target.classList.contains('ctHidden');
      apply(target,btn,collapsed);
      state[id]=collapsed;
      write(state);
      // que el lienzo del juego abierto se reajuste al nuevo espacio
      window.dispatchEvent(new Event('resize'));
    });
  });
})();

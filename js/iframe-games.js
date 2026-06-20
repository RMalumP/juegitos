/* iframe-games.js: Ajedrez y Parchís (HTML externo, carga bajo demanda al abrir) — Juegos XP. Código original sin cambios (solo separado en archivos). */
var GAMES_BASE=new URL('../games/',document.currentScript.src).href;
function initChess(){var f=document.getElementById('chessFrame');if(f.getAttribute('data-loaded'))return;f.setAttribute('data-loaded','1');fetch(GAMES_BASE+'chess.html').then(function(r){return r.text();}).then(function(html){f.srcdoc=html;});}
function initParchis(){var f=document.getElementById('parchisFrame');if(f.getAttribute('data-loaded'))return;f.setAttribute('data-loaded','1');fetch(GAMES_BASE+'parchis.html').then(function(r){return r.text();}).then(function(html){f.srcdoc=html;});}
function openChessTab(idx){
  openGame("chess");
  var f=document.getElementById("chessFrame");
  var tries=0;
  (function poll(){
    tries++;
    var w=f.contentWindow;
    if(w&&typeof w.switchTab==="function"){try{w.switchTab(idx);}catch(e){}return;}
    if(tries<150)setTimeout(poll,40);
  })();
}
document.getElementById("sBtnDamas").onclick=function(){document.getElementById("startScreen").style.display="none";openChessTab(2);};
(function(){var last=0;var el=document.getElementById("iconDamas");el.addEventListener("click",function(){this.parentNode.querySelectorAll(".deskIcon").forEach(function(d){d.classList.remove("sel");});this.classList.add("sel");var now=Date.now();if(now-last<400)openChessTab(2);last=now;});})();

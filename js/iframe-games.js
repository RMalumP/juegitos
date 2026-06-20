/* iframe-games.js: Ajedrez y Parchís (HTML externo en games/*.js, carga por <script> al abrir) — Juegos XP. Código original sin cambios (solo separado en archivos). */
var GAMES_BASE=new URL('../games/',document.currentScript.src).href;
function loadFrameDoc(frameId,globalName,file){var f=document.getElementById(frameId);if(!f||f.getAttribute('data-loaded'))return;f.setAttribute('data-loaded','1');if(window[globalName]){f.srcdoc=window[globalName];return;}var s=document.createElement('script');s.src=GAMES_BASE+file;s.onload=function(){f.srcdoc=window[globalName];};document.head.appendChild(s);}
function initChess(){loadFrameDoc('chessFrame','__CHESS_HTML','chess.js');}
function initParchis(){loadFrameDoc('parchisFrame','__PARCHIS_HTML','parchis.js');}
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

/* lazy-loader.js: carga bajo demanda de los módulos de juego (primer "abrir") — Juegos XP. Código original sin cambios (solo separado en archivos). */
(function(){
  var base=new URL('..',document.currentScript.src).href; // .../ (raíz del sitio)
  var cache={};
  function load(url){ if(cache[url])return cache[url];
    return cache[url]=new Promise(function(res,rej){
      var s=document.createElement('script'); s.src=url; s.async=false;
      s.onload=function(){res();}; s.onerror=function(){rej(new Error('load '+url));};
      document.head.appendChild(s);
    });
  }
  function css(url){ if(cache[url])return cache[url];
    return cache[url]=new Promise(function(res){
      var l=document.createElement('link'); l.rel='stylesheet'; l.href=url;
      // Resolver al cargar (o fallar) para que el init mida el canvas con el CSS YA aplicado.
      l.onload=function(){res();}; l.onerror=function(){res();};
      document.head.appendChild(l);
    });
  }
  // game -> { js, css, init }
  var GAMES={
    Sud:{js:'js/games/sudoku.js',  css:'css/games/sudoku.css',   init:'initSud'},
    Tetris:{js:'js/games/tetris.js',css:'css/games/tetris.css',  init:'initTetris'},
    Inv:{js:'js/games/invaders.js',css:'css/games/invaders.css', init:'initInv'},
    Snk:{js:'js/games/snake.js',   css:'css/games/snake.css',    init:'initSnk'},
    Pac:{js:'js/games/pacman.js',  css:'css/games/pacman.css',   init:'initPac'},
    Ast:{js:'js/games/asteroids.js',css:'css/games/asteroids.css',init:'initAst'}
  };
  // Define un stub global init* que carga el módulo y luego llama al init real.
  Object.keys(GAMES).forEach(function(key){
    var g=GAMES[key];
    window[g.init]=function(){
      // Esperar a CSS *y* JS: si el init corre antes de aplicarse el CSS del juego,
      // el canvas se mide contra un layout sin estilos (pequeño/descolocado).
      Promise.all([css(base+g.css),load(base+g.js)]).then(function(){
        // tras cargar, window[init] es la función real (sobrescribe el stub)
        if(window[g.init]&&window[g.init].__lazy)return; // seguridad
        window[g.init]();
      });
    };
    window[g.init].__lazy=true;
  });
})();

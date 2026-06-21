/* frogger.js — Juegos XP: Frogger con emojis (ligero). Cruza la carretera y el río
   sin morir y llena las 5 casas. Control táctil (deslizar + cruceta ocultable) y teclado reasignable. */
(function(){
  var DEF={up:"ArrowUp",down:"ArrowDown",left:"ArrowLeft",right:"ArrowRight",newgame:"Enter"};
  var keys=Object.assign({},DEF);
  try{var sv=localStorage.getItem("frogKeyMap");if(sv)keys=Object.assign({},DEF,JSON.parse(sv));}catch(e){}

  var COLS=13,ROWS=12,CELL=26;
  var cv=document.getElementById("frogC"),ctx=cv.getContext("2d");
  cv.width=COLS*CELL;cv.height=ROWS*CELL;
  var W=cv.width,H=cv.height;

  var HOME=0,RIVER=[1,2,3,4],MEDIAN=5,ROAD=[6,7,8,9,10],START=11;
  var PADS=[1,4,6,8,11];
  var MAXLVL=10,startLevel=1;

  /* configuración base de carriles (velocidad en celdas/seg) */
  var BASE=[
    {row:1,kind:"plat",sprite:"🐢",dir:-1,speed:1.2,len:2,gap:2},
    {row:2,kind:"plat",sprite:"🪵",dir:1,speed:0.9,len:3,gap:3},
    {row:3,kind:"plat",sprite:"🪵",dir:-1,speed:1.5,len:2,gap:3},
    {row:4,kind:"plat",sprite:"🐢",dir:1,speed:1.1,len:2,gap:2},
    {row:6,kind:"car",sprite:"🚗",dir:1,speed:1.4,len:1,gap:3},
    {row:7,kind:"car",sprite:"🚙",dir:-1,speed:2.0,len:1,gap:4},
    {row:8,kind:"car",sprite:"🚌",dir:1,speed:1.0,len:2,gap:4},
    {row:9,kind:"car",sprite:"🏎️",dir:-1,speed:2.6,len:1,gap:5},
    {row:10,kind:"car",sprite:"🚚",dir:1,speed:1.2,len:2,gap:4}
  ];
  var lanes=[];

  var frog={col:6,row:START},maxRow,lives,score,level,filled,running=false,paused=false,over=false,dying=false,deathTimer=0,raf=null,gtime=0;

  function buildLanes(){
    lanes=[];gtime=0;
    BASE.forEach(function(c){
      var step=c.len+c.gap,count=Math.ceil((COLS+c.len+c.gap)/step)+1,T=count*step,items=[];
      for(var i=0;i<count;i++)items.push({x:i*step+(c.dir<0?0.5:0),ph:(i*0.41)%1});
      /* niveles difíciles: las tortugas se sumergen (nivel >= 4) */
      var dive=c.sprite==="🐢"&&level>=4;
      lanes.push({row:c.row,kind:c.kind,sprite:c.sprite,dir:c.dir,speed:c.speed,len:c.len,T:T,items:items,dive:dive});
    });
    /* niveles difíciles: serpiente cruzando la mediana (nivel >= 6) */
    if(level>=6){
      var sp=1.3+(level-6)*0.15,len=1,gap=8,step=len+gap,count=Math.ceil((COLS+len+gap)/step)+1,T=count*step,items=[];
      for(var i=0;i<count;i++)items.push({x:i*step});
      lanes.push({row:MEDIAN,kind:"car",sprite:"🐍",dir:-1,speed:sp,len:len,T:T,items:items});
    }
  }
  /* tortuga sumergida: no es plataforma y se dibuja como agua */
  function submerged(l,it){
    if(!l.dive)return false;
    return ((gtime*0.45+it.ph)%1)>0.62;
  }
  function laneAt(row){for(var i=0;i<lanes.length;i++)if(lanes[i].row===row)return lanes[i];return null;}
  function mult(){return 1+(level-1)*0.18;}

  function updateHUD(){
    document.getElementById("frog-scoreEl").textContent=" "+score;
    document.getElementById("frog-livesEl").textContent=lives;
    document.getElementById("frog-levelEl").textContent=level;
  }
  function resetFrog(){frog.col=6;frog.row=START;maxRow=START;}
  function newGame(){
    lives=3;score=0;level=startLevel;filled=[false,false,false,false,false];
    buildLanes();resetFrog();over=false;paused=false;dying=false;
    updateHUD();document.getElementById("frogGameOver").classList.remove("show");
  }

  /* ---- selección de nivel (estilo Invaders) ---- */
  function markGrid(){
    var g=document.getElementById("frogLevelGrid");
    if(g)g.querySelectorAll(".frogLevelCell").forEach(function(c){c.classList.toggle("selected",+c.textContent===startLevel);});
  }
  function buildLevelGrid(){
    var g=document.getElementById("frogLevelGrid");
    if(!g)return;g.innerHTML="";
    for(var i=1;i<=MAXLVL;i++)(function(n){
      var c=document.createElement("div");
      c.className="frogLevelCell"+(n===startLevel?" selected":"");
      c.textContent=n;
      c.addEventListener("click",function(){
        startLevel=n;markGrid();
        if(!running){level=n;updateHUD();}
      });
      g.appendChild(c);
    })(i);
  }
  function setLevel(n){
    n=Math.max(1,Math.min(MAXLVL,n));
    if(running&&!over){startLevel=n;level=n;buildLanes();resetFrog();}
    else{startLevel=n;level=n;markGrid();}
    updateHUD();if(!running||paused)draw();
  }

  function die(){
    if(dying||over)return;
    dying=true;deathTimer=42;lives--;updateHUD();vibrate(200);
    if(lives<=0)setTimeout(gameOver,650);
  }
  function gameOver(){
    over=true;running=false;
    document.getElementById("frogFinal").textContent="Puntuación: "+score+"  ·  Nivel "+level;
    document.getElementById("frogGameOver").classList.add("show");
  }
  function nextLevel(){
    if(level<MAXLVL)level++;
    filled=[false,false,false,false,false];buildLanes();resetFrog();
    score+=200;updateHUD();vibrate([0,40,60,40,60,40]);
  }
  function reachHome(col){
    var idx=PADS.indexOf(col);
    if(idx<0||filled[idx]){die();return;}
    filled[idx]=true;score+=50;vibrate([0,40,40,40]);
    if(filled.every(function(f){return f;}))nextLevel();else resetFrog();
    updateHUD();
  }

  function moveFrog(dx,dy){
    if(!running||over||paused||dying)return;
    var nr=frog.row+dy,nc=Math.round(frog.col)+dx;
    if(nr<0||nr>ROWS-1)return;
    nc=Math.max(0,Math.min(COLS-1,nc));
    frog.row=nr;frog.col=nc;vibrate(12);
    if(nr<maxRow){maxRow=nr;score+=10;updateHUD();}
    if(nr===HOME)reachHome(nc);
  }

  function step(dt){
    gtime+=dt;
    var m=mult();
    /* mover obstáculos siempre */
    for(var li=0;li<lanes.length;li++){
      var l=lanes[li],v=l.dir*l.speed*m*dt,items=l.items;
      for(var ii=0;ii<items.length;ii++){
        var it=items[ii];it.x+=v;
        if(v>0&&it.x>COLS)it.x-=l.T;
        else if(v<0&&it.x<-l.len)it.x+=l.T;
      }
    }
    if(paused||over)return;
    if(dying){deathTimer--;if(deathTimer<=0){dying=false;if(lives>0)resetFrog();}return;}
    var lane=laneAt(frog.row),c=frog.col+0.5;
    if(lane){
      if(lane.kind==="car"){
        for(var i=0;i<lane.items.length;i++){var ci=lane.items[i];if(c>=ci.x&&c<ci.x+lane.len){die();return;}}
      }else{ /* río: hay que ir sobre un tronco/tortuga */
        var on=null;
        for(var j=0;j<lane.items.length;j++){var p=lane.items[j];if(c>=p.x&&c<p.x+lane.len&&!submerged(lane,p)){on=p;break;}}
        if(!on){die();return;}
        frog.col+=lane.dir*lane.speed*m*dt;
        if(frog.col+0.5<0||frog.col+0.5>COLS){die();return;}
      }
    }
  }

  /* ---- dibujo ---- */
  function rowBg(row){
    if(row===HOME)return "#06402a";
    if(RIVER.indexOf(row)>=0)return "#0a3a6b";
    if(row===MEDIAN||row===START)return "#1e7a3a";
    return "#2a2a2a";
  }
  /* caché de sprites: cada emoji se rasteriza una vez a un canvas pequeño y
     luego se pinta con drawImage (mucho más barato que fillText cada frame).
     Se guarda también la versión espejada para los emojis que miran a la
     izquierda por defecto y avanzan hacia la derecha. */
  var sprites={},bgCanvas=null;
  function getSprite(em,flip){
    var key=(flip?"!":"")+em,c=sprites[key];
    if(c)return c;
    c=document.createElement("canvas");c.width=CELL;c.height=CELL;
    var x=c.getContext("2d");
    x.font=Math.floor(CELL*0.78)+"px serif";x.textAlign="center";x.textBaseline="middle";
    if(flip){x.translate(CELL,0);x.scale(-1,1);}
    x.fillText(em,CELL/2,CELL/2+1);
    sprites[key]=c;return c;
  }
  function buildBg(){
    bgCanvas=document.createElement("canvas");bgCanvas.width=W;bgCanvas.height=H;
    var x=bgCanvas.getContext("2d");
    for(var r=0;r<ROWS;r++){x.fillStyle=rowBg(r);x.fillRect(0,r*CELL,W,CELL);}
  }
  function prewarm(){
    ["🐸","🪷","🌊","💥","🪵"].forEach(function(e){getSprite(e,false);});
    ["🚗","🚙","🚌","🚚","🏎️","🐢","🐍"].forEach(function(e){getSprite(e,false);getSprite(e,true);});
  }
  function emoji(s,col,row){ctx.drawImage(getSprite(s,false),col*CELL,row*CELL);}
  function emojiDir(s,col,row,dir){ctx.drawImage(getSprite(s,dir>0),col*CELL,row*CELL);}
  function draw(){
    if(!bgCanvas)buildBg();
    ctx.drawImage(bgCanvas,0,0);
    /* casas */
    for(var i=0;i<PADS.length;i++)emoji(filled[i]?"🐸":"🪷",PADS[i],HOME);
    /* carriles */
    for(var li=0;li<lanes.length;li++){
      var l=lanes[li],items=l.items,isLog=l.sprite==="🪵";
      for(var ii=0;ii<items.length;ii++){
        var it=items[ii],sub=submerged(l,it);
        for(var k=0;k<l.len;k++){
          var cx=it.x+k;
          if(cx<=-1||cx>=COLS)continue;
          if(sub)emoji("🌊",cx,l.row);            /* tortuga sumergida */
          else if(isLog)emoji(l.sprite,cx,l.row);  /* tronco: sin dirección */
          else emojiDir(l.sprite,cx,l.row,l.dir);
        }
      }
    }
    /* rana */
    if(dying)emoji("💥",Math.round(frog.col),frog.row);
    else emoji("🐸",frog.col,frog.row);
  }

  var acc=0,last=0;
  function loop(t){
    var n=t||performance.now();
    acc+=Math.min(n-(last||n),100);last=n;
    var g=0;
    while(acc>=1000/60&&g<6){step(1/60);acc-=1000/60;g++;}
    draw();raf=requestAnimationFrame(loop);
  }

  /* ---- pantallas ---- */
  function startPlay(){
    document.getElementById("frogStartScreen").style.display="none";
    document.getElementById("frogGameOver").classList.remove("show");
    newGame();running=true;paused=false;
    last=0;if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
  }
  function resume(){
    document.getElementById("frogStartScreen").style.display="none";
    paused=false;last=0;if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
  }
  function showStartScreen(){
    if(raf)cancelAnimationFrame(raf);raf=null;
    running=false;paused=false;over=false;
    newGame();
    var ss=document.getElementById("frogStartScreen");
    document.getElementById("frogLevelSelect").style.display="flex";
    ss.querySelector("h1").textContent="🐸 FROGGER";
    ss.style.display="flex";
    document.getElementById("frogGameOver").classList.remove("show");
    document.getElementById("frog-startBtn").textContent="▶ INICIAR JUEGO";
    document.getElementById("frog-startBtn").onclick=startPlay;
    markGrid();draw();
  }
  document.getElementById("frog-startBtn").onclick=startPlay;
  document.getElementById("frog-restartBtn").onclick=showStartScreen;
  document.getElementById("frogNewGame").onclick=showStartScreen;
  document.getElementById("frog-levelUp")?.addEventListener("click",function(e){e.stopPropagation();setLevel(level+1);});
  document.getElementById("frog-levelDown")?.addEventListener("click",function(e){e.stopPropagation();setLevel(level-1);});

  /* ---- botones en pantalla (cruceta) ---- */
  function bindBtn(id,dx,dy){
    var b=document.getElementById(id);
    b.addEventListener("pointerdown",function(e){e.preventDefault();b.classList.add("pressed");moveFrog(dx,dy);});
    ["pointerup","pointerleave","pointercancel"].forEach(function(ev){b.addEventListener(ev,function(e){e.preventDefault();b.classList.remove("pressed");});});
  }
  bindBtn("frogBtnUp",0,-1);bindBtn("frogBtnDown",0,1);bindBtn("frogBtnLeft",-1,0);bindBtn("frogBtnRight",1,0);

  /* ---- deslizar sobre el lienzo ---- */
  var tz=document.getElementById("frogTouchZone"),sx=0,sy=0,sp=false;
  tz.addEventListener("pointerdown",function(e){e.preventDefault();sx=e.clientX;sy=e.clientY;sp=true;},{passive:false});
  tz.addEventListener("pointerup",function(e){
    if(!sp)return;sp=false;
    var dx=e.clientX-sx,dy=e.clientY-sy;
    if(Math.abs(dx)<14&&Math.abs(dy)<14){moveFrog(0,-1);return;} /* tap = avanzar */
    if(Math.abs(dx)>Math.abs(dy))moveFrog(dx>0?1:-1,0);
    else moveFrog(0,dy>0?1:-1);
  },{passive:false});

  /* ---- teclado ---- */
  document.addEventListener("keydown",function(e){
    if(document.getElementById("frogRemapModal")?.classList.contains("active"))return;
    if(document.getElementById("winFrog").classList.contains("hidden"))return;
    if(e.code===keys.newgame){e.preventDefault();
      if(document.getElementById("frogStartScreen").style.display!=="none"||over)startPlay();
      else showStartScreen();
      return;}
    if(e.repeat)return;
    if(e.code===keys.up||e.code==="KeyW"){e.preventDefault();moveFrog(0,-1);}
    else if(e.code===keys.down||e.code==="KeyS"){e.preventDefault();moveFrog(0,1);}
    else if(e.code===keys.left||e.code==="KeyA"){e.preventDefault();moveFrog(-1,0);}
    else if(e.code===keys.right||e.code==="KeyD"){e.preventDefault();moveFrog(1,0);}
  });

  /* ---- ajuste de tamaño ---- */
  function fit(){
    var w=document.getElementById("frogCanvasWrap");
    if(!w)return;
    var s=Math.min(w.clientWidth/W,w.clientHeight/H);
    if(s>0){cv.style.width=Math.floor(W*s)+"px";cv.style.height=Math.floor(H*s)+"px";}
  }
  window.addEventListener("resize",fit);

  window.initFrog=function(){fit();requestAnimationFrame(fit);prewarm();buildLevelGrid();newGame();draw();};
  window.frogStartNew=function(){showStartScreen();};
  window.pauseFrog=function(){
    if(running&&!paused&&!over){
      paused=true;if(raf)cancelAnimationFrame(raf);raf=null;
      var ss=document.getElementById("frogStartScreen");
      document.getElementById("frogLevelSelect").style.display="none";
      ss.querySelector("h1").textContent="PAUSA";
      ss.style.display="flex";
      var b=document.getElementById("frog-startBtn");
      b.textContent="▶ CONTINUAR";
      b.onclick=function(){b.textContent="▶ INICIAR JUEGO";b.onclick=startPlay;ss.querySelector("h1").textContent="🐸 FROGGER";resume();};
    }
  };

  /* ---- reasignar teclas ---- */
  function keyName(c){return {ArrowLeft:"←",ArrowRight:"→",ArrowUp:"↑",ArrowDown:"↓",Space:"Space",Enter:"Enter",KeyW:"W",KeyA:"A",KeyS:"S",KeyD:"D"}[c]||c;}
  function openRemap(){
    var m=document.getElementById("frogRemapModal"),ks=document.getElementById("frogRemapKeys");
    ks.innerHTML="";
    [["up","Arriba"],["down","Abajo"],["left","Izquierda"],["right","Derecha"],["newgame","Nueva partida"]].forEach(function(a){
      var row=document.createElement("div");row.className="frogRemapRow";
      var lbl=document.createElement("span");lbl.className="frogRemapLabel";lbl.textContent=a[1];
      var btn=document.createElement("button");btn.className="frogRemapKey";btn.textContent=keyName(keys[a[0]]);
      btn.addEventListener("click",function(){
        if(btn.classList.contains("waiting"))return;
        document.querySelectorAll(".frogRemapKey.waiting").forEach(function(b){b.classList.remove("waiting");});
        btn.classList.add("waiting");btn.textContent="...";
        function onkey(ev){
          ev.preventDefault();
          if(ev.code==="Escape"){btn.classList.remove("waiting");btn.textContent=keyName(keys[a[0]]);document.removeEventListener("keydown",onkey,true);return;}
          keys[a[0]]=ev.code;btn.classList.remove("waiting");btn.textContent=keyName(ev.code);document.removeEventListener("keydown",onkey,true);
        }
        document.addEventListener("keydown",onkey,true);
      });
      row.appendChild(lbl);row.appendChild(btn);ks.appendChild(row);
    });
    m.classList.add("active");
  }
  function closeRemap(){
    document.getElementById("frogRemapModal").classList.remove("active");
    try{localStorage.setItem("frogKeyMap",JSON.stringify(keys));}catch(_){}
  }
  document.getElementById("frogRemapBtn")?.addEventListener("click",openRemap);
  document.getElementById("frog-remap-close")?.addEventListener("click",closeRemap);
  document.getElementById("frog-remap-reset")?.addEventListener("click",function(){keys=Object.assign({},DEF);openRemap();});
  document.getElementById("frogRemapModal")?.addEventListener("click",function(e){if(e.target.id==="frogRemapModal")closeRemap();});

  draw();
})();

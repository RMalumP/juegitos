/* pong.js — Juegos XP: Pong contra CPU o 2 jugadores, orientación horizontal o vertical.
   Control táctil (arrastrar) y teclado reasignable. Sin botones en pantalla. */
(function(){
  var DEF={p1up:"KeyW",p1down:"KeyS",p2up:"ArrowUp",p2down:"ArrowDown",newgame:"Enter"};
  var keys=Object.assign({},DEF);
  try{var sv=localStorage.getItem("pongKeyMap");if(sv)keys=Object.assign({},DEF,JSON.parse(sv));}catch(e){}

  var cv=document.getElementById("pongC"),ctx=cv.getContext("2d");
  var W=cv.width,H=cv.height;
  var PAD=14,PW=8,PH=64,BALL=9,WIN_SCORE=7,MAXV=7.2;
  var mode="cpu",orient="h";
  var p1y,p2y,bx,by,bvx,bvy,s1,s2;
  var running=false,paused=false,over=false,raf=null;
  var key={p1u:false,p1d:false,p2u:false,p2d:false};
  var touchP1=null,touchP2=null,pointers={};

  function clampPad(v){return Math.max(PH/2,Math.min(H-PH/2,v));}

  function serve(dir){
    bx=W/2;by=H/2;
    var ang=Math.random()*0.7-0.35;
    var sp=3.4;
    if(!dir)dir=Math.random()<0.5?-1:1;
    bvx=dir*sp*Math.cos(ang);
    bvy=sp*Math.sin(ang);
  }
  function reset(){
    p1y=H/2;p2y=H/2;touchP1=null;touchP2=null;pointers={};
    serve();
  }
  function updateScore(){
    document.getElementById("pong-p1Score").textContent=s1;
    document.getElementById("pong-p2Score").textContent=s2;
  }
  function newGame(){
    s1=0;s2=0;over=false;paused=false;reset();updateScore();
    document.getElementById("pongGameOver").classList.remove("show");
  }

  function step(){
    if(paused||over)return;
    var sp=5.4,tm=9;
    /* jugador 1 (pala izquierda) */
    if(key.p1u)p1y-=sp;
    if(key.p1d)p1y+=sp;
    if(touchP1!=null)p1y+=Math.max(-tm,Math.min(tm,touchP1-p1y));
    /* jugador 2 (pala derecha) o CPU */
    if(mode==="2p"){
      if(key.p2u)p2y-=sp;
      if(key.p2d)p2y+=sp;
      if(touchP2!=null)p2y+=Math.max(-tm,Math.min(tm,touchP2-p2y));
    }else{
      var cspd=4.6,d=by+ -p2y + (bvx>0?bvy*4:0);
      p2y+=Math.max(-cspd,Math.min(cspd,d));
    }
    p1y=clampPad(p1y);p2y=clampPad(p2y);
    /* pelota */
    bx+=bvx;by+=bvy;
    if(by<BALL/2){by=BALL/2;bvy=-bvy;vibrate(6);}
    if(by>H-BALL/2){by=H-BALL/2;bvy=-bvy;vibrate(6);}
    if(bvx<0&&bx-BALL/2<PAD+PW&&bx>PAD&&Math.abs(by-p1y)<PH/2+BALL/2){
      bx=PAD+PW+BALL/2;bvx=-bvx*1.05;bvy+=(by-p1y)/(PH/2)*1.6;vibrate(12);
    }
    if(bvx>0&&bx+BALL/2>W-PAD-PW&&bx<W-PAD&&Math.abs(by-p2y)<PH/2+BALL/2){
      bx=W-PAD-PW-BALL/2;bvx=-bvx*1.05;bvy+=(by-p2y)/(PH/2)*1.6;vibrate(12);
    }
    var spd=Math.hypot(bvx,bvy);
    if(spd>MAXV){bvx*=MAXV/spd;bvy*=MAXV/spd;}
    if(bx<-BALL){s2++;updateScore();point(-1);}
    else if(bx>W+BALL){s1++;updateScore();point(1);}
  }
  function point(dir){
    vibrate([0,40,40,40]);
    if(s1>=WIN_SCORE||s2>=WIN_SCORE)endGame();
    else{p1y=H/2;p2y=H/2;touchP1=null;touchP2=null;serve(dir);}
  }
  function endGame(){
    over=true;
    var who=s1>s2?(mode==="cpu"?"¡Ganaste!":"Gana Jugador 1"):(mode==="cpu"?"Gana la CPU":"Gana Jugador 2");
    document.getElementById("pongFinal").textContent=who+"  ·  "+s1+" : "+s2;
    document.getElementById("pongGameOver").classList.add("show");
  }

  /* dibujo (con intercambio de ejes para la orientación vertical) */
  function fillL(x0,y0,w,h){
    if(orient==="h")ctx.fillRect(x0,y0,w,h);
    else ctx.fillRect(y0,x0,h,w);
  }
  function dot(lx,ly,r){
    var sx=orient==="h"?lx:ly,sy=orient==="h"?ly:lx;
    ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();
  }
  function draw(){
    ctx.fillStyle="#000";ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#0a3a3a";
    for(var y=8;y<H;y+=24)fillL(W/2-2,y,4,14);
    ctx.fillStyle="#fff";
    fillL(PAD,p1y-PH/2,PW,PH);
    fillL(W-PAD-PW,p2y-PH/2,PW,PH);
    dot(bx,by,BALL/2);
  }

  var acc=0,last=0;
  function loop(t){
    var n=t||performance.now();
    acc+=Math.min(n-(last||n),100);last=n;
    var g=0;
    while(acc>=1000/60&&g<6){step();acc-=1000/60;g++;}
    draw();raf=requestAnimationFrame(loop);
  }

  /* ---- pantallas ---- */
  function showStart(opts){
    var ss=document.getElementById("pongStartScreen");
    document.getElementById("pongOpts").style.display=opts?"flex":"none";
    ss.querySelector("h1").textContent=opts?"PONG":"PAUSA";
    ss.style.display="flex";
  }
  function startPlay(){
    document.getElementById("pongStartScreen").style.display="none";
    document.getElementById("pongGameOver").classList.remove("show");
    newGame();running=true;paused=false;
    last=0;if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
  }
  function resume(){
    document.getElementById("pongStartScreen").style.display="none";
    paused=false;last=0;if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
  }

  document.getElementById("pong-startBtn").onclick=startPlay;
  document.getElementById("pong-restartBtn").onclick=function(){
    document.getElementById("pongGameOver").classList.remove("show");
    showStart(true);
  };
  document.getElementById("pongNewGame").onclick=function(){showStart(true);};

  /* opciones (modo / orientación) */
  document.querySelectorAll("#pongOpts .pongOpt").forEach(function(b){
    b.addEventListener("click",function(){
      var opt=b.dataset.opt,val=b.dataset.val;
      document.querySelectorAll('#pongOpts .pongOpt[data-opt="'+opt+'"]').forEach(function(o){o.classList.remove("sel");});
      b.classList.add("sel");
      if(opt==="mode")mode=val;else orient=val;
    });
  });

  /* ---- táctil: arrastrar para mover la pala ---- */
  function locate(e){
    var r=cv.getBoundingClientRect();
    var nx=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
    var ny=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
    var side,pos;
    if(orient==="h"){side=nx<0.5?"L":"R";pos=ny*H;}
    else{side=ny<0.5?"L":"R";pos=nx*H;}
    return {side:side,pos:pos};
  }
  var tz=document.getElementById("pongTouchZone");
  tz.addEventListener("pointerdown",function(e){
    if(!running||over||paused)return;e.preventDefault();
    var l=locate(e),side=mode==="cpu"?"L":l.side;
    pointers[e.pointerId]=side;
    if(side==="L")touchP1=l.pos;else touchP2=l.pos;
    try{tz.setPointerCapture(e.pointerId);}catch(_){}
  },{passive:false});
  tz.addEventListener("pointermove",function(e){
    var side=pointers[e.pointerId];if(!side)return;e.preventDefault();
    var l=locate(e);if(side==="L")touchP1=l.pos;else touchP2=l.pos;
  },{passive:false});
  function pend(e){
    var side=pointers[e.pointerId];if(!side)return;delete pointers[e.pointerId];
    var still=Object.keys(pointers).some(function(k){return pointers[k]===side;});
    if(!still){if(side==="L")touchP1=null;else touchP2=null;}
  }
  ["pointerup","pointercancel","pointerleave"].forEach(function(ev){tz.addEventListener(ev,pend);});

  /* ---- teclado ---- */
  document.addEventListener("keydown",function(e){
    if(document.getElementById("pongRemapModal")?.classList.contains("active"))return;
    if(document.getElementById("winPong").classList.contains("hidden"))return;
    if(e.code===keys.newgame){e.preventDefault();
      if(document.getElementById("pongStartScreen").style.display!=="none"||over)startPlay();
      else showStart(true);
      return;}
    if(e.code===keys.p1up){key.p1u=true;e.preventDefault();}
    else if(e.code===keys.p1down){key.p1d=true;e.preventDefault();}
    else if(e.code===keys.p2up){key.p2u=true;e.preventDefault();}
    else if(e.code===keys.p2down){key.p2d=true;e.preventDefault();}
  });
  document.addEventListener("keyup",function(e){
    if(e.code===keys.p1up)key.p1u=false;
    else if(e.code===keys.p1down)key.p1d=false;
    else if(e.code===keys.p2up)key.p2u=false;
    else if(e.code===keys.p2down)key.p2d=false;
  });

  /* ---- ajuste de tamaño ---- */
  function fit(){
    var w=document.getElementById("pongCanvasWrap");
    if(!w)return;
    var s=Math.min(w.clientWidth,w.clientHeight);
    if(s>0){cv.style.width=s+"px";cv.style.height=s+"px";}
  }
  window.addEventListener("resize",fit);

  window.initPong=function(){fit();requestAnimationFrame(fit);newGame();draw();};
  window.pongStartNew=function(){showStart(true);};
  window.pausePong=function(){
    if(running&&!paused&&!over){
      paused=true;if(raf)cancelAnimationFrame(raf);raf=null;
      showStart(false);
      var b=document.getElementById("pong-startBtn");
      b.textContent="▶ CONTINUAR";b.onclick=function(){b.textContent="▶ INICIAR JUEGO";b.onclick=startPlay;resume();};
    }
  };

  /* ---- reasignar teclas ---- */
  function keyName(c){return {ArrowLeft:"←",ArrowRight:"→",ArrowUp:"↑",ArrowDown:"↓",Space:"Space",Enter:"Enter",KeyW:"W",KeyA:"A",KeyS:"S",KeyD:"D",KeyJ:"J",KeyK:"K",KeyI:"I",KeyO:"O"}[c]||c;}
  function openRemap(){
    var m=document.getElementById("pongRemapModal"),ks=document.getElementById("pongRemapKeys");
    ks.innerHTML="";
    [["p1up","J1 ↑ / ←"],["p1down","J1 ↓ / →"],["p2up","J2 ↑ / ←"],["p2down","J2 ↓ / →"],["newgame","Nueva partida"]].forEach(function(a){
      var row=document.createElement("div");row.className="pongRemapRow";
      var lbl=document.createElement("span");lbl.className="pongRemapLabel";lbl.textContent=a[1];
      var btn=document.createElement("button");btn.className="pongRemapKey";btn.textContent=keyName(keys[a[0]]);
      btn.addEventListener("click",function(){
        if(btn.classList.contains("waiting"))return;
        document.querySelectorAll(".pongRemapKey.waiting").forEach(function(b){b.classList.remove("waiting");});
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
    document.getElementById("pongRemapModal").classList.remove("active");
    try{localStorage.setItem("pongKeyMap",JSON.stringify(keys));}catch(_){}
  }
  document.getElementById("pongRemapBtn")?.addEventListener("click",openRemap);
  document.getElementById("pong-remap-close")?.addEventListener("click",closeRemap);
  document.getElementById("pong-remap-reset")?.addEventListener("click",function(){keys=Object.assign({},DEF);openRemap();});
  document.getElementById("pongRemapModal")?.addEventListener("click",function(e){if(e.target.id==="pongRemapModal")closeRemap();});

  draw();
})();

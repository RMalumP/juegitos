/* dice.js — Juegos XP: selector de dados. Eliges nº de dados, las caras de cada
   dado (pueden ser distintas) y la lista de jugadores (nombre y orden). Al jugar,
   cada jugador tira por turnos y los resultados se acumulan en el historial.
   No hay ganadores: cuando el último jugador termina, se vuelve a empezar. */
(function(){
  var DICE_MIN=1,DICE_MAX=12,FACE_MIN=2,FACE_MAX=1000;
  var faces=[6,6];                 /* caras de cada dado */
  var players=["Jugador 1","Jugador 2"];
  var turn=0,round=1,history=[],pendingClear=false,rolling=false,playing=false;
  var PIPS=["","⚀","⚁","⚂","⚃","⚄","⚅"];

  function $(id){return document.getElementById(id);}

  /* ---------- CONFIGURACIÓN ---------- */
  function renderFaces(){
    var box=$("diceFacesList");box.innerHTML="";
    faces.forEach(function(f,i){
      var row=document.createElement("div");row.className="diceFaceRow";
      var lbl=document.createElement("span");lbl.className="diceFaceLbl";lbl.textContent="Dado "+(i+1);
      var dec=document.createElement("button");dec.className="diceFaceBtn";dec.textContent="−";
      var inp=document.createElement("input");inp.className="diceFaceInput";inp.type="number";inp.min=FACE_MIN;inp.max=FACE_MAX;inp.value=f;
      var inc=document.createElement("button");inc.className="diceFaceBtn";inc.textContent="+";
      var tag=document.createElement("span");tag.className="diceFaceTag";tag.textContent="caras";
      function set(v){v=Math.max(FACE_MIN,Math.min(FACE_MAX,v|0));faces[i]=v;inp.value=v;}
      dec.onclick=function(){set(faces[i]-1);};
      inc.onclick=function(){set(faces[i]+1);};
      inp.onchange=function(){set(parseInt(inp.value,10)||FACE_MIN);};
      row.append(lbl,dec,inp,inc,tag);
      box.appendChild(row);
    });
  }
  function renderPlayers(){
    var box=$("dicePlayersList");box.innerHTML="";
    players.forEach(function(name,i){
      var row=document.createElement("div");row.className="dicePlayerRow";
      var ord=document.createElement("div");ord.className="diceOrder";
      var up=document.createElement("button");up.textContent="▲";up.disabled=i===0;
      var dn=document.createElement("button");dn.textContent="▼";dn.disabled=i===players.length-1;
      up.onclick=function(){if(i>0){var t=players[i-1];players[i-1]=players[i];players[i]=t;renderPlayers();}};
      dn.onclick=function(){if(i<players.length-1){var t=players[i+1];players[i+1]=players[i];players[i]=t;renderPlayers();}};
      ord.append(up,dn);
      var num=document.createElement("span");num.className="dicePlayerNum";num.textContent=(i+1)+".";
      var inp=document.createElement("input");inp.className="dicePlayerInput";inp.value=name;inp.placeholder="Nombre";
      inp.oninput=function(){players[i]=inp.value;};
      var del=document.createElement("button");del.className="diceDelBtn";del.textContent="✕";del.disabled=players.length<=1;
      del.onclick=function(){if(players.length>1){players.splice(i,1);renderPlayers();}};
      row.append(ord,num,inp,del);
      box.appendChild(row);
    });
  }
  function syncDiceCount(){$("diceDiceCount").textContent=faces.length;renderFaces();}

  $("diceDiceMinus").onclick=function(){if(faces.length>DICE_MIN){faces.pop();syncDiceCount();}};
  $("diceDicePlus").onclick=function(){if(faces.length<DICE_MAX){faces.push(6);syncDiceCount();}};
  $("diceAddPlayer").onclick=function(){players.push("Jugador "+(players.length+1));renderPlayers();};

  /* ---------- JUEGO ---------- */
  function showSetup(){
    playing=false;
    $("diceSetup").style.display="flex";
    $("diceGame").style.display="none";
    renderFaces();renderPlayers();
  }
  function startGame(){
    /* limpia nombres vacíos */
    players=players.map(function(n,i){return (n&&n.trim())?n.trim():"Jugador "+(i+1);});
    faces=faces.map(function(f){return Math.max(FACE_MIN,Math.min(FACE_MAX,f|0));});
    playing=true;turn=0;round=1;history=[];pendingClear=false;rolling=false;
    $("diceSetup").style.display="none";
    $("diceGame").style.display="flex";
    renderHist();renderCurrent(null);renderTurn(false);
  }
  function newGame(){
    if(!playing){startGame();return;}
    turn=0;round=1;history=[];pendingClear=false;rolling=false;
    renderHist();renderCurrent(null);renderTurn(false);
  }

  function renderTurn(done){
    var t=$("diceTurnBar");
    if(done){
      t.innerHTML='✔ Ronda '+round+' completada — pulsa 🎲 Tirar para empezar de nuevo';
      t.classList.add("done");
    }else{
      t.innerHTML='Ronda '+round+' · Turno de <b id=diceTurnName>'+esc(players[turn])+'</b>';
      t.classList.remove("done");
    }
  }
  function esc(s){return String(s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}

  function dieCell(faceCount,val){
    var d=document.createElement("div");d.className="diceDie";
    var v=document.createElement("span");v.className="diceDieVal";
    v.textContent=(faceCount===6&&val>=1&&val<=6)?PIPS[val]:val;
    if(faceCount===6&&val>=1&&val<=6)v.classList.add("pip");
    var tag=document.createElement("span");tag.className="diceDieTag";tag.textContent="d"+faceCount;
    d.append(v,tag);return d;
  }
  function renderCurrent(roll){
    var box=$("diceCurrent");box.innerHTML="";
    if(!roll){box.classList.remove("show");return;}
    box.classList.add("show");
    roll.vals.forEach(function(v,i){box.appendChild(dieCell(faces[i],v));});
    if(roll.sum){var sum=document.createElement("div");sum.className="diceSum";sum.textContent="Σ "+roll.sum;box.appendChild(sum);}
  }
  function renderHist(){
    var box=$("diceHist");box.innerHTML="";
    if(!history.length){box.innerHTML='<div class=diceHistEmpty>Sin tiradas todavía</div>';return;}
    history.forEach(function(h){
      var row=document.createElement("div");row.className="diceHistRow";
      var nm=document.createElement("span");nm.className="diceHistName";nm.textContent=h.name;
      var dc=document.createElement("span");dc.className="diceHistDice";
      dc.textContent=h.vals.map(function(v,i){
        return (h.facesArr[i]===6&&v>=1&&v<=6)?PIPS[v]+v:v+"";
      }).join("  ");
      var sm=document.createElement("span");sm.className="diceHistSum";sm.textContent="Σ "+h.sum;
      var rd=document.createElement("span");rd.className="diceHistRound";rd.textContent="R"+h.round;
      row.append(rd,nm,dc,sm);box.appendChild(row);
    });
    box.scrollTop=box.scrollHeight;
  }

  function roll(){
    if(!playing||rolling)return;
    if(pendingClear){history=[];round++;pendingClear=false;renderHist();}
    rolling=true;$("diceRollBtn").disabled=true;
    var name=players[turn];
    var vals=faces.map(function(f){return 1+Math.floor(Math.random()*f);});
    var sum=vals.reduce(function(a,b){return a+b;},0);
    vibrate(20);
    /* animación breve */
    var ticks=0,iv=setInterval(function(){
      renderCurrent({vals:faces.map(function(f){return 1+Math.floor(Math.random()*f);}),sum:0});
      if(++ticks>=8){
        clearInterval(iv);
        renderCurrent({vals:vals,sum:sum});
        history.push({name:name,vals:vals,sum:sum,facesArr:faces.slice(),round:round});
        renderHist();
        rolling=false;$("diceRollBtn").disabled=false;
        vibrate(40);
        /* siguiente turno */
        turn++;
        if(turn>=players.length){turn=0;pendingClear=true;renderTurn(true);}
        else renderTurn(false);
      }
    },55);
  }

  $("dicePlayBtn").onclick=startGame;
  $("diceRollBtn").onclick=roll;
  $("diceNewGame").onclick=newGame;
  $("diceConfigBtn").onclick=showSetup;

  document.addEventListener("keydown",function(e){
    if($("winDice").classList.contains("hidden"))return;
    if($("diceGame").style.display==="none")return;
    if(e.code==="Space"||e.code==="Enter"){e.preventDefault();roll();}
  });

  window.initDice=function(){showSetup();};
})();

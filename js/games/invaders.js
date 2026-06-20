/* invaders.js — Juegos XP. Niveles ampliados (más velocidades + nuevos enemigos) y selector de nivel estilo Pac-Man. */
(function(){
  var INV_DEF={left:'ArrowLeft',right:'ArrowRight',fire:'Space',newgame:'Enter'},invKeys=Object.assign({},INV_DEF);
  try{var _ik=localStorage.getItem('invKeyMap');if(_ik)invKeys=Object.assign({},INV_DEF,JSON.parse(_ik));}catch(_e){}

  const canvas=document.getElementById('invC'),ctx=canvas.getContext('2d'),
        wrap=document.getElementById('invCanvasWrap'),
        scoreEl=document.getElementById('inv-scoreEl'),
        livesEl=document.getElementById('inv-livesEl'),
        levelEl=document.getElementById('inv-levelEl');
  const MAX_LEVEL=10;
  const SUB_HTML='📱 <strong>Táctil:</strong> arrastra para mover · tap para disparar<br>🎮 <strong>Botones:</strong> ◀ ▶ mover · FIRE disparar<br>⌨️ <strong>Teclado:</strong> ← → mover · ESPACIO disparar';

  function fit(){let cw=wrap.clientWidth,ch=wrap.clientHeight,dw,dh;cw/ch>1.5?(dh=ch,dw=1.5*dh):(dw=cw,dh=dw*(320/480));canvas.style.width=dw+'px';canvas.style.height=dh+'px';}
  window.initInv=function(){fit();};
  window.addEventListener('resize',fit);

  /* ---------- Reasignar teclas ---------- */
  function invKeyName(c){return {ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Space:'Space',Enter:'Enter',KeyW:'W',KeyA:'A',KeyS:'S',KeyD:'D',KeyJ:'J',KeyK:'K',KeyL:'L',KeyI:'I',KeyC:'C',KeyF:'F'}[c]||c;}
  function invOpenRemap(){var b=document.getElementById('invRemapKeys');b.innerHTML='';[{k:'left',l:'Mover ←'},{k:'right',l:'Mover →'},{k:'fire',l:'Disparar'},{k:'newgame',l:'Nueva partida'}].forEach(function(it){var r=document.createElement('div');r.className='invRemapRow';var la=document.createElement('div');la.className='invRemapLabel';la.textContent=it.l;var ke=document.createElement('div');ke.className='invRemapKey';ke.textContent=invKeyName(invKeys[it.k]);ke.addEventListener('click',function(){ke.classList.add('waiting');ke.textContent='Pulsa tecla...';var g=function(ev){ev.preventDefault();ev.stopPropagation();invKeys[it.k]=ev.code;ke.textContent=invKeyName(ev.code);ke.classList.remove('waiting');document.removeEventListener('keydown',g,true);};document.addEventListener('keydown',g,true);});r.appendChild(la);r.appendChild(ke);b.appendChild(r);});document.getElementById('invRemapModal').classList.add('active');}
  function invCloseRemap(){document.getElementById('invRemapModal').classList.remove('active');try{localStorage.setItem('invKeyMap',JSON.stringify(invKeys));}catch(_e){}}
  document.getElementById('invRemapBtn')?.addEventListener('click',invOpenRemap);
  document.getElementById('inv-remap-close')?.addEventListener('click',invCloseRemap);
  document.getElementById('inv-remap-reset')?.addEventListener('click',function(){invKeys=Object.assign({},INV_DEF);invOpenRemap();});
  document.getElementById('invRemapModal')?.addEventListener('click',function(ev){ev.target.id==='invRemapModal'&&invCloseRemap();});

  /* ---------- Enemigos ---------- */
  // type0 calamar · type1 cangrejo · type2 platillo · type3 TANQUE (2 impactos) · type4 EXPLORADOR (rápido, +puntos)
  const SPRITES=[
    [[0,0,1,1,1,1,1,0,0],[0,1,1,0,0,0,1,1,0],[0,1,1,1,1,1,1,1,0],[1,1,0,1,1,1,0,1,1],[1,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,1,0,0],[0,1,0,1,1,1,0,1,0],[1,0,0,0,0,0,0,0,1]],
    [[0,0,0,1,1,0,0,0],[0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,1,0,1,1,0,1,1],[1,1,1,1,1,1,1,1],[0,1,0,1,1,0,1,0],[1,0,0,0,0,0,0,1],[0,1,0,0,0,0,1,0]],
    [[0,1,0,0,0,0,1,0],[0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,0,1,0,0,1,0,1],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,0,1],[1,0,0,0,0,0,0,1],[0,0,1,0,0,1,0,0]],
    [[0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,1,1,0,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,0,1,1,0,1,1],[1,1,1,1,1,1,1,1],[0,1,0,0,0,0,1,0],[1,0,1,0,0,1,0,1]],
    [[0,0,0,1,1,0,0,0],[0,0,1,1,1,1,0,0],[0,1,0,1,1,0,1,0],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,0,1],[1,0,0,0,0,0,0,1],[0,0,1,0,0,1,0,0],[0,1,0,0,0,0,1,0]]
  ];
  const COLORS=['#f44','#0ff','#ff0','#0f0','#f0f'];
  const POINTS=[30,20,10,40,50];
  const HP=[1,1,1,2,1];

  // Configuración por nivel: composición de filas, velocidad y cadencia de fuego crecientes.
  function levelConfig(lvl){
    lvl=Math.max(1,Math.min(MAX_LEVEL,lvl));
    let rows;
    if(lvl<=1)rows=[1,1,2,2];
    else if(lvl<=2)rows=[0,1,1,2,2];
    else if(lvl<=3)rows=[0,0,1,1,2];
    else if(lvl<=4)rows=[3,0,1,1,2];
    else if(lvl<=5)rows=[3,0,1,2,4];
    else if(lvl<=6)rows=[3,3,0,1,4];
    else if(lvl<=7)rows=[3,0,4,1,4];
    else if(lvl<=8)rows=[3,3,4,0,4];
    else if(lvl<=9)rows=[3,4,3,4,3];
    else rows=[3,4,3,4,4];
    return {
      rows:rows,cols:9,
      speed:Math.min(0.35+0.10*(lvl-1),1.7),
      speedCap:Math.min(2.4+0.15*lvl,4),
      speedStep:0.05+0.005*lvl,
      descend:10+Math.min(lvl-1,6)*0.5,
      fireBase:Math.max(34-3*lvl,7),
      fireRand:22,
      bulletSpeed:3.2+0.28*lvl,
      ufoChance:0.0008+0.0005*lvl
    };
  }

  /* ---------- Estado ---------- */
  let score,lives,level,startLevel=1;
  let player,pBullets,eBullets,invaders,stars,bunkers,ufo;
  let dir,speed,speedCap,speedStep,descend,fireBase,fireRand,bulletSpeed,ufoChance,fireTimer;
  let timeAcc,shipVel,gameOver,victory,transition,transTimer;
  let started=false,paused=false,raf,lastTs=0;
  const keys={},touch={active:false,startX:0,startTime:0,currentDX:0,isTap:true};
  let hintShown=false;

  function buildStars(){stars=Array.from({length:60},()=>({x:Math.random()*480,y:Math.random()*320,b:Math.random()}));}
  function buildBunkers(){bunkers=[];for(let bx of [80,190,300,410])for(let r=0;r<4;r++)for(let c=0;c<8;c++)bunkers.push({x:bx+6*c,y:248+6*r,alive:true});}

  function spawnLevel(lvl){
    level=Math.max(1,Math.min(MAX_LEVEL,lvl));
    levelEl.textContent=String(level);
    let cfg=levelConfig(level);
    speed=cfg.speed;speedCap=cfg.speedCap;speedStep=cfg.speedStep;descend=cfg.descend;
    fireBase=cfg.fireBase;fireRand=cfg.fireRand;bulletSpeed=cfg.bulletSpeed;ufoChance=cfg.ufoChance;
    dir=1;fireTimer=cfg.fireBase;ufo=null;pBullets=[];eBullets=[];
    invaders=[];
    cfg.rows.forEach((type,r)=>{for(let c=0;c<cfg.cols;c++)invaders.push({x:30+46*c,y:36+34*r,w:32,h:24,type:type,hp:HP[type],alive:true});});
  }

  function reset(){
    score=0;lives=3;shipVel=0;timeAcc=0;
    gameOver=false;victory=false;transition=false;transTimer=0;
    player={x:240,y:296,w:28,h:14,cooldown:0};
    buildStars();buildBunkers();spawnLevel(startLevel);
    scoreEl.textContent=' 0';livesEl.textContent=lives;
  }

  function fire(){if(!player||gameOver||victory||transition)return;if(player.cooldown<=0){pBullets.push({x:player.x,y:player.y-10});player.cooldown=18;}}

  /* ---------- Lógica ---------- */
  function step(dt){
    timeAcc+=0.04*dt;
    player.cooldown-=dt;
    if(touch.active&&!touch.isTap&&Math.abs(touch.currentDX)>6){
      let target=Math.sign(touch.currentDX)*Math.min(0.12*Math.abs(touch.currentDX),5.5);
      shipVel+=0.18*(target-shipVel)*dt;
    }else if(keys[-1])shipVel=Math.max(shipVel-0.55*dt,-5.5);
    else if(keys[1])shipVel=Math.min(shipVel+0.55*dt,5.5);
    else{shipVel*=Math.pow(0.72,dt);if(Math.abs(shipVel)<0.05)shipVel=0;}
    player.x=Math.max(14,Math.min(466,player.x+shipVel*dt));

    pBullets.forEach(b=>b.y-=5.5*dt);pBullets=pBullets.filter(b=>b.y>0);
    eBullets.forEach(b=>b.y+=bulletSpeed*dt);eBullets=eBullets.filter(b=>b.y<320);

    if(transition){transTimer-=dt;if(transTimer<=0){transition=false;spawnLevel(level+1);}return;}

    let alive=invaders.filter(i=>i.alive);
    if(!alive.length){
      if(level<MAX_LEVEL){transition=true;transTimer=80;vibrate([0,30,40,30]);}
      else{victory=true;vibrate([0,40,60,40,60,40]);}
      return;
    }

    let bounce=false;
    alive.forEach(i=>{i.x+=dir*speed*dt;if(i.x+i.w>470||i.x<10)bounce=true;});
    if(bounce){dir*=-1;alive.forEach(i=>i.y+=descend);speed=Math.min(speed+speedStep,speedCap);}

    fireTimer-=dt;
    if(fireTimer<=0){let s=alive[Math.floor(Math.random()*alive.length)];eBullets.push({x:s.x+s.w/2,y:s.y+s.h});fireTimer=fireBase+fireRand*Math.random();}

    if(!ufo&&Math.random()<ufoChance){let fromLeft=Math.random()<0.5;ufo={x:fromLeft?-24:504,dir:fromLeft?1:-1,y:16,points:[50,100,150,300][Math.floor(Math.random()*4)]};}
    if(ufo){ufo.x+=ufo.dir*1.6*dt;if(ufo.x<-40||ufo.x>520)ufo=null;}

    // Balas del jugador
    for(let bi=pBullets.length-1;bi>=0;bi--){
      let b=pBullets[bi];
      if(ufo&&Math.abs(b.x-ufo.x)<14&&b.y<ufo.y+8&&b.y>ufo.y-8){score+=ufo.points;scoreEl.textContent=' '+score;ufo=null;pBullets.splice(bi,1);vibrate(40);continue;}
      let hit=false;
      for(let i of invaders){
        if(i.alive&&b.x>i.x&&b.x<i.x+i.w&&b.y>i.y&&b.y<i.y+i.h){i.hp--;hit=true;if(i.hp<=0){i.alive=false;score+=POINTS[i.type];scoreEl.textContent=' '+score;}break;}
      }
      if(hit){pBullets.splice(bi,1);continue;}
      for(let k of bunkers){if(k.alive&&b.x>k.x&&b.x<k.x+6&&b.y>k.y&&b.y<k.y+6){k.alive=false;pBullets.splice(bi,1);break;}}
    }

    // Balas enemigas
    for(let bi=eBullets.length-1;bi>=0;bi--){
      let b=eBullets[bi];
      if(Math.abs(b.x-player.x)<14&&b.y>player.y-7&&b.y<player.y+7){
        eBullets.splice(bi,1);lives--;livesEl.textContent=lives;player.x=240;shipVel=0;vibrate(lives<=0?200:60);if(lives<=0)gameOver=true;continue;
      }
      let hit=false;
      for(let k of bunkers){if(k.alive&&b.x>k.x&&b.x<k.x+6&&b.y>k.y&&b.y<k.y+6){k.alive=false;hit=true;break;}}
      if(hit)eBullets.splice(bi,1);
    }

    for(let i of invaders){if(i.alive&&i.y+i.h>=292){gameOver=true;break;}}
  }

  /* ---------- Render ---------- */
  function drawSprite(type,x,y,damaged){
    let bm=SPRITES[type],flip=Math.floor(timeAcc*2)%2;
    ctx.fillStyle=damaged?'#fa0':COLORS[type];
    bm.forEach((row,ry)=>{row.forEach((v,cx)=>{if(!v)return;let c=flip?row.length-1-cx:cx;ctx.fillRect(x+4*c,y+4*ry,3,3);});});
  }
  function render(){
    ctx.fillStyle='#000';ctx.fillRect(0,0,480,320);
    stars.forEach(s=>{ctx.globalAlpha=0.2+0.5*((Math.sin(2*timeAcc+10*s.b)+1)/2);ctx.fillStyle='#fff';ctx.fillRect(s.x,s.y,1,1);});
    ctx.globalAlpha=1;
    ctx.fillStyle='#0f0';bunkers.forEach(k=>{if(k.alive)ctx.fillRect(k.x,k.y,5,5);});
    invaders.forEach(i=>{if(i.alive)drawSprite(i.type,i.x,i.y,i.hp<HP[i.type]);});
    if(ufo){ctx.fillStyle='#f44';ctx.fillRect(ufo.x-12,ufo.y,24,4);ctx.fillRect(ufo.x-8,ufo.y-4,16,4);ctx.fillRect(ufo.x-14,ufo.y+4,28,3);ctx.fillStyle='#ff0';ctx.fillRect(ufo.x-6,ufo.y+4,3,3);ctx.fillRect(ufo.x+3,ufo.y+4,3,3);}
    let off=Math.round(0.3*shipVel);
    ctx.fillStyle='#0f0';ctx.fillRect(player.x-2+off,player.y-2,4,14);ctx.fillRect(player.x-10,player.y+6,20,8);ctx.fillRect(player.x-14,player.y+10,28,4);
    ctx.fillStyle='#0ff';pBullets.forEach(b=>ctx.fillRect(b.x-1,b.y,2,8));
    ctx.fillStyle='#f80';eBullets.forEach(b=>ctx.fillRect(b.x-1,b.y,2,8));
    ctx.strokeStyle='#0a0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,304);ctx.lineTo(480,304);ctx.stroke();
    for(let i=0;i<lives;i++){ctx.fillStyle='#0f0';ctx.fillRect(8+22*i,308,8,6);ctx.fillRect(4+22*i,312,16,4);}
    if(transition){ctx.textAlign='center';ctx.fillStyle='#ff0';ctx.font='bold 20px Courier New';ctx.fillText('¡NIVEL '+level+' SUPERADO!',240,150);ctx.font='12px Courier New';ctx.fillStyle='#0f0';ctx.fillText('Preparando nivel '+(level+1)+'...',240,174);ctx.textAlign='left';}
  }
  function renderOverlay(){
    render();
    ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,0,480,320);
    ctx.textAlign='center';ctx.font='bold 28px Courier New';
    if(victory){ctx.fillStyle='#ff0';ctx.fillText('¡VICTORIA!',240,116);}else{ctx.fillStyle='#f44';ctx.fillText('GAME OVER',240,116);}
    ctx.font='16px Courier New';ctx.fillStyle='#0f0';ctx.fillText('PUNTUACIÓN: '+score,240,150);ctx.fillText('NIVEL: '+level,240,172);
    ctx.font='12px Courier New';ctx.fillStyle='#0a0';ctx.fillText('ENTER · ESPACIO · FIRE para reiniciar',240,198);ctx.fillText('o toca la pantalla',240,216);
    ctx.textAlign='left';
  }

  function frame(ts){
    if(paused)return;
    let dt=Math.min((ts-lastTs)/16.67,3);lastTs=ts;
    step(dt);
    if(gameOver||victory){renderOverlay();attachRestart();}
    else{render();raf=requestAnimationFrame(frame);}
  }

  /* ---------- Reinicio tras fin de partida ---------- */
  const touchZone=document.getElementById('invTouchZone'),fireBtn=document.getElementById('invBtnFire');
  function onRestartTouch(e){e.preventDefault();restart();}
  function attachRestart(){
    document.onkeydown=e=>{if(e.code==='Enter'||e.code==='Space')restart();};
    touchZone.addEventListener('touchend',onRestartTouch,{once:true});
    fireBtn.onpointerdown=()=>restart();
  }
  function restart(){document.onkeydown=null;fireBtn.onpointerdown=null;reset();lastTs=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);}

  /* ---------- Inicio / Pausa ---------- */
  function startGame(){
    document.getElementById('invStartScreen').style.display='none';
    document.getElementById('inv-startBtn').textContent='▶ INICIAR JUEGO';
    started=true;paused=false;reset();lastTs=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);
  }
  function startBtnHandler(){
    if(started&&paused){paused=false;document.getElementById('invStartScreen').style.display='none';lastTs=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);}
    else startGame();
  }
  document.getElementById('inv-startBtn').addEventListener('click',startBtnHandler);
  document.getElementById('inv-startBtn').addEventListener('touchend',e=>{e.preventDefault();startBtnHandler();});

  window.invStartNew=function(){
    let ss=document.getElementById('invStartScreen');
    document.getElementById('invLevelSelect').style.display='flex';
    ss.style.display='flex';
    ss.querySelector('h1').textContent='SPACE INVADERS';
    let sub=ss.querySelector('.sub');if(sub)sub.innerHTML=SUB_HTML;
    document.getElementById('inv-startBtn').textContent='▶ INICIAR JUEGO';
    buildLevelGrid();
    cancelAnimationFrame(raf);raf=null;started=false;paused=false;
    reset();render();
  };
  window.pauseInv=function(){
    if(started&&!paused&&!gameOver&&!victory){
      paused=true;cancelAnimationFrame(raf);
      let e=document.getElementById('invStartScreen');
      document.getElementById('invLevelSelect').style.display='none';
      e.style.display='flex';
      e.querySelector('h1').textContent='PAUSA';
      e.querySelector('.sub').innerHTML='PUNTUACIÓN: '+score+' &nbsp;·&nbsp; NIVEL: '+level;
      document.getElementById('inv-startBtn').textContent='▶ CONTINUAR';
    }
  };

  /* ---------- Selector de nivel (estilo Pac-Man) ---------- */
  const levelGrid=document.getElementById('invLevelGrid');
  function buildLevelGrid(){
    if(!levelGrid)return;
    levelGrid.innerHTML='';
    for(let n=1;n<=MAX_LEVEL;n++){
      let cell=document.createElement('div');
      cell.className='invLevelCell'+(n===startLevel?' selected':'');
      cell.textContent=String(n);
      cell.addEventListener('click',()=>{startLevel=n;levelGrid.querySelectorAll('.invLevelCell').forEach(c=>c.classList.remove('selected'));cell.classList.add('selected');});
      levelGrid.appendChild(cell);
    }
  }
  function jumpLevel(n){
    n=Math.max(1,Math.min(MAX_LEVEL,n));
    if(n===level||transition)return;
    let s=score,l=lives;spawnLevel(n);score=s;lives=l;scoreEl.textContent=' '+score;livesEl.textContent=lives;
    if(!started||paused)render();
  }
  document.getElementById('inv-levelUp')?.addEventListener('click',e=>{e.stopPropagation();jumpLevel(level+1);});
  document.getElementById('inv-levelDown')?.addEventListener('click',e=>{e.stopPropagation();jumpLevel(level-1);});

  /* ---------- Controles táctiles / botones / teclado ---------- */
  function bindHold(el,id){
    el.addEventListener('pointerdown',n=>{n.preventDefault();keys[id]=true;el.classList.add('pressed');});
    el.addEventListener('pointerup',n=>{n.preventDefault();keys[id]=false;el.classList.remove('pressed');});
    el.addEventListener('pointerleave',n=>{n.preventDefault();keys[id]=false;el.classList.remove('pressed');});
    el.addEventListener('pointercancel',n=>{n.preventDefault();keys[id]=false;el.classList.remove('pressed');});
  }
  const indicator=document.getElementById('invTouchIndicator'),arrow=document.getElementById('invTouchArrow'),hint=document.getElementById('invTouchHint');
  touchZone.addEventListener('touchstart',e=>{e.preventDefault();let t=e.touches[0];touch.active=true;touch.startX=t.clientX;touch.startTime=performance.now();touch.currentDX=0;touch.isTap=true;if(!hintShown){hintShown=true;hint.style.opacity='1';setTimeout(()=>{hint.style.opacity='0';},3000);}},{passive:false});
  touchZone.addEventListener('touchmove',e=>{e.preventDefault();let t=e.touches[0];touch.currentDX=t.clientX-touch.startX;if(Math.abs(touch.currentDX)>22)touch.isTap=false;let r=wrap.getBoundingClientRect();indicator.style.left=(t.clientX-r.left)+'px';indicator.style.top=(t.clientY-r.top)+'px';indicator.style.display='block';arrow.textContent=touch.currentDX<-8?'◀':touch.currentDX>8?'▶':'·';},{passive:false});
  touchZone.addEventListener('touchend',e=>{e.preventDefault();let dur=performance.now()-touch.startTime;if(touch.isTap&&dur<200&&Math.abs(touch.currentDX)<22)fire();touch.active=false;touch.currentDX=0;indicator.style.display='none';},{passive:false});
  touchZone.addEventListener('touchcancel',e=>{e.preventDefault();touch.active=false;touch.currentDX=0;indicator.style.display='none';},{passive:false});
  bindHold(document.getElementById('invBtnLeft'),-1);
  bindHold(document.getElementById('invBtnRight'),1);
  let fireInterval=null;
  function fireBtnUp(e){e.preventDefault();fireBtn.classList.remove('pressed');clearInterval(fireInterval);}
  fireBtn.addEventListener('pointerdown',e=>{e.preventDefault();fireBtn.classList.add('pressed');fire();fireInterval=setInterval(fire,300);});
  fireBtn.addEventListener('pointerup',fireBtnUp);
  fireBtn.addEventListener('pointerleave',fireBtnUp);
  fireBtn.addEventListener('pointercancel',fireBtnUp);
  document.addEventListener('keydown',e=>{if(document.getElementById('invRemapModal')?.classList.contains('active'))return;if(e.code===invKeys.newgame&&!e.repeat&&!gameOver&&!victory&&!document.getElementById('winInv').classList.contains('hidden')){e.preventDefault();window.invStartNew&&window.invStartNew();return;}if(e.code===invKeys.left)keys[-1]=true;if(e.code===invKeys.right)keys[1]=true;if(e.code===invKeys.fire){e.preventDefault();fire();}});
  document.addEventListener('keyup',e=>{if(document.getElementById('invRemapModal')?.classList.contains('active'))return;if(e.code===invKeys.left)keys[-1]=false;if(e.code===invKeys.right)keys[1]=false;});

  /* ---------- Arranque ---------- */
  buildLevelGrid();
  reset();
  render();
})();

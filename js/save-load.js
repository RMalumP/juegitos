/* save-load.js: guardar/cargar en un .json las puntuaciones, estilos y controles
   del usuario — Juegos XP.
   Todo lo que cada juego persiste (best scores, mapas de teclas, tema del ajedrez,
   preferencias de la interfaz...) vive en localStorage; aquí solo se exporta/importa
   ese almacén. Al cargar, se recarga la página para que cada juego tome los datos
   restaurados de forma limpia, sin tocar la lógica de ningún juego. */
(function(){
  var VERSION=1;

  /* ---------- diálogo con estética XP ---------- */
  var modal=document.getElementById('dataModal'),
      elTitle=document.getElementById('dataTitleTxt'),
      elIcon=document.getElementById('dataIcon'),
      elMsg=document.getElementById('dataMsg'),
      btnOk=document.getElementById('dataOk'),
      btnCancel=document.getElementById('dataCancel'),
      btnX=document.getElementById('dataClose'),
      pendingOk=null;

  function closeDialog(){if(modal)modal.classList.remove('show');pendingOk=null;}
  function dialog(opts){
    if(!modal){ // respaldo defensivo si faltara el modal en el DOM
      if(!opts.cancelText){if(opts.onOk)opts.onOk();return;}
      if(window.confirm(opts.msg)&&opts.onOk)opts.onOk();
      return;
    }
    elIcon.textContent=opts.icon||'💾';
    elTitle.textContent=opts.title||'Datos';
    elMsg.textContent=opts.msg||'';
    btnOk.textContent=opts.okText||'Aceptar';
    if(opts.cancelText){btnCancel.textContent=opts.cancelText;btnCancel.style.display='';}
    else btnCancel.style.display='none';
    pendingOk=opts.onOk||null;
    modal.classList.add('show');
  }
  if(btnOk)btnOk.addEventListener('click',function(){var f=pendingOk;closeDialog();if(f)f();});
  if(btnCancel)btnCancel.addEventListener('click',closeDialog);
  if(btnX)btnX.addEventListener('click',closeDialog);
  if(modal)modal.addEventListener('click',function(e){if(e.target===modal)closeDialog();});

  /* ---------- guardar ---------- */
  function snapshot(){
    var data={};
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);
      if(k.indexOf('__resume')===0)continue; // claves internas de reanudación
      data[k]=localStorage.getItem(k);
    }
    return data;
  }
  // Partidas a medias que cada juego mantiene en memoria (no en localStorage).
  function collectGames(){
    var g={};
    [['sol',window.solSnapshot],['bj',window.bjSnapshot],['roul',window.roulSnapshot],['pk',window.pkSnapshot]].forEach(function(p){
      try{if(typeof p[1]==='function'){var v=p[1]();if(v)g[p[0]]=v;}}catch(e){}
    });
    try{ // Ajedrez/Damas viven en un iframe; pedimos su estado si está cargado
      var cf=document.getElementById('chessFrame');
      if(cf&&cf.contentWindow&&typeof cf.contentWindow.__getGameState==='function'){
        var cs=cf.contentWindow.__getGameState();if(cs)g.chess=cs;
      }
    }catch(e){}
    return g;
  }
  function pad(n){return(n<10?'0':'')+n;}
  function save(){
    var data=snapshot(),games=collectGames();
    var n=Object.keys(data).length,gn=Object.keys(games).length;
    var payload={app:'Juegos Windows XP',type:'mesaDeJuegos-save',version:VERSION,exportedAt:new Date().toISOString(),data:data,games:games};
    var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    var url=URL.createObjectURL(blob),d=new Date(),a=document.createElement('a');
    a.href=url;
    a.download='juegos-xp_'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes())+'.json';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1000);
    dialog({icon:'💾',title:'Guardar datos',okText:'Hecho',
      msg:(n||gn)?('Se ha descargado un archivo con tus puntuaciones, estilos y controles'+(gn?(' y '+gn+' partida'+(gn===1?'':'s')+' a medias'):'')+'.')
            :'Todavía no hay nada que guardar. Juega o personaliza algo y vuelve a intentarlo.'});
  }

  /* ---------- cargar ---------- */
  function applyImport(data,games){
    Object.keys(data).forEach(function(k){
      var v=data[k];
      localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
    });
    // Las partidas a medias se dejan en claves de reanudación que cada juego
    // consume al abrirse tras la recarga.
    if(games&&typeof games==='object'){
      var core={};['sol','bj','roul','pk'].forEach(function(k){if(games[k])core[k]=games[k];});
      if(Object.keys(core).length)localStorage.setItem('__resumeGames',JSON.stringify(core));
      else localStorage.removeItem('__resumeGames');
      if(games.chess)localStorage.setItem('__resumeChess',JSON.stringify(games.chess));
      else localStorage.removeItem('__resumeChess');
    }
  }
  function handleFile(file){
    var reader=new FileReader();
    reader.onerror=function(){dialog({icon:'⚠️',title:'Cargar datos',msg:'No se pudo leer el archivo.',okText:'Cerrar'});};
    reader.onload=function(){
      var payload;
      try{payload=JSON.parse(reader.result);}
      catch(e){dialog({icon:'⚠️',title:'Cargar datos',msg:'El archivo no es un JSON válido.',okText:'Cerrar'});return;}
      var data=(payload&&typeof payload==='object')
        ?((payload.data&&typeof payload.data==='object')?payload.data:payload):null;
      if(!data||typeof data!=='object'){
        dialog({icon:'⚠️',title:'Cargar datos',msg:'El archivo no tiene el formato esperado.',okText:'Cerrar'});return;
      }
      var games=(payload&&payload.games&&typeof payload.games==='object')?payload.games:null;
      var n=Object.keys(data).length,gn=games?Object.keys(games).length:0;
      dialog({icon:'📂',title:'Cargar datos',okText:'Cargar',cancelText:'Cancelar',
        msg:'Se restaurarán tus puntuaciones, estilos y controles'+(gn?(' y '+gn+' partida'+(gn===1?'':'s')+' a medias'):'')+', sobrescribiendo los actuales. La página se recargará para aplicarlos. ¿Continuar?',
        onOk:function(){applyImport(data,games);location.reload();}});
    };
    reader.readAsText(file);
  }

  /* ---------- conexión con los botones del escritorio ---------- */
  var btnSave=document.getElementById('btnSaveData'),
      btnLoad=document.getElementById('btnLoadData'),
      fileInput=document.getElementById('loadDataInput');
  if(btnSave)btnSave.addEventListener('click',save);
  if(btnLoad)btnLoad.addEventListener('click',function(){if(fileInput){fileInput.value='';fileInput.click();}});
  if(fileInput)fileInput.addEventListener('change',function(){var f=fileInput.files&&fileInput.files[0];if(f)handleFile(f);});
})();

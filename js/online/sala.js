/* js/online/sala.js — App «Sala online» de Juegos XP.
   Un icono de escritorio abre esta ventana: ahí se crea o se entra en una sala (nombre + contraseña, QR o enlace). El símbolo 📶 de la barra
   inferior muestra el estado de la conexión y abre la misma ventana. Los juegos (bingo, etc.) no tienen su propia pantalla de conexión:
   hablan con este servicio (window.Sala).
   El transporte (js/online/transport-peer.js: PeerJS/WebRTC con STUN, sin Firebase ni TURN) se carga solo al conectar, así que todo lo demás
   funciona abriendo el HTML con doble clic. El online necesita https.

   API para los juegos:
     Sala.activo · Sala.host · Sala.uid · Sala.jug · Sala.estado · Sala.rol · Sala.red ('off'|'conectando'|'ok'|'recon')
     Sala.on('estado'|'rol'|'evento'|'msg'|'jug'|'con'|'cierre', fn) · Sala.off(evento, fn)
     Sala.enviar(destino, mensaje) — ver contrato en transport-peer.js · Sala.expulsar(id) · Sala.guardarExtra(obj) · Sala.leerExtra()
     Sala.abrir() — abre la ventana · Sala.irAlJuego() — abre el juego que está usando la sala */
(function () {
  const $ = id => document.getElementById(id);
  const LS_SES = 'juegitos.sala.sesion', LS_NOM = 'juegitos.sala.nombre', LS_SAL = 'juegitos.sala.sala';
  const S = { T: null, activo: false, host: false, uid: null, nombre: '', sala: '', pass: '', jug: [], estado: {}, rol: null, net: null, conectado: true, red: 'off', juego: null, ocupado: false };
  const L = {}, pendientes = [];
  const emit = (ev, ...a) => (L[ev] || []).slice().forEach(f => { try { f(...a); } catch (e) { console.error(e); } });
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* nada */ } };
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- aviso breve ---------- */
  let toastT = null;
  function toast(msg) {
    let t = $('salaToast');
    if (!t) { t = document.createElement('div'); t.id = 'salaToast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------- transporte ---------- */
  async function cargarTransporte() {
    if (location.protocol === 'file:') throw new Error('El modo online solo funciona desde una página https (por ejemplo GitHub Pages), no abriendo el archivo con doble clic.');
    if (!S.T) {
      const m = await import(new URL('js/online/transport-peer.js', document.baseURI).href);
      S.T = m.default;
      S.T.alRecibir(onMsg); S.T.alCambiarJugadores(onJug); S.T.alConexion(onCon);
    }
    return S.T;
  }
  function setRed(r) { S.red = r; pintarBandeja(); }
  function onMsg(m) {
    if (!S.activo && m.tipo !== 'sala-cerrada' && m.tipo !== 'expulsado') return;
    switch (m.tipo) {
      case 'estado': {
        const { tipo, ...r } = m; S.estado = r;
        if (r.juego && r.juego !== S.juego) { // el anfitrión ha elegido juego: los jugadores pasan a él si están mirando la ventana de la sala
          S.juego = r.juego; pintar();
          const w = $('winSala'); if (!S.host && w && !w.classList.contains('hidden')) irAlJuego();
        }
        emit('estado', S.estado); break;
      }
      case 'rol': { const { tipo, vacio, ...r } = m; S.rol = vacio ? null : r; emit('rol', S.rol); break; }
      case 'evento': emit('evento', m); break;
      case 'conexion': S.net = m.net; pintar(); break;
      case 'sala-cerrada': if (S.activo) { toast('El anfitrión ha cerrado la sala'); limpiar('cerrada'); } break;
      case 'expulsado': toast('El anfitrión te ha expulsado de la sala'); limpiar('expulsado'); break;
      default: // mensajes de los jugadores (solo los recibe el anfitrión); si el juego aún no está cargado se guardan hasta que se suscriba
        if (S.host) { if ((L.msg || []).length) emit('msg', m); else { pendientes.push(m); if (pendientes.length > 200) pendientes.shift(); } }
    }
  }
  function onJug(l) { S.jug = l; emit('jug', l); pintar(); }
  function onCon(c) {
    S.conectado = c; setRed(c ? 'ok' : 'recon');
    if (!S.host) toast(c ? '✅ Reconectado' : '📡 Sin conexión con el anfitrión… reconectando');
    emit('con', c); pintar();
  }
  let wl = null;
  async function pantalla(on) { // evita que el móvil apague la pantalla durante la partida
    try {
      if (on && 'wakeLock' in navigator && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); }
      else if (!on && wl) { await wl.release(); wl = null; }
    } catch (e) { /* no disponible */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.activo) pantalla(true); });

  function entrar(r, d) {
    Object.assign(S, { activo: true, host: r.esAnfitrion, uid: r.uid, nombre: d.nombre, sala: d.sala, pass: d.pass || S.pass, jug: [], estado: {}, rol: null, net: null, conectado: true });
    lsSet(LS_SES, JSON.stringify({ roomId: r.roomId, host: r.esAnfitrion, nombre: d.nombre, sala: d.sala, t: Date.now() }));
    setRed('ok'); pantalla(true); pintar();
    if (r.avisos && r.avisos.length) setTimeout(() => toast(r.avisos[0]), 500);
  }
  function limpiar(motivo) {
    Object.assign(S, { activo: false, host: false, jug: [], estado: {}, rol: null, net: null, conectado: true, juego: null });
    lsDel(LS_SES); setRed('off'); pantalla(false); pintar();
    emit('cierre', motivo || 'salir');
  }
  async function conectar(modo) {
    const nombre = $('salaNombre').value.trim(), sala = $('salaSala').value.trim(), pass = $('salaPass').value.trim();
    if (!nombre) return aviso('Escribe tu nombre.');
    aviso(''); S.ocupado = true; setRed('conectando'); pintar();
    try {
      const T = await cargarTransporte();
      S.pass = pass;
      const r = await (modo === 'crear' ? T.crearSala(sala, pass, nombre) : T.unirse(sala, pass, nombre));
      lsSet(LS_NOM, nombre); lsSet(LS_SAL, sala);
      entrar(r, { nombre, sala, pass });
    } catch (e) { setRed('off'); aviso((e && e.message) || 'No se pudo conectar.'); }
    S.ocupado = false; pintar();
  }
  async function recuperar() { // al abrir la página: se vuelve a la sala en la que se estaba
    let s = null; try { s = JSON.parse(lsGet(LS_SES)); } catch (e) { /* nada */ }
    if (!s || !s.roomId || Date.now() - (s.t || 0) > 12 * 3600 * 1000 || location.protocol === 'file:') return false;
    setRed('conectando');
    try {
      const T = await cargarTransporte();
      entrar(await T.reanudar({ roomId: s.roomId }), { nombre: s.nombre, sala: s.sala, pass: '' });
      if (S.host) { const ex = T.leerExtra(); if (ex && ex.juego) { S.juego = ex.juego; irAlJuego(); } } // el anfitrión recupera su partida
      return true;
    } catch (e) { lsDel(LS_SES); setRed('off'); return false; }
  }
  async function salir() {
    const T = S.T, host = S.host;
    limpiar('salir');
    try { if (T) await (host ? T.cerrarSala() : T.salir()); } catch (e) { /* ya no importa */ }
  }
  const enviar = (d, m) => S.T && S.activo ? S.T.enviar(d, m) : Promise.reject(new Error('No estás en ninguna sala.'));

  /* ---------- interfaz: ventana ---------- */
  function aviso(msg) {
    const w = $('salaAviso'); if (!w) return;
    w.textContent = msg || ''; w.style.display = msg ? 'block' : 'none';
  }
  const netTxt = n => (n === 'local' ? '📶 red local' : n === 'internet' ? '🌐 internet' : n === 'relay' ? '🔁 relé' : '');
  function pintar() {
    pintarBandeja();
    if (!$('salaConectar')) return;
    $('salaConectar').style.display = S.activo ? 'none' : '';
    $('salaDentro').style.display = S.activo ? '' : 'none';
    ['salaCrear', 'salaUnir'].forEach(id => { $(id).disabled = S.ocupado; });
    if (!S.activo) return;
    $('salaTitulo').textContent = S.sala || 'Sala';
    $('salaRol').textContent = (S.host ? '👑 Anfitrión' : '🎟️ Jugador') + (S.net && !S.host ? ' · ' + netTxt(S.net) : '');
    $('salaEstadoTxt').textContent = S.conectado ? 'Conectado' : 'Reconectando…';
    $('salaEstadoTxt').className = S.conectado ? 'ok' : 'warn';
    $('salaIrJuego').style.display = S.juego ? '' : 'none';
    $('salaJuegos').style.display = S.host && !S.juego ? '' : 'none';
    $('salaIrJuego').textContent = S.juego === 'bingo' ? '🎱 Ir al Bingo' : 'Ir al juego';
    $('salaCerrar').textContent = S.host ? 'Cerrar sala' : 'Salir de la sala';
    const lista = $('salaJugadores');
    lista.innerHTML = '';
    S.jug.slice().sort((a, b) => a.orden - b.orden).forEach(j => {
      const f = document.createElement('div'); f.className = 'salaJug' + (j.conectado ? '' : ' off');
      f.innerHTML = '<span class="salaPunto"></span><span class="salaJNom">' + esc(j.nombre) + (j.yo ? ' (tú)' : '') + '</span><span class="salaJTag">' + (j.esAnfitrion ? '👑' : '') + (netTxt(j.net) ? ' ' + netTxt(j.net) : '') + '</span>';
      if (S.host && !j.esAnfitrion && S.estado.phase === 'lobby') {
        const x = document.createElement('button'); x.className = 'salaX'; x.textContent = '✕'; x.title = 'Expulsar';
        x.onclick = () => { if (confirm('¿Expulsar a ' + j.nombre + '?')) S.T.expulsar(j.id).catch(e => toast(e.message)); };
        f.appendChild(x);
      }
      lista.appendChild(f);
    });
    $('salaCuenta').textContent = S.jug.length + (S.jug.length === 1 ? ' persona' : ' personas');
  }
  /* ---------- interfaz: símbolo de la barra inferior ---------- */
  function pintarBandeja() {
    const t = $('trayNet'); if (!t) return;
    t.className = 'tray-' + S.red;
    const txt = { off: 'Sala online: sin conexión', conectando: 'Sala online: conectando…', ok: 'Sala online: ' + (S.sala || '') + (S.net ? ' (' + netTxt(S.net).replace(/^\S+ /, '') + ')' : ''), recon: 'Sala online: reconectando…' }[S.red];
    t.title = txt; t.setAttribute('aria-label', txt);
  }

  /* ---------- compartir ---------- */
  function enlace(conClave) {
    const base = location.href.split('#')[0];
    return conClave ? base + '#s=' + encodeURIComponent(S.sala + '\n' + S.pass) : base + '#s=' + encodeURIComponent(S.sala);
  }
  function conClave() {
    if (!S.pass) return false;
    return confirm('¿Incluir la contraseña en el enlace? Quien lo reciba entrará directamente.');
  }
  function compartir() {
    const url = enlace(conClave()), texto = 'Bingo en Juegos XP: sala «' + S.sala + '»';
    if (navigator.share) navigator.share({ title: 'Juegos XP', text: texto, url }).catch(() => {});
    else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto + '\n' + url).then(() => toast('Enlace copiado'), () => prompt('Copia este enlace:', url));
    else prompt('Copia este enlace:', url);
  }
  function cargarQR() {
    if (window.qrcode) return Promise.resolve();
    return new Promise((ok, ko) => {
      const s = document.createElement('script'); s.src = new URL('js/online/qrcode.js', document.baseURI).href;
      s.onload = ok; s.onerror = () => ko(new Error('No se pudo cargar el generador de QR.'));
      document.head.appendChild(s);
    });
  }
  function qr() {
    const url = enlace(conClave());
    cargarQR().then(() => {
      const q = window.qrcode(0, 'M'); q.addData(url); q.make();
      const ov = document.createElement('div'); ov.id = 'salaQR';
      ov.innerHTML = '<div class="salaQRcaja"><div class="salaQRt">Escanea con la cámara</div>' + q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) + '<div class="salaQRp">Sala «' + esc(S.sala) + '» · toca para cerrar</div></div>';
      const svg = ov.querySelector('svg'); if (svg) { svg.style.width = '100%'; svg.style.height = 'auto'; }
      ov.onclick = () => ov.remove(); document.body.appendChild(ov);
    }).catch(e => toast(e.message));
  }
  function aplicarEnlace() { // #s=sala (o #s=sala\nclave): abre la ventana con los datos puestos
    const m = /^#s=(.+)$/.exec(location.hash || ''); if (!m) return false;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* nada */ }
    let p; try { p = decodeURIComponent(m[1]).split('\n'); } catch (e) { return false; }
    if (!p[0]) return false;
    $('salaSala').value = p[0].slice(0, 30); if (p[1]) $('salaPass').value = p[1].slice(0, 30);
    abrir(); return true;
  }

  /* ---------- apertura de la ventana ---------- */
  function abrir() { if (typeof window.openGame === 'function') window.openGame('sala'); }
  function irAlJuego() { if (S.juego && typeof window.openGame === 'function') window.openGame(S.juego); }

  function iniciar() {
    if (!$('winSala')) return;
    $('salaNombre').value = lsGet(LS_NOM) || ''; $('salaSala').value = lsGet(LS_SAL) || '';
    $('salaCrear').onclick = () => conectar('crear');
    $('salaUnir').onclick = () => conectar('unir');
    $('salaCerrar').onclick = () => { if (confirm(S.host ? '¿Cerrar la sala? Todos los jugadores saldrán.' : '¿Salir de la sala?')) salir(); };
    $('salaCompartir').onclick = compartir;
    $('salaQRbtn').onclick = qr;
    $('salaIrJuego').onclick = irAlJuego;
    $('salaJuegoBingo').onclick = () => { S.juego = 'bingo'; irAlJuego(); };
    $('trayNet').onclick = abrir;
    if ($('btnSala')) $('btnSala').onclick = abrir;
    if ($('iconBingo')) $('iconBingo').addEventListener('click', function () { if (typeof window.openGame === 'function') window.openGame('bingo'); }); // el icono del bingo abre con un solo toque (los demás, con doble toque)
    if (location.protocol === 'file:') aviso('El modo online solo funciona desde una página https. Abriendo el archivo con doble clic puedes usar el bingo en local.');
    pintar();
    if (!aplicarEnlace()) recuperar();
    window.addEventListener('hashchange', aplicarEnlace);
  }

  window.Sala = {
    get activo() { return S.activo; }, get host() { return S.host; }, get uid() { return S.uid; }, get jug() { return S.jug; },
    get estado() { return S.estado; }, get rol() { return S.rol; }, get red() { return S.red; }, get nombre() { return S.nombre; },
    get sala() { return S.sala; }, get conectado() { return S.conectado; },
    on(ev, f) { (L[ev] = L[ev] || []).push(f); if (ev === 'msg') pendientes.splice(0).forEach(m => { try { f(m); } catch (e) { console.error(e); } }); }, off(ev, f) { L[ev] = (L[ev] || []).filter(x => x !== f); },
    enviar, salir, abrir, irAlJuego, toast,
    usarEn(juego) { S.juego = juego; pintar(); },
    expulsar: id => S.T.expulsar(id),
    guardarExtra: o => S.T && S.T.guardarExtra(o), leerExtra: () => (S.T ? S.T.leerExtra() : null),
    ahora: () => (S.T ? S.T.ahora() : Date.now())
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

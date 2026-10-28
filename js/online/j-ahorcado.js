/* js/online/j-ahorcado.js — Ahorcado ONLINE (2–6 jugadores). En cada ronda un jugador escribe la palabra y los demás la adivinan por turnos
   (quien acierta una letra sigue; quien falla pasa el turno). Puntos: 1 por letra acertada, 2 más a quien completa la palabra y 3 a quien la escribió
   si los demás acaban ahorcados. Después escribe el siguiente jugador.
   La palabra solo la tiene el anfitrión (árbitro, con js/games/ahorcado-engine.js): a los móviles llega la vista pública ({tipo:'estado', ah}),
   con las letras ocultas hasta el final de la ronda. Quien escribe la manda al anfitrión con {a:'palabra'}; las letras van con {a:'letra'}.
   La interfaz es la de js/games/ahorcado.js (window.Ahorcado.online). */
(function () {
  'use strict';
  var L = window.JuegosOnline, S = window.Sala, id = 'ahorcado';
  var r = { activo: false, ronda: -1, ids: [], nombres: [], yo: -1, pub: null, int: null, pendiente: null };
  var en = function () { return S.activo && S.juego === id; };
  var M = function () { return window.AhorcadoEngine; };
  var enviarHost = function (m) { S.enviar('host', Object.assign({ tipo: 'accion' }, m)).catch(function (e) { S.toast(e.message); }); };

  function esperarUI() {                                                     // la interfaz se carga bajo demanda (lazy-loader)
    return new Promise(function (ok, ko) {
      var n = 0;
      (function t() {
        if (window.Ahorcado && window.Ahorcado.online && M()) return ok(window.Ahorcado.online);
        if (n === 0 && typeof window.initAhor === 'function') { try { window.initAhor(); } catch (e) { /* se reintenta */ } }
        if (++n > 100) return ko(new Error('No se pudo cargar el juego.'));
        setTimeout(t, 60);
      })();
    });
  }
  /* ---------- árbitro (anfitrión) ---------- */
  var total = function () { return r.int.puntos.length; };
  function sigAdivina(i) { var n = total(); do { i = (i + 1) % n; } while (i === r.int.escribe && n > 1); return i; }
  function vistaPublica() {
    var I = r.int, v = { rn: I.rn, n: I.n, escribe: I.escribe, fase: I.fase, turno: I.turno, puntos: I.puntos.slice(), ultimo: I.ultimo, siguiente: (I.escribe + 1) % total() };
    if (I.juego) { var p = M().publico(I.juego); v.mascara = p.mascara; v.letras = p.letras; v.fallos = p.fallos; v.max = p.max; if (p.palabra) v.palabra = p.palabra; }
    return v;
  }
  function publicar() {
    if (!S.host || !r.int) return;
    r.pub = vistaPublica();
    S.guardarExtra({ juego: id, ronda: r.ronda, int: r.int });               // la copia con la palabra se queda en el móvil del anfitrión
    S.enviar('todos', { tipo: 'estado', ah: r.pub }).catch(function () {});
    pintarBarra();
  }
  function ponerPalabra(p, texto) {
    var I = r.int, v = M().validar(texto);
    if (I.fase !== 'escribiendo' || p !== I.escribe || !v.ok) return false;
    I.juego = M().nuevo(v.palabra); I.fase = 'jugando'; I.turno = sigAdivina(I.escribe); I.ultimo = null; I.n++;
    publicar(); return true;
  }
  function probarLetra(p, l) {
    var I = r.int;
    if (I.fase !== 'jugando' || p !== I.turno || p === I.escribe) return false;
    var res = M().probar(I.juego, l); if (!res) return false;
    I.n++; I.ultimo = { p: p, l: l, ok: res.acierto };
    if (res.acierto) I.puntos[p]++;
    if (I.juego.fase === 'gana') { I.puntos[p] += 2; I.fase = 'gana'; }
    else if (I.juego.fase === 'pierde') { I.puntos[I.escribe] += 3; I.fase = 'pierde'; }
    else if (!res.acierto) I.turno = sigAdivina(p);
    publicar(); return true;
  }
  function siguienteRonda() {
    var I = r.int; if (!I) return;
    I.escribe = (I.escribe + 1) % total(); I.rn++; I.n++; I.fase = 'escribiendo'; I.juego = null; I.turno = -1; I.ultimo = null;
    publicar();
  }
  function pasarTurno() {                                                    // por si quien escribe o quien adivina se ha ido
    var I = r.int; if (!I) return;
    if (I.fase === 'jugando') { I.turno = sigAdivina(I.turno); I.n++; publicar(); } else siguienteRonda();
  }
  function alMensaje(m) {
    if (!S.host || !en() || !r.activo || !r.int || m.tipo !== 'accion') return;
    var p = r.ids.indexOf(m.de); if (p < 0) return;
    var hecho = m.a === 'palabra' ? ponerPalabra(p, m.p) : m.a === 'letra' ? probarLetra(p, m.l) : false;
    if (!hecho) publicar();                                                  // fuera de turno o no válida: se reenvía el estado real
  }
  function acciones() {
    return {
      letra: function (l) { if (S.host) { if (!probarLetra(r.yo, l)) publicar(); } else enviarHost({ a: 'letra', l: l }); },
      palabra: function (t) { if (S.host) { if (!ponerPalabra(r.yo, t)) publicar(); } else enviarHost({ a: 'palabra', p: t }); },
      siguiente: function () { if (S.host) siguienteRonda(); },
      lobby: function () { if (S.host && confirm('¿Volver al lobby? Se cierra esta partida.')) L.volverAlLobby(['ah']); }
    };
  }
  /* ---------- todos ---------- */
  function iniciar(est) {
    r.activo = true; r.ronda = est.ronda;
    r.ids = (est.asientos || []).map(function (a) { return a.id; }); r.nombres = (est.asientos || []).map(function (a) { return a.nombre; });
    r.yo = r.ids.indexOf(S.uid); r.int = null; r.pub = null;
    if (S.host) {
      var I = r.pendiente; r.pendiente = null;
      if (!I) { var ex = S.leerExtra(); if (ex && ex.juego === id && ex.ronda === est.ronda && ex.int) I = ex.int; }
      if (!I) { S.toast('No se pudo recuperar la partida. Vuelve a empezar.'); r.activo = false; L.volverAlLobby(['ah']); return; }
      r.int = I; r.pub = vistaPublica();
    } else r.pub = est.ah;
    var cfg = Object.assign({ p: r.yo, nombres: r.nombres, host: S.host, est: r.pub }, acciones());
    esperarUI().then(function (ui) { if (r.activo && r.ronda === est.ronda) ui.iniciar(cfg); }).catch(function (e) { S.toast(e.message); });
    pintarBarra();
  }
  function salir() {
    var estaba = r.activo; r.activo = false; r.ronda = -1; r.int = null; r.pub = null; r.pendiente = null;
    var b = L.barra('winAhor'); if (b) b.classList.remove('on');
    if (estaba && window.Ahorcado) window.Ahorcado.online.salir();
  }
  function pintarBarra() {
    var b = L.barra('winAhor'); if (!b) return;
    if (!r.activo || !en()) { b.classList.remove('on'); return; }
    b.innerHTML = '<span class="olBT">🌐 ' + L.esc(S.sala) + ' · ' + r.nombres.length + ' jugadores</span>';
    if (S.host) {
      var t = L.boton('⏭ Pasar', '', function () { if (confirm('¿Pasar el turno? (por si alguien no responde)')) pasarTurno(); }); t.className = ''; b.appendChild(t);
      var v = L.boton('↩ Lobby', '', function () { if (confirm('¿Volver al lobby? Se cierra esta partida.')) L.volverAlLobby(['ah']); }); v.className = ''; b.appendChild(v);
    }
    b.classList.add('on');
  }
  function preparar(ctx) {
    var n = ctx.jug.length;
    r.pendiente = { rn: 0, n: 0, escribe: Math.floor(Math.random() * n), fase: 'escribiendo', turno: -1, puntos: Array(n).fill(0), ultimo: null, juego: null };
    var guarda = r.int; r.int = r.pendiente; var pub = vistaPublica(); r.int = guarda;
    return { estado: { ah: pub } };
  }
  function alEstado(est) {
    if (!en()) return;
    if (est.phase === 'lobby' || !est.ah) { salir(); return; }
    if (!r.activo || r.ronda !== est.ronda) { iniciar(est); return; }
    if (!S.host) r.pub = est.ah;
    esperarUI().then(function (ui) { if (r.activo) ui.estado(r.pub); }).catch(function () {});
    pintarBarra();
  }
  L.registrar(id, {
    opciones: function () { return [L.mk('div', 'olNota', 'Por turnos, uno escribe la palabra y los demás la adivinan. Quien empieza escribiendo se decide al azar.')]; },
    preparar: preparar, alEstado: alEstado, alCerrar: salir
  });
  S.on('msg', alMensaje);
})();

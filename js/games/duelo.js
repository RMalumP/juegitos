/* js/games/duelo.js — Interfaz común de los juegos de DOS jugadores por turnos con tablero a la vista (Conecta 4, Tres en raya).
   Cada juego aporta su motor (js/online/*-engine.js: nuevo, jugar, legales, ia) y su tablero (cfg.tablero) y esta pieza pone el resto:
   menú (contra la CPU con 3 niveles · 2 jugadores en el mismo móvil · online), turnos, CPU, final y la interfaz para el adaptador online
   (js/online/j-duelo.js → Duelo.online[id]). El estado de la partida es público y completo, así que el online solo envía el estado.
   Duelo.crear({ id, Name, wrap, titulo, motor, nombres:[a,b], tablero(el, jugar) → { actualizar(est, puede) } }) */
(function () {
  'use strict';
  if (window.Duelo) return;                      // lo cargan Conecta 4 y Tres en raya: una sola vez
  var $ = function (id) { return document.getElementById(id); };
  var online = {};
  function vib(p) { if (typeof window.vibrate === 'function') window.vibrate(p); }

  function crear(cfg) {
    var raiz = $(cfg.wrap), M = cfg.motor, id = cfg.id;
    var U = { modo: null, nivel: 2, est: null, p: 0, nombres: ['', ''], timer: null, online: null, fin: false, starter: 1 };
    try { var sn = parseInt(localStorage.getItem('duNivel_' + id), 10); if (sn >= 1 && sn <= 3) U.nivel = sn; } catch (e) { /* sin ajustes */ }
    raiz.classList.add('duWrap');
    raiz.innerHTML = '<div class=duHeader><span class=duTit></span><span class=duInfo></span></div>' +
      '<div class=duBody><div class=duStatus></div><div class=duBoard></div><div class=duBtns></div></div>' +
      '<div class=duMenu><h1></h1><div class=duSub></div>' +
      '<button class=duBig data-modo=cpu>🤖 Contra la CPU</button>' +
      '<div class=duRow>Dificultad:<button class=duOpt data-nivel=1>Fácil</button><button class=duOpt data-nivel=2>Normal</button><button class=duOpt data-nivel=3>Difícil</button></div>' +
      '<button class=duBig data-modo=local>👥 2 jugadores · un móvil</button>' +
      '<button class=duBig data-modo=online>🌐 Online · 2 jugadores</button></div>' +
      '<div class=duFin><h1></h1><div class=duSub></div><button class=duBig data-r=otra>▶ JUGAR DE NUEVO</button><button class=duOpt data-r=menu>Menú</button><button class=duOpt data-r=ver>Ver el tablero</button></div>';
    var q = function (s) { return raiz.querySelector(s); };
    q('.duTit').textContent = cfg.titulo; q('.duMenu h1').textContent = cfg.titulo; q('.duMenu .duSub').textContent = cfg.ayuda || '';
    var ctl = cfg.tablero(q('.duBoard'), function (j) { jugada(j); });

    function nombre(p) { return U.nombres[p] || cfg.nombres[p]; }
    function puede() {
      var e = U.est; if (!e || e.fase !== 'jugando') return false;
      if (U.modo === 'local') return true;
      if (U.modo === 'cpu') return e.turno === 0;
      return U.modo === 'online' && !!U.online && e.turno === U.p;
    }
    function texto() {
      var e = U.est; if (!e) return '';
      if (e.fase === 'fin') return e.ganador === 2 ? '🤝 Empate' : textoGanador(e);
      var f = cfg.fichas[e.turno];
      if (U.modo === 'cpu') return e.turno === 0 ? f + ' Tu turno' : '🤖 Piensa la CPU…';
      if (U.modo === 'local') return f + ' Turno de ' + nombre(e.turno);
      return e.turno === U.p ? f + ' Tu turno' : '⏳ Juega ' + nombre(e.turno) + '…';
    }
    function textoGanador(e) {
      if (U.modo === 'local') return '🏆 Gana ' + nombre(e.ganador);
      return e.ganador === (U.modo === 'online' ? U.p : 0) ? '🏆 ¡Has ganado!' : '💀 Has perdido';
    }
    function pintar() {
      q('.duStatus').textContent = U.modo ? texto() : '';
      q('.duInfo').textContent = U.modo === 'cpu' ? 'CPU · ' + ['', 'Fácil', 'Normal', 'Difícil'][U.nivel] : U.modo === 'local' ? '2 jugadores' : U.modo === 'online' ? '🌐 ' + (window.Sala && window.Sala.sala || 'online') : '';
      ctl.actualizar(U.est, puede());
      if (U.est && U.est.fase === 'fin' && !U.fin) mostrarFin();
      guardarPartida();
    }
    /* partida a medias (contra la CPU o 2 jugadores en un móvil; la online no se guarda) */
    function guardarPartida() {
      if (!window.Partida || U.modo === 'online') return;
      if ((U.modo !== 'cpu' && U.modo !== 'local') || !U.est || U.est.fase !== 'jugando') { window.Partida.borrar(id); return; }
      window.Partida.guardar(id, { modo: U.modo, nivel: U.nivel, est: M.copiar(U.est), nombres: U.nombres, starter: U.starter });
    }
    function restaurar() {
      var d = window.Partida && window.Partida.cargar(id);
      if (!d || (d.modo !== 'cpu' && d.modo !== 'local') || !d.est || d.est.fase !== 'jugando' || !Array.isArray(d.est.tab)) return false;
      clearTimeout(U.timer); U.modo = d.modo; U.online = null; U.fin = false; U.nivel = d.nivel >= 1 && d.nivel <= 3 ? d.nivel : U.nivel;
      U.nombres = Array.isArray(d.nombres) ? d.nombres : cfg.nombres.slice(); U.starter = d.starter === 0 ? 0 : 1; U.est = d.est;
      q('.duMenu').style.display = 'none'; q('.duFin').style.display = 'none'; pintar();
      if (U.modo === 'cpu' && U.est.turno === 1) turnoCPU();
      return true;
    }
    function mostrarFin() {
      U.fin = true; clearTimeout(U.timer);
      var e = U.est, f = q('.duFin');
      f.querySelector('h1').textContent = texto(); f.querySelector('.duSub').textContent = e.ganador === 2 ? 'Tablero lleno.' : 'Jugadas: ' + e.n + '.';
      var b = f.querySelector('[data-r=otra]'), m = f.querySelector('[data-r=menu]');
      if (U.modo === 'online') { b.textContent = U.online && U.online.host ? '↩ Volver al lobby' : '⏳ Esperando al anfitrión'; b.disabled = !(U.online && U.online.host); m.style.display = 'none'; }
      else { b.textContent = '▶ REVANCHA'; b.disabled = false; m.style.display = ''; }
      f.style.display = 'flex'; vib(e.ganador === 2 ? 60 : [0, 40, 60, 40]);
    }
    function jugada(j) {
      if (!puede()) return;
      if (U.modo === 'online') { U.online.jugar(j); return; }
      if (!M.jugar(U.est, j)) return;
      vib(10); pintar();
      if (U.modo === 'cpu' && U.est.fase === 'jugando' && U.est.turno === 1) turnoCPU();
    }
    function turnoCPU() {
      clearTimeout(U.timer);
      U.timer = setTimeout(function () {
        if (U.modo !== 'cpu' || !U.est || U.est.fase !== 'jugando' || U.est.turno !== 1) return;
        M.jugar(U.est, M.ia(U.nivel, U.est)); vib(10); pintar();
      }, window.dueloRapido ? 10 : 550);
    }
    function empezar(modo) {
      clearTimeout(U.timer); U.modo = modo; U.online = null; U.fin = false;
      U.nombres = modo === 'cpu' ? ['Tú', 'CPU'] : cfg.nombres.slice();
      U.starter = modo === 'cpu' ? (Math.random() < 0.5 ? 0 : 1) : 1 - U.starter;
      U.est = M.nuevo({ turno: U.starter });
      q('.duMenu').style.display = 'none'; q('.duFin').style.display = 'none'; pintar();
      if (modo === 'cpu' && U.est.turno === 1) turnoCPU();
    }
    function menu() {
      clearTimeout(U.timer); U.modo = null; U.est = null; U.fin = false; U.online = null;
      q('.duFin').style.display = 'none'; q('.duMenu').style.display = 'flex'; marcar();
      q('.duStatus').textContent = ''; q('.duInfo').textContent = ''; ctl.actualizar(M.nuevo(), false);
    }
    function marcar() { raiz.querySelectorAll('.duMenu [data-nivel]').forEach(function (b) { b.classList.toggle('sel', +b.dataset.nivel === U.nivel); }); }
    raiz.querySelectorAll('.duMenu [data-modo]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.modo === 'online') { var c = document.querySelector('[data-conectar=' + id + ']'); if (c) c.click(); return; }
        empezar(b.dataset.modo);
      });
    });
    raiz.querySelectorAll('.duMenu [data-nivel]').forEach(function (b) { b.addEventListener('click', function () { U.nivel = +b.dataset.nivel; try { localStorage.setItem('duNivel_' + id, U.nivel); } catch (e) { /* nada */ } marcar(); }); });
    q('.duFin [data-r=otra]').addEventListener('click', function () {
      if (U.modo === 'online') { if (U.online && U.online.host) U.online.lobby(); return; }
      empezar(U.modo);
    });
    q('.duFin [data-r=menu]').addEventListener('click', menu);
    q('.duFin [data-r=ver]').addEventListener('click', function () { q('.duFin').style.display = 'none'; });
    var nuevaPartida = $(id + 'NewGame');
    if (nuevaPartida) nuevaPartida.addEventListener('click', function () {
      if (U.modo === 'online') { if (window.Sala) window.Sala.toast('En línea: el anfitrión puede volver al lobby con «↩ Lobby» y cualquiera puede salir de la sala.'); return; }
      if (window.Partida) window.Partida.borrar(id);
      menu();
    });

    /* interfaz para el adaptador online */
    online[id] = {
      iniciar: function (c) {                                     // { p, nombres, host, est, jugar, lobby }
        clearTimeout(U.timer); U.modo = 'online'; U.p = c.p; U.nombres = c.nombres; U.online = { host: !!c.host, jugar: c.jugar, lobby: c.lobby };
        U.est = c.est; U.fin = false; q('.duMenu').style.display = 'none'; q('.duFin').style.display = 'none'; pintar();
      },
      estado: function (est) {
        if (U.modo !== 'online') return;
        if (U.est && U.est.fase === 'fin' && est.fase !== 'fin') { U.fin = false; q('.duFin').style.display = 'none'; }
        U.est = est; pintar();
      },
      salir: function () { if (U.modo === 'online') menu(); },
      activo: function () { return U.modo === 'online'; }
    };
    window['init' + cfg.Name] = function () { if (!U.modo && !restaurar()) menu(); };
    window[id + 'StartNew'] = menu;
    window['pause' + cfg.Name] = function () { /* la partida espera */ };
    window[id + 'Estado'] = function () { return { modo: U.modo, p: U.p, est: U.est && M.copiar(U.est), nivel: U.nivel }; };
    menu();
  }
  window.Duelo = { crear: crear, online: online };
})();

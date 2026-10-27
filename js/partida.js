/* partida.js — Juegos XP: guarda en el móvil (localStorage) la partida que queda a medias de cada juego, para retomarla al volver.
   Cada juego llama a Partida.guardar(id, estado) cuando cambia su estado, Partida.cargar(id) al abrirse y Partida.borrar(id) al terminar
   o empezar de nuevo. Se guarda como «partida_<id>» y, al ser localStorage, entra también en Guardar/Cargar datos. */
(function () {
  'use strict';
  var P = 'partida_';
  window.Partida = {
    guardar: function (id, d) { try { localStorage.setItem(P + id, JSON.stringify({ v: 1, t: Date.now(), d: d })); } catch (e) { /* sin espacio o sin almacenamiento */ } },
    cargar: function (id) { try { var o = JSON.parse(localStorage.getItem(P + id)); return o && o.v === 1 ? o.d : null; } catch (e) { return null; } },
    borrar: function (id) { try { localStorage.removeItem(P + id); } catch (e) { /* nada */ } }
  };
})();

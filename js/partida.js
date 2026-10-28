/* partida.js — Juegos XP: guarda en el móvil (localStorage) la partida que queda a medias de cada juego, para retomarla al volver.
   La guarda el jugador con el botón «💾 Guardar» de cada juego (Partida.guardar(id, estado)); al abrir el juego, este recupera lo guardado
   (Partida.cargar(id)). Partida.aviso(txt) muestra el mensaje de confirmación. Se guarda como «partida_<id>» y, al ser localStorage, entra también en Guardar/Cargar datos. */
(function () {
  'use strict';
  var P = 'partida_';
  window.Partida = {
    guardar: function (id, d) { try { localStorage.setItem(P + id, JSON.stringify({ v: 1, t: Date.now(), d: d })); } catch (e) { /* sin espacio o sin almacenamiento */ } },
    cargar: function (id) { try { var o = JSON.parse(localStorage.getItem(P + id)); return o && o.v === 1 ? o.d : null; } catch (e) { return null; } },
    borrar: function (id) { try { localStorage.removeItem(P + id); } catch (e) { /* nada */ } },
    existe: function (id) { return window.Partida.cargar(id) !== null; },
    aviso: function (txt) {                                    // mensaje breve en la parte baja de la pantalla
      var d = document.getElementById('partidaAviso');
      if (!d) { d = document.createElement('div'); d.id = 'partidaAviso'; d.style.cssText = 'position:fixed;left:50%;bottom:60px;transform:translateX(-50%);z-index:99999;background:#000c;color:#fff;font:13px Arial,sans-serif;padding:8px 14px;border-radius:6px;max-width:90vw;text-align:center;pointer-events:none;transition:opacity .25s'; document.body.appendChild(d); }
      d.textContent = txt; d.style.opacity = 1; clearTimeout(d._t); d._t = setTimeout(function () { d.style.opacity = 0; }, 1800);
    }
  };
})();

/* js/pwa.js — Aplicación instalable (PWA): registra el service worker, ofrece «Instalar como app», avisa de versiones nuevas y abre
   directamente el juego de los accesos directos (?abrir=bingo | ?abrir=sala). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var evInstalar = null;
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var seguro = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  function pintar() {
    var caja = $('salaApp'); if (!caja) return;
    var txt = $('salaAppTxt'), btn = $('salaInstalar');
    if (standalone) { caja.style.display = 'none'; return; }
    caja.style.display = ''; btn.style.display = 'none';
    if (evInstalar) { btn.style.display = ''; txt.textContent = 'Instálala para abrirla desde la pantalla de inicio, a pantalla completa y sin conexión.'; }
    else if (ios) txt.textContent = 'En iPhone o iPad: pulsa el botón Compartir de Safari y elige «Añadir a pantalla de inicio».';
    else if (seguro && 'serviceWorker' in navigator) txt.textContent = 'Para instalarla: menú del navegador (⋮) → «Instalar aplicación» o «Añadir a pantalla de inicio».';
    else caja.style.display = 'none';
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); evInstalar = e; pintar(); });
  window.addEventListener('appinstalled', function () { evInstalar = null; standalone = true; pintar(); if (window.Sala) window.Sala.toast('✅ Aplicación instalada'); });

  function barraActualizacion() {
    if ($('pwaUpdate')) return;
    var b = document.createElement('div'); b.id = 'pwaUpdate';
    b.innerHTML = '<span>🔄 Hay una versión nueva</span><button type="button">Actualizar</button>';
    b.querySelector('button').onclick = function () { location.reload(); };
    document.body.appendChild(b);
  }
  function registrar() {
    if (!('serviceWorker' in navigator) || !seguro) return;
    var habiaControl = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (habiaControl) barraActualizacion(); habiaControl = true; });
    navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('Service worker no registrado:', e && e.message); });
  }
  function abrirDirecto() {
    var que = null;
    try { que = new URLSearchParams(location.search).get('abrir'); } catch (e) { return; }
    if (que !== 'bingo' && que !== 'sala') return;
    var ss = $('startScreen'); if (ss) ss.style.display = 'none';
    var cr = $('creditsBtn'); if (cr) cr.style.display = 'none';
    if (typeof window.openGame === 'function') window.openGame(que);
  }
  function iniciar() {
    var b = $('salaInstalar');
    if (b) b.onclick = function () {
      if (!evInstalar) return;
      evInstalar.prompt();
      evInstalar.userChoice.then(function () { evInstalar = null; pintar(); });
    };
    pintar(); registrar(); abrirDirecto();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

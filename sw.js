/* sw.js — Service worker de Juegos XP (PWA).
   · Al instalar guarda toda la aplicación: el escritorio y todos los juegos funcionan sin conexión (también el bingo en local).
   · Archivos propios: «red primero» (máx. 4 s) con la caché de reserva: con conexión siempre se ve la última versión y sin conexión (o con red mala) se
     usa lo guardado. Imágenes y fuentes de otros dominios: se sirve lo guardado y se actualiza en segundo plano.
   · El online no se toca: la señalización de PeerJS (WebSocket/API) va siempre a la red. Solo se guarda el script de PeerJS (versión fijada) para que
     no haga falta descargarlo cada vez.
   Al cambiar archivos de la aplicación SUBE `APP_VERSION` en js/version.js (y añade a `ARCHIVOS` cualquier archivo nuevo: tests/pwa.js lo comprueba). */
importScripts('js/version.js');                              // define self.APP_VERSION: única fuente de la versión
const VERSION = 'v' + self.APP_VERSION;
const SHELL = 'juegitos-shell-' + VERSION;
const EXTRA = 'juegitos-extra-' + VERSION;
const ARCHIVOS = [
  './',
  'css/core.css',
  'css/games/asteroids.css',
  'css/games/bingo.css',
  'css/games/dice.css',
  'css/games/frogger.css',
  'css/games/invaders.css',
  'css/games/pacman.css',
  'css/games/poker.css',
  'css/games/pong.css',
  'css/games/roul.css',
  'css/games/snake.css',
  'css/games/sudoku.css',
  'css/games/tetris.css',
  'css/sala.css',
  'games/chess.js',
  'games/parchis.js',
  'icons/xp-apple-180.png',
  'icons/xp-192.png',
  'icons/xp-512.png',
  'icons/xp-maskable-512.png',
  'icons/xp.svg',
  'index.html',
  'js/bingo/engine.js',
  'js/controls-toggle.js',
  'js/core.js',
  'js/games/asteroids.js',
  'js/games/bingo.js',
  'js/games/dice.js',
  'js/games/frogger.js',
  'js/games/wordle-engine.js',
  'js/games/wordle-palabras.js',
  'css/games/wordle.css',
  'js/games/wordle.js',
  'css/games/flappy.css',
  'js/games/flappy.js',
  'css/games/simon.css',
  'js/games/simon.js',
  'js/games/mem-engine.js',
  'css/games/memoria.css',
  'js/games/memoria.js',
  'js/online/ttt-engine.js',
  'js/games/ttt.js',
  'js/online/j-duelo.js',
  'js/games/duelo.js',
  'js/online/c4-engine.js',
  'css/games/duelo.css',
  'js/games/c4.js',
  'css/games/breakout.css',
  'js/games/breakout.js',
  'js/games/g2048-engine.js',
  'css/games/g2048.css',
  'js/games/g2048.js',
  'js/pasar-movil.js',
  'js/online/hundir-engine.js',
  'css/games/hundir.css',
  'js/games/hundir.js',
  'js/games/invaders.js',
  'js/games/pacman.js',
  'js/games/pong.js',
  'js/games/snake.js',
  'js/games/sudoku.js',
  'js/games/tetris.js',
  'js/iframe-games.js',
  'js/lazy-loader.js',
  'js/online/casino-engine.js',
  'js/online/j-blackjack.js',
  'js/online/j-casino.js',
  'js/online/j-hundir.js',
  'js/online/j-parchis.js',
  'js/online/j-ruleta.js',
  'js/online/j-tablero.js',
  'js/online/lobby.js',
  'js/online/qrcode.js',
  'js/online/sala.js',
  'js/online/transport-peer.js',
  'js/pwa.js',
  'js/save-load.js',
  'js/escala.js',
  'js/opciones.js',
  'js/teclas.js',
  'js/vibracion.js',
  'js/version.js',
  'js/window-bars.js',
  'manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(ARCHIVOS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('juegitos-') && k !== SHELL && k !== EXTRA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'saltar-espera') self.skipWaiting(); });

async function conActualizacion(req, nombre, ignorarQuery) {
  const cache = await caches.open(nombre);
  const guardado = await cache.match(req, { ignoreSearch: !!ignorarQuery });
  const red = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }).catch(() => null);
  return guardado || (await red) || (req.mode === 'navigate' ? cache.match('index.html', { ignoreSearch: true }) : Response.error());
}

function redPrimero(req, nombre, ms) {
  return caches.open(nombre).then(cache => new Promise(resolver => {
    let hecho = false;
    const usarCache = () => cache.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? cache.match('index.html', { ignoreSearch: true }) : null));
    const t = setTimeout(() => usarCache().then(r => { if (r && !hecho) { hecho = true; resolver(r); } }), ms);
    fetch(req).then(r => {
      clearTimeout(t);
      if (r && r.ok) cache.put(req, r.clone());
      if (!hecho) { hecho = true; resolver(r); }
    }).catch(() => { clearTimeout(t); if (!hecho) usarCache().then(r => { hecho = true; resolver(r || Response.error()); }); });
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) { e.respondWith(redPrimero(req, SHELL, 4000)); return; }
  if (/peerjs@[\d.]+\/dist\/peerjs\.min\.js$/.test(url.pathname)) { e.respondWith(conActualizacion(req, EXTRA)); return; } // librería de PeerJS (versión fijada)
  if (/peerjs/i.test(url.hostname)) return;                                                                                   // señalización: siempre red
  if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url.pathname) || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(conActualizacion(req, EXTRA));
});

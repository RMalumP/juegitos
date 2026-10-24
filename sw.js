/* sw.js — Service worker de Juegos XP (PWA).
   · Al instalar guarda toda la aplicación: el escritorio y todos los juegos funcionan sin conexión (también el bingo en local).
   · Estrategia «stale-while-revalidate»: se sirve lo guardado al instante y se actualiza en segundo plano; la versión nueva se ve al volver a abrir
     (la página avisa con «Hay una versión nueva»).
   · El online no se toca: la señalización de PeerJS (WebSocket/API) va siempre a la red. Solo se guarda el script de PeerJS (versión fijada) para que
     no haga falta descargarlo cada vez.
   Al cambiar archivos de la aplicación SUBE `VERSION` (y añade a `ARCHIVOS` cualquier archivo nuevo: tests/pwa.js lo comprueba). */
const VERSION = 'v1';
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
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
  'index.html',
  'js/bingo/engine.js',
  'js/controls-toggle.js',
  'js/core.js',
  'js/games/asteroids.js',
  'js/games/bingo.js',
  'js/games/dice.js',
  'js/games/frogger.js',
  'js/games/invaders.js',
  'js/games/pacman.js',
  'js/games/pong.js',
  'js/games/snake.js',
  'js/games/sudoku.js',
  'js/games/tetris.js',
  'js/iframe-games.js',
  'js/lazy-loader.js',
  'js/online/qrcode.js',
  'js/online/sala.js',
  'js/online/transport-peer.js',
  'js/pwa.js',
  'js/save-load.js',
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

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) { e.respondWith(conActualizacion(req, SHELL, true)); return; }
  if (/peerjs@[\d.]+\/dist\/peerjs\.min\.js$/.test(url.pathname)) { e.respondWith(conActualizacion(req, EXTRA)); return; } // librería de PeerJS (versión fijada)
  if (/peerjs/i.test(url.hostname)) return;                                                                                   // señalización: siempre red
  if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url.pathname) || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(conActualizacion(req, EXTRA));
});

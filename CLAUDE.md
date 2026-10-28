# CLAUDE.md — guía rápida de Juegitos

PWA con estética de Windows XP, en español y pensada para móvil: escritorio con más de 25 juegos, bingo y sala online (PeerJS). Sin frameworks ni build: JS plano con funciones globales, servido tal cual.

## Ramas y publicación

- **`main` es la única rama** y la que publica GitHub Pages (desde la raíz). Trabaja en una rama nueva y abre el PR contra `main`; el dueño dice cuándo fusionar.
- La CI (`.github/workflows/pruebas.yml`) pasa en cada PR `npm test`, `test:pwa`, `test:regresion` y `test:mejoras`.
- Al cambiar archivos de la app: sube `APP_VERSION` (y `APP_FECHA`) en `js/version.js` (de ahí salen la versión de los créditos y la caché del service worker) y añade a `ARCHIVOS` de `sw.js` cualquier archivo nuevo (`npm run test:pwa` lo comprueba).

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html` | Marcado de todo (minificado): escritorio, barra de tareas, menú de inicio y una ventana `winX` por juego. |
| `js/core.js` | Registro `GAMES` (id → `{ init, pause?, resume? }`) y gestor de ventanas (`openGame`, pausa `d()`, `resumeWin`), Buscaminas, Solitario, Carta, Blackjack, Ruleta y Póquer. Minificado: busca por id del DOM. |
| `js/games/*.js`, `css/games/*.css` | Un juego por archivo; se cargan al abrirlos (`js/lazy-loader.js`). Varios están minificados. |
| `games/chess.js`, `games/parchis.js` | El HTML de Ajedrez/Damas y Parchís como cadena (`window.__CHESS_HTML`), cargado en un iframe por `js/iframe-games.js`. Para editarlo: evalúa el archivo, cambia la cadena y vuelve a escribirla con `JSON.stringify`. |
| `js/online/` | Sala online, lobby, transporte PeerJS y motores sin DOM (con tests). |
| `js/records.js`, `js/partida.js`, `js/a11y.js`… | Utilidades comunes: récords, partidas guardadas, accesibilidad (añade clases de botón nuevas a `BUTTONS`). |
| `tests/` | `npm test` (motores en Node) y pruebas de navegador `npm run test:<nombre>` con Playwright; `npm run test:all` las pasa todas. |

El README tiene la lista de archivos y pruebas completa.

## Añadir un juego

Crea `js/games/x.js` (y `css/games/x.css`) con `initX()` y `pauseX()`, añádelo a `js/lazy-loader.js` y a `ARCHIVOS` de `sw.js`, añade una línea en `GAMES` de `js/core.js` y crea en `index.html` los elementos `winX`, `chipX`, `iconX`, `sBtnX`, `btnMinX` y `btnCloseX` (copia los de otro juego). Actualiza el README.

## Convenciones

- Textos de la interfaz, comentarios y mensajes de commit en **español**.
- Diseño para móvil primero (táctil, vertical); comprueba que no haya scroll horizontal.
- Datos en `localStorage` siempre dentro de `try/catch`.
- Juegos de acción: bucle de paso fijo a 60 pasos/s (independiente de los Hz de la pantalla).

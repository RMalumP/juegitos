# CLAUDE.md — guía rápida de Juegitos

PWA con estética de Windows XP, en español y pensada para móvil: escritorio con más de 25 juegos, bingo y sala online (PeerJS). Sin frameworks ni build: JS plano con funciones globales, servido tal cual.

## Ramas y publicación

- GitHub Pages publica desde la rama **`claude/escalado-niveles`**. Trabaja en una rama nueva y abre el PR contra ella; el dueño dice cuándo fusionar. `main` se mantiene igual que esa rama.
- Al cambiar archivos de la app: sube `APP_VERSION` (y `APP_FECHA`) en `js/version.js` (de ahí salen la versión de los créditos y la caché del service worker) y añade a `ARCHIVOS` de `sw.js` cualquier archivo nuevo (`npm run test:pwa` lo comprueba).

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html` | Marcado de todo (minificado): escritorio, barra de tareas, menú de inicio y una ventana `winX` por juego. |
| `js/core.js` | Gestor de ventanas (`openGame`, pausa `d()`, `resumeWin`), Buscaminas, Solitario, Carta, Blackjack, Ruleta y Póquer. Minificado: busca por id del DOM. |
| `js/games/*.js`, `css/games/*.css` | Un juego por archivo; se cargan al abrirlos (`js/lazy-loader.js`). Varios están minificados. |
| `games/chess.js`, `games/parchis.js` | El HTML de Ajedrez/Damas y Parchís como cadena (`window.__CHESS_HTML`), cargado en un iframe por `js/iframe-games.js`. Para editarlo: evalúa el archivo, cambia la cadena y vuelve a escribirla con `JSON.stringify`. |
| `js/online/` | Sala online, lobby, transporte PeerJS y motores sin DOM (con tests). |
| `js/records.js`, `js/partida.js`, `js/a11y.js`… | Utilidades comunes: récords, partidas guardadas, accesibilidad (añade clases de botón nuevas a `BUTTONS`). |
| `tests/` | `npm test` (motores en Node) y pruebas de navegador `npm run test:<nombre>` con Playwright; `npm run test:all` las pasa todas. |

El README tiene la lista de archivos y pruebas completa.

## Convenciones

- Textos de la interfaz, comentarios y mensajes de commit en **español**.
- Diseño para móvil primero (táctil, vertical); comprueba que no haya scroll horizontal.
- Datos en `localStorage` siempre dentro de `try/catch`.
- Juegos de acción: bucle de paso fijo a 60 pasos/s (independiente de los Hz de la pantalla).

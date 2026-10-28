# CLAUDE.md — guía rápida de Juegitos

PWA de una sola página con 15 juegos y estética de Windows XP, en español y pensada para móvil. Sin frameworks ni dependencias en tiempo de ejecución: JS plano con funciones globales.

## Regla de oro

- **Edita solo `src/`.** `index.html` y `sw.js` de la raíz **se generan** con `npm run build`; nunca los edites a mano ni los leas para entender el código (están minificados).
- Tras cambiar `src/`, ejecuta `npm run build` y haz commit de `index.html` y `sw.js` junto con el cambio. La CI (`.github/workflows/build.yml`) ejecuta `npm run check` y falla si no están al día.

```sh
npm install        # una vez (esbuild + prettier)
npm run build      # genera index.html y sw.js
npm run check      # lo que comprueba la CI
npm run format     # prettier sobre src/
```

## Estructura

| Ruta | Qué es |
|---|---|
| `src/index.html` | Marcado de todo: escritorio, barra de tareas, menú de inicio y una ventana `winX` por juego. Lleva `<!-- build:css -->` y `<!-- build:js -->`, que el build sustituye. Algunos botones usan `onclick="fn()"` en línea, así que esas funciones deben seguir siendo globales. |
| `src/styles.css` | Todos los estilos (~4100 líneas). |
| `src/js/*.js` | Un archivo por juego o módulo; se cargan en el orden de `SCRIPTS` en `build.mjs` (cada uno en su `<script>`, comparten el ámbito global). |
| `src/embedded/` | Juegos que viven en un `<iframe>` con su propio documento. |
| `src/sw.js` | Plantilla del service worker; el build sustituye `__VERSION__` por un hash de `index.html`. |
| `build.mjs` | Minifica con esbuild, incrusta CSS/JS y los juegos de iframe (gzip + base64) y escribe un `index.html` autocontenido. |
| `manifest.webmanifest`, `icons/` | Instalación como app (PWA). |

## Mapa de juegos

El id de juego (`Mine`, `Tetris`…) da nombre a los elementos del HTML: `winX` (ventana), `chipX` (botón en la barra de tareas), `iconX` (icono del escritorio), `sBtnX` (botón de la pantalla de inicio), `btnMinX` y `btnCloseX`.

| Juego | Id | Código |
|---|---|---|
| Buscaminas | `Mine` | `src/js/core.js` (~300–598, init `M()`) |
| Solitario | `Sol` | `core.js` (~599–971, init `te()`) |
| Carta (más alta/baja) | `Carta` | `core.js` (~972–1064, init `Ie()`) |
| Blackjack | `BJ` | `core.js` (~1065–1511, init `Oe()`, funciones `bj*`) |
| Ruleta | `Roul` | `core.js` (~1512–2374, init `bt()`, funciones `roul*`) |
| Póquer | `Poker` | `core.js` (~2375–final, init `Vt()`, funciones `pk*`) |
| Sudoku | `Sud` | `src/js/sudoku.js` |
| Tetris | `Tetris` | `src/js/tetris.js` |
| Invaders | `Inv` | `src/js/invaders.js` |
| Snake | `Snk` | `src/js/snake.js` |
| Pac-Man | `Pac` | `src/js/pacman.js` |
| Asteroids | `Ast` | `src/js/asteroids.js` |
| Ajedrez y Damas | `Chess` | `src/embedded/chess.html` + `chess-ai.js` (rival por ordenador) |
| Parchís | `Parchis` | `src/embedded/parchis.html` |

`core.js` viene de un archivo minificado: muchas funciones y variables tienen nombres de una o dos letras (`M`, `te`, `y`…). Búscalas con grep por el id del elemento DOM (`getElementById(\`smiley\`)`) en vez de leer el archivo entero. Los rangos de líneas son aproximados.

Otros módulos de `src/js/`:

- `shared.js`: `makeFixedStep(step)` (bucle a 60 pasos/s fijo, independiente de los Hz de la pantalla; úsalo en juegos de acción), récords `loadRecord`/`saveRecord`/`recordText` (en `localStorage` con prefijo `record:`) y registro del service worker.
- `core.js` (líneas ~126–260): registro `GAMES` y gestión de ventanas, reloj, vibración (`vibrate()`), barra de tareas.
- `embedded-games.js`: descomprime y carga los iframes (`loadEmbeddedGame`), abre Damas (`openChessTab(2)`) y pausa los relojes del ajedrez.
- `window-bar.js`: botón para ocultar/mostrar la barra de título de cada ventana.
- `a11y.js`: da `role="button"`, foco y Enter/Espacio a los `<div>` que hacen de botón. Si añades una clase de botón nueva, añádela a `BUTTONS`.

## Cómo se abren y pausan los juegos

En `core.js`, `GAMES` registra cada juego: `{ init, pause?, resume? }`.

- `openGame(key)` (key en minúsculas, p. ej. `"tetris"`): oculta y pausa las demás ventanas, muestra la del juego y llama a `init()` solo la primera vez (`gameStarted`).
- `minimizeGame` / `closeGame` / `toggleGame` (chip de la barra de tareas) llaman a `pause()`.
- `visibilitychange` (cambiar de pestaña, bloquear el móvil) pausa el juego visible.
- Solo el Sudoku tiene `resume` (su cronómetro); los juegos de acción muestran su pantalla de PAUSA con "Continuar".

**Añadir un juego:** crea `src/js/nuevo.js` con `initX()` y `pauseX()`, añádelo a `SCRIPTS` en `build.mjs`, añade una línea en `GAMES` y crea en `src/index.html` los elementos `winX`, `chipX`, `iconX`, `sBtnX`, `btnMinX` y `btnCloseX` (copia los de otro juego). Actualiza la lista de juegos del README, de `manifest.webmanifest` y de la meta `description`.

**Juegos en iframe:** para uno nuevo, añádelo a `EMBEDDED` en `build.mjs` (genera la constante `NOMBRE_HTML_GZ_B64`). Los `<script src="x.js">` dentro de ese HTML se incrustan desde `src/embedded/`. El documento padre habla con el iframe llamando a funciones globales suyas (`switchTab`, `pauseClocks`).

## PWA y publicación

- Pensada para publicarse con GitHub Pages desde la raíz de `main` (sirve `index.html`, `sw.js`, manifest e iconos).
- `sw.js`: red primero para la página y caché para el resto; cada build con cambios cambia la versión de caché, así los móviles reciben la versión nueva.
- `index.html` también funciona abierto como archivo (`file://`), pero sin service worker.
- Si añades un archivo estático nuevo, inclúyelo en `FILES` de `src/sw.js`.

## Convenciones

- Textos de la interfaz, comentarios y mensajes de commit en **español**.
- Diseño para móvil primero (táctil, vertical); comprueba que no haya scroll horizontal.
- Datos guardados en `localStorage` siempre dentro de `try/catch`.
- Formato con prettier (`npm run format`); comentarios breves que explican el porqué.
- Ramas y PR: trabajar en una rama y abrir PR contra `main`; el dueño decide cuándo fusionar.

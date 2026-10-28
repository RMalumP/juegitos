# Juegitos

Colección de juegos con estética de Windows XP en una sola página: Buscaminas, Tetris, Invaders, Snake, Pac-Man, Ajedrez, Damas, Asteroids, Sudoku, Parchís, Solitario, Carta, Blackjack, Ruleta y Póquer.

## Estructura

- `index.html`: la app publicada. **Se genera**, no se edita a mano.
- `src/index.html`: el marcado de la página.
- `src/styles.css`: los estilos.
- `src/js/`: un archivo por juego o módulo (`core.js` contiene el escritorio, las ventanas y los juegos de cartas).
- `src/embedded/`: Ajedrez/Damas y Parchís, que se cargan en un `<iframe>`. `chess-ai.js` es el rival por ordenador de Ajedrez y Damas (el build lo incrusta en `chess.html`).
- `src/sw.js`: service worker para que la app funcione sin conexión (el build genera `sw.js`).
- `manifest.webmanifest` e `icons/`: para instalar la app en la pantalla de inicio del móvil.
- `build.mjs`: junta todo, lo minifica y escribe `index.html` como un único archivo autocontenido, y `sw.js`.

`index.html` sigue funcionando si se abre directamente como archivo; la instalación y el modo sin conexión solo funcionan al servirla por https (por ejemplo, GitHub Pages).

## Desarrollo

```sh
npm install
npm run build   # regenera index.html
npm run check   # comprueba que index.html y sw.js están al día (lo ejecuta también la CI)
```

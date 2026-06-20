# Prueba de rendimiento — CSS/JS único vs. modular por juego

Comparativa de tres formas de servir la misma colección de juegos *Windows XP*
(15 juegos, DOM idéntico en las tres):

| Variante | Descripción | Archivos cargados al inicio |
|---|---|---|
| **A · single** | Original monolítico: `css/style.css` + `js/script.js` (todo inline, incluidos los blobs gzip+base64 de Ajedrez y Parchís). | 3 |
| **B · eager** | Modular por juego, pero **todo** el CSS/JS se carga de inicio (`<link>` + `<script>`). Ajedrez/Parchís externalizados a `games/*.html`. | 19 |
| **C · lazy** ⭐ | Modular + **carga bajo demanda**: solo el núcleo al inicio; el JS/CSS de cada juego se descarga la primera vez que lo abres. | 8 |

> ⭐ **C es la versión que se sirve en `index.html` (la recomendada).** A y B se
> conservan en `perf/` solo para esta comparativa.

## Resumen ejecutivo

Frente al archivo único original (**A**), la versión modular con carga perezosa (**C**):

- **−56 KB transferidos** al inicio: 95.4 KB → **39.3 KB** (-59% con gzip).
- **−61% de JavaScript que parsear**: 170.6 KB → **65.9 KB**.
- **-71% de tiempo de CPU en JS** en móvil: 35 ms → **10 ms**.
- **-33% hasta DOMContentLoaded** en móvil (4× CPU + Fast 3G): 814 ms → **542 ms** (la app es interactiva ~272 ms antes).

El coste: abrir un juego **por primera vez** descarga su módulo (p. ej. Tetris ~5 KB,
Ajedrez ~30 KB). Es un pago único por juego (se cachea) y **solo pagas por los juegos que juegas**.

## 1) Carga inicial — tamaño (medición determinista)

| Métrica | A single | B eager | C lazy | C vs A |
|---|---:|---:|---:|---:|
| Peticiones HTTP | 3 | 19 | 8 | — |
| Tamaño total (raw) | 265.8 KB | 216.7 KB | **145.8 KB** | -45% |
| **Transferido (gzip)** | 95.4 KB | 64.1 KB | **39.3 KB** | **-59%** |
| JS a parsear (raw) | 170.6 KB | 119.7 KB | **65.9 KB** | -61% |

## 2) Timing en frío — sin throttling (mediana de 9 ejecuciones)

| Métrica | A single | B eager | C lazy |
|---|---:|---:|---:|
| CPU en JS (ScriptDuration) | 7 ms | 9 ms | **2 ms** |
| DOMContentLoaded | 52 ms | 78 ms | **47 ms** |
| First Contentful Paint | 72 ms | 88 ms | 68 ms |

## 3) Timing en frío — perfil MÓVIL: 4× CPU + Fast 3G (mediana de 9)

> La app es *mobile-first* (controles táctiles), así que este perfil es el más representativo.

| Métrica | A single | B eager | C lazy | C vs A |
|---|---:|---:|---:|---:|
| CPU en JS (ScriptDuration) | 35 ms | 36 ms | **10 ms** | -71% |
| **DOMContentLoaded** | 814 ms | 855 ms | **542 ms** | **-33%** |
| First Contentful Paint | 496 ms | 668 ms | 508 ms | +2% |

## 4) Abrir un juego EN FRÍO (perfil móvil) — latencia / bytes

| Juego | A single | B eager | C lazy |
|---|---:|---:|---:|
| Tetris (1ª vez) | 120 ms / 0.0 KB | 112 ms / 0.0 KB | 264 ms / 5.2 KB |
| Ajedrez (1ª vez) | 80 ms / 0.0 KB | 360 ms / 30.3 KB | 364 ms / 30.3 KB |

En **A** los juegos ya están dentro del bundle inicial (0 KB extra al abrir), pero
por eso su carga inicial es la más pesada: descargas y parseas **los 15 juegos
aunque solo quieras jugar a uno**. En **C** abrir por primera vez cuesta una
pequeña descarga (cacheada después); a cambio, el escritorio aparece mucho antes.

## Interpretación

- **C (lazy) es la mejor arquitectura.** Reduce a la mitad lo que se transfiere y
  a un tercio el JS que el navegador debe parsear antes de mostrar el escritorio.
  En un móvil de gama media con 3G es interactivo **272 ms antes**.
- **B (eager) es la lección importante:** trocear por juego pero seguir cargándolo
  todo de golpe transfiere menos bytes que A (al externalizar Ajedrez/Parchís),
  pero las **19 peticiones** penalizan el *paint* sobre HTTP/1.1
  (FCP 668 ms vs 496 ms de A). Con HTTP/2/3 (multiplexado) el coste
  por petición casi desaparece, pero la conclusión se mantiene: **separar no es
  optimizar si no difieres la carga**.
- El gran ahorro de C viene de **no cargar lo que no se usa**: los ~50 KB de
  Ajedrez+Parchís y los ~50 KB de los 6 juegos de canvas no se descargan hasta
  que el usuario los abre.

## Qué se cambió (arquitectura del refactor)

```
index.html              ← versión C (lazy): solo núcleo + carga perezosa
css/core.css            ← reset + chrome de ventanas + escritorio/taskbar + juegos de cartas
css/games/*.css         ← roul, poker, tetris, invaders, snake, pacman, sudoku, asteroids
js/core.js              ← gestor de ventanas + Buscaminas/Solitario/Carta/Blackjack/Ruleta/Póker
js/games/*.js           ← sudoku, tetris, invaders, snake, pacman, asteroids (carga bajo demanda)
js/iframe-games.js      ← Ajedrez/Parchís: cargan games/*.html al abrir (antes: blob inline)
js/window-bars.js       ← utilidad de barras de título
js/lazy-loader.js       ← define stubs init* que descargan el módulo del juego al abrirlo
games/chess.html        ← Ajedrez (antes embebido como gzip+base64 dentro de script.js)
games/parchis.html      ← Parchís (íd.)
perf/baseline/          ← versión A original (fuente del build + baseline de la comparativa)
perf/eager/index.html   ← versión B
perf/{build,verify,measure,report}.mjs
```

**Garantía de equivalencia:** `perf/build.mjs` corta el CSS y el JS **en las
fronteras exactas, sin reordenar ni reescribir**, y verifica que la concatenación
de los trozos reproduce **byte a byte** los originales. Por tanto B ejecuta
exactamente el mismo código en el mismo orden que A. El único cambio de
comportamiento de C es *cuándo* se ejecuta el módulo de cada juego (al abrirlo).
`perf/verify.mjs` (Playwright) comprueba en las tres variantes que el escritorio,
los juegos de canvas (Tetris), del núcleo (Blackjack), lazy (Sudoku) y de iframe
(Ajedrez) funcionan sin errores de consola.

## Cómo reproducir

```bash
node perf/build.mjs     # regenera la versión modular desde perf/baseline/ (idempotente)
node perf/verify.mjs    # verifica funcionalmente A, B y C con Playwright
node perf/measure.mjs   # mide rendimiento -> perf/results.json
node perf/report.mjs    # regenera este RESULTS.md
```

---
*Medido con Chromium headless (Playwright). Los tamaños son deterministas; los
tiempos son la mediana de 9 ejecuciones en frío y varían con la máquina.*

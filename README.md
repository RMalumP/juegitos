# Juegos Windows XP

Escritorio estilo Windows XP con juegos clásicos (Buscaminas, Tetris, Ajedrez, Parchís, Póquer, Hundir la flota, 2048, Breakout, Conecta 4, Memoria, Simon, Flappy, Wordle…), **Bingo** local y online, y la app **Sala online** para jugar con amigos cada uno desde su móvil. Es una PWA instalable y funciona sin conexión (el online necesita https y que los móviles se encuentren por internet una vez).

## Bingo

- **Un único modo Bolero** (local): bombo animado, tablero 1–90, voz que canta el número y modo automático. Puedes añadirte **cartones propios (0–6)**, que salen debajo y juegas a la vez que cantas las bolas. Con 0 cartones sirve para jugar con **cartones físicos**.
- **Cartones** españoles 3×9 (15 números), numerados (**Cartón Nº 7**, único en toda la sala), que se marcan a toque (o con marcado automático), con aviso de línea y bingo. Un canto falso **borra del cartón las casillas mal marcadas**.
- **Comprobar cartones**: el Bolero ve la lista de todos los cartones de la sala (número, jugador, cuánto les falta), abre cualquiera con las bolas salidas y su veredicto de línea y bingo, o escribe los números de un cartón físico.
- **Online**: un móvil es el **Bolero** (anfitrión, que también puede tener cartones propios) y los demás son **jugadores** (de 1 a 6 cartones cada uno). El anfitrión reparte los cartones, saca las bolas y comprueba cada «¡LÍNEA!» y «¡BINGO!» contra los cartones que él mismo ha repartido: nadie puede cantar en falso, tampoco él. Voz opcional y recuperación si alguien recarga la página (incluido el Bolero).
- **Compartir**: desde el bingo, **🔗 Compartir** y **▦ QR**. El enlace lleva sala y contraseña: quien lo abre solo escribe su nombre y entra directamente en el bingo.

## Instalación

- Hasta que la app esté instalada, bajo «Cargar» hay un botón **📲 Instalar app**: lanza el diálogo de instalación del navegador o, si este no lo ofrece, explica los pasos (Safari en iPhone: Compartir → «Añadir a pantalla de inicio»). Instalada, el botón desaparece.
- **Icono de la app instalada:** Android lo guarda al instalar y solo lo renueva cuando Chrome detecta que el manifest cambió (la comprobación se hace sola, normalmente en uno o tres días; no se puede forzar desde la web). Por eso los archivos del icono llevan un nombre propio (`icons/xp-*.png`, `xp.svg`): si algún día cambias el dibujo, **cámbiale también el nombre** (p. ej. `xp2-…`) y actualiza `manifest.webmanifest`, `index.html` y `sw.js`. Para verlo ya, desinstala la app y vuelve a instalarla. En iPhone el icono se guarda al «Añadir a pantalla de inicio»: hay que borrarla y añadirla otra vez.
- Los créditos (©) muestran la versión.
- «🌐 Conectar» de cada juego abre la conexión con un botón **← Volver** al juego; y si ocultas la barra superior de un juego (□) se oculta también «Conectar».

## Vibración

**⚙ Opciones** (barra de tareas): en un móvil los controles en pantalla y los gestos van activados; en un ordenador se usa el teclado, los controles en pantalla quedan **plegados** (no se eliminan) y los gestos desactivados. Se puede cambiar a mano (Automático / Activado / Desactivado).

El interruptor 📳 de la barra activa o desactiva **toda** la vibración de la app (se recuerda al recargar). Vibra al tocar botones, iconos, fichas, casillas, cartones y números, y en los avisos online (bola nueva, tu turno, el rival ha movido, ha salido el número). Todo pasa por `js/vibracion.js` (`window.Vibra.pulso(ms | patrón)`).

- **Android** (Chrome, Edge, Firefox, Samsung Internet): API de vibración del navegador.
- **iPhone/iPad:** Safari no tiene esa API; se usa el toque háptico del sistema (iOS 17.4+, Safari) cuando tocas la pantalla. Los avisos que llegan solos desde la red (una bola nueva) no pueden vibrar ahí. Con otros navegadores de iPhone la vibración no es posible.
- Algunos móviles no vibran con el modo ahorro de batería o con el «feedback háptico» del sistema desactivado.

## Multijugador en más juegos

Cada juego con online tiene un botón **🌐 Conectar** en su barra de menú que lleva al **lobby de ese juego** (la ventana Multijugador sirve para entrar por código o enlace). Una sala es de un único juego: quien entra desde el botón de otro juego recibe «es de otro juego».

| Juego | Jugadores por sala | Cómo funciona |
|---|---|---|
| Bingo | 2–25 | el anfitrión es el Bolero (puede tener cartones propios); ver arriba |
| Ajedrez | 2 (anfitrión + 1 invitado) | cada jugada se envía y se aplica con el motor del juego; el anfitrión valida turno y legalidad; color al azar (o elegido en el lobby), rendición, recarga |
| Damas | 2 | igual, con capturas múltiples |
| Parchís | 2–4 (+ bots opcionales) | el anfitrión ejecuta el motor y publica una «foto»; los invitados mandan «tirar» y «mover ficha N» |
| Ruleta | 2–6 | **el juego original**: tapete completo (números, split, calle, trío, esquina, seisena, docenas, columnas, dobles, cero y 00), rueda, historial, deshacer, repetir; europea o americana. El anfitrión ejecuta el juego, los invitados lo reflejan y mandan sus apuestas |
| Blackjack | 2–6 | **el juego original**: 6 barajas, dividir (hasta 4 manos), doblar, blackjack 3:2, la banca pide hasta 17; la carta oculta de la banca nunca llega a los invitados |
| Póquer | 2–6 | Texas Hold'em con ciegas, subidas, all-in y botes secundarios; las cartas privadas llegan solo a su dueño |

Las reglas del bingo y del póquer están en `js/bingo/engine.js` y `js/online/casino-engine.js` (sin DOM, con tests). Ajedrez, Damas, Parchís, **Ruleta y Blackjack reutilizan los motores originales** (sin modificar `core.js`: se enganchan por sus nombres globales). Las fichas del casino son virtuales.

**Relojes de ajedrez:** los dos móviles empiezan con el reloj del anfitrión; cada uno corre el suyo y se sincronizan los eventos con los tiempos exactos (iniciar, pausar, reanudar, reiniciar, cambio de modo o de tiempo, turno con cada jugada). El reloj grande de la pestaña «⏱ Reloj» se sincroniza igual. Si se agota el tiempo de alguien, pierde en los dos.

**Invitaciones:** el enlace o QR de una sala de un juego entra directamente en ese juego (sin el menú de todos los juegos). Las salas creadas desde el botón Multijugador son *generales*: el invitado ve el menú de juegos y, cuando el anfitrión abre uno, todos pasan a él.

## Sala online (la conexión es una app)

El icono **📡 Multijugador** del escritorio (junto a Guardar y Cargar, no en el menú de inicio) abre una ventana donde se crea o se entra en una sala con nombre + contraseña (también por **QR** o enlace). El símbolo **📶** de la barra inferior muestra el estado (gris sin sala, ámbar conectando, verde conectado) y abre la misma ventana; si plegas la barra con ▾, el símbolo se queda flotando junto al botón ▲. Los juegos no tienen pantalla de conexión propia: usan `window.Sala`.

Cómo funciona (adaptado de «La aldea se duerme» y «El Impostor»):

- WebRTC punto a punto con **PeerJS, STUN y TURN**. Sin Firebase. Las credenciales TURN no están en el repositorio: se piden al Worker de Cloudflare de «El Impostor» (`TURN_PROXY_URL` en `js/online/transport-peer.js`; solo responde a `https://rmalump.github.io`). Si el Worker no responde, la sala funciona igual solo con STUN y se avisa.
- El móvil del anfitrión hace de servidor: valida la contraseña, acepta o rechaza jugadores y envía a cada uno **solo lo suyo**.
- La sala es `SHA-256(nombre + contraseña)`: la contraseña nunca se guarda ni se envía.
- Misma wifi (o hotspot del anfitrión): conexión directa por la red local; el relé no se usa. Con TURN también conectan wifi ↔ 4G (basta con que lo use un extremo). En la lista de jugadores cada conexión muestra 📶 red local, 🌐 internet o 🔁 relé.
- Otro Worker: cambia la URL, o `globalThis.JUEGITOS_TURN_PROXY` (cadena vacía = sin relé). Credenciales fijas sin Worker: `localStorage 'juegitos.peer.turn'`.
- El servidor público de PeerJS solo sirve para que los móviles se encuentren, así que hace falta internet al conectar. Si el anfitrión cierra la pestaña la partida se detiene; si recarga, se recupera.

## Estructura

```
index.html                    escritorio, ventanas y barra de tareas
css/core.css, css/sala.css    estilos del escritorio · de la Sala online y la barra
css/games/*.css, js/games/*.js  un juego por archivo (se cargan al abrirlos: js/lazy-loader.js)
js/bingo/engine.js            reglas del bingo, sin DOM (con tests en Node)
js/games/bingo.js             interfaz del bingo (local y online)
js/online/sala.js             app «Sala online»: ventana, símbolo de la barra y API window.Sala
js/online/transport-peer.js   transporte PeerJS (STUN + TURN)
js/online/lobby.js            lobby de cada juego (asientos, límite de jugadores, opciones, Empezar)
js/online/j-tablero.js        Ajedrez y Damas online
js/online/j-parchis.js        Parchís online
js/online/j-casino.js         Ruleta, Blackjack y Póquer online
js/online/casino-engine.js    reglas del póquer (sin DOM)
js/online/j-ruleta.js         Ruleta original online
js/online/j-blackjack.js      Blackjack original online
js/online/qrcode.js           generador de QR (MIT)
js/pwa.js                     instalación (botón «Instalar app»), actualizaciones, versión en créditos y accesos directos (?abrir=bingo | ?abrir=sala)
js/version.js                 versión de la app (única fuente)
js/vibracion.js               vibración común (interruptor 📳)
js/opciones.js                ⚙ Opciones: detecta móvil/ordenador, control táctil (auto/activado/desactivado) y repetición de Tetris (DAS, ARR, SDF)
js/pasar-movil.js            «pasa el móvil»: tapa a pantalla completa para jugar varios en un mismo móvil
js/online/hundir-engine.js    Hundir la flota: reglas, árbitro e IA (sin DOM, con tests)
js/online/j-hundir.js         Hundir la flota online (el anfitrión es el árbitro)
js/online/c4-engine.js        Conecta 4: reglas, árbitro e IA (sin DOM, con tests)
js/online/ttt-engine.js       Tres en raya: reglas, árbitro e IA perfecta (sin DOM, con tests)
js/games/duelo.js             interfaz común de los juegos de 2 jugadores por turnos (menú CPU / 2 en un móvil / online)
js/online/j-duelo.js          Conecta 4 y Tres en raya online (el anfitrión valida cada jugada)
js/games/g2048-engine.js      2048: reglas puras (con tests)
js/games/mem-engine.js         Memoria (parejas): reglas puras (con tests)
js/games/wordle-engine.js      Wordle: evaluación de letras (repetidas como el original), palabra del día (con tests)
js/games/wordle-palabras.js    palabras de 5 letras en español (≈1 600 soluciones y ≈9 300 válidas); diccionario MIT «an-array-of-spanish-words» y orden de frecuencia de «FrequencyWords»
sw.js, manifest.webmanifest, icons/   PWA
tests/                        pruebas
```

Si cambias archivos de la aplicación: sube `APP_VERSION` (y `APP_FECHA`) en `js/version.js` —de ahí salen la versión de los créditos y el nombre de la caché del service worker— y añade a `ARCHIVOS` de `sw.js` cualquier archivo nuevo (`tests/pwa.js` lo comprueba).

## Pruebas

`npm install` y después `npm run test:all` (necesita Chromium para las de navegador, con Playwright).

| Comando | Qué cubre |
|---|---|
| `npm test` | motores: bingo (cartones, bombo, premios) y póquer (400 manos aleatorias, botes secundarios, conservación de fichas) |
| `npm run test:ui` | bingo local: Bolero con y sin cartones propios, recarga, marcas falsas, comprobar cartones |
| `npm run test:online` | Bolero (con cartón propio) + 3 jugadores en navegadores distintos usando el icono Multijugador: cartones numerados, comprobar, cantos y dos partidas completas |
| `npm run test:niveles` | niveles y dificultades de los juegos de arcade: Snake (4 dificultades), Invaders/Pac-Man/Frogger/Asteroids/Tetris (15 niveles) y Pong (10 niveles de CPU) |
| `npm run test:tetris` | control de Tetris: toque corto = 1 casilla, DAS/ARR, última dirección, caída, guardar, lock delay, pausa, gestos táctiles y Opciones (escritorio con botones plegados y sin gestos / móvil con ambos) |
| `npm run test:hundir` | Hundir la flota: colocación manual, partida contra la CPU y 2 jugadores en un móvil con la tapa «pasa el móvil» |
| `npm run test:hundir-online` | Hundir la flota online con 2 navegadores: reglas, colocación secreta, validación del anfitrión, privacidad, recarga, partida completa, rendición y revancha |
| `npm run test:2048` | 2048: jugadas con teclado y ratón, deshacer, tamaños 4×4/5×5/6×6, victoria y récord por tamaño |
| `npm run test:breakout` | Breakout: 15 niveles de inicio, bot que rompe ladrillos, vidas y fin de partida |
| `npm run test:duelo` | Conecta 4 y Tres en raya: 2 jugadores en un móvil y contra la CPU en los 3 niveles |
| `npm run test:duelo-online` | Conecta 4 y Tres en raya online con 2 navegadores: turnos, jugadas ilegales ignoradas, victoria, recarga y revancha |
| `npm run test:fase4` | Memoria (parejas y 2 jugadores), Simon (bot), Flappy (bot) y Wordle (palabras, colores, estadísticas y recarga) |
| `npm run test:enlace` | entrar por enlace solo con el nombre, símbolo con la barra plegada y que los iconos del escritorio no se solapen |
| `npm run test:reconexion` | un jugador y el Bolero recargan a mitad de partida |
| `npm run test:regresion` | todos los juegos del escritorio abren sin errores |
| `npm run test:salas` | las 6 salas por juego: botón Conectar, límite de jugadores, «sala llena», «es de otro juego» y empezar |
| `npm run test:tablero` | Ajedrez y Damas online: jugadas, turnos, jugadas ilegales, colores, rendición, recarga |
| `npm run test:parchis` | Parchís online: turnos, mismo tablero en ambos móviles, bots, recarga |
| `npm run test:casino` | Póquer online con 2 navegadores |
| `npm run test:ruleta` | Ruleta original online: todas las casillas, apuestas de cada móvil, giro y pagos iguales, «listo», repetir, vuelta a local |
| `npm run test:blackjack` | Blackjack original online: apuestas, carta oculta, dividir, pagos, siguiente ronda, vuelta a local |
| `npm run test:reloj` | relojes de ajedrez: iniciar, pausar, reanudar, turno, reinicio, reloj grande y tiempo agotado |
| `npm run test:invitacion` | enlace/QR a cada juego entra directo (sin menú); sala general con menú |
| `npm run test:app` | botón Volver de la conexión, ocultar la barra oculta «Conectar», versión en créditos, «Instalar app» y aspecto del escritorio (sin texto suelto, barra de tareas entera) |
| `npm run test:vibracion` | interruptor 📳, vibración en casillas y cartones, avisos online, recordar el ajuste y respaldo háptico de iPhone |
| `npm run test:turn` | credenciales TURN del Worker y respaldo solo con STUN si falla |
| `npm run test:pwa` | manifest, iconos, caché, sin conexión, botón de instalar y accesos directos |

Pendiente de probar con móviles reales: varios teléfonos en una misma wifi y wifi ↔ 4G con el relé (el Worker solo responde desde `https://rmalump.github.io`).

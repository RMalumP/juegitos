# Juegos Windows XP

Escritorio estilo Windows XP con juegos clásicos (Buscaminas, Tetris, Ajedrez, Parchís, Póquer, Hundir la flota, 2048, Breakout, Pinball, UNO, Conecta 4, Dominó, Memoria, Simon, Flappy, Wordle, Ahorcado…)

**Hundir la flota** admite tableros de 6×6 a 15×15 y flotas a medida (plantillas Clásica, Rápida, Grande y Armada, o un editor de barcos de 1 a 6 casillas) contra la CPU, con 2 jugadores en un móvil y online. **Teclas reasignables** («⌨ Reasignar» en el menú de la ventana) en Breakout, 2048, Flappy y Hundir (que además se juega entero con teclado: cursor, colocar/disparar, girar con R). En Hundir los barcos pegados se distinguen por contorno y tono. **Botón «atrás» del móvil**: minimiza el juego abierto, cierra el menú de inicio o vuelve al juego desde la pantalla de conexión; sin nada que cerrar, sale de la web. **Wordle**: «Del día» no es aleatoria (la palabra sale de la fecha del dispositivo y cambia a medianoche; es la misma para todos); «Libre» elige una palabra al azar cada vez y no cuenta para las estadísticas. **Ahorcado**: «Solo» saca una palabra al azar de las del Wordle; con «2 jugadores» en un móvil uno escribe la palabra (oculta, sin tildes y con Ñ; también puede pedir una al azar), pasa el móvil y se turnan llevando el marcador; online (2–6) uno escribe y los demás la adivinan por turnos., **Bingo** local y online, y la app **Sala online** para jugar con amigos cada uno desde su móvil. Es una PWA instalable y funciona sin conexión (el online necesita https y que los móviles se encuentren por internet una vez).

## Dominó

Doble seis de **2 a 4 jugadores**: 7 fichas cada uno y, con 2 o 3, se roba del pozo cuando no se puede poner. La primera mano la abre quien tiene el doble más alto; las siguientes, quien ganó. Gana la mano quien domina (se queda sin fichas) o, si se cierra (tranque), quien menos puntos tiene; se lleva los puntos de los rivales. Partida a 1 mano, a 50 o a 100; con 4, **por parejas** (1.º y 3.º contra 2.º y 4.º). En local, cada asiento es una persona o la **CPU** (Fácil o Normal), y entre personas sale «Pasa el móvil». **Online**: de 2 a 4 personas y el anfitrión puede añadir **hasta 2 CPU** (sin pasar de 4). 💾 Guardar y récord de la mejor mano contra la CPU.

## UNO

Baraja de **108 cartas** (por color un 0, dos de cada número del 1 al 9 y dos +2, Reversa y Salta; 4 comodines y 4 comodines +4) con las reglas del reglamento oficial: robar y jugar la robada (o pasar), **+2 y +4 acumulables** (opción), **reto al +4** (si era ilegal roba 4 quien lo tiró; si era legal, el retador roba 6), **«¡UNO!»** con la penúltima carta (si alguien te pilla sin decirlo, robas 2), carta de salida con su efecto y partida **rápida o a 200/500 puntos**. Con 2 jugadores la Reversa hace de Salta.

- **🤖 Contra la CPU:** de 1 a 7 rivales, fácil, normal o difícil. Cuenta victorias y guarda el récord de turnos para ganar.
- **📱 Pasar el móvil** (como el Póquer): de 2 a 8 personas en un móvil, con CPU opcionales; una tapa oculta la mano entre turnos.
- **🌐 Online:** de 2 a 8 personas más asientos de CPU; el anfitrión reparte y valida, y cada uno recibe solo su mano.

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

**⚙ Opciones** (menú de los juegos con controles en pantalla: Tetris, Pac-Man, Invaders, Snake, Asteroids y Frogger): en un móvil los controles en pantalla y los gestos van activados; en un ordenador se usa el teclado, los controles en pantalla quedan **plegados** (no se eliminan) y los gestos desactivados. Se puede cambiar a mano (Automático / Activado / Desactivado).

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
| Dominó | 2–4 (+ hasta 2 CPU) | el anfitrión es el árbitro y juega por las CPU; cada uno recibe solo su mano; opciones: 0–2 CPU (sin pasar de 4), 1 mano / a 50 / a 100 y, con 4, por parejas (con 2 personas y 2 CPU, juntas o rivales) |
| Ahorcado | 2–6 | en cada ronda uno escribe la palabra y los demás la adivinan por turnos (acertar repite turno, fallar lo pasa). La palabra solo la tiene el anfitrión: los demás reciben los huecos hasta el final. Puntos: 1 por letra, 2 más a quien la completa y 3 a quien la escribió si los ahorca |
| Póquer | 2–6 | Texas Hold'em con ciegas, subidas, all-in y botes secundarios; las cartas privadas llegan solo a su dueño |
| UNO | 2–8 (+ CPU opcionales) | el anfitrión ejecuta el motor y juega por las CPU; publica lo público (carta de arriba, color, cuántas cartas tiene cada uno) y manda a cada uno solo su mano |

Las reglas del bingo y del póquer están en `js/bingo/engine.js` y `js/online/casino-engine.js` (sin DOM, con tests). Ajedrez, Damas, Parchís, **Ruleta y Blackjack reutilizan los motores originales** (sin modificar `core.js`: se enganchan por sus nombres globales). Las fichas del casino son virtuales.

**Relojes de ajedrez:** los dos móviles empiezan con el reloj del anfitrión; cada uno corre el suyo y se sincronizan los eventos con los tiempos exactos (iniciar, pausar, reanudar, reiniciar, cambio de modo o de tiempo, turno con cada jugada). El reloj grande de la pestaña «⏱ Reloj» se sincroniza igual. Si se agota el tiempo de alguien, pierde en los dos.

**Invitaciones:** el enlace o QR de una sala de un juego entra directamente en ese juego (sin el menú de todos los juegos). Las salas creadas desde el botón Multijugador son *generales*: el invitado ve el menú de juegos y, cuando el anfitrión abre uno, todos pasan a él.

## Sala online (la conexión es una app)

El icono **📡 Multijugador** del escritorio (junto a Guardar y Cargar, no en el menú de inicio) abre una ventana donde se crea o se entra en una sala con nombre + contraseña (también por **QR** o enlace). El símbolo **📶** de la barra inferior muestra el estado (gris sin sala, ámbar conectando, verde conectado) y abre la misma ventana; si plegas la barra con ▾, el símbolo se queda flotando junto al botón ▲. Los juegos no tienen pantalla de conexión propia: usan `window.Sala`.

**Partidas a medias.** Cada juego con partida larga tiene un botón **💾 Guardar** (en la barra de menú de la ventana; en Sudoku, entre los botones de abajo): 2048, Sudoku, Memoria, Conecta 4, 3 en raya y Hundir la flota (contra la CPU o 2 jugadores en un móvil; al recuperar una de 2 jugadores sale antes «Pasa el móvil»), Buscaminas, Solitario, Blackjack, Ruleta, Póker, Dados, Dominó, UNO y Parchís (en Parchís, el botón está junto a «Nueva partida»). Las partidas online no se guardan. La partida se guarda en el móvil (`partida_<juego>` en `localStorage`, vía `js/partida.js`) y se recupera sola al abrir ese juego tras volver a abrir la app, **una sola vez**: al recuperarla se borra (para tenerla otra vez hay que volver a pulsar Guardar). También se borra al terminar la partida o empezar otra. En **Ajedrez y Damas**, el 💾 hace lo mismo para todo el tablero (ajedrez, damas y personalizado, con relojes), y **⬇️ / ⬆️** guardan y cargan la partida en un archivo `.json` (si hay una partida iniciada, pregunta antes de sobrescribirla). Todo entra también en *Guardar/Cargar datos*.

**Contra la máquina en Ajedrez y Damas.** El selector **🤖 Rival** de cada tablero elige 2 jugadores o la máquina (fácil, normal o difícil) y con qué color juegas. En una partida online siempre juegan las dos personas. Los relojes se pausan al minimizar, cambiar de juego o de pestaña.

**Récords y pausas.** Tetris, Invaders y Pac-Man guardan la mejor puntuación; Buscaminas (por tamaño y minas) y Sudoku (por dificultad), el mejor tiempo; el Dominó, la mejor mano ganada contra la CPU. Al cambiar de pestaña o bloquear el móvil se pausa el juego visible, y el cronómetro del Sudoku sigue al volver. El Sudoku «experto» se genera al instante y siempre con 24 pistas. Se puede ampliar la página con dos dedos (sin zoom por doble toque).

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
js/games/pinball.js           Pinball espacial: mesa vertical con física propia (flippers, muelle, bumpers, dianas, agujero negro), sonidos con Web Audio
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
js/records.js                 récords (Tetris, Invaders, Pac-Man por puntos; Buscaminas y Sudoku por tiempo)
js/a11y.js                    accesibilidad: rol de botón, tabulador y Enter/Espacio en los botones <div>
js/opciones.js                ⚙ Opciones: detecta móvil/ordenador, control táctil (auto/activado/desactivado) y repetición de Tetris (DAS, ARR, SDF)
js/teclas.js                 reasignación de teclas común (Breakout, Pinball, 2048, Flappy, Hundir)
js/atras.js                  botón «atrás» del móvil: cierra la capa superior (modal, menú de inicio, conexión, ventana)
js/escala.js                 tamaño en ordenador: la interfaz se agranda según la altura de la pantalla (--ui); ventanas verticales (columna), anchas y completas (data-forma)
js/pasar-movil.js            «pasa el móvil»: tapa a pantalla completa para jugar varios en un mismo móvil
js/online/hundir-engine.js    Hundir la flota: reglas, árbitro e IA (sin DOM, con tests)
js/online/j-hundir.js         Hundir la flota online (el anfitrión es el árbitro)
js/online/uno-engine.js       UNO: baraja de 108, reglas, árbitro e IA (sin DOM, con tests)
js/online/j-uno.js            UNO online (el anfitrión es el árbitro y juega por las CPU)
js/games/uno.js               interfaz del UNO (CPU, pasar el móvil y online)
js/online/c4-engine.js        Conecta 4: reglas, árbitro e IA (sin DOM, con tests)
js/online/ttt-engine.js       Tres en raya: reglas, árbitro e IA perfecta (sin DOM, con tests)
js/games/duelo.js             interfaz común de los juegos de 2 jugadores por turnos (menú CPU / 2 en un móvil / online)
js/online/j-duelo.js          Conecta 4 y Tres en raya online (el anfitrión valida cada jugada)
js/online/domino-engine.js    Dominó: reglas (pozo, tranque, parejas, puntos), árbitro e IA (sin DOM, con tests)
js/games/domino.js            Dominó: mesa en serpiente, local de 2 a 4 (personas y CPU, «pasa el móvil») e interfaz online
js/online/j-domino.js         Dominó online (el anfitrión es el árbitro, reparte las manos en privado y juega por las CPU)
js/games/g2048-engine.js      2048: reglas puras (con tests)
js/games/mem-engine.js         Memoria (parejas): reglas puras (con tests)
js/games/wordle-engine.js      Wordle: evaluación de letras (repetidas como el original), palabra del día (con tests)
js/games/ahorcado-engine.js    Ahorcado: validar la palabra escrita, letras, fallos y vista pública sin la palabra (con tests)
js/games/ahorcado.js           Ahorcado: solo (palabras del Wordle), 2 jugadores en un móvil y la interfaz del online
js/online/j-ahorcado.js        Ahorcado online (el anfitrión guarda la palabra y arbitra los turnos)
js/games/wordle-palabras.js    palabras de 5 letras en español (≈1 600 soluciones y ≈9 300 válidas); diccionario MIT «an-array-of-spanish-words» y orden de frecuencia de «FrequencyWords»
sw.js, manifest.webmanifest, icons/   PWA
tests/                        pruebas
```

Si cambias archivos de la aplicación: sube `APP_VERSION` (y `APP_FECHA`) en `js/version.js` —de ahí salen la versión de los créditos y el nombre de la caché del service worker— y añade a `ARCHIVOS` de `sw.js` cualquier archivo nuevo (`tests/pwa.js` lo comprueba).

## Pruebas

`npm install` y después `npm run test:all` (necesita Chromium para las de navegador, con Playwright).

| Comando | Qué cubre |
|---|---|
| `npm test` | motores: UNO (baraja, cartas de acción, acumular, reto, «¡UNO!», puntos y 300 partidas de la IA), bingo (cartones, bombo, premios) y póquer (400 manos aleatorias, botes secundarios, conservación de fichas) |
| `npm run test:ui` | bingo local: Bolero con y sin cartones propios, recarga, marcas falsas, comprobar cartones |
| `npm run test:online` | Bolero (con cartón propio) + 3 jugadores en navegadores distintos usando el icono Multijugador: cartones numerados, comprobar, cantos y dos partidas completas |
| `npm run test:niveles` | niveles y dificultades de los juegos de arcade: Snake (4 dificultades), Invaders/Pac-Man/Frogger/Asteroids/Tetris (15 niveles) y Pong (10 niveles de CPU) |
| `npm run test:tetris` | control de Tetris: toque corto = 1 casilla, DAS/ARR, última dirección, caída, guardar, lock delay, pausa, gestos táctiles y Opciones (escritorio con botones plegados y sin gestos / móvil con ambos) |
| `npm run test:teclas` | teclas reasignables (defecto, reasignar, intercambio, restablecer, recarga) y Hundir jugado solo con teclado |
| `npm run test:atras` | botón «atrás» del móvil: minimiza juegos, cierra menú/modales, vuelve desde Conectar y sale sin capas |
| `npm run test:hundir` | Hundir la flota: colocación manual, partida contra la CPU y 2 jugadores en un móvil con la tapa «pasa el móvil» |
| `npm run test:hundir-online` | Hundir la flota online con 2 navegadores: reglas, colocación secreta, validación del anfitrión, privacidad, recarga, partida completa, rendición y revancha |
| `npm run test:guardar` | botón 💾 Guardar de Blackjack, Ruleta, Póker, Hundir la flota (CPU y 2 jugadores), Parchís y Dados: guarda, se recupera una sola vez al reabrir la app, se borra al terminar o con «Nueva partida» y la barra de menús cabe en 360 px |
| `npm run test:2048` | 2048: jugadas con teclado y ratón, deshacer, tamaños 4×4/5×5/6×6, victoria y récord por tamaño |
| `npm run test:breakout` | Breakout: 15 niveles de inicio, bot que rompe ladrillos, vidas y fin de partida |
| `npm run test:pinball` | Pinball: lanzador con muelle, flippers con teclado y con las mitades de la pantalla, bumpers y dianas, pausa, 3 bolas y récord |
| `npm run test:ahorcado` | Ahorcado: solo (palabra del Wordle, fallos, victoria, derrota y racha), 2 jugadores en un móvil (validar la palabra, pasar el móvil, marcador) y online con 3 navegadores (privacidad de la palabra, turnos, jugadas fuera de turno, puntos, siguiente ronda y recarga) |
| `npm run test:uno` | UNO: partida completa contra la CPU, guardar y recuperar, pasar el móvil con la tapa, y online con 2 navegadores + 1 CPU (privacidad de las manos, jugada imposible, recarga del anfitrión, final, revancha y lobby) |
| `npm run test:duelo` | Conecta 4 y Tres en raya: 2 jugadores en un móvil y contra la CPU en los 3 niveles |
| `npm run test:duelo-online` | Conecta 4 y Tres en raya online con 2 navegadores: turnos, jugadas ilegales ignoradas, victoria, recarga y revancha |
| `npm run test:domino` | Dominó local: contra 3 CPU por parejas hasta el final, guardar y recuperar, sin scroll horizontal y 2 personas + CPU en un móvil con «pasa el móvil» |
| `npm run test:domino-online` | Dominó online: 2 personas + 2 CPU por parejas, manos privadas, jugadas fuera de turno ignoradas, recarga del invitado, final y lobby; luego 3 personas sin CPU |
| `npm run test:fase4` | Memoria (parejas y 2 jugadores), Simon (bot), Flappy (bot) y Wordle (palabras, colores, estadísticas y recarga) |
| `npm run test:escritorio` | ordenador (1920×1080 y 1366×768): factor --ui, menú de inicio grande, juegos verticales que no se ensanchan, las 28 ventanas caben y el puntero funciona con el zoom; móvil sin cambios |
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

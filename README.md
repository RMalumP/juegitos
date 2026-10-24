# Juegos Windows XP

Escritorio estilo Windows XP con juegos clásicos (Buscaminas, Tetris, Ajedrez, Parchís, Póquer…), **Bingo** local y online, y la app **Sala online** para jugar con amigos cada uno desde su móvil. Es una PWA instalable y funciona sin conexión (el online necesita https y que los móviles se encuentren por internet una vez).

## Bingo

- **Un único modo Bolero** (local): bombo animado, tablero 1–90, voz que canta el número y modo automático. Puedes añadirte **cartones propios (0–6)**, que salen debajo y juegas a la vez que cantas las bolas. Con 0 cartones sirve para jugar con **cartones físicos**.
- **Cartones** españoles 3×9 (15 números), numerados (**Cartón Nº 7**, único en toda la sala), que se marcan a toque (o con marcado automático), con aviso de línea y bingo. Un canto falso **borra del cartón las casillas mal marcadas**.
- **Comprobar cartones**: el Bolero ve la lista de todos los cartones de la sala (número, jugador, cuánto les falta), abre cualquiera con las bolas salidas y su veredicto de línea y bingo, o escribe los números de un cartón físico.
- **Online**: un móvil es el **Bolero** (anfitrión, que también puede tener cartones propios) y los demás son **jugadores** (de 1 a 6 cartones cada uno). El anfitrión reparte los cartones, saca las bolas y comprueba cada «¡LÍNEA!» y «¡BINGO!» contra los cartones que él mismo ha repartido: nadie puede cantar en falso, tampoco él. Voz opcional y recuperación si alguien recarga la página (incluido el Bolero).
- **Compartir**: desde el bingo, **🔗 Compartir** y **▦ QR**. El enlace lleva sala y contraseña: quien lo abre solo escribe su nombre y entra directamente en el bingo.

## Multijugador en más juegos

Cada juego con online tiene un botón **🌐 Conectar** en su barra de menú que lleva al **lobby de ese juego** (la ventana Multijugador sirve para entrar por código o enlace). Una sala es de un único juego: quien entra desde el botón de otro juego recibe «es de otro juego».

| Juego | Jugadores por sala | Cómo funciona |
|---|---|---|
| Bingo | 2–25 | el anfitrión es el Bolero (puede tener cartones propios); ver arriba |
| Ajedrez | 2 (anfitrión + 1 invitado) | cada jugada se envía y se aplica con el motor del juego; el anfitrión valida turno y legalidad; color al azar (o elegido en el lobby), rendición, recarga |
| Damas | 2 | igual, con capturas múltiples |
| Parchís | 2–4 (+ bots opcionales) | el anfitrión ejecuta el motor y publica una «foto»; los invitados mandan «tirar» y «mover ficha N» |
| Ruleta | 2–6 | apuestas de cada jugador, giro común; pleno, color, par/impar, mitades, docenas y columnas |
| Blackjack | 2–4 | el anfitrión reparte y hace de banca; pedir, plantarse y doblar; la carta oculta de la banca nunca llega a los invitados |
| Póquer | 2–6 | Texas Hold'em con ciegas, subidas, all-in y botes secundarios; las cartas privadas llegan solo a su dueño |

Los motores de reglas de bingo y casino están en `js/bingo/engine.js` y `js/online/casino-engine.js` (sin DOM, con tests). Ajedrez, Damas y Parchís reutilizan los motores originales de sus iframes. Las fichas del casino son virtuales. El reloj de Ajedrez no se sincroniza entre móviles.

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
js/online/casino-engine.js    reglas de ruleta, blackjack y póquer (sin DOM)
js/online/qrcode.js           generador de QR (MIT)
js/pwa.js                     instalación, actualizaciones y accesos directos (?abrir=bingo | ?abrir=sala)
sw.js, manifest.webmanifest, icons/   PWA
tests/                        pruebas
```

Si cambias archivos de la aplicación: sube `VERSION` en `sw.js` y añade a `ARCHIVOS` cualquier archivo nuevo (`tests/pwa.js` lo comprueba).

## Pruebas

`npm install` y después `npm run test:all` (necesita Chromium para las de navegador, con Playwright).

| Comando | Qué cubre |
|---|---|
| `npm test` | motores: bingo (cartones, bombo, premios) y casino (ruleta, blackjack, póquer con 400 manos aleatorias y conservación de fichas) |
| `npm run test:ui` | bingo local: Bolero con y sin cartones propios, recarga, marcas falsas, comprobar cartones |
| `npm run test:online` | Bolero (con cartón propio) + 3 jugadores en navegadores distintos usando el icono Multijugador: cartones numerados, comprobar, cantos y dos partidas completas |
| `npm run test:enlace` | entrar por enlace solo con el nombre, símbolo con la barra plegada y que los iconos del escritorio no se solapen |
| `npm run test:reconexion` | un jugador y el Bolero recargan a mitad de partida |
| `npm run test:regresion` | todos los juegos del escritorio abren sin errores |
| `npm run test:salas` | las 6 salas por juego: botón Conectar, límite de jugadores, «sala llena», «es de otro juego» y empezar |
| `npm run test:tablero` | Ajedrez y Damas online: jugadas, turnos, jugadas ilegales, colores, rendición, recarga |
| `npm run test:parchis` | Parchís online: turnos, mismo tablero en ambos móviles, bots, recarga |
| `npm run test:casino` | Ruleta, Blackjack y Póquer online con 2 navegadores |
| `npm run test:turn` | credenciales TURN del Worker y respaldo solo con STUN si falla |
| `npm run test:pwa` | manifest, iconos, caché, sin conexión, botón de instalar y accesos directos |

Pendiente de probar con móviles reales: varios teléfonos en una misma wifi y wifi ↔ 4G con el relé (el Worker solo responde desde `https://rmalump.github.io`).

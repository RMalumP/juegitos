# Juegos Windows XP

Escritorio estilo Windows XP con juegos clásicos (Buscaminas, Tetris, Ajedrez, Parchís, Póquer…), **Bingo** local y online, y la app **Sala online** para jugar con amigos cada uno desde su móvil. Es una PWA instalable y funciona sin conexión (el online necesita https y que los móviles se encuentren por internet una vez).

## Bingo

- **Bolero (local)**: bombo animado, tablero 1–90, voz que canta el número, modo automático y «Comprobar cartón».
- **Mis cartones (local)**: cartones españoles 3×9 (15 números) que se marcan a toque, con aviso de línea y bingo.
- **Online**: un móvil es el **Bolero** (anfitrión) y los demás son **jugadores**. El anfitrión reparte los cartones (cada jugador elige de 1 a 6), saca las bolas y comprueba cada «¡LÍNEA!» y «¡BINGO!» contra los cartones que él mismo ha repartido: nadie puede cantar en falso. Marcado manual o automático, voz opcional y recuperación si alguien recarga la página (incluido el Bolero).

## Sala online (la conexión es una app)

El icono **📡 Sala online** del escritorio abre una ventana donde se crea o se entra en una sala con nombre + contraseña (también por **QR** o enlace). El símbolo **📶** de la barra inferior muestra el estado (gris sin sala, ámbar conectando, verde conectado) y abre la misma ventana. Los juegos no tienen pantalla de conexión propia: usan `window.Sala`.

Cómo funciona (adaptado de «La aldea se duerme» y «El Impostor»):

- WebRTC punto a punto con **PeerJS y solo STUN**. Sin Firebase, sin Cloudflare y sin TURN.
- El móvil del anfitrión hace de servidor: valida la contraseña, acepta o rechaza jugadores y envía a cada uno **solo lo suyo**.
- La sala es `SHA-256(nombre + contraseña)`: la contraseña nunca se guarda ni se envía.
- Misma wifi (o hotspot del anfitrión): conexión directa por la red local. El servidor público de PeerJS solo se usa para que los móviles se encuentren, así que hace falta internet al conectar.
- Limitaciones: sin TURN, algunas redes no permiten conectar (wifi con aislamiento de clientes, datos móviles con NAT de operador). Si el anfitrión cierra la pestaña la partida se detiene; si recarga, se recupera.

## Estructura

```
index.html                    escritorio, ventanas y barra de tareas
css/core.css, css/sala.css    estilos del escritorio · de la Sala online y la barra
css/games/*.css, js/games/*.js  un juego por archivo (se cargan al abrirlos: js/lazy-loader.js)
js/bingo/engine.js            reglas del bingo, sin DOM (con tests en Node)
js/games/bingo.js             interfaz del bingo (local y online)
js/online/sala.js             app «Sala online»: ventana, símbolo de la barra y API window.Sala
js/online/transport-peer.js   transporte PeerJS (solo STUN)
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
| `npm test` | motor del bingo: cartones válidos, bombo, premios, empates y 100 partidas simuladas |
| `npm run test:ui` | bingo local: bolero, cartones, recarga |
| `npm run test:online` | Bolero + 3 jugadores en navegadores distintos usando el icono Sala online, partida completa |
| `npm run test:reconexion` | un jugador y el Bolero recargan a mitad de partida |
| `npm run test:regresion` | todos los juegos del escritorio abren sin errores |
| `npm run test:pwa` | manifest, iconos, caché, sin conexión, botón de instalar y accesos directos |

Pendiente de probar con móviles reales: conexión entre varios teléfonos en una misma wifi.

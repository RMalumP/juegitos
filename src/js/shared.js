// Utilidades compartidas por varios juegos.

// Bucle de paso fijo: llama a `step` 60 veces por segundo de juego, sea cual
// sea la frecuencia de la pantalla (60, 90, 120, 144 Hz...). Sin esto, los
// juegos que avanzan "un paso por fotograma" van el doble de rápido a 120 Hz.
function makeFixedStep(step, hz = 60) {
  const STEP_MS = 1000 / hz;
  let last = null,
    acc = 0;
  return function run(now) {
    // Primer fotograma, o vuelta tras una pausa/pestaña oculta: un solo paso.
    if (last === null || now - last > 250) {
      last = now;
      acc = 0;
      step();
      return;
    }
    acc += now - last;
    last = now;
    while (acc >= STEP_MS) {
      acc -= STEP_MS;
      step();
    }
  };
}

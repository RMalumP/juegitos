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

// Récords guardados en este navegador. Para tiempos, `lowerIsBetter`.
// Devuelve el mejor valor tras registrar `value` y si es un récord nuevo.
function loadRecord(key) {
  try {
    let v = localStorage.getItem(`record:` + key);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function saveRecord(key, value, lowerIsBetter = false) {
  let prev = loadRecord(key),
    isNew =
      prev === null
        ? lowerIsBetter || value > 0
        : lowerIsBetter
          ? value < prev
          : value > prev;
  if (isNew)
    try {
      localStorage.setItem(`record:` + key, String(value));
    } catch {}
  return { best: isNew ? value : prev, isNew };
}
function recordText(rec, format = String) {
  return rec.isNew
    ? `🏆 ¡Nuevo récord!`
    : rec.best === null
      ? ``
      : `Récord: ` + format(rec.best);
}

// App instalable y sin conexión (solo cuando se sirve por http/https; abriendo
// el archivo directamente con file:// no hay service worker).
if (`serviceWorker` in navigator && location.protocol.startsWith(`http`))
  addEventListener(`load`, () => {
    navigator.serviceWorker.register(`sw.js`).catch(() => {});
  });

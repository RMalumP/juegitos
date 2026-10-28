/* records.js — Juegos XP: récords guardados en el móvil (localStorage, clave «record:<juego>») para Tetris, Invaders y Pac-Man (puntos),
   Buscaminas (por tamaño y minas) y Sudoku (por dificultad), estos dos por tiempo.
   saveRecord(clave, valor, menorEsMejor) registra el resultado y devuelve { best, isNew }; recordText(rec, formato) da el texto para la pantalla final. */
function loadRecord(key) {
  try { var v = localStorage.getItem('record:' + key); return v === null ? null : Number(v); } catch (e) { return null; }
}
function saveRecord(key, value, lowerIsBetter) {
  var prev = loadRecord(key),
    isNew = prev === null ? (lowerIsBetter || value > 0) : (lowerIsBetter ? value < prev : value > prev);
  if (isNew) try { localStorage.setItem('record:' + key, String(value)); } catch (e) { /* sin almacenamiento */ }
  return { best: isNew ? value : prev, isNew: isNew };
}
function recordText(rec, format) {
  format = format || String;
  return rec.isNew ? '🏆 ¡Nuevo récord!' : rec.best === null ? '' : 'Récord: ' + format(rec.best);
}

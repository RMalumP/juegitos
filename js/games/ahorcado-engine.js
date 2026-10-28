/* js/games/ahorcado-engine.js — Ahorcado: reglas puras (sin DOM; tests/ahorcado-engine.test.js). Lo usan la partida local (js/games/ahorcado.js)
   y la online (js/online/j-ahorcado.js, donde solo el anfitrión guarda la palabra y los demás reciben la vista pública).
   Palabras sin tildes en minúscula (la ñ es una letra); se admiten espacios entre palabras, que se ven desde el principio. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.AhorcadoEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MAX_FALLOS = 6, MIN_LETRAS = 2, MAX_LETRAS = 20, MAX_CARACTERES = 30;
  var ABC = 'abcdefghijklmnñopqrstuvwxyz';
  function normalizar(t) {
    return String(t || '').toLowerCase().replace(/ñ/g, '\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0001/g, 'ñ')
      .replace(/\s+/g, ' ').trim();
  }
  /* comprueba una palabra escrita por un jugador: devuelve { ok, palabra } o { ok: false, error } */
  function validar(t) {
    var p = normalizar(t), letras = p.replace(/ /g, '');
    if (!letras) return { ok: false, error: 'Escribe una palabra' };
    if (!/^[a-zñ ]+$/.test(p)) return { ok: false, error: 'Solo letras (sin números ni signos)' };
    if (letras.length < MIN_LETRAS) return { ok: false, error: 'Mínimo ' + MIN_LETRAS + ' letras' };
    if (letras.length > MAX_LETRAS || p.length > MAX_CARACTERES) return { ok: false, error: 'Máximo ' + MAX_LETRAS + ' letras' };
    return { ok: true, palabra: p };
  }
  function nuevo(palabra, max) { return { pal: palabra, letras: [], fallos: 0, max: max || MAX_FALLOS, fase: 'jugando' }; }
  function esLetra(l) { return typeof l === 'string' && l.length === 1 && ABC.indexOf(l) >= 0; }
  function completa(e) { return e.pal.split('').every(function (c) { return c === ' ' || e.letras.indexOf(c) >= 0; }); }
  /* prueba una letra: null si no vale (no es letra, ya probada o partida acabada); si no, { acierto, veces } */
  function probar(e, l) {
    if (e.fase !== 'jugando' || !esLetra(l) || e.letras.indexOf(l) >= 0) return null;
    e.letras.push(l);
    var veces = e.pal.split(l).length - 1;
    if (!veces) e.fallos++;
    if (completa(e)) e.fase = 'gana'; else if (e.fallos >= e.max) e.fase = 'pierde';
    return { acierto: veces > 0, veces: veces };
  }
  /* lo que se ve de la palabra: cada carácter es la letra si ya salió, '' si está oculta, o ' ' para un espacio (al acabar se ve entera) */
  function mascara(e) {
    return e.pal.split('').map(function (c) { return c === ' ' ? ' ' : (e.fase !== 'jugando' || e.letras.indexOf(c) >= 0) ? c : ''; });
  }
  /* vista pública (sin la palabra mientras se juega) */
  function publico(e) {
    var v = { mascara: mascara(e), letras: e.letras.slice(), fallos: e.fallos, max: e.max, fase: e.fase };
    if (e.fase !== 'jugando') v.palabra = e.pal;
    return v;
  }
  return { MAX_FALLOS: MAX_FALLOS, MIN_LETRAS: MIN_LETRAS, MAX_LETRAS: MAX_LETRAS, ABC: ABC, normalizar: normalizar, validar: validar, nuevo: nuevo, probar: probar, mascara: mascara, publico: publico, esLetra: esLetra };
});

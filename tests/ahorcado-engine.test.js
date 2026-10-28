// Motor del Ahorcado: validación de la palabra escrita, letras, fallos, final y vista pública sin la palabra.
const test = require('node:test');
const assert = require('node:assert');
const A = require('../js/games/ahorcado-engine.js');

test('Ahorcado: validar la palabra escrita por un jugador', () => {
  assert.deepStrictEqual(A.validar('  Árbol   Niño '), { ok: true, palabra: 'arbol niño' }, 'quita tildes y espacios de sobra, conserva la ñ');
  assert.strictEqual(A.validar('PINGÜINO').palabra, 'pinguino');
  assert.strictEqual(A.validar('').ok, false);
  assert.strictEqual(A.validar('a').ok, false, 'mínimo 2 letras');
  assert.strictEqual(A.validar('hola1').ok, false, 'sin números');
  assert.strictEqual(A.validar('¿qué?').ok, false, 'sin signos');
  assert.strictEqual(A.validar('a'.repeat(21)).ok, false, 'máximo 20 letras');
});

test('Ahorcado: aciertos, fallos repetidos y victoria', () => {
  const e = A.nuevo('casa');
  assert.deepStrictEqual(A.mascara(e), ['', '', '', '']);
  assert.deepStrictEqual(A.probar(e, 'a'), { acierto: true, veces: 2 });
  assert.deepStrictEqual(A.mascara(e), ['', 'a', '', 'a']);
  assert.strictEqual(A.probar(e, 'a'), null, 'una letra ya probada no vale');
  assert.strictEqual(A.probar(e, '1'), null);
  assert.strictEqual(A.probar(e, 'z').acierto, false); assert.strictEqual(e.fallos, 1);
  A.probar(e, 'c'); A.probar(e, 's');
  assert.strictEqual(e.fase, 'gana');
  assert.strictEqual(A.probar(e, 'b'), null, 'acabada, no se juega más');
});

test('Ahorcado: 6 fallos ahorcan; la vista pública no lleva la palabra hasta el final', () => {
  const e = A.nuevo('el niño');
  assert.deepStrictEqual(A.mascara(e), ['', '', ' ', '', '', '', ''], 'los espacios se ven desde el principio');
  A.probar(e, 'ñ');
  let v = A.publico(e);
  assert.strictEqual(v.palabra, undefined); assert.ok(!JSON.stringify(v).includes('niño'));
  'qwrtyu'.split('').forEach(l => A.probar(e, l));
  assert.strictEqual(e.fallos, 6); assert.strictEqual(e.fase, 'pierde');
  v = A.publico(e);
  assert.strictEqual(v.palabra, 'el niño'); assert.deepStrictEqual(v.mascara.join(''), 'el niño');
});

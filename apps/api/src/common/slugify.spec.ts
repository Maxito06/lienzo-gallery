import { slugify } from './slugify.js';

describe('slugify', () => {
  it.each([
    ['Óleo sobre lienzo', 'oleo-sobre-lienzo'],
    ['  Acuarela & tinta  ', 'acuarela-tinta'],
    ['Grabado—punta seca', 'grabado-punta-seca'],
    ['Dibujo 2', 'dibujo-2'],
    ['???', ''],
  ])('converts %j to %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

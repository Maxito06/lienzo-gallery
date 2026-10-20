import { cloudinaryImageUrl } from './cloudinary.config';

describe('cloudinaryImageUrl', () => {
  // La constante ya está rellenada; si algún día se vacía, la función devuelve null
  // y las miniaturas no se muestran.
  it('builds a Cloudinary delivery URL with the requested width', () => {
    expect(cloudinaryImageUrl('lienzo/artworks/abc', 240)).toMatch(
      /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/f_auto,q_auto,w_240\/lienzo\/artworks\/abc$/,
    );
  });
});

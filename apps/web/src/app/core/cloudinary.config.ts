// Nombre público de la nube de Cloudinary; no es un secreto. Max lo rellena.
export const CLOUDINARY_CLOUD_NAME = 'txpt4qqx';

// URL de entrega de una imagen, o null si falta configurar el nombre de la nube
export function cloudinaryImageUrl(publicId: string, width: number): string | null {
  if (!CLOUDINARY_CLOUD_NAME) {
    return null;
  }
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
}

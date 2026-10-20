import { createHash } from 'node:crypto';

// El Art Institute of Chicago pide identificar el proyecto con esta cabecera
// (https://api.artic.edu/docs/) y no más de una descarga por segundo.
const AIC_USER_AGENT =
  'lienzo-gallery-seed (https://github.com/Maxito06/lienzo-gallery)';

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadPreset: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function uploadImageFromUrl(
  imageUrl: string,
  config: CloudinaryConfig,
): Promise<string> {
  await sleep(1000);

  let file: Blob | string = imageUrl;
  const imageResponse = await fetch(imageUrl, {
    headers: { 'AIC-User-Agent': AIC_USER_AGENT },
  });
  if (imageResponse.ok) {
    file = await imageResponse.blob();
  } else {
    console.warn(
      `Descarga local rechazada (${imageResponse.status}); Cloudinary intentará descargarla: ${imageUrl}`,
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `timestamp=${timestamp}&upload_preset=${config.uploadPreset}`;
  const signature = createHash('sha1')
    .update(toSign + config.apiSecret)
    .digest('hex');

  const form = new FormData();
  if (typeof file === 'string') {
    form.append('file', file);
  } else {
    form.append('file', file, 'artwork.jpg');
  }
  form.append('api_key', config.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('upload_preset', config.uploadPreset);
  form.append('signature', signature);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    { method: 'POST', body: form },
  );
  const body = (await uploadResponse.json()) as {
    public_id?: string;
    error?: { message?: string };
  };
  if (!uploadResponse.ok || !body.public_id) {
    throw new Error(
      `Cloudinary rechazó la subida (${uploadResponse.status}): ${body.error?.message ?? 'sin detalle'}`,
    );
  }
  return body.public_id;
}

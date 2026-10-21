// Escena "En la pared": la foto de la obra se monta sobre una foto de sala a escala real.
// Calibración medida sobre la imagen de la sala (la proporción 1998×1115 se conserva en el archivo real):
// el sofá (210 cm) mide 965 px, su centro está en x=1012 px y el borde superior del respaldo en y=712 px.
// El escenario (4/3, overflow hidden) recorta la foto con width 142.6%, left -21.4%, top -6.2%.
export const ROOM_SCENE = {
  src: '/images/sala-demo.jpg',
  // Imagen decorativa: la descripción la lleva el contenedor
  alt: '',
  sofaWidthCm: 210,
  imageStyle: { width: 142.6, left: -21.4, top: -6.2 },
} as const;

// Porcentajes sobre el ancho del escenario (alto de la obra: aspect-ratio en CSS)
const WIDTH_PERCENT_PER_CM = 0.3288;
const CENTER_X_PERCENT = 50.9;
const BASE_Y_PERCENT = 50.5;
const BASE_Y_PERCENT_PER_CM = 0.4383;
const MIN_MARGIN_PERCENT = 3;
const MAX_WIDTH_PERCENT = 80;

export interface WallPlacement {
  left: number;
  top: number;
  width: number;
}

// Único punto donde las medidas (número, texto o decimal) pasan a número positivo; si no, null
export function toPositiveNumber(value: unknown): number | null {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number > 0 ? number : null;
}

export type WallPlacementStatus = 'ok' | 'missing' | 'too-large';

// Única regla de colocación: la comparten computeWallPlacement y wallPlacementStatus
function evaluate(
  widthCm: unknown,
  heightCm: unknown,
): { status: WallPlacementStatus; placement: WallPlacement | null } {
  const width = toPositiveNumber(widthCm);
  const height = toPositiveNumber(heightCm);
  if (width === null || height === null) {
    return { status: 'missing', placement: null };
  }
  const placement = {
    width: WIDTH_PERCENT_PER_CM * width,
    left: CENTER_X_PERCENT - (WIDTH_PERCENT_PER_CM / 2) * width,
    top: BASE_Y_PERCENT - BASE_Y_PERCENT_PER_CM * height,
  };
  if (
    placement.top < MIN_MARGIN_PERCENT ||
    placement.width > MAX_WIDTH_PERCENT ||
    placement.left < MIN_MARGIN_PERCENT
  ) {
    return { status: 'too-large', placement: null };
  }
  return { status: 'ok', placement };
}

// Devuelve null si faltan medidas o la obra no cabe en la pared
export function computeWallPlacement(widthCm: unknown, heightCm: unknown): WallPlacement | null {
  return evaluate(widthCm, heightCm).placement;
}

// Distingue 'sin medidas' de 'no cabe' para poder explicarlo
export function wallPlacementStatus(widthCm: unknown, heightCm: unknown): WallPlacementStatus {
  return evaluate(widthCm, heightCm).status;
}

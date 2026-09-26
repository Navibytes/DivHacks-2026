import type { Coords, DoneCallback, GridLayer } from "leaflet";

// OpenStreetMap tiles, recolored in the browser to match LocalLoop:
// land and roads get a soft, warm, muted look, water is painted a clear soft
// blue, and parks stay a soft green. (A CSS filter can't do this; it would
// grey the water and parks along with everything else.)

type Leaflet = typeof import("leaflet");
type RGB = [number, number, number];

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_WATER: RGB = [170, 211, 223]; // OSM's standard water color
const WATER_TOLERANCE = 6;
const LOCALLOOP_WATER: RGB = [156, 196, 219];

// Parks: any clearly green pixel gets a lighter mute, then is pulled toward this green.
const PARK_TINT: RGB = [178, 212, 164];
const PARK_TINT_STRENGTH = 0.45;

// Muted look = CSS grayscale(0.75) sepia(0.25) brightness(1.04) contrast(0.92).
const MUTE = multiply(sepia(0.25), grayscale(0.75));
const MUTE_PARK = multiply(sepia(0.12), grayscale(0.35));
const BRIGHTNESS = 1.04;
const CONTRAST = 0.92;

export function recoloredOsmLayer(leaflet: Leaflet): GridLayer {
  const RecoloredTiles = leaflet.GridLayer.extend({
    options: {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    createTile(coords: Coords, done: DoneCallback) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;

      const image = new Image();
      image.crossOrigin = "anonymous"; // OSM allows CORS, so we can read pixels
      image.onload = () => {
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, 256, 256);
          recolor(pixels.data);
          context.putImageData(pixels, 0, 0);
        }
        done(undefined, canvas);
      };
      image.onerror = () => done(new Error("Map tile failed to load"), canvas);
      image.src = TILE_URL.replace("{z}", String(coords.z))
        .replace("{x}", String(coords.x))
        .replace("{y}", String(coords.y));
      return canvas;
    },
  });

  return new RecoloredTiles() as GridLayer;
}

/** Rewrites RGBA pixel data in place. */
export function recolor(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (
      Math.abs(r - OSM_WATER[0]) <= WATER_TOLERANCE &&
      Math.abs(g - OSM_WATER[1]) <= WATER_TOLERANCE &&
      Math.abs(b - OSM_WATER[2]) <= WATER_TOLERANCE
    ) {
      data[i] = LOCALLOOP_WATER[0];
      data[i + 1] = LOCALLOOP_WATER[1];
      data[i + 2] = LOCALLOOP_WATER[2];
      continue;
    }

    const isPark = g > r + 8 && g > b + 8;
    const matrix = isPark ? MUTE_PARK : MUTE;
    for (let c = 0; c < 3; c++) {
      const muted = matrix[c][0] * r + matrix[c][1] * g + matrix[c][2] * b;
      let value = (muted * BRIGHTNESS - 127.5) * CONTRAST + 127.5;
      if (isPark) value = value * (1 - PARK_TINT_STRENGTH) + PARK_TINT[c] * PARK_TINT_STRENGTH;
      data[i + c] = value; // Uint8ClampedArray clamps to 0–255
    }
  }
}

// --- CSS filter matrices (https://www.w3.org/TR/filter-effects-1/) ---

type Matrix = [RGB, RGB, RGB];

function grayscale(amount: number): Matrix {
  const a = 1 - amount;
  return [
    [0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a],
    [0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a],
    [0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a],
  ];
}

function sepia(amount: number): Matrix {
  const a = 1 - amount;
  return [
    [0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a],
    [0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a],
    [0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a],
  ];
}

/** a × b, i.e. apply b first, then a. */
function multiply(a: Matrix, b: Matrix): Matrix {
  return a.map((row) =>
    [0, 1, 2].map((col) => row[0] * b[0][col] + row[1] * b[1][col] + row[2] * b[2][col]),
  ) as Matrix;
}

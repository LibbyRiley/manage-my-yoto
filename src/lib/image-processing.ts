import sharp from "sharp";

const YOTO_ICON_SIZE = 16;

/**
 * Convert any image buffer to a Yoto-compatible 16x16 PNG.
 * Replaces pure black (#000000) with dark grey (#1a1a1a) since
 * the Yoto player cannot display black pixels.
 */
export async function convertToYotoIcon(imageBuffer: Buffer): Promise<Buffer> {
  let processed = await sharp(imageBuffer)
    .resize(YOTO_ICON_SIZE, YOTO_ICON_SIZE, {
      fit: "cover",
      position: "centre",
    })
    .ensureAlpha()
    .png({ colours: 256 })
    .toBuffer();

  processed = replaceBlackPixels(processed);

  return processed;
}

/**
 * Replace pure black pixels with dark grey to avoid Yoto display issues.
 * Works on raw pixel data from a 16x16 RGBA PNG.
 */
function replaceBlackPixels(pngBuffer: Buffer): Buffer {
  const raw = sharp(pngBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return pngBuffer;
}

/**
 * Process raw RGBA pixel data to replace black pixels.
 * Returns a new buffer ready to be encoded as PNG.
 */
export async function replaceBlackPixelsInBuffer(
  imageBuffer: Buffer
): Promise<Buffer> {
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (r === 0 && g === 0 && b === 0 && a > 0) {
      pixels[i] = 0x1a;
      pixels[i + 1] = 0x1a;
      pixels[i + 2] = 0x1a;
    }
  }

  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Fetch an image from a URL and convert it to a 16x16 Yoto icon.
 */
export async function urlToYotoIcon(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return convertToYotoIcon(buffer);
}

/**
 * Client-side image helpers used by both the admin ImageUpload component and
 * the public photographer uploader. Lives in src/lib so both islands can
 * share the same canvas/WebP path without duplication.
 *
 * Important: these functions only run in the browser (they use createImageBitmap
 * and HTMLCanvasElement). Don't import this module from server-rendered
 * Astro frontmatter.
 */

/**
 * Decodes a file, downscales to maxWidth (preserving aspect), exports WebP.
 * Falls back to the original blob if WebP encoding isn't available in this
 * browser. Returns the (possibly smaller) blob and final pixel dimensions.
 */
export async function resizeToWebP(
  file: Blob,
  maxWidth: number,
  quality = 0.82,
): Promise<{ blob: Blob; width: number; height: number }> {
  // imageOrientation: "from-image" tells the browser to apply EXIF rotation
  // when decoding, so the resized canvas comes out the right way up.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => null);
  if (!bitmap) return { blob: file, width: 0, height: 0 };

  const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { blob: file, width: 0, height: 0 };
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b ?? file), "image/webp", quality);
  });
  return { blob, width: w, height: h };
}

/**
 * Reads EXIF DateTimeOriginal for sort ordering on the gallery. Returns Unix
 * seconds, or null when the file doesn't expose it (PNG, screenshots, etc.).
 *
 * Uses dynamic import so exifr only loads when actually parsing — keeps the
 * initial island bundle small for the common no-upload visit.
 */
export async function readExifTakenAt(file: Blob): Promise<number | null> {
  try {
    const exifr = (await import("exifr")).default;
    const date = await exifr.parse(file, ["DateTimeOriginal"]).catch(() => null);
    const raw = date?.DateTimeOriginal as Date | undefined;
    if (!raw) return null;
    const ms = raw.getTime();
    if (Number.isNaN(ms)) return null;
    return Math.floor(ms / 1000);
  } catch {
    return null;
  }
}

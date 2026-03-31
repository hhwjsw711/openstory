/**
 * Image Cropping via Cloudflare Image Resizing
 *
 * Instead of downloading grid images and cropping with WASM in-process,
 * returns a `/cdn-cgi/image/trim=T;R;B;L/` URL. Cloudflare crops at the
 * edge when the downstream service (e.g. FAL nano_banana_2) fetches it.
 *
 * Requires Image Resizing enabled on the Cloudflare zone.
 */

import type { ImageSize } from '@/lib/constants/aspect-ratios';

type CropTileOptions = {
  gridImageUrl: string;
  row: number; // 1-based (1 = top row)
  col: number; // 1-based (1 = left column)
  gridCols?: number; // total columns in grid (default 3)
  gridRows?: number; // total rows in grid (default 3)
  imageSize: ImageSize; // needed to calculate pixel dimensions
};

type CropTileResult = {
  url: string;
};

/**
 * Known tile dimensions per imageSize for fal.ai models.
 * These are the per-tile pixel dimensions — the full grid image is
 * (cols * tileWidth) x (rows * tileHeight).
 */
const TILE_DIMENSIONS: Record<ImageSize, { width: number; height: number }> = {
  landscape_16_9: { width: 1344, height: 768 },
  portrait_16_9: { width: 576, height: 1024 },
  square_hd: { width: 1024, height: 1024 },
};

/**
 * Crop a tile from a grid image using Cloudflare Image Resizing.
 * Returns a cdn-cgi/image/trim= URL instead of downloading and processing in-memory.
 */
export function cropTileFromGrid(options: CropTileOptions): CropTileResult {
  const {
    gridImageUrl,
    row,
    col,
    gridCols = 3,
    gridRows = 3,
    imageSize,
  } = options;

  if (row < 1 || row > gridRows || col < 1 || col > gridCols) {
    throw new Error(
      `Invalid tile position: row ${row}, col ${col}. Must be 1-${gridRows} and 1-${gridCols}.`
    );
  }

  const tile = TILE_DIMENSIONS[imageSize];
  const tileWidth = tile.width;
  const tileHeight = tile.height;

  // Calculate trim values (pixels to remove from each edge)
  const trimTop = tileHeight * (row - 1);
  const trimRight = tileWidth * (gridCols - col);
  const trimBottom = tileHeight * (gridRows - row);
  const trimLeft = tileWidth * (col - 1);

  const parsed = new URL(gridImageUrl);
  const trimUrl = `${parsed.origin}/cdn-cgi/image/trim=${trimTop};${trimRight};${trimBottom};${trimLeft}${parsed.pathname}`;

  return { url: trimUrl };
}

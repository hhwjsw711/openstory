/**
 * Image Cropping Utility
 * Uses @cf-wasm/photon (WASM-based) to crop tiles from grid images
 * Compatible with Cloudflare Workers (Sharp's native binaries don't work in workerd)
 */

import { PhotonImage, crop } from '@cf-wasm/photon';

type CropTileOptions = {
  gridImageUrl: string;
  row: number; // 1-3 (1 = top row)
  col: number; // 1-3 (1 = left column)
};

type CropTileResult = {
  buffer: Buffer;
  width: number;
  height: number;
};

/**
 * Crop a tile from a 3x3 grid image
 * @param options - Grid image URL and tile position (row/col 1-3)
 * @returns Promise resolving to cropped image buffer and dimensions
 */
export async function cropTileFromGrid(
  options: CropTileOptions
): Promise<CropTileResult> {
  const { gridImageUrl, row, col } = options;

  if (row < 1 || row > 3 || col < 1 || col > 3) {
    throw new Error(
      `Invalid tile position: row ${row}, col ${col}. Must be 1-3.`
    );
  }

  // Fetch the grid image
  const response = await fetch(gridImageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch grid image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const inputBytes = new Uint8Array(arrayBuffer);

  // Create PhotonImage instance from bytes
  const inputImage = PhotonImage.new_from_byteslice(inputBytes);

  try {
    // Get image dimensions
    const width = inputImage.get_width();
    const height = inputImage.get_height();

    // Calculate tile dimensions (each tile is 1/3 of grid)
    const tileWidth = Math.floor(width / 3);
    const tileHeight = Math.floor(height / 3);

    // Calculate crop coordinates (row/col are 1-indexed)
    // Photon crop takes (x1, y1, x2, y2) - top-left and bottom-right corners
    const x1 = (col - 1) * tileWidth;
    const y1 = (row - 1) * tileHeight;
    const x2 = x1 + tileWidth;
    const y2 = y1 + tileHeight;

    // Crop the tile
    const croppedImage = crop(inputImage, x1, y1, x2, y2);

    try {
      // Get PNG bytes
      const outputBytes = croppedImage.get_bytes();

      return {
        buffer: Buffer.from(outputBytes),
        width: tileWidth,
        height: tileHeight,
      };
    } finally {
      // Free cropped image memory
      croppedImage.free();
    }
  } finally {
    // Free input image memory
    inputImage.free();
  }
}

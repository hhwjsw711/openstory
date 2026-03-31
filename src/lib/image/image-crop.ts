/**
 * Image Cropping Utility
 * Uses @cf-wasm/photon (WASM-based) to crop tiles from grid images
 * Compatible with Cloudflare Workers (Sharp's native binaries don't work in workerd)
 */

import { PhotonImage, crop } from '@cf-wasm/photon';

type CropTileOptions = {
  gridImageUrl: string;
  row: number; // 1-based (1 = top row)
  col: number; // 1-based (1 = left column)
  gridCols?: number; // total columns in grid (default 3)
  gridRows?: number; // total rows in grid (default 3)
};

type CropTileResult = {
  buffer: Uint8Array;
  width: number;
  height: number;
};

/**
 * Crop a tile from a grid image with configurable dimensions
 * @param options - Grid image URL, tile position, and grid dimensions
 * @returns Promise resolving to cropped image buffer and dimensions
 */
export async function cropTileFromGrid(
  options: CropTileOptions
): Promise<CropTileResult> {
  const { gridImageUrl, row, col, gridCols = 3, gridRows = 3 } = options;

  if (row < 1 || row > gridRows || col < 1 || col > gridCols) {
    throw new Error(
      `Invalid tile position: row ${row}, col ${col}. Must be 1-${gridRows} and 1-${gridCols}.`
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

    // Calculate tile dimensions
    const tileWidth = Math.floor(width / gridCols);
    const tileHeight = Math.floor(height / gridRows);

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
        buffer: outputBytes,
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

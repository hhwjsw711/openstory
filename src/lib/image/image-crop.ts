/**
 * Image Cropping Utility
 * Uses Sharp to crop tiles from grid images
 */

import sharp from 'sharp';

export type CropTileOptions = {
  gridImageUrl: string;
  row: number; // 1-3 (1 = top row)
  col: number; // 1-3 (1 = left column)
};

export type CropTileResult = {
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
  const imageBuffer = Buffer.from(arrayBuffer);

  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Could not determine image dimensions');
  }

  // Calculate tile dimensions (each tile is 1/3 of grid)
  const tileWidth = Math.floor(metadata.width / 3);
  const tileHeight = Math.floor(metadata.height / 3);

  // Calculate offset (row/col are 1-indexed)
  const left = (col - 1) * tileWidth;
  const top = (row - 1) * tileHeight;

  // Extract the tile
  const croppedBuffer = await sharp(imageBuffer)
    .extract({
      left,
      top,
      width: tileWidth,
      height: tileHeight,
    })
    .png()
    .toBuffer();

  return {
    buffer: croppedBuffer,
    width: tileWidth,
    height: tileHeight,
  };
}

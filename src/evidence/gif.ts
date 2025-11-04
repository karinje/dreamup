/**
 * GIF recording from screenshots
 */

import { createWriteStream } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
// @ts-ignore - no types available
import GIFEncoder from 'gif-encoder-2';
import sharp from 'sharp';
import { logger } from '../utils/logger.js';
import type { Screenshot } from '../types/index.js';

interface GifOptions {
  width?: number;
  height?: number;
  quality?: number;
  delay?: number; // ms between frames
}

const DEFAULT_OPTIONS: Required<GifOptions> = {
  width: 800,
  height: 600,
  quality: 10, // 1 (best) to 20 (worst)
  delay: 500, // 500ms per frame = 2 FPS
};

/**
 * Create an animated GIF from screenshots
 */
export async function createGif(
  screenshots: Screenshot[],
  outputPath: string,
  options: GifOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (screenshots.length === 0) {
    logger.warn('No screenshots provided for GIF creation');
    return;
  }

  logger.info('Creating GIF from screenshots', {
    frames: screenshots.length,
    output: outputPath,
    width: opts.width,
    height: opts.height,
  });

  try {
    // Initialize encoder
    const encoder = new GIFEncoder(opts.width, opts.height);
    const stream = createWriteStream(outputPath);

    encoder.createReadStream().pipe(stream);
    encoder.start();
    encoder.setRepeat(0); // 0 = loop forever
    encoder.setDelay(opts.delay);
    encoder.setQuality(opts.quality);

    // Process each screenshot
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];

      logger.debug(`Adding frame ${i + 1}/${screenshots.length}`, {
        path: screenshot.path,
      });

      try {
        // Read and resize image
        const imageBuffer = await readFile(screenshot.path);
        const resized = await sharp(imageBuffer)
          .resize(opts.width, opts.height, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        // Add frame to GIF
        encoder.addFrame(resized.data);
      } catch (error) {
        logger.warn(`Failed to add frame ${i + 1}, skipping`, {
          error: (error as Error).message,
          path: screenshot.path,
        });
        // Continue with other frames
      }
    }

    encoder.finish();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    logger.info('GIF created successfully', {
      path: outputPath,
      frames: screenshots.length,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create GIF', err);
    throw new Error(`GIF creation failed: ${err.message}`);
  }
}

/**
 * Create a GIF filename based on session directory
 */
export function getGifPath(sessionDir: string): string {
  const timestamp = path.basename(sessionDir).replace(/_/g, '-');
  return path.join(sessionDir, `gameplay-${timestamp}.gif`);
}

/**
 * Get optimal GIF dimensions based on screenshot size
 */
export async function getOptimalDimensions(
  screenshotPath: string
): Promise<{ width: number; height: number }> {
  try {
    const metadata = await sharp(screenshotPath).metadata();
    const width = metadata.width || DEFAULT_OPTIONS.width;
    const height = metadata.height || DEFAULT_OPTIONS.height;

    // Scale down if too large (max 1200px wide)
    if (width > 1200) {
      const scale = 1200 / width;
      return {
        width: 1200,
        height: Math.round(height * scale),
      };
    }

    return { width, height };
  } catch (error) {
    logger.warn('Failed to get image dimensions, using defaults', {
      error: (error as Error).message,
    });
    return {
      width: DEFAULT_OPTIONS.width,
      height: DEFAULT_OPTIONS.height,
    };
  }
}


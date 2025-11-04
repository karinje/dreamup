/**
 * Screenshot capture utilities
 */

import * as path from 'path';
import { getBrowser } from '../agent/browser.js';
import { logger } from '../utils/logger.js';
import { retry, SCREENSHOT_RETRY } from '../utils/retry.js';
import { ScreenshotError } from '../utils/errors.js';
import { saveFile } from './storage.js';
import { Screenshot, GamePhase } from '../types/index.js';

/**
 * Generate a screenshot filename with timestamp
 */
function generateScreenshotFilename(action?: string, phase?: GamePhase): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = phase || 'screenshot';
  const actionSuffix = action ? `_${action.replace(/[^a-zA-Z0-9]/g, '_')}` : '';

  return `${prefix}_${timestamp}${actionSuffix}.png`;
}

/**
 * Capture a screenshot and save it to disk
 *
 * @param sessionDir - Session directory to save the screenshot
 * @param action - Optional description of the action that triggered this screenshot
 * @param phase - Optional game phase
 * @returns Screenshot metadata
 */
export async function captureScreenshot(
  sessionDir: string,
  action?: string,
  phase?: GamePhase
): Promise<Screenshot> {
  const filename = generateScreenshotFilename(action, phase);
  const filepath = path.join(sessionDir, 'screenshots', filename);

  logger.debug('Capturing screenshot', { filename, action, phase });

  const captureOperation = async (): Promise<Screenshot> => {
    try {
      const stagehand = getBrowser();
      const screenshot = await stagehand.page.screenshot({
        type: 'png',
        fullPage: false, // Only visible viewport
      });

      await saveFile(filepath, screenshot);

      const metadata: Screenshot = {
        path: filepath,
        timestamp: new Date().toISOString(),
        action,
        phase,
      };

      logger.info('Screenshot captured', {
        path: filepath,
        size: screenshot.length,
      });

      return metadata;
    } catch (error) {
      const err = error as Error;
      logger.error('Screenshot capture failed', err);
      throw new ScreenshotError(`Failed to capture screenshot: ${err.message}`);
    }
  };

  // Retry screenshot capture
  return retry(captureOperation, SCREENSHOT_RETRY);
}

/**
 * Capture multiple screenshots at intervals during an action
 *
 * @param sessionDir - Session directory
 * @param action - Action description
 * @param phase - Game phase
 * @param count - Number of screenshots to take
 * @param intervalMs - Interval between screenshots in milliseconds
 */
export async function captureScreenshotSequence(
  sessionDir: string,
  action: string,
  phase: GamePhase,
  count: number,
  intervalMs: number = 1000
): Promise<Screenshot[]> {
  const screenshots: Screenshot[] = [];

  logger.debug('Capturing screenshot sequence', { count, intervalMs });

  for (let i = 0; i < count; i++) {
    try {
      const screenshot = await captureScreenshot(sessionDir, `${action}_${i + 1}`, phase);
      screenshots.push(screenshot);

      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    } catch (error) {
      logger.warn('Failed to capture screenshot in sequence', { index: i });
      // Continue with remaining screenshots
    }
  }

  return screenshots;
}

/**
 * Convert screenshot to base64 for LLM analysis
 */
export async function screenshotToBase64(filepath: string): Promise<string> {
  try {
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(filepath);
    return buffer.toString('base64');
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to convert screenshot to base64', err, { filepath });
    throw new ScreenshotError(`Failed to read screenshot: ${err.message}`);
  }
}

/**
 * Get screenshot dimensions
 */
export async function getScreenshotDimensions(
  filepath: string
): Promise<{ width: number; height: number }> {
  try {
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(filepath);

    // PNG signature check
    if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
      throw new Error('Invalid PNG file');
    }

    // Read IHDR chunk (bytes 16-23 contain width and height)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    return { width, height };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get screenshot dimensions', err, { filepath });
    throw new ScreenshotError(`Failed to read screenshot dimensions: ${err.message}`);
  }
}

/**
 * Calculate total size of all screenshots
 */
export async function getScreenshotsSize(screenshots: Screenshot[]): Promise<number> {
  let totalSize = 0;

  for (const screenshot of screenshots) {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(screenshot.path);
      totalSize += stats.size;
    } catch (error) {
      logger.warn('Failed to get screenshot size', { path: screenshot.path });
    }
  }

  return totalSize;
}

/**
 * Format screenshot paths for report (relative to session directory)
 */
export function formatScreenshotPaths(
  screenshots: Screenshot[],
  sessionDir: string
): string[] {
  return screenshots.map((s) => path.relative(sessionDir, s.path));
}


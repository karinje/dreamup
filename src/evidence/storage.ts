/**
 * Artifact file management
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { FileSystemError } from '../utils/errors.js';

/**
 * Ensure a directory exists, create if it doesn't
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    logger.debug('Creating directory', { path: dirPath });
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Create a test session directory structure
 *
 * @param outputDir - Base output directory
 * @param gameUrl - Game URL to create a safe directory name
 * @returns Path to the session directory
 */
export async function createSessionDirectory(
  outputDir: string,
  gameUrl: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Create a safe directory name from the URL
  const urlSafe = gameUrl
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);

  const sessionDir = path.join(outputDir, `${urlSafe}_${timestamp}`);

  logger.info('Creating session directory', { path: sessionDir });

  try {
    await ensureDirectory(outputDir);
    await ensureDirectory(sessionDir);

    // Create subdirectories
    await ensureDirectory(path.join(sessionDir, 'screenshots'));
    await ensureDirectory(path.join(sessionDir, 'logs'));

    logger.debug('Session directory structure created', { sessionDir });
    return sessionDir;
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create session directory', err);
    throw new FileSystemError(`Failed to create session directory: ${err.message}`, sessionDir);
  }
}

/**
 * Save a file to disk
 */
export async function saveFile(filePath: string, content: string | Buffer): Promise<void> {
  try {
    logger.debug('Saving file', { path: filePath });

    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    await ensureDirectory(dir);

    await fs.writeFile(filePath, content);

    logger.debug('File saved successfully', { path: filePath });
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to save file', err, { path: filePath });
    throw new FileSystemError(`Failed to save file: ${err.message}`, filePath);
  }
}

/**
 * Read a file from disk
 */
export async function readFile(filePath: string): Promise<Buffer> {
  try {
    logger.debug('Reading file', { path: filePath });
    return await fs.readFile(filePath);
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to read file', err, { path: filePath });
    throw new FileSystemError(`Failed to read file: ${err.message}`, filePath);
  }
}

/**
 * Save JSON data to a file
 */
export async function saveJSON(filePath: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  await saveFile(filePath, json);
}

/**
 * Read JSON data from a file
 */
export async function readJSON<T>(filePath: string): Promise<T> {
  const buffer = await readFile(filePath);
  return JSON.parse(buffer.toString('utf-8')) as T;
}

/**
 * List files in a directory
 */
export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dirPath);
    return files;
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list files', err, { path: dirPath });
    throw new FileSystemError(`Failed to list files: ${err.message}`, dirPath);
  }
}

/**
 * Delete a file
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    logger.debug('File deleted', { path: filePath });
  } catch (error) {
    const err = error as Error;
    logger.warn('Failed to delete file', { path: filePath, error: err.message });
    // Don't throw - cleanup is optional
  }
}

/**
 * Delete a directory recursively
 */
export async function deleteDirectory(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    logger.debug('Directory deleted', { path: dirPath });
  } catch (error) {
    const err = error as Error;
    logger.warn('Failed to delete directory', { path: dirPath, error: err.message });
    // Don't throw - cleanup is optional
  }
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    const err = error as Error;
    throw new FileSystemError(`Failed to get file size: ${err.message}`, filePath);
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get relative path from base directory
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * Join path segments
 */
export function joinPath(...segments: string[]): string {
  return path.join(...segments);
}


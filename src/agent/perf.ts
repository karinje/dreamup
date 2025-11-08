// Performance tracking utilities for DreamUp QA agent
import { getBrowser } from './browser.js';
import { logger } from '../utils/logger.js';

export type PerformanceMode = 'normal' | 'pause' | 'quick';

export interface InteractionSample {
  label: string;
  durationMs: number;
  keys?: string[];
  timestamp: number;
}

export interface InteractionStats {
  sampleCount: number;
  avgMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  samples: InteractionSample[];
}

export interface BrowserPerformanceSnapshot {
  mode?: PerformanceMode | 'unknown';
  navigation?: {
    timeToFirstByte?: number;
    domContentLoaded?: number;
    firstPaint?: number | null;
    firstContentfulPaint?: number | null;
    loadEvent?: number;
  };
  fps?: {
    average?: number | null;
    minimum?: number | null;
    maximum?: number | null;
    samplesCollected: number;
    droppedFrames: number;
  };
  longTasks?: {
    count: number;
    totalBlockingTime: number;
  };
  slowResources?: Array<{
    name: string;
    duration: number;
    transferSize?: number;
    initiatorType?: string;
    encodedBodySize?: number;
  }>;
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null;
}

const instrumentedStagehands = new WeakSet<object>();

/**
 * Prepare the page to collect performance metrics. Should be called before navigation.
 */
export async function preparePerformanceHooks(): Promise<void> {
  const stagehand = getBrowser();

  if (instrumentedStagehands.has(stagehand as unknown as object)) {
    return;
  }

  instrumentedStagehands.add(stagehand as unknown as object);

  await stagehand.page.addInitScript(() => {
    const w = window as any;
    w.__dreamupMetrics = w.__dreamupMetrics || {};

    if (typeof w.__name !== 'function') {
      try {
        Object.defineProperty(w, '__name', {
          value: (fn: any, name: string) => {
            if (typeof fn === 'function' && typeof name === 'string') {
              try {
                Object.defineProperty(fn, 'name', { value: name, configurable: true });
              } catch {
                // Ignore if unable to redefine
              }
            }
            return fn;
          },
          configurable: true,
          writable: true,
        });
      } catch {
        w.__name = (fn: any) => fn;
      }
    }

    const metrics = w.__dreamupMetrics;
    metrics.longTasks = metrics.longTasks || 0;
    metrics.longTaskDuration = metrics.longTaskDuration || 0;
    metrics.mode = metrics.mode || 'unknown';

    if (!metrics.__longTaskObserverAttached && typeof PerformanceObserver !== 'undefined') {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          metrics.longTasks += entries.length;
          metrics.longTaskDuration += entries.reduce((sum: number, entry: any) => sum + (entry.duration || 0), 0);
        });
        observer.observe({ entryTypes: ['longtask'] });
        metrics.__longTaskObserverAttached = true;
      } catch (error) {
        // ignore if observer not supported
      }
    }
  });
}

/**
 * Begin sampling FPS using requestAnimationFrame.
 */
export async function startFpsSampling(sampleLimit = 600): Promise<void> {
  try {
    const stagehand = getBrowser();
    await stagehand.page.evaluate((limit) => {
      const value = typeof limit === 'number' && Number.isFinite(limit) ? limit : 600;
      const script = `
        (function() {
          var w = window;
          w.__dreamupMetrics = w.__dreamupMetrics || {};
          var metrics = w.__dreamupMetrics;
          var samples = [];
          metrics.fpsSamples = samples;
          metrics._fpsActive = true;
          metrics._fpsLimit = ${value};
          var last = performance.now();

          function loop(now) {
            if (!metrics._fpsActive) {
              return;
            }
            var delta = now - last;
            last = now;
            samples.push(delta);
            if (samples.length < ${value}) {
              requestAnimationFrame(loop);
            } else {
              metrics._fpsActive = false;
            }
          }

          requestAnimationFrame(loop);
        })();
      `;
      window.eval(script);
    }, sampleLimit);
  } catch (error) {
    logger.warn('Failed to start FPS sampling', { error: (error as Error).message });
  }
}

/**
 * Stop the FPS sampler (if running).
 */
export async function stopFpsSampling(): Promise<void> {
  try {
    const stagehand = getBrowser();
    await stagehand.page.evaluate(() => {
      const w = window as any;
      if (!w.__dreamupMetrics) return;
      w.__dreamupMetrics._fpsActive = false;
    });
  } catch (error) {
    logger.debug('Failed to stop FPS sampling', { error: (error as Error).message });
  }
}

/**
 * Update the current performance mode (for context: normal/pause/quick).
 */
export async function setPerformanceMode(mode: PerformanceMode): Promise<void> {
  try {
    const stagehand = getBrowser();
    await stagehand.page.evaluate((value) => {
      const w = window as any;
      w.__dreamupMetrics = w.__dreamupMetrics || {};
      w.__dreamupMetrics.mode = value;
    }, mode);
  } catch (error) {
    logger.debug('Failed to set performance mode', { error: (error as Error).message, mode });
  }
}

/**
 * Collect navigation timing, FPS, long-task, and resource metrics from the browser.
 */
export async function collectBrowserPerformanceData(resourceThresholdMs = 1000): Promise<BrowserPerformanceSnapshot> {
  try {
    const stagehand = getBrowser();
    const data = await stagehand.page.evaluate((threshold) => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const firstPaint = performance.getEntriesByName('first-paint')[0] as PerformanceEntry | undefined;
      const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint')[0] as PerformanceEntry | undefined;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const w = window as any;
      const metrics = w.__dreamupMetrics || {};
      const fpsSamples: number[] = metrics.fpsSamples || [];

      let fpsStats: {
        average?: number | null;
        minimum?: number | null;
        maximum?: number | null;
        droppedFrames: number;
        samplesCollected: number;
      } | null = null;

      if (fpsSamples.length > 0) {
        let sum = 0;
        let minDelta = Number.POSITIVE_INFINITY;
        let maxDelta = 0;
        let dropped = 0;

        for (let i = 0; i < fpsSamples.length; i++) {
          const delta = fpsSamples[i];
          sum += delta;
          if (delta < minDelta) minDelta = delta;
          if (delta > maxDelta) maxDelta = delta;
          if (delta > 34) dropped++;
        }

        function toFps(delta: number): number | null {
          return delta > 0 ? 1000 / delta : null;
        }

        const avgDelta = sum / fpsSamples.length;

        fpsStats = {
          average: toFps(avgDelta),
          minimum: toFps(maxDelta),
          maximum: toFps(minDelta),
          droppedFrames: dropped,
          samplesCollected: fpsSamples.length,
        };
      }

      const slowResources = resources
        .filter((entry) => entry.duration >= threshold)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 25)
        .map((entry) => ({
          name: entry.name,
          duration: entry.duration,
          transferSize: (entry as any).transferSize,
          initiatorType: entry.initiatorType,
          encodedBodySize: entry.encodedBodySize,
        }));

      const memory = (performance as any).memory
        ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
          }
        : null;

      return {
        mode: metrics.mode,
        navigation: nav
          ? {
              timeToFirstByte: nav.responseStart - nav.startTime,
              domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
              firstPaint: firstPaint ? firstPaint.startTime : null,
              firstContentfulPaint: firstContentfulPaint ? firstContentfulPaint.startTime : null,
              loadEvent: nav.loadEventEnd - nav.startTime,
            }
          : undefined,
        fps: fpsStats || undefined,
        longTasks: {
          count: metrics.longTasks || 0,
          totalBlockingTime: metrics.longTaskDuration || 0,
        },
        slowResources,
        memory,
      } as BrowserPerformanceSnapshot;
    }, resourceThresholdMs);

    return data;
  } catch (error) {
    logger.warn('Failed to collect browser performance data', { error: (error as Error).message });
    return {};
  }
}

/**
 * Tracks interaction latency metrics within the Node.js runtime.
 */
export class PerformanceTracker {
  private samples: InteractionSample[] = [];
  private mode: PerformanceMode = 'normal';

  constructor(initialMode: PerformanceMode = 'normal') {
    this.mode = initialMode;
  }

  setMode(mode: PerformanceMode) {
    this.mode = mode;
  }

  recordInteraction(sample: Omit<InteractionSample, 'timestamp'>) {
    const entry: InteractionSample = {
      ...sample,
      timestamp: Date.now(),
    };
    this.samples.push(entry);
  }

  summarize(): InteractionStats {
    if (!this.samples.length) {
      return {
        sampleCount: 0,
        avgMs: null,
        minMs: null,
        maxMs: null,
        samples: [],
      };
    }

    const durations = this.samples.map((s) => s.durationMs);
    const total = durations.reduce((sum, val) => sum + val, 0);
    const avg = total / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    // Keep only the first 25 samples for report (avoid huge payloads)
    const trimmedSamples = this.samples.slice(0, 25);

    return {
      sampleCount: this.samples.length,
      avgMs: avg,
      minMs: min,
      maxMs: max,
      samples: trimmedSamples,
    };
  }

  getMode(): PerformanceMode {
    return this.mode;
  }
}

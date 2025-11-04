/**
 * Programmatic API exports for Lambda integration
 */

export { runQA } from './index.js';
export type { QAReport, QAOptions, TestConfig, Issue, TestMetadata } from './types/index.js';

/**
 * Lambda handler example (can be imported by users)
 */
export async function createLambdaHandler() {
  const { runQA } = await import('./index.js');

  return async (event: { gameUrl: string; options?: any }) => {
    try {
      const { gameUrl, options } = event;

      if (!gameUrl) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'gameUrl is required' }),
        };
      }

      const report = await runQA(gameUrl, options);

      return {
        statusCode: 200,
        body: JSON.stringify(report),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Test execution failed',
          message: (error as Error).message,
        }),
      };
    }
  };
}


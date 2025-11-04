/**
 * Example AWS Lambda handler for DreamUp QA Agent
 */

import { runQA, QAReport } from '../src/api.js';

/**
 * Lambda event interface
 */
interface QAEvent {
  gameUrl: string;
  maxExecutionTime?: number;
  screenshotCount?: number;
  outputDir?: string;
}

/**
 * Lambda response interface
 */
interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * AWS Lambda handler function
 */
export async function handler(event: QAEvent): Promise<LambdaResponse> {
  console.log('QA Agent Lambda invoked', { gameUrl: event.gameUrl });

  try {
    // Validate input
    if (!event.gameUrl) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'gameUrl is required',
        }),
      };
    }

    // Validate URL format
    try {
      new URL(event.gameUrl);
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid URL format',
        }),
      };
    }

    // Run QA test
    const report: QAReport = await runQA(event.gameUrl, {
      maxExecutionTime: event.maxExecutionTime,
      screenshotCount: event.screenshotCount,
      outputDir: event.outputDir,
      verbose: false, // Disable verbose logging in Lambda
    });

    // Return success response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    };
  } catch (error) {
    console.error('QA test failed', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: (error as Error).message,
      }),
    };
  }
}

/**
 * Example usage for local testing
 */
async function testLocally() {
  const event: QAEvent = {
    gameUrl: 'https://example.com/game',
    maxExecutionTime: 180000, // 3 minutes
    screenshotCount: 5,
  };

  const response = await handler(event);
  console.log('Response:', JSON.parse(response.body));
}

// Uncomment to test locally
// testLocally();


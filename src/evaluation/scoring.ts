/**
 * Playability score calculation
 */

import { logger } from '../utils/logger.js';
import { LLMEvaluation, Issue, IssueSeverity, LogEntry, ScoreBreakdown } from '../types/index.js';

/**
 * Weight factors for playability score calculation
 */
const SCORE_WEIGHTS = {
  loadSuccess: 0.3,
  controls: 0.3,
  stability: 0.3,
  uiVisibility: 0.1,
};

/**
 * Issue severity impact on score
 */
const SEVERITY_PENALTIES: Record<IssueSeverity, number> = {
  critical: 30,
  high: 15,
  medium: 7,
  low: 3,
};

/**
 * Calculate playability score from LLM evaluation
 *
 * Score is 0-100, where:
 * - 80-100: Excellent playability
 * - 60-79: Good playability with minor issues
 * - 40-59: Playable but with significant issues
 * - 20-39: Barely playable, major problems
 * - 0-19: Not playable
 */
export function calculatePlayabilityScore(evaluation: LLMEvaluation, issues: Issue[]): number {
  const breakdown = calculatePlayabilityScoreWithBreakdown(evaluation, issues);
  return breakdown.final_score;
}

/**
 * Calculate playability score with detailed breakdown
 */
export function calculatePlayabilityScoreWithBreakdown(
  evaluation: LLMEvaluation, 
  issues: Issue[]
): ScoreBreakdown {
  logger.debug('Calculating playability score with breakdown');

  // Calculate base scores
  const baseScores = {
    load_success: evaluation.loaded_successfully ? 100 * SCORE_WEIGHTS.loadSuccess : 0,
    controls: evaluation.controls_responsive ? 100 * SCORE_WEIGHTS.controls : 0,
    stability: evaluation.game_stable ? 100 * SCORE_WEIGHTS.stability : 0,
    ui_visibility: evaluation.ui_visible ? 100 * SCORE_WEIGHTS.uiVisibility : 0,
  };

  const totalBase = Object.values(baseScores).reduce((sum, val) => sum + val, 0);

  // Calculate issue penalties
  const issuePenalties = {
    critical: issues.filter(i => i.severity === 'critical').length * SEVERITY_PENALTIES.critical,
    high: issues.filter(i => i.severity === 'high').length * SEVERITY_PENALTIES.high,
    medium: issues.filter(i => i.severity === 'medium').length * SEVERITY_PENALTIES.medium,
    low: issues.filter(i => i.severity === 'low').length * SEVERITY_PENALTIES.low,
    total: 0,
  };
  issuePenalties.total = issuePenalties.critical + issuePenalties.high + issuePenalties.medium + issuePenalties.low;

  const afterPenalties = totalBase - issuePenalties.total;

  // Apply confidence factor
  const finalScore = Math.max(0, Math.min(100, Math.round(afterPenalties * evaluation.confidence)));

  const breakdown: ScoreBreakdown = {
    base_scores: baseScores,
    total_base: Math.round(totalBase),
    issue_penalties: issuePenalties,
    after_penalties: Math.round(afterPenalties),
    confidence_factor: Math.round(evaluation.confidence * 100),
    final_score: finalScore,
  };

  logger.info('Playability score calculated', { score: finalScore, breakdown });

  return breakdown;
}

/**
 * Calculate overall confidence score
 */
export function calculateConfidenceScore(evaluation: LLMEvaluation, errorCount: number): number {
  let confidence = evaluation.confidence;

  // Reduce confidence if there are many errors
  if (errorCount > 20) {
    confidence *= 0.7;
  } else if (errorCount > 10) {
    confidence *= 0.85;
  } else if (errorCount > 5) {
    confidence *= 0.95;
  }

  // Clamp to 0-1 and convert to 0-100
  confidence = Math.max(0, Math.min(1, confidence)) * 100;

  return Math.round(confidence);
}

/**
 * Generate issues from LLM evaluation and logs
 */
export function generateIssues(
  evaluation: LLMEvaluation,
  errorLogs: LogEntry[]
): Issue[] {
  const issues: Issue[] = [];
  const timestamp = new Date().toISOString();

  // Critical issue: Game didn't load
  if (!evaluation.loaded_successfully) {
    issues.push({
      severity: 'critical',
      description: 'Game failed to load successfully',
      category: 'load',
      timestamp,
    });
  }

  // High issue: Controls not responsive
  if (!evaluation.controls_responsive) {
    issues.push({
      severity: 'high',
      description: 'Game controls are not responsive to user input',
      category: 'controls',
      timestamp,
    });
  }

  // High issue: Game not stable
  if (!evaluation.game_stable) {
    issues.push({
      severity: 'high',
      description: 'Game stability issues detected (crashes or freezes)',
      category: 'stability',
      timestamp,
    });
  }

  // Medium issue: UI not visible
  if (!evaluation.ui_visible) {
    issues.push({
      severity: 'medium',
      description: 'Game UI elements not properly visible',
      category: 'ui',
      timestamp,
    });
  }

  // Add issues from LLM observations
  for (const issueText of evaluation.issues) {
    issues.push({
      severity: determineIssueSeverity(issueText),
      description: issueText,
      category: categorizeIssue(issueText),
      timestamp,
    });
  }

  // Add console errors as issues (only most severe ones)
  const criticalErrors = errorLogs
    .filter((log) => 
      log.message.toLowerCase().includes('uncaught') ||
      log.message.toLowerCase().includes('fatal') ||
      log.message.toLowerCase().includes('crash')
    )
    .slice(0, 3);

  for (const error of criticalErrors) {
    issues.push({
      severity: 'high',
      description: `Console error: ${error.message.substring(0, 100)}`,
      category: 'stability',
      timestamp: error.timestamp,
    });
  }

  logger.info('Generated issues', { count: issues.length });

  return issues;
}

/**
 * Determine issue severity from description
 */
function determineIssueSeverity(description: string): IssueSeverity {
  const lower = description.toLowerCase();

  if (
    lower.includes('crash') ||
    lower.includes('fatal') ||
    lower.includes('not load') ||
    lower.includes('broken')
  ) {
    return 'critical';
  }

  if (
    lower.includes('unresponsive') ||
    lower.includes('freeze') ||
    lower.includes('error') ||
    lower.includes('fail')
  ) {
    return 'high';
  }

  if (
    lower.includes('slow') ||
    lower.includes('delay') ||
    lower.includes('glitch') ||
    lower.includes('bug')
  ) {
    return 'medium';
  }

  return 'low';
}

/**
 * Categorize issue based on description
 */
function categorizeIssue(description: string): Issue['category'] {
  const lower = description.toLowerCase();

  if (lower.includes('load') || lower.includes('start')) {
    return 'load';
  }

  if (lower.includes('control') || lower.includes('input') || lower.includes('responsive')) {
    return 'controls';
  }

  if (lower.includes('crash') || lower.includes('freeze') || lower.includes('stable')) {
    return 'stability';
  }

  if (lower.includes('ui') || lower.includes('visible') || lower.includes('display')) {
    return 'ui';
  }

  return 'other';
}

/**
 * Determine overall test status from score and issues
 */
export function determineTestStatus(
  score: number,
  issues: Issue[]
): 'pass' | 'fail' | 'error' {
  // Check for critical issues
  const hasCriticalIssues = issues.some((i) => i.severity === 'critical');
  if (hasCriticalIssues) {
    return 'error';
  }

  // Score-based determination
  if (score >= 60) {
    return 'pass';
  } else if (score >= 30) {
    return 'fail';
  } else {
    return 'error';
  }
}

/**
 * Generate a summary description of the test results
 */
export function generateSummary(
  status: 'pass' | 'fail' | 'error',
  score: number,
  issues: Issue[]
): string {
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const highCount = issues.filter((i) => i.severity === 'high').length;

  if (status === 'pass') {
    if (issues.length === 0) {
      return `Game is fully playable with excellent performance (score: ${score}/100)`;
    }
    return `Game is playable with minor issues (score: ${score}/100, ${issues.length} issue(s))`;
  }

  if (status === 'fail') {
    return `Game has significant playability issues (score: ${score}/100, ${highCount} high severity issue(s))`;
  }

  return `Game has critical failures preventing playability (score: ${score}/100, ${criticalCount} critical issue(s))`;
}


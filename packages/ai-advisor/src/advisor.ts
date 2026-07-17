import { createAIProvider } from '@beacon/ai';
import type { TrendResult } from '@beacon/analytics';
import { adviseIssues } from './rules';
import type { AdviseInput, AdviseOptions, AdvisorIssue, AdvisorReport } from './types';

const DEFAULT_MAX_ISSUES = 5;

/** Build the lead line from the trend when present, else from the grade. */
function buildHeadline(input: AdviseInput, topIssues: AdvisorIssue[]): string {
  const trend = input.trend;
  if (trend && trend.points >= 2 && trend.direction !== 'flat' && Math.round(Math.abs(trend.deltaPercent)) > 0) {
    const magnitude = Math.abs(Math.round(trend.deltaPercent));
    const verb = trend.direction === 'up' ? 'increased' : 'decreased';
    return `Health ${verb} ${magnitude}% this month.`;
  }

  const { grade } = input.analysis.score;
  const highCount = topIssues.filter((i) => i.severity === 'high').length;
  if (highCount > 0) {
    return `${grade}, but ${highCount} pressing issue${highCount === 1 ? '' : 's'} need${highCount === 1 ? 's' : ''} attention.`;
  }
  if (grade === 'Excellent' || grade === 'Healthy') {
    return 'Actively maintained and healthy.';
  }
  return `Repository health is ${grade.toLowerCase()}.`;
}

/** Deterministic narrative built from the top issues. */
function buildHeuristicSummary(input: AdviseInput, issues: AdvisorIssue[]): string {
  const { score } = input.analysis;
  const sentences: string[] = [];

  const trend = input.trend;
  if (trend && trend.points >= 2 && trend.narrative) {
    sentences.push(trend.narrative);
  } else {
    sentences.push(`This repository holds a Beacon Score of ${score.total}/100 (${score.grade}).`);
  }

  if (issues.length === 0) {
    sentences.push('No significant problems stood out — keep up the current practices.');
    return sentences.join(' ');
  }

  const high = issues.filter((i) => i.severity === 'high');
  if (high.length > 0) {
    const titles = high.map((i) => i.title.toLowerCase());
    sentences.push(`The most urgent concern${high.length === 1 ? ' is' : 's are'} ${joinList(titles)}.`);
  }

  const top = issues[0];
  if (top) {
    sentences.push(`Start by acting on it: ${top.recommendation}`);
  }

  const remaining = issues.length - (top ? 1 : 0);
  if (remaining > 0) {
    sentences.push(`${remaining} further recommendation${remaining === 1 ? '' : 's'} follow${remaining === 1 ? 's' : ''} below.`);
  }

  return sentences.join(' ');
}

function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  const head = items.slice(0, -1).join(', ');
  const tail = items[items.length - 1] ?? '';
  return `${head} and ${tail}`;
}

/** Attempt an AI-written summary, falling back to the heuristic on any error. */
async function buildSummary(
  input: AdviseInput,
  issues: AdvisorIssue[],
  options: AdviseOptions,
): Promise<string> {
  const heuristic = buildHeuristicSummary(input, issues);
  if (!options.ai) return heuristic;

  try {
    const provider = createAIProvider(options.ai);
    // The heuristic provider yields the same offline narrative style; only a
    // hosted provider adds value, so short-circuit to our own narrative for it.
    if (provider.name === 'heuristic') return heuristic;

    const summary = await provider.generateSummary({
      snapshot: input.analysis.snapshot,
      score: input.analysis.score,
    });
    const text = summary.text.trim();
    return text.length > 0 ? text : heuristic;
  } catch {
    return heuristic;
  }
}

function healthDeltaPercent(trend: TrendResult | undefined): number | undefined {
  if (!trend || trend.points < 2) return undefined;
  return trend.deltaPercent;
}

/**
 * Turn a repository analysis into an actionable {@link AdvisorReport}. The
 * issue list is produced by the pure {@link adviseIssues} engine; only the
 * summary may consult a hosted AI provider, and it falls back to a
 * deterministic narrative on any error.
 */
export async function generateAdvice(
  input: AdviseInput,
  options: AdviseOptions = {},
): Promise<AdvisorReport> {
  const maxIssues = options.maxIssues ?? DEFAULT_MAX_ISSUES;
  const all = adviseIssues(input);
  const issues = maxIssues >= 0 ? all.slice(0, maxIssues) : all;

  const summary = await buildSummary(input, issues, options);
  const { score } = input.analysis;

  const report: AdvisorReport = {
    headline: buildHeadline(input, issues),
    score: score.total,
    grade: score.grade,
    issues,
    summary,
    generatedAt: new Date().toISOString(),
  };

  const delta = healthDeltaPercent(input.trend);
  if (delta !== undefined) {
    report.healthDeltaPercent = delta;
  }

  return report;
}

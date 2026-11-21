/**
 * PERT (spec §3):
 *   te = (a + 4m + b) / 6,  σ² = ((b − a) / 6)²   (exact Rationals)
 *   project variance = Σ σ² of the critical path's activities (variances, NOT deviations)
 *   P(T ≤ t) = Φ((t − Te) / σ)
 * With several critical paths the exercise decides; default: the one with the largest
 * variance (spec §3).
 *
 * Φ is computed exactly (solver A erf series, checked against solver B Simpson in tests);
 * the "table" value uses z rounded to 2 decimals, as with a printed table (spec §8.1:
 * probabilities graded ±0.005 because of that rounding).
 */
import { cpm, pertMean } from './cpm';
import type { ProjectProblem } from './model';
import { phi, phiInv } from './normal';
import * as R from './rational';
import type { Rational } from './rational';

export function pertVariance([a, , b]: [Rational, Rational, Rational]): Rational {
  return R.pow(R.div(R.sub(b, a), R.q(6)), 2);
}

export interface PertResult {
  te: Map<string, Rational>;
  variance: Map<string, Rational>;
  /** Expected project duration (critical path of te). */
  Te: Rational;
  criticalPaths: string[][];
  /** Variance of every critical path, same order. */
  pathVariances: Rational[];
  /** Path used for σ (rule). */
  path: string[];
  projectVariance: Rational;
  sigma: number;
}

/** Only rule in v1 for several critical paths: the largest variance (first one if tied). */
export function pert(p: ProjectProblem): PertResult {
  for (const a of p.activities) if (!a.pert) throw new Error(`activity ${a.id} has no PERT estimates`);
  const te = new Map(p.activities.map((a) => [a.id, pertMean(a.pert!)]));
  const variance = new Map(p.activities.map((a) => [a.id, pertVariance(a.pert!)]));
  const res = cpm(p);
  const pathVariances = res.criticalPaths.map((path) => R.sum(path.map((id) => variance.get(id)!)));
  let best = 0;
  pathVariances.forEach((v, i) => {
    if (R.gt(v, pathVariances[best]!)) best = i;
  });
  const projectVariance = pathVariances[best]!;
  return {
    te,
    variance,
    Te: res.duration,
    criticalPaths: res.criticalPaths,
    pathVariances,
    path: res.criticalPaths[best]!,
    projectVariance,
    sigma: Math.sqrt(R.toNumber(projectVariance)),
  };
}

export interface Probability {
  z: number;
  /** Φ(z) with full accuracy. */
  p: number;
  /** z rounded to 2 decimals, and Φ of it (printed-table value). */
  zTable: number;
  pTable: number;
}

/** P(T ≤ t). */
export function probabilityByDeadline(Te: Rational, variance: Rational, t: Rational): Probability {
  const sigma = Math.sqrt(R.toNumber(variance));
  if (!(sigma > 0)) throw new Error('σ = 0: the duration is certain');
  const z = R.toNumber(R.sub(t, Te)) / sigma;
  const zTable = Number(z.toFixed(2)) + 0; // +0 turns −0 into 0
  return { z, p: phi(z), zTable, pTable: phi(zTable) };
}

/** Deadline t with P(T ≤ t) = prob. */
export function deadlineForProbability(Te: Rational, variance: Rational, prob: number): number {
  const sigma = Math.sqrt(R.toNumber(variance));
  return R.toNumber(Te) + phiInv(prob) * sigma;
}

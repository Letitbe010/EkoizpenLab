/**
 * Verification of an exercise before it is shown (spec §5, §10.2, §10.3). Rejected when:
 *  - a solver throws, or solvers A and B disagree (solve.ts);
 *  - a common mistake cannot be told apart from the right answer (grader hypotheses);
 *  - level filters: no redundant precedence edges at levels 1–2; one critical path at
 *    levels 1–2 of CPM, two at level 3; a single Johnson sequence at level 1 (no ties);
 *  - PERT: a z too close to a rounding boundary of a 2-decimal table, or |z| outside 0.3…2.5;
 *  - the reference assignment is over 8 stations (not readable on a phone).
 */
import { redundantEdges } from '../dag';
import { indistinguishable } from '../grader';
import type { Exercise } from '../model';
import * as R from '../rational';
import { solve } from '../solve';

export interface Verdict {
  ok: boolean;
  reasons: string[];
}

export function verifyExercise(ex: Exercise): Verdict {
  const reasons: string[] = [];
  let sol;
  try {
    sol = solve(ex.problem);
  } catch (e) {
    return { ok: false, reasons: [`solver: ${(e as Error).message}`] };
  }
  const p = ex.problem;
  const generated = ex.origin === 'generated';
  if (p.kind === 'balancing' && sol.kind === 'balancing') {
    if (generated && ex.difficulty < 3 && redundantEdges(p.tasks).length > 0) reasons.push('redundant precedence edges');
    if (sol.reference.length > 8) reasons.push('more than 8 stations');
  }
  if (p.kind === 'project' && sol.kind === 'project') {
    const n = sol.cpm.criticalPaths.length;
    if (generated && !sol.pert && n !== (ex.difficulty === 3 ? 2 : 1)) reasons.push(`${n} critical paths`);
    if (sol.pert) {
      const ask = ex.asks.find((a) => a.pertWhat === 'probability');
      if (ask?.t) {
        const z = (R.toNumber(ask.t) - R.toNumber(sol.pert.Te)) / sol.pert.sigma;
        const frac = (Math.abs(z) * 100) % 1;
        if (generated && (Math.abs(z) < 0.3 || Math.abs(z) > 2.5 || (frac > 0.4 && frac < 0.6))) reasons.push('z not readable');
      }
      if (generated && [...sol.pert.te.values()].some((t) => !R.isInteger(t))) reasons.push('non-integer te');
      // pool / imported exercises (user decision 2026-11-23): CPM times are graded exactly, so
      // te rounded by hand and added along a path would be marked wrong; such an exercise must
      // be adapted (integer te or no CPM-time asks) before it enters the pool
      const cpmTimeAsk = ex.asks.some((a) => a.kind === 'cpmTable' || a.kind === 'duration');
      if (!generated && cpmTimeAsk && [...sol.pert.te.values()].some((t) => !R.isInteger(t))) reasons.push('non-integer te with CPM-time asks: adapt before import');
    }
  }
  if (p.kind === 'flowshop' && sol.kind === 'flowshop') {
    if (generated && ex.difficulty === 1 && sol.johnsonSequences.length !== 1) reasons.push('ties at level 1');
  }
  const ind = indistinguishable(ex);
  if (ind.length) reasons.push(...ind.map((x) => `indistinguishable mistake ${x}`));
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

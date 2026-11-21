/**
 * Golden cases (spec §11.2). Expected values are hand-calculated; never edit them to match
 * the implementation.
 */
import { assignHeuristic, metrics, nMin } from '../src/core/balancing';
import { heuristicByList, optimalStations, validateAssignment } from '../src/core/balancingExact';
import { cpm } from '../src/core/cpm';
import { cpmAlt } from '../src/core/cpmAlt';
import { bruteForce, johnsonSequence, johnsonSequences, schedule } from '../src/core/johnson';
import type { BalancingProblem, FlowShopProblem, ProjectProblem } from '../src/core/model';
import { phiB } from '../src/core/normal';
import { pert, probabilityByDeadline } from '../src/core/pert';
import * as R from '../src/core/rational';
import golden from './golden/golden.json';
import { S, goldenProblem } from './helpers';

describe('EG1: line balancing (LTT, alphabetical ties)', () => {
  const p = goldenProblem<BalancingProblem>('EG1');
  const ex = golden.EG1.expected;

  it('solver A: C, N_min, assignment and efficiencies', () => {
    const { stations } = assignHeuristic(p, 'LTT', 'alpha');
    expect(stations).toEqual(ex.stations);
    const m = metrics(p, stations);
    expect(S(m.sumT)).toBe(ex.sumT);
    expect(S(m.c)).toBe(ex.c);
    expect(m.nMin).toBe(ex.nMin);
    expect(nMin(p)).toBe(ex.nMin);
    expect(m.n).toBe(ex.n);
    expect(m.stationTimes.map(S)).toEqual(ex.stationTimes);
    expect(S(m.efficiency)).toBe(ex.efficiency);
    expect(m.stationEfficiency.map(S)).toEqual(ex.stationEfficiency);
    expect(S(m.idle)).toBe(ex.idle);
  });

  it('solver B: same assignment, valid, and N optimal', () => {
    expect(heuristicByList(p, 'LTT', 'alpha')).toEqual(ex.stations);
    expect(validateAssignment(p, ex.stations)).toEqual([]);
    expect(optimalStations(p)).toBe(ex.nOptimal);
  });
});

describe('EG2: CPM', () => {
  const p = goldenProblem<ProjectProblem>('EG2');
  const ex = golden.EG2.expected;
  it('solver A: duration, critical path, total floats', () => {
    const r = cpm(p);
    expect(S(r.duration)).toBe(ex.duration);
    expect(r.criticalPaths).toEqual(ex.criticalPaths);
    expect(Object.fromEntries(r.rows.map((x) => [x.id, S(x.tf)]))).toEqual(ex.totalFloat);
  });
  it('solver B: path enumeration and Bellman-Ford agree', () => {
    const b = cpmAlt(p);
    expect(S(b.duration)).toBe(ex.duration);
    expect(b.criticalPaths).toEqual(ex.criticalPaths);
    expect(Object.fromEntries([...b.tf].map(([k, v]) => [k, S(v)]))).toEqual(ex.totalFloat);
  });
});

describe('EG3: Johnson', () => {
  const p = goldenProblem<FlowShopProblem>('EG3');
  const ex = golden.EG3.expected;
  it('solver A: sequence and makespan', () => {
    expect(johnsonSequence(p)).toEqual(ex.sequence);
    // J4 (6, 6) is a tie with itself, but it is the last job left: still one sequence
    expect(johnsonSequences(p)).toEqual([ex.sequence]);
    expect(S(schedule(p, ex.sequence).makespan)).toBe(ex.makespan);
  });
  it('solver B: every permutation, optimum 24', () => {
    const b = bruteForce(p);
    expect(S(b.optimal)).toBe(ex.optimalMakespan);
    expect(b.optimalSequences).toContainEqual(ex.sequence);
  });
});

describe('EG4: PERT', () => {
  const p = goldenProblem<ProjectProblem>('EG4');
  const ex = golden.EG4.expected;
  it('Te, σ², σ and P(T ≤ 17)', () => {
    const r = pert(p);
    expect(S(r.Te)).toBe(ex.te);
    expect(S(r.projectVariance)).toBe(ex.variance);
    expect(R.toFixed(r.projectVariance, 3)).toBe(ex.varianceRounded);
    expect(r.sigma.toFixed(3)).toBe(ex.sigmaRounded);
    const pr = probabilityByDeadline(r.Te, r.projectVariance, R.parse(golden.EG4.problem.deadline));
    expect(pr.z.toFixed(3)).toBe(ex.zRounded);
    const tol = Number(ex.probabilityTolerance);
    expect(Math.abs(pr.p - Number(ex.probability))).toBeLessThan(tol);
    expect(Math.abs(pr.pTable - Number(ex.probability))).toBeLessThan(tol);
    expect(Math.abs(phiB(pr.z) - pr.p)).toBeLessThan(1e-10);
  });
});

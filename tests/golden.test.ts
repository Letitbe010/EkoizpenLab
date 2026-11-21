/**
 * Golden cases (spec §11.2). Expected values are hand-calculated; never edit them to match
 * the implementation. Phase 1 covers EG1; EG2–EG4 are added with their solvers (phase 2).
 */
import { assignHeuristic, metrics, nMin } from '../src/core/balancing';
import { heuristicByList, optimalStations, validateAssignment } from '../src/core/balancingExact';
import type { BalancingProblem } from '../src/core/model';
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

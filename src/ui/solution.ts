/**
 * Step-by-step solution of each ask (spec §8.4): formula → numbers substituted → result with
 * units. Every number comes from the verified solution (solve.ts), never typed by hand.
 */
import type { Ask, Exercise } from '../core/model';
import { phi, phiInv } from '../core/normal';
import { pertVariance } from '../core/pert';
import * as R from '../core/rational';
import { solve, type BalancingSolution, type FlowShopSolution, type ProjectSolution } from '../core/solve';
import { fmtN, fmtPct, fmtR } from './format';

type T = (k: string, v?: Record<string, string | number>) => string;

const join = (xs: string[]) => xs.join(' + ');

function balancingLines(ex: Exercise, sol: BalancingSolution, ask: Ask, t: T): string[] {
  const p = ex.problem;
  if (p.kind !== 'balancing') return [];
  const m = sol.metrics;
  const u = p.unit;
  switch (ask.kind) {
    case 'precedence':
      return [t('sol.edges', { e: sol.edges.map(([a, b]) => `${a}→${b}`).join(', ') })];
    case 'cycleTime':
      return [`C = ${t('sol.available')} / ${t('sol.demand')} = ${fmtR(p.available)} / ${p.demand} = ${fmtR(m.c)} ${u}/u`];
    case 'nMin':
      return [
        `Σt = ${join(p.tasks.map((x) => fmtR(x.t)))} = ${fmtR(m.sumT)} ${u}`,
        `N_min = ⌈Σt / C⌉ = ⌈${fmtR(m.sumT)} / ${fmtR(m.c)}⌉ = ⌈${fmtN(R.toNumber(R.div(m.sumT, m.c)))}⌉ = ${sol.nMin}`,
        t('sol.ceil'),
      ];
    case 'assignment': {
      const time = new Map(p.tasks.map((x) => [x.id, x.t]));
      const lines = [
        sol.ruleGiven ? t('sol.rule', { h: t(`heur.${sol.heuristic}`), tie: t(`tie.${sol.tieBreak}`) }) : t('sol.noRule', { n: sol.nOptimal }),
        ...sol.reference.map((s, k) => `${t('field.station', { k: k + 1 })}: ${s.join(', ')} → ${join(s.map((id) => fmtR(time.get(id)!)))} = ${fmtR(m.stationTimes[k]!)} ≤ C = ${fmtR(m.c)}`),
      ];
      if (sol.ruleGiven && sol.nOptimal < sol.reference.length) lines.push(t('sol.notOptimal', { n: sol.reference.length, o: sol.nOptimal }));
      return lines;
    }
    case 'stationTimes':
      return [t('sol.onAssignment'), m.stationTimes.map((x, k) => `${k + 1}: ${fmtR(x)} ${u}`).join(' · ')];
    case 'idle':
      return [t('sol.onAssignment'), `${t('sol.idle')} = N · C − Σt = ${m.n} · ${fmtR(m.base)} − ${fmtR(m.sumT)} = ${fmtR(m.idle)} ${u}`];
    case 'efficiency': {
      const base = m.baseKind === 'C' ? 'C' : t('sol.bottleneck');
      if ((ask.scope ?? 'line') === 'line')
        return [t('sol.onAssignment'), `η = Σt / (N · ${base}) = ${fmtR(m.sumT)} / (${m.n} · ${fmtR(m.base)}) = ${fmtPct(m.efficiency)}`, `${t('sol.balanceDelay')} = 1 − η = ${fmtPct(m.balanceDelay)}`];
      const k = ask.station === 'last' || ask.station === undefined ? m.n - 1 : ask.station - 1;
      return [t('sol.onAssignment'), `η${k + 1} = t${k + 1} / ${base} = ${fmtR(m.stationTimes[k]!)} / ${fmtR(m.base)} = ${fmtPct(m.stationEfficiency[k]!)}`];
    }
    default:
      return [];
  }
}

function projectLines(ex: Exercise, sol: ProjectSolution, ask: Ask, t: T): string[] {
  const p = ex.problem;
  if (p.kind !== 'project') return [];
  const c = sol.cpm;
  switch (ask.kind) {
    case 'cpmTable':
      return [
        t('sol.forward'),
        t('sol.backward'),
        t('sol.floats'),
        ...c.rows.map((r) => `${r.id} (d = ${fmtR(r.d)}): ES ${fmtR(r.es)} · EF ${fmtR(r.ef)} · LS ${fmtR(r.ls)} · LF ${fmtR(r.lf)} · HT ${fmtR(r.tf)} · HL ${fmtR(r.ff)}`),
      ];
    case 'criticalPath':
      return [t('sol.critical'), c.criticalPaths.map((x) => x.join(' – ')).join(' ; ')];
    case 'duration': {
      const path = c.criticalPaths[0]!;
      const d = new Map(c.rows.map((r) => [r.id, r.d]));
      return [`T = ${path.map((id) => fmtR(d.get(id)!)).join(' + ')} = ${fmtR(c.duration)}`];
    }
    case 'pert': {
      const r = sol.pert!;
      const what = ask.pertWhat ?? 'variance';
      if (what === 'te')
        return p.activities.map((a) => {
          const [x, m, y] = a.pert!;
          return `${a.id}: te = (${fmtR(x)} + 4·${fmtR(m)} + ${fmtR(y)}) / 6 = ${fmtR(r.te.get(a.id)!)} · σ² = ((${fmtR(y)} − ${fmtR(x)}) / 6)² = ${fmtR(pertVariance(a.pert!))}`;
        });
      const vLine = `σ² = ${join(r.path.map((id) => fmtR(r.variance.get(id)!)))} = ${fmtR(r.projectVariance)}`;
      const lines = [t('sol.pertPath', { p: r.path.join(' – ') }), vLine, t('sol.varianceNotSd')];
      if (what === 'variance') return lines;
      lines.push(`σ = √${fmtN(R.toNumber(r.projectVariance), 4)} = ${fmtN(r.sigma, 4)}`);
      if (what === 'sigma') return lines;
      const Te = R.toNumber(r.Te);
      if (what === 'probability') {
        const tt = R.toNumber(ask.t!);
        const z = (tt - Te) / r.sigma;
        lines.push(`z = (t − Te) / σ = (${fmtN(tt)} − ${fmtN(Te)}) / ${fmtN(r.sigma, 4)} = ${fmtN(z, 4)}`);
        lines.push(`P(T ≤ ${fmtN(tt)}) = Φ(${fmtN(z, 2)}) = ${fmtPct(phi(z), 2)} (${t('sol.table')}: Φ(${fmtN(Number(z.toFixed(2)), 2)}) = ${fmtN(phi(Number(z.toFixed(2))), 4)})`);
        return lines;
      }
      const z = phiInv(ask.prob!);
      lines.push(`t = Te + z · σ = ${fmtN(Te)} + ${fmtN(z, 4)} · ${fmtN(r.sigma, 4)} = ${fmtN(Te + z * r.sigma, 2)}`);
      return lines;
    }
    default:
      return [];
  }
}

function flowShopLines(sol: FlowShopSolution, ask: Ask, t: T): string[] {
  const s = sol.schedule;
  const what = ask.johnsonWhat ?? 'sequence';
  if (what === 'sequence') {
    const lines = [t('sol.johnsonRule'), sol.sequence.join(' – ')];
    if (sol.johnsonSequences.length > 1) lines.push(t('sol.johnsonTies', { n: sol.johnsonSequences.length }));
    return lines;
  }
  if (what === 'makespan')
    return [t('sol.makespan'), s.m2.map((x) => `${x.id}: ${fmtR(x.start)}–${fmtR(x.end)}`).join(' · '), `makespan = ${fmtR(s.makespan)} h`];
  return [t('sol.idleDef'), `M1: ${fmtR(s.makespan)} − ${fmtR(R.sub(s.makespan, s.idleM1))} = ${fmtR(s.idleM1)} h`, `M2: ${fmtR(s.makespan)} − ${fmtR(R.sub(s.makespan, s.idleM2))} = ${fmtR(s.idleM2)} h`];
}

export function solutionLines(ex: Exercise, ask: Ask, t: T): string[] {
  const sol = solve(ex.problem);
  if (sol.kind === 'balancing') return balancingLines(ex, sol, ask, t);
  if (sol.kind === 'project') return projectLines(ex, sol, ask, t);
  return flowShopLines(sol, ask, t);
}


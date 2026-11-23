/**
 * Template variables for theory examples (spec §14.3): texts carry {{…}} variables, never
 * hand-written numbers. Every value is computed here from the solvers on a pool exercise.
 *
 * Line balancing:  {{avail}} {{demand}} {{u}} {{C}} {{sumT}} {{ratio}} {{nmin}} {{floor}}
 *                  {{N}} {{nopt}} {{eta}} {{idle}} {{delay}} {{stations}} {{edges}} {{redundant}}
 *                  {{rpw:A}} {{t:A}} {{rule}}
 * Projects (CPM):  {{T}} {{paths}} {{es:A}} {{ef:A}} {{ls:A}} {{lf:A}} {{tf:A}} {{ff:A}} {{d:A}}
 *                  {{noncrit}} (first activity with float)
 * PERT:            {{abm:A}} {{te:A}} {{var:A}} {{Te}} {{V}} {{vars}} {{sigma}} {{sdsum}}
 *                  {{deadline}} {{z}} {{P}} (Φ of z rounded to 2 decimals) {{pert-path}}
 * Flow shop:       {{seq}} {{mk}} {{opt}} {{idle1}} {{idle2}} {{rev}} {{revmk}} {{first}}
 */
import { assignHeuristic, metrics, priorities } from '../core/balancing';
import { redundantEdges } from '../core/dag';
import type { Exercise } from '../core/model';
import * as R from '../core/rational';
import { johnsonSequence, schedule } from '../core/johnson';
import { phi } from '../core/normal';
import { solve } from '../core/solve';
import { fmtN, fmtPct, fmtR } from './format';

export class TemplateError extends Error {}

type T = (k: string, v?: Record<string, string | number>) => string;

export function fillTemplate(text: string, ex: Exercise, t: T): string {
  const p = ex.problem;
  const sol = solve(p);
  return text.replace(/\{\{([^}]+)\}\}/g, (_m, body: string) => {
    const [k, a = ''] = body.split(':');
    if (p.kind === 'balancing' && sol.kind === 'balancing') {
      const m = sol.metrics;
      const task = () => {
        const x = p.tasks.find((y) => y.id === a);
        if (!x) throw new TemplateError(`${ex.id} has no task ${a}`);
        return x;
      };
      switch (k) {
        case 'avail':
          return fmtR(p.available);
        case 'demand':
          return String(p.demand);
        case 'u':
          return p.unit;
        case 'C':
          return fmtR(m.c);
        case 'sumT':
          return fmtR(m.sumT);
        case 'ratio':
          return fmtN(R.toNumber(R.div(m.sumT, m.c)), 3);
        case 'nmin':
          return String(sol.nMin);
        case 'floor':
          return String(R.floor(R.div(m.sumT, m.c)));
        case 'N':
          return String(m.n);
        case 'nopt':
          return String(sol.nOptimal);
        case 'eta':
          return fmtPct(m.efficiency);
        case 'idle':
          return fmtR(m.idle);
        case 'delay':
          return fmtPct(m.balanceDelay);
        case 'stations':
          return sol.reference.map((s) => `{${s.join(', ')}}`).join(' ');
        case 'edges':
          return sol.edges.map(([x, y]) => `${x}→${y}`).join(', ');
        case 'redundant':
          return String(redundantEdges(p.tasks).length);
        case 't':
          return fmtR(task().t);
        case 'rpw':
          return fmtR(priorities(p.tasks, 'RPW').rpw.get(task().id)!);
        case 'rule': {
          const h = (a || 'LTT') as 'LTT' | 'RPW' | 'mostFollowers';
          const st = assignHeuristic(p, h, p.tieBreak ?? 'alpha').stations;
          return `${st.map((s) => `{${s.join(', ')}}`).join(' ')} (N = ${st.length}, η = ${fmtPct(metrics(p, st).efficiency)})`;
        }
      }
    }
    if (p.kind === 'project' && sol.kind === 'project') {
      const c = sol.cpm;
      const row = () => {
        const r = c.rows.find((x) => x.id === a);
        if (!r) throw new TemplateError(`${ex.id} has no activity ${a}`);
        return r;
      };
      switch (k) {
        case 'T':
          return fmtR(c.duration);
        case 'paths':
          return c.criticalPaths.map((x) => x.join('–')).join(' ; ');
        case 'es':
        case 'ef':
        case 'ls':
        case 'lf':
        case 'tf':
        case 'ff':
          return fmtR(row()[k]);
        case 'd':
          return fmtR(row().d);
        case 'noncrit': {
          const r = c.rows.find((x) => !x.critical);
          if (!r) throw new TemplateError(`${ex.id}: every activity is critical`);
          return r.id;
        }
      }
      const pr = sol.pert;
      if (pr) {
        const act = () => {
          const x = p.activities.find((y) => y.id === a);
          if (!x?.pert) throw new TemplateError(`${ex.id} has no PERT activity ${a}`);
          return x;
        };
        const deadline = () => {
          if (!p.deadline) throw new TemplateError(`${ex.id} has no deadline`);
          return R.toNumber(p.deadline);
        };
        const z = () => (deadline() - R.toNumber(pr.Te)) / pr.sigma;
        switch (k) {
          case 'abm':
            return act().pert!.map(fmtR).join(', ');
          case 'te':
            return fmtR(pr.te.get(act().id)!);
          case 'var':
            return fmtR(pr.variance.get(act().id)!);
          case 'Te':
            return fmtR(pr.Te);
          case 'V':
            return fmtR(pr.projectVariance);
          case 'vars':
            return pr.path.map((id) => fmtN(R.toNumber(pr.variance.get(id)!), 3)).join(' + ');
          case 'sigma':
            return fmtN(pr.sigma, 3);
          case 'sdsum':
            return fmtN(pr.path.reduce((acc, id) => acc + Math.sqrt(R.toNumber(pr.variance.get(id)!)), 0), 3);
          case 'deadline':
            return fmtN(deadline());
          case 'z':
            return fmtN(z(), 2);
          case 'P':
            return fmtPct(phi(Number(z().toFixed(2))), 1);
          case 'pert-path':
            return pr.path.join('–');
        }
      }
    }
    if (p.kind === 'flowshop' && sol.kind === 'flowshop') {
      const swapped = { ...p, jobs: p.jobs.map((j) => ({ id: j.id, p1: j.p2, p2: j.p1 })) };
      const rev = johnsonSequence(swapped);
      switch (k) {
        case 'seq':
          return sol.sequence.join('–');
        case 'mk':
          return fmtR(sol.schedule.makespan);
        case 'opt':
          return fmtR(sol.optimal);
        case 'idle1':
          return fmtR(sol.schedule.idleM1);
        case 'idle2':
          return fmtR(sol.schedule.idleM2);
        case 'rev':
          return rev.join('–');
        case 'revmk':
          return fmtR(schedule(p, rev).makespan);
        case 'first': {
          // the job with the smallest time overall, and where it goes
          const j = p.jobs.reduce((best, x) => (R.lt(R.min(x.p1, x.p2), R.min(best.p1, best.p2)) ? x : best));
          return j.id;
        }
      }
    }
    void t;
    throw new TemplateError(`unknown variable ${body} for ${ex.id}`);
  });
}

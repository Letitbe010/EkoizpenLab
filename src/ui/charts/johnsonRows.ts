/** Gantt rows (M1, M2) of a flow-shop sequence, with idle gaps marked; times from core/johnson. */
import { schedule } from '../../core/johnson';
import type { FlowShopProblem } from '../../core/model';
import * as R from '../../core/rational';
import type { GanttRow } from './Diagrams';

export function johnsonRows(p: FlowShopProblem, seq: string[]): { rows: GanttRow[]; makespan: number } {
  const s = schedule(p, seq);
  const total = R.toNumber(s.makespan);
  const bars = (m: typeof s.m1): GanttRow['bars'] => {
    const out: GanttRow['bars'] = [];
    let tt = 0;
    for (const x of m) {
      if (R.toNumber(x.start) > tt) out.push({ from: tt, to: R.toNumber(x.start), kind: 'idle' });
      out.push({ from: R.toNumber(x.start), to: R.toNumber(x.end), text: x.id, kind: 'task' });
      tt = R.toNumber(x.end);
    }
    if (tt < total) out.push({ from: tt, to: total, kind: 'idle' });
    return out;
  };
  return {
    rows: [
      { label: 'M1', bars: bars(s.m1) },
      { label: 'M2', bars: bars(s.m2) },
    ],
    makespan: total,
  };
}

/**
 * Interactive theory widgets (spec §14.2). They use the same core solvers as the grader:
 * no calculation is duplicated here. Data come from verified pool exercises (EG1, EG2).
 */
import { useMemo, useState } from 'react';
import { assignHeuristic, metrics, nMin } from '../../core/balancing';
import { validateAssignment } from '../../core/balancingExact';
import { cpm } from '../../core/cpm';
import type { Assignment, BalancingProblem, ProjectProblem } from '../../core/model';
import * as R from '../../core/rational';
import { poolById } from '../../data/pool';
import { useT } from '../../i18n';
import { AssignmentEditor } from '../AnswerForm';
import { CpmNetwork, Gantt, StationBoard } from '../charts/Diagrams';
import { fmtN, fmtPct, fmtR } from '../format';

/** Balancing table: change C, apply a heuristic or move tasks by hand; N, η and violations live. */
export function BalancingWidget() {
  const { t } = useT();
  const base = poolById('spec-eg1')!.problem as BalancingProblem;
  const times = base.tasks.map((x) => R.toNumber(x.t));
  const maxT = Math.max(...times);
  const sum = times.reduce((a, b) => a + b, 0);
  const c0 = R.toNumber(R.div(base.available, R.q(base.demand)));
  const [c, setC] = useState(c0);
  const [stations, setStations] = useState<Assignment>(() => assignHeuristic(base, 'LTT').stations);
  // same tasks, the cycle time chosen on the slider (available = C · demand)
  const p: BalancingProblem = useMemo(() => ({ ...base, available: R.q(c * base.demand), heuristic: undefined }), [base, c]);
  const used = stations.filter((s) => s.length > 0);
  const violations = validateAssignment(p, used);
  const complete = used.flat().length === base.tasks.length;
  const m = complete && violations.length === 0 ? metrics(p, used) : null;
  return (
    <div className="widget">
      <span className="lab">{t('th.w.balancing')}</span>
      <label className="slider">
        <span>
          C = {c} {base.unit} · N_min = ⌈{sum} / {c}⌉ = {nMin(p)}
        </span>
        <input type="range" min={maxT} max={sum} step={1} value={c} onChange={(e) => setC(Number(e.target.value))} />
      </label>
      <div className="row">
        {(['LTT', 'mostFollowers', 'RPW'] as const).map((h) => (
          <button key={h} type="button" className="small" onClick={() => setStations(assignHeuristic(p, h).stations)}>
            {t(`heur.${h}`)}
          </button>
        ))}
      </div>
      <AssignmentEditor
        tasks={base.tasks.map((x) => ({ id: x.id, t: R.toNumber(x.t), show: fmtR(x.t) }))}
        ans={{ stations }}
        set={(patch) => setStations(patch.stations ?? [])}
        disabled={false}
        unit={base.unit}
      />
      {used.length > 0 && (
        <StationBoard stations={used.map((s) => ({ tasks: s.map((id) => ({ id, t: times[base.tasks.findIndex((x) => x.id === id)]! })) }))} c={c} unit={base.unit} label={t('chart.stations')} />
      )}
      <p className="w-result" role="status">
        {m
          ? t('th.w.balancingOk', { n: m.n, e: fmtPct(m.efficiency), i: fmtR(m.idle), u: base.unit })
          : !complete
            ? t('th.w.incomplete')
            : violations.map((v) => (v.kind === 'precedence' ? `${v.pred} → ${v.task}` : v.kind === 'overC' ? `${t('field.station', { k: v.station + 1 })} > C` : v.kind)).join(' · ')}
      </p>
    </div>
  );
}

/** CPM simulator: change durations; ES/EF/LS/LF, floats, critical path and Gantt live. */
export function CpmWidget() {
  const { t } = useT();
  const base = poolById('spec-eg2')!.problem as ProjectProblem;
  const [d, setD] = useState<Record<string, number>>(() => Object.fromEntries(base.activities.map((a) => [a.id, R.toNumber(a.d!)])));
  const p: ProjectProblem = { ...base, activities: base.activities.map((a) => ({ ...a, d: R.q(d[a.id]!) })) };
  const r = cpm(p);
  const step = (id: string, k: number) => setD((prev) => ({ ...prev, [id]: Math.min(15, Math.max(1, prev[id]! + k)) }));
  return (
    <div className="widget">
      <span className="lab">{t('th.w.cpm')}</span>
      <div className="row">
        {base.activities.map((a) => (
          <span key={a.id} className="stepper-ctl">
            <b>{a.id}</b>
            <button type="button" className="small" aria-label={`${a.id} −1`} onClick={() => step(a.id, -1)}>
              −
            </button>
            <span>{d[a.id]}</span>
            <button type="button" className="small" aria-label={`${a.id} +1`} onClick={() => step(a.id, 1)}>
              +
            </button>
          </span>
        ))}
      </div>
      <p className="w-result" role="status">
        T = {fmtR(r.duration)} · {t('legend.critical')}: {r.criticalPaths.map((x) => x.join('–')).join(' ; ')}
      </p>
      <CpmNetwork
        boxes={r.rows.map((x) => ({ id: x.id, preds: base.activities.find((a) => a.id === x.id)!.preds, d: fmtN(R.toNumber(x.d)), es: fmtN(R.toNumber(x.es)), ef: fmtN(R.toNumber(x.ef)), ls: fmtN(R.toNumber(x.ls)), lf: fmtN(R.toNumber(x.lf)), critical: x.critical }))}
        label={t('chart.network')}
      />
      <Gantt
        rows={r.rows.map((x) => ({
          label: x.id,
          bars: [
            { from: R.toNumber(x.es), to: R.toNumber(x.ef), text: fmtR(x.d), kind: x.critical ? ('critical' as const) : ('task' as const) },
            ...(R.isZero(x.tf) ? [] : [{ from: R.toNumber(x.ef), to: R.toNumber(x.lf), kind: 'slack' as const }]),
          ],
        }))}
        total={R.toNumber(r.duration)}
        label={t('chart.gantt')}
        unit={t('chart.days')}
      />
      <table className="dtable">
        <thead>
          <tr>
            <th />
            <th>HT</th>
            <th>HL</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((x) => (
            <tr key={x.id}>
              <th>{x.id}</th>
              <td>{fmtR(x.tf)}</td>
              <td>{fmtR(x.ff)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TheoryWidget({ w }: { w: 'balancing' | 'cpm' }) {
  return w === 'balancing' ? <BalancingWidget /> : <CpmWidget />;
}

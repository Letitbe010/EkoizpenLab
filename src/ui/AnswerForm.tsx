/**
 * Answer form (spec §13.1–13.2): one card per ask, numeric keyboard (inputmode="decimal",
 * comma or point), unit selectors, and editors for the structured answers:
 *  - precedence: the predecessors of each task (the user's own diagram is drawn live);
 *  - assignment: tap a task, then a station (mobile); tap a placed task to take it back;
 *  - Johnson sequence: tap the jobs in order.
 * After grading, each ask shows icon + text + colour (never colour alone), the expected
 * value, the diagnosis of the mistake and the grading notes.
 */
import { useState } from 'react';
import { CPM_FIELDS, type Answer, type AskResult, type CpmField, type ItemResult } from '../core/grader';
import type { Ask, Exercise } from '../core/model';
import * as R from '../core/rational';
import { useT } from '../i18n';
import { PrecedenceGraph } from './charts/Diagrams';
import { askLabel, letter } from './describe';
import { fmtR, showGraded } from './format';
import { parsePaths, splitIds } from './parse';

type T = (k: string, v?: Record<string, string | number>) => string;

function StatusChip({ status }: { status: AskResult['status'] }) {
  const { t } = useT();
  const icon = status === 'correct' ? '✓' : status === 'wrong' ? '✗' : status === 'partial' ? '◐' : '!';
  return (
    <span className={`chip ${status === 'partial' ? 'missing' : status}`}>
      <span aria-hidden="true">{icon}</span> {t(`res.${status}`)}
    </span>
  );
}

function partLabel(part: string, t: T): string {
  const m = /^station (\d+)$/.exec(part);
  if (m) return t('field.station', { k: m[1]! });
  const c = /^(.+)\.(es|ef|ls|lf|tf|ff)$/.exec(part);
  if (c) return `${c[1]} · ${t(`cpm.${c[2]}`)}`;
  if (part === 'm1' || part === 'm2') return part.toUpperCase();
  if (part === 'value' || part === 'line' || part === 'assignment' || part === 'sequence' || part === 'paths' || part === 'edges') return '';
  return part;
}

export function Feedback({ res, t }: { res: AskResult; t: T }) {
  const bad = res.items.filter((it) => it.status !== 'correct');
  return (
    <div className="feedback">
      {bad.map((it: ItemResult, k) => {
        const lbl = partLabel(it.part, t);
        return (
          <div key={it.part + k}>
            <p>
              {lbl && <b>{lbl}: </b>}
              {it.expected !== 'yes' && it.expected !== 'no' && it.expected !== '-' && t('res.expected', { v: showGraded(it.expected) })}
              {it.expected === 'yes' && t('res.edgeMissing')}
              {it.expected === 'no' && t('res.edgeExtra')}
              {it.expected === '-' && t('res.notCritical')}
              {it.status === 'wrong' && it.given !== undefined && it.expected !== 'yes' && it.expected !== 'no' && ` · ${t('res.given', { v: showGraded(it.given) })}`}
            </p>
            {it.status === 'invalid' && <p className="hint">{t(it.detail === 'cycle' ? 'res.cycle' : 'res.invalidHelp')}</p>}
            {it.diagnosis && (
              <div className="diag">
                <b>{t('diag.title')}</b> {t(`diag.${it.diagnosis}`, { d: it.detail ?? '' })}
              </div>
            )}
          </div>
        );
      })}
      {res.notes.map((n) => (
        <p key={n.id} className="hint">
          {t(`note.${n.id}`, { d: n.detail ?? '' })}
        </p>
      ))}
    </div>
  );
}

interface Props {
  ex: Exercise;
  answers: Record<string, Answer>;
  onChange: (askId: string, patch: Partial<Answer>) => void;
  results?: AskResult[];
  disabled?: boolean;
}

export function AnswerForm({ ex, answers, onChange, results, disabled }: Props) {
  const { t } = useT();
  return (
    <div className="asks">
      {ex.asks.map((ask, i) => {
        const res = results?.find((r) => r.id === ask.id);
        return (
          <article key={ask.id} className={`ask ${res?.status ?? ''}`}>
            <header>
              <b>{letter(i)}</b> <span>{askLabel(ask, t)}</span>
              {res && <StatusChip status={res.status} />}
            </header>
            <AskEditor ex={ex} ask={ask} ans={answers[ask.id] ?? {}} set={(p) => onChange(ask.id, p)} res={res} disabled={!!disabled} label={`${letter(i)} ${askLabel(ask, t)}`} />
            {res && res.status !== 'correct' && <Feedback res={res} t={t} />}
            {res && res.status === 'correct' && res.notes.length > 0 && (
              <p className="feedback ok">{res.notes.map((n) => t(`note.${n.id}`, { d: n.detail ?? '' })).join(' · ')}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}

interface EditorProps {
  ex: Exercise;
  ask: Ask;
  ans: Answer;
  set: (p: Partial<Answer>) => void;
  res: AskResult | undefined;
  disabled: boolean;
  label: string;
}

function Field({ value, onChange, label, aria, status, width = 'w8', mode = 'decimal', disabled }: { value: string; onChange: (v: string) => void; label?: string; aria: string; status?: string; width?: string; mode?: 'decimal' | 'text'; disabled: boolean }) {
  return (
    <label className={`fld ${width} ${status ?? ''}`}>
      {label !== undefined && <span>{label}</span>}
      <input type="text" inputMode={mode} autoComplete="off" value={value} disabled={disabled} aria-label={aria} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function UnitSelect({ units, value, onChange, disabled, t }: { units: string[]; value: string; onChange: (u: string) => void; disabled: boolean; t: T }) {
  return (
    <label className="fld">
      <span>{t('field.unit')}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {units.map((u) => (
          <option key={u} value={u}>
            {u === 'fraction' ? t('field.fraction') : u}
          </option>
        ))}
      </select>
    </label>
  );
}

function AskEditor({ ex, ask, ans, set, res, disabled, label }: EditorProps) {
  const { t } = useT();
  const p = ex.problem;
  const st = (part: string) => res?.items.find((x) => x.part === part)?.status ?? '';
  const timeUnits = p.kind === 'balancing' ? [p.unit, ...(['min', 's', 'h'] as const).filter((u) => u !== p.unit)] : [];
  const single = (units: string[] = [], part = 'value') => (
    <div className="row">
      <Field value={ans.value ?? ''} onChange={(v) => set({ value: v })} aria={label} status={st(part)} disabled={disabled} />
      {units.length > 1 ? <UnitSelect units={units} value={ans.unit ?? units[0]!} onChange={(u) => set({ unit: u })} disabled={disabled} t={t} /> : units.length === 1 ? <span className="unit">{units[0]}</span> : null}
    </div>
  );

  switch (ask.kind) {
    case 'cycleTime':
    case 'idle':
      return single(timeUnits);
    case 'nMin':
    case 'duration':
      return single([], 'value');
    case 'efficiency':
      return single(['%', 'fraction'], (ask.scope ?? 'line') === 'line' ? 'line' : (res?.items[0]?.part ?? ''));
    case 'stationTimes':
      return (
        <div className="row">
          <Field
            value={ans.value ?? ''}
            width="w16"
            mode="text"
            label={t('field.stationTimes')}
            onChange={(v) => set({ value: v, values: v.split(';').map((x) => x.trim()) })}
            aria={label}
            disabled={disabled}
          />
          <UnitSelect units={timeUnits} value={ans.unit ?? timeUnits[0]!} onChange={(u) => set({ unit: u })} disabled={disabled} t={t} />
        </div>
      );
    case 'precedence':
      return p.kind === 'balancing' ? <PrecedenceEditor ids={p.tasks.map((x) => x.id)} ans={ans} set={set} disabled={disabled} label={label} /> : null;
    case 'assignment':
      return p.kind === 'balancing' ? <AssignmentEditor tasks={p.tasks.map((x) => ({ id: x.id, t: R.toNumber(x.t), show: fmtR(x.t) }))} ans={ans} set={set} disabled={disabled} unit={p.unit} /> : null;
    case 'cpmTable':
      if (p.kind !== 'project') return null;
      return (
        <div className="scroll">
          <table className="dtable cpm-input">
            <thead>
              <tr>
                <th />
                {(ask.fields ?? CPM_FIELDS).map((f) => (
                  <th key={f}>{t(`cpm.${f}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.activities.map((a) => (
                <tr key={a.id}>
                  <th>{a.id}</th>
                  {(ask.fields ?? CPM_FIELDS).map((f: CpmField) => (
                    <td key={f} className={st(`${a.id}.${f}`)}>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={disabled}
                        aria-label={`${a.id} ${t(`cpm.${f}`)}`}
                        value={ans.table?.[a.id]?.[f] ?? ''}
                        onChange={(e) => set({ table: { ...(ans.table ?? {}), [a.id]: { ...(ans.table?.[a.id] ?? {}), [f]: e.target.value } } })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'criticalPath':
      return (
        <div className="row">
          <Field value={ans.value ?? ''} width="w16" mode="text" label={t('field.paths')} onChange={(v) => set({ value: v, paths: parsePaths(v) })} aria={label} disabled={disabled} />
        </div>
      );
    case 'pert': {
      const what = ask.pertWhat ?? 'variance';
      if (what === 'te' && p.kind === 'project')
        return (
          <div className="row">
            {p.activities.map((a) => (
              <Field
                key={a.id}
                width="w5"
                label={a.id}
                value={ans.perId?.[a.id] ?? ''}
                status={st(a.id)}
                onChange={(v) => set({ perId: { ...(ans.perId ?? {}), [a.id]: v } })}
                aria={`te ${a.id}`}
                disabled={disabled}
              />
            ))}
          </div>
        );
      return single(what === 'probability' ? ['%', 'fraction'] : []);
    }
    case 'johnson': {
      const what = ask.johnsonWhat ?? 'sequence';
      if (what === 'makespan') return single(['h']);
      if (what === 'idle')
        return (
          <div className="row">
            <Field label="M1" value={ans.m1 ?? ''} status={st('m1')} onChange={(v) => set({ m1: v })} aria={`${label} M1`} disabled={disabled} />
            <Field label="M2" value={ans.m2 ?? ''} status={st('m2')} onChange={(v) => set({ m2: v })} aria={`${label} M2`} disabled={disabled} />
            <span className="unit">h</span>
          </div>
        );
      return p.kind === 'flowshop' ? <SequenceEditor ids={p.jobs.map((j) => j.id)} ans={ans} set={set} disabled={disabled} /> : null;
    }
  }
  return null;
}

function PrecedenceEditor({ ids, ans, set, disabled, label }: { ids: string[]; ans: Answer; set: (p: Partial<Answer>) => void; disabled: boolean; label: string }) {
  const { t } = useT();
  const raw = ans.perId ?? {};
  const update = (id: string, v: string) => {
    const next = { ...raw, [id]: v };
    const edges: [string, string][] = [];
    for (const to of ids) for (const from of splitIds(next[to] ?? '')) edges.push([from, to]);
    set({ perId: next, edges });
  };
  const known = new Set(ids);
  const nodes = ids.map((id) => ({ id, preds: (ans.edges ?? []).filter(([a, b]) => b === id && known.has(a) && a !== id).map(([a]) => a) }));
  let drawable = true;
  try {
    // a cycle cannot be laid out in layers: then only the table is shown
    const order = new Set<string>();
    const left = [...nodes];
    while (left.length) {
      const k = left.findIndex((n) => n.preds.every((x) => order.has(x)));
      if (k < 0) throw new Error('cycle');
      order.add(left.splice(k, 1)[0]!.id);
    }
  } catch {
    drawable = false;
  }
  return (
    <div>
      <p className="hint">{t('field.predsHelp')}</p>
      <div className="row">
        {ids.map((id) => (
          <Field key={id} label={id} width="w5" mode="text" value={raw[id] ?? ''} onChange={(v) => update(id, v)} aria={`${label}: ${id}`} disabled={disabled} />
        ))}
      </div>
      {(ans.edges?.length ?? 0) > 0 && (drawable ? <PrecedenceGraph nodes={nodes} label={t('chart.yourDiagram')} /> : <p className="note warn">{t('res.cycle')}</p>)}
    </div>
  );
}

function AssignmentEditor({ tasks, ans, set, disabled, unit }: { tasks: { id: string; t: number; show: string }[]; ans: Answer; set: (p: Partial<Answer>) => void; disabled: boolean; unit: string }) {
  const { t } = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const stations = ans.stations ?? [];
  const placed = new Set(stations.flat());
  const time = new Map(tasks.map((x) => [x.id, x.t]));
  const put = (k: number) => {
    if (!picked) return;
    const next = stations.map((s) => s.filter((x) => x !== picked));
    while (next.length <= k) next.push([]);
    next[k]!.push(picked);
    set({ stations: next });
    setPicked(null);
  };
  const remove = (id: string) => set({ stations: stations.map((s) => s.filter((x) => x !== id)) });
  const lastEmpty = stations.length > 0 && stations[stations.length - 1]!.length === 0;
  return (
    <div className="assign">
      <p className="hint">{t('field.assignHelp')}</p>
      <div className="chips" role="group" aria-label={t('field.unassigned')}>
        {tasks
          .filter((x) => !placed.has(x.id))
          .map((x) => (
            <button key={x.id} type="button" className={picked === x.id ? 'small sel' : 'small'} aria-pressed={picked === x.id} disabled={disabled} onClick={() => setPicked(picked === x.id ? null : x.id)}>
              {x.id} <small>{x.show}</small>
            </button>
          ))}
        {placed.size === tasks.length && <span className="hint">{t('field.allPlaced')}</span>}
      </div>
      <ol className="stations">
        {stations.map((s, k) => (
          <li key={k}>
            <button type="button" className="station" disabled={disabled || !picked} onClick={() => put(k)} aria-label={t('field.putIn', { k: k + 1 })}>
              <b>{t('field.station', { k: k + 1 })}</b>
              <span className="load">
                Σ = {String(s.reduce((a, id) => a + (time.get(id) ?? 0), 0)).replace('.', ',')} {unit}
              </span>
            </button>
            <span className="chips">
              {s.map((id) => (
                <button key={id} type="button" className="small placed" disabled={disabled} onClick={() => remove(id)} aria-label={t('field.takeBack', { id })}>
                  {id} ×
                </button>
              ))}
            </span>
          </li>
        ))}
      </ol>
      <div className="row">
        <button type="button" className="small" disabled={disabled || lastEmpty} onClick={() => set({ stations: [...stations, []] })}>
          + {t('field.newStation')}
        </button>
        {stations.length > 0 && (
          <button type="button" className="small" disabled={disabled} onClick={() => set({ stations: [] })}>
            {t('field.clear')}
          </button>
        )}
      </div>
    </div>
  );
}

function SequenceEditor({ ids, ans, set, disabled }: { ids: string[]; ans: Answer; set: (p: Partial<Answer>) => void; disabled: boolean }) {
  const { t } = useT();
  const seq = ans.sequence ?? [];
  return (
    <div className="assign">
      <p className="hint">{t('field.seqHelp')}</p>
      <div className="chips">
        {ids
          .filter((id) => !seq.includes(id))
          .map((id) => (
            <button key={id} type="button" className="small" disabled={disabled} onClick={() => set({ sequence: [...seq, id] })}>
              {id}
            </button>
          ))}
      </div>
      <p className="seq" aria-live="polite">
        {seq.length ? seq.join(' → ') : t('field.seqEmpty')}
      </p>
      {seq.length > 0 && (
        <div className="row">
          <button type="button" className="small" disabled={disabled} onClick={() => set({ sequence: seq.slice(0, -1) })}>
            ← {t('field.undo')}
          </button>
          <button type="button" className="small" disabled={disabled} onClick={() => set({ sequence: [] })}>
            {t('field.clear')}
          </button>
        </div>
      )}
    </div>
  );
}

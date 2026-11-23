/**
 * Diagrams (spec §6), hand-made SVG, scaled with viewBox so they stay readable at 390 px:
 *  - PrecedenceGraph: DAG in layers (longest path from the start), nodes with their time;
 *  - CpmNetwork: AON boxes with ES | EF over LS | LF, critical path in red;
 *  - StationBoard: yamazumi bars per station with the C line (dashed orange);
 *  - Gantt: bars on a time scale (project: ES start + float; Johnson: M1 and M2).
 * Every figure has an aria-label and a text alternative next to it (spec §13.2).
 */
import { topoOrder } from '../../core/dag';
import { useT } from '../../i18n';

export interface GNode {
  id: string;
  preds: string[];
}

/** Layer of each node = longest number of edges from a start node; order inside a layer by id. */
export function layers(nodes: readonly GNode[]): Map<string, { layer: number; row: number; rows: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const layer = new Map<string, number>();
  for (const id of topoOrder(nodes)) layer.set(id, Math.max(-1, ...byId.get(id)!.preds.map((p) => layer.get(p) ?? 0)) + 1);
  const cols = new Map<number, string[]>();
  for (const n of nodes) {
    const l = layer.get(n.id) ?? 0;
    cols.set(l, [...(cols.get(l) ?? []), n.id]);
  }
  const out = new Map<string, { layer: number; row: number; rows: number }>();
  for (const [l, ids] of cols) ids.sort().forEach((id, i) => out.set(id, { layer: l, row: i, rows: ids.length }));
  return out;
}

export type EdgeMark = 'normal' | 'ok' | 'missing' | 'extra' | 'critical';

interface GraphProps {
  nodes: GNode[];
  /** text under the id (time, duration) */
  sub?: Record<string, string>;
  /** edges to draw; default: the nodes' predecessors */
  edges?: { from: string; to: string; mark?: EdgeMark }[];
  critical?: Set<string>;
  label: string;
}

const COLW = 92;
const ROWH = 64;

export function PrecedenceGraph({ nodes, sub, edges, critical, label }: GraphProps) {
  const pos = layers(nodes);
  const nl = Math.max(...[...pos.values()].map((p) => p.layer)) + 1;
  const maxRows = Math.max(...[...pos.values()].map((p) => p.rows));
  const W = nl * COLW + 20;
  const H = maxRows * ROWH + 20;
  const xy = (id: string) => {
    const p = pos.get(id)!;
    return { x: 10 + p.layer * COLW + COLW / 2, y: 10 + (H - 20) / 2 + (p.row - (p.rows - 1) / 2) * ROWH };
  };
  const es = edges ?? nodes.flatMap((n) => n.preds.map((p) => ({ from: p, to: n.id, mark: 'normal' as EdgeMark })));
  const R = 20;
  return (
    <figure className="diagram">
      <div className="scroll" tabIndex={0}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ maxWidth: W * 1.3, minWidth: Math.min(W * 0.75, 560) }}>
        <defs>
          {(['normal', 'ok', 'missing', 'extra', 'critical'] as EdgeMark[]).map((m) => (
            <marker key={m} id={`arr-${m}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={`edge-head ${m}`} />
            </marker>
          ))}
        </defs>
        {es.map((e) => {
          if (!pos.has(e.from) || !pos.has(e.to)) return null;
          const a = xy(e.from);
          const b = xy(e.to);
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const ux = (b.x - a.x) / len;
          const uy = (b.y - a.y) / len;
          const m = e.mark ?? 'normal';
          return (
            <line
              key={`${e.from}>${e.to}`}
              x1={a.x + ux * R}
              y1={a.y + uy * R}
              x2={b.x - ux * (R + 2)}
              y2={b.y - uy * (R + 2)}
              className={`edge ${m}`}
              markerEnd={`url(#arr-${m})`}
            />
          );
        })}
        {nodes.map((n) => {
          const { x, y } = xy(n.id);
          return (
            <g key={n.id} className={critical?.has(n.id) ? 'node critical' : 'node'}>
              <circle cx={x} cy={y} r={R} />
              <text x={x} y={sub ? y - 2 : y + 5} textAnchor="middle" className="nid">
                {n.id}
              </text>
              {sub?.[n.id] && (
                <text x={x} y={y + 13} textAnchor="middle" className="nsub">
                  {sub[n.id]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      </div>
    </figure>
  );
}

interface CpmBox {
  id: string;
  preds: string[];
  d: string;
  es: string;
  ef: string;
  ls: string;
  lf: string;
  critical: boolean;
}

export function CpmNetwork({ boxes, label }: { boxes: CpmBox[]; label: string }) {
  const { t } = useT();
  const pos = layers(boxes);
  const BW = 96;
  const BH = 58;
  const CW = 130;
  const RH = 78;
  const nl = Math.max(...[...pos.values()].map((p) => p.layer)) + 1;
  const maxRows = Math.max(...[...pos.values()].map((p) => p.rows));
  const W = nl * CW + 10;
  const H = maxRows * RH + 10;
  const xy = (id: string) => {
    const p = pos.get(id)!;
    return { x: 5 + p.layer * CW + (CW - BW) / 2, y: 5 + (H - 10) / 2 + (p.row - (p.rows - 1) / 2) * RH - BH / 2 };
  };
  const crit = new Set(boxes.filter((b) => b.critical).map((b) => b.id));
  return (
    <figure className="diagram">
      <div className="scroll" tabIndex={0}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ maxWidth: W * 1.3, minWidth: Math.min(W * 0.85, 620) }}>
        <defs>
          {(['normal', 'critical'] as const).map((m) => (
            <marker key={m} id={`carr-${m}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={`edge-head ${m}`} />
            </marker>
          ))}
        </defs>
        {boxes.flatMap((b) =>
          b.preds.map((p) => {
            const a = xy(p);
            const c = xy(b.id);
            const m = crit.has(p) && crit.has(b.id) ? 'critical' : 'normal';
            return <line key={`${p}>${b.id}`} x1={a.x + BW} y1={a.y + BH / 2} x2={c.x - 2} y2={c.y + BH / 2} className={`edge ${m}`} markerEnd={`url(#carr-${m})`} />;
          }),
        )}
        {boxes.map((b) => {
          const { x, y } = xy(b.id);
          return (
            <g key={b.id} className={b.critical ? 'box critical' : 'box'}>
              <rect x={x} y={y} width={BW} height={BH} rx={6} />
              <line x1={x} y1={y + BH / 2} x2={x + BW} y2={y + BH / 2} />
              <line x1={x + BW / 3} y1={y} x2={x + BW / 3} y2={y + BH} />
              <line x1={x + (2 * BW) / 3} y1={y} x2={x + (2 * BW) / 3} y2={y + BH} />
              <text x={x + BW / 6} y={y + 19} textAnchor="middle">{b.es}</text>
              <text x={x + BW / 2} y={y + 19} textAnchor="middle" className="nid">{b.id}</text>
              <text x={x + (5 * BW) / 6} y={y + 19} textAnchor="middle">{b.ef}</text>
              <text x={x + BW / 6} y={y + BH - 10} textAnchor="middle">{b.ls}</text>
              <text x={x + BW / 2} y={y + BH - 10} textAnchor="middle" className="nsub">{b.d}</text>
              <text x={x + (5 * BW) / 6} y={y + BH - 10} textAnchor="middle">{b.lf}</text>
            </g>
          );
        })}
      </svg>
      </div>
      <figcaption className="legend">
        <span>ES | id | EF</span> <span>LS | d | LF</span> <span className="lg critical"><i aria-hidden="true">━</i> {t('legend.critical')}</span>
      </figcaption>
    </figure>
  );
}

export interface Station {
  tasks: { id: string; t: number }[];
}

export function StationBoard({ stations, c, unit, label, dashed }: { stations: Station[]; c: number; unit: string; label: string; dashed?: boolean }) {
  const loads = stations.map((s) => s.tasks.reduce((a, x) => a + x.t, 0));
  const top = Math.max(c, ...loads) * 1.12;
  const BW = 46;
  const GAP = 18;
  const H = 200;
  const W = 40 + stations.length * (BW + GAP);
  const y = (v: number) => 10 + (H - 40) * (1 - v / top);
  return (
    <figure className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ maxWidth: Math.max(W * 1.4, 260) }}>
        <line x1={34} y1={y(0)} x2={W - 4} y2={y(0)} className="axis" />
        {stations.map((s, k) => {
          let acc = 0;
          const x0 = 40 + k * (BW + GAP);
          return (
            <g key={k} className={`st st${k % 6}${dashed ? ' user' : ''}`}>
              {s.tasks.map((task) => {
                const y1 = y(acc + task.t);
                const h = y(acc) - y1;
                acc += task.t;
                return (
                  <g key={task.id}>
                    <rect x={x0} y={y1} width={BW} height={h} />
                    {h > 13 && (
                      <text x={x0 + BW / 2} y={y1 + h / 2 + 5} textAnchor="middle">
                        {task.id}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={x0 + BW / 2} y={H - 12} textAnchor="middle" className="stlbl">
                {k + 1}
              </text>
              <text x={x0 + BW / 2} y={y(loads[k]!) - 4} textAnchor="middle" className="stload">
                {String(loads[k]).replace('.', ',')}
              </text>
            </g>
          );
        })}
        <line x1={34} y1={y(c)} x2={W - 4} y2={y(c)} className="cline" />
        <text x={30} y={y(c) + 4} textAnchor="end" className="clbl">
          C
        </text>
      </svg>
      <figcaption className="legend">
        <span className="lg cline"><i aria-hidden="true">‒ ‒</i> C = {String(c).replace('.', ',')} {unit}</span>
      </figcaption>
    </figure>
  );
}

export interface GanttRow {
  label: string;
  bars: { from: number; to: number; text?: string; kind: 'task' | 'critical' | 'slack' | 'idle' }[];
}

export function Gantt({ rows, total, label, unit }: { rows: GanttRow[]; total: number; label: string; unit: string }) {
  const LW = 46;
  const RH = 26;
  const W = 520;
  const H = rows.length * RH + 34;
  const sx = (v: number) => LW + ((W - LW - 10) * v) / (total || 1);
  const step = total <= 15 ? 1 : total <= 40 ? 5 : total <= 100 ? 10 : 20;
  const ticks: number[] = [];
  for (let v = 0; v <= total; v += step) ticks.push(v);
  return (
    <figure className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={sx(v)} y1={4} x2={sx(v)} y2={H - 22} className="grid" />
            <text x={sx(v)} y={H - 8} textAnchor="middle" className="tick">
              {v}
            </text>
          </g>
        ))}
        {rows.map((r, i) => (
          <g key={r.label + i}>
            <text x={LW - 6} y={8 + i * RH + 14} textAnchor="end" className="nid">
              {r.label}
            </text>
            {r.bars.map((b, k) => (
              <g key={k} className={`gbar ${b.kind}`}>
                <rect x={sx(b.from)} y={6 + i * RH} width={Math.max(0, sx(b.to) - sx(b.from))} height={RH - 8} rx={3} />
                {b.text && sx(b.to) - sx(b.from) > 18 && (
                  <text x={(sx(b.from) + sx(b.to)) / 2} y={6 + i * RH + 13} textAnchor="middle">
                    {b.text}
                  </text>
                )}
              </g>
            ))}
          </g>
        ))}
      </svg>
      <figcaption className="legend">
        <span>{unit}</span>
      </figcaption>
    </figure>
  );
}

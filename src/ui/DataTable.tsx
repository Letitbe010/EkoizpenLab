/** Data of an exercise as a table (always visible; it is also the text alternative of the figures). */
import type { Exercise } from '../core/model';
import { useT } from '../i18n';
import { fmtR } from './format';

export function DataTable({ ex }: { ex: Exercise }) {
  const { t } = useT();
  const p = ex.problem;
  return (
    <div className="data">
      <h2 className="sec">{t('data.title')}</h2>
      <div className="scroll">
        {p.kind === 'balancing' && (
          <table className="dtable">
            <thead>
              <tr>
                <th>{t('data.task')}</th>
                <th>{t('data.time', { u: p.unit })}</th>
                <th>{t('data.preds')}</th>
              </tr>
            </thead>
            <tbody>
              {p.tasks.map((x) => (
                <tr key={x.id}>
                  <th>{x.id}</th>
                  <td>{fmtR(x.t)}</td>
                  <td className="l">{x.preds.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {p.kind === 'project' && (
          <table className="dtable">
            <thead>
              <tr>
                <th>{t('data.activity')}</th>
                <th>{t('data.preds')}</th>
                {p.activities[0]?.pert ? (
                  <>
                    <th>a</th>
                    <th>m</th>
                    <th>b</th>
                  </>
                ) : (
                  <th>{t('data.duration')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {p.activities.map((a) => (
                <tr key={a.id}>
                  <th>{a.id}</th>
                  <td className="l">{a.preds.join(', ') || '—'}</td>
                  {a.pert ? a.pert.map((v, i) => <td key={i}>{fmtR(v)}</td>) : <td>{a.d ? fmtR(a.d) : ''}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {p.kind === 'flowshop' && (
          <table className="dtable">
            <thead>
              <tr>
                <th>{t('data.job')}</th>
                {p.jobs.map((j) => (
                  <th key={j.id}>{j.id}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>M1</th>
                {p.jobs.map((j) => (
                  <td key={j.id}>{fmtR(j.p1)}</td>
                ))}
              </tr>
              <tr>
                <th>M2</th>
                {p.jobs.map((j) => (
                  <td key={j.id}>{fmtR(j.p2)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

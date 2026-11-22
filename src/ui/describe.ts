/** Titles and labels of exercises and asks (i18n keys). */
import { TEMPLATES, type TemplateId } from '../core/generator';
import type { Ask, Exercise } from '../core/model';
import * as R from '../core/rational';
import { fmtN } from './format';

type T = (k: string, v?: Record<string, string | number>) => string;

export const letter = (i: number): string => `${String.fromCharCode(97 + i)})`;

export function templateOf(ex: Exercise): TemplateId | undefined {
  if (ex.origin !== 'generated') return undefined;
  const t = ex.id.split('-')[0] as TemplateId;
  return TEMPLATES.includes(t) ? t : undefined;
}

export function exerciseTitle(ex: Exercise, t: T): string {
  if (ex.origin !== 'generated') return t(`pool.${ex.id}`);
  const tpl = templateOf(ex);
  return tpl ? t(`tpl.${tpl}`) : ex.id;
}

export function askLabel(ask: Ask, t: T): string {
  switch (ask.kind) {
    case 'efficiency':
      if ((ask.scope ?? 'line') === 'line') return t('ask.efficiency');
      return ask.station === 'last' || ask.station === undefined ? t('ask.efficiencyLast') : t('ask.efficiencyStation', { k: ask.station });
    case 'pert':
      return t(`ask.pert.${ask.pertWhat ?? 'variance'}`, {
        t: ask.t ? fmtN(R.toNumber(ask.t)) : '',
        p: ask.prob !== undefined ? fmtN(100 * ask.prob, 1) : '',
      });
    case 'johnson':
      return t(`ask.johnson.${ask.johnsonWhat ?? 'sequence'}`);
    case 'criticalPath':
      return t(ask.criticalMode === 'any' ? 'ask.criticalPathAny' : 'ask.criticalPath');
    case 'cpmTable':
      return ask.fields ? t('ask.cpmTableFields', { f: ask.fields.map((f) => t(`cpm.${f}`)).join(', ') }) : t('ask.cpmTable');
    default:
      return t(`ask.${ask.kind}`);
  }
}

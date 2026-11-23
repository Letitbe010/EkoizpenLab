/** UI helpers (pure functions): parsing, formatting, routes, i18n completeness, solution texts. */
import { readFileSync } from 'node:fs';
import { generate, LEVELS, TEMPLATES } from '../src/core/generator';
import * as R from '../src/core/rational';
import { POOL } from '../src/data/pool';
import { DICT, translate } from '../src/i18n';
import { askLabel, exerciseTitle } from '../src/ui/describe';
import { fmtN, fmtR, showGraded } from '../src/ui/format';
import { parsePaths, splitIds } from '../src/ui/parse';
import { hrefOf, parseHash } from '../src/ui/router';
import { solutionLines } from '../src/ui/solution';

describe('ui: parsing of free-text answers', () => {
  it('task lists and paths', () => {
    expect(splitIds(' a, b ;c d ')).toEqual(['A', 'B', 'C', 'D']);
    expect(splitIds('')).toEqual([]);
    expect(parsePaths('B-D-E; a – c – e')).toEqual([['B', 'D', 'E'], ['A', 'C', 'E']]);
    expect(parsePaths('A→B→C')).toEqual([['A', 'B', 'C']]);
  });
});

describe('ui: formatting', () => {
  it('exact values with decimal comma', () => {
    expect(fmtR(R.q(12))).toBe('12');
    expect(fmtR(R.q(5, 2))).toBe('2,5');
    expect(fmtR(R.q(40, 3))).toBe('40/3 ≈ 13,333');
    expect(fmtR(R.q(-1, 4))).toBe('−0,25');
    expect(fmtN(91.6667, 2)).toBe('91,67');
    expect(fmtN(-0.0001, 2)).toBe('0');
    expect(showGraded('40/3 min')).toBe('40/3 ≈ 13,333 min');
    expect(showGraded('90.00 %')).toBe('90,00 %');
  });
});

describe('ui: routes', () => {
  it('parse and build are inverse', () => {
    for (const r of [
      { name: 'practice' },
      { name: 'generated', template: 'cpm', level: 3, seed: 42 },
      { name: 'pool', id: 'ope-euskadi-2020-6' },
      { name: 'soon', section: 'aurrerapena' },
      { name: 'theory' },
      { name: 'theoryTopic', id: 'cpm' },
      { name: 'worked' },
      { name: 'workedItem', id: 'gantt' },
      { name: 'start' },
    ] as const)
      expect(parseHash(hrefOf(r))).toEqual(r);
    expect(parseHash('#/zerbait')).toEqual({ name: 'start' });
  });
});

describe('ui: i18n', () => {
  it('eu and es have the same keys, no empty strings', () => {
    expect(Object.keys(DICT.es).sort()).toEqual(Object.keys(DICT.eu).sort());
    for (const lang of ['eu', 'es'] as const) for (const [k, v] of Object.entries(DICT[lang])) expect(v.trim(), `${lang} ${k}`).not.toBe('');
  });
  it('every diagnosis and note id of the grader has a text', () => {
    const src = readFileSync('src/core/grader.ts', 'utf8');
    const block = (name: string) => src.slice(src.indexOf(`export type ${name} =`), src.indexOf(';', src.indexOf(`export type ${name} =`)));
    const ids = (name: string) => [...block(name).matchAll(/'([a-z-]+)'/g)].map((m) => m[1]!);
    for (const d of ids('DiagnosisId')) expect(DICT.eu[`diag.${d}`], d).toBeTruthy();
    for (const n of ids('NoteId')) expect(DICT.eu[`note.${n}`], n).toBeTruthy();
  });
});

describe('ui: titles, labels and solution texts of every pool and template exercise', () => {
  const exercises = [...POOL, ...TEMPLATES.flatMap((t) => LEVELS[t].map((lv) => generate(t, 3, lv).exercise))];
  for (const lang of ['eu', 'es'] as const) {
    const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
    it(`${lang}: no missing key, no NaN / undefined / unfilled placeholder`, () => {
      for (const ex of exercises) {
        const texts = [exerciseTitle(ex, t), ...(ex.origin !== 'generated' ? [t(`poolNote.${ex.id}`)] : []), ...ex.asks.map((a) => askLabel(a, t)), ...ex.asks.flatMap((a) => solutionLines(ex, a, t))];
        for (const s of texts) {
          expect(s, ex.id).not.toMatch(/NaN|undefined|\{[a-z]+\}|^(ask|pool|poolNote|tpl|sol|heur|tie)\./);
          expect(s.length, ex.id).toBeGreaterThan(0);
        }
      }
    });
  }
});

/**
 * Theory content model (spec §14). Texts are templates: numbers in examples come from the
 * solvers through {{…}} variables (src/ui/theoryTemplate.ts), computed on a verified pool
 * exercise. Formulas are LaTeX (KaTeX); a formula with `check` is tested against the
 * solvers on 1000 random cases (tests/theory.test.ts).
 *
 * Deviation from the spec (agreed for the Lab apps): structured TypeScript data, not MDX.
 */
export type FormulaId =
  | 'cycle-time'
  | 'n-min'
  | 'rpw'
  | 'efficiency'
  | 'idle'
  | 'station-efficiency'
  | 'cpm-forward'
  | 'cpm-backward'
  | 'floats';

export type Bi = { eu: string; es: string };

export type Block =
  | ({ t: 'p' } & Bi)
  | ({ t: 'h' } & Bi)
  /** texEs: Spanish version when the formula contains words */
  | { t: 'f'; tex: string; texEs?: string; check?: FormulaId }
  | { t: 'list'; eu: string[]; es: string[] }
  | ({ t: 'note'; kind: 'careful' | 'ope' } & Bi)
  /** worked example on a pool exercise; {{…}} variables are filled from the solvers */
  | ({ t: 'example'; pool: string } & Bi)
  | { t: 'widget'; w: 'balancing' | 'cpm' };

export interface Topic {
  id: string;
  title: Bi;
  status: 'draft' | 'reviewed';
  blocks: Block[];
}

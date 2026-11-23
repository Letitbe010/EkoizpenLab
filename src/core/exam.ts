/**
 * Exam mode (spec §13.1): three exercises like an OPE production-programming block — line
 * balancing, a project (CPM or PERT, by the seed's parity) and Johnson — all fixed by one
 * seed so an exam can be repeated. Graded only at the end; the exam score is the mean of the
 * three scores (0–10, one decimal).
 */
import { generate, type TemplateId } from './generator';
import type { Exercise } from './model';

export const EXAM_MINUTES = [30, 45, 60, 90] as const;
export const EXAM_DEFAULT_MINUTES = 45;

/** Template and level of the three exercises of exam `seed`. */
export function examPlan(seed: number): { template: TemplateId; level: 1 | 2 | 3 }[] {
  return [
    { template: 'balancing', level: seed % 3 === 0 ? 3 : 2 },
    seed % 2 === 0 ? { template: 'pert', level: 2 } : { template: 'cpm', level: 2 },
    { template: 'johnson', level: 2 },
  ];
}

/** Seed of exercise k of exam `seed`: deterministic and distinct per exercise. */
export const examExerciseSeed = (seed: number, k: number): number => (seed * 7 + (k + 1) * 104_729) % 2_147_483_647;

export function examExercises(seed: number): Exercise[] {
  return examPlan(seed).map((p, k) => {
    const ex = generate(p.template, examExerciseSeed(seed, k), p.level).exercise;
    return { ...ex, id: `exam-${seed}-${k + 1}` };
  });
}

export function examScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

/** Remaining seconds (never negative). */
export function remainingSeconds(startedAt: number, minutes: number, now: number): number {
  return Math.max(0, Math.ceil((startedAt + minutes * 60_000 - now) / 1000));
}

export const formatClock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

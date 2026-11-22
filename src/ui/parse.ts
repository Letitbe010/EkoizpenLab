/** Parsing of the free-text answers (task lists and paths). */

/** "A, B" / "A B" / "a;b" → ["A", "B"] */
export const splitIds = (s: string): string[] =>
  s
    .toUpperCase()
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);

/** "B-D-E; A-C-E" → [["B","D","E"], ["A","C","E"]] */
export const parsePaths = (s: string): string[][] =>
  s
    .toUpperCase()
    .split(/[;|\n]+/)
    .map((p) => p.split(/[\s,\-–>→]+/).filter(Boolean))
    .filter((p) => p.length > 0);

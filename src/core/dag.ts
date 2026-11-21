/**
 * Precedence graphs (DAG): validation, topological order, followers, redundant edges.
 *
 * A node is anything with an `id` and a list of predecessor ids (tasks, activities).
 */

export interface Node {
  id: string;
  preds: string[];
}

export class DagError extends Error {
  override name = 'DagError';
}

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Throws DagError if ids are empty or repeated, a predecessor is unknown, repeated or the
 * node itself, or the graph has a cycle.
 */
export function validateDag(nodes: readonly Node[]): void {
  const ids = new Set<string>();
  for (const n of nodes) {
    if (n.id.trim() === '') throw new DagError('empty id');
    if (ids.has(n.id)) throw new DagError(`repeated id ${n.id}`);
    ids.add(n.id);
  }
  for (const n of nodes) {
    const seen = new Set<string>();
    for (const p of n.preds) {
      if (p === n.id) throw new DagError(`${n.id} precedes itself`);
      if (!ids.has(p)) throw new DagError(`${n.id}: unknown predecessor ${p}`);
      if (seen.has(p)) throw new DagError(`${n.id}: repeated predecessor ${p}`);
      seen.add(p);
    }
  }
  if (topoOrder(nodes).length !== nodes.length) throw new DagError('the precedence graph has a cycle');
}

/**
 * Kahn's algorithm; among ready nodes the smallest id goes first, so the order is
 * deterministic. Returns fewer ids than nodes if there is a cycle (validateDag uses that).
 */
export function topoOrder(nodes: readonly Node[]): string[] {
  const indeg = new Map<string, number>();
  const succ = successors(nodes);
  for (const n of nodes) indeg.set(n.id, n.preds.length);
  const ready = nodes.filter((n) => n.preds.length === 0).map((n) => n.id).sort(byId);
  const out: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    out.push(id);
    for (const s of succ.get(id) ?? []) {
      const k = indeg.get(s)! - 1;
      indeg.set(s, k);
      if (k === 0) {
        ready.push(s);
        ready.sort(byId);
      }
    }
  }
  return out;
}

/** Immediate successors of every node (sorted ids). */
export function successors(nodes: readonly Node[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const n of nodes) m.set(n.id, []);
  for (const n of nodes) for (const p of n.preds) m.get(p)?.push(n.id);
  for (const v of m.values()) v.sort(byId);
  return m;
}

/** All (transitive) followers of every node: tasks that cannot start before it ends. */
export function allFollowers(nodes: readonly Node[]): Map<string, Set<string>> {
  const succ = successors(nodes);
  const order = topoOrder(nodes).reverse();
  const m = new Map<string, Set<string>>();
  for (const id of order) {
    const s = new Set<string>();
    for (const c of succ.get(id) ?? []) {
      s.add(c);
      for (const f of m.get(c) ?? []) s.add(f);
    }
    m.set(id, s);
  }
  return m;
}

/**
 * Edges p→n that are implied by other paths (transitive, redundant). The precedence
 * diagram is drawn without them (spec §8.2: redundant edges are accepted with a note).
 */
export function redundantEdges(nodes: readonly Node[]): [string, string][] {
  const fol = allFollowers(nodes);
  const out: [string, string][] = [];
  for (const n of nodes) {
    for (const p of n.preds) {
      const viaOther = n.preds.some((o) => o !== p && fol.get(p)?.has(o));
      if (viaOther) out.push([p, n.id]);
    }
  }
  return out;
}

import { DagError, allFollowers, redundantEdges, topoOrder, validateDag } from '../src/core/dag';

const g = (spec: Record<string, string[]>) => Object.entries(spec).map(([id, preds]) => ({ id, preds }));

describe('dag', () => {
  const eg1 = g({ A: [], B: ['A'], C: ['A'], D: ['B'], E: ['C'], F: ['D', 'E'], G: ['F'] });

  it('topological order is deterministic (smallest ready id first)', () => {
    expect(topoOrder(eg1)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(topoOrder(g({ Z: [], Y: [], X: ['Z'] }))).toEqual(['Y', 'Z', 'X']);
  });

  it('rejects cycles, unknown, repeated and self predecessors', () => {
    expect(() => validateDag(g({ A: ['B'], B: ['A'] }))).toThrow(DagError);
    expect(() => validateDag(g({ A: ['A'] }))).toThrow(DagError);
    expect(() => validateDag(g({ A: ['X'] }))).toThrow(DagError);
    expect(() => validateDag(g({ A: [], B: ['A', 'A'] }))).toThrow(DagError);
    expect(() => validateDag([{ id: 'A', preds: [] }, { id: 'A', preds: [] }])).toThrow(DagError);
    expect(() => validateDag(eg1)).not.toThrow();
  });

  it('transitive followers', () => {
    const f = allFollowers(eg1);
    expect([...f.get('A')!].sort()).toEqual(['B', 'C', 'D', 'E', 'F', 'G']);
    expect([...f.get('C')!].sort()).toEqual(['E', 'F', 'G']);
    expect(f.get('G')!.size).toBe(0);
  });

  it('redundant (transitive) edges', () => {
    expect(redundantEdges(eg1)).toEqual([]);
    expect(redundantEdges(g({ A: [], B: ['A'], C: ['A', 'B'] }))).toEqual([['A', 'C']]);
  });
});

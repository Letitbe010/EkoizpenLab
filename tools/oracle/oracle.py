"""Independent Python oracle for EkoizpenLab (spec §5.4).

Usage: python tools/oracle/oracle.py OUT.json tests/golden/golden.json [more problem files...]

For every balancing problem found in the input files it computes, with fractions.Fraction
and networkx and without sharing any code with the TypeScript solvers:
  C, N_min, the heuristic assignment (LTT / most followers / RPW, with the tie rule) and the
  exact minimum number of stations (minimum over all topological orders of the greedy
  sequential packing, which is optimal for small graphs).
tests/oracle.test.ts compares the result with solvers A and B.
"""

from __future__ import annotations

import json
import math
import random
import sys
from fractions import Fraction
from pathlib import Path

import networkx as nx


def frac(s: str) -> Fraction:
    return Fraction(s.replace(",", "."))


def fstr(x: Fraction) -> str:
    return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"


def graph(tasks: list[dict]) -> nx.DiGraph:
    g = nx.DiGraph()
    for t in tasks:
        g.add_node(t["id"])
    for t in tasks:
        for p in t["preds"]:
            g.add_edge(p, t["id"])
    if not nx.is_directed_acyclic_graph(g):
        raise ValueError("cycle")
    return g


def heuristic(p: dict, g: nx.DiGraph, times: dict[str, Fraction], c: Fraction, h: str, tie: str) -> list[list[str]]:
    desc = {i: nx.descendants(g, i) for i in g.nodes}

    def key(i: str):
        if h == "LTT":
            v = times[i]
        elif h == "mostFollowers":
            v = Fraction(len(desc[i]))
        else:
            v = times[i] + sum((times[j] for j in desc[i]), Fraction(0))
        second = times[i] if tie == "shortest" else (-len(desc[i]) if tie == "mostFollowers" else 0)
        return (-v, second, i)

    done: set[str] = set()
    out: list[list[str]] = []
    while len(done) < len(times):
        st: list[str] = []
        free = c
        while True:
            cands = [i for i in times if i not in done and all(x in done for x in g.predecessors(i)) and times[i] <= free]
            if not cands:
                break
            best = min(cands, key=key)
            st.append(best)
            done.add(best)
            free -= times[best]
        out.append(st)
    return out


def optimal(g: nx.DiGraph, times: dict[str, Fraction], c: Fraction) -> int:
    best = math.inf
    for order in nx.all_topological_sorts(g):
        k, load = 1, Fraction(0)
        for i in order:
            if load + times[i] > c:
                k, load = k + 1, times[i]
            else:
                load += times[i]
            if k >= best:
                break
        best = min(best, k)
    return int(best)


def balancing(p: dict) -> dict:
    times = {t["id"]: frac(t["t"]) for t in p["tasks"]}
    g = graph(p["tasks"])
    c = frac(p["available"]) / p["demand"]
    total = sum(times.values(), Fraction(0))
    res = {"c": fstr(c), "sumT": fstr(total), "nMin": math.ceil(total / c), "nOptimal": optimal(g, times, c), "assignments": {}}
    for h in ("LTT", "mostFollowers", "RPW"):
        for tie in ("alpha", "shortest", "mostFollowers"):
            st = heuristic(p, g, times, c, h, tie)
            n = len(st)
            res["assignments"][f"{h}/{tie}"] = {"stations": st, "efficiency": fstr(total / (n * c))}
    return res


def random_balancing(seed: int) -> dict:
    """Seeded random problem, generated here (not by the TS code) so both sides are independent."""
    rnd = random.Random(seed)
    n = rnd.randint(4, 8)  # all_topological_sorts stays small
    names = [chr(65 + i) for i in range(n)]
    times = [rnd.randint(1, 12) for _ in names]
    density = rnd.uniform(0.15, 0.6)
    tasks = [{"id": names[i], "t": str(times[i]), "preds": [names[j] for j in range(i) if rnd.random() < density]} for i in range(n)]
    demand = rnd.randint(1, 60)
    cnum = max(times) * rnd.randint(2, 6) + rnd.randint(0, 5)  # C = cnum/2 >= max t, sometimes non-integer
    return {"kind": "balancing", "unit": "min", "available": f"{cnum * demand}/2", "demand": demand, "tasks": tasks}


def main() -> None:
    out_path = Path(sys.argv[1])
    results: dict[str, dict] = {}
    for seed in range(1, 201):
        prob = random_balancing(seed)
        results[f"random-{seed}"] = {"problem": prob, **balancing(prob)}
    for f in sys.argv[2:]:
        data = json.loads(Path(f).read_text(encoding="utf-8"))
        for key, case in data.items():
            if isinstance(case, dict) and case.get("problem", {}).get("kind") == "balancing":
                results[key] = {"problem": case["problem"], **balancing(case["problem"])}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"oracle: {len(results)} balancing problems -> {out_path}")


if __name__ == "__main__":
    main()

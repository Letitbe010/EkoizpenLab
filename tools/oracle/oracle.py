"""Independent Python oracle for EkoizpenLab (spec §5.4).

Usage: python tools/oracle/oracle.py OUT.json tests/golden/golden.json [more problem files...]

Besides the problems in the input files it solves 200 seeded random problems of each kind
(balancing, CPM, PERT, flow shop), generated here. Projects: networkx longest paths and
all simple paths; PERT probability with scipy.stats.norm; flow shop: every permutation
(itertools) and Johnson's rule in its U/V form.

For every balancing problem it computes, with fractions.Fraction
and networkx and without sharing any code with the TypeScript solvers:
  C, N_min, the heuristic assignment (LTT / most followers / RPW, with the tie rule) and the
  exact minimum number of stations (minimum over all topological orders of the greedy
  sequential packing, which is optimal for small graphs).
tests/oracle.test.ts compares the result with solvers A and B.
"""

from __future__ import annotations

import itertools
import json
import math
import random
import sys
from fractions import Fraction
from pathlib import Path

import networkx as nx
from scipy.stats import norm


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


# ----------------------------------------------------------------------------- projects


def te_of(a: dict) -> Fraction:
    if "d" in a:
        return frac(a["d"])
    x, m, y = (frac(v) for v in a["pert"])
    return (x + 4 * m + y) / 6


def project(p: dict) -> dict:
    acts = p["activities"]
    d = {a["id"]: te_of(a) for a in acts}
    g = nx.DiGraph()
    g.add_node("__S")
    g.add_node("__T")
    for a in acts:
        if not a["preds"]:
            g.add_edge("__S", a["id"], weight=0)
        for x in a["preds"]:
            g.add_edge(x, a["id"], weight=d[x])
    for a in acts:
        if g.out_degree(a["id"]) == 0:
            g.add_edge(a["id"], "__T", weight=d[a["id"]])
    if not nx.is_directed_acyclic_graph(g):
        raise ValueError("cycle")
    total = Fraction(nx.dag_longest_path_length(g, weight="weight"))

    def plen(path: list[str]) -> Fraction:
        return sum((g[u][v]["weight"] for u, v in zip(path, path[1:])), Fraction(0))

    paths = list(nx.all_simple_paths(g, "__S", "__T"))
    critical = sorted(([x for x in pth if not x.startswith("__")] for pth in paths if plen(pth) == total), key="-".join)
    es, ls = {}, {}
    for a in acts:
        i = a["id"]
        es[i] = max(plen(pth) for pth in nx.all_simple_paths(g, "__S", i))
        ls[i] = total - max(plen(pth) for pth in nx.all_simple_paths(g, i, "__T"))
    res = {
        "duration": fstr(total),
        "criticalPaths": critical,
        "es": {k: fstr(v) for k, v in es.items()},
        "ls": {k: fstr(v) for k, v in ls.items()},
        "tf": {k: fstr(ls[k] - es[k]) for k in es},
    }
    if all("pert" in a for a in acts):
        var = {a["id"]: ((frac(a["pert"][2]) - frac(a["pert"][0])) / 6) ** 2 for a in acts}
        pv = [sum((var[x] for x in pth), Fraction(0)) for pth in critical]
        best = max(pv)
        res["projectVariance"] = fstr(best)
        if "deadline" in p:
            z = float(frac(p["deadline"]) - total) / math.sqrt(best)
            res["probability"] = float(norm.cdf(z))
    return res


def random_project(seed: int, with_pert: bool) -> dict:
    rnd = random.Random(seed)
    n = rnd.randint(3, 10)
    names = [chr(65 + i) for i in range(n)]
    density = rnd.uniform(0.15, 0.6)
    acts = []
    for i in range(n):
        preds = [names[j] for j in range(i) if rnd.random() < density]
        m = rnd.randint(1, 10)
        if with_pert:
            acts.append({"id": names[i], "preds": preds, "pert": [str(max(1, m - rnd.randint(0, 6))), str(m), str(m + rnd.randint(1, 8))]})
        else:
            acts.append({"id": names[i], "preds": preds, "d": str(m)})
    out = {"kind": "project", "activities": acts}
    if with_pert:
        out["deadline"] = str(rnd.randint(5, 45))
    return out


# ----------------------------------------------------------------------------- flow shop


def makespan(jobs: dict[str, tuple[Fraction, Fraction]], seq) -> Fraction:
    c1 = c2 = Fraction(0)
    for j in seq:
        c1 += jobs[j][0]
        c2 = max(c1, c2) + jobs[j][1]
    return c2


def flowshop(p: dict) -> dict:
    jobs = {j["id"]: (frac(j["p1"]), frac(j["p2"])) for j in p["jobs"]}
    spans = {seq: makespan(jobs, seq) for seq in itertools.permutations(jobs)}
    best = min(spans.values())
    # Johnson's rule written from its textbook statement: U (p1 < p2) by p1 ascending, then
    # V (p1 >= p2) by p2 descending; ties by input order. It is one of the Johnson sequences.
    order = list(jobs)
    u = sorted([j for j in order if jobs[j][0] < jobs[j][1]], key=lambda j: (jobs[j][0], order.index(j)))
    v = sorted([j for j in order if jobs[j][0] >= jobs[j][1]], key=lambda j: (-jobs[j][1], order.index(j)))
    return {
        "optimal": fstr(best),
        "optimalSequences": sorted((list(s) for s, m in spans.items() if m == best), key="-".join),
        "johnsonUV": u + v,
    }


def random_flowshop(seed: int) -> dict:
    rnd = random.Random(seed)
    n = rnd.randint(2, 7)
    return {"kind": "flowshop", "jobs": [{"id": f"J{i + 1}", "p1": str(rnd.randint(1, 9)), "p2": str(rnd.randint(1, 9))} for i in range(n)]}


SOLVERS = {"balancing": balancing, "project": project, "flowshop": flowshop}


def main() -> None:
    out_path = Path(sys.argv[1])
    results: dict[str, dict[str, dict]] = {"balancing": {}, "project": {}, "flowshop": {}}

    def put(key: str, prob: dict) -> None:
        results[prob["kind"]][key] = {"problem": prob, **SOLVERS[prob["kind"]](prob)}

    for seed in range(1, 201):
        put(f"random-{seed}", random_balancing(seed))
        put(f"cpm-{seed}", random_project(seed, False))
        put(f"pert-{seed}", random_project(seed, True))
        put(f"fs-{seed}", random_flowshop(seed))
    for f in sys.argv[2:]:
        data = json.loads(Path(f).read_text(encoding="utf-8"))
        for key, case in data.items():
            if isinstance(case, dict) and case.get("problem", {}).get("kind") in SOLVERS:
                put(key, case["problem"])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print("oracle: " + ", ".join(f"{len(v)} {k}" for k, v in results.items()) + f" -> {out_path}")


if __name__ == "__main__":
    main()

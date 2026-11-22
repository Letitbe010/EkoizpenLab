/**
 * Statements of generated exercises (eu / es, terminology of spec §13.3). The data table and
 * the list of asks are shown by the UI; the statement gives the context and the rules, so the
 * conventions the grader applies are always explicit (spec §3).
 */
import type { BalancingProblem, FlowShopProblem, Heuristic, ProjectProblem, TieBreak } from '../model';
import * as R from '../rational';

const HEUR: Record<Heuristic, { eu: string; es: string }> = {
  LTT: { eu: 'ataza luzeena lehenik', es: 'tarea más larga primero' },
  mostFollowers: { eu: 'oinordeko gehien dituen ataza lehenik', es: 'tarea con más sucesoras primero' },
  RPW: { eu: 'pisu posizional handiena lehenik', es: 'mayor peso posicional primero' },
};
const TIE: Record<TieBreak, { eu: string; es: string }> = {
  alpha: { eu: 'ordena alfabetikoa', es: 'orden alfabético' },
  shortest: { eu: 'ataza laburrena', es: 'la tarea más corta' },
  mostFollowers: { eu: 'oinordeko gehien dituena', es: 'la de más sucesoras' },
};

const fmtNum = (x: number): string => String(x).replace('.', ',');

export function balancingText(p: BalancingProblem): { eu: string; es: string } {
  const hours = R.toNumber(p.available) / (p.unit === 's' ? 3600 : 60);
  const u = p.unit === 's' ? 's' : 'min';
  const h = fmtNum(hours);
  const tie = p.tieBreak ?? 'alpha';
  // the last fallback of the solver is always the alphabetical order: say so (spec §3)
  const fallback = tie === 'alpha' ? { eu: '', es: '' } : { eu: '; berdinketak jarraitzen badu, ordena alfabetikoa', es: '; si persiste el empate, orden alfabético' };
  const rule = p.heuristic
    ? {
        eu: ` Esleitu atazak lanpostuei "${HEUR[p.heuristic].eu}" arauarekin; berdinketan, ${TIE[tie].eu}${fallback.eu}.`,
        es: ` Asigna las tareas a las estaciones con la regla «${HEUR[p.heuristic].es}»; en caso de empate, ${TIE[tie].es}${fallback.es}.`,
      }
    : {
        eu: ' Esleipenerako araurik ez da finkatzen: edozein esleipen baliodun onartzen da, lanpostu kopuru minimoarekin.',
        es: ' No se fija regla de asignación: se acepta cualquier asignación válida, con el número mínimo de estaciones.',
      };
  const base =
    (p.efficiencyBase ?? 'C') === 'C'
      ? { eu: ' Efizientzia (eraginkortasuna) ziklo-denborarekin kalkulatu: η = Σt / (N · C).', es: ' Calcula la eficiencia con el tiempo de ciclo: η = Σt / (N · C).' }
      : { eu: ' Efizientzia (eraginkortasuna) lepo-botilaren denborarekin kalkulatu.', es: ' Calcula la eficiencia con el tiempo del cuello de botella.' };
  return {
    eu: `Muntaketa-lerro batek ${p.demand} unitate ekoiztu behar ditu ${h} orduko txandan (etenik gabe). Taulan, unitate bat ekoizteko atazak, haien denborak (${u}) eta aurrekotasunak.${rule.eu}${base.eu}`,
    es: `Una línea de montaje debe producir ${p.demand} unidades en un turno de ${h} horas (sin paradas). En la tabla, las tareas para producir una unidad, sus tiempos (${u}) y sus precedencias.${rule.es}${base.es}`,
  };
}

export function projectText(p: ProjectProblem, isPert: boolean): { eu: string; es: string } {
  if (!isPert) {
    return {
      eu: 'Proiektu baten jarduerak, haien iraupenak (egunak) eta aurrekotasunak taulan daude. Erabili nodoak jardueretan (AON) dituen sarea.',
      es: 'Las actividades de un proyecto, sus duraciones (días) y sus precedencias están en la tabla. Usa la red con los nodos en las actividades (AON).',
    };
  }
  const t = p.deadline ? R.toString(p.deadline) : '?';
  return {
    eu: `Proiektu baten jarduerak taulan daude, hiru estimazioekin (egunak): baikorra (a), probableena (m) eta ezkorra (b). Erabili PERT: te = (a + 4m + b)/6 eta σ² = ((b − a)/6)². Proiektuaren bariantza bide kritikoko bariantzen batura da. Kalkulatu proiektua ${t} egunean edo lehenago amaitzeko probabilitatea.`,
    es: `Las actividades de un proyecto están en la tabla, con tres estimaciones (días): optimista (a), más probable (m) y pesimista (b). Usa PERT: te = (a + 4m + b)/6 y σ² = ((b − a)/6)². La varianza del proyecto es la suma de las varianzas del camino crítico. Calcula la probabilidad de terminar el proyecto en ${t} días o antes.`,
  };
}

export function flowShopText(p: FlowShopProblem): { eu: string; es: string } {
  return {
    eu: `${p.jobs.length} lan bi makinatan egin behar dira, ordena berean: lehenik M1ean, gero M2an. Taulan, lan bakoitzaren denborak (h). Erabili Johnson-en araua. Makina baten denbora hila = makespan-a − makina horretako denboren batura.`,
    es: `${p.jobs.length} trabajos deben pasar por dos máquinas en el mismo orden: primero M1 y después M2. En la tabla, los tiempos de cada trabajo (h). Usa la regla de Johnson. Tiempo ocioso de una máquina = makespan − suma de los tiempos en esa máquina.`,
  };
}

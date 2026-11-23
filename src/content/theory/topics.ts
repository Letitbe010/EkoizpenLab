/**
 * Theory (spec §14.1). Part A: topics 1–6 (here); part B: topics 7–11 (topicsB.ts).
 * Status "draft" until the user reviews the texts.
 * No number is written by hand in the prose: examples use {{…}} variables computed by the
 * solvers on verified pool exercises (src/ui/theoryTemplate.ts).
 */
import status from './status.json';
import { TOPICS_B } from './topicsB';
import type { Topic } from './types';

const st = (id: string): Topic['status'] => ((status.status as Record<string, string>)[id] === 'reviewed' ? 'reviewed' : 'draft');

export const TOPICS: Topic[] = [
  // ------------------------------------------------------------------ 1
  {
    id: 'lines',
    title: { eu: 'Ekoizpen-lerroak: takt-denbora eta ziklo-denbora', es: 'Líneas de producción: takt y tiempo de ciclo' },
    status: st('lines'),
    blocks: [
      {
        t: 'p',
        eu: 'Muntaketa-lerro batean produktua lanpostu batetik bestera igarotzen da, eta lanpostu bakoitzak ataza batzuk egiten ditu. Lerroak eskariaren erritmoan ekoiztu behar du: ez azkarrago (stockak sortzen dira) ez motelago (eskaria ez da betetzen).',
        es: 'En una línea de montaje el producto pasa de una estación a otra, y cada estación realiza algunas tareas. La línea debe producir al ritmo de la demanda: ni más rápido (se generan stocks) ni más despacio (no se cumple la demanda).',
      },
      {
        t: 'p',
        eu: 'Erritmo hori ziklo-denbora da (C): lerroaren amaieratik unitate bat ateratzen den denbora-tartea. Takt-denbora izena ere erabiltzen da, eskaritik kalkulatzen denean. Lanpostu batek ezin du C baino denbora gehiago behar: bestela, lerro osoa moteltzen du.',
        es: 'Ese ritmo es el tiempo de ciclo (C): el intervalo con que sale una unidad al final de la línea. También se llama takt cuando se calcula a partir de la demanda. Ninguna estación puede necesitar más de C: si no, frena toda la línea.',
      },
      { t: 'f', tex: 'C = \\frac{\\text{denbora erabilgarria}}{\\text{demanda}}', texEs: 'C = \\frac{\\text{tiempo disponible}}{\\text{demanda}}', check: 'cycle-time' },
      {
        t: 'list',
        eu: [
          'Denbora erabilgarria = txanda × orduak − etenak (enuntziatuak ematen ditu); unitateak beti esplizitu (min edo s).',
          'C-k ataza luzeena baino handiagoa edo berdina izan behar du; bestela ariketa bideraezina da (ataza zatitu edo lanpostuak bikoiztu beharko lirateke).',
        ],
        es: [
          'Tiempo disponible = turno × horas − paradas (lo da el enunciado); las unidades siempre explícitas (min o s).',
          'C debe ser mayor o igual que la tarea más larga; si no, el ejercicio es inviable (habría que dividir la tarea o duplicar estaciones).',
        ],
      },
      {
        t: 'example',
        pool: 'spec-eg1',
        eu: 'Txandan {{avail}} {{u}} daude eta {{demand}} unitate eskatzen dira: C = {{avail}} / {{demand}} = {{C}} {{u}}/u.',
        es: 'El turno tiene {{avail}} {{u}} y se piden {{demand}} unidades: C = {{avail}} / {{demand}} = {{C}} {{u}}/u.',
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Ez egin alderantziz (demanda / denbora): emaitza unitateak denborako da, ez denbora unitateko.',
        es: 'No lo hagas al revés (demanda / tiempo): el resultado sería unidades por tiempo, no tiempo por unidad.',
      },
    ],
  },

  // ------------------------------------------------------------------ 2
  {
    id: 'precedence',
    title: { eu: 'Aurrekotasun-diagrama: nola eraiki taulatik', es: 'Diagrama de precedencias: cómo construirlo desde la tabla' },
    status: st('precedence'),
    blocks: [
      {
        t: 'p',
        eu: 'Aurrekotasun-taulak ataza bakoitza hasi aurretik amaituta egon behar diren atazak ematen ditu. Diagraman ataza bakoitza nodo bat da (denborarekin), eta gezi bat doa aurreko atazatik ondorengora.',
        es: 'La tabla de precedencias da, para cada tarea, las tareas que deben estar terminadas antes de empezarla. En el diagrama cada tarea es un nodo (con su tiempo) y una flecha va de la tarea anterior a la siguiente.',
      },
      {
        t: 'list',
        eu: [
          'Aurrekorik gabeko atazak ezkerrean jarri (hasiera).',
          'Gero, aurreko guztiak marraztuta dituzten atazak, zutabez zutabe.',
          'Gezi bat aurreko bakoitzetik; diagramak ez du ziklorik izan behar.',
          'Gezi iragankorrak (beste bide batek jada inplikatzen dituenak) ez dira beharrezkoak.',
        ],
        es: [
          'Poner a la izquierda las tareas sin precedentes (inicio).',
          'Después, columna a columna, las tareas cuyas precedentes ya están dibujadas.',
          'Una flecha desde cada precedente; el diagrama no puede tener ciclos.',
          'Las flechas transitivas (ya implícitas por otro camino) no son necesarias.',
        ],
      },
      {
        t: 'example',
        pool: 'spec-eg1',
        eu: 'Taulatik ertz hauek ateratzen dira: {{edges}}. Ertz iragankorrak: {{redundant}}.',
        es: 'De la tabla salen estas flechas: {{edges}}. Flechas transitivas: {{redundant}}.',
      },
      {
        t: 'note',
        kind: 'ope',
        eu: 'OPEan diagramak puntu propioa du: marraztu argi, nodoetan denbora jarrita, eta egiaztatu taulako aurrekotasun guztiak daudela.',
        es: 'En la OPE el diagrama puntúa por sí mismo: dibújalo claro, con el tiempo en los nodos, y comprueba que están todas las precedencias de la tabla.',
      },
    ],
  },

  // ------------------------------------------------------------------ 3
  {
    id: 'balancing',
    title: { eu: 'Lerroaren orekatzea: N_min eta heuristikoak', es: 'Equilibrado de líneas: N_min y heurísticas' },
    status: st('balancing'),
    blocks: [
      {
        t: 'p',
        eu: 'Lan osoa (Σt) C ahalmeneko lanpostuetan banatu behar da. Lanpostu bat ezin da zatitu; beraz, lanpostu kopuru minimo teorikoa goiko osoa da. Muga teorikoa da: aurrekotasunek eta denboren konbinazioek lanpostu gehiago eska ditzakete.',
        es: 'Todo el trabajo (Σt) hay que repartirlo en estaciones de capacidad C. Una estación no se puede partir; por eso el número mínimo teórico de estaciones es el entero superior. Es una cota teórica: las precedencias y las combinaciones de tiempos pueden exigir más estaciones.',
      },
      { t: 'f', tex: 'N_{\\min} = \\left\\lceil \\frac{\\sum t_i}{C} \\right\\rceil', check: 'n-min' },
      {
        t: 'example',
        pool: 'spec-eg1',
        eu: 'Σt = {{sumT}} {{u}} eta C = {{C}} {{u}}: Σt / C = {{ratio}} → N_min = {{nmin}} (beheko osoarekin {{floor}} aterako litzateke, eta lanpostu batek C gaindituko luke).',
        es: 'Σt = {{sumT}} {{u}} y C = {{C}} {{u}}: Σt / C = {{ratio}} → N_min = {{nmin}} (con el entero inferior saldría {{floor}} y alguna estación superaría C).',
      },
      { t: 'h', eu: 'Esleipen-prozedura', es: 'Procedimiento de asignación' },
      {
        t: 'list',
        eu: [
          'Lanpostu bat ireki, denbora librea = C.',
          'Hautagaiak: esleitu gabeko atazak, aurreko guztiak esleituta dituztenak eta denbora librean sartzen direnak.',
          'Heuristikoak lehenesten duen hautagaia esleitu; berdinketan, berdinketa-araua.',
          'Hautagairik ez dagoenean, lanpostua itxi eta beste bat ireki.',
        ],
        es: [
          'Abrir una estación, tiempo libre = C.',
          'Candidatas: tareas sin asignar con todas sus precedentes asignadas y que caben en el tiempo libre.',
          'Asignar la candidata que prioriza la heurística; en empate, la regla de desempate.',
          'Cuando no hay candidatas, cerrar la estación y abrir otra.',
        ],
      },
      {
        t: 'list',
        eu: [
          'Ataza luzeena lehenik (LTT): denbora handiena duena.',
          'Oinordeko gehien: ondoren dituen ataza guztien kopurua (zuzenak eta zeharkakoak).',
          'Pisu posizionala (RPW): ataza beraren denbora gehi bere oinordeko guztien denborak.',
        ],
        es: [
          'Tarea más larga primero (LTT): la de mayor tiempo.',
          'Más sucesoras: número total de tareas que van después (directas e indirectas).',
          'Peso posicional (RPW): tiempo de la propia tarea más los tiempos de todas sus sucesoras.',
        ],
      },
      { t: 'f', tex: 'PW_i = t_i + \\sum_{j \\in \\text{oinordekoak}(i)} t_j', texEs: 'PW_i = t_i + \\sum_{j \\in \\text{sucesoras}(i)} t_j', check: 'rpw' },
      {
        t: 'p',
        eu: 'Heuristikoak arau azkarrak dira, ez metodo optimoak: ez dute bermatzen lanpostu kopuru minimoa. Bi heuristikok esleipen desberdinak eman ditzakete, eta biak baliozkoak izan. Horregatik, enuntziatuak araua eta berdinketa-araua finkatzen dituenean, emaitza bakarra da; finkatzen ez dituenean, edozein esleipen baliodun onartzen da.',
        es: 'Las heurísticas son reglas rápidas, no métodos óptimos: no garantizan el número mínimo de estaciones. Dos heurísticas pueden dar asignaciones distintas y ambas válidas. Por eso, cuando el enunciado fija la regla y el desempate, la solución es única; cuando no los fija, se acepta cualquier asignación válida.',
      },
      {
        t: 'example',
        pool: 'spec-eg1',
        eu: 'Ariketa berean (C = {{C}} {{u}}): LTT → {{rule:LTT}}; oinordeko gehien → {{rule:mostFollowers}}; RPW → {{rule:RPW}}. Optimoa: {{nopt}} lanpostu. Heuristiko batek optimoa baino lanpostu gehiago behar izan ditzake.',
        es: 'En el mismo ejercicio (C = {{C}} {{u}}): LTT → {{rule:LTT}}; más sucesoras → {{rule:mostFollowers}}; RPW → {{rule:RPW}}. Óptimo: {{nopt}} estaciones. Una heurística puede necesitar más estaciones que el óptimo.',
      },
      { t: 'widget', w: 'balancing' },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Hautagai batek bere aurreko guztiak esleituta izan behar ditu (lanpostu berean edo lehenago). Aurreko bat lanpostu berean egon daiteke.',
        es: 'Una candidata debe tener todas sus precedentes asignadas (en la misma estación o antes). Una precedente puede estar en la misma estación.',
      },
    ],
  },

  // ------------------------------------------------------------------ 4
  {
    id: 'efficiency',
    title: { eu: 'Efizientzia, oreka-galera eta denbora hila', es: 'Eficiencia, pérdida de equilibrado y tiempo ocioso' },
    status: st('efficiency'),
    blocks: [
      {
        t: 'p',
        eu: 'Ziklo bakoitzean N lanpostuek N · C denbora dute, eta lanak Σt behar du. Efizientziak (eraginkortasunak) bien arteko zatia neurtzen du; gainerakoa oreka-galera da, eta denbora-unitatetan, denbora hila.',
        es: 'En cada ciclo las N estaciones disponen de N · C, y el trabajo necesita Σt. La eficiencia mide la proporción entre ambos; el resto es la pérdida de equilibrado y, en unidades de tiempo, el tiempo ocioso.',
      },
      {
        t: 'f',
        tex: '\\eta = \\frac{\\sum t_i}{N \\cdot C} \\qquad \\text{oreka-galera} = 1 - \\eta',
        texEs: '\\eta = \\frac{\\sum t_i}{N \\cdot C} \\qquad \\text{pérdida de equilibrado} = 1 - \\eta',
        check: 'efficiency',
      },
      { t: 'f', tex: '\\text{denbora hila} = N \\cdot C - \\sum t_i', texEs: '\\text{tiempo ocioso} = N \\cdot C - \\sum t_i', check: 'idle' },
      { t: 'f', tex: '\\eta_k = \\frac{t_k}{C}', check: 'station-efficiency' },
      {
        t: 'example',
        pool: 'spec-eg1',
        eu: 'Lanpostuak: {{stations}}. η = {{sumT}} / ({{N}} · {{C}}) = {{eta}}; oreka-galera = {{delay}}; denbora hila = {{idle}} {{u}} ziklo bakoitzean.',
        es: 'Estaciones: {{stations}}. η = {{sumT}} / ({{N}} · {{C}}) = {{eta}}; pérdida de equilibrado = {{delay}}; tiempo ocioso = {{idle}} {{u}} por ciclo.',
      },
      {
        t: 'p',
        eu: 'Definizio-aldaera: iturri batzuek C-ren ordez lepo-botilaren denbora erabiltzen dute (lanpostu kargatuenaren denbora). Lerroak benetan lepo-botilaren erritmoan lan egiten badu, hori da efizientzia erreala; eskariarekin alderatzeko, C erabiltzen da. Aplikazio honek C erabiltzen du, ariketak besterik esan ezean.',
        es: 'Variante de definición: algunas fuentes usan el tiempo del cuello de botella (la estación más cargada) en lugar de C. Si la línea trabaja realmente al ritmo del cuello de botella, esa es la eficiencia real; para compararla con la demanda se usa C. Esta aplicación usa C salvo que el ejercicio diga otra cosa.',
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'N benetako lanpostu kopurua da, ez N_min. Lanpostu baten efizientzia ("azken lanpostuarena", adibidez) bere denbora / C da.',
        es: 'N es el número real de estaciones, no N_min. La eficiencia de una estación (por ejemplo, «la de la última») es su tiempo / C.',
      },
      {
        t: 'note',
        kind: 'ope',
        eu: 'Euskadiko OPEan "eraginkortasuna" hitza agertzen da: efizientzia bera da. Idatzi beti zein definizio erabiltzen duzun (C edo lepo-botila).',
        es: 'En la OPE de Euskadi aparece «eraginkortasuna»: es la misma eficiencia. Escribe siempre qué definición usas (C o cuello de botella).',
      },
    ],
  },

  // ------------------------------------------------------------------ 5
  {
    id: 'cpm',
    title: { eu: 'Proiektuak: sareak eta CPM pasaldiak', es: 'Proyectos: redes y pases del CPM' },
    status: st('cpm'),
    blocks: [
      {
        t: 'p',
        eu: 'Proiektu bat aurrekotasunak dituzten jardueren multzoa da. Sarea bi eratara marraz daiteke: nodoak jardueretan (AON), aplikazio honek erabiltzen duena, edo geziak jardueretan eta nodoak gertaeretan (AOA), batzuetan jarduera fiktizioekin.',
        es: 'Un proyecto es un conjunto de actividades con precedencias. La red se puede dibujar de dos formas: nodos en las actividades (AON), la que usa esta aplicación, o flechas en las actividades y nodos en los sucesos (AOA), a veces con actividades ficticias.',
      },
      { t: 'h', eu: 'Aurrerako pasaldia (goiztiarrenak)', es: 'Pase hacia delante (lo más pronto)' },
      {
        t: 'f',
        tex: 'ES_j = \\max_{i \\in \\text{aurrekoak}(j)} EF_i \\quad (0 \\text{ hasieran}) \\qquad EF_j = ES_j + d_j',
        texEs: 'ES_j = \\max_{i \\in \\text{precedentes}(j)} EF_i \\quad (0 \\text{ al inicio}) \\qquad EF_j = ES_j + d_j',
        check: 'cpm-forward',
      },
      { t: 'h', eu: 'Atzerako pasaldia (berantiarrenak)', es: 'Pase hacia atrás (lo más tarde)' },
      {
        t: 'f',
        tex: 'LF_i = \\min_{j \\in \\text{oinordekoak}(i)} LS_j \\quad (T \\text{ amaieran}) \\qquad LS_i = LF_i - d_i',
        texEs: 'LF_i = \\min_{j \\in \\text{sucesoras}(i)} LS_j \\quad (T \\text{ al final}) \\qquad LS_i = LF_i - d_i',
        check: 'cpm-backward',
      },
      {
        t: 'example',
        pool: 'spec-eg2',
        eu: 'Proiektuaren iraupena T = {{T}}; bide kritikoa: {{paths}}. C jarduera ez da kritikoa: ES = {{es:C}}, EF = {{ef:C}}, LS = {{ls:C}}, LF = {{lf:C}}.',
        es: 'Duración del proyecto T = {{T}}; camino crítico: {{paths}}. La actividad C no es crítica: ES = {{es:C}}, EF = {{ef:C}}, LS = {{ls:C}}, LF = {{lf:C}}.',
      },
      {
        t: 'p',
        eu: 'AOA sarean gertaera baten denbora goiztiarra bertara heltzen diren jardueren EF-en maximoa da, eta berantiarra bertatik ateratzen direnen LS-en minimoa. Hau da, jardueren taulatik eratortzen dira.',
        es: 'En la red AOA, el tiempo más temprano de un suceso es el máximo de los EF de las actividades que llegan a él, y el más tardío el mínimo de los LS de las que salen. Es decir, se derivan de la tabla de actividades.',
      },
      { t: 'widget', w: 'cpm' },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Atzerako pasaldian minimoa hartzen da, ez maximoa: jarduera batek bere oinordeko guztiak garaiz hasteko moduan amaitu behar du.',
        es: 'En el pase hacia atrás se toma el mínimo, no el máximo: una actividad debe terminar a tiempo para que empiecen todas sus sucesoras.',
      },
    ],
  },

  // ------------------------------------------------------------------ 6
  {
    id: 'floats',
    title: { eu: 'Holgura totala eta librea', es: 'Holgura total y libre' },
    status: st('floats'),
    blocks: [
      {
        t: 'p',
        eu: 'Holgura totala (HT): jarduera bat zenbat atzera daitekeen proiektua atzeratu gabe. Holgura librea (HL): zenbat atzera daitekeen bere oinordekoen hasiera goiztiarra atzeratu gabe. Librea beti totala baino txikiagoa edo berdina da.',
        es: 'Holgura total (HT): cuánto puede retrasarse una actividad sin retrasar el proyecto. Holgura libre (HL): cuánto puede retrasarse sin retrasar el inicio más temprano de sus sucesoras. La libre siempre es menor o igual que la total.',
      },
      {
        t: 'f',
        tex: 'HT_i = LS_i - ES_i = LF_i - EF_i \\qquad HL_i = \\min_{j \\in \\text{oinordekoak}(i)} ES_j - EF_i',
        texEs: 'HT_i = LS_i - ES_i = LF_i - EF_i \\qquad HL_i = \\min_{j \\in \\text{sucesoras}(i)} ES_j - EF_i',
        check: 'floats',
      },
      {
        t: 'p',
        eu: 'Oinordekorik gabeko jarduera batean, HL = T − EF. Bide kritikoko jarduerek HT = 0 dute; bide kritiko bat baino gehiago egon daiteke.',
        es: 'En una actividad sin sucesoras, HL = T − EF. Las actividades del camino crítico tienen HT = 0; puede haber más de un camino crítico.',
      },
      {
        t: 'example',
        pool: 'spec-eg2',
        eu: 'A jarduera: HT = {{tf:A}}, HL = {{ff:A}}. A atzeratzen bada, C oinordekoaren hasiera goiztiarra ere atzeratzen da (EF(A) = ES(C) = {{es:C}}), nahiz eta proiektua ez. C jarduera: HT = {{tf:C}}, HL = {{ff:C}}.',
        es: 'Actividad A: HT = {{tf:A}}, HL = {{ff:A}}. Si A se retrasa, se retrasa también el inicio más temprano de su sucesora C (EF(A) = ES(C) = {{es:C}}), aunque no el proyecto. Actividad C: HT = {{tf:C}}, HL = {{ff:C}}.',
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Holgura totala bide osoarena da: bide bereko jarduerek partekatzen dute. Bat erabiltzen bada, besteek galdu egiten dute.',
        es: 'La holgura total es del camino: las actividades del mismo camino la comparten. Si una la consume, las demás la pierden.',
      },
    ],
  },
  ...TOPICS_B(st),
];

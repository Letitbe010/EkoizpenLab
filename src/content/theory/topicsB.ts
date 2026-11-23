/**
 * Theory (spec §14.1). Part B: topics 7–11 (PERT, Gantt, Johnson, common mistakes, the OPE).
 * Same rules as part A: no hand-written numbers in the prose; examples use {{…}} variables.
 */
import type { Topic } from './types';

export const TOPICS_B = (st: (id: string) => Topic['status']): Topic[] => [
  // ------------------------------------------------------------------ 7
  {
    id: 'pert',
    title: { eu: 'PERT: hiru estimazio, bariantzak eta probabilitatea', es: 'PERT: tres estimaciones, varianzas y probabilidad' },
    status: st('pert'),
    blocks: [
      {
        t: 'p',
        eu: 'Jardueren iraupena ziurra ez denean, hiru estimazio ematen dira: baikorra (a), probableena (m) eta ezkorra (b). PERTek iraupena beta banaketa batekin modelatzen du, eta haren batezbestekoa eta bariantza hurbiltzen ditu. Probableenak pisu handiena du.',
        es: 'Cuando la duración de las actividades no es segura, se dan tres estimaciones: optimista (a), más probable (m) y pesimista (b). PERT modela la duración con una distribución beta y aproxima su media y su varianza. La más probable es la que más pesa.',
      },
      { t: 'f', tex: 't_e = \\frac{a + 4m + b}{6} \\qquad \\sigma^2 = \\left(\\frac{b - a}{6}\\right)^2', check: 'pert-te' },
      {
        t: 'example',
        pool: 'pert-2-1',
        eu: 'A jarduera: (a, m, b) = ({{abm:A}}) → te = {{te:A}}, σ² = {{var:A}}.',
        es: 'Actividad A: (a, m, b) = ({{abm:A}}) → te = {{te:A}}, σ² = {{var:A}}.',
      },
      { t: 'h', eu: 'Proiektuaren iraupena eta bariantza', es: 'Duración y varianza del proyecto' },
      {
        t: 'p',
        eu: 'te-ekin CPM egiten da eta bide kritikoa lortzen da. Proiektuaren iraupena bide horretako jardueren batura da; jarduerak independenteak direnez, bariantzak ere batu egiten dira. Desbiderapenak ez dira batzen: desbiderapena bariantzaren erro karratua da, eta erroen batura ez da baturaren erroa.',
        es: 'Con los te se hace el CPM y se obtiene el camino crítico. La duración del proyecto es la suma de las actividades de ese camino; como las actividades son independientes, también se suman las varianzas. Las desviaciones no se suman: la desviación es la raíz de la varianza, y la suma de raíces no es la raíz de la suma.',
      },
      { t: 'f', tex: 'T_e = \\sum_{\\text{kritikoak}} t_e \\qquad \\sigma_T^2 = \\sum_{\\text{kritikoak}} \\sigma^2 \\qquad \\sigma_T = \\sqrt{\\sigma_T^2}', texEs: 'T_e = \\sum_{\\text{críticas}} t_e \\qquad \\sigma_T^2 = \\sum_{\\text{críticas}} \\sigma^2 \\qquad \\sigma_T = \\sqrt{\\sigma_T^2}', check: 'pert-variance' },
      {
        t: 'example',
        pool: 'pert-2-1',
        eu: 'Bide kritikoa {{pert-path}}: Te = {{Te}}; σ² = {{vars}} = {{V}}; σ = {{sigma}}. Desbiderapenak batuta {{sdsum}} aterako litzateke, okerra.',
        es: 'Camino crítico {{pert-path}}: Te = {{Te}}; σ² = {{vars}} = {{V}}; σ = {{sigma}}. Sumando desviaciones saldría {{sdsum}}, que es incorrecto.',
      },
      { t: 'h', eu: 'Epe bat betetzeko probabilitatea', es: 'Probabilidad de cumplir un plazo' },
      {
        t: 'p',
        eu: 'Jarduera askoren batura denez, proiektuaren iraupena gutxi gorabehera normala da (limitearen teorema zentrala). Probabilitatea z tipifikatuz eta banaketa normalaren taulan irakurriz lortzen da.',
        es: 'Al ser la suma de muchas actividades, la duración del proyecto es aproximadamente normal (teorema central del límite). La probabilidad se obtiene tipificando z y leyendo la tabla de la normal.',
      },
      { t: 'f', tex: 'P(T \\le t) = \\Phi\\!\\left(\\frac{t - T_e}{\\sigma_T}\\right)', check: 'pert-z' },
      {
        t: 'example',
        pool: 'pert-2-1',
        eu: 't = {{deadline}} egun: z = ({{deadline}} − {{Te}}) / {{sigma}} = {{z}} → P = {{P}}.',
        es: 't = {{deadline}} días: z = ({{deadline}} − {{Te}}) / {{sigma}} = {{z}} → P = {{P}}.',
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Bide kritiko bat baino gehiago badago, ariketak zehazten du zein erabili; lehenetsia: bariantza handiena duena (kontserbadoreena).',
        es: 'Si hay más de un camino crítico, el ejercicio dice cuál usar; por defecto, el de mayor varianza (el más conservador).',
      },
      {
        t: 'note',
        kind: 'ope',
        eu: 'Madrilgo OPEan "desbiderapen estandarra" eskatzen da: lehenik bariantzak batu, gero erroa. Idatzi formula eta bide kritikoa zein den.',
        es: 'En la OPE de Madrid se pide la «desviación estándar»: primero se suman las varianzas y luego la raíz. Escribe la fórmula y cuál es el camino crítico.',
      },
    ],
  },

  // ------------------------------------------------------------------ 8
  {
    id: 'gantt',
    title: { eu: 'Gantt diagrama', es: 'Diagrama de Gantt' },
    status: st('gantt'),
    blocks: [
      {
        t: 'p',
        eu: 'Gantt diagramak jarduera bakoitza denbora-ardatz baten gaineko barra gisa erakusten du. Proiektuetan barra hasiera goiztiarrean (ES) hasi eta EF-n amaitzen da; holgura duten jarduerei barra argi bat gehitzen zaie LF-raino. Bide kritikoko jarduerak nabarmentzen dira.',
        es: 'El diagrama de Gantt muestra cada actividad como una barra sobre un eje de tiempo. En proyectos la barra empieza en el inicio más temprano (ES) y termina en EF; a las actividades con holgura se les añade una barra clara hasta LF. Se destacan las del camino crítico.',
      },
      {
        t: 'list',
        eu: [
          'Denbora-eskala esplizitua, unitatearekin (egunak, orduak).',
          'Jarduera bakoitzeko lerro bat, aurrekotasunen ordenan.',
          'Bide kritikoa beste kolore batez; holgurak barra argiz.',
          'Sekuentziazioan (Johnson), makina bakoitzeko lerro bat, lanak ordenan eta denbora hilak markatuta.',
        ],
        es: [
          'Escala de tiempo explícita, con la unidad (días, horas).',
          'Una fila por actividad, en orden de precedencias.',
          'Camino crítico en otro color; holguras como barras claras.',
          'En secuenciación (Johnson), una fila por máquina, los trabajos en orden y los tiempos ociosos marcados.',
        ],
      },
      {
        t: 'example',
        pool: 'spec-eg2',
        eu: 'Iraupena {{T}}; bide kritikoa {{paths}}. C jarduera {{es:C}}-tik {{ef:C}}-ra marrazten da, eta haren holgura {{ef:C}}-tik {{lf:C}}-ra.',
        es: 'Duración {{T}}; camino crítico {{paths}}. La actividad C se dibuja de {{es:C}} a {{ef:C}}, y su holgura de {{ef:C}} a {{lf:C}}.',
      },
      { t: 'widget', w: 'cpm' },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Gantt diagramak ez ditu aurrekotasunak erakusten: horregatik sareak eta Gantt-ak elkarren osagarri dira.',
        es: 'El diagrama de Gantt no muestra las precedencias: por eso la red y el Gantt se complementan.',
      },
    ],
  },

  // ------------------------------------------------------------------ 9
  {
    id: 'johnson',
    title: { eu: 'Sekuentziazioa: Johnson-en araua', es: 'Secuenciación: la regla de Johnson' },
    status: st('johnson'),
    blocks: [
      {
        t: 'p',
        eu: 'Lan batzuk bi makinatan egin behar dira, ordena berean (lehenik M1, gero M2). Helburua makespan-a txikitzea da: lehen lana hasten denetik azkena amaitzen den arteko denbora.',
        es: 'Varios trabajos deben pasar por dos máquinas en el mismo orden (primero M1, después M2). El objetivo es minimizar el makespan: el tiempo desde que empieza el primer trabajo hasta que termina el último.',
      },
      {
        t: 'list',
        eu: [
          'Bilatu denbora txikiena, lan guztietan eta bi makinetan.',
          'M1ean badago, lan hori lehen posizio librean jarri; M2an badago, azken posizio librean.',
          'Kendu lana eta errepikatu. Berdinketetan, sekuentzia optimo bat baino gehiago dago.',
        ],
        es: [
          'Buscar el menor tiempo entre todos los trabajos y las dos máquinas.',
          'Si está en M1, poner ese trabajo en la primera posición libre; si está en M2, en la última libre.',
          'Quitar el trabajo y repetir. Con empates hay más de una secuencia óptima.',
        ],
      },
      {
        t: 'p',
        eu: 'Zergatik da optimoa? M1ean denbora laburrak hasieran jarrita, M2 lehenago hasten da eta gutxiago itxaroten du. M2an denbora laburrak amaieran jarrita, M1 amaitu ondoren M2k egin behar duena txikia da. Bi makinarekin trukaketa-argudio batek frogatzen du ez dagoela sekuentzia hoberik.',
        es: '¿Por qué es óptima? Con los tiempos cortos de M1 al principio, M2 empieza antes y espera menos. Con los tiempos cortos de M2 al final, lo que queda en M2 cuando M1 termina es poco. Con dos máquinas un argumento de intercambio demuestra que no hay secuencia mejor.',
      },
      { t: 'f', tex: 'F_{1,k} = F_{1,k-1} + p_{1,k} \\qquad F_{2,k} = \\max(F_{1,k},\\, F_{2,k-1}) + p_{2,k}', check: 'johnson-makespan' },
      {
        t: 'example',
        pool: 'johnson-1-1',
        eu: 'Johnson-en sekuentzia: {{seq}} → makespan = {{mk}} h (bilaketa osoaren optimoa: {{opt}} h). Denbora hilak: M1 {{idle1}} h, M2 {{idle2}} h. Araua alderantziz aplikatuta ({{rev}}) makespan-a {{revmk}} h da.',
        es: 'Secuencia de Johnson: {{seq}} → makespan = {{mk}} h (óptimo de la búsqueda completa: {{opt}} h). Tiempos ociosos: M1 {{idle1}} h, M2 {{idle2}} h. Aplicando la regla al revés ({{rev}}) el makespan es {{revmk}} h.',
      },
      { t: 'widget', w: 'johnson' },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Araua bi makinarako da eta ordena berean. Hiru makina edo gehiagorekin ez du optimoa bermatzen.',
        es: 'La regla es para dos máquinas y el mismo orden. Con tres o más máquinas no garantiza el óptimo.',
      },
    ],
  },

  // ------------------------------------------------------------------ 10
  {
    id: 'mistakes',
    title: { eu: 'Akats ohikoak', es: 'Errores habituales' },
    status: st('mistakes'),
    blocks: [
      {
        t: 'p',
        eu: 'Zuzentzaileak akats hauek hautematen ditu, kalkulua akatsarekin berriz eginez. Hemen daude, gaiaren arabera.',
        es: 'El corrector detecta estos errores rehaciendo el cálculo con el error. Aquí están, por tema.',
      },
      { t: 'h', eu: 'Orekatzea', es: 'Equilibrado' },
      {
        t: 'list',
        eu: [
          'C = demanda / denbora (alderantziz) edo minutuak eta segundoak nahastuta.',
          'N_min beheko osoarekin: beti goiko osoa.',
          'Efizientzia N_min-ekin, benetako N-ren ordez; edo lepo-botilarekin C-ren ordez.',
          'Esleipenean aurrekotasun bat urratuta edo lanpostu batek C gainditzen du.',
        ],
        es: [
          'C = demanda / tiempo (al revés) o minutos y segundos mezclados.',
          'N_min con el entero inferior: siempre el superior.',
          'Eficiencia con N_min en lugar del N real; o con el cuello de botella en lugar de C.',
          'En la asignación, una precedencia incumplida o una estación que supera C.',
        ],
      },
      { t: 'h', eu: 'CPM eta PERT', es: 'CPM y PERT' },
      {
        t: 'list',
        eu: [
          'Holgura totala eta librea nahastuta.',
          'Atzerako pasaldian maximoa minimoaren ordez.',
          'PERTen desbiderapenak batuta bariantzen ordez.',
          'Bide kritikoa ez den bide bat erabilita.',
          'Φ-ren alde okerra (P eta 1 − P nahastuta).',
        ],
        es: [
          'Holgura total y libre confundidas.',
          'En el pase hacia atrás, el máximo en lugar del mínimo.',
          'En PERT, sumar desviaciones en lugar de varianzas.',
          'Usar un camino que no es el crítico.',
          'El lado equivocado de Φ (P y 1 − P confundidos).',
        ],
      },
      { t: 'h', eu: 'Sekuentziazioa', es: 'Secuenciación' },
      {
        t: 'list',
        eu: ['Johnson-en araua alderantziz: M2ko txikiena hasieran eta M1ekoa amaieran.'],
        es: ['La regla de Johnson al revés: el menor de M2 al principio y el de M1 al final.'],
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Akats bat identifikatzen ez denean, aplikazioak ebazpen osoa erakusten du: konparatu zure kalkulua pausoz pauso.',
        es: 'Cuando un error no se identifica, la aplicación muestra la solución completa: compara tu cálculo paso a paso.',
      },
    ],
  },

  // ------------------------------------------------------------------ 11
  {
    id: 'ope',
    title: { eu: 'OPEan nola aurkeztu', es: 'Cómo presentarlo en la OPE' },
    status: st('ope'),
    blocks: [
      {
        t: 'p',
        eu: 'Ariketa praktikoetan emaitzak bezainbeste baloratzen da prozesua: tribunalak ikusi behar du zer egin duzun eta zergatik. Puntuazioa ataletan banatzen da, eta atal bakoitzak bere emaitza argia behar du.',
        es: 'En los ejercicios prácticos se valora el proceso tanto como el resultado: el tribunal debe ver qué has hecho y por qué. La puntuación se reparte por apartados, y cada apartado necesita su resultado claro.',
      },
      {
        t: 'list',
        eu: [
          'Datuak: idatzi zein datu erabiltzen dituzun, unitateekin.',
          'Formula: lehenik formula orokorra, gero zenbakiak ordezkatuta, gero emaitza unitatearekin.',
          'Konbentzioak esplizitu: efizientziaren oinarria, heuristikoa eta berdinketa-araua, AON edo AOA sarea.',
          'Taulak: esleipena lanpostuka (atazak eta denborak); CPM taula (ES, EF, LS, LF, holgurak).',
          'Diagramak: aurrekotasun-diagrama, sarea eta Gantt-a, irakurgarri eta eskalarekin.',
          'Egiaztapenak: lanpostu batek ere ez du C gainditzen; bide kritikoaren luzera = iraupena; makespan-a ez da makina bakoitzaren denboren batura baino txikiagoa.',
        ],
        es: [
          'Datos: escribe qué datos usas, con unidades.',
          'Fórmula: primero la fórmula general, después con los números sustituidos y después el resultado con su unidad.',
          'Convenciones explícitas: base de la eficiencia, heurística y desempate, red AON o AOA.',
          'Tablas: la asignación por estaciones (tareas y tiempos); la tabla CPM (ES, EF, LS, LF, holguras).',
          'Diagramas: de precedencias, red y Gantt, legibles y con escala.',
          'Comprobaciones: ninguna estación supera C; la longitud del camino crítico = duración; el makespan no es menor que la suma de tiempos de cada máquina.',
        ],
      },
      {
        t: 'note',
        kind: 'ope',
        eu: 'Euskadiko OPEan orekatze-ariketak atalak eta puntuak zehazten ditu (diagrama, ziklo-denbora, lanpostuak, esleipena, efizientziak). Erantzun atal bakoitza bere izenburuarekin, tribunalak puntuak erraz eman ditzan.',
        es: 'En la OPE de Euskadi el ejercicio de equilibrado detalla apartados y puntos (diagrama, tiempo de ciclo, estaciones, asignación, eficiencias). Responde cada apartado con su título, para que el tribunal pueda puntuar con facilidad.',
      },
    ],
  },
];

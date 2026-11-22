# EkoizpenLab – arau nagusiak
Espezifikazio osoa: `../EkoizpenLab_argibideak.md`.

- Zehaztasuna > dena. core/-n akats batek erabiltzailearen ikaskuntza hondatzen du.
- Aritmetika: arrazional zehatzak (src/core/rational.ts). N_min = goiko osoa. Efizientziaren oinarria (C edo lepo-botila) ariketan esplizitu.
- Esleipenak: heuristikoa + berdinketa-araua badago, emaitza deterministikoa; bestela edozein esleipen baliodun. Oinordekoak iragankorrak dira (oinordeko gehien eta RPW; erabiltzaileak onartua, 2026-11-22).
- Johnson: makina baten denbora hila = makespan − bere prozesatze-denboren batura (M2: hasierako itxaronaldia barne; M1: amaierakoa barne). Ebazpenean esplizitu (erabiltzaileak onartua, 2026-11-22).
- Lanpostuen araberako eskaerak (lanpostuen denborak, denbora hila, azken lanpostuaren efizientzia) erabiltzailearen esleipenetik zuzentzen dira, baliozkoa bada (erabiltzaileak erabakia, 2026-11-21).
- CPM: jarduerako ES/EF/LS/LF zuzentzen dira (AON); AOA gertaeren denborak horietatik eratorrita erakusten dira. Oinordekorik gabeko jardueren holgura librea = T − EF.
- Johnson: puntu osoa arauarekin bateragarriak diren sekuentziei; optimoa baina araua betetzen ez duena → partziala, oharrarekin.
- PERT: bariantzak batu, ez desbiderapenak. Bide kritiko anitzak onartu.
- Bi ebazle independente (A eta B) + Python orakulua. Bat ez badatoz → ariketa ez da erakusten.
- Erantzun zuzena erakutsitako datuetatik kalkulatzen da beti.
- Kanpoko iturrien soluzioak ez dira inoiz egiatzat hartzen: beti berriz ebatzi.
- Golden testak (tests/golden) ez dira inoiz aldatzen inplementazioari egokitzeko.
- Zuzenketan ez da AArik erabiltzen. Teoriako eta ebatzietako zenbakiak ebazletik txertatzen dira. Teoria TS objektu gisa, ez MDX.
- UI elebiduna: eu (lehenetsia) / es. Terminologia: espezifikazioko §13.3; "efizientzia (eraginkortasuna)".
- GitHub: biltegia sortu edo push egin aurretik, erabiltzaileari baieztapena eskatu. Despliegea, CI berde badago soilik.
- Fase bat ez da amaitutzat jotzen bere test guztiak berde egon arte.
- core/-k ez du UIren ezer inportatzen (ESLint-ek debekatzen du).
- Kodea, iruzkinak eta commit-mezuak ingelesez. Commit-egilea: Letitbe010 noreply helbidearekin.

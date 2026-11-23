# EkoizpenLab – arau nagusiak
Espezifikazio osoa: `../EkoizpenLab_argibideak.md`.

- Zehaztasuna > dena. core/-n akats batek erabiltzailearen ikaskuntza hondatzen du.
- Aritmetika: arrazional zehatzak (src/core/rational.ts). N_min = goiko osoa. Efizientziaren oinarria (C edo lepo-botila) ariketan esplizitu.
- Esleipenak: heuristikoa + berdinketa-araua badago, emaitza deterministikoa; bestela edozein esleipen baliodun. Oinordekoak iragankorrak dira (oinordeko gehien eta RPW; erabiltzaileak onartua, 2026-11-22).
- Johnson: makina baten denbora hila = makespan − bere prozesatze-denboren batura (M2: hasierako itxaronaldia barne; M1: amaierakoa barne). Ebazpenean esplizitu (erabiltzaileak onartua, 2026-11-22).
- Esleipen-araurik gabe, erreferentziako erantzuna lanpostu kopuru optimoko esleipen bat da (B ebazlea, A-k egiaztatua), ez LTT-rena (2026-11-22).
- Berdinketa-araua alfabetikoa ez denean, enuntziatuak azken irizpidea (ordena alfabetikoa) aipatzen du; LTT-rekin ez da "laburrena" araua erabiltzen.
- Lanpostuen araberako eskaerak (lanpostuen denborak, denbora hila, azken lanpostuaren efizientzia) erabiltzailearen esleipenetik zuzentzen dira, baliozkoa bada (erabiltzaileak erabakia, 2026-11-21).
- CPM: jarduerako ES/EF/LS/LF zuzentzen dira (AON); AOA gertaeren denborak horietatik eratorrita erakusten dira. Oinordekorik gabeko jardueren holgura librea = T − EF.
- Johnson: puntu osoa arauarekin bateragarriak diren sekuentziei; optimoa baina araua betetzen ez duena → partziala, oharrarekin.
- PERT: bariantzak batu, ez desbiderapenak. Bide kritiko anitzak onartu.
- te ez-osoak (erabiltzaileak onartua, 2026-11-23): zuzentzailea zehatza da; pool-eko edo inportatutako ariketa batek te ez-osoak eta CPM denbora-eskaerak (cpmTable, duration) baditu, verify.ts-k markatzen du eta egokitu egin behar da sartu aurretik.
- Araurik gabeko esleipena (erabiltzaileak onartua, 2026-11-23): erreferentzia lanpostu kopuru optimoko esleipen bat da; edozein esleipen baliodun optimo onartzen da.
- Berrikuspena (2026-11-23): OPEko eta egokitutako pool-ariketak 'approved'; teoria eta ebatziak 'reviewed'. Sortutako pin-ak 'review-needed'.
- Zuzentzailearen tolerantziak (erabiltzaileak onartuak, 2026-11-22): denborak zatiki zehatz gisa edo erabiltzailearen hamartarretara biribilduta (≥ 2 hamartar), s/min/h unitateak; efizientziak ±0,1 puntu portzentual; PERT te, σ², σ ±0,0005; probabilitatea ±0,005; epea ±max(0,01·σ; 0,005). Ez dago emaitza kateaturik, lanpostuen araberako eskaeretan izan ezik. Puntu partziala 0,5: esleipena baliozkoa baina araua jarraitu gabe; araurik gabe baliozkoa baina N > N optimoa; Johnson-en sekuentzia optimoa baina araua jarraitu gabe.
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

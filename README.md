# EkoizpenLab

**EU** · Ekoizpenaren programazioko ariketak entrenatzeko aplikazioa (OPE, 1508 espezialitatea: *Fabrikazio Mekanikoaren Antolamendua eta Proiektuak*): lerroen orekatzea, CPM, PERT, Gantt eta Johnson-en araua. Teoria (11 gai, widget interaktiboekin), 10 ariketa ebatzi pausoz pauso, praktika hiru mailatan (OPEko ariketak eta ausaz sortuak), azterketa modua eta aurrerapen-estatistikak. Zuzenketa deterministikoa da: bi ebazle independente eta Python orakulu bat, akats ohikoen diagnostikoarekin. Euskaraz eta gaztelaniaz; mugikorrean instalagarria eta lineaz kanpo erabilgarria (PWA).

**ES** · Aplicación para entrenar ejercicios de programación de la producción (OPE, especialidad 1508: *Organización y Proyectos de Fabricación Mecánica*): equilibrado de líneas, CPM, PERT, Gantt y regla de Johnson. Teoría (11 temas, con widgets interactivos), 10 ejercicios resueltos paso a paso, práctica en tres niveles (ejercicios de OPE y generados), modo examen y estadísticas de progreso. La corrección es determinista: dos solucionadores independientes y un oráculo en Python, con diagnóstico de errores habituales. En euskera y castellano; instalable en el móvil y utilizable sin conexión (PWA).

Web: https://letitbe010.github.io/EkoizpenLab/

## Garapena / Desarrollo

```bash
npm install
npm run dev
npm test
npm run oracle:py   # Python oracle: needs networkx + scipy (pip install -r tools/oracle/requirements.txt,
                    # e.g. in tools/oracle/.venv and run with that interpreter)
npm run build
npx vite preview --port 4189
npm run usability   # PWA, offline and 15 screens at 390/1280 px
npm run a11y        # axe-core, WCAG 2.1 AA
```

Lizentzia / Licencia: kodea MIT; edukia CC BY-SA 4.0 (ikus `LICENSE`).

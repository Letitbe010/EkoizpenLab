// Accessibility check (spec §13.2, WCAG 2.1 AA) with axe-core — the engine behind the
// Lighthouse accessibility score — on the production build, both languages, light and dark,
// 390 px and 1280 px, including a graded exercise and an open worked exercise.
// Usage: npm run build && npx vite preview --port 4189 ; node tools/a11y.mjs [baseUrl]
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4189/EkoizpenLab/';
const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch({ channel: 'chrome' }));
const PAGES = [
  ['start', ''],
  ['practice', '#/praktika'],
  ['ex-eg1-graded', '#/praktika/pool/spec-eg1'],
  ['ex-eg2-graded', '#/praktika/pool/spec-eg2'],
  ['ex-johnson', '#/praktika/johnson/2/seed/7'],
  ['worked-gantt', '#/ebatziak/gantt'],
  ['theory-balancing', '#/teoria/balancing'],
  ['theory-johnson', '#/teoria/johnson'],
  ['exam', '#/azterketa'],
  ['progress', '#/aurrerapena'],
  ['settings', '#/ezarpenak'],
];
let failures = 0;
for (const lang of ['eu', 'es'])
  for (const scheme of ['light', 'dark'])
    for (const width of [390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
      const p = await ctx.newPage();
      await p.addInitScript((l) => {
        localStorage.setItem('ekoizpenlab.lang', JSON.stringify(l));
        localStorage.setItem('ekoizpenlab.progress.v1', JSON.stringify({ version: 1, attempts: [], theorySeen: [], workedDone: [], introSeen: true, settings: { theme: 'auto' } }));
      }, lang);
      for (const [name, hash] of PAGES) {
        await p.goto(base + hash);
        await p.locator('h1').first().waitFor();
        if (name.endsWith('-graded') || name === 'ex-johnson') {
          await p.locator('.actions button.primary').first().click(); // start
          await p.locator('.actions button.primary').first().click(); // grade with empty answers
        }
        if (name.startsWith('worked-')) await p.locator('.actions button').nth(1).click(); // show all
        await p.waitForTimeout(200);
        await p.addScriptTag({ content: axe });
        const res = await p.evaluate(async () => {
          const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
          return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target?.join(' ')}`);
        });
        const label = `${lang} ${scheme} ${width}px ${name}`;
        if (res.length) {
          failures++;
          console.log(`FAIL ${label}\n  ${res.join('\n  ')}`);
        } else console.log(`OK   ${label}`);
      }
      await ctx.close();
    }
await browser.close();
console.log(failures ? `${failures} page(s) with violations` : 'no WCAG 2.1 AA violations');
process.exit(failures ? 1 : 0);

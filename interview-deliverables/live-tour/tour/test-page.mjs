#!/usr/bin/env node
// Regression fixture for the in-page tour: COLD-load every step by deep link (#<id>) in a fresh browser and require that
// every live check matched the story. Cold matters: the scaffold's expand-chip script once re-parented the iframes ~2s after
// load (an iframe that moves reloads), killing the first step's actions; sequential Next clicks hid it. Fixed with [data-no-expand].
//   node test-page.mjs <tour page url> [--only WEB-5]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { DEFS } from './steps.js';
const here = path.dirname(fileURLToPath(import.meta.url)); const req = createRequire(import.meta.url);
let pw; for (const r of [process.env.LHI_SCRIPTS_ROOT, path.resolve(here, '../../../../../../..')].filter(Boolean)) { try { pw = req(path.join(r, 'node_modules/playwright')); break; } catch { /* next */ } } pw = pw || req('playwright');
const url = process.argv[2]; if (!url) { console.error('usage: test-page.mjs <tour page url> [--only ID]'); process.exit(2); }
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '';
const browser = await pw.chromium.launch(); let bad = 0;
for (const d of DEFS) {
  if (only && d.id !== only) continue;
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  await page.goto(url.replace(/#.*$/, '') + '#' + d.id);
  const done = await page.waitForFunction(() => /ok|bad/.test(document.querySelector('#t-status').className), null, { timeout: 90000 }).then(() => true, () => false);
  const rows = done ? await page.$$eval('.evi', (els) => els.map((e) => ({ cls: e.className, label: e.querySelector('.el').textContent, val: e.querySelector('code').textContent }))) : [];
  const mism = rows.filter((r) => /mis|err/.test(r.cls));
  const expectRows = (d.actions && d.actions.both || []).some((a) => a.do === 'check' || a.do === 'flow') ? 1 : 0;
  const ok = done && mism.length === 0 && rows.length >= expectRows;
  if (!ok) bad++;
  console.log((ok ? 'PASS ' : 'FAIL ') + d.id.padEnd(7) + (done ? `${rows.length} rows` : 'did not finish in 90s') + (mism.length ? ' MISMATCH ' + JSON.stringify(mism) : ''));
  await page.context().close();
}
await browser.close(); console.log(bad ? `${bad} step(s) failed` : 'all steps passed cold'); process.exit(bad ? 1 : 0);

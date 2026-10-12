#!/usr/bin/env node
// ECI live tour as a PLAYWRIGHT tutorial: two real browser windows (BEFORE = original buggy app, AFTER = fixed app) side by side,
// driven step by step with the SAME engine and steps the web page uses. A Next / Back / Auto bar floats in the Before window.
//
//   node playwright-tour.mjs                               # headed, waits for Next
//   node playwright-tour.mjs --auto                        # headed, plays every step with narration
//   node playwright-tour.mjs --headless --auto --report /tmp/tour-report.json     # proof run, no windows
//   public share copy:  --tour-url https://lifehackinnovations.com/lhi-workspace/api/workspace/share/<id>/eci-round-two-live-tour/index.html --app-index
//   options: --base https://lifehackinnovations.com  --tour-url <url of the tour folder>  --storage <storageState.json>  --only WEB-4  --no-voice  --shots <dir>
//
// Narration: pre-rendered voice af_heart (Kokoro, via lhi-lcb-tts) in tour/audio/<id>.mp3, played by the HUD. If a clip is missing the
// step is silent. The browser's built-in robotic voice is never used.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIDES, DEFS } from './steps.js';
import { runStepSide, mergeSteps, sleep } from './engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n) => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const BASE = opt('base', 'https://lifehackinnovations.com').replace(/\/$/, '');
const HEADLESS = flag('headless');
const AUTO = flag('auto');
const VOICE = !flag('no-voice');
const ONLY = opt('only', '');
const STORAGE = opt('storage', '');
const TOUR_URL = opt('tour-url', BASE + '/lhi-workspace/deliverables/eci-round-two-live-tour/');
const SHOTS = opt('shots', '');
const REPORT = opt('report', '');
const APP_INDEX = flag('app-index'); // public share URLs 404 directory URLs, so ask for .../app/index.html

const req = createRequire(import.meta.url);
function loadPlaywright() {
  const roots = [process.env.LHI_SCRIPTS_ROOT, path.resolve(here, '../../../../../../..')].filter(Boolean);
  // DO keeps Playwright at the repo root, the Mac under scripts/ (the two mirror, they are not identical)
  for (const r of roots) for (const sub of ['node_modules/playwright', 'scripts/node_modules/playwright']) { try { return req(path.join(r, sub)); } catch { /* next */ } }
  return req('playwright');
}
const { chromium } = loadPlaywright();

const texts = JSON.parse(fs.readFileSync(path.join(here, 'steps-text.json'), 'utf8'));
let STEPS = mergeSteps(texts, DEFS);
if (ONLY) STEPS = STEPS.filter((s) => s.id === ONLY);
const spotlightSrc = fs.readFileSync(path.join(here, 'lhi-spotlight.js'), 'utf8');

const HUD = `(()=>{
  if (window.__tourHud) return; window.__tourHud = true;
  const mk = () => {
    if (document.getElementById('__tour_hud')) return;
    const s = JSON.parse(sessionStorage.getItem('__tour_state') || 'null'); if (!s) return;
    const h = document.createElement('div'); h.id = '__tour_hud';
    h.style.cssText = 'position:fixed;z-index:2147483647;right:12px;bottom:12px;width:min(430px,92vw);background:#1A1423;color:#EDD9FF;border:2px solid #BA9EFF;border-radius:14px;padding:12px 14px;font:14px/1.45 system-ui;box-shadow:0 10px 40px rgba(0,0,0,.45)';
    h.innerHTML = '<div style="font:700 11px ui-monospace,monospace;letter-spacing:.12em;color:#BA9EFF">LIVE TOUR · STEP '+s.n+' OF '+s.total+' · '+s.id+'</div><div style="font-weight:700;font-size:16px;margin:4px 0">'+s.title+'</div><div style="color:#d9c8f5">'+s.simple+'</div><div id="__tour_checks" style="margin-top:8px;font:12.5px ui-monospace,monospace"></div><div style="display:flex;gap:8px;margin-top:10px;align-items:center"><button data-c="back">Back</button><button data-c="next">Next</button><button data-c="auto">Auto</button><button data-c="mute">Voice</button><span style="margin-left:auto;font-size:12px;opacity:.7">← → keys</span></div>';
    h.querySelectorAll('button').forEach(b => { b.style.cssText = 'font:600 13px system-ui;padding:7px 14px;border-radius:9px;border:2px solid #BA9EFF;background:#2a1f3d;color:#EDD9FF;cursor:pointer'; b.onclick = () => window.__tourCmd(b.dataset.c); });
    document.documentElement.appendChild(h);
  };
  document.addEventListener('keydown', e => { if (e.key === 'ArrowRight') window.__tourCmd('next'); if (e.key === 'ArrowLeft') window.__tourCmd('back'); });
  window.__tourHudRender = () => { const o = document.getElementById('__tour_hud'); if (o) o.remove(); mk(); };
  new MutationObserver(() => { if (!document.getElementById('__tour_hud')) mk(); }).observe(document.documentElement, { childList: true });
  mk();
})()`;

async function openSide(key, idx, total) {
  const side = key; // 'before' | 'after'
  const w = 940, h = 900;
  const browser = await chromium.launch({ headless: HEADLESS, args: [`--window-position=${idx * (w + 8)},0`, `--window-size=${w},${h}`, '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: HEADLESS ? { width: w, height: h } : null, ...(STORAGE ? { storageState: STORAGE } : {}) });
  const page = await ctx.newPage();
  return { side, browser, ctx, page };
}

function makeEnv(winKey, win, cfgKey) {
  const cfg = SIDES[cfgKey];
  const page = win.page;
  return {
    side: winKey, apiBase: BASE + cfg.api, tokenKey: cfg.tokenKey, appUrl: new URL(cfg.app + (APP_INDEX ? 'index.html' : ''), TOUR_URL).href,
    eval: (js) => page.evaluate(js),
    navigate: async (url) => { await page.goto('about:blank'); await page.goto(url, { waitUntil: 'domcontentloaded' }); },
    sleep, fetch: (u, o) => fetch(u, o),
    injectSpotlight: async () => { if (!(await page.evaluate('!!window.__lhiSpotlight'))) await page.addScriptTag({ content: spotlightSrc }); },
  };
}

const results = [];
const wins = { before: await openSide('before', 0), after: await openSide('after', 1) };
let cmdResolve = null; let auto = AUTO; let voiceOn = VOICE;
const cmd = (c) => {
  if (c === 'auto') { auto = !auto; c = 'next'; }
  if (c === 'mute') { voiceOn = !voiceOn; return; }
  if (cmdResolve) { const r = cmdResolve; cmdResolve = null; r(c); }
};
await wins.before.ctx.exposeFunction('__tourCmd', cmd);
await wins.after.ctx.exposeFunction('__tourCmd', cmd);
await wins.before.ctx.addInitScript(HUD);
await wins.after.ctx.addInitScript(HUD);

let i = 0;
async function playVoice(step) {
  if (!voiceOn || HEADLESS) return;
  try {
    await wins.before.page.evaluate(`(async()=>{const a=new Audio(${JSON.stringify(new URL('tour/audio/' + step.id + '.mp3', TOUR_URL).href)});window.__tourAudio&&window.__tourAudio.pause();window.__tourAudio=a;await a.play().catch(()=>{});})()`);
  } catch { /* silent step */ }
}
async function waitCmd() {
  if (auto) return 'next';
  return new Promise((r) => { cmdResolve = r; });
}

while (i >= 0 && i < STEPS.length) {
  const step = STEPS[i];
  const state = { n: i + 1, total: STEPS.length, id: step.id, title: step.title || step.id, simple: step.simple || '' };
  for (const k of ['before', 'after']) {
    await wins[k].page.evaluate(`sessionStorage.setItem('__tour_state', ${JSON.stringify(JSON.stringify(state))})`).catch(() => {});
  }
  console.log(`\n[${state.n}/${state.total}] ${step.id} — ${state.title}`);
  const items = [];
  const report = (it) => items.push(it);
  if (step.kind !== 'terminal') {
    const run = [];
    for (const k of ['before', 'after']) {
      const cfgKey = (step.variant && step.variant[k]) || k;
      const env = makeEnv(k, wins[k], cfgKey);
      run.push(runStepSide(step, env, { report, users: {} }));
    }
    await Promise.all(run);
    for (const k of ['before', 'after']) {
      await wins[k].page.evaluate('window.__tourHudRender&&window.__tourHudRender()').catch(() => {});
    }
  } else {
    for (const k of ['before', 'after']) {
      const t = fs.readFileSync(path.join(here, step.terminal[k]), 'utf8');
      await wins[k].page.goto('about:blank');
      await wins[k].page.setContent(`<body style="margin:0;background:#12101a;color:#${k === 'before' ? 'ffb3c1' : '9bf0b5'};font:14px/1.5 ui-monospace,monospace;padding:24px"><div style="color:#BA9EFF;font-weight:700;margin-bottom:12px">${k === 'before' ? 'BEFORE · original code' : 'AFTER · fixed'} · real captured output</div><pre style="white-space:pre-wrap">${t.replace(/[&<]/g, (c) => (c === '&' ? '&amp;' : '&lt;'))}</pre></body>`);
      await wins[k].page.evaluate('window.__tourHudRender&&window.__tourHudRender()').catch(() => {});
    }
  }
  for (const it of items) {
    const mark = it.kind === 'error' ? 'ERROR' : it.ok === null ? '·   ' : it.ok ? 'ok ' : 'MISMATCH';
    console.log(`  ${it.side.padEnd(6)} ${mark}  ${it.label}: ${it.value}`);
  }
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const k of ['before', 'after']) await wins[k].page.screenshot({ path: path.join(SHOTS, `${step.id}-${k}.png`) }).catch(() => {});
  }
  results.push({ id: step.id, items });
  await playVoice(step);
  const c = await waitCmd();
  if (auto) await sleep(HEADLESS ? 150 : 2500);
  i += c === 'back' ? -1 : 1;
  if (i < 0) i = 0;
}

const bad = results.flatMap((r) => r.items.filter((it) => it.kind === 'error' || it.ok === false));
if (REPORT) fs.writeFileSync(REPORT, JSON.stringify({ at: new Date().toISOString(), base: BASE, results }, null, 1));
console.log(`\nDone. ${results.length} steps, ${bad.length} live checks did not match the story.`);
for (const k of ['before', 'after']) await wins[k].browser.close().catch(() => {});
process.exit(bad.length ? 1 : 0);

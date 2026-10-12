// ECI live tour: in-page driver. Two same-origin iframes (BEFORE = original buggy app, AFTER = fixed app) driven by the shared engine.
// All text is inserted with textContent (no innerHTML). Narration is a pre-rendered clip of the af_heart voice (tour/audio/<id>.mp3);
// if a clip is missing the step is silent. The browser's built-in speech synthesis is never used.
import { SIDES, DEFS } from './steps.js';
import { runStepSide, mergeSteps, sleep } from './engine.js';

const $ = (s, r = document) => r.querySelector(s);
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') e.className = v; else if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}

const root = $('#tour');
const base = new URL('.', import.meta.url).href; // .../tour/
const pageBase = new URL('../', import.meta.url).href; // the folder holding index.html
let STEPS = [];
let n = 0, token = 0, auto = false, voiceOn = true, view = matchMedia('(max-width: 899px)').matches ? 'before' : 'both';
let audio = null, spotlightSrc = '', lockY = null, lastUser = 0;
for (const ev of ['wheel', 'touchstart', 'mousedown', 'keydown']) addEventListener(ev, () => { lastUser = Date.now(); }, { passive: true, capture: true });
// iframe actions scroll the PARENT page too; keep the step header in view unless the reader is scrolling themselves
function holdScroll() { if (lockY != null && Date.now() - lastUser > 1500 && Math.abs(scrollY - lockY) > 4) scrollTo(0, lockY); }
function scrollToStep(first) { if (first) return; const y = $('#t-sid').getBoundingClientRect().top + scrollY - 76; scrollTo(0, Math.max(0, y)); lockY = scrollY; }
const panes = {};

async function boot() {
  const texts = await (await fetch(base + 'steps-text.json')).json();
  STEPS = mergeSteps(texts, DEFS);
  spotlightSrc = await (await fetch(base + 'lhi-spotlight.js')).text();
  build();
  const want = decodeURIComponent(location.hash.replace('#', ''));
  const i = STEPS.findIndex((s) => s.id === want);
  go(i < 0 ? 0 : i, false);
}

function build() {
  const bar = $('.t-bar', root);
  $('#t-back').onclick = () => go(n - 1);
  $('#t-next').onclick = () => go(n + 1);
  $('#t-auto').onclick = () => { auto = !auto; syncBar(); if (auto) go(n + 1); };
  $('#t-voice').onclick = () => { voiceOn = !voiceOn; if (!voiceOn && audio) audio.pause(); syncBar(); if (voiceOn) speak(STEPS[n]); };
  $('#t-restart').onclick = () => { auto = false; go(0); };
  for (const b of root.querySelectorAll('[data-view]')) b.onclick = () => { view = b.dataset.view; syncView(); };
  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
    if (e.key === 'ArrowRight') go(n + 1); if (e.key === 'ArrowLeft') go(n - 1);
  });
  for (const k of ['before', 'after']) panes[k] = { el: $(`.pane[data-side=${k}]`, root), body: $(`.pane[data-side=${k}] .pbody`, root), ev: $(`.pane[data-side=${k}] .ev`, root), title: $(`.pane[data-side=${k}] .ptitle`, root), open: $(`.pane[data-side=${k}] .popen`, root), frame: null, cfgKey: k };
  syncBar(); syncView();
}

function syncBar() {
  $('#t-auto').textContent = auto ? 'Pause auto-play' : 'Auto-play all';
  $('#t-auto').setAttribute('aria-pressed', String(auto));
  $('#t-voice').textContent = voiceOn ? 'Voice: on' : 'Voice: off';
  $('#t-back').disabled = n === 0;
  $('#t-next').disabled = n >= STEPS.length - 1;
  $('#t-count').textContent = `Step ${n + 1} of ${STEPS.length}`;
  $('#t-fill').style.width = ((n + 1) / STEPS.length) * 100 + '%';
}
function syncView() {
  root.dataset.view = view;
  for (const b of root.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
}

function frameEnv(key, step) {
  const cfgKey = (step.variant && step.variant[key]) || key;
  const cfg = SIDES[cfgKey];
  const p = panes[key];
  const cur = () => p.frame && p.frame.contentWindow;
  return {
    side: key, apiBase: cfg.api, tokenKey: cfg.tokenKey, appUrl: new URL(cfg.app, pageBase).href, cfg, clearToken: () => { try { localStorage.removeItem(cfg.tokenKey); } catch { /* ignore */ } },
    eval: (js) => Promise.resolve(cur().eval(js)).finally(holdScroll),
    navigate: (url) => new Promise((res) => {
      if (p.frame) p.frame.remove();
      const f = h('iframe', { class: 'appframe', title: `${cfg.label} storefront`, loading: 'eager' });
      f.src = url; /* src BEFORE insert: an iframe inserted without one fires a load event for its blank document */
      p.frame = f; p.body.replaceChildren(f);
      // The iframe's own load event also waits for the apps' external avatar images (dicebear), which can stall for a long time.
      // The tour only needs the document to exist and have its app root, so poll for that instead.
      const t0 = Date.now();
      const tick = () => {
        try { const d = f.contentDocument; if (d && f.contentWindow.location.href !== 'about:blank' && d.readyState !== 'loading' && d.getElementById('root')) return res(); } catch { /* not ready */ }
        if (Date.now() - t0 > 20000) return res();
        setTimeout(tick, 50);
      };
      tick();
    }),
    sleep, fetch: (u, o) => fetch(u, o),
    injectSpotlight: async () => { const w = cur(); if (w && !w.__lhiSpotlight) w.eval(spotlightSrc); },
  };
}

async function showTerminal(key, step) {
  const p = panes[key];
  p.frame = null;
  const res = await fetch(base + step.terminal[key]);
  const text = res.ok ? await res.text() : '(captured output unavailable)';
  p.body.replaceChildren(h('div', { class: 'term' }, h('div', { class: 'termbar', text: key === 'before' ? 'terminal · original code · real captured output' : 'terminal · fixed code · real captured output' }), h('pre', { text })));
}

function tag(it, side) {
  if (it.kind === 'error') return ['unexpected', 'bad'];
  if (it.ok === null || it.ok === undefined) return null;
  if (it.ok === false) return ['did not match the story', 'bad'];
  return side === 'before' ? ['bug reproduced', 'bugged'] : ['fixed', 'fixedtag'];
}
function addEvidence(side, it) {
  const t = tag(it, side);
  const li = h('li', { class: 'evi ' + (it.kind === 'error' ? 'err' : it.ok === false ? 'mis' : it.ok === null ? 'neutral' : side === 'before' ? 'bugrow' : 'goodrow') },
    h('span', { class: 'el', text: it.label }), h('code', { class: 'ev-val', text: it.value }), t ? h('span', { class: 'etag ' + t[1], text: t[0] }) : null);
  panes[side].ev.append(li);
}

async function speak(step) {
  if (audio) { audio.pause(); audio = null; }
  if (!voiceOn || !step) return;
  const a = new Audio(base + 'audio/' + step.id + '.mp3');
  audio = a;
  try { await a.play(); } catch { audio = null; }
}
function narrationDone() {
  return new Promise((res) => {
    if (!audio) return res();
    const a = audio; a.addEventListener('ended', () => res(), { once: true }); a.addEventListener('error', () => res(), { once: true });
  });
}

let firstGo = true;
async function go(i) {
  i = Math.max(0, Math.min(STEPS.length - 1, i));
  scrollToStep(firstGo); firstGo = false;
  const my = ++token; n = i;
  const step = STEPS[n];
  history.replaceState(null, '', '#' + step.id);
  syncBar();
  // header + text
  $('#t-sid').textContent = step.id === 'intro' ? 'START' : step.id === 'finale' ? 'DONE' : step.id;
  $('#t-sid').className = 'sid ' + (step.id.startsWith('API') ? 'api' : step.id.startsWith('WEB') ? 'web' : '');
  $('#t-title').textContent = step.title || '';
  $('#t-simple').textContent = step.simple || '';
  $('#t-say').textContent = step.say || '';
  fillInfo(step);
  for (const k of ['before', 'after']) {
    const cfg = SIDES[(step.variant && step.variant[k]) || k];
    panes[k].title.textContent = cfg.label;
    panes[k].ev.replaceChildren();
    panes[k].open.href = new URL(cfg.app, pageBase).href;
    panes[k].open.style.display = step.kind === 'terminal' ? 'none' : '';
  }
  const status = $('#t-status'); status.textContent = 'Driving the live apps…'; status.className = 'tstatus running';
  speak(step);
  const report = (it) => { if (my === token) addEvidence(it.side, it); };
  if (step.kind === 'terminal') {
    await Promise.all(['before', 'after'].map((k) => showTerminal(k, step)));
  } else {
    await Promise.all(['before', 'after'].map((k) => runStepSide(step, frameEnv(k, step), { report, users: {} })));
  }
  if (my !== token) return;
  const bad = root.querySelectorAll('.evi.mis, .evi.err').length;
  status.textContent = bad ? `Done, but ${bad} live check${bad > 1 ? 's' : ''} did not match the story (marked in red).` : (step.kind === 'terminal' ? 'Real output captured from the project.' : 'Live checks all matched the story.');
  status.className = 'tstatus ' + (bad ? 'bad' : 'ok');
  if (auto) {
    await narrationDone(); await sleep(1600);
    if (my === token && auto && n < STEPS.length - 1) go(n + 1); else if (my === token) { auto = false; syncBar(); }
  }
}

function fillInfo(step) {
  const box = $('#t-info');
  box.replaceChildren();
  if (!step.how) { box.hidden = true; return; }
  box.hidden = false;
  const sec = (t, x) => h('div', { class: 'isec' }, h('h3', { text: t }), h('p', { text: x }));
  box.append(sec('How it showed up', step.how), sec('How we found it', step.found), sec('What the fix was', step.fix));
  if (step.file) {
    const code = h('div', { class: 'codebox' }, h('b', { text: 'Where in code' }), h('code', { text: step.file }),
      h('div', { class: 'ba' }, h('span', { class: 'bef', text: 'before' }), step.codeBefore),
      h('div', { class: 'ba' }, h('span', { class: 'aft', text: 'after' }), step.codeAfter),
      step.commitUrl ? h('a', { href: step.commitUrl, target: '_blank', rel: 'noopener', text: 'commit ' + step.commit }) : null);
    box.append(code);
  }
}

boot().catch((e) => { const s = $('#t-status'); s.textContent = 'Tour failed to start: ' + e.message; s.className = 'tstatus bad'; });

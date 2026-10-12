// SECURITY NOTE: env.eval() deliberately runs JS strings inside the DEMO storefront's own window (same-origin iframe, or a Playwright page).
// The strings are built only from this repo's first-party steps.js (never from user input, URL params or fetched data), the demo
// backend is in-memory and holds no real data, and that is the entire point of a scripted UI tour.
// ECI live tour ENGINE — one implementation shared by the in-page tour (iframes) and the Playwright runner (real browser windows).
// Everything the engine does to an app is expressed as a JS string run INSIDE that app's window via env.eval(js), so the two
// environments cannot drift. No dependencies; runs in a browser (type=module) and in Node 22.
//
// env = { side, apiBase, tokenKey, appUrl, eval(js)->Promise, navigate(url)->Promise, sleep(ms), injectSpotlight()->Promise, fetch }
// ctx = { users:{}, user:null, report(item) }   (one ctx per pane)

const q = JSON.stringify;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CURSOR_JS = `(()=>{let c=document.getElementById('__tour_cursor');if(!c){c=document.createElement('div');c.id='__tour_cursor';c.style.cssText='position:fixed;z-index:2147483646;width:22px;height:22px;border-radius:50%;background:rgba(186,158,255,.55);border:2px solid #BA9EFF;box-shadow:0 0 0 4px rgba(186,158,255,.25);pointer-events:none;transition:left .45s ease,top .45s ease,transform .12s;left:24px;top:24px;transform:translate(-50%,-50%)';document.body.appendChild(c)}return c})()`;

function sub(s, env, ctx) {
  if (typeof s !== 'string') return s;
  const u = ctx.user || {};
  return s
    .replaceAll('{tokenKey}', env.tokenKey || 'auth_token')
    .replaceAll('{email}', u.email || '')
    .replaceAll('{password}', u.password || '')
    .replaceAll('{username}', u.username || '');
}

export async function waitFor(env, sel, text = '', timeout = 9000) {
  const ok = await env.eval(
    `(async()=>{const S=${q(sel)},T=${q(text)};const end=Date.now()+${timeout};while(Date.now()<end){const el=[...document.querySelectorAll(S)].find(e=>!T||(e.textContent||'').includes(T));if(el)return true;await new Promise(r=>setTimeout(r,100))}return false})()`
  );
  if (!ok) throw new Error(`not found: ${sel}${text ? ` "${text}"` : ''}`);
}

async function installNetLog(env) {
  await env.eval(
    `(()=>{if(window.__tourNetInstalled)return true;window.__tourNetInstalled=true;window.__tourNet=[];const of=window.fetch;window.fetch=async function(i,o){const m=((o&&o.method)||(i&&i.method)||'GET').toUpperCase();const u=String(i&&i.url||i);let r;try{r=await of.apply(this,arguments)}catch(e){window.__tourNet.push({m,p:u.replace(/^.*?\\/eci-storefront-api[a-z-]*/,''),s:'ERR'});throw e}const en={m,p:u.replace(/^.*?\\/eci-storefront-api[a-z-]*/,''),s:r.status};window.__tourNet.push(en);if(/\\/auth\\/login/.test(u)){r.clone().json().then(j=>{en.k=Object.keys((j&&j.user)||{}).join(', ')}).catch(()=>{})}return r};return true})()`
  );
}

export async function api(env, method, path, body, token) {
  const r = await env.fetch(env.apiBase + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  const t = await r.text();
  try { j = JSON.parse(t); } catch { j = t.slice(0, 120); }
  return { status: r.status, body: j };
}

export async function makeUser(env, name = 'tourist') {
  const email = `${name}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}@tour.example`;
  const password = 'secret123';
  const r = await api(env, 'POST', '/auth/register', { username: name, email, password });
  if (r.status !== 201) throw new Error('register failed ' + r.status + ' ' + JSON.stringify(r.body));
  return { username: name, email, password, token: r.body.token, id: r.body.user && r.body.user.id };
}

function judge(expect, val) {
  if (typeof expect === 'boolean') return !!val === expect;
  if (typeof expect === 'string') return new RegExp(expect).test(String(val));
  return true;
}

// ---- the action interpreter -------------------------------------------------------------------------------------
export async function runActions(actions, env, ctx) {
  for (const a of actions || []) {
    if (a.side && a.side !== env.side) continue;
    if (typeof window !== 'undefined') (window.__tourTrace = window.__tourTrace || []).push(Math.round(performance.now()) + ' ' + env.side + ' ' + a.do + ' ' + (a.sel || a.route || a.name || ''));
    switch (a.do) {
      case 'sleep': await env.sleep(a.ms || 500); break;
      case 'netlog': await installNetLog(env); break;
      case 'go': {
        await env.eval(`(()=>{location.hash=${q(a.route)};return true})()`);
        await env.sleep(a.settle || 350);
        if (a.wait) await waitFor(env, a.wait, a.waitText || '');
        break;
      }
      case 'reload': { await env.navigate(env.appUrl + (a.route || '#/')); await env.injectSpotlight(); break; }
      case 'waitFor': await waitFor(env, a.sel, a.text || '', a.timeout || 9000); break;
      case 'click': {
        await env.eval(
          `(async()=>{const S=${q(a.sel)},T=${q(a.text || '')};const el=[...document.querySelectorAll(S)].filter(e=>!T||(e.textContent||'').trim().includes(T))[${a.nth || 0}];if(!el)throw new Error('click target not found: '+S+' '+T);el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();const c=${CURSOR_JS};c.style.left=(r.left+r.width/2)+'px';c.style.top=(r.top+r.height/2)+'px';await new Promise(r=>setTimeout(r,${a.fast ? 120 : 600}));c.style.transform='translate(-50%,-50%) scale(.7)';await new Promise(r=>setTimeout(r,120));el.click();c.style.transform='translate(-50%,-50%)';return true})()`
        );
        await env.sleep(a.after || 250);
        break;
      }
      case 'fill': {
        const v = sub(a.value, env, ctx);
        await env.eval(
          `(async()=>{const el=document.querySelector(${q(a.sel)});if(!el)throw new Error('fill target not found');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();const c=${CURSOR_JS};c.style.left=(r.left+20)+'px';c.style.top=(r.top+r.height/2)+'px';await new Promise(r=>setTimeout(r,350));el.focus();const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;let v='';for(const ch of ${q(v)}){v+=ch;set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,22))}return true})()`
        );
        break;
      }
      case 'newUser': {
        const u = await makeUser(env, a.username || 'tourist');
        if (a.favorite) await api(env, 'POST', '/favorites', { personaId: a.favorite }, u.token);
        ctx.user = u;
        break;
      }
      case 'signInUI': { // the real login form, typed and submitted
        await runActions([
          { do: 'go', route: '#/login', wait: '#email' },
          { do: 'fill', sel: '#email', value: '{email}' },
          { do: 'fill', sel: '#password', value: '{password}' },
          { do: 'click', sel: 'button[type=submit]' },
          { do: 'sleep', ms: a.settle || 1300 },
        ], env, ctx);
        break;
      }
      case 'signInAs': { // put an already-created user's token in this app's storage, then load the route
        const u = ctx.users[a.user];
        await env.eval(`(()=>{localStorage.setItem(${q(env.tokenKey)},${q(u.token)});return true})()`);
        await env.navigate(env.appUrl + (a.route || '#/'));
        await env.injectSpotlight();
        await env.sleep(a.settle || 900);
        break;
      }
      case 'spot': {
        await env.injectSpotlight();
        const ok = await env.eval(
          `(()=>{const S=${q(a.sel)},T=${q(a.text || '')};const el=[...document.querySelectorAll(S)].find(e=>!T||(e.textContent||'').includes(T));document.querySelectorAll('[data-tour-spot]').forEach(x=>x.removeAttribute('data-tour-spot'));if(!el)return false;el.scrollIntoView({block:'center'});el.setAttribute('data-tour-spot','1');if(window.__lhiSpotlight){window.__lhiSpotlight('[data-tour-spot]',${q(a.say || '')},{label:${q(a.label || 'Look here')},durationMs:0})}return true})()`
        );
        if (!ok && !a.optional) throw new Error('spot target not found: ' + a.sel);
        await env.sleep(a.hold || 700);
        break;
      }
      case 'check': { // evaluate a JS expression inside the app and judge it against the story for THIS side
        const js = sub(a.js, env, ctx);
        const expect = a.expect && a.expect[env.side];
        // poll: a live app answers when it answers (network, render); wait for the story to come true, report the last value either way
        const end = Date.now() + (a.poll === false ? 0 : (a.timeout || 4500));
        let val;
        for (;;) {
          try { val = await env.eval(`(async()=>{try{return await (${js})}catch(e){return 'ERR '+e.message}})()`); } catch (e) { val = 'ERR ' + e.message; }
          if (judge(expect, val) || Date.now() >= end) break;
          await env.sleep(250);
        }
        ctx.report({ side: env.side, kind: 'check', label: a.label, value: String(val).slice(0, 200), ok: judge(expect, val), bug: a.bugSide === env.side });
        break;
      }
      case 'flow': await runFlow(a.name, env, ctx); break;
      default: throw new Error('unknown action ' + a.do);
    }
  }
}

// ---- API flows (live requests against this pane's API) -----------------------------------------------------------
// Each row: bug=true means "this row's value is the buggy behaviour"; the step supplies which side should show it.
export async function runFlow(name, env, ctx) {
  const rows = [];
  const row = (label, value, bug) => rows.push({ label, value: String(value), bug });
  if (name === 'minPrice') {
    const r = await api(env, 'GET', '/personas?minPrice=80');
    const prices = (r.body || []).map((p) => p.price);
    const below = prices.filter((p) => p < 80).length;
    row('GET /personas?minPrice=80 returned', `${prices.length} personas, cheapest $${Math.min(...prices).toFixed(2)}`, below > 0);
    row('priced under $80 (should be none)', below, below > 0);
  } else if (name === 'loginShape') {
    const u = await makeUser(env);
    const r = await api(env, 'POST', '/auth/login', { email: u.email, password: u.password });
    const keys = Object.keys((r.body && r.body.user) || {});
    row('POST /auth/login status', r.status, null);
    row('user object in the response', JSON.stringify({ ...(r.body.user || {}) }), !keys.includes('username'));
  } else if (name === 'ownership') {
    const alice = await makeUser(env, 'alice'), bob = await makeUser(env, 'bob');
    ctx.users.alice = alice; ctx.users.bob = bob;
    const add = await api(env, 'POST', '/cart', { personaId: 'p-002', quantity: 1 }, alice.token);
    const items = (add.body && add.body.items) || [];
    const itemId = items[0] && items[0].id;
    row('Alice adds an item to her cart', `${add.status} (item ${itemId})`, null);
    const del = await api(env, 'DELETE', '/cart/' + itemId, null, bob.token);
    row("Bob deletes Alice's item", `HTTP ${del.status}`, del.status < 300);
    const cart = await api(env, 'GET', '/cart', null, alice.token);
    row('items left in Alice\'s cart', ((cart.body && cart.body.items) || []).length, ((cart.body && cart.body.items) || []).length === 0);
  } else if (name === 'checkout') {
    const alice = await makeUser(env, 'alice');
    ctx.users.alice = alice;
    await api(env, 'POST', '/cart', { personaId: 'p-003', quantity: 2 }, alice.token);
    const co = await api(env, 'POST', '/checkout', { name: 'Alice Tour', email: alice.email }, alice.token);
    row('POST /checkout', `HTTP ${co.status}`, null);
    const cart = await api(env, 'GET', '/cart', null, alice.token);
    const n = ((cart.body && cart.body.items) || []).length;
    row('items still in the cart after paying', n, n > 0);
  } else if (name === 'noAuth') {
    const u = await makeUser(env);
    const a = await api(env, 'GET', '/cart');
    row('GET /cart with NO token', `HTTP ${a.status}`, a.status >= 500);
    const b = await api(env, 'GET', '/cart', null, u.token);
    row('GET /cart with a VALID token', `HTTP ${b.status}`, b.status >= 500);
  } else throw new Error('unknown flow ' + name);
  for (const r of rows) ctx.report({ side: env.side, kind: 'flow', label: r.label, value: r.value, bug: r.bug, ok: r.bug === null ? null : r.bug === (env.side === 'before') });
  return rows;
}

// ---- one step on one side ----------------------------------------------------------------------------------------
// Returns {ok, error?}. Never throws: a failing live action is REPORTED, not hidden.
export async function runStepSide(step, env, ctx) {
  try {
    ctx.users = ctx.users || {}; ctx.user = null;
    if (step.kind === 'terminal') return { ok: true };
    const start = (step.start && step.start[env.side]) || step.route || '#/';
    if (env.clearToken) { env.clearToken(); } else { // other environments: load once, clear the stored sign-in, load again
      await env.navigate(env.appUrl + start);
      await env.injectSpotlight();
      await env.eval(`(()=>{try{localStorage.removeItem(${q(env.tokenKey)})}catch(e){}return true})()`);
    }
    await env.navigate(env.appUrl + start);
    await env.injectSpotlight();
    await waitFor(env, '#root h1, #root nav', '', 12000);
    await env.sleep(500);
    await runActions(step.actions && step.actions.both, env, ctx);
    await runActions(step.actions && step.actions[env.side], env, ctx);
    return { ok: true };
  } catch (e) {
    ctx.report({ side: env.side, kind: 'error', label: 'live action did not complete', value: String(e.message || e).slice(0, 200), ok: false });
    return { ok: false, error: String(e.message || e) };
  }
}

export function mergeSteps(texts, defs) {
  const byId = Object.fromEntries(texts.map((t) => [t.id, t]));
  return defs.map((d) => ({ ...(byId[d.id] || {}), ...d }));
}

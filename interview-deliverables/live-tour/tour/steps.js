// ECI live tour: what each step DOES to the two real apps. Text (title, how found, fix, code diff, commit) lives in steps-text.json
// and is merged by id. Used verbatim by the in-page tour AND by playwright-tour.mjs.
//
// bugSide on a check names the side that is EXPECTED to show the bug ("before"). expect:{before,after} says what each side should read;
// a green tick means "this side behaved the way the story says", a red cross means the live app did NOT match the story.

// App paths are RELATIVE TO THE TOUR PAGE so the tour works wherever the deliverable folder set is hosted (private portal or a public copy).
// API paths are absolute (served by nginx at the site root).
export const SIDES = {
  before: { label: 'BEFORE · original code', short: 'Before', app: 'before/app/index.html', api: '/eci-storefront-api-before', tokenKey: 'auth_token_b' },
  beforePure: { label: 'BEFORE · original code, exactly as shipped', short: 'Before', app: 'before-pure/app/index.html', api: '/eci-storefront-api-before-pure', tokenKey: 'auth_token_bp' },
  after: { label: 'AFTER · fixed', short: 'After', app: '../eci-storefront-app/app/index.html', api: '/eci-storefront-api', tokenKey: 'auth_token' },
};

const CARD = 'a[href*="personas/"]';
const NAV_USER = 'nav .flex.items-center.gap-3';
const MSG = 'Look at the BEFORE side first, then the AFTER side.';
const chk = (label, js, before, after) => ({ do: 'check', label, js, bugSide: 'before', expect: { before, after } });

export const DEFS = [
  { id: 'intro', kind: 'ui', route: '#/', say: 'Welcome. On the left is the original storefront, exactly as it shipped with sixteen hidden bugs. On the right is the same storefront after the fixes. Press Next and I will drive both live apps for you.',
    actions: { both: [{ do: 'waitFor', sel: CARD }] } },

  { id: 'API-0', kind: 'terminal', say: 'First bug: nothing even builds. The left terminal is the real error from the original code. The right shows the same command passing after the fix.',
    terminal: { before: 'evidence/api0-before.txt', after: 'evidence/api0-after.txt' } },

  { id: 'API-1', kind: 'ui', route: '#/?minPrice=80', say: 'Price filter. We ask for personas costing at least eighty dollars. The original also returns cheap ones. The fixed server returns only the personas that qualify.',
    actions: { both: [
      { do: 'waitFor', sel: CARD },
      { do: 'spot', sel: 'h1', text: 'Discover', label: 'minPrice = 80', say: 'The page asked for personas costing at least $80.' },
      chk('persona cards shown for "minimum price 80"', `document.querySelectorAll('${CARD}').length`, '^(1[0-5]|[3-9])$', '^2$'),
      { do: 'flow', name: 'minPrice' },
    ] } },

  { id: 'API-2', kind: 'ui', route: '#/', say: "Login. The server's reply to a sign-in is missing the username, which the shared contract requires. Watch what the sign-in form receives. The original gets only an id and an email. The fixed server includes the username.",
    actions: { both: [
      { do: 'netlog' }, { do: 'newUser' }, { do: 'signInUI' },
      { do: 'spot', sel: NAV_USER, label: 'Signed-in area', say: 'This area is first filled from the login reply.' },
      chk('user fields the sign-in form received', `(window.__tourNet||[]).filter(r=>/auth\\/login/.test(r.p)).map(r=>r.k||'').join('')`, '^id, email$', 'username'),
      { do: 'flow', name: 'loginShape' },
    ] } },

  { id: 'API-3', kind: 'terminal', say: 'Browser delete. Before a browser deletes anything it asks the server for permission. The original server only allowed get, post and put, so delete was refused. The fix adds delete.',
    terminal: { before: 'evidence/api3-before.txt', after: 'evidence/api3-after.txt' } },

  { id: 'API-4', kind: 'ui', route: '#/', say: "Security hole. Bob deletes Alice's cart item. The original server allows it and Alice's cart empties. The fixed server answers not found and Alice keeps her item.",
    actions: { both: [
      { do: 'flow', name: 'ownership' },
      { do: 'signInAs', user: 'alice', route: '#/cart' }, { do: 'waitFor', sel: 'h1, h2', timeout: 12000 }, { do: 'sleep', ms: 600 },
      { do: 'spot', sel: 'h1, h2', label: "Alice's cart", say: "This is Alice's real cart, after Bob tried to delete her item." },
      chk("Alice's cart still has her item", `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Remove')`, false, true),
    ] } },

  { id: 'API-5', kind: 'ui', route: '#/', say: 'Checkout. After paying, the original leaves the items in the cart. The fixed server empties it.',
    actions: { both: [
      { do: 'flow', name: 'checkout' },
      { do: 'signInAs', user: 'alice', route: '#/cart' }, { do: 'waitFor', sel: 'h1, h2', timeout: 12000 }, { do: 'sleep', ms: 600 },
      { do: 'spot', sel: 'h1, h2', label: 'Cart after paying', say: 'Alice already paid. The cart should be empty.' },
      chk('cart is empty after paying', `/empty/i.test(document.querySelector('#root').innerText)`, false, true),
    ] } },

  { id: 'API-6', kind: 'ui', route: '#/', variant: { before: 'beforePure' }, say: 'Login protection. The original shipped with authentication switched off, so every signed in request crashed on the server. Here the add to cart request fails, and the name never appears. The fixed server checks the token.',
    actions: { both: [
      { do: 'netlog' }, { do: 'newUser' }, { do: 'signInUI', settle: 1500 },
      { do: 'go', route: '#/personas/p-001', wait: 'button', waitText: 'Add to Cart' },
      { do: 'click', sel: 'button', text: 'Add to Cart', after: 1800 },
      { do: 'spot', sel: 'nav', label: 'After signing in and adding to the cart', say: 'Your name and the cart badge belong here.' },
      chk('navbar shows your name', `/tourist/.test(document.querySelector('nav').innerText)`, false, true),
      chk('request the Add to Cart click sent', `(window.__tourNet||[]).filter(r=>r.m==='POST'&&/\\/cart/.test(r.p)).map(r=>r.m+' '+r.p+' → '+r.s).join(', ')||'none'`, '500', '200'),
      { do: 'flow', name: 'noAuth' },
    ] } },

  { id: 'WEB-1', kind: 'terminal', say: 'The web app would not type check. First the stray types error, then, once that is cleared, a second error about a type that was never exported.',
    terminal: { before: 'evidence/web1-before.txt', after: 'evidence/web1-after.txt' } },

  { id: 'WEB-2', kind: 'ui', route: '#/', say: 'Prices. A forty nine dollar persona showed as four thousand nine hundred dollars, because the card multiplied by one hundred.',
    actions: { both: [
      { do: 'waitFor', sel: CARD },
      { do: 'spot', sel: `${CARD} p.text-lg`, label: 'Price', say: 'Look at the price.' },
      chk('first price on the page', `(document.querySelector('${CARD} p.text-lg')||{}).innerText||''`, '\\$\\d{4,}', '^\\$\\d{2}\\.\\d\\d'),
    ] } },

  { id: 'WEB-3', kind: 'ui', route: '#/', say: 'Filtering. We click Security. The original keeps showing the same fifteen personas, because its cache key ignored the filter. The fix refreshes the list.',
    actions: { both: [
      { do: 'waitFor', sel: CARD },
      chk('cards before filtering', `document.querySelectorAll('${CARD}').length`, '^15$', '^15$'),
      { do: 'spot', sel: 'button', text: 'Security', label: 'Filter', say: 'We choose the Security specialty.' },
      { do: 'click', sel: 'button', text: 'Security', after: 1600 },
      chk('cards after choosing Security', `document.querySelectorAll('${CARD}').length`, '^15$', '^(?!15$)\\d+$'),
    ] } },

  { id: 'WEB-4', kind: 'ui', route: '#/', say: 'The favorite heart did the opposite. Clicking it on the original sends a delete request that fails. On the fixed app the heart turns red.',
    actions: { both: [
      { do: 'newUser' }, { do: 'signInUI' }, { do: 'netlog' },
      { do: 'go', route: '#/personas/p-001', wait: 'button svg.w-6' },
      { do: 'spot', sel: 'button:has(svg.w-6)', label: 'Favorite', say: 'We click the heart.' },
      { do: 'click', sel: 'button:has(svg.w-6)', after: 1500 },
      chk('heart is red (favorited)', `[...document.querySelectorAll('button svg.w-6')].some(s=>/text-red-500/.test(s.getAttribute('class')))`, false, true),
      chk('request the click sent', `(window.__tourNet||[]).filter(r=>/favorites/.test(r.p)).map(r=>r.m+' '+r.p+' → '+r.s).join(', ')||'none'`, 'DELETE.*400', 'POST.*20\\d'),
    ] } },

  { id: 'WEB-5', kind: 'ui', route: '#/', say: 'Two pages shared one cache entry with different shapes of data. Visit the favorites page, then a persona, and the original crashes with a not a function error. It also asked for favorites while signed out.',
    actions: { both: [
      { do: 'netlog' },
      { do: 'go', route: '#/personas/p-001', wait: 'h1', settle: 1600 },
      chk('"favorites" requests that failed while signed out', `(window.__tourNet||[]).filter(r=>/favorites/.test(r.p)&&r.s===401).length`, '^[1-9]', '^0$'),
      { do: 'newUser', favorite: 'p-003' }, { do: 'signInUI' },
      { do: 'go', route: '#/favorites', wait: CARD, settle: 900 },
      { do: 'go', route: '#/personas/p-001', settle: 1800 },
      { do: 'spot', sel: '#root', label: 'Persona page', say: 'The persona page, reached after the favorites page.', optional: true },
      chk('persona page crashed', `/Something went wrong/i.test(document.querySelector('#root').innerText)`, true, false),
      chk('what the page shows', `document.querySelector('#root').innerText.replace(/\\s+/g,' ').slice(0,90)`, 'went wrong', 'Back to browse'),
    ] } },

  { id: 'WEB-6', kind: 'ui', route: '#/', say: 'Sign out. On the original, reloading the page signs you straight back in, because the login token stayed in the browser.',
    actions: { both: [
      { do: 'newUser' }, { do: 'signInUI' },
      { do: 'spot', sel: 'nav button', text: 'Sign out', label: 'Sign out', say: 'We sign out, then reload the page.' },
      { do: 'click', sel: 'nav button', text: 'Sign out', after: 900 },
      { do: 'reload', route: '#/' }, { do: 'sleep', ms: 1400 },
      chk('signed in again after sign out + reload', `/Sign out/.test(document.querySelector('nav').innerText)`, true, false),
      chk('login token left in browser storage', `localStorage.getItem('{tokenKey}')!==null`, true, false),
    ] } },

  { id: 'WEB-7', kind: 'ui', route: '#/', say: 'The cart badge. We add an item. The original badge stays blank until you reload. The fixed badge updates right away.',
    actions: { both: [
      { do: 'newUser' }, { do: 'signInUI' },
      { do: 'go', route: '#/personas/p-001', wait: 'button', waitText: 'Add to Cart' },
      { do: 'click', sel: 'button', text: 'Add to Cart', after: 1800 },
      { do: 'spot', sel: 'nav a[href*="cart"]', label: 'Cart badge', say: 'The cart should now show a 1.' },
      chk('cart badge number after adding', `(document.querySelector('nav a[href*="cart"] span')||{textContent:'none'}).textContent`, '^none$', '^1$'),
    ] } },

  { id: 'WEB-8', kind: 'ui', route: '#/', say: 'Quantity. At one, the minus button is not disabled in the original, so clicking it asks the server for quantity zero, which fails. The fixed button is disabled.',
    actions: { both: [
      { do: 'newUser' }, { do: 'signInUI' }, { do: 'netlog' },
      { do: 'go', route: '#/personas/p-001', wait: 'button', waitText: 'Add to Cart' },
      { do: 'click', sel: 'button', text: 'Add to Cart', after: 1200 },
      { do: 'go', route: '#/cart', wait: 'button', waitText: 'Remove', settle: 600 },
      { do: 'spot', sel: 'button', text: '-', label: 'Minus at quantity 1', say: 'We click minus with a quantity of one.' },
      chk('minus button is disabled at quantity 1', `([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='-')||{}).disabled===true`, false, true),
      { do: 'click', sel: 'button', text: '-', after: 1400 },
      chk('request the click sent', `(window.__tourNet||[]).filter(r=>r.m==='PUT').map(r=>r.m+' '+r.p+' → '+r.s).join(', ')||'none (button was disabled)'`, 'PUT.*400', 'none'),
    ] } },

  { id: 'WEB-9', kind: 'ui', route: '#/', say: 'Star ratings. The original gave every partial star the same gradient name, so one card\'s fill leaked onto all the others.',
    actions: { both: [
      { do: 'waitFor', sel: CARD },
      { do: 'spot', sel: `${CARD} .flex.items-center.gap-0\\.5`, label: 'Stars', say: 'Each half star has its own gradient.' },
      chk('gradient ids on the page (distinct / total)', `(()=>{const ids=[...document.querySelectorAll('linearGradient')].map(g=>g.id);return new Set(ids).size+' distinct / '+ids.length+' total'})()`, '^1 distinct / \\d+ total$', '^(\\d+) distinct / \\1 total$'),
    ] } },

  { id: 'finale', kind: 'ui', route: '#/', say: 'That is all sixteen. Each one was reproduced live on the original app, and shown fixed.',
    actions: { both: [{ do: 'waitFor', sel: CARD }] } },
];

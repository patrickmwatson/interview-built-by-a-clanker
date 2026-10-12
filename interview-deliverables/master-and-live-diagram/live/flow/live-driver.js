// Live driver: follows a Server-Sent Events stream and walks the flow's `live` map through the engine's control API.
// INERT unless the page URL has ?live. Contract: docs/CONTROL-API.md §3. Upstreamed from ECI W8 (viewer-ld), with every
// project-specific rule replaced by data: the event→steps map, the start step and the end step all come from the flow file.
//   ?live | ?live=1 [&events=<url>] [&replay=1] · ?live=<url> · &flow=<id> · &focus=<id>|top
// A rejected or flagged outcome, or a repeat of a step, is drawn as a runtime CLONE of the hop carrying its own status and
// code, so the static flow stays as authored and a retry after a rejection turns green again.
(function () {
  const q = new URLSearchParams(location.search); if (!q.has('live')) return
  const lv = q.get('live'), src = lv && lv !== '1' ? lv : q.get('events') || './events?replay=' + (q.get('replay') || '0')
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), LD = () => window.__LD
  const queue = [], seen = {}, live = (window.__LIVE = { events: 0, walked: [], log: [], connected: false, idle: true }); let n = 0, busy = false
  const badge = document.createElement('div'); badge.id = 'live-badge'
  badge.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:50;background:#1A1423;color:#EDD9FF;font:600 12px system-ui;padding:7px 12px;border-radius:999px;box-shadow:0 4px 14px #0003'
  badge.title = 'Following a live event stream. Each event moves the dot; a rejection turns its line red with the error code.'
  const show = (t) => { badge.textContent = t }; show('○ LIVE: connecting…')
  const ready = () => new Promise((r) => { const t = setInterval(() => { const l = LD(); if (l && l.nodes && l.nodes.length && l.goto) { clearInterval(t); r() } }, 100) })
  // the level to watch: the top-level element that most live hops happen inside (data-derived; ?focus overrides, ?focus=top = none)
  const autoFocus = (fl) => { const c = {}; for (const ids of Object.values(fl.live.ok || {})) for (const id of ids) { const s = fl.steps[id]
    for (const x of s && s.kind === 'hop' ? [s.from, s.to] : []) if (x && x.includes('.')) { const t = x.split('.')[0]; c[t] = (c[t] || 0) + 1 } }
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || null }
  async function play(ev) {
    const fl = LD().flow, map = fl.live; if (!map) return
    live.current = ev // family v7: the engine's console feed stamps each walked step with this event's trace_id / entity (CONTROL-API §8)
    const table = ev.outcome === 'rejected' ? map.rejected || {} : map.ok || {}
    const key = ev.kind && table[`${ev.step}:${ev.kind}`] ? `${ev.step}:${ev.kind}` : ev.step, ids = table[key]
    live.log.push(`${ev.step} ${ev.outcome}${ev.code ? ' ' + ev.code : ''}`)
    if (!ids) return show(`● LIVE · ${live.events} events · ${ev.step} (not drawn)`)
    if (ids[0] === fl.start && LD().history.length) { LD().reset(); for (const k in seen) delete seen[k]; await sleep(400) } // a new run begins
    let last = null
    for (const [i, id] of ids.entries()) {
      const st = LD().flow.steps[id]; if (!st) continue; let k = id
      const isLast = i === ids.length - 1, fail = ev.outcome === 'rejected', flag = ev.outcome === 'flagged' && ev.code && isLast
      if (st.kind === 'hop' && (fail || flag || seen[id])) {
        const why = `${ev.code}${ev.trace_id ? ` (trace ${ev.trace_id})` : ''}${ev.message ? `: ${ev.message}` : ''}`
        const ov = fail ? { status: 'fail', code: ev.code, ...(isLast ? { label: `${ev.http_status ? ev.http_status + ' ' : ''}${ev.code}`, explain: `Rejected: ${why}.` } : {}) }
          : flag ? { label: `${st.label} ⚑ ${ev.code}`, explain: `${st.explain || ''} Flagged ${why}: succeeded with a warning.`.trim() } : {}
        k = LD().addStep(`${id}~${++n}`, { ...st, ...ov })
      }
      seen[id] = true; LD().goto(k); live.walked.push(k); last = st
      const back = queue.length > 2 ? 3 : 1, sp = LD().speed || 1100
      await sleep(st.kind === 'decision' ? 700 / back : (sp * (st.returns ? 1.2 : 0.8) + 450) / back)
    }
    if (ev.outcome !== 'rejected' && last?.kind === 'hop' && LD().flow.steps[last.next]?.kind === 'end') { LD().goto(last.next); live.walked.push(last.next) }
  }
  async function pump() {
    if (busy) return; busy = true; live.idle = false
    while (queue.length) { const ev = queue.shift(); try { await play(ev) } catch (e) { console.error('[live-driver]', e) } show(`● LIVE · ${live.events} events · last: ${ev.step} ${ev.outcome}${ev.code ? ' · ' + ev.code : ''}`) }
    busy = false; live.idle = true
  }
  ready().then(async () => {
    const target = q.get('flow') || LD().liveFlowId()
    if (target && LD().flow.id !== target) { LD().selectFlow(target); await sleep(900) }
    if (!LD().flow.live) { show('○ LIVE: no flow with a live map'); document.body.appendChild(badge); return }
    const f = q.get('focus') || autoFocus(LD().flow); if (f && f !== 'top') LD().setFocus(f)
    live.on = true; document.body.appendChild(badge)
    const es = new EventSource(src)
    es.onopen = () => { live.connected = true; show(`● LIVE · waiting for events (${src.replace(/^\.\//, '/')})`) }
    es.onerror = () => { live.connected = false; show('○ LIVE: event stream lost, retrying…') }
    es.onmessage = (m) => { let ev; try { ev = JSON.parse(m.data) } catch { return } live.events++; queue.push(ev); pump() }
  })
})()

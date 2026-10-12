// LHI Spotlight — Playwright DOM Highlighting for Demos
// Canonical implementation. Reference: ~/.claude/rules/lhi-spotlight-pattern.md
//
// Three call signatures (use fastest one that fits):
//   1. window.__lhiSpotlight(selector, message, opts)
//      Highlight an element you can already select by CSS / id.
//
//   2. window.__lhiSpotlight.text(visibleText, message, opts)
//      Find by visible text content (smallest enclosing clickable element)
//      then highlight in one call. ZERO diagnostic round-trips needed.
//
//   3. window.__lhiSpotlight.byText(visibleText, opts)
//      Returns the DOM element matching the text. Useful when you want to
//      do something with the element other than spotlight it.
//
// opts supported by all three:
//   color:      border + arrow color (default '#BA9EFF' Ozura amethyst)
//   glow:       outer glow rgba (default 'rgba(186,158,255,0.65)')
//   durationMs: how long the spotlight stays (default 8000; 0 = forever)
//   label:      uppercase tooltip header (default 'Look here')
//   enclosing:  CSS selector — walk up from found text element to this
//   clickable:  default true — walk up to nearest button/link/label/etc.
//   survive:    default false — install a loop-safe, throttled MutationObserver that
//               RE-APPLIES the spotlight if a page re-render wipes it (live/polling pages,
//               e.g. the CSM dashboard). Auto-stops after durationMs (if >0). One at a time.
//               Proven by the playwright-enforcement-pilot (2026-06-27): 0/3 -> 3/3.
//
// The spotlight (border + glow + tooltip + arrow) FOLLOWS its target on scroll/resize (a
// requestAnimationFrame loop re-reads the target's rect every frame and repositions the tooltip;
// the border+glow are a box-shadow ON the target so they track it inherently), and AUTO-DISMISSES
// the instant the target is interacted with (pointerdown/click) OR removed from the DOM. NO
// MutationObserver is used for follow/dismiss (per observer-loop-guard) — rAF + isConnected only.
//
// History:
//   v1 (2026-05-20): border-around-tooltip (rejected by Patrick)
//   v2 (2026-05-20): box-shadow border on target + animated outer glow + arrow tooltip
//   v3 (2026-05-21): productionized to this file + byText/text helpers (10x faster for agent workflows — no more diagnostic round-trips)
//   v5 (2026-07-13): auto-dismiss on interaction/removal + rAF follow-on-scroll/resize (bugs observed live; fix 737b9f9c)

(function installLhiSpotlight() {
  if (window.__lhiSpotlight && window.__lhiSpotlight.__version >= 6) return

  // Teardown handle for the single active spotlight instance (rAF + interaction listeners live here).
  // Module-scoped so a replacement spotlight (or an explicit dismiss) cleanly tears the prior one down.
  let activeDismiss = null
  function clearActive(dopts) {
    if (activeDismiss) { try { activeDismiss(dopts) } catch (e) {} activeDismiss = null }
  }

  // v6 (2026-09-18): the HUMAN can turn Spotlight off. `off()` silences it for this page until `on()`;
  // a muted call returns {ok:false, muted:true} so a driving agent KNOWS nothing was drawn.
  let pageOff = false
  function spotlight(selector, message, opts) {
    opts = opts || {}
    if (pageOff) return { ok: false, muted: true }
    const color = opts.color || '#BA9EFF'
    const glow = opts.glow || 'rgba(186,158,255,0.65)'
    const durationMs = opts.durationMs == null ? 8000 : opts.durationMs

    // Tear down the prior instance's rAF loop + interaction listeners first, then strip any stray DOM.
    clearActive({ stopSurvivor: false })
    document.querySelectorAll('[data-lhi-spotlight]').forEach(el => el.remove())
    document.querySelectorAll('[data-lhi-spotlight-target]').forEach(el => {
      el.style.outline = ''
      el.style.outlineOffset = ''
      el.style.boxShadow = ''
      el.style.animation = ''
      el.removeAttribute('data-lhi-spotlight-target')
    })

    const target = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector // accept raw DOM node
    if (!target) return { ok: false, error: 'selector not found: ' + selector }

    if (!document.querySelector('style[data-lhi-spotlight-keyframes]')) {
      const sty = document.createElement('style')
      sty.setAttribute('data-lhi-spotlight-keyframes', '1')
      sty.textContent =
        '@keyframes __lhi_spotlight_pulse {' +
        '  0%, 100% { box-shadow: 0 0 0 5px ' + color + ', 0 0 0 10px ' + glow + ', 0 0 28px 12px ' + glow + '; }' +
        '  50%      { box-shadow: 0 0 0 5px ' + color + ', 0 0 0 14px ' + glow + ', 0 0 40px 20px ' + glow + '; }' +
        '}'
      document.head.appendChild(sty)
    }

    // The border + glow are a box-shadow ON the target element (via the pulse keyframes), so they
    // TRACK the element on scroll/resize inherently — no per-frame repositioning needed for them.
    target.setAttribute('data-lhi-spotlight-target', '1')
    target.style.animation = '__lhi_spotlight_pulse 1.4s ease-in-out infinite'
    target.style.borderRadius = target.style.borderRadius || '4px'
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })

    // ── per-instance teardown state ──────────────────────────────────────────
    let rafId = 0
    let killTimer = 0
    let tip = null
    let onInteract = null
    let onEsc = null
    let done = false

    function dismiss(dopts) {
      if (done) return
      done = true
      dopts = dopts || {}
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
      if (killTimer) { clearTimeout(killTimer); killTimer = 0 }
      if (onInteract) {
        try { target.removeEventListener('pointerdown', onInteract, true) } catch (e) {}
        try { target.removeEventListener('click', onInteract, true) } catch (e) {}
        onInteract = null
      }
      try {
        target.style.animation = ''
        target.style.boxShadow = ''
        target.removeAttribute('data-lhi-spotlight-target')
      } catch (e) {}
      if (tip) { try { tip.remove() } catch (e) {} tip = null }
      if (onEsc) { try { document.removeEventListener('keydown', onEsc, true) } catch (e) {} onEsc = null }
      if (activeDismiss === dismiss) activeDismiss = null
      // A genuine user interaction is a FINAL dismissal — also stop the survivor so it doesn't
      // re-apply the spotlight the user just dismissed. Removal (re-render) does NOT stop it, so
      // the survive feature can re-apply after the page redraws.
      if (dopts.stopSurvivor && window.__lhiSpotlightObs) {
        try { window.__lhiSpotlightObs.disconnect() } catch (e) {}
        window.__lhiSpotlightObs = null
        if (window.__lhiSpotlightObsKill) { clearTimeout(window.__lhiSpotlightObsKill); window.__lhiSpotlightObsKill = null }
      }
    }
    activeDismiss = dismiss

    setTimeout(() => {
      if (done) return
      if (!target.isConnected) { dismiss({ stopSurvivor: false }); return }
      const arrowSize = 12

      tip = document.createElement('div')
      tip.setAttribute('data-lhi-spotlight', '1')
      Object.assign(tip.style, {
        position: 'fixed', zIndex: '999999',
        background: '#1A1423', color: '#EDD9FF',
        border: '1px solid rgba(186,158,255,0.4)',
        borderRadius: '10px', padding: '12px 16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '13px', lineHeight: '1.5',
        boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
      })

      const arrow = document.createElement('div')
      arrow.setAttribute('data-lhi-spotlight-arrow', '1')
      tip.appendChild(arrow)

      // v6 CLOSE CONTROL — the tooltip is pointer-transparent (it must never block the UI under it),
      // so ONLY this button takes pointer events. Click = remove tooltip + border + glow for good
      // (also stops a `survive` re-apply). Shift+click = Spotlight off for the whole page. Esc = close.
      const closeBtn = document.createElement('button')
      closeBtn.setAttribute('data-lhi-spotlight-close', '1')
      closeBtn.setAttribute('type', 'button')
      closeBtn.setAttribute('aria-label', 'Close this spotlight')
      closeBtn.title = 'Close this spotlight (Esc). Shift+click: turn Spotlight off for this whole page.'
      closeBtn.textContent = '\u00d7'
      Object.assign(closeBtn.style, {
        position: 'absolute', top: '4px', right: '6px', width: '20px', height: '20px', padding: '0',
        background: 'transparent', color: '#EDD9FF', border: 'none', borderRadius: '4px',
        font: '600 16px/20px -apple-system, BlinkMacSystemFont, sans-serif', cursor: 'pointer',
        pointerEvents: 'auto', opacity: '0.75',
      })
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation()
        if (e.shiftKey) pageOff = true
        dismiss({ stopSurvivor: true })
      }, true)
      tip.style.paddingRight = '30px'
      tip.appendChild(closeBtn)
      onEsc = function (e) { if (e.key === 'Escape') dismiss({ stopSurvivor: true }) }
      document.addEventListener('keydown', onEsc, true)

      const header = document.createElement('div')
      Object.assign(header.style, {
        fontWeight: '700', color: color, marginBottom: '4px',
        fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
      })
      header.textContent = '⟶ ' + (opts.label || 'Look here')
      tip.appendChild(header)

      const msg = document.createElement('div')
      msg.textContent = String(message || '')
      tip.appendChild(msg)

      document.body.appendChild(tip)

      // Re-read the target rect and reposition the tooltip + arrow. Called every animation frame so
      // the highlight TRACKS its element on scroll/resize (border+glow already track via box-shadow).
      function reposition() {
        const r = target.getBoundingClientRect()
        const vw = window.innerWidth
        const maxWidth = Math.min(440, vw - 32)
        tip.style.maxWidth = maxWidth + 'px'
        const placeBelow = r.top < 140
        const tipH = tip.offsetHeight || 110
        const tipTop = placeBelow ? r.bottom + arrowSize + 14 : Math.max(8, r.top - arrowSize - tipH - 2)
        const tipLeft = Math.max(8, Math.min(vw - maxWidth - 8, r.left + r.width / 2 - maxWidth / 2))
        tip.style.top = tipTop + 'px'
        tip.style.left = tipLeft + 'px'

        const arrowLeft = Math.max(20, Math.min(maxWidth - 20, r.left + r.width / 2 - tipLeft))
        arrow.style.position = 'absolute'
        arrow.style.width = '0'
        arrow.style.height = '0'
        arrow.style.left = (arrowLeft - arrowSize) + 'px'
        arrow.style.borderLeft = arrowSize + 'px solid transparent'
        arrow.style.borderRight = arrowSize + 'px solid transparent'
        if (placeBelow) {
          arrow.style.top = '-' + arrowSize + 'px'; arrow.style.bottom = ''
          arrow.style.borderBottom = arrowSize + 'px solid ' + color; arrow.style.borderTop = ''
          arrow.style.filter = 'drop-shadow(0 -2px 4px rgba(0,0,0,0.4))'
        } else {
          arrow.style.bottom = '-' + arrowSize + 'px'; arrow.style.top = ''
          arrow.style.borderTop = arrowSize + 'px solid ' + color; arrow.style.borderBottom = ''
          arrow.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
        }
      }

      reposition()

      function loop() {
        if (done) return
        if (!target.isConnected) { dismiss({ stopSurvivor: false }); return }  // removed from DOM → dismiss
        reposition()
        rafId = requestAnimationFrame(loop)
      }
      rafId = requestAnimationFrame(loop)

      // Auto-dismiss the instant the target is interacted with (one-shot; capture phase so it fires
      // before the target's own handlers). We do NOT preventDefault — the click still does its thing.
      onInteract = function () { dismiss({ stopSurvivor: true }) }
      target.addEventListener('pointerdown', onInteract, { capture: true, once: true })
      target.addEventListener('click', onInteract, { capture: true, once: true })

      if (durationMs > 0) killTimer = setTimeout(() => dismiss({ stopSurvivor: false }), durationMs)
    }, 300)

    if (opts.survive && typeof selector === 'string') {
      installSurvivor(function () { spotlight(selector, message, Object.assign({}, opts, { survive: false })) }, durationMs)
    }

    return { ok: true }
  }

  // Loop-safe + throttled survivor: re-applies the spotlight when a re-render wipes it.
  // Watches childList/subtree ONLY (never attributes) per observer-loop-guard; one at a time.
  function __spotlightPresent() {
    return !!(document.querySelector('[data-lhi-spotlight-target]') && document.querySelector('[data-lhi-spotlight]'))
  }
  function installSurvivor(reapplyFn, durationMs) {
    if (window.__lhiSpotlightObs) { try { window.__lhiSpotlightObs.disconnect() } catch (e) {} clearTimeout(window.__lhiSpotlightObsKill) }
    var busy = false, last = 0
    var obs = new MutationObserver(function () {
      var now = Date.now()
      if (busy || now - last < 600) return     // throttle >= tooltip delay, prevents thrash
      if (__spotlightPresent()) return          // idempotent: only act when actually wiped
      busy = true; last = now
      try { reapplyFn() } finally { busy = false }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    window.__lhiSpotlightObs = obs
    if (durationMs && durationMs > 0) window.__lhiSpotlightObsKill = setTimeout(function () { try { obs.disconnect() } catch (e) {} }, durationMs)
  }

  // Find smallest visible element whose visible text content contains needle.
  // Walks up to nearest clickable ancestor by default (so spotlight lands on
  // the button/card, not the inner text node).
  function byText(needle, opts) {
    opts = opts || {}
    const search = String(needle).trim()
    if (!search) return null
    const search_lc = search.toLowerCase()

    // Iterate elements; pick the one with shortest matching textContent.
    // "Shortest" = most specific (text closest to a leaf).
    const all = document.querySelectorAll('body *:not(script):not(style):not(svg):not(noscript)')
    let best = null
    let bestLen = Infinity
    for (const el of all) {
      // Skip hidden
      if (!el.offsetParent && el !== document.body) continue
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim()
      if (!txt) continue
      if (!txt.toLowerCase().includes(search_lc)) continue
      if (txt.length < bestLen) {
        bestLen = txt.length
        best = el
      }
    }
    if (!best) return null

    // Walk up to a more meaningful enclosing element if requested or by default.
    if (opts.enclosing) {
      const enc = best.closest(opts.enclosing)
      if (enc) return enc
    }
    if (opts.clickable !== false) {
      const clickable = best.closest(
        'button, a, label, [role="button"], [role="radio"], [role="link"], [role="tab"], input[type="submit"], input[type="button"]'
      )
      if (clickable) return clickable
    }
    return best
  }

  // One-call combo: find by text, then spotlight.
  function text(needle, message, opts) {
    const el = byText(needle, opts)
    if (!el) return { ok: false, error: 'no visible element with text: ' + needle }
    // Give it an id so the selector handle is stable for the spotlight code.
    if (!el.id) el.id = '__lhi_spotlight_target_' + Math.random().toString(36).slice(2, 9)
    const res = spotlight(el, message, Object.assign({}, opts, { survive: false }))
    if (opts && opts.survive) {
      installSurvivor(function () {
        const e = byText(needle, opts)
        if (!e) return
        if (!e.id) e.id = '__lhi_spotlight_target_' + Math.random().toString(36).slice(2, 9)
        spotlight(e, message, Object.assign({}, opts, { survive: false }))
      }, (opts.durationMs == null ? 8000 : opts.durationMs))
    }
    return res
  }

  spotlight.byText = byText
  spotlight.text = text
  // Explicit teardown handle (rarely needed — auto-dismiss covers interaction/removal).
  spotlight.dismiss = function () { clearActive({ stopSurvivor: true }) }
  spotlight.off = function () { pageOff = true; clearActive({ stopSurvivor: true }) }
  spotlight.on = function () { pageOff = false }
  spotlight.isOff = function () { return pageOff }
  spotlight.__version = 6
  window.__lhiSpotlight = spotlight
})()

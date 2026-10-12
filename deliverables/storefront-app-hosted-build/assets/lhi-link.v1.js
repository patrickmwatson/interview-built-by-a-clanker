/* scripts/lib/link/lhi-link.v1.js — clickable-links 0.0.1 (spec §15.1). The ⋯ button beside a file/commit/session chip opens
   the SAME alternatives card the /go/ page shows. createElement/textContent only — data-alts is never parsed as markup. */
(function () {
  'use strict'
  var open = null
  function close() { if (open) { open.remove(); open = null } }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e }
  function link(card, label, href) {
    var a = el('a', 'lhi-link-card__go', label); a.setAttribute('href', href); a.setAttribute('rel', 'noopener'); card.appendChild(a)
  }
  function copyRow(card, label, value) {
    var row = card.appendChild(el('div', 'lhi-link-card__row'))
    row.appendChild(el('span', 'lhi-link-card__k', label)); row.appendChild(el('code', 'lhi-link-card__v', value))
    var b = row.appendChild(el('button', 'lhi-link-card__copy', 'copy')); b.setAttribute('data-copy', value)
  }
  document.addEventListener('click', function (e) {
    var t = e.target
    var copy = t && t.getAttribute && t.getAttribute('data-copy')
    if (copy && open && open.contains(t)) {
      e.preventDefault()
      if (navigator.clipboard) navigator.clipboard.writeText(copy).then(function () { t.textContent = 'copied' }, function () {})
      return
    }
    var b = t && t.closest ? t.closest('.lhi-link__more') : null
    if (!b) { if (open && !open.contains(t)) close(); return }
    e.preventDefault()
    var again = open && open.__for === b
    close(); if (again) return
    var alts = {}; try { alts = JSON.parse(b.getAttribute('data-alts') || '{}') || {} } catch (_) { alts = {} }
    var card = el('div', 'lhi-link-card'); card.setAttribute('role', 'dialog'); card.__for = b
    if (alts.github) link(card, 'Open on GitHub', alts.github)
    if (alts.cursor) link(card, 'Open in Cursor (on your Mac)', alts.cursor)
    if (alts.short) link(card, 'Short link', alts.short)
    if (alts.mac) copyRow(card, 'Mac path', alts.mac)
    if (alts.do) copyRow(card, 'DO path', alts.do)
    var lim = alts.limits || []
    for (var i = 0; i < lim.length; i++) card.appendChild(el('div', 'lhi-link-card__limit', String(lim[i])))
    b.parentNode.appendChild(card); open = card
  })
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close() })
})()

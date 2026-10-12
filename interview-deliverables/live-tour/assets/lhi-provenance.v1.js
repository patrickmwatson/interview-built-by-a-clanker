/* lhi-provenance v1 — built by scripts/lib/provenance/build-render.mjs from render.js + lhi-ui-patterns:hover-tooltip. Do not edit; rebuild. */
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // scripts/user-claude-ssot/skills/lhi-ui-patterns-hover-tooltip/scripts/hover-tooltip.js
  var require_hover_tooltip = __commonJS({
    "scripts/user-claude-ssot/skills/lhi-ui-patterns-hover-tooltip/scripts/hover-tooltip.js"(exports, module) {
      /*!
       * LHI hover-tooltip — instant, reliable, multi-line hover tooltips.
       * Skill: lhi-ui-patterns:hover-tooltip   (SSOT — vendor a copy, don't fork the logic)
       *
       * WHY: the native `title=` attribute is unreliable — ~1s delay, vanishes on the
       * slightest mouse move, can't be styled, and renders multi-line inconsistently.
       * This shows INSTANTLY, follows the cursor, supports newlines, and is XSS-safe.
       *
       * USAGE:
       *   1. Put the text on ANY element:  <td data-tip="line one\nline two">…</td>
       *   2. Call installHoverTooltips() once after the DOM exists (idempotent — safe to
       *      call again; works with dynamically re-rendered content via event delegation).
       *   3. (optional) give hoverable elements `cursor:help` for affordance.
       *
       * Desktop: appears instantly on hover, follows the mouse, hides on leave/scroll.
       * Touch/mobile: hover does not exist — LONG-PRESS (~500ms) an element to explain it;
       *   the press does NOT fire the control's own action, and a plain TAP is untouched.
       *   (Per lhi-ui-hover-tooltips-everywhere-1, amended 2026-08-02: explaining and doing
       *   are different gestures.) See the touch section below for the full contract.
       *
       * No dependencies. Portable. Honors newlines via CSS `white-space:pre-line`.
       */
      (function(global) {
        function installHoverTooltips(opts) {
          opts = opts || {};
          var ATTR = opts.attr || "data-tip";
          if (global.__lhiTooltipInstalled) return global.__lhiTooltip;
          var box = document.createElement("div");
          box.setAttribute("role", "tooltip");
          box.style.cssText = [
            "position:fixed",
            "display:none",
            "max-width:" + (opts.maxWidth || 440) + "px",
            "background:" + (opts.bg || "#16162a"),
            "color:" + (opts.fg || "#e4e4f4"),
            "border:1px solid " + (opts.border || "#4a3a78"),
            "border-radius:8px",
            "padding:10px 12px",
            "font:12px/1.5 -apple-system,BlinkMacSystemFont,sans-serif",
            "white-space:pre-line",
            "z-index:2147483647",
            "box-shadow:0 10px 30px rgba(0,0,0,.55)",
            "pointer-events:none"
          ].join(";");
          document.body.appendChild(box);
          var accent = opts.accent || "#c6a6ff", dim = opts.dim || "#b9b9d0";
          function tipEl(el) {
            return el && el.closest ? el.closest("[" + ATTR + "]") : null;
          }
          function render2(t) {
            box.textContent = "";
            var lines = t.split("\n");
            for (var i = 0; i < lines.length; i++) {
              var ln = lines[i];
              if (ln.trim() === "") {
                var sp = document.createElement("div");
                sp.style.height = "6px";
                box.appendChild(sp);
                continue;
              }
              var row2 = document.createElement("div");
              row2.style.margin = "1px 0";
              var m = ln.match(/^([A-Z0-9 .·→\[\]]{1,28}):\s?([\s\S]*)$/);
              if (m) {
                var b = document.createElement("b");
                b.textContent = m[1] + ":";
                b.style.color = accent;
                b.style.fontWeight = "700";
                row2.appendChild(b);
                if (m[2]) row2.appendChild(document.createTextNode(" " + m[2]));
              } else {
                row2.textContent = ln;
                row2.style.color = dim;
              }
              box.appendChild(row2);
            }
          }
          function show(el, x, y) {
            var t = el.getAttribute(ATTR);
            if (!t) {
              hide();
              return;
            }
            render2(t);
            box.style.display = "block";
            pos(x, y);
          }
          function pos(x, y) {
            var b = box.getBoundingClientRect();
            var nx = x + 16, ny = y + 18;
            if (nx + b.width > innerWidth - 8) nx = Math.max(8, innerWidth - b.width - 8);
            if (ny + b.height > innerHeight - 8) ny = Math.max(8, y - b.height - 14);
            box.style.left = nx + "px";
            box.style.top = ny + "px";
          }
          function hide() {
            box.style.display = "none";
            box.__for = null;
          }
          document.addEventListener("mouseover", function(e) {
            var el = tipEl(e.target);
            if (el) show(el, e.clientX, e.clientY);
          });
          document.addEventListener("mousemove", function(e) {
            if (box.style.display !== "block") return;
            var el = tipEl(e.target);
            if (el) pos(e.clientX, e.clientY);
            else hide();
          });
          document.addEventListener("mouseout", function(e) {
            var el = tipEl(e.target);
            if (el && !(e.relatedTarget && tipEl(e.relatedTarget))) hide();
          });
          document.addEventListener("scroll", hide, true);
          var LONG_PRESS_MS = opts.longPressMs || 500;
          var MOVE_CANCEL_PX = opts.moveCancelPx || 10;
          var pressTimer = null, pressEl = null, pressX = 0, pressY = 0;
          var longPressFired = false, suppressUntil = 0;
          function endPress() {
            if (pressTimer) {
              clearTimeout(pressTimer);
              pressTimer = null;
            }
            if (pressEl) {
              pressEl.style.webkitTouchCallout = pressEl.__lhiCallout || "";
              pressEl.__lhiCallout = null;
            }
            pressEl = null;
          }
          document.addEventListener("touchstart", function(e) {
            hide();
            endPress();
            var el = tipEl(e.target);
            if (!el) return;
            var t = e.touches && e.touches[0];
            if (!t) return;
            pressEl = el;
            pressX = t.clientX;
            pressY = t.clientY;
            el.__lhiCallout = el.style.webkitTouchCallout || "";
            el.style.webkitTouchCallout = "none";
            pressTimer = setTimeout(function() {
              pressTimer = null;
              longPressFired = true;
              var r = el.getBoundingClientRect();
              show(el, r.left + r.width / 2, r.bottom);
              box.__for = el;
            }, LONG_PRESS_MS);
          }, { passive: true });
          document.addEventListener("touchmove", function(e) {
            if (!pressTimer) return;
            var t = e.touches && e.touches[0];
            if (!t) return;
            if (Math.abs(t.clientX - pressX) > MOVE_CANCEL_PX || Math.abs(t.clientY - pressY) > MOVE_CANCEL_PX) endPress();
          }, { passive: true });
          document.addEventListener("touchend", function() {
            if (longPressFired) {
              longPressFired = false;
              suppressUntil = Date.now() + 1200;
            }
            endPress();
          }, { passive: true });
          document.addEventListener("touchcancel", function() {
            longPressFired = false;
            endPress();
          }, { passive: true });
          document.addEventListener("click", function(e) {
            if (!suppressUntil || Date.now() > suppressUntil) {
              suppressUntil = 0;
              return;
            }
            suppressUntil = 0;
            e.stopImmediatePropagation();
            e.preventDefault();
          }, true);
          global.__lhiTooltipInstalled = true;
          global.__lhiTooltip = { box, hide };
          return global.__lhiTooltip;
        }
        global.installHoverTooltips = installHoverTooltips;
        if (typeof module !== "undefined" && module.exports) module.exports = { installHoverTooltips };
      })(typeof window !== "undefined" ? window : exports);
    }
  });

  // scripts/lib/provenance/lhi-provenance-entry.js
  var import_hover_tooltip = __toESM(require_hover_tooltip());

  // scripts/lib/platform-roots.mjs
  var ROOTS = Object.freeze({ do: "~/lhi_scripts", mac: "~/lhi_scripts" });

  // scripts/lib/provenance/constants.mjs
  var COMPONENT_NAME = "MakerMark";

  // scripts/lib/provenance/render.js
  var VERSION = "v1";
  var SCHEMA = "lhi-provenance@1";
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  var SANS = "ui-sans-serif, system-ui, -apple-system, sans-serif";
  function h(tag, style, ...kids) {
    const el = document.createElement(tag);
    if (style) Object.assign(el.style, style);
    for (const k of kids) if (k != null && k !== false) el.append(typeof k === "string" ? document.createTextNode(k) : k);
    return el;
  }
  var has = (v) => v != null && v !== "" && !(typeof v === "number" && Number.isNaN(v));
  var short = (sha) => has(sha) ? String(sha).slice(0, 7) : "";
  var blobWord = (f) => has(f.blob) ? `blob ${short(f.blob)}` : f.dirty ? "not committed yet" : "blob not recorded";
  function tipText(lines) {
    return lines.filter((l) => l && !/undefined|\bnull\b/.test(l)).join("\n");
  }
  function chip(label, href, tipLines, extra) {
    const ok = has(href) && /^(https:\/\/|cursor:\/\/)/.test(href);
    const el = h(ok ? "a" : "span", { color: "inherit", textDecoration: ok ? "underline" : "none", textDecorationStyle: ok ? "dotted" : void 0, textUnderlineOffset: "2px", fontFamily: MONO, whiteSpace: "nowrap", cursor: ok ? "pointer" : "help", ...extra }, label);
    if (ok) {
      el.setAttribute("href", href);
      if (href.startsWith("https://")) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      }
      el.addEventListener("click", (e) => e.stopPropagation());
    }
    el.setAttribute("data-tip", tipText(tipLines));
    return el;
  }
  var sep = () => h("span", { opacity: "0.55" }, " \xB7 ");
  function fmtEt(iso) {
    if (!has(iso)) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(d) + " ET";
  }
  var et = (o, k = "at") => o ? o[`${k}Et`] || fmtEt(o[k]) : "";
  function fromLegacy({ type, generatedBy, generatedAt, source, usedSkills } = {}) {
    if (type === "deliverable") {
      const skills = Array.isArray(usedSkills) && usedSkills.length ? usedSkills : ["lhi-deliverable:create", "lhi-deliverable:brand"];
      return { legacy: true, kind: "deliverable", summary: ["Made by ", ["code", skills[0]]], details: [["Skills used: ", ...skills.map((s) => ["code", s])], has(generatedAt) ? ["Generated: ", String(generatedAt)] : null].filter(Boolean) };
    }
    const live = type === "live";
    const skill = live ? "lhi-live-diagram:create" : `lhi-architecture-diagrams:${type || "unknown"}`;
    const embed = live ? "lhi-live-diagram:embed" : "lhi-architecture-diagrams:embed";
    const summary = ["Diagram made by ", ["code", skill]];
    if (has(source)) summary.push(" \xB7 data ", ["code", source]);
    const details = [["Embedded with ", ["code", embed], ", rendered by ", ["code", `lhi-diagram-embed.${VERSION}`]]];
    if (has(generatedBy)) details.push([`Generated by: ${generatedBy}${has(generatedAt) ? ` \xB7 ${generatedAt}` : ""}`]);
    if (has(source)) details.push(["Data: ", ["code", source]]);
    return { legacy: true, kind: "diagram", summary, details };
  }
  function parts(list) {
    return list.map((p) => Array.isArray(p) ? h("code", { fontFamily: MONO }, p[1]) : p);
  }
  function legacyChip() {
    const c = h("span", { display: "inline-block", marginLeft: "6px", padding: "0 6px", borderRadius: "6px", background: "rgba(100,116,139,0.18)", color: "#64748b", fontWeight: "500", fontSize: "11px" }, "legacy \u2014 versions not recorded");
    c.setAttribute("data-tip", tipText(["LEGACY: made before provenance records existed (2026-10-11)", "VERSION: not recorded \u2014 gets 0.0.1 on its next write", "FIX: lhi-provenance:backfill --dir <deliverable> (runs only on Patrick's go, card DP-4)"]));
    return c;
  }
  function skillTip(s) {
    const o = s.origin || {};
    return [
      `SKILL: ${s.ref}`,
      `VERSION: ${s.version || "not declared"}${s.versionSource ? ` (${s.versionSource})` : ""}${has(s.familyVersion) ? ` \xB7 family ${s.family} ${s.familyVersion}` : ` \xB7 family ${s.family}: no manifest yet`}`,
      `ROLE: ${s.role}`,
      s.dir ? `FOLDER: ${s.dir}/` : "",
      s.links?.mac ? `MAC: ${s.links.mac}` : "",
      s.links?.do ? `DO: ${s.links.do}` : "",
      has(o.firstCommit) ? `CREATED: ${o.firstCommitAtEt || fmtEt(o.firstCommitAt)} (commit ${short(o.firstCommit)}) \xB7 creating session: ${o.session || o.note || "not recorded"}` : ""
    ];
  }
  function fileTip(f, recVersion, what) {
    return [
      `${what}: ${f.path}`,
      `VERSION: ${has(f.blob) ? `git blob ${short(f.blob)}` : blobWord(f)}${f.entry ? " (entry script)" : ""} \xB7 record v${recVersion}`,
      f.links?.mac ? `MAC: ${f.links.mac}` : "",
      f.links?.do ? `DO: ${f.links.do}` : "",
      has(f.origin?.firstCommit) ? `CREATED: ${f.origin.firstCommitAtEt || fmtEt(f.origin.firstCommitAt)} (commit ${short(f.origin.firstCommit)})` : ""
    ];
  }
  function fileCount(r) {
    const set = /* @__PURE__ */ new Set();
    for (const s of r.skills || []) for (const f of s.scripts || []) if (f.path) set.add(f.path);
    for (const i of r.inputs || []) if (i.path) set.add(i.path);
    return set.size;
  }
  function histLabel(x) {
    return x.version ? `v${x.version}` : x.legacy ? "created (legacy)" : has(x.commit) ? `commit ${short(x.commit)}` : "version not recorded";
  }
  function recV(r) {
    return has(r.version) ? r.version : "none yet";
  }
  function summaryNew(r) {
    const main = (r.skills || []).find((s) => s.role === "main") || (r.skills || [])[0];
    const rv = recV(r);
    const out = [h("span", null, "Made by ")];
    out[0].setAttribute("data-lhi-made-by", "");
    if (main) out.push(main.links?.github ? chip(`${main.ref} v${main.version || "\u2014"}`, main.links.github, skillTip(main), { fontWeight: "700" }) : chip(`${main.ref} v${main.version || "\u2014"}`, null, skillTip(main), { fontWeight: "700" }));
    const n = (r.skills || []).length;
    out.push(sep(), `${n} skill${n === 1 ? "" : "s"}`, sep(), `${fileCount(r)} files`);
    if (has(r.repo?.commit)) {
      out.push(sep(), "commit ", chip(short(r.repo.commit), r.repo.commitUrl, [`COMMIT: ${r.repo.commit}`, `VERSION: record v${rv}`, `REPO: ${r.repo.name || ""} @ ${r.repo.branch || ""}`, r.repo.commitAtEt ? `AT: ${r.repo.commitAtEt}` : "", r.repo.pushed === false ? "PUSHED: not yet on the upstream" : ""]));
    }
    const made = et(r.made);
    if (made) out.push(sep(), made);
    const hist = (r.history || []).slice().reverse().map((x) => `${histLabel(x)} \xB7 ${et(x)} \xB7 ${x.change || ""}${x.by ? " \xB7 " + x.by : ""}`);
    out.push(sep(), chip(has(r.version) ? `v${r.version}` : "no version yet", null, [`${(r.subject?.kind || "artifact").toUpperCase()} VERSION: ${rv}`, "VERSION: history newest first \u2193", ...hist.slice(0, 8)], { fontWeight: "700" }));
    return out;
  }
  function row(label, ...kids) {
    return h(
      "div",
      { display: "grid", gridTemplateColumns: "84px 1fr", gap: "8px", padding: "3px 0", borderTop: "1px dashed rgba(100,116,139,0.25)" },
      h("span", { fontWeight: "700", letterSpacing: "0.06em", fontSize: "11px", opacity: "0.75", paddingTop: "1px" }, label),
      h("div", { minWidth: "0", overflowWrap: "anywhere" }, ...kids)
    );
  }
  function pathText(label, p, tip) {
    const b = h("button", { font: "inherit", fontFamily: MONO, fontSize: "11px", color: "inherit", background: "rgba(100,116,139,0.12)", border: "1px solid rgba(100,116,139,0.35)", borderRadius: "5px", padding: "0 5px", cursor: "copy" }, `\u29C9 ${label}`);
    b.type = "button";
    b.setAttribute("data-lhi-copy-path", p);
    b.setAttribute("aria-label", `Copy the ${label} path`);
    b.setAttribute("data-tip", tipText([`${label.toUpperCase()} PATH: ${p}`, ...tip.filter((l) => !/^(MAC|DO)( ROOT)?:/.test(l)), "CLICK: copies the path"]));
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const done = () => {
        b.textContent = "\u2713 copied";
        setTimeout(() => {
          b.textContent = `\u29C9 ${label}`;
        }, 1200);
      };
      try {
        navigator.clipboard.writeText(p).then(done, () => {
        });
      } catch {
      }
    });
    return b;
  }
  function notInGit(tipBase) {
    const s = h("span", { fontFamily: MONO, color: "#b45309", cursor: "help" }, "not in git");
    s.setAttribute("data-tip", tipText([...tipBase, "GIT: this file is not tracked \u2014 no GitHub link exists; it can escape auto-commit (TD-1471 class)"]));
    return s;
  }
  function linkSet(links, tipBase) {
    const out = [];
    out.push(links?.github ? chip("GitHub", links.github, tipBase) : notInGit(tipBase));
    if (links?.go) out.push(sep(), chip("Open", links.go, [...tipBase, "OPENS: in Cursor on the Mac M4 (lhi_scripts window), else GitHub at this commit"]));
    if (links?.mac) out.push(sep(), pathText("Mac", links.mac, [...tipBase, `MAC: ${links.mac}`]));
    if (links?.do) out.push(sep(), pathText("DO", links.do, [...tipBase, `DO: ${links.do}`]));
    return out;
  }
  function sessionChips(label, sess, rv, verb) {
    if (!sess?.uuid) return [];
    return [`${label} `, chip(sess.uuid, sess.lcbUrl, [`SESSION: ${sess.uuid}`, `VERSION: record v${rv}`, sess.role ? `ROLE: ${sess.role}` : "", "OPENS: this session in LCB"]), sess.lcbUrl ? ` \u2192 ${verb}` : ""];
  }
  function expandedNew(r) {
    const rv = recV(r);
    const box = h("div", { fontFamily: MONO, fontSize: "11.5px", lineHeight: "1.55", marginTop: "6px" });
    const title = h("div", { fontFamily: SANS, fontWeight: "700", fontSize: "12px", margin: "0 0 2px" }, `${COMPONENT_NAME} \u2014 who made this, from what, at which versions`);
    title.setAttribute("data-lhi-provenance-title", "");
    title.setAttribute("data-tip", tipText([`${COMPONENT_NAME.toUpperCase()}: the provenance record of this ${r.subject?.kind || "artifact"}`, `VERSION: record v${rv}`, "WRITER: scripts/lib/provenance/write.mjs (the one writer)"]));
    box.append(title);
    const S = r.sessions || {};
    const fleet = [];
    if (!S.fleet?.initiative) fleet.push(h("span", { opacity: "0.8" }, "fleet: not recorded"));
    else fleet.push(chip(S.fleet.name || S.fleet.initiative, S.fleet.seatUrl, [`FLEET: ${S.fleet.name || ""} (${S.fleet.initiative})`, `VERSION: record v${rv}`, "OPENS: the overseer seat, whoever holds it now"]), S.fleet.seatUrl ? " \u2192 seat" : "");
    if (S.overseer?.uuid) fleet.push(fleet.length ? sep() : null, ...sessionChips("overseer", S.overseer, rv, "open"));
    if (S.creator?.uuid) fleet.push(fleet.length ? sep() : null, ...sessionChips(`made by ${S.creator.role || "session"}`, S.creator, rv, "open"));
    if (fleet.length) box.append(row("FLEET", ...fleet));
    if (r.repo) {
      const R = r.repo;
      box.append(row(
        "REPO",
        `${R.name || ""} @ ${R.branch || ""} \xB7 commit `,
        chip(String(R.commit || "").slice(0, 9), R.commitUrl, [`COMMIT: ${R.commit}`, `VERSION: record v${rv}`, R.remote ? `REMOTE: ${R.remote}` : ""]),
        R.commitUrl ? " \u2192 GitHub" : "",
        R.roots?.do ? sep() : null,
        R.roots?.do ? pathText("DO", R.roots.do, [`DO ROOT: ${R.roots.do}`, `VERSION: record v${rv}`]) : null,
        R.roots?.mac ? sep() : null,
        R.roots?.mac ? pathText("Mac", R.roots.mac, [`MAC ROOT: ${R.roots.mac}`, `VERSION: record v${rv}`]) : null
      ));
    }
    const skills = h("div", null, h("div", { opacity: "0.8" }, "(what the colon means: family:skill is a display name \u2014 the folder on disk is skills/family-skill/SKILL.md)"));
    for (const s of r.skills || []) {
      const base = skillTip(s);
      const folder = s.dir ? s.dir.replace(/^scripts\/user-claude-ssot\//, "") : "";
      skills.append(h(
        "div",
        { marginTop: "4px" },
        s.role === "main" ? "\u25CF " : "\u25CB ",
        chip(s.ref, s.links?.github, base, { fontWeight: "700" }),
        `  v${s.version || "\u2014"}  family v${has(s.familyVersion) ? s.familyVersion : "\u2014"}  ${s.role === "main" ? "MAIN" : s.role || ""}`,
        h("div", { paddingLeft: "18px" }, `${s.ref} \u2192 ${folder}/SKILL.md  `, ...linkSet(s.links, base)),
        s.origin ? h("div", { paddingLeft: "18px", opacity: "0.85" }, `created ${s.origin.firstCommitAtEt || fmtEt(s.origin.firstCommitAt) || "date not recorded"}${s.origin.session ? " by " : " \xB7 "}`, s.origin.session ? chip(s.origin.session, s.origin.sessionLcbUrl, [`SESSION: ${s.origin.session}`, `VERSION: ${s.version || ""}`]) : s.origin.note || "session not recorded") : null,
        Array.isArray(s.params?.argv) ? h("div", { paddingLeft: "18px" }, "params  ", h("code", { fontFamily: MONO }, s.params.argv.join(" "))) : s.params?.note ? h("div", { paddingLeft: "18px", opacity: "0.7" }, `params  ${s.params.note}`) : null,
        ...(s.scripts || []).map((f) => h("div", { paddingLeft: "18px" }, "script  ", chip(f.name || f.path.split("/").pop(), f.links?.github, fileTip(f, rv, "SCRIPT")), `  ${blobWord(f)}${f.entry ? "  (entry)" : "  (imported)"}  `, ...f.links?.github ? [] : [notInGit(fileTip(f, rv, "SCRIPT")), sep()], ...linkSet({ github: f.links?.github, go: f.links?.go }, fileTip(f, rv, "SCRIPT")).slice(2)))
      ));
    }
    box.append(row("SKILLS", skills));
    if ((r.inputs || []).length) box.append(row("DATA", ...r.inputs.flatMap((i, n) => [n ? h("br") : null, chip(i.path, i.links?.github, fileTip(i, rv, "DATA")), "  ", ...linkSet(i.links, fileTip(i, rv, "DATA")).slice(i.links?.github ? 2 : 0)])));
    const rend = [];
    if (r.renderer?.name) rend.push(chip(`${r.renderer.name} ${r.renderer.version || ""}`.trim(), r.renderer.links?.github, [`RENDERER: ${r.renderer.name}`, `VERSION: ${r.renderer.version || ""}${has(r.renderer.blob) ? ` \xB7 blob ${short(r.renderer.blob)}` : ""}`, r.renderer.path ? `FILE: ${r.renderer.path}` : ""]));
    if (r.component?.name) rend.push(rend.length ? sep() : null, "provenance component ", chip(`${r.component.name} v${r.component.version || ""}`, null, [`COMPONENT: ${r.component.name}`, `VERSION: ${r.component.version || ""} \xB7 renderer lhi-provenance.${VERSION}`]));
    if (rend.length) box.append(row("RENDERED", ...rend));
    const hist = (r.history || []).slice().reverse();
    if (hist.length) {
      box.append(row("VERSIONS", ...hist.flatMap((x, n) => [n ? " \u2190 " : "", chip(histLabel(x), x.commitUrl, [`VERSION: ${histLabel(x)}${n === 0 ? " (now)" : ""}`, `AT: ${et(x)}`, x.change ? `CHANGE: ${x.change}` : "", x.via ? `VIA: ${x.via}` : "", x.by ? `BY: ${x.by}` : ""]), ` ${et(x)}${x.via ? " " + x.via : ""}${n === 0 ? " (now)" : ""}`])));
    }
    return box;
  }
  function render(el, record, opts = {}) {
    if (!el || !record) return null;
    const mode = opts.mode === "footer" ? "footer" : "row";
    const isNew = record.schema === SCHEMA && !record.legacy;
    const d = h("details", {
      boxSizing: "border-box",
      fontFamily: SANS,
      fontSize: "12px",
      lineHeight: "1.45",
      borderRadius: "8px",
      ...mode === "row" ? { minHeight: "28px", margin: "0 0 4px", padding: "4px 10px", border: "1px solid #e2e8f0", background: "rgba(241,245,249,0.92)", color: "#475569" } : { width: "100%", padding: "6px 10px", border: "1px solid rgba(100,116,139,0.28)", background: "rgba(148,163,184,0.08)", color: "inherit" }
    });
    d.setAttribute("data-lhi-provenance", "");
    d.setAttribute("data-lhi-provenance-version", VERSION);
    if (opts.expanded) d.open = true;
    const sum = h("summary", { cursor: "pointer", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: mode === "row" ? "#334155" : "inherit" });
    if (isNew) {
      sum.append(...summaryNew(record));
      d.append(sum);
      const body = expandedNew(record);
      if (mode === "row") Object.assign(body.style, { maxHeight: "60vh", overflow: "auto" });
      d.append(body);
    } else {
      const leg = record.summary ? record : fromLegacy({ type: "deliverable", usedSkills: (record.usedSkills || []).map((s) => typeof s === "string" ? s : s?.ref).filter(Boolean), generatedAt: record.generatedAt });
      sum.append(...parts(leg.summary), legacyChip());
      d.append(sum);
      for (const line of leg.details || []) d.append(h("div", { margin: "2px 0 0", wordBreak: "break-word" }, ...parts(line)));
    }
    el.replaceChildren(d);
    const fit = () => {
      const w = el.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 1e3);
      const narrow = w > 0 && w < 440;
      sum.style.whiteSpace = narrow ? "normal" : "nowrap";
      for (const m of sum.querySelectorAll("[data-lhi-made-by]")) m.style.display = narrow ? "none" : "";
    };
    fit();
    if (typeof ResizeObserver === "function") {
      if (el.__lhiProvRO) el.__lhiProvRO.disconnect();
      el.__lhiProvRO = new ResizeObserver(fit);
      el.__lhiProvRO.observe(el);
    }
    if (typeof window !== "undefined" && typeof window.installHoverTooltips === "function") {
      try {
        window.installHoverTooltips();
      } catch {
      }
    }
    return d;
  }

  // scripts/lib/provenance/lhi-provenance-entry.js
  window.LHIProvenance = { render, fromLegacy, VERSION };
})();

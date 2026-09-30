// Renders research.html: the research overview. The story scenes first, then
// the A-G finding cards from content/intro.md.
//
// THE BUILD MUST NEVER READ THE CLOCK. No Date.now(), no bare new Date().
// CI runs `node scripts/build.js` then `git diff --exit-code`; a clock read
// makes the output differ on every run and fails every push forever. Any date
// arithmetic the build needs derives from figures.json meta.generated or a
// literal in narrative.json, the same rule stalenessCutoff() already follows.
//
// Second rule, from README: every page is real HTML on first byte. Every
// claim, card back and sorted item below is in the served bytes and visible
// by default. JS restructures and animates; it never reveals.

import { renderMarkdown } from '../vendor/minimark.js';
import { stalenessCutoff } from '../assets/ledger-core.js';
import { buildFigureIndex, citeTokens, warnOnWeakCitations } from './citations.js';
import { renderLandingPromptCta } from './llm-prompt.js';
import { renderFindings } from './findings.js';
import { escapeHtmlText, escapeAttr, renderHeadMeta, articleLd } from './meta.js';


/** Markdown -> HTML -> citation chips. Order matters: minimark leaves [[fig:N]] alone. */
function prose(md, ctx, where) {
  return citeTokens(renderMarkdown(md), ctx.index, ctx.cutoff, where);
}

/** Inline markdown for a single line (headline, label) with no <p> wrapper. */
function inline(md, ctx, where) {
  const html = renderMarkdown(md).replace(/^<p>/, '').replace(/<\/p>\s*$/, '');
  return citeTokens(html, ctx.index, ctx.cutoff, where);
}

function sceneHeader(scene, ctx) {
  const where = `scene "${scene.id}"`;
  const num = scene.number ? `<span class="scene-num" aria-hidden="true">${escapeHtmlText(scene.number)}</span>` : '';
  const eyebrow = scene.eyebrow ? `<p class="scene-eyebrow">${num}${escapeHtmlText(scene.eyebrow)}</p>` : '';
  const headline = scene.headline ? `<h2 class="scene-headline">${inline(scene.headline, ctx, where)}</h2>` : '';
  return eyebrow + headline;
}

/** The one-line admission each scene carries. Rule 2 of "what must survive". */
function couldNotEstablish(scene, ctx) {
  if (!scene.couldNotEstablish) return '';
  return `<aside class="scene-limit">
        <span class="scene-limit-label">What this could not establish</span>
        <p>${inline(scene.couldNotEstablish, ctx, `scene "${scene.id}" limit`)}</p>
      </aside>`;
}

function deeperLink(scene) {
  if (!scene.deeper) return '';
  // The arrow glyph is UI chrome, not prose. The house style's "type ->"
  // rule targets writing; a literal -> on a designed page reads as unstyled
  // markup. aria-hidden keeps it out of the accessibility tree.
  //
  // A scene may carry one `deeper` object or an array of them; a scene that
  // sends the reader to two modules gets two links inside the one paragraph.
  const links = [].concat(scene.deeper).map(d =>
    `<a href="${escapeAttr(d.page)}">${escapeHtmlText(d.label)}<span aria-hidden="true"> →</span></a>`
  ).join('');
  return `<p class="scene-deeper">${links}</p>`;
}

// --- Scene renderers -------------------------------------------------------

function renderHero(scene, ctx) {
  const where = `scene "${scene.id}"`;
  return `<header class="hero" id="${escapeAttr(scene.id)}">
      <div class="hero-inner">
        <a class="hero-home" href="index.html"><span aria-hidden="true">← </span>ETHIndia Institutions</a>
        <p class="hero-eyebrow">${escapeHtmlText(scene.eyebrow)}</p>
        <h1 class="hero-headline">${inline(scene.headline, ctx, where)}</h1>
        <p class="hero-sub">${inline(scene.sub, ctx, where)}</p>
        <div class="hero-lede">${prose(scene.lede, ctx, where)}</div>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#${escapeAttr(ctx.narrative.scenes[1].id)}">Start reading</a>
          <a class="btn btn-ghost" href="#modules">Jump to the modules</a>
        </div>
        ${renderLandingPromptCta({ id: 'llm-top' })}
      </div>
    </header>`;
}

function renderProse(scene, ctx) {
  return `<section class="scene scene-prose" id="${escapeAttr(scene.id)}">
      <div class="scene-inner">
        ${sceneHeader(scene, ctx)}
        <div class="scene-body">${prose(scene.body, ctx, `scene "${scene.id}"`)}</div>
        ${couldNotEstablish(scene, ctx)}
        ${deeperLink(scene)}
      </div>
    </section>`;
}

/**
 * Two labelled columns, every item already in its correct column with the
 * real answer visible. JS lifts the items into a pool and runs the guess.
 * With JS off this reads as a labelled comparison, which is the actual content.
 */
function renderSplitSort(scene, ctx) {
  const where = `scene "${scene.id}"`;
  const w = scene.widget;
  const columns = w.sides.map(side => {
    const items = w.items.filter(it => it.side === side.id).map(it => `
            <li class="sort-item" data-side="${escapeAttr(side.id)}">
              <span class="sort-item-text">${escapeHtmlText(it.text)}</span>
              <span class="sort-item-status">${escapeHtmlText(it.status)}</span>
              <span class="sort-item-authority">${escapeHtmlText(it.authority)}</span>
            </li>`).join('');
    return `<div class="sort-col" data-side="${escapeAttr(side.id)}">
            <h3 class="sort-col-label">${escapeHtmlText(side.label)}</h3>
            <p class="sort-col-sub">${escapeHtmlText(side.sub)}</p>
            <ul class="sort-list">${items}
            </ul>
          </div>`;
  }).join('\n          ');

  return `<section class="scene scene-sort" id="${escapeAttr(scene.id)}">
      <div class="scene-inner">
        ${sceneHeader(scene, ctx)}
        <div class="scene-body">${prose(scene.body, ctx, where)}</div>
        <div class="sort-widget" data-widget="split-sort">
          <p class="sort-prompt">${escapeHtmlText(w.prompt)}</p>
          ${columns}
        </div>
        ${couldNotEstablish(scene, ctx)}
        ${deeperLink(scene)}
      </div>
    </section>`;
}

/**
 * The router into the seven modules. The cards come from content/intro.md so
 * the overview's findings have one source; the reference tables and the LLM
 * prompt close the page.
 */
function renderModules(scene, ctx) {
  const moduleTabs = ctx.tabs.filter(t => t.module);
  const { summaryHtml, cardsHtml } = renderFindings(ctx.introRaw, moduleTabs);
  const refs = ctx.tabs.filter(t => t.group === 'reference').map(t =>
    `<li><a href="${escapeAttr(t.page)}">${escapeHtmlText(t.label)}</a> <span>${escapeHtmlText(t.description)}</span></li>`
  ).join('\n            ');
  return `<section class="scene scene-modules" id="${escapeAttr(scene.id)}">
      <div class="scene-inner">
        ${sceneHeader(scene, ctx)}
        <div class="scene-body">${summaryHtml}</div>
        ${cardsHtml}
        <ul class="ref-list">
            ${refs}
        </ul>
        ${renderLandingPromptCta()}
      </div>
    </section>`;
}

const RENDERERS = {
  hero: renderHero,
  prose: renderProse,
  'split-sort': renderSplitSort,
  modules: renderModules,
};

// --- Page shell ------------------------------------------------------------

/**
 * The reading path as real links, so a crawler or LLM can traverse from "/".
 * The reference tables (Figure Ledger, Reconciliation) are left out: this page
 * already links the ledger from every figure chip and from the note below, and
 * the two are one click from any portal page's sidebar and listed in llms.txt.
 */
function renderFooterNav(tabs) {
  const items = tabs.filter(t => !t.isNarrative && !t.isLanding && t.group !== 'reference').map(t => {
    const letter = t.module ? `<span class="foot-letter" aria-hidden="true">${t.module}</span>` : '';
    return `        <li><a href="${escapeAttr(t.page)}">${letter}${escapeHtmlText(t.label)}</a></li>`;
  }).join('\n');
  return `<nav class="foot-nav" aria-label="The evidence base">
      <h2>The evidence base</h2>
      <ul>
${items}
      </ul>
    </nav>`;
}

function narrativeShell({ meta, bodyHtml, tabs, assets, site, page }) {
  const base = site.base;
  const url = base + page;
  const title = `${meta.title}: ${meta.tagline}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtmlText(title)}</title>
${renderHeadMeta({
  title,
  description: meta.description,
  url,
  type: 'article',
  siteBase: base,
  jsonLd: articleLd({ siteBase: base, url, headline: title, description: meta.description, dateModified: site.dateModified }),
})}
<link rel="stylesheet" href="${assets.tokens}">
<link rel="stylesheet" href="${assets.narrativeCss}">
</head>
<body class="narrative">
<a class="skip-link" href="#main-content">Skip to content</a>
<main id="main-content" tabindex="-1">
    ${bodyHtml}
  </main>
<footer class="site-foot">
    ${renderFooterNav(tabs)}
    <p class="foot-note">Prose and data CC BY 4.0. Code MIT.</p>
  </footer>
<script type="module" src="${assets.narrativeJs}"></script>
</body>
</html>
`;
}

export function renderNarrativePage({ narrative, figuresData, introRaw, tabs, assets, site, page }) {
  const ctx = {
    narrative,
    introRaw,
    tabs,
    index: buildFigureIndex(figuresData),
    cutoff: stalenessCutoff(figuresData.meta),
  };

  const parts = [];
  const warnings = [];
  for (const scene of narrative.scenes) {
    const render = RENDERERS[scene.kind];
    if (!render) {
      throw new Error(`data/narrative.json: scene "${scene.id}" has unknown kind "${scene.kind}". Known kinds: ${Object.keys(RENDERERS).join(', ')}`);
    }
    const html = render(scene, ctx);
    warnings.push(...warnOnWeakCitations(html, ctx.index, ctx.cutoff, `scene "${scene.id}"`));
    parts.push(html);
  }

  if (warnings.length) {
    console.log(`\nNarrative cites ${warnings.length} weak or stale figure(s) — deliberate, but check the framing:`);
    warnings.forEach(w => console.log(w));
    console.log('');
  }

  return narrativeShell({
    meta: narrative.meta,
    bodyHtml: parts.join('\n\n    '),
    tabs,
    assets,
    site,
    page,
  });
}

// Renders index.html: the ETHIndia Institutional landing page.
//
// Same rules as scripts/narrative.js. The build never reads the clock, so
// updates are sorted by their literal ISO dates and dates are formatted by
// hand, not through Date. Every section is real HTML on first byte and the
// page ships no JavaScript. URLs stay bare-relative.
//
// Everything the page says lives in data/landing.json. A new report, event or
// update is a new entry in its array; nothing here needs to change.

import { readFile } from 'node:fs/promises';
import { renderMarkdown } from '../vendor/minimark.js';
import { stalenessCutoff } from '../assets/ledger-core.js';
import { buildFigureIndex, citeTokens, warnOnWeakCitations } from './citations.js';
import { escapeHtmlText, escapeAttr, renderHeadMeta, websiteLd } from './meta.js';

const UPDATE_TYPES = { event: 'Event', announcement: 'Announcement', report: 'Report' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function prose(md, ctx, where) {
  return citeTokens(renderMarkdown(md), ctx.index, ctx.cutoff, where);
}

function inline(md, ctx, where) {
  const html = renderMarkdown(md).replace(/^<p>/, '').replace(/<\/p>\s*$/, '');
  return citeTokens(html, ctx.index, ctx.cutoff, where);
}

/** "2026-09-25" -> "25 September 2026", with no Date object involved. */
function formatDate(iso, where) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) throw new Error(`data/landing.json: ${where} has date "${iso}"; use YYYY-MM-DD.`);
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

function sectionHead(section, id) {
  return `<p class="l-eyebrow">${escapeHtmlText(section.eyebrow)}</p>
        <h2 class="l-headline" id="${id}-title">${escapeHtmlText(section.headline)}</h2>`;
}

// --- Sections --------------------------------------------------------------

function renderTopbar(data, logoSvg) {
  const links = [
    ['why-india', 'Why India'],
    ['ethereum', 'Ethereum'],
    ['briefing', 'Briefing'],
    data.updates.length ? ['updates', 'Updates'] : null,
  ].filter(Boolean).map(([id, label]) => `<a href="#${id}">${label}</a>`).join('\n          ');
  return `<header class="l-topbar">
      <div class="l-topbar-inner">
        <a class="l-brand" href="${escapeAttr(data.meta.ethindia_url)}" aria-label="ETHIndia">${logoSvg}</a>
        <span class="l-brand-sub">Institutions</span>
        <nav class="l-topnav" aria-label="Sections">
          ${links}
        </nav>
      </div>
    </header>`;
}

function renderHero(data, ctx) {
  const h = data.hero;
  return `<section class="l-hero" aria-labelledby="hero-title">
      <div class="l-inner">
        <p class="l-hero-eyebrow">${escapeHtmlText(h.eyebrow)}</p>
        <h1 class="l-hero-headline" id="hero-title">${escapeHtmlText(h.headline)}</h1>
        <p class="l-hero-sub">${inline(h.sub, ctx, 'hero')}</p>
      </div>
    </section>`;
}

function renderWhyIndia(section, ctx) {
  const points = section.points.map((p, i) => `<li class="l-point">
            <h3>${escapeHtmlText(p.title)}</h3>
            <p>${inline(p.body, ctx, `why_india point ${i + 1}`)}</p>
          </li>`).join('\n          ');
  return `<section class="l-section" id="why-india" aria-labelledby="why-india-title">
      <div class="l-inner">
        ${sectionHead(section, 'why-india')}
        <ul class="l-points">
          ${points}
        </ul>
      </div>
    </section>`;
}

function renderEthereum(section, ctx) {
  // The arrow is UI chrome, as in scripts/narrative.js deeperLink().
  const deeper = (section.deeper || []).map(d =>
    `<a href="${escapeAttr(d.page)}">${escapeHtmlText(d.label)}<span aria-hidden="true"> →</span></a>`
  ).join('');
  return `<section class="l-section l-section-alt" id="ethereum" aria-labelledby="ethereum-title">
      <div class="l-inner">
        ${sectionHead(section, 'ethereum')}
        <div class="l-prose">${prose(section.body, ctx, 'ethereum')}</div>
        ${deeper ? `<p class="l-deeper">${deeper}</p>` : ''}
      </div>
    </section>`;
}

function renderExpect(section, ctx) {
  const items = section.items.map((it, i) => `<li>
            <h3>${escapeHtmlText(it.title)}</h3>
            <p>${inline(it.body, ctx, `expect item ${i + 1}`)}</p>
          </li>`).join('\n          ');
  return `<section class="l-section" id="expect" aria-labelledby="expect-title">
      <div class="l-inner">
        ${sectionHead(section, 'expect')}
        <ul class="l-expect">
          ${items}
        </ul>
      </div>
    </section>`;
}

function renderResearch(reports, ctx) {
  const cards = reports.map((r, i) => {
    const links = (r.links || []).map(l => `<a href="${escapeAttr(l.href)}">${escapeHtmlText(l.label)}</a>`).join('');
    return `<article class="l-report">
            <p class="l-report-date"><time datetime="${escapeAttr(r.date)}">${formatDate(r.date, `reports[${i}]`)}</time></p>
            <h3 class="l-report-title"><a href="${escapeAttr(r.href)}">${escapeHtmlText(r.title)}</a></h3>
            <p class="l-report-sub">${escapeHtmlText(r.sub)}</p>
            <p class="l-report-summary">${inline(r.summary, ctx, `reports[${i}]`)}</p>
            <div class="l-report-actions">
              <a class="btn btn-solid" href="${escapeAttr(r.href)}">${escapeHtmlText(r.cta || 'Read the briefing')}<span aria-hidden="true"> →</span></a>
              ${links ? `<span class="l-report-links">${links}</span>` : ''}
            </div>
          </article>`;
  }).join('\n          ');
  return `<section class="l-section l-section-alt" id="briefing" aria-labelledby="briefing-title">
      <div class="l-inner">
        <p class="l-eyebrow">Briefing</p>
        <h2 class="l-headline" id="briefing-title">Start with the evidence.</h2>
        <div class="l-reports">
          ${cards}
        </div>
      </div>
    </section>`;
}

function renderUpdates(updates, ctx) {
  if (!updates.length) return '';
  // ISO dates sort as strings; newest first. slice() so the source array is untouched.
  const sorted = updates.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const items = sorted.map((u, i) => {
    const typeLabel = UPDATE_TYPES[u.type];
    if (!typeLabel) {
      throw new Error(`data/landing.json: update "${u.title}" has unknown type "${u.type}". Known types: ${Object.keys(UPDATE_TYPES).join(', ')}`);
    }
    const title = u.href
      ? `<a href="${escapeAttr(u.href)}">${escapeHtmlText(u.title)}</a>`
      : escapeHtmlText(u.title);
    return `<li class="l-update">
            <p class="l-update-meta"><span class="l-update-type l-type-${escapeAttr(u.type)}">${typeLabel}</span><time datetime="${escapeAttr(u.date)}">${formatDate(u.date, `updates[${i}]`)}</time></p>
            <h3 class="l-update-title">${title}</h3>
            ${u.summary ? `<p class="l-update-summary">${inline(u.summary, ctx, `update "${u.title}"`)}</p>` : ''}
          </li>`;
  }).join('\n          ');
  return `<section class="l-section" id="updates" aria-labelledby="updates-title">
      <div class="l-inner">
        <p class="l-eyebrow">Updates</p>
        <h2 class="l-headline" id="updates-title">Events, announcements and reports.</h2>
        <ol class="l-updates">
          ${items}
        </ol>
      </div>
    </section>`;
}

function renderFooter(data, tabs) {
  const items = tabs.filter(t => !t.isLanding && t.group !== 'reference' && t.page).map(t => {
    const letter = t.module ? `<span class="foot-letter" aria-hidden="true">${t.module}</span>` : '';
    return `          <li><a href="${escapeAttr(t.page)}">${letter}${escapeHtmlText(t.label)}</a></li>`;
  }).join('\n');
  return `<footer class="l-foot">
      <div class="l-inner">
        <nav class="l-foot-nav" aria-label="The briefing">
          <h2>Tokenised settlement in India</h2>
          <ul>
${items}
          </ul>
        </nav>
        <p class="l-foot-note">An <a href="${escapeAttr(data.meta.ethindia_url)}">ETHIndia</a> initiative. Prose and data CC BY 4.0. Code MIT.</p>
      </div>
    </footer>`;
}

// --- Page ------------------------------------------------------------------

/** The logo ships as a file; inlining it lets its fills follow currentColor in both themes. */
async function loadLogo(logoPath) {
  const svg = await readFile(logoPath, 'utf8');
  return svg.trim()
    .replace(/^<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, '<svg$1')
    .replace(/^<svg/, '<svg class="l-logo" aria-hidden="true" focusable="false"');
}

export async function renderLandingPage({ landing, figuresData, tabs, assets, logoPath }) {
  const ctx = {
    index: buildFigureIndex(figuresData),
    cutoff: stalenessCutoff(figuresData.meta),
  };
  const meta = landing.meta;
  const logoSvg = await loadLogo(logoPath);

  const body = [
    renderHero(landing, ctx),
    renderWhyIndia(landing.why_india, ctx),
    renderEthereum(landing.ethereum, ctx),
    renderExpect(landing.expect, ctx),
    renderResearch(landing.reports, ctx),
    renderUpdates(landing.updates, ctx),
  ].filter(Boolean).join('\n\n    ');

  const warnings = warnOnWeakCitations(body, ctx.index, ctx.cutoff, 'landing page');
  if (warnings.length) {
    console.log(`\nLanding page cites ${warnings.length} weak or stale figure(s):`);
    warnings.forEach(w => console.log(w));
    console.log('');
  }

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
  url: meta.site_base,
  type: 'website',
  siteBase: meta.site_base,
  siteName: meta.title,
  jsonLd: websiteLd({ siteBase: meta.site_base, name: meta.title, title, description: meta.description }),
})}
<link rel="stylesheet" href="${assets.tokens}">
<link rel="stylesheet" href="${assets.landingCss}">
</head>
<body class="landing">
<a class="skip-link" href="#main-content">Skip to content</a>
${renderTopbar(landing, logoSvg)}
<main id="main-content" tabindex="-1">
    ${body}
  </main>
${renderFooter(landing, tabs)}
</body>
</html>
`;
}

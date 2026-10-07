#!/usr/bin/env node
// Generates the static HTML pages from content/*.md and data/figures.json.
//
// Run `node scripts/build.js` (or `npm run build`) after editing a .md file,
// figures.json, or this script, then reload the page. There is still no
// framework and no bundler — this is the one deliberate build step, traded
// for pages that are real HTML on first byte: readable by a plain HTTP GET
// (an LLM fetching the URL, a crawler, curl) with no JavaScript required.
// See README.md.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { renderMarkdown } from '../vendor/minimark.js';
import { isStale, worstTierNum, stalenessCutoff } from '../assets/ledger-core.js';
import { renderNarrativePage } from './narrative.js';
import { renderLandingPage } from './landing.js';
import { SITE_NAME, escapeHtmlText, escapeAttr, renderHeadMeta, articleLd, datasetLd } from './meta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Appends a short content hash to an asset URL: assets/x.css?v=a1b2c3d4.
 *
 * Without it, a browser that has cached a stylesheet keeps using it after the
 * file changes, which shows up as a page that is subtly wrong for returning
 * visitors and for anyone reloading a local server. The hash is derived from
 * the file's bytes, so it changes only when the file does and the build stays
 * deterministic. Never use a timestamp here: a rebuild with no source change
 * must leave the committed HTML untouched, and a changing query string would
 * rewrite every page on every build.
 */
async function versionedAsset(relPath) {
  const bytes = await readFile(path.join(ROOT, relPath));
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  return `${relPath}?v=${hash}`;
}

// `group` drives the sidebar headings. Entries must stay in reading order:
// renderSidebar() emits a heading wherever the group changes, so interleaving
// two runs of the same group would print its heading twice.
const TABS = [
  { id: 'home', label: 'ETHIndia Institutions', file: 'data/landing.json', page: 'index.html', isLanding: true },
  { id: 'narrative', label: 'Briefing overview', file: 'data/narrative.json', page: 'briefing.html', isNarrative: true },
  { id: 'what-shipped', label: 'What shipped', module: 'A', group: 'modules', file: 'content/module-a.md', page: 'what-shipped.html', hasTiers: true, description: 'Which blockchain systems the largest financial institutions run in production, at what volume, on which chains, and why bank settlement went permissioned.' },
  { id: 'whats-legal-in-india', label: "What's legal in India", module: 'B', group: 'modules', file: 'content/module-b.md', page: 'whats-legal-in-india.html', hasTiers: true, description: 'What RBI, SEBI and IFSCA permit in India today for tokenised instruments, distributed settlement and blockchain registries, and where the legal gaps remain.' },
  { id: 'where-the-value-is', label: 'Where the value is', module: 'C', group: 'modules', file: 'content/module-c.md', page: 'where-the-value-is.html', hasTiers: true, description: 'Which processes in Indian financial institutions are costly or slow enough for tokenised settlement to help, sized in rupees, with the budget owner for each.' },
  { id: 'ethereum-vs-alternatives', label: 'Ethereum vs alternatives', module: 'D', group: 'modules', file: 'content/module-d.md', page: 'ethereum-vs-alternatives.html', hasTiers: true, description: 'Public Ethereum against Canton and permissioned EVM chains on the criteria institutions use to pick infrastructure, and where Ethereum is the wrong choice.' },
  { id: 'the-privacy-question', label: 'The privacy question', module: 'E', group: 'modules', file: 'content/module-e.md', page: 'the-privacy-question.html', hasTiers: true, description: 'Institutions rejected public Ethereum on confidentiality. What has changed in protocol, wallets, layer-2s and standards since, and whether it changes that call.' },
  { id: 'the-objections', label: 'The objections', module: 'F', group: 'modules', file: 'content/module-f.md', page: 'the-objections.html', hasTiers: true, description: 'The strongest objections Indian institutions and regulators raise to tokenised settlement on Ethereum, each in its strongest form, with the evidence in reply.' },
  { id: 'how-adoption-happens', label: 'How adoption happens', module: 'G', group: 'modules', file: 'content/module-g.md', page: 'how-adoption-happens.html', hasTiers: true, description: 'How new financial infrastructure such as demat and UPI reached institutional adoption in India, and what that sequence implies for a tokenised settlement layer.' },
  { id: 'ledger', label: 'Figure Ledger', group: 'reference', page: 'ledger.html', isLedger: true, description: 'Every quantitative claim in the briefing with its figure, unit, as-of date, source and tier (T1 to T5). Rows are deep-linkable; the full set is JSON.' },
  { id: 'reconciliation', label: 'Reconciliation', group: 'reference', file: 'content/reconciliation.md', page: 'reconciliation.html', hasTiers: false, description: 'A cross-module audit of the briefing: where the modules contradict each other, which figures rest on weak sources, and which claims were retired.' },
];

const GROUP_LABELS = { modules: 'Modules', reference: 'Reference' };

const TIER_ORDER = ['30s', '5min', 'full'];
const TIER_LABELS = { '30s': '30 seconds', '5min': '5 minutes', full: 'Full report' };
const TIER_MARKERS = {
  '30s': '<!-- TIER:30s -->',
  '5min': '<!-- TIER:5min -->',
  full: '<!-- TIER:full -->',
};

const PROVENANCE_HEADER = (label, file) =>
  `[Source: ${label} — ${file} — Ethereum/India institutional briefing]\n` +
  `[Every figure carries a source tier (T1 primary … T5 crypto media) and an "as of" date. Treat T4/T5 figures as unverified for volumes/adoption. This subject moves monthly; re-check anything dated more than six months ago.]\n\n`;

/**
 * Split raw markdown into { header, tiers: { '30s'?, '5min'?, full? } } by
 * locating the literal delimiter comment strings, on the RAW text before
 * any markdown parsing (so the HTML comments never reach the renderer).
 */
function splitIntoTiers(raw) {
  const positions = [];
  for (const key of TIER_ORDER) {
    const idx = raw.indexOf(TIER_MARKERS[key]);
    if (idx !== -1) positions.push({ key, idx, len: TIER_MARKERS[key].length });
  }
  positions.sort((a, b) => a.idx - b.idx);

  if (positions.length === 0) return { header: '', tiers: {} };

  const header = raw.slice(0, positions[0].idx);
  const tiers = {};
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].idx + positions[i].len;
    const end = i + 1 < positions.length ? positions[i + 1].idx : raw.length;
    tiers[positions[i].key] = raw.slice(start, end).trim();
  }
  return { header, tiers };
}

function styleQuestionCallout(headerHtml) {
  return headerHtml.replace(
    /<p><strong>Question:<\/strong>/,
    '<p class="question-callout"><strong>Question:</strong>'
  );
}

/** Split full-tier raw markdown into ### sections for per-finding copy. */
function extractSections(fullRaw) {
  const lines = fullRaw.split('\n');
  const boundaries = [];
  lines.forEach((line, idx) => {
    if (/^###\s+/.test(line)) boundaries.push(idx);
  });
  if (boundaries.length === 0) return [];
  const sections = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i];
    const end = i + 1 < boundaries.length ? boundaries[i + 1] : lines.length;
    sections.push(lines.slice(start, end).join('\n').trim());
  }
  return sections;
}

/**
 * Stamp each rendered <h3> (in order) with the raw markdown of its section,
 * escaped into a data attribute. app.js reads this to power one-click
 * per-section copy; without JS the attribute is simply inert.
 */
function attachSectionAttrs(html, sections, tab) {
  if (sections.length === 0) return html;
  let i = 0;
  return html.replace(/<h3>/g, () => {
    const section = sections[i];
    i++;
    if (section === undefined) return '<h3>';
    const payload = PROVENANCE_HEADER(tab.label, tab.file) + section;
    return `<h3 data-copy-section="${escapeAttr(payload)}">`;
  });
}

function renderCopyDetails(tab, fullRaw) {
  const payload = PROVENANCE_HEADER(tab.label, tab.file) + fullRaw;
  return `<details class="copy-details js-copy-widget" data-copy-label="this module's full report">
        <summary>Full report — copy for an LLM</summary>
        <textarea class="copy-textarea" readonly rows="6" aria-label="Full report markdown, with source provenance, for pasting into an LLM">${escapeHtmlText(payload)}</textarea>
      </details>`;
}

function renderModuleBody(tab, raw) {
  const { header, tiers } = splitIntoTiers(raw);
  const availableTiers = TIER_ORDER.filter(k => tiers[k] !== undefined);
  const headerHtml = `<div class="tab-header">${styleQuestionCallout(renderMarkdown(header))}</div>`;

  if (availableTiers.length === 0) {
    // No tier markers at all: render the whole document, no switcher.
    return `${headerHtml}\n<div class="tab-body">${renderMarkdown(raw)}</div>`;
  }

  const copyDetailsHtml = (tab.hasTiers && tiers.full !== undefined)
    ? renderCopyDetails(tab, tiers.full)
    : '';

  if (availableTiers.length === 1) {
    // Only one tier present: no switcher to offer, so just render it.
    const only = availableTiers[0];
    let bodyHtml = renderMarkdown(tiers[only]);
    if (only === 'full') bodyHtml = attachSectionAttrs(bodyHtml, extractSections(tiers.full), tab);
    const controls = copyDetailsHtml ? `<div class="tab-controls">${copyDetailsHtml}</div>\n` : '';
    return `${headerHtml}\n${controls}<div class="tab-body tier-panel">${bodyHtml}</div>`;
  }

  const radiosHtml = availableTiers
    .map((k, i) => `<input type="radio" name="tier" id="tier-${k}" class="tier-radio"${i === 0 ? ' checked' : ''}>`)
    .join('\n      ');
  const labelsHtml = availableTiers
    .map(k => `<label for="tier-${k}" class="tier-btn">${TIER_LABELS[k]}</label>`)
    .join('\n        ');
  const panelsHtml = availableTiers
    .map(k => {
      let bodyHtml = renderMarkdown(tiers[k]);
      if (k === 'full') bodyHtml = attachSectionAttrs(bodyHtml, extractSections(tiers.full), tab);
      return `<div class="tier-panel" data-tier="${k}">${bodyHtml}</div>`;
    })
    .join('\n    ');

  return `${headerHtml}
<div class="tier-block">
      ${radiosHtml}
      <div class="tab-controls">
        <div class="tier-switcher" role="tablist" aria-label="Reading depth">
        ${labelsHtml}
        </div>
        ${copyDetailsHtml}
      </div>
      <div class="tab-body">
    ${panelsHtml}
      </div>
    </div>`;
}

function renderLedgerLegend(meta) {
  const tierRows = Object.entries(meta.tier_legend)
    .map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtmlText(v)}</dd>`)
    .join('\n');
  const flagRows = Object.entries(meta.flag_legend)
    .map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtmlText(v)}</dd>`)
    .join('\n');
  return `<details class="ledger-legend">
    <summary>Legend: source tiers and flags</summary>
    <div class="legend-grid">
      <div><h2>Source tiers</h2><dl>${tierRows}</dl></div>
      <div><h2>Flags</h2><dl>${flagRows}</dl></div>
    </div>
  </details>`;
}

const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

/**
 * "10 Sep 2026" and "2026" get a machine-readable <time>, so a retrieved row
 * carries its date in a form a parser does not have to guess at. Ranges and
 * annotated values ("2024-25", "2026 (cut)") stay plain text.
 */
function renderAsOf(asOf) {
  const text = escapeHtmlText(asOf);
  const dmy = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(asOf);
  if (dmy && MONTHS[dmy[2]]) return `<time datetime="${dmy[3]}-${MONTHS[dmy[2]]}-${dmy[1].padStart(2, '0')}">${text}</time>`;
  if (/^\d{4}$/.test(asOf)) return `<time datetime="${asOf}">${text}</time>`;
  return text;
}

function renderLedgerRow(row, stalenessCutoff) {
  const stale = isStale(row, stalenessCutoff);
  const worst = worstTierNum(row.tier);
  const tierClass = worst <= 2 ? 'tier-safe' : worst === 3 ? 'tier-neutral' : 'tier-warn';
  const flagChips = [
    stale ? '<span class="chip flag-stale">STALE</span>' : '',
    ...row.flags
      .filter(f => f !== 'STALE')
      .map(f => {
        const cls = f === 'UNVERIFIED' ? 'flag-chip flag-unverified' : (f === 'WEAK_TIER' || f === 'DERIVED') ? 'flag-chip flag-warn' : 'flag-chip';
        return `<span class="chip ${cls}">${f}</span>`;
      }),
  ].join('');
  const trClasses = ['', stale ? 'row-stale' : '', row.flags.includes('UNVERIFIED') ? 'row-unverified' : ''].filter(Boolean).join(' ');
  return `<tr id="fig-${row.id}" class="${trClasses}">
      <td>${row.id}</td>
      <td>${row.module}</td>
      <td class="col-claim">${escapeHtmlText(row.claim)}</td>
      <td>${escapeHtmlText(row.figure)}</td>
      <td>${escapeHtmlText(row.unit)}</td>
      <td>${renderAsOf(row.as_of)}</td>
      <td class="col-source">${escapeHtmlText(row.source)}</td>
      <td><span class="chip tier-chip ${tierClass}">${row.tier}</span></td>
      <td class="col-flags">${flagChips}</td>
    </tr>`;
}

function renderLedgerBody(data) {
  const meta = data.meta;
  const rows = data.figures;
  const cutoff = stalenessCutoff(meta);
  const rowsHtml = rows.map(row => renderLedgerRow(row, cutoff)).join('\n    ');

  // Everything lives inside #ledger-root so the JS enhancement in app.js can
  // do a clean `root.innerHTML = ''` and rebuild the interactive version in
  // its place. If that JS never runs (or its fetch of figures.json fails,
  // e.g. under file://), this static table is the whole ledger — every row,
  // every column, staleness and tier already computed.
  return `<div id="ledger-root">
    <div class="tab-header">
      <h1>Figure Ledger</h1>
      <p class="ledger-intro">Every quantitative claim in this briefing, with its source tier and "as of" date.</p>
      <p class="ledger-data-link"><a href="data/figures.json">Download the ledger as JSON</a> (data/figures.json)</p>
    </div>
    ${renderLedgerLegend(meta)}
    <p class="ledger-count">Showing ${rows.length} of ${rows.length}</p>
    <div class="table-scroll ledger-table-scroll">
      <table class="ledger-table">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Module</th>
            <th scope="col">Claim</th>
            <th scope="col">Figure</th>
            <th scope="col">Unit</th>
            <th scope="col">As of</th>
            <th scope="col">Source</th>
            <th scope="col">Tier</th>
            <th scope="col">Flags</th>
          </tr>
        </thead>
        <tbody>
    ${rowsHtml}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderNavItem(tab, activeId) {
  const active = tab.id === activeId;
  const classes = ['nav-item', tab.isLanding ? 'nav-return' : '', active ? 'active' : ''].filter(Boolean).join(' ');
  const currentAttr = active ? ' aria-current="page"' : '';
  const ariaLabel = tab.module ? ` aria-label="Module ${tab.module}, ${tab.label}"` : '';
  // The arrow is chrome, like the → in scripts/narrative.js deeperLink().
  const inner = tab.isLanding
    ? `<span class="nav-arrow" aria-hidden="true">←</span>${tab.label}`
    : tab.module
      ? `<span class="nav-letter" aria-hidden="true">${tab.module}</span> ${tab.label}`
      : tab.label;
  return `<a href="${tab.page}" class="${classes}"${currentAttr}${ariaLabel}>${inner}</a>`;
}

/**
 * Twelve flat links told a reader nothing about which of them were the front
 * door, the seven modules and the two reference tables. Consecutive tabs
 * sharing a `group` are wrapped in a labelled role="group", so the grouping
 * reaches a screen reader rather than being a visual heading only. Ungrouped
 * tabs (the landing page and the research overview) render as bare links.
 */
function renderSidebar(activeId) {
  const parts = [];
  let i = 0;
  while (i < TABS.length) {
    const group = TABS[i].group;
    if (!group) {
      parts.push(`      ${renderNavItem(TABS[i], activeId)}`);
      i++;
      continue;
    }
    const run = [];
    while (i < TABS.length && TABS[i].group === group) run.push(TABS[i++]);
    const headingId = `nav-group-${group}`;
    const links = run.map(tab => `        ${renderNavItem(tab, activeId)}`).join('\n');
    parts.push(`      <div class="nav-group" role="group" aria-labelledby="${headingId}">
        <p class="nav-group-label" id="${headingId}">${escapeHtmlText(GROUP_LABELS[group])}</p>
${links}
      </div>`);
  }
  return `<div class="sidebar-nav">\n${parts.join('\n')}\n    </div>`;
}

/** `# Module A — What Actually Shipped` -> the Article headline. */
function markdownTitle(raw) {
  const m = /^# (.+)$/m.exec(raw);
  return m ? m[1].trim() : null;
}

function pageHeadMeta({ tab, raw, site }) {
  const url = site.base + tab.page;
  const title = `${tab.label} — ${SITE_NAME}`;
  const common = { url, description: tab.description, siteBase: site.base, dateModified: site.dateModified };
  const jsonLd = tab.isLedger
    ? datasetLd({ ...common, name: `${SITE_NAME}: Figure Ledger` })
    : articleLd({ ...common, headline: markdownTitle(raw) ?? tab.label });
  const extraLinks = tab.isLedger
    ? ['<link rel="alternate" type="application/json" href="data/figures.json" title="Figure Ledger data">']
    : [];
  return renderHeadMeta({ title, description: tab.description, url, type: 'article', siteBase: site.base, jsonLd, extraLinks });
}

function pageShell({ tab, raw, bodyHtml, assets, site }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tab.label} — ${SITE_NAME}</title>
${pageHeadMeta({ tab, raw, site })}
<link rel="stylesheet" href="${assets.tokens}">
<link rel="stylesheet" href="${assets.styles}">
</head>
<body>
<input type="checkbox" id="nav-toggle-checkbox" class="nav-toggle-checkbox" aria-hidden="true">
<a class="skip-link" href="#main-content">Skip to content</a>

<header class="site-header">
  <label for="nav-toggle-checkbox" class="nav-toggle" aria-label="Toggle navigation">
    <span class="hamburger" aria-hidden="true"></span>
  </label>
  <div class="site-title">
    <span class="portal-name">${SITE_NAME}</span>
    <span class="current-tab">${tab.label}</span>
  </div>
</header>

<div class="layout">
  <nav class="sidebar" aria-label="Portal sections">
    ${renderSidebar(tab.id)}
  </nav>
  <label for="nav-toggle-checkbox" class="nav-scrim" aria-hidden="true"></label>
  <main id="main-content" class="main-content" tabindex="-1">
    ${bodyHtml}
  </main>
</div>

<script type="module" src="${assets.app}"></script>
</body>
</html>
`;
}

/**
 * Pages that used to exist, kept alive for links already shared. GitHub Pages
 * has no server-side redirects, so each is a meta refresh with a canonical
 * pointing at the new page. Not listed in the sitemap or llms.txt.
 */
const REDIRECTS = [
  { from: 'evidence.html', to: 'briefing.html' },
  { from: 'tokenised-settlement.html', to: 'briefing.html' },
  { from: 'research.html', to: 'briefing.html' },
];

async function writeRedirects(siteBase) {
  for (const r of REDIRECTS) {
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${escapeAttr(siteBase + r.to)}">
<meta http-equiv="refresh" content="0; url=${escapeAttr(r.to)}">
</head>
<body>
<p>This page has moved to <a href="${escapeAttr(r.to)}">${escapeHtmlText(r.to)}</a>.</p>
</body>
</html>
`;
    await writeFile(path.join(ROOT, r.from), html, 'utf8');
  }
}

async function writeLlmsTxt() {
  const lines = [
    `# ${SITE_NAME}`,
    '',
    '> A seven-module briefing, drawn from published sources, on Ethereum and distributed-settlement infrastructure for Indian institutional finance. Every claim carries a source and date; every quantitative figure carries a source tier (T1 primary … T5 crypto media/aggregator) in the Figure Ledger.',
    '',
    '## Pages',
    ...TABS.map(t => `- [${t.label}](${t.page})`),
    '',
    '## Data',
    '- [Figure Ledger data (JSON)](data/figures.json) — every quantitative claim with its claim, figure, unit, source, date, tier and flags.',
    '- Each Figure Ledger row is anchored as ledger.html#fig-<ID>. Cite that anchor, with the row\'s tier and as-of date, when quoting a figure.',
  ];
  await writeFile(path.join(ROOT, 'llms.txt'), lines.join('\n') + '\n', 'utf8');
}

/**
 * No <lastmod>: the only honest source is git history, and a shallow clone
 * would date every page to the latest commit, so the file would differ
 * between checkouts.
 */
async function writeSitemap(siteBase) {
  const urls = TABS.map(t => `  <url><loc>${escapeHtmlText(siteBase + (t.page === 'index.html' ? '' : t.page))}</loc></url>`);
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, '</urlset>'];
  await writeFile(path.join(ROOT, 'sitemap.xml'), xml.join('\n') + '\n', 'utf8');
}

async function writeRobots(siteBase) {
  const lines = ['User-agent: *', 'Allow: /', '', `Sitemap: ${siteBase}sitemap.xml`];
  await writeFile(path.join(ROOT, 'robots.txt'), lines.join('\n') + '\n', 'utf8');
}

/** A new page without a description would ship with a bare link preview. */
function checkDescriptions() {
  for (const tab of TABS) {
    if (tab.isNarrative || tab.isLanding) continue; // described in their JSON meta
    if (!tab.description) throw new Error(`TABS: "${tab.id}" has no description.`);
    if (tab.description.length > 160) throw new Error(`TABS: "${tab.id}" description is ${tab.description.length} chars; keep it to 160 so search results do not truncate it.`);
  }
}

async function main() {
  checkDescriptions();
  // Parsed once: both the ledger table and the narrative's citation chips
  // read it, and they must agree about every row.
  const figuresData = JSON.parse(await readFile(path.join(ROOT, 'data/figures.json'), 'utf8'));
  const assets = {
    tokens: await versionedAsset('assets/tokens.css'),
    styles: await versionedAsset('assets/styles.css'),
    app: await versionedAsset('assets/app.js'),
    narrativeCss: await versionedAsset('assets/narrative.css'),
    narrativeJs: await versionedAsset('assets/narrative.js'),
    landingCss: await versionedAsset('assets/landing.css'),
  };
  const narrativeTab = TABS.find(t => t.isNarrative);
  const narrative = JSON.parse(await readFile(path.join(ROOT, narrativeTab.file), 'utf8'));
  const landingTab = TABS.find(t => t.isLanding);
  const landing = JSON.parse(await readFile(path.join(ROOT, landingTab.file), 'utf8'));
  // One base URL for every canonical, og:url, sitemap entry and JSON-LD id.
  const site = { base: landing.meta.site_base, dateModified: figuresData.meta.generated };
  const built = [];
  for (const tab of TABS) {
    let html;
    if (tab.isLanding) {
      html = await renderLandingPage({ landing, figuresData, tabs: TABS, assets, logoPath: path.join(ROOT, 'assets/ethindia-logo.svg') });
    } else if (tab.isNarrative) {
      // The narrative page brings its own shell: no sidebar and its own stylesheet.
      const introRaw = await readFile(path.join(ROOT, 'content/intro.md'), 'utf8');
      html = renderNarrativePage({ narrative, figuresData, introRaw, tabs: TABS, assets, site, page: tab.page });
    } else if (tab.isLedger) {
      html = pageShell({ tab, bodyHtml: renderLedgerBody(figuresData), assets, site });
    } else {
      const raw = await readFile(path.join(ROOT, tab.file), 'utf8');
      html = pageShell({ tab, raw, bodyHtml: renderModuleBody(tab, raw), assets, site });
    }
    await writeFile(path.join(ROOT, tab.page), html, 'utf8');
    built.push(tab.page);
  }
  await writeRedirects(site.base);
  await writeLlmsTxt();
  await writeSitemap(site.base);
  await writeRobots(site.base);
  console.log(`Built ${built.length} pages: ${built.join(', ')}`);
  console.log('Wrote llms.txt, sitemap.xml, robots.txt');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

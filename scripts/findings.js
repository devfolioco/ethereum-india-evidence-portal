// The A-G finding cards on research.html, built from content/intro.md.
//
// Each module is a `### A — What shipped` heading followed by a bullet list.
// The letter and title become a linked card head and the list becomes the
// card body. The destination comes from the module tabs, so the links cannot
// drift from the pages that exist. A heading that does not match the pattern,
// or names no module, fails the build rather than rendering a dead card.

import { renderMarkdown } from '../vendor/minimark.js';
import { escapeHtmlText, escapeAttr } from './meta.js';

/** Everything before the first `## ` heading, and everything from it on. */
function splitBeforeFirstH2(raw) {
  const normalized = raw.replace(/\r\n/g, '\n');
  const m = normalized.match(/\n(?=##\s)/);
  const splitAt = m ? m.index + 1 : normalized.length;
  return { introRaw: normalized.slice(0, splitAt), restRaw: normalized.slice(splitAt) };
}

function renderFindingCards(html, moduleTabs) {
  const byModule = new Map(moduleTabs.map(t => [t.module, t]));
  const blocks = [...html.matchAll(/<h3>([\s\S]*?)<\/h3>\s*(<ul>[\s\S]*?<\/ul>)/g)];
  if (!blocks.length) throw new Error('content/intro.md: no "### X — Title" headings with bullet lists under "## Findings by module".');

  const cards = blocks.map(([, heading, list]) => {
    const m = heading.match(/^([A-G])\s*\u2014\s*(.+)$/);
    const tab = m && byModule.get(m[1]);
    if (!tab) throw new Error(`content/intro.md: finding heading "${heading}" does not name a module as "X — Title".`);
    const [, letter, title] = m;
    return `<li class="finding">
            <a class="finding-head" href="${escapeAttr(tab.page)}" aria-label="Module ${letter}, ${escapeAttr(title)}">
              <span class="finding-letter" aria-hidden="true">${letter}</span>
              <span class="finding-title">${escapeHtmlText(title)}</span>
            </a>
            ${list.replace('<ul>', '<ul class="finding-body">')}
          </li>`;
  });

  return `<ul class="findings">\n          ${cards.join('\n          ')}\n        </ul>`;
}

/**
 * content/intro.md -> { summaryHtml, cardsHtml }. The H1 is dropped: the
 * research page's hero already carries the title. The "What this is" line is
 * the summary; the headings and lists after it become the cards.
 */
export function renderFindings(raw, moduleTabs) {
  const { introRaw, restRaw } = splitBeforeFirstH2(raw);
  const summaryHtml = renderMarkdown(introRaw.replace(/^# .*\n/, ''));
  return { summaryHtml, cardsHtml: renderFindingCards(renderMarkdown(restRaw), moduleTabs) };
}

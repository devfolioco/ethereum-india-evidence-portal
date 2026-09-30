// Progressive enhancement only. Every page is fully static HTML: navigation,
// the reading-depth tiers, and the Figure Ledger's base table all work with
// this script absent or blocked. What it adds on top:
//   - one-click clipboard copy for the "copy for an LLM" affordances
//     (the underlying <textarea readonly> already lets a reader select and
//     copy by hand with no JS at all)
//   - the interactive filter/sort/search Figure Ledger, built over the
//     static table
//   - aria-expanded bookkeeping for the mobile nav toggle (a plain CSS
//     checkbox hack drives the actual show/hide)
import { renderLedger } from './ledger.js';

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // fall through to legacy path
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

function flashCopied(el, label, ms = 1400) {
  const original = el.textContent;
  el.textContent = label;
  el.classList.add('copied');
  window.setTimeout(() => {
    el.textContent = original;
    el.classList.remove('copied');
  }, ms);
}

function enhanceModuleCopy() {
  document.querySelectorAll('.js-copy-widget').forEach(details => {
    const textarea = details.querySelector('.copy-textarea');
    if (!textarea) return;
    const label = details.dataset.copyLabel || 'this content';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = 'Copy to clipboard';
    btn.setAttribute('aria-label', `Copy to clipboard: ${label}, for an LLM`);
    btn.addEventListener('click', async () => {
      const ok = await copyToClipboard(textarea.value);
      flashCopied(btn, ok ? 'Copied' : 'Copy failed');
    });
    textarea.parentNode.insertBefore(btn, textarea);
  });
}

function enhanceSectionCopy() {
  document.querySelectorAll('h3[data-copy-section]').forEach(h => {
    const payload = h.dataset.copySection;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn copy-section-btn';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy this section for an LLM');
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await copyToClipboard(payload);
      flashCopied(btn, ok ? 'Copied' : 'Copy failed');
    });
    h.classList.add('has-section-copy');
    h.appendChild(btn);
  });
}

function enhanceNavToggle() {
  const checkbox = document.getElementById('nav-toggle-checkbox');
  const toggle = document.querySelector('.nav-toggle');
  if (!checkbox || !toggle) return;
  checkbox.addEventListener('change', () => {
    toggle.setAttribute('aria-expanded', checkbox.checked ? 'true' : 'false');
  });
  document.querySelectorAll('.nav-item').forEach(a => {
    a.addEventListener('click', () => {
      checkbox.checked = false;
    });
  });
}

async function enhanceLedger() {
  const root = document.getElementById('ledger-root');
  if (!root) return;
  try {
    const res = await fetch('data/figures.json');
    if (!res.ok) throw new Error(`Failed to load figures.json: ${res.status}`);
    const data = await res.json();
    root.innerHTML = '';
    renderLedger(root, data);
  } catch (err) {
    // Leave the static, fully-populated table in place (e.g. under file://,
    // where fetching local JSON can be blocked).
  }
}

function init() {
  enhanceModuleCopy();
  enhanceSectionCopy();
  enhanceNavToggle();
  enhanceLedger();
}

document.addEventListener('DOMContentLoaded', init);

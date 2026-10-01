// Figure Ledger: filterable, sortable, searchable table over data/figures.json.
// Staleness is computed here from dates, never read as a hardcoded list.
//
// This module renders the interactive version, invoked by app.js as a
// progressive enhancement on top of a static, fully-populated HTML table
// (see scripts/build.js) that already works with no JavaScript at all.

import { tierComponents, worstTierNum, isStale, isWeakTier, citationFor, stalenessCutoff } from './ledger-core.js';

// Module codes come from the data, not a hardcoded list, so adding or
// renumbering a module changes the filter buttons without touching this file.
const moduleCodes = rows => [...new Set(rows.map(r => r.module))].sort();
const TIERS = ['T1', 'T2', 'T3', 'T4', 'T5'];

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // fall through
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

function flash(el, text, ms = 1400) {
  const original = el.textContent;
  el.textContent = text;
  el.classList.add('copied');
  window.setTimeout(() => {
    el.textContent = original;
    el.classList.remove('copied');
  }, ms);
}

function buildLegend(meta) {
  const wrap = document.createElement('details');
  wrap.className = 'ledger-legend';
  const summary = document.createElement('summary');
  summary.textContent = 'Legend: source tiers and flags';
  wrap.appendChild(summary);

  const grid = document.createElement('div');
  grid.className = 'legend-grid';

  const tierCol = document.createElement('div');
  tierCol.innerHTML = '<h2>Source tiers</h2>';
  const tierDl = document.createElement('dl');
  Object.entries(meta.tier_legend).forEach(([k, v]) => {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    tierDl.appendChild(dt);
    tierDl.appendChild(dd);
  });
  tierCol.appendChild(tierDl);

  const flagCol = document.createElement('div');
  flagCol.innerHTML = '<h2>Flags</h2>';
  const flagDl = document.createElement('dl');
  Object.entries(meta.flag_legend).forEach(([k, v]) => {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    flagDl.appendChild(dt);
    flagDl.appendChild(dd);
  });
  flagCol.appendChild(flagDl);

  grid.appendChild(tierCol);
  grid.appendChild(flagCol);
  wrap.appendChild(grid);
  return wrap;
}

export function renderLedger(container, data) {
  const meta = data.meta;
  const cutoff = stalenessCutoff(meta);
  const rows = data.figures;
  const totalCount = rows.length;

  const state = {
    module: 'all',
    tier: 'all',
    weakTier: false,
    stale: false,
    conflict: false,
    search: '',
    sortKey: 'id',
    sortDir: 'asc',
  };

  const root = document.createElement('div');
  root.className = 'ledger';

  const heading = document.createElement('div');
  heading.className = 'tab-header';
  heading.innerHTML = `<h1>Figure Ledger</h1><p class="ledger-intro">Every quantitative claim in this briefing, with its source tier and "as of" date — filterable, searchable, and one click from a properly-attributed citation.</p><p class="ledger-data-link"><a href="data/figures.json">Download the ledger as JSON</a> (data/figures.json)</p>`;
  root.appendChild(heading);

  root.appendChild(buildLegend(meta));

  const controls = document.createElement('div');
  controls.className = 'ledger-controls';
  root.appendChild(controls);

  // Module filter
  const moduleRow = document.createElement('div');
  moduleRow.className = 'filter-row';
  moduleRow.innerHTML = '<span class="filter-label">Module</span>';
  const moduleButtons = document.createElement('div');
  moduleButtons.className = 'toggle-group';
  ['all', ...moduleCodes(rows)].forEach(m => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = m === 'all' ? 'All' : m;
    btn.className = 'toggle-btn';
    btn.dataset.value = m;
    btn.setAttribute('aria-pressed', m === 'all' ? 'true' : 'false');
    btn.addEventListener('click', () => {
      state.module = m;
      moduleButtons.querySelectorAll('.toggle-btn').forEach(b => {
        const active = b.dataset.value === m;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      applyAndRender();
    });
    if (m === 'all') btn.classList.add('active');
    moduleButtons.appendChild(btn);
  });
  moduleRow.appendChild(moduleButtons);
  controls.appendChild(moduleRow);

  // Tier filter
  const tierRow = document.createElement('div');
  tierRow.className = 'filter-row';
  tierRow.innerHTML = '<span class="filter-label">Tier</span>';
  const tierButtons = document.createElement('div');
  tierButtons.className = 'toggle-group';
  ['all', ...TIERS].forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t === 'all' ? 'All' : t;
    btn.className = 'toggle-btn';
    btn.dataset.value = t;
    btn.setAttribute('aria-pressed', t === 'all' ? 'true' : 'false');
    btn.addEventListener('click', () => {
      state.tier = t;
      tierButtons.querySelectorAll('.toggle-btn').forEach(b => {
        const active = b.dataset.value === t;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      applyAndRender();
    });
    if (t === 'all') btn.classList.add('active');
    tierButtons.appendChild(btn);
  });
  tierRow.appendChild(tierButtons);
  controls.appendChild(tierRow);

  // Flag toggles + search
  const flagRow = document.createElement('div');
  flagRow.className = 'filter-row flag-row';

  function makeCheckToggle(labelText, key) {
    const label = document.createElement('label');
    label.className = 'flag-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => {
      state[key] = input.checked;
      applyAndRender();
    });
    label.appendChild(input);
    label.appendChild(document.createTextNode(' ' + labelText));
    flagRow.appendChild(label);
    return input;
  }

  makeCheckToggle('Weak-tier only (T4/T5)', 'weakTier');
  makeCheckToggle('Stale only', 'stale');
  makeCheckToggle('Conflicts only', 'conflict');

  controls.appendChild(flagRow);

  const searchRow = document.createElement('div');
  searchRow.className = 'filter-row search-row';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search claim or source…';
  searchInput.setAttribute('aria-label', 'Search claim or source');
  searchInput.className = 'ledger-search';
  searchInput.addEventListener('input', () => {
    state.search = searchInput.value.trim().toLowerCase();
    applyAndRender();
  });
  searchRow.appendChild(searchInput);
  controls.appendChild(searchRow);

  const countEl = document.createElement('div');
  countEl.className = 'ledger-count';
  root.appendChild(countEl);

  const tableScroll = document.createElement('div');
  tableScroll.className = 'table-scroll ledger-table-scroll';
  root.appendChild(tableScroll);

  const columns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'module', label: 'Module', sortable: true },
    { key: 'claim', label: 'Claim', sortable: false },
    { key: 'figure', label: 'Figure', sortable: false },
    { key: 'unit', label: 'Unit', sortable: false },
    { key: 'as_of', label: 'As of', sortable: true, sortKey: 'as_of_sort' },
    { key: 'source', label: 'Source', sortable: false },
    { key: 'tier', label: 'Tier', sortable: true },
    { key: 'flags', label: 'Flags', sortable: false },
    { key: 'copy', label: '', sortable: false },
  ];

  function sortIndicator(key) {
    if (state.sortKey !== key) return '';
    return state.sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  function buildTable(filtered) {
    tableScroll.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'ledger-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    columns.forEach(col => {
      const th = document.createElement('th');
      th.scope = 'col';
      if (col.sortable) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sort-btn';
        btn.textContent = col.label + sortIndicator(col.sortKey || col.key);
        btn.addEventListener('click', () => {
          const sortKey = col.sortKey || col.key;
          if (state.sortKey === sortKey) {
            state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortKey = sortKey;
            state.sortDir = 'asc';
          }
          applyAndRender();
        });
        th.appendChild(btn);
      } else {
        th.textContent = col.label;
      }
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    filtered.forEach(row => {
      const tr = document.createElement('tr');
      tr.id = 'fig-' + row.id;
      const stale = isStale(row, cutoff);
      if (stale) tr.classList.add('row-stale');
      if (row.flags.includes('UNVERIFIED')) tr.classList.add('row-unverified');

      const tdId = document.createElement('td');
      tdId.textContent = row.id;
      tr.appendChild(tdId);

      const tdModule = document.createElement('td');
      tdModule.textContent = row.module;
      tr.appendChild(tdModule);

      const tdClaim = document.createElement('td');
      tdClaim.className = 'col-claim';
      tdClaim.textContent = row.claim;
      tr.appendChild(tdClaim);

      const tdFigure = document.createElement('td');
      tdFigure.textContent = row.figure;
      tr.appendChild(tdFigure);

      const tdUnit = document.createElement('td');
      tdUnit.textContent = row.unit;
      tr.appendChild(tdUnit);

      const tdAsOf = document.createElement('td');
      tdAsOf.textContent = row.as_of;
      tr.appendChild(tdAsOf);

      const tdSource = document.createElement('td');
      tdSource.className = 'col-source';
      tdSource.textContent = row.source;
      tr.appendChild(tdSource);

      const tdTier = document.createElement('td');
      const worst = worstTierNum(row.tier);
      const tierChip = document.createElement('span');
      tierChip.className = 'chip tier-chip';
      if (worst <= 2) tierChip.classList.add('tier-safe');
      else if (worst === 3) tierChip.classList.add('tier-neutral');
      else tierChip.classList.add('tier-warn');
      tierChip.textContent = row.tier;
      tdTier.appendChild(tierChip);
      tr.appendChild(tdTier);

      const tdFlags = document.createElement('td');
      tdFlags.className = 'col-flags';
      if (stale) {
        const chip = document.createElement('span');
        chip.className = 'chip flag-stale';
        chip.textContent = 'STALE';
        tdFlags.appendChild(chip);
      }
      row.flags.forEach(flag => {
        if (flag === 'STALE') return; // avoid duplicating the computed chip
        const chip = document.createElement('span');
        chip.className = 'chip flag-chip';
        if (flag === 'UNVERIFIED') chip.classList.add('flag-unverified');
        else if (flag === 'WEAK_TIER' || flag === 'DERIVED') chip.classList.add('flag-warn');
        chip.textContent = flag;
        tdFlags.appendChild(chip);
      });
      tr.appendChild(tdFlags);

      const tdCopy = document.createElement('td');
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'copy-btn copy-row-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.setAttribute('aria-label', `Copy citation for figure ${row.id}`);
      copyBtn.addEventListener('click', async () => {
        const ok = await copyText(citationFor(row));
        flash(copyBtn, ok ? 'Copied' : 'Failed');
      });
      tdCopy.appendChild(copyBtn);
      tr.appendChild(tdCopy);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableScroll.appendChild(table);
  }

  function applyAndRender() {
    let filtered = rows.filter(row => {
      if (state.module !== 'all' && row.module !== state.module) return false;
      if (state.tier !== 'all' && !tierComponents(row.tier).includes(state.tier)) return false;
      if (state.weakTier && !isWeakTier(row)) return false;
      if (state.stale && !isStale(row, cutoff)) return false;
      if (state.conflict && !row.flags.includes('CONFLICT')) return false;
      if (state.search) {
        const haystack = (row.claim + ' ' + row.source).toLowerCase();
        if (!haystack.includes(state.search)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let av, bv;
      switch (state.sortKey) {
        case 'id':
          av = a.id; bv = b.id; break;
        case 'module':
          av = a.module; bv = b.module; break;
        case 'tier':
          av = worstTierNum(a.tier); bv = worstTierNum(b.tier); break;
        case 'as_of_sort':
          av = a.as_of_sort || ''; bv = b.as_of_sort || ''; break;
        default:
          av = a.id; bv = b.id;
      }
      if (av < bv) return state.sortDir === 'asc' ? -1 : 1;
      if (av > bv) return state.sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    countEl.textContent = `Showing ${filtered.length} of ${totalCount}`;
    buildTable(filtered);
  }

  applyAndRender();
  container.appendChild(root);
  focusHashRow();
}

/**
 * enhanceLedger() blanks #ledger-root and rebuilds, so by the time the new
 * rows exist the browser has already resolved any #fig-N against the static
 * table and discarded it. Re-find the row and scroll to it. Default filter
 * state is all/all, so a targeted row is never filtered out on arrival.
 */
function focusHashRow() {
  const id = location.hash.slice(1);
  if (!/^fig-\d+$/.test(id)) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.classList.add('row-targeted');
}

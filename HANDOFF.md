# Handoff — ETHIndia Institutional site

Start a new chat with: "Read HANDOFF.md, ETHINDIA_INSTITUTIONAL_BUILD.md and PRODUCT.md, then continue from 'Next'."

## Source documents (read these first)

- `ETHINDIA_INSTITUTIONAL_BUILD.md` — the client brief: tokens, copy, page structure, accessibility rules, phases 1–5. Copy marked `[TODO]` is unknown; never invent claims, stats or names.
- `PRODUCT.md` — audience, purpose, personality, anti-references (used by the `/impeccable` design skill). Written from the brief and not yet reviewed by the user. Its `## Register` section is obsolete for the current skill version; `/impeccable init` would refresh the file.
- This file — what's built, decisions that override the brief, and gotchas.

## Stack and commands

Astro 7 (static), plain CSS custom properties, vanilla JS. One dependency (`astro`). Windows; Node 24. Git repo on `main`, **local only: no remote**, so nothing can be pushed until one is added.

```bash
npm run dev        # http://localhost:4321 (.claude/launch.json "eii")
npm run build      # → dist/
npx astro preview --port 4331   # .claude/launch.json "eii-review"; build first
```

Astro 7 allows only one `astro dev` per project, which is why the review config uses `astro preview`.

Lighthouse (run against `preview`, not dev — dev adds toolbar noise):
```bash
CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npx -y lighthouse http://localhost:4331/ --preset=desktop --only-categories=accessibility,performance,best-practices,seo --chrome-flags="--headless=new"
```
Last result (3 Oct): accessibility, best practices and SEO **100** on `/`, `/briefing`, `/briefing/a`, `/dinner`.

## Deploy

- Vercel project `superark21s-projects/ethindia-institutional`, linked locally (`.vercel/`, gitignored). CLI is signed in.
- Live: **https://ethindia-institutional.vercel.app** (production alias). Last deploy: 7 Oct 2026, commit `a6b3ef5` (logo kit).
- Redeploy: `npx vercel deploy --prod --yes`. No Git integration, so deploys are manual from the CLI. The CLI sometimes prints only its update banner; rerun and look for the `Aliased` line.
- **`institutions.ethindia.co`** still serves the old portal. Phases 3–4 are done and `vercel.json` redirects every old `.html` URL (including `ledger.html#fig-N` anchors), so the domain can be attached to this Vercel project whenever the user says so. Not attached yet.

## Status

| Phase | State |
|---|---|
| 1 Foundation (tokens, base, layout, nav, ticker, footer, content files) | Done |
| 2 Home page | Done, then distilled (see decisions) |
| 3 Briefing: overview, modules A–G (3 reading tiers), Figure Ledger, Reconciliation, old-URL redirects | Done (3 Oct) |
| 4 `/dinner` + invite form (live only when `dinnerStatus` is "open" and `inviteFormEndpoint` is set), `/privacy` | Done; endpoints and privacy copy still TODO |
| 5 Polish: section-entry motion, OG image, `sitemap.xml`, `robots.txt`, `llms.txt`, 404 | Done; textile motifs wait on files |
| Logo kit (user-supplied) | Done (7 Oct): nav, footer, favicon, OG image |

## Colour, background and logo

- **Background:** faint column hairlines (`body::before` in base.css) on the 1280px content grid: 4 columns, 2 at ≤1080px, edges only at ≤560px. User chose this over graph paper. `body` has no background on purpose (it would cover the hairlines); `html` carries the colour.
- **Three palettes, visitor-selectable** (user decided to keep the picker). `tokens.css` holds navy + stone (default), all light and all dark, on zone tokens: page (`L-`), `.deep` (nav, hero, page heads, footer), `.band` (ticker, dinner band). Components use only semantic names: `--paper --panel --surface --ink --ink-2 --border --rule --accent --hairline`. All pairs pass WCAG AA.
- **`PaletteSwitcher`** (bottom-left pill) stores the choice in localStorage; `?palette=navy|light|dark` in the URL overrides it. An inline script in `Base.astro` applies it before first paint.
- **Logo:** `public/logo/ethindia-institutional.svg` is `Logo_Black.svg` from the user's kit (`Downloads/ETHIndiaInstitutional_logokit`). `.logo` in base.css draws it as a CSS mask filled with `currentColor`, so one file works in every palette; `--logo-h` sets the height. Falls back to `CanvasText` in forced-colors mode. `favicon.svg` is the logomark (navy, bone in dark mode). The kit's white, wordmark and PNG variants weren't needed.
- **OG image** `public/og/default.png` (1200×630, navy): rendered with headless Chrome from a one-off HTML page, not kept in the repo. To change it, rebuild that page: navy `#0e1a2b`, logo mask in bone `#ede8dd`, the H1 with pixel-font glyph swaps, column hairlines.

## Briefing content

- Ported from the old portal into `src/content/briefing`: `<letter>.md` (metadata: title, heading, question, description, legacy slug, summary bullets) and `<letter>.html` (the three reading tiers, links rewritten to new URLs). `_overview-lede.html`, `_overview.html` and `_reconciliation.html` likewise. **Edit the HTML files directly to change module text.**
- `public/data/figures.json` (the portal's ledger data) drives `/briefing/ledger`. Rows keep `id="fig-N"`; staleness is computed as in the portal (older than six months before `meta.generated`, unless HISTORICAL or CURRENT).
- Home page stats link to their ledger rows; sources came from the portal ledger.
- Module pages: reading-depth tabs (default 30 seconds, remembers the last choice, `#tier-30s|5min|full` selects one), sticky A–G nav with scroll progress (CSS scroll timeline; no progress bar in Firefox), prev/next.
- **Portal data audit (7 Oct):** every old-portal page was diffed against the build; modules A–G, Figure Ledger and Reconciliation are complete. Gaps closed: the four "Why India" points (`stats.json`), "Where Ethereum fits" (`home.json → ethereum`), "On this site" trio (now `focus.json`, replacing the brief's unconfirmed Research/Convening/Requirements/Education), portal hero sentence and update entries (`kind`, `link`), and the "copy for an LLM" tools: `CopyForLlm.astro`, module full-report text in `public/llm/module-<letter>.md` (verbatim from the portal) and the overview's personalised prompt.
- Not ported: the portal's per-section "Copy" buttons on module h3s (subsets of the full-report text).
- Naming: the portal says "ETHIndia Institutions"; the site uses "ETHIndia Institutional" (logo kit). Unconfirmed with the client.

## File map

```
src/
  layouts/Base.astro          head/meta/OG, palette init script, skip link, sticky chrome, ticker collapse, section-entry reveal
  components/
    Nav.astro                 logo, links (aria-current per page), CTA, mobile toggle, active-section highlight
    Ticker.astro              marquee (.band); duplicate run is aria-hidden + inert; pause button
    Footer.astro              logo, links (.deep)
    PageHead.astro            .deep header band for inner pages: breadcrumb, H1, lede, slot
    PaletteSwitcher.astro     the palette picker
    T.astro                   renders content strings; "[TODO: …]" → dashed placeholder
    DinnerCta.astro           switches on site.json dinnerStatus: "soon" | "open" | "closed"
    hero/Hero.astro           copy left + 2 CTAs, map right (.deep)
    hero/IndiaMap.astro       canvas: dotted India, 3D ETH mark, Mumbai ripple; reads zone colours, redraws on palettechange
    hero/india-dots.json      pre-rasterised dot grid (generated)
  pages/
    index.astro               all home sections + their styles
    briefing/index.astro      overview: lede, scenes 01–04, module index, reference, how to cite
    briefing/[module].astro   module reader
    briefing/ledger.astro     Figure Ledger table with module/tier filters
    briefing/reconciliation.astro
    dinner.astro, privacy.astro (TODO copy), 404.astro, sitemap.xml.ts
  content/
    site.json                 nav, ticker, hero copy, dinner details + dinnerStatus, emails, endpoints
    home.json                 section headings/copy for the home page
    stats.json                6 sourced figures with ledger links
    focus.json, segments.json, faq.json, team.json ([]), supporters.json (empty)
    updates/*.md              dated updates (collection)
    briefing/                 see "Briefing content"
  content.config.ts           collections: updates, briefing
  styles/tokens.css           layout tokens, the three palettes, zone classes; @font-face commented out
  styles/base.css             reset, hairlines, type scale, .btn, .label, .todo, .field, .logo, reveal motion
  styles/prose.css            long-form reading, tables, figure chips, overview scenes
scripts/india-dots.mjs        regenerates india-dots.json (see below)
public/
  logo/ethindia-institutional.svg, favicon.svg, og/default.png
  data/figures.json, llms.txt, robots.txt
vercel.json                   301s from the old portal's .html URLs
```

## Conventions

- **All copy lives in `src/content/`.** Components only read it.
- **`[TODO: …]` anywhere in content renders as a visible dashed placeholder** (via `T.astro`). A string that is only a TODO renders as a block.
- **Glyph swap:** in `site.json → hero.title`, `[x]` marks a letter set in the pixel font. The H1 gets an `aria-label` with the plain text. The optional animated swap was deliberately skipped (letters changing width would shift the layout).
- **Sections hide when their data is empty:** Team (and its nav/footer link) and Supporters.
- No text under 13px, all text 4.5:1+, 44px targets, everything respects `prefers-reduced-motion`.

## Decisions that override the brief (user-approved or deliberate)

1. **Hero graphic** — user asked for the ethereuminstitutional.org layout: copy left, 2 CTAs, animated graphic right, showing a **dotted India map with the Ethereum symbol** instead of a globe. This overrides brief §8 ("no dot-globe, no 3D, no ETH diamond").
2. **Hero CTAs:** "Read the report" → `/briefing`; "Request a dinner invite, 4 Nov →" → `/dinner` (invite-only, so not "join"). Labels editable in `site.json`.
3. **Hero H1 size** reduced to `clamp(44px, 5.6vw, 92px)` to fit two columns (brief: 104px max).
4. **Distill pass (user ran `/impeccable distill`):** hero stats strip removed; stats and Why India merged into one list of 6 sourced figures; "Why ETHIndia Institutional" and "Focus areas" merged (`id="focus"`); focus items are heading + body; no card grids anywhere; "BY INVITATION" label removed from the dinner band.
5. **Headings I added** (brief had none): "Frequently asked questions", "Supported by" (in `home.json`).
6. **Ticker collapse** uses `transform`, not height. Changing the height moved the page and triggered a scroll-anchoring feedback loop.
7. **Colour (user request, 3 Oct):** the brief's monochrome white site became the three-palette system above, with no graph paper. Overrides brief §3 "monochrome" and "no dark mode for v1".
8. **Briefing URLs** follow the brief (`/briefing/a` … `/g`), not the portal's slugs; the slugs redirect.
9. **Overview scenes:** the portal's numbered eyebrow above each headline was moved below it as a plain descriptor line, with the number dropped.

## Open decisions for the user

- **Git remote:** none exists, so "push" isn't possible. Needs a GitHub repo (and whether it's private) before pushing; Vercel Git integration could then replace manual CLI deploys.
- **Custom domain:** attach `institutions.ethindia.co` to the Vercel project (see Deploy).
- **Sticky chrome height:** the brief wants nav + ticker ≤ 96px, but `--nav-h: clamp(56px, 5vw, 80px)` + 32px ticker = 97px at 1280px and 113px at ≥1600px. Options: cap `--nav-h` at ~64px, or a 24px ticker. Unanswered.

## India map (hero)

- Boundary: **India's official boundary (includes all of J&K)** from DataMeet `india-composite.geojson`, licence CC BY 2.5 IN (credited in `india-dots.json`). Matters for an Indian institutional audience. Don't swap in Natural Earth / world-atlas, which show a different boundary.
- The 10 MB GeoJSON is **not** in the repo. To regenerate:
  ```bash
  curl -L -o india.geojson https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson
  node scripts/india-dots.mjs india.geojson src/components/hero/india-dots.json 0.36
  ```
  Step 0.36° → 2,106 dots, 12.5 KB.
- Animation pauses offscreen. Reduced motion → single static frame. The Mumbai ripple ties to the dinner city. Tunables (TILT, DEPTH, mark size/position) are constants at the top of the scene section.

## Gotchas

- **Screenshots:** the in-app browser pane's screenshots time out. Reliable route: `npm run build`, start `eii-review` (port 4331), then headless Chrome from Bash (`chrome.exe --headless=new --screenshot=… --window-size=1440,3000 --force-prefers-reduced-motion "http://localhost:4331/?palette=navy"`). The dev server on 4321 isn't reachable from the Bash shell; the preview on 4331 is.
- **Headless Chrome won't lay out narrower than ~500px**, so "mobile" screenshots at 390px look clipped. Check real overflow in the browser pane at the 375px preset instead (measure `scrollWidth` vs `innerWidth`).
- **Browser pane:** `requestAnimationFrame` and scroll events don't fire unless there's real input. Use the `computer` scroll action, not `window.scrollTo`.
- **Bash heredocs** with long Astro/TS content failed once (quote parsing). Use the Write tool for large files.
- Scoped Astro styles don't reach elements rendered by child components or `set:html` (`T`, `DinnerCta`, briefing HTML). Use `:global()` or a global stylesheet (`prose.css`).
- Pixel font isn't loaded yet, so Matrix Sans falls back to the system monospace. Glyph-swapped letters and figures look rough until the real files arrive.

## Next

1. Fill client content as it arrives (list below); each lands in `src/content/` or `public/`.
2. When the invite form endpoint exists: set `inviteFormEndpoint` and `dinnerStatus: "open"` in `site.json`. Same for `newsletterEndpoint`.
3. Fonts: drop the files in `public/fonts`, uncomment `@font-face` in tokens.css, preload two weights in Base.astro, then re-check layouts (Neue Montreal's metrics differ from the fallback).
4. Motifs: one per section max, cropped at a viewport edge (brief §3).
5. The open decisions above.

## Still needed from the client (Arko / ETHIndia)

Neue Montreal + Matrix Sans font files · textile motif files · briefing PDF, and whether "report" = this briefing · ETHIndia proof point (year/scale) · final focus-area list · segment one-liners · team names/roles/bios/photos · supporters + logos · FAQ answers · contact + careers emails · newsletter provider endpoint · invite form endpoint (Tally/Formspree) · analytics choice · privacy copy.

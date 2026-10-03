# Handoff — ETHIndia Institutional site

Start a new chat with: "Read HANDOFF.md, ETHINDIA_INSTITUTIONAL_BUILD.md and PRODUCT.md, then continue with Phase 3."

## Source documents (read these first)

- `ETHINDIA_INSTITUTIONAL_BUILD.md` — the client brief: tokens, copy, page structure, accessibility rules, phases 1–5. Copy marked `[TODO]` is unknown; never invent claims, stats or names.
- `PRODUCT.md` — audience, purpose, personality, anti-references (used by the `/impeccable` design skill). Written from the brief and not yet reviewed by the user.
- This file — what's built, decisions that override the brief, and gotchas.

## Stack and commands

Astro 7 (static), plain CSS custom properties, vanilla JS. One dependency (`astro`). Windows; Node 24. Git repo on `main` (local only, no remote yet).

```bash
npm run dev        # http://localhost:4321 (also in .claude/launch.json as "eii")
npm run build      # → dist/
npx astro preview --port 4330
```

Lighthouse (run against `preview`, not dev — dev adds toolbar noise):
```bash
CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" npx -y lighthouse http://localhost:4330/ --preset=desktop --only-categories=accessibility,performance,best-practices,seo --chrome-flags="--headless=new"
```
Last result: **100/100/100/100 desktop and mobile, CLS 0.**

## Deploy

- Vercel project `superark21s-projects/ethindia-institutional`, linked locally (`.vercel/`, gitignored). CLI is signed in.
- Live: **https://ethindia-institutional.vercel.app** (production alias).
- Redeploy: `npx vercel deploy --prod --yes`. No Git integration yet, so deploys are manual from the CLI.
- **Do not attach `institutions.ethindia.co`** until Phases 3–4 are done and the old portal URLs are redirected. That domain serves the current live portal.

## Status

| Phase | State |
|---|---|
| 1 Foundation (tokens, base, layout, nav, ticker, footer, content files) | Done |
| 2 Home page | Done, then distilled (see decisions) |
| 3 `/briefing` + `/briefing/[module]`, port content, keep old portal URLs | **Next.** Not started. Nav/briefing links currently 404. |
| 4 `/dinner` page + invite form + newsletter wiring | Not started. `/dinner` 404s. |
| 5 Polish: section-entry motion, motifs, OG image, sitemap, robots, 404, privacy page | Not started |

## File map

```
src/
  layouts/Base.astro          head/meta/canonical, skip link, sticky chrome (nav + ticker), ticker-collapse script
  components/
    Nav.astro                 logo (text placeholder), links, CTA, mobile toggle, active-section highlight
    Ticker.astro              marquee; duplicate run is aria-hidden + inert; pause button
    Footer.astro
    T.astro                   renders content strings; "[TODO: …]" → dashed placeholder
    DinnerCta.astro           switches on site.json dinnerStatus: "soon" | "open" | "closed"
    hero/Hero.astro           copy left + 2 CTAs, map right
    hero/IndiaMap.astro       canvas: dotted India, 3D ETH mark, Mumbai ripple
    hero/india-dots.json      pre-rasterised dot grid (generated)
  pages/index.astro           all home sections + their styles
  content/
    site.json                 nav, ticker, hero copy, dinner details + dinnerStatus, emails, endpoints
    home.json                 section headings/copy for the home page
    stats.json                the 6 sourced figures (Why India section)
    focus.json, segments.json, faq.json, team.json ([]), supporters.json (empty)
    updates/*.md              dated updates (collection)
    briefing/a.md … g.md      module stubs: letter, order, title (collection; bodies are TODO)
  content.config.ts           collections: updates, briefing
  styles/tokens.css           brief tokens + --border, --ticker-h; @font-face commented out
  styles/base.css             reset, graph paper, type scale, .btn, .label, .todo, .section, .wrap
scripts/india-dots.mjs        regenerates india-dots.json (see below)
public/favicon.svg            placeholder mark
```

## Conventions

- **All copy lives in `src/content/`.** Components only read it.
- **`[TODO: …]` anywhere in content renders as a visible dashed placeholder** (via `T.astro`). A string that is only a TODO renders as a block.
- **Glyph swap:** in `site.json → hero.title`, `[x]` marks a letter set in the pixel font. The H1 gets an `aria-label` with the plain text. The optional animated swap was deliberately skipped (letters changing width would shift the layout).
- **Sections hide when their data is empty:** Team (and its nav/footer link) and Supporters.
- No text under 13px, all text 4.5:1+, 44px targets, everything respects `prefers-reduced-motion`.

## Decisions that override the brief (user-approved or deliberate)

1. **Hero graphic** — user asked for the ethereuminstitutional.org layout: copy left, 2 CTAs, animated graphic right, showing a **dotted India map with the Ethereum symbol** instead of a globe. This overrides brief §8 ("no dot-globe, no 3D, no ETH diamond"). Kept monochrome and calm.
2. **Hero CTAs:** "Read the report" → `/briefing`; "Request a dinner invite, 4 Nov →" → `/dinner` (invite-only, so not "join"). Labels editable in `site.json`.
3. **Hero H1 size** reduced to `clamp(44px, 5.6vw, 92px)` to fit two columns (brief: 104px max).
4. **Distill pass (user ran `/impeccable distill`):**
   - The hero stats strip was removed. Stats and the Why India cards were merged into **one list of 6 sourced figures** in `stats.json` (figure + one sentence, no card titles).
   - "Why ETHIndia Institutional" and "Focus areas" were merged into one section (`id="focus"`). Its 3rd paragraph (it duplicated the focus areas) was dropped.
   - Focus items are now just a heading (Research / Convening / Requirements / Education) + body. Subtitles removed.
   - No card grids anywhere: focus, segments and figures are plain rows/columns with rules. `.card` CSS deleted.
   - "BY INVITATION" label removed from the dinner band.
5. **Headings I added** (brief had none): "Frequently asked questions", "Supported by" (in `home.json`).
6. **Ticker collapse** uses `transform`, not height. Changing the height moved the page and triggered a scroll-anchoring feedback loop.

## Open decision for the user

**Sticky chrome height:** the brief wants nav + ticker ≤ 96px, but its own `--nav-h: clamp(56px, 5vw, 80px)` + 32px ticker = 97px at 1280px and 113px at ≥1600px. Once you scroll down, only the nav shows (65–81px). Options: cap `--nav-h` at ~64px, or a 24px ticker. Unanswered.

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

- **Browser pane:** `requestAnimationFrame` and scroll events don't fire unless there's real input. `window.scrollTo` from JS won't trigger the scroll handlers, so use the `computer` scroll action. Screenshots often time out; fall back to JS measurements / `get_page_text`. Lighthouse in headless Chrome is the reliable check.
- **Bash heredocs** with long Astro/TS content failed once (quote parsing). Use the Write tool for large files.
- Scoped Astro styles don't reach elements rendered by child components (`T`, `DinnerCta`). Wrap them, or use `:global()` as the dinner band does.
- Pixel font isn't loaded yet, so Matrix Sans falls back to the system monospace. Glyph-swapped letters and figures look rough until the real files arrive.

## Next: Phase 3 (briefing)

1. Read the current portal at https://institutions.ethindia.co — briefing modules, their URLs/anchors, stats sources. Not fetched yet.
2. Port module content into `src/content/briefing/a.md … g.md` (bodies are TODO stubs; frontmatter has letter/order/title/summary).
3. Build `src/pages/briefing/index.astro` (title, date, summary, module index, PDF link, how to cite) and `src/pages/briefing/[module].astro`: solid paper panel, 64ch measure, sticky A–G nav with progress on desktop, prev/next, full-width tables/figures.
4. Preserve old portal URLs or add redirects (`vercel.json` redirects — the host is Vercel).
5. Fill the stat sources in `stats.json` from the portal if they're cited there.
6. Stop and report for review (the brief requires a stop after each phase).

## Still needed from the client (Arko / ETHIndia)

Logo SVG · Neue Montreal + Matrix Sans font files · textile motif files · briefing content + PDF, and whether "report" = this briefing · stat sources/dates · Why India intro line · ETHIndia proof point (year/scale) · final focus-area list · segment one-liners · team names/roles/bios/photos · supporters + logos · FAQ answers · contact + careers emails · newsletter provider endpoint · invite form endpoint (Tally/Formspree) · analytics choice · privacy copy.

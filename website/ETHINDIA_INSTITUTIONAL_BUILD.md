# ETHIndia Institutional — Website Build Brief

## 1. What we're building

A site for ETHIndia Institutional, a new think tank under ETHIndia that works out how Ethereum fits Indian institutional finance. Domain: `institutions.ethindia.co`.

Two jobs, in priority order:

1. Make the ETHIndia Institutional Report / briefing easy to find and read.
2. Position ETHIndia Institutional as the neutral, credible front door to Ethereum for Indian banks, asset managers, market infrastructure and regulators.

Audience: senior people at Indian banks, AMCs, exchanges/depositories/clearing corps, NBFCs, fintechs, regulators, plus researchers and builders. They are not crypto-native. Every design choice should read as calm, factual and trustworthy.

### Reference sites

- Structure / flow: https://www.ethereuminstitutional.org — follow its section order (Section 4 below), but avoid its mistakes (Section 8).
- Visual language: https://ethindia.co — light, white graph paper, black ink, pixel-font accents, ticker bar. Open it before building.
- Existing content: https://institutions.ethindia.co — the current portal (briefing, stats, updates). Reuse its content. Check its current URLs (briefing modules, anchors) and keep them working or 301-redirect them.

## 2. Tech stack

- Astro (static output), plain CSS with custom properties. No Tailwind, no UI kit.
- Content lives in `src/content/` as Markdown/JSON so copy, stats, updates, FAQ, team and supporters can be edited without touching components.
- Vanilla JS only where needed (ticker, glyph swap, mobile nav, FAQ). No three.js, no heavy animation libs, no scroll-jacking / smooth-scroll libraries.
- Deploy target: Vercel or Cloudflare Pages (static).
- Target: Lighthouse 95+ on all four scores, mobile and desktop.

Suggested structure:

```
src/
  content/
    site.json          # nav, ticker items, CTAs, emails, socials
    stats.json         # India numbers with source + date
    focus.json         # focus areas
    segments.json      # institutional segments
    faq.json
    updates/*.md       # dated updates
    briefing/*.md      # modules A–G
    team.json
    supporters.json    # { anchors: [], ecosystem: [] }
  components/
  layouts/Base.astro
  pages/
    index.astro
    briefing/index.astro
    briefing/[module].astro
    privacy.astro
  styles/tokens.css, base.css
public/
  fonts/  logo/  motifs/  team/  supporters/  og/
```

## 3. Design system

### Direction

Take ethindia.co's language and make it quieter. Same paper, ink, grid and type, but more whitespace, longer reading measure, fewer motifs. It should feel like a research institute that belongs to the ETHIndia family, not an event page.

### Tokens (pulled from ethindia.co's live CSS, keep these exact)

```css
:root {
  --paper: #ffffff;
  --ink: #0a0a0a;
  --grid: #e2e2e2;
  --grid-size: 3.6vw;
  --rule: #807b6f;            /* warm grey for hairlines and meta text */
  --ink-2: #4a4740;           /* secondary text — must pass 4.5:1 on white */
  --surface: #f6f5f2;         /* quiet panel fill, use sparingly */
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --gutter: clamp(20px, 5vw, 64px);
  --nav-h: clamp(56px, 5vw, 80px);
  --measure: 64ch;
  --radius-pill: 999px;
  --radius-card: 4px;

  --font-sans: "Neue Montreal", "Inter Tight", ui-sans-serif, system-ui, sans-serif;
  --font-pixel: "Matrix Sans", "Departure Mono", ui-monospace, monospace;
}
```

- Background: graph paper exactly like ethindia.co:

```css
body {
  background-color: var(--paper);
  background-image:
    linear-gradient(to right, var(--grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid) 1px, transparent 1px);
  background-size: var(--grid-size) var(--grid-size);
}
```

Long-form reading areas (briefing modules, FAQ answers) sit on solid `--paper` panels so the grid doesn't fight body text.

- Colour: monochrome. The only colour on the site comes from ETHIndia's own illustration assets (rug/textile motifs), used sparingly. No gradients, no glow, no accent blue.
- No dark mode for v1.

### Typography

- Neue Montreal for headings and body. Matrix Sans (pixel) for display numbers, labels, ticker, dates and the glyph-swap treatment.
- Font files: get the licensed files from the ETHIndia/Devfolio team (both are on ethindia.co). Self-host from `/public/fonts`, `font-display: swap`, preload the two most-used weights. Until files arrive, use the fallbacks in the token stack.
- Scale (fluid):
  - Display H1: `clamp(44px, 7vw, 104px)`, weight 500, line-height 0.95, letter-spacing -0.02em
  - H2: `clamp(30px, 4vw, 52px)`, weight 500, line-height 1.05
  - H3: 22–24px, weight 600
  - Body: 18px / 1.6, weight 400, `--ink`
  - Small/meta: 14px minimum
  - Pixel labels: Matrix Sans, 13–14px, uppercase, letter-spacing 0.08em
- Hard floor: no text under 13px anywhere. No text below 4.5:1 contrast. No opacity-faded text; use `--ink-2` instead.
- Glyph-swap signature (from ethindia.co): in the hero H1, 2–4 letters render in Matrix Sans while the rest are Neue Montreal (see "04/Nov Mumbai" on ethindia.co). Wrap swapped letters in `<span class="px">`. Optional: every ~4s one letter swaps state with a 150ms step transition. Disabled under `prefers-reduced-motion`. Screen readers must read the word normally (use `aria-label` on the heading, `aria-hidden` on the spans).
- Body copy is always left-aligned. Centering only for short headings and one-line intros.
- Global reset must include `button, input, select, textarea { font: inherit; color: inherit; }`.

### Components

- Ticker bar (top, below nav, like ethindia.co): black bar, white Matrix Sans uppercase, slow marquee, ◆ separators. Pauses on hover/focus, static under reduced motion. Items in `site.json`.
- Nav: ETHIndia Institutional logo left, links centre, black pill CTA right ("Read the briefing"). Sticky, white background with hairline bottom border. Total sticky chrome (nav + ticker) ≤ 96px desktop; ticker hides on scroll-down, returns on scroll-up.
- Buttons: primary = black pill, white text, weight 600, 15px, min 44px height. Secondary = transparent pill with 1px ink border. Hover: invert. Visible 2px focus ring offset 3px.
- Cards: white fill, 1px `--grid` darkened border (`#d6d6d6`), 4px radius, no shadow. Hover on linked cards: border goes `--ink`.
- Stat block: big Matrix Sans number, Neue Montreal label below, source + date in 14px `--ink-2`. Every stat must have a source.
- Hairlines: 1px `--rule` at 40% for section dividers.
- Motifs: ETHIndia's textile illustrations (`rug`, `paisley`, `diamond`, `eth-floral`, etc., get the WebP/SVG files from the ETHIndia team). Max one motif per section, cropped at a viewport edge like ethindia.co does. Never centred as ornament, never behind text.

### Motion

Ticker, glyph swap, and a 300ms fade/translate-up (12px) on section entry using IntersectionObserver. That's it. Everything respects `prefers-reduced-motion: reduce`.

## 4. Page structure (home)

Follows ethereuminstitutional.org's flow, adapted for India. Copy below is draft — keep it as written unless marked `[TODO]`; don't invent new claims, stats or names.

### 0. Ticker

`BRIEFING OUT: TOKENISED SETTLEMENT IN INDIA ↗` · `FOLLOW @ETHINDIACO ON X ↗`

### 1. Nav

Logo · Why India · Focus · Briefing · Team · FAQ · [Read the briefing]

- Logo: `/public/logo/ethindia-institutional.svg` `[TODO: Arko supplies final mark]`. Placeholder: ETHIndia logo + "Institutional" set in Neue Montreal 500.
- Active-section highlighting via IntersectionObserver, threshold tuned so the highlighted item matches what's on screen.

### 2. Hero

- Eyebrow (pixel): `AN ETHINDIA INITIATIVE`
- H1 (with glyph swap): Ethereum for institutional finance in India.
- Sub (max 2 lines): Where banks, market infrastructure, regulators and builders work out what role Ethereum should play in India's tokenised finance.
- CTA: [Read the briefing] primary
- Below, a 4-up stat strip (from `stats.json`):
  - ₹53.6 lakh cr — corporate bonds outstanding (FY25)
  - ₹7,645 cr — daily secondary corporate bond trading
  - $135 bn — annual remittance inflows, world's largest
  - ₹1,025 cr — raised in India's first tokenised bond pilot, settled in wholesale CBDC (Sept 2026)

  Sources: as cited in the existing briefing `[TODO: confirm each source link and date with the report author]`.
- No globe, no 3D, no fake live data. One motif cropped at the right edge is fine.

### 3. Why India (mirrors "Ethereum as the base layer")

H2: India is already tokenising. The question is on what rails. Short left-aligned intro, then 4 cards:

- Regulators moved early. SEBI mandated distributed ledgers for corporate-bond monitoring in April 2022.
- Live issuance. Tokenised corporate bonds launched in September 2026, settled in wholesale CBDC.
- Settlement is slow. Off-exchange secondary trades take 3–7 days to settle.
- Scale. The world's largest remittance corridor and a ₹53.6 lakh crore bond market.

### 4. Why ETHIndia Institutional (mirrors "Why Ethereum Institutional?")

Two-column on desktop: H2 left, text right. Max 4 short paragraphs, left-aligned. H2: A neutral front door to Ethereum, built in India.

- India's first tokenised bonds run on a closed ledger owned by the depositories. What comes next could be proprietary chains or public infrastructure. Institutions need someone who can explain the options without selling one.
- ETHIndia has convened India's Ethereum builders since 2019 `[TODO: verify year and add one proof point, e.g. hackathon scale]`. ETHIndia Institutional brings that network to banks, market infrastructure and regulators.
- We publish research, convene closed-door discussions, and carry institutional requirements back to the people building Ethereum.

### 5. Focus areas (mirrors "Five focus areas")

H2: What we do. 4 cards in a 2×2 grid (or 4-up on wide screens). Not a timeline — these are parallel, not sequential. Each card: pixel label, H3, 2 lines.

- `RESEARCH` — Briefings and reports. Neutral research on what's live, what's legal and where Ethereum fits in Indian finance.
- `CONVENING` — Closed-door forums. Small, invite-only rooms for senior institutional people, researchers and builders.
- `REQUIREMENTS` — From institutions to builders. Surface what Indian institutions need for issuance, custody, settlement and privacy, and feed it into the ecosystem.
- `EDUCATION` — Plain-language explainers. For teams evaluating Ethereum for the first time. `[TODO: client to confirm the final list]`

### 6. The briefing (new, the main content)

Full-width panel on solid `--paper`, black border.

- Pixel label: `REPORT · 25 SEP 2026`
- H2: Tokenised settlement in India: what's live, what's legal, where Ethereum fits.
- Left: 2-line summary + [Read the briefing] + [Download PDF] `[TODO: PDF file]`
- Right: module index as a list, each row = pixel letter + title + arrow, linking to `/briefing/a` … `/briefing/g`: A What shipped · B What's legal in India · C Where the value is · D Ethereum vs alternatives · E The privacy question · F The objections · G How adoption happens
- If the full "ETHIndia Institutional Report" is a separate, later publication, show it as a second card with "Coming soon" and a notify-me link. `[TODO: confirm whether the report = this briefing or a new piece]`

### 7. Who we work with (mirrors "Across the institutional stack")

H2: Across Indian finance. Simple 4×2 grid of text tiles, no diagram: Commercial banks · Asset managers · Market infrastructure (exchanges, depositories, clearing) · Regulators and public sector · NBFCs and fintechs · Insurers · Corporates and treasuries · GIFT City / IFSC entities

Each tile: name + one line on what they're exploring `[TODO: lines, or ship names only]`.

### 8. Updates

H2: Updates. Dated list from `src/content/updates/`, newest first, date in pixel font. Show latest 3 + "All updates". Seed:

- 25 Sep 2026 — Briefing published

### 9. Team (mirrors "Founded by…")

H2: People. `[TODO: names, roles, one-line bios, photos]`

- Photos: square, greyscale, same crop. If photos aren't ready, use initials in pixel font on a `--surface` tile rather than mismatched images.
- Line under the grid: An ETHIndia initiative. + careers/contact email `[TODO]`.
- Hide the section entirely if `team.json` is empty.

### 10. Supporters (mirrors "Supported by…") — optional for v1

- Anchors first and largest: logos at real size in a single row with one line each.
- Ecosystem below: compact monochrome logo grid, max 3 rows visible, rest behind "Show all". Normalise logos by optical size, not width.
- Hide the section if `supporters.json` is empty.

### 11. FAQ

Native `<details>/<summary>` accordion, left-aligned, max-width `--measure`. Draft questions `[TODO: answers from client]`:

- What is ETHIndia Institutional?
- How is it related to ETHIndia and Devfolio?
- Is ETHIndia Institutional selling anything or charging fees?
- Who is the briefing for?
- Can my institution contribute research or data?
- How do I get in touch?

### 12. Stay informed + footer

- H2: Research and updates, in your inbox. Email input with a visible label (not placeholder-only) + [Subscribe] pill + consent checkbox at 14px. `[TODO: provider — Buttondown/Substack/Beehiiv embed URL]`. Do not build a custom backend.
- Footer: logo, An ETHIndia initiative, link to ethindia.co, X @ethindiaco, contact email `[TODO]`, Privacy, and Prose and data CC BY 4.0. Code MIT. (carried over from the current portal).

## 5. Other pages

- `/briefing` — report landing: title, date, summary, module index, PDF link, how to cite.
- `/briefing/[module]` — long-form reading layout: solid paper panel, 64ch measure, sticky module nav on desktop (A–G with progress), prev/next at the bottom, tables and figures full-width within the panel. Port content from the existing portal's briefing.
- `/privacy` — `[TODO: copy]`.
- 404 in the same style.

## 6. SEO and meta

- Title: `ETHIndia Institutional — Ethereum for institutional finance in India`
- Meta description: the hero sub line.
- OG image 1200×630: white graph paper, H1 with glyph swap, logo `[generate as a static PNG in /public/og/]`.
- Per-module OG titles for briefing pages.
- `sitemap.xml`, `robots.txt`, canonical URLs on `institutions.ethindia.co`.
- Analytics: Plausible or Cloudflare Web Analytics `[TODO: confirm]`.

## 7. Accessibility checklist

- Skip link, semantic landmarks, one H1 per page, logical heading order.
- All text ≥ 13px, all text ≥ 4.5:1 contrast, interactive targets ≥ 44px.
- Visible focus on everything. Keyboard-operable nav, ticker pause, FAQ.
- Ticker and glyph swap don't re-announce to screen readers.
- `prefers-reduced-motion` kills all animation.
- Form inputs have real `<label>`s.

## 8. Do not

Lessons from reviewing ethereuminstitutional.org:

- No fake or simulated data. No randomised "live transactions", invented hashes or decorative numbers. Every number on the site is real and sourced.
- No dot-globe, no 3D, no ETH-diamond-in-the-middle hero.
- Don't make the org name the H1. The H1 is the positioning line.
- No centred multi-paragraph body text.
- No hub-and-spoke or orbit diagrams for audience lists.
- No timeline UI for non-sequential items.
- No newsletter as the primary hero CTA.
- No text under 13px, no opacity-faded text, no unstyled buttons falling back to Arial.
- No logo wall that outranks the anchor supporters.
- No scroll-jacking or smooth-scroll libraries.
- Don't put Indian motifs centred as decoration (no mandala hero). Motifs are cropped, edge-placed, one per section max.

## 9. Build phases

Stop after each phase, run the dev server, and report what to review.

- **Phase 1 — Foundation.** Astro scaffold, tokens.css, base.css (reset with `font: inherit`), graph-paper background, font loading with fallbacks, Base layout, nav, ticker, footer. Content collections and JSON files seeded with the copy above. Check: nav + ticker + footer render on desktop and 375px mobile; no horizontal scroll; Lighthouse a11y 100.
- **Phase 2 — Home page.** Sections 2–12 in order, reading from content files. Glyph-swap H1. Check: every `[TODO]` renders as a visible placeholder (dashed outline + label) so gaps are obvious; sections with empty data are hidden.
- **Phase 3 — Briefing.** `/briefing` and `/briefing/[module]` with content ported from the existing portal; preserve or redirect old URLs. Check: all seven modules render; old portal URLs resolve.
- **Phase 4 — Forms.** Newsletter form wired to the chosen service (or stubbed with a clear TODO).
- **Phase 5 — Polish.** Section-entry motion, motifs, OG images, sitemap, 404, reduced-motion pass, contrast pass, Lighthouse on mobile and desktop. Check: list every remaining `[TODO]` in a final report.

## 10. Assets needed from Arko / ETHIndia

- [ ] ETHIndia Institutional logo (SVG, horizontal lockup + mark)
- [ ] Neue Montreal + Matrix Sans font files (licensed, from ETHIndia/Devfolio)
- [ ] Textile motif files used on ethindia.co
- [ ] Briefing content + PDF, and confirmation of report vs briefing
- [ ] Stat sources/dates
- [ ] Team names, roles, bios, photos
- [ ] Supporters (if any) + logos
- [ ] FAQ answers
- [ ] Contact + careers emails
- [ ] Newsletter provider and form endpoint
- [ ] Analytics choice

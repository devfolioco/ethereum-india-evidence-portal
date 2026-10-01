// Head metadata shared by both page shells: description, canonical, Open
// Graph, Twitter and JSON-LD. One helper so the narrative front door and the
// portal pages cannot drift apart on what a link preview or a crawler sees.
//
// Same rule as the rest of the build: no clock reads. Every date here comes
// from figures.json meta.generated.

export const SITE_NAME = 'Ethereum/India Institutional Briefing';
export const AUTHOR = 'Rohit Malekar';
export const CONTENT_LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
export const OG_IMAGE = { path: 'assets/og-card.png', width: 1200, height: 630, alt: `${SITE_NAME}: tokenised settlement in India, what's live, what's legal, where Ethereum fits` };

export function escapeHtmlText(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(str) {
  return escapeHtmlText(str).replace(/"/g, '&quot;');
}

/**
 * JSON-LD sits inside a <script> element, where HTML escaping does not apply.
 * Escaping `<` as < keeps any string (a claim, a source title) from
 * closing the element early; JSON parsers read it back as `<`.
 */
function renderJsonLd(obj) {
  const json = JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

export function renderHeadMeta({ title, description, url, type, siteBase, siteName = SITE_NAME, jsonLd, extraLinks = [] }) {
  const image = siteBase + OG_IMAGE.path;
  const lines = [
    `<meta name="description" content="${escapeAttr(description)}">`,
    `<link rel="canonical" href="${escapeAttr(url)}">`,
    ...extraLinks,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${escapeAttr(siteName)}">`,
    `<meta property="og:url" content="${escapeAttr(url)}">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:image" content="${escapeAttr(image)}">`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}">`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}">`,
    `<meta property="og:image:alt" content="${escapeAttr(OG_IMAGE.alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(image)}">`,
    renderJsonLd(jsonLd),
  ];
  return lines.join('\n');
}

const author = { '@type': 'Person', name: AUTHOR };

export function websiteLd({ siteBase, name = SITE_NAME, title, description }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteBase}#website`,
    name,
    alternateName: title,
    url: siteBase,
    description,
    inLanguage: 'en',
    license: CONTENT_LICENSE,
    author,
  };
}

export function articleLd({ siteBase, url, headline, description, dateModified }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    url,
    mainEntityOfPage: url,
    image: siteBase + OG_IMAGE.path,
    dateModified,
    inLanguage: 'en',
    license: CONTENT_LICENSE,
    author,
    publisher: author,
    isPartOf: { '@id': `${siteBase}#website` },
  };
}

export function datasetLd({ siteBase, url, name, description, dateModified }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name,
    description,
    url,
    dateModified,
    inLanguage: 'en',
    license: CONTENT_LICENSE,
    creator: author,
    isPartOf: { '@id': `${siteBase}#website` },
    isAccessibleForFree: true,
    keywords: ['tokenisation', 'distributed ledger', 'Ethereum', 'India', 'institutional finance', 'settlement'],
    variableMeasured: ['claim', 'figure', 'unit', 'as_of', 'source', 'tier', 'flags'],
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: `${siteBase}data/figures.json`,
    },
  };
}

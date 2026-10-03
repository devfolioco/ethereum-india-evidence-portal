import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const updates = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/updates' }),
  schema: z.object({ title: z.string(), date: z.date() }),
});

// Module metadata. Each module's body (its three reading tiers) is the sibling <letter>.html,
// ported from the old portal; `legacy` is the old portal slug, redirected in vercel.json.
const briefing = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/briefing' }),
  schema: z.object({
    letter: z.string(),
    order: z.number(),
    title: z.string(),
    heading: z.string(),
    question: z.string(),
    description: z.string(),
    legacy: z.string(),
    summary: z.array(z.string()).default([]),
  }),
});

export const collections = { updates, briefing };

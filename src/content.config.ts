import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const updates = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/updates' }),
  schema: z.object({ title: z.string(), date: z.date() }),
});

const briefing = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/briefing' }),
  schema: z.object({
    letter: z.string(),
    order: z.number(),
    title: z.string(),
    summary: z.string().default(''),
  }),
});

export const collections = { updates, briefing };

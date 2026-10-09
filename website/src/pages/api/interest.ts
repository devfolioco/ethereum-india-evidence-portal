import type { APIRoute } from 'astro';
import { handleInterest } from '../../server/interest.mjs';

export const prerender = false;

export const ALL: APIRoute = ({ request }) => handleInterest(request, {
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? import.meta.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_D1_DATABASE_ID: process.env.CLOUDFLARE_D1_DATABASE_ID ?? import.meta.env.CLOUDFLARE_D1_DATABASE_ID,
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN ?? import.meta.env.CLOUDFLARE_API_TOKEN,
});

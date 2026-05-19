import type { APIContext } from 'astro';

export function publicOrigin(ctx: APIContext | { request: Request; url: URL }): string {
  if (import.meta.env.PROD && import.meta.env.SITE) {
    return String(import.meta.env.SITE).replace(/\/$/, '');
  }
  const proto = ctx.request.headers.get('x-forwarded-proto');
  const host = ctx.request.headers.get('x-forwarded-host') ?? ctx.request.headers.get('host');
  if (host) return `${proto ?? 'https'}://${host}`;
  return ctx.url.origin;
}

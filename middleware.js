// Vercel Routing Middleware: minden kérés előtt lefut (oldalak ÉS /api is).
// Érvényes belépési süti nélkül az oldalak a /login.html-re irányítanak,
// az API-hívások 401-et kapnak -- így az /api/analyze (Anthropic-költség)
// sem hívható jelszó nélkül kívülről.

import { COOKIE_NAME, gateToken, safeEqual, readCookie } from './lib/gate.js';

export const config = {
  // A belépőoldal és a belépés-végpont maradjon szabadon elérhető
  matcher: ['/((?!login\\.html|api/login|favicon\\.ico).*)'],
};

// Ugyanaz, mint a @vercel/functions next() -- függőség nélkül
const next = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

export default async function middleware(request) {
  const url = new URL(request.url);
  const password = process.env.SITE_PASSWORD;

  if (password) {
    const cookie = readCookie(request.headers.get('cookie'), COOKIE_NAME);
    if (cookie && safeEqual(cookie, await gateToken(password))) return next();
  }

  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Belépés szükséges' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const login = new URL('/login.html', url);
  if (url.pathname !== '/' || url.search) login.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(login, 302);
}

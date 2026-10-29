// api/login.js
//
// POST /api/login  (sima HTML-űrlapból: password=...&next=/...)
//
// Helyes jelszónál beállítja a belépési sütit és visszairányít a kért
// oldalra; hibásnál vissza a belépőoldalra hibaüzenettel. A jelszó a
// SITE_PASSWORD környezeti változóból jön (Vercel → Settings → Environment
// Variables).

import { COOKIE_NAME, COOKIE_MAX_AGE, gateToken, safeEqual, safeNext } from '../lib/gate.js';

async function readForm(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (req.body === undefined) {
    for await (const chunk of req) raw += chunk;
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return redirect(res, '/login.html');

  const password = process.env.SITE_PASSWORD;
  const form = await readForm(req);
  const next = safeNext(form.next);

  if (!password) {
    return redirect(res, '/login.html?hiba=beallitas');
  }

  if (!safeEqual(String(form.password || ''), password)) {
    // Kis késleltetés, hogy a találgatás lassú legyen
    await new Promise(r => setTimeout(r, 600));
    const back = new URLSearchParams({ hiba: '1' });
    if (next !== '/') back.set('next', next);
    return redirect(res, '/login.html?' + back);
  }

  // SameSite=None + Partitioned: iframe-be ágyazva is működjön (Chrome/Edge/Firefox)
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${await gateToken(password)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=None; Partitioned`);
  return redirect(res, next);
}

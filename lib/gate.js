// Jelszavas belépés közös logikája (middleware.js + api/login.js).
//
// A jelszó KIZÁRÓLAG a SITE_PASSWORD környezeti változóból jön -- a repó
// publikus, ezért se a jelszó, se a hash-e nem kerülhet a kódba. A sütibe
// nem a jelszó kerül, hanem egy HMAC-token (kulcs = jelszó), így a süti
// értékéből a jelszó nem fejthető vissza, jelszócserekor pedig minden
// korábbi belépés automatikusan érvénytelenné válik.

export const COOKIE_NAME = 'hf_gate';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 nap

export async function gateToken(password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('hovaforduljak-gate-v1'));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
}

// Időzítés-független összehasonlítás (ne lehessen a válaszidőből találgatni)
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function readCookie(header, name) {
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// Csak saját oldalon belüli visszairányítást engedünk (nyílt átirányítás ellen)
export function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
    ? next
    : '/';
}

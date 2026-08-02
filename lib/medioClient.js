// lib/medioClient.js
//
// Vékony kliens a Medio Channels API-hoz (v1.2.1) — ezen keresztül kötjük be
// a MedSoulYou-t mint első valós, foglalható partnerklinikát.
//
// Szükséges env változók (Vercel > Project > Settings > Environment Variables):
//   MEDIO_API_BASE_URL  — a Medio API tényleges base URL-je (a doksiban csak
//                          relatív útvonalak szerepelnek, pl. "/token", "/doctors".
//                          A pontos hostot a Postman collection linkjéből vagy
//                          Molnár Lászlótól kell megkérni.)
//   MEDIO_USERNAME       — Partner felhasználónév (Medio adja)
//   MEDIO_PASSWORD       — Partner jelszó (Medio adja)
//
// FONTOS: ez a modul sosem naplózza a beteg személyes/egészségügyi adatait
// (TAJ, születési adatok stb.) — csak átadja a Mediónak, nem tárolja el.

const MEDIO_API_BASE_URL = process.env.MEDIO_API_BASE_URL;
const MEDIO_USERNAME = process.env.MEDIO_USERNAME;
const MEDIO_PASSWORD = process.env.MEDIO_PASSWORD;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function assertConfigured() {
    const missing = [];
    if (!MEDIO_API_BASE_URL) missing.push('MEDIO_API_BASE_URL');
    if (!MEDIO_USERNAME) missing.push('MEDIO_USERNAME');
    if (!MEDIO_PASSWORD) missing.push('MEDIO_PASSWORD');
    if (missing.length) {
          throw new Error(
                  `Medio API nincs beállítva — hiányzó env változó(k): ${missing.join(', ')}`
                );
    }
}

async function getMedioToken() {
    const now = Date.now();
    if (cachedToken && now < cachedTokenExpiresAt - 60_000) {
          return cachedToken;
    }

  assertConfigured();

  const body = new URLSearchParams({
        grant_type: 'password',
        username: MEDIO_USERNAME,
        password: MEDIO_PASSWORD,
  });

  const res = await fetch(`${MEDIO_API_BASE_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
  });

  if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Medio authentikáció sikertelen (${res.status}): ${detail}`);
  }

  const data = await res.json();
    cachedToken = data.access_token;
    cachedTokenExpiresAt = now + (data.expires_in ? data.expires_in * 1000 : 10 * 60 * 1000);
    return cachedToken;
}

async function medioFetch(path, { method = 'GET', query, body } = {}) {
    assertConfigured();
    const token = await getMedioToken();

  const url = new URL(`${MEDIO_API_BASE_URL}${path}`);
    if (query) {
          Object.entries(query).forEach(([key, value]) => {
                  if (value !== undefined && value !== null && value !== '') {
                            url.searchParams.set(key, value);
                  }
          });
    }

  const res = await fetch(url.toString(), {
        method,
        headers: {
                Authorization: `Bearer ${token}`,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
    let data;
    try {
          data = text ? JSON.parse(text) : null;
    } catch {
          data = text;
    }

  if (!res.ok) {
        const err = new Error((data && data.error) || `Medio API hiba (${res.status})`);
        err.status = res.status;
        err.details = data;
        throw err;
  }

  return data;
}

export { getMedioToken, medioFetch };

export const getLocations = () => medioFetch('/locations');
export const getSpecializations = () => medioFetch('/specializations');
export const getDoctors = () => medioFetch('/doctors');

                                 export const getFreeSlots = ({ locationId, specializationId, doctorId, startDate, endDate }) =>
                                     medioFetch('/slots', {
                                           query: { locationId, specializationId, doctorId, startDate, endDate },
                                     });

export const createBooking = (booking) =>
    medioFetch('/reservations', { method: 'POST', body: booking });

export const getBooking = (id) => medioFetch(`/reservations/${id}`);

export const listBookings = ({ locationId, specializationId, doctorId, startDate, endDate, patientPhone }) =>
    medioFetch('/reservations', {
          query: { locationId, specializationId, doctorId, startDate, endDate, patientPhone },
    });

export const deleteBooking = (id) => medioFetch(`/reservations/${id}`, { method: 'DELETE' });

// api/medsoulyou-book.js
//
// POST /api/medsoulyou-book
// Body: { category, doctorId, specializationId, date, patientName,
//         patientPhone, patientEmail, patientDateOfBirth, patientGender,
//         billingZip, billingSettlement, billingAddress, billingHouseNr?,
//         billingFloorDoor?, consent: true }
//
// doctorId/specializationId/date a kiválasztott szabad időponttól (Medio
// /slots válaszából) származik. A foglalás előtt a végpont visszakérdez a
// Medióba, hogy ez az időpont még tényleg szabad-e -- a hossza (length) is
// innen jön, nem a böngészőből, így kitalált időpontot nem lehet küldeni.
// A végpont azt is ellenőrzi, hogy a doctorId/specializationId pár szerepel-e
// az adott kategóriához jóváhagyott listában (medio-mapping.json).
//
// Valós MedSoulYou-időpontot foglal a Medio API-n keresztül, ezért a klinika
// naptárába is bekerül, és a Medio visszaigazoló e-mailt küld a betegnek.
//
// ADATVÉDELMI ALAPELV: ez a végpont a beteg adatait KIZÁRÓLAG továbbítja a
// Mediónak, sehol nem menti el (nincs adatbázisunk). A logban csak a
// foglalás azonosítója és a szakterület jelenik meg — semmilyen egészségügyi
// vagy személyes adat nem kerül naplózásra. Csak a Medio API által KÖTELEZŐ
// mezőket kérjük be: TAJ-számot, anyja nevét, születési helyet nem.
//
// FONTOS, MIELŐTT ÉLESBE MEGY: a beteg-adatok gyűjtése és továbbítása
// GDPR/egészségügyi adatkezelési szempontból külön jogi jóváhagyást igényel
// (ahogy a Master Strategy dokumentum "Kereskedelmi és attribúciós jogi kapu"
// pontja is előírja). Ezt a MEDIO_BOOKING_LEGAL_APPROVED környezeti változó
// kapcsolja: amíg nincs beállítva, ez a végpont 403-at ad, a frontend pedig
// (a /api/medsoulyou-slots bookingEnabled mezője alapján) marad a klinika
// külső foglalási oldalánál.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createBooking, getFreeSlots } from '../lib/medioClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapping = JSON.parse(
    readFileSync(path.join(__dirname, '..', 'medio-mapping.json'), 'utf8')
  );

const REQUIRED_FIELDS = [
    'category',
    'doctorId',
    'specializationId',
    'date',
    'patientName',
    'patientPhone',
    'patientEmail',
    'patientDateOfBirth',
    'patientGender',
    'billingZip',
    'billingSettlement',
    'billingAddress',
  ];

const SLOT_TAKEN_MSG = 'Ezt az időpontot közben lefoglalták. Kérjük, válassz másikat.';

const MEDIO_ERROR_HU = {
    E2006: 'Kérjük, ellenőrizd a megadott nevet.',
    E2007: 'Kérjük, ellenőrizd a megadott telefonszámot.',
  };

// A Medio API mezőhossz-korlátai szerint (Medio Channels API 1.2.1)
function validatePatient(p) {
    const name = String(p.patientName).trim();
    if (name.length < 3 || name.length > 50) return 'Kérjük, add meg a teljes neved (legfeljebb 50 karakter).';
    const phone = String(p.patientPhone).trim();
    if (phone.length > 45 || !/^[0-9+() /-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7) {
          return 'Kérjük, ellenőrizd a megadott telefonszámot.';
    }
    const email = String(p.patientEmail).trim();
    if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return 'Kérjük, ellenőrizd a megadott e-mail címet.';
    }
    const dob = /^\d{4}-\d{2}-\d{2}$/.test(p.patientDateOfBirth) ? new Date(`${p.patientDateOfBirth}T00:00:00Z`) : null;
    if (!dob || !Number.isFinite(dob.getTime()) || dob > new Date() || dob.getUTCFullYear() < 1900) {
          return 'Kérjük, ellenőrizd a születési dátumot.';
    }
    if (p.patientGender !== 'Male' && p.patientGender !== 'Female') return 'Kérjük, válaszd ki a nemet.';
    if (!/^\d{4}$/.test(String(p.billingZip))) return 'Kérjük, 4 számjegyű irányítószámot adj meg.';
    return null;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

  // Jogi kapu: jogász/DPO jóváhagyásig (ld. a fájl tetején lévő megjegyzés)
  // a közvetlen hívás is el van utasítva, nem csak a felület van elrejtve.
  if (!process.env.MEDIO_BOOKING_LEGAL_APPROVED) {
        return res.status(403).json({
                error: 'A foglalási funkció jogi/DPO jóváhagyásig ideiglenesen inaktív.',
        });
  }

  const payload = req.body || {};

  if (payload.consent !== true && payload.consent !== 'true') {
        return res.status(400).json({ error: 'A hozzájárulás (consent) szükséges az adatátadáshoz.' });
  }

  const missing = REQUIRED_FIELDS.filter((field) => !payload[field]);
    if (missing.length) {
          return res.status(400).json({ error: `Hiányzó mezők: ${missing.join(', ')}` });
    }

  const invalid = validatePatient(payload);
    if (invalid) {
          return res.status(400).json({ error: invalid });
    }

  const picks = mapping.specialtyMap[payload.category];
    if (!mapping.locationId || !Array.isArray(picks) || !picks.length) {
          return res.status(400).json({
                  error: 'Ehhez a szakterülethez jelenleg nincs beállítva MedSoulYou-foglalás.',
          });
    }
  const approved = picks.some(
        (p) => String(p.doctorId) === String(payload.doctorId) && String(p.specializationId) === String(payload.specializationId)
      );
    if (!approved) {
          return res.status(400).json({
                  error: 'A megadott orvos/szakterület nem tartozik ehhez a MedSoulYou-kategóriához.',
          });
    }

  // Csak olyan időpontot foglalunk, amit a Medio ebben a pillanatban is
  // szabadnak mond -- a közben elkelt időpontot a felület újraválasztatja.
  const slotTime = new Date(payload.date).getTime();
    if (!Number.isFinite(slotTime)) {
          return res.status(400).json({ error: 'Érvénytelen időpont.' });
    }
  let slot;
    try {
          const free = await getFreeSlots({
                  locationId: mapping.locationId,
                  specializationId: payload.specializationId,
                  doctorId: payload.doctorId,
                  startDate: new Date(slotTime - 60_000).toISOString(),
                  endDate: new Date(slotTime + 86_400_000).toISOString(),
          });
          slot = (free || []).find(
                  (s) => new Date(s.date).getTime() === slotTime && String(s.doctorId) === String(payload.doctorId)
                );
    } catch (err) {
          console.error('[medsoulyou-book] időpont-ellenőrzés sikertelen', err.status);
          return res.status(502).json({
                  success: false,
                  error: 'Most nem tudtuk ellenőrizni az időpontot. Kérjük, próbáld újra.',
          });
    }
    if (!slot) {
          return res.status(409).json({ success: false, slotTaken: true, error: SLOT_TAKEN_MSG });
    }

  const booking = {
        locationId: String(mapping.locationId),
        specializationId: String(payload.specializationId),
        doctorId: String(payload.doctorId),
        date: slot.date,
        length: Number(slot.length),
        patientName: String(payload.patientName).trim(),
        patientPhone: String(payload.patientPhone).trim(),
        patientEmail: String(payload.patientEmail).trim(),
        patientDateOfBirth: `${payload.patientDateOfBirth}T00:00:00Z`,
        patientGender: payload.patientGender,
        billingCountry: 'Magyarország',
        billingZip: Number(payload.billingZip),
        billingSettlement: String(payload.billingSettlement).trim(),
        billingAddress: String(payload.billingAddress).trim(),
        billingHouseNr: payload.billingHouseNr || undefined,
        billingFloorDoor: payload.billingFloorDoor || undefined,
        isOnsitePayment: true,
        emailNotification: true,
        reservationSource: 'hovaforduljak',
  };

  try {
        const result = await createBooking(booking);
        // Csak nem-érzékeny adatot naplózunk.
      console.log('[medsoulyou-book] foglalás létrehozva', {
              id: result.id,
              category: payload.category,
      });
        res.status(200).json({
                success: true,
                bookingId: result.id,
                authorizationCode: result.authorizationCode,
        });
  } catch (err) {
        const code = err.details && err.details.errorCode;
        console.error('[medsoulyou-book] sikertelen foglalás', err.status, code);
        if (code === 'E2004' || code === 'E2005') {
              return res.status(409).json({ success: false, slotTaken: true, error: SLOT_TAKEN_MSG });
        }
        res.status(err.status >= 400 && err.status < 500 ? 400 : 502).json({
                success: false,
                error: MEDIO_ERROR_HU[code] || 'A foglalást most nem sikerült rögzíteni. Kérjük, próbáld újra, vagy hívd a klinikát.',
        });
  }
}

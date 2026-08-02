// api/medsoulyou-book.js
//
// POST /api/medsoulyou-book
// Body: { category, doctorId?, date, length, patientName, patientPhone,
//         patientEmail, patientDateOfBirth, patientBirthPlace, patientGender,
//         patientMothersName, patientTAJ, patientIdNumber?, billingCountry,
//         billingZip, billingSettlement, billingAddress, billingHouseNr?,
//         billingFloorDoor?, patientComment?, consent: true }
//
// Valós MedSoulYou-időpontot foglal a Medio API-n keresztül.
//
// ADATVÉDELMI ALAPELV: ez a végpont a beteg adatait KIZÁRÓLAG továbbítja a
// Mediónak, sehol nem menti el (nincs adatbázisunk). A logban csak a
// foglalás azonosítója és a szakterület jelenik meg — semmilyen egészségügyi
// vagy személyes adat nem kerül naplózásra.
//
// FONTOS, MIELŐTT ÉLESBE MEGY: a TAJ-szám és a születési adatok kérése az
// egészségügyi navigációs oldalon keresztül GDPR/egészségügyi adatkezelési
// szempontból külön jogi jóváhagyást igényel (ahogy a Master Strategy
// dokumentum "Kereskedelmi és attribúciós jogi kapu" pontja is előírja) —
// erre a pilot előtt még szükség van egy jogász/DPO jóváhagyására.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createBooking } from '../lib/medioClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapping = JSON.parse(
    readFileSync(path.join(__dirname, '..', 'medio-mapping.json'), 'utf8')
  );

const REQUIRED_FIELDS = [
    'category',
    'date',
    'length',
    'patientName',
    'patientPhone',
    'patientEmail',
    'patientDateOfBirth',
    'patientBirthPlace',
    'patientGender',
    'patientMothersName',
    'patientTAJ',
    'billingCountry',
    'billingZip',
    'billingSettlement',
    'billingAddress',
  ];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const payload = req.body || {};

  if (payload.consent !== true && payload.consent !== 'true') {
        return res.status(400).json({ error: 'A hozzájárulás (consent) szükséges az adatátadáshoz.' });
  }

  const missing = REQUIRED_FIELDS.filter((field) => !payload[field]);
    if (missing.length) {
          return res.status(400).json({ error: `Hiányzó mezők: ${missing.join(', ')}` });
    }

  const entry = mapping.specialtyMap[payload.category];
    if (!mapping.locationId || !entry || !entry.specializationId) {
          return res.status(400).json({
                  error: 'Ehhez a szakterülethez jelenleg nincs beállítva MedSoulYou-foglalás.',
          });
    }

  const booking = {
        locationId: mapping.locationId,
        specializationId: entry.specializationId,
        doctorId: payload.doctorId || entry.doctorId,
        date: payload.date,
        length: Number(payload.length),
        patientName: payload.patientName,
        patientPhone: payload.patientPhone,
        patientEmail: payload.patientEmail,
        patientDateOfBirth: payload.patientDateOfBirth,
        patientBirthPlace: payload.patientBirthPlace,
        patientGender: payload.patientGender,
        patientMothersName: payload.patientMothersName,
        patientTAJ: payload.patientTAJ,
        patientIdNumber: payload.patientIdNumber || undefined,
        billingCountry: payload.billingCountry,
        billingZip: payload.billingZip,
        billingSettlement: payload.billingSettlement,
        billingAddress: payload.billingAddress,
        billingHouseNr: payload.billingHouseNr || undefined,
        billingFloorDoor: payload.billingFloorDoor || undefined,
        patientComment: payload.patientComment || undefined,
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
        console.error('[medsoulyou-book] sikertelen foglalás', err.message);
        res.status(err.status || 500).json({
                success: false,
                error: (err.details && err.details.error) || err.message,
        });
  }
}

}

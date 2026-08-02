// api/medsoulyou-discover.js
//
// Egyszeri "felfedező" végpont: kilistázza a Medio rendszerben regisztrált
// location-öket, szakterületeket és orvosokat, hogy megtaláljuk köztük a
// MedSoulYou tényleges azonosítóit a medio-mapping.json kitöltéséhez.
//
// Védve van egy titkos kulccsal (MEDIO_SETUP_KEY env változó), mert
// egyébként bárki lekérdezhetné a partner teljes orvos/telephely listáját.
// Miután kitöltötted a medio-mapping.json-t, nyugodtan törölheted ezt a
// fájlt, vagy csak tartsd meg a kulcsot titokban.

import { getLocations, getSpecializations, getDoctors } from '../lib/medioClient.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const setupKey = process.env.MEDIO_SETUP_KEY;
    if (!setupKey || req.query.key !== setupKey) {
          return res.status(401).json({ error: 'Hiányzó vagy hibás setup kulcs (?key=...)' });
    }

  try {
        const [locations, specializations, doctors] = await Promise.all([
                getLocations(),
                getSpecializations(),
                getDoctors(),
              ]);
        res.status(200).json({ locations, specializations, doctors });
  } catch (err) {
        res.status(500).json({ error: err.message, details: err.details || null });
  }
}

}

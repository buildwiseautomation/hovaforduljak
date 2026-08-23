// api/medsoulyou-slots.js
//
// GET /api/medsoulyou-slots?category=Mentális-Pszichés&startDate=...&endDate=...
//
// Visszaadja a MedSoulYou tényleges, szabad időpontjait az adott
// HovaForduljak belépési területhez -- ha egy kategóriához több MedSoulYou-
// orvos is tartozik (ld. medio-mapping.json), mindegyikük szabad
// időpontjait lekérdezi és egyben adja vissza. Ha az adott területhez még
// nincs beállítva Medio-azonosító, "available: false"-t ad vissza --
// ilyenkor a frontend a jelenlegi (nem-API-s) foglalási linket mutassa
// fallbackként.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { getFreeSlots } from '../lib/medioClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapping = JSON.parse(
    readFileSync(path.join(__dirname, '..', 'medio-mapping.json'), 'utf8')
  );

export default async function handler(req, res) {
    if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const { category, startDate, endDate } = req.query;
    if (!category) {
          return res.status(400).json({ error: 'Hiányzó "category" paraméter.' });
    }

  const picks = mapping.specialtyMap[category];
    if (!mapping.locationId || !Array.isArray(picks) || !picks.length) {
          return res.status(200).json({
                  available: false,
                  slots: [],
                  reason: 'Ehhez a szakterülethez még nincs beállítva MedSoulYou Medio-azonosító.',
          });
    }

  try {
        const perDoctor = await Promise.all(
              picks.map((pick) =>
                    getFreeSlots({
                            locationId: mapping.locationId,
                            specializationId: pick.specializationId,
                            doctorId: pick.doctorId,
                            startDate: startDate || new Date().toISOString(),
                            endDate: endDate || undefined,
                    })
                  )
            );
        const slots = perDoctor.flat();
        res.status(200).json({ available: true, slots });
  } catch (err) {
        res.status(500).json({ available: false, slots: [], error: err.message });
  }
}

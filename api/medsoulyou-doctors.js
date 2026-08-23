// api/medsoulyou-doctors.js
//
// GET /api/medsoulyou-doctors?category=Bőr-Haj
//
// Visszaadja az adott HovaForduljak belépési területhez a medio-mapping.json
// alapján ténylegesen bekötött Medio-orvosokat, élő árral (Services -
// "Querying services with amounts" végpont) és telephely-adattal. Ha az adott
// területhez nincs beállítva Medio-azonosító, "available: false"-t ad vissza
// — a frontend ilyenkor a meglévő statikus/illusztratív adatnál marad.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { getDoctors, getLocations, getServicesWithAmounts } from '../lib/medioClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapping = JSON.parse(
    readFileSync(path.join(__dirname, '..', 'medio-mapping.json'), 'utf8')
  );

export default async function handler(req, res) {
    if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const { category } = req.query;
    if (!category) {
          return res.status(400).json({ error: 'Hiányzó "category" paraméter.' });
    }

  const entry = mapping.specialtyMap[category];
    if (!mapping.locationId || !entry || !entry.specializationId) {
          return res.status(200).json({ available: false, doctors: [], location: null });
    }

  try {
        const [doctors, locations, amounts] = await Promise.all([
                getDoctors(),
                getLocations(),
                getServicesWithAmounts(),
              ]);

        const location = locations.find((l) => String(l.id) === String(mapping.locationId)) || null;

        const matched = doctors.filter(
              (doc) =>
                    (doc.institutions || []).some((i) => String(i) === String(mapping.locationId)) &&
                    (doc.specializations || []).some((s) => String(s) === String(entry.specializationId))
            );

        const doctorList = matched.map((doc) => {
                const amt = amounts.find(
                      (a) =>
                            String(a.doctor_id) === String(doc.id) &&
                            String(a.specialization_id) === String(entry.specializationId)
                    );
                return {
                        doctorId: doc.id,
                        name: doc.name,
                        price: amt ? amt.amount : null,
                };
        });

        const address = location ? [location.address, location.city].filter(Boolean).join(', ') : '';

        res.status(200).json({
                available: doctorList.length > 0,
                location: location
                  ? { id: location.id, name: location.name, address, lat: location.lat, lng: location.lng }
                  : null,
                doctors: doctorList,
        });
  } catch (err) {
        res.status(500).json({ available: false, doctors: [], location: null, error: err.message });
  }
}

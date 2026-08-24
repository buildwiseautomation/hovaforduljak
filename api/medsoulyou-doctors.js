// api/medsoulyou-doctors.js
//
// GET /api/medsoulyou-doctors?category=Mentális-Pszichés
//
// Visszaadja az adott HovaForduljak belépési területhez a medio-mapping.json
// alapján ténylegesen bekötött Medio-orvosokat, élő árral (Services -
// "Querying services with amounts" végpont) és telephely-adattal. Ha az adott
// területhez nincs beállítva Medio-azonosító (üres tömb), "available: false"-t
// ad vissza — a frontend ilyenkor a meglévő statikus/illusztratív adatnál marad.

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

  const picks = mapping.specialtyMap[category];
    if (!mapping.locationId || !Array.isArray(picks) || !picks.length) {
          return res.status(200).json({ available: false, doctors: [], location: null });
    }

  try {
        const [doctors, locations, amounts] = await Promise.all([
                getDoctors(),
                getLocations(),
                getServicesWithAmounts(),
              ]);

        const location = locations.find((l) => String(l.id) === String(mapping.locationId)) || null;
        const doctorsById = new Map(doctors.map((d) => [String(d.id), d]));

        const doctorList = picks
              .map((pick) => {
                      const doc = doctorsById.get(String(pick.doctorId));
                      if (!doc) return null;
                      const amt = amounts.find(
                              (a) =>
                                    String(a.doctor_id) === String(pick.doctorId) &&
                                    String(a.specialization_id) === String(pick.specializationId)
                            );
                      return {
                              doctorId: pick.doctorId,
                              specializationId: pick.specializationId,
                              name: doc.name,
                              price: amt ? amt.amount : null,
                      };
              })
              .filter(Boolean);

        // v2.9 (Mick jelzése, "pontos lokációt megkapjunk"): korábban csak
        // az utcanevet + várost fűztük össze (pl. "Újházy utca, Budapest"),
        // a Medio location-objektum zip/houseNr/floorDoor mezőit figyelmen
        // kívül hagyva -- most a teljes, pontos címet állítjuk össze, a
        // meglévő statikus adatokkal megegyező formátumban
        // ("1119 Budapest, Újházi utca 12.").
        const address = location
          ? `${[location.zip, location.city].filter(Boolean).join(' ')}, ${location.address || ''}${location.houseNr ? ' ' + location.houseNr + '.' : ''}${location.floorDoor ? ' ' + location.floorDoor : ''}`.trim()
          : '';

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

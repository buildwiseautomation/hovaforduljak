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
import { getFreeSlots, getDoctors } from '../lib/medioClient.js';

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

  // v2.11 (Mick jelzése, "eltűnt a szabad időpontok funkció" -- kiderült:
  // egy MedSoulYou-orvos időközben törlődött a Medio rendszeréből, de a
  // medio-mapping.json még hivatkozott rá, és ez korábban Promise.all-lal
  // az EGÉSZ kategória live-adatát elvitte magával egyetlen hibás pick
  // miatt is, holott a többi orvosnál lett volna valós adat).
  // Két védelmi réteg, hogy ez magától se ismétlődhessen meg:
  // 1) élőben lekérdezzük a Medio /doctors listáját, és a mapping-picks
  //    közül csak azokat vesszük figyelembe, amelyek TÉNYLEG szerepelnek
  //    benne -- egy stale/törölt doctorId így meg sem próbálja lekérdezni
  //    a szabad időpontjait, tehát nem is hibázhat rajta.
  // 2) a megmaradt picks lekérdezése Promise.allSettled-del történik, hogy
  //    egy váratlan, egyedi Medio-hiba (pl. átmeneti szerverprobléma egy
  //    orvosnál) se vigye el a többiek élő adatát.
  try {
        const liveDoctors = await getDoctors();
        const liveIds = new Set(liveDoctors.map((d) => String(d.id)));
        const validPicks = picks.filter((pick) => liveIds.has(String(pick.doctorId)));
        const stalePicks = picks.filter((pick) => !liveIds.has(String(pick.doctorId)));
        if (stalePicks.length) {
              console.error(
                    `MedSoulYou slots: elavult doctorId(k) a medio-mapping.json-ban (category=${category}, már nem szerepelnek a Medio /doctors listájában):`,
                    JSON.stringify(stalePicks)
                  );
        }
        if (!validPicks.length) {
              return res.status(200).json({
                    available: false,
                    slots: [],
                    reason: 'Ehhez a szakterülethez jelenleg nincs élő MedSoulYou-orvos.',
              });
        }

        const settled = await Promise.allSettled(
              validPicks.map((pick) =>
                    getFreeSlots({
                            locationId: mapping.locationId,
                            specializationId: pick.specializationId,
                            doctorId: pick.doctorId,
                            startDate: startDate || new Date().toISOString(),
                            endDate: endDate || undefined,
                    })
                  )
            );
        const slots = settled
              .filter((r) => r.status === 'fulfilled')
              .flatMap((r) => r.value || []);
        settled.forEach((r, i) => {
              if (r.status === 'rejected') {
                    console.error(
                          `MedSoulYou slots hiba (category=${category}, doctorId=${validPicks[i].doctorId}, specializationId=${validPicks[i].specializationId}):`,
                          r.reason && r.reason.message
                        );
              }
        });
        const allFailed = settled.every((r) => r.status === 'rejected');
        if (allFailed) {
              return res.status(502).json({
                    available: false,
                    slots: [],
                    error: 'A MedSoulYou időpont-lekérdezés jelenleg egyik orvosnál sem sikerült.',
              });
        }
        res.status(200).json({ available: true, slots });
  } catch (err) {
        res.status(500).json({ available: false, slots: [], error: err.message });
  }
}

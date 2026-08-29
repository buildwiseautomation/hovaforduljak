// YourSoulLife - AI elemzés backend
// A kulcs environment variable-ből jön (ANTHROPIC_API_KEY), soha nem látszik a frontenden.

export default async function handler(req, res) {
  // Csak POST kérést fogadunk
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Csak POST kérés engedélyezett" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Hiányzó API kulcs a szerveren" });
  }

  // A prompt a frontendről jön
  const { prompt, allapot } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Hiányzó prompt" });
  }

  // A kérdőív A/B/C állapota kontextusként az AI-magyarázathoz (hangnem, hangsúly)
  const ALLAPOT_KONTEXT = {
    A: 'A felhasznalo "A" allapotban van: nincs konkret panasza, csak felmeri magat. Hangnem: felfedezo, a hangsuly a megelozesen es a kockazati kepen.',
    B: 'A felhasznalo "B" allapotban van: frissen jelentkezett, uj panasza van. Hangnem: cselekvesre osztonzo, konkret kovetkezo lepessel.',
    C: 'A felhasznalo "C" allapotban van: regota fennallo, eddig ki nem vizsgalt panasza van. Hangnem: megerosito es batorito, sosem szamonkero.'
  };
  const finalPrompt = ALLAPOT_KONTEXT[allapot]
    ? prompt + "\n\nALLAPOT-KONTEXTUS: " + ALLAPOT_KONTEXT[allapot]
    : prompt;

  try {
    const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        // v2.11 (Mick jelzése, mobil teszt: csonka/hibás JSON-válasz):
        // 3000 -> 4000, hogy legyen biztonsági tartalék a magyar szöveg
        // (ékezetes karakterek gyakran több tokent igényelnek) + 3 profil-
        // chip + 3 next_steps mező számára, mielőtt a válasz levágódna.
        max_tokens: 4000,
        system: "Kizárólag valid, TELJES JSON objektummal válaszolj a kért struktúra szerint. Semmi más szöveg, magyarázat vagy markdown. FONTOS: tartsd tömören a szövegmezőket (összefoglaló max 3 mondat, leírások max 2 mondat), hogy a JSON biztosan befejeződjön és valid maradjon.",
        messages: [{ role: "user", content: finalPrompt }]
      })
    });

    if (!apiResp.ok) {
      const errTxt = await apiResp.text();
      return res.status(apiResp.status).json({ error: "API hiba: " + errTxt.substring(0, 200) });
    }

    const data = await apiResp.json();
    const raw = (data.content.find(b => b.type === "text") || {}).text || "";

    // Ha a valasz elvagodott (token limit), jelezzuk
    if (data.stop_reason === "max_tokens") {
      console.warn("Valasz elvagodott max_tokens miatt");
    }

    // Robusztus JSON kinyerés: kikeresi a legkülső { ... } blokkot
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(502).json({ error: "Nem található JSON a válaszban" });
    }

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      return res.status(502).json({ error: "JSON parse hiba: " + e.message });
    }

    // A kész objektumot adjuk vissza a frontendnek
    return res.status(200).json(parsed);

  } catch (e) {
    console.error("Backend hiba:", e);
    return res.status(500).json({ error: "Szerver hiba: " + e.message });
  }
}

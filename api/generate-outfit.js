// Vercel Serverless Function: POST /api/generate-outfit
// Keep OPENAI_API_KEY in Vercel Environment Variables. Never expose it in the browser.
const ALLOWED_GARMENTS = new Set([
  "Quiero ver ideas con todas",
  "Skinny",
  "Palazzo Licrado",
  "Palazzo Cargo",
  "Mom Fit Rígido",
  "Semicampana",
  "Falda Prenses"
]);
const ALLOWED_OCCASIONS = new Set(["diario", "universidad", "cita", "noche", "viaje", "casual"]);
const ALLOWED_VIBES = new Set(["casual", "urbano", "elegante", "femenino", "comodo"]);

// Best-effort per-instance limit. Use a shared store (e.g. Vercel KV) for
// reliable rate limiting across serverless instances in production.
const requests = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 3;

function rateLimit(key) {
  const now = Date.now();
  const current = requests.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requests.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= MAX_REQUESTS) return false;
  current.count += 1;
  return true;
}

function cleanDetails(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "La generación de imágenes aún no está configurada. El administrador debe añadir OPENAI_API_KEY en Vercel."
    });
  }

  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : (forwarded || "unknown")).split(",")[0].trim();
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: "Has solicitado varias imágenes seguidas. Espera un minuto e inténtalo de nuevo." });
  }

  const body = req.body || {};
  const { garment, occasion, vibe } = body;
  if (!ALLOWED_GARMENTS.has(garment) || !ALLOWED_OCCASIONS.has(occasion) || !ALLOWED_VIBES.has(vibe)) {
    return res.status(400).json({ error: "Selecciona una prenda, ocasión y estilo válidos." });
  }

  const occasionNames = {
    diario: "día a día", universidad: "universidad o trabajo", cita: "cita o salida especial",
    noche: "plan de noche", viaje: "viaje o paseo", casual: "plan casual"
  };
  const vibeNames = {
    casual: "casual", urbano: "urbano", elegante: "elegante",
    femenino: "femenino", comodo: "cómodo"
  };
  const garmentNames = garment === "Quiero ver ideas con todas"
    ? "una prenda de denim inspirada en la colección Agua y Rosa: Skinny, Palazzo Licrado, Palazzo Cargo, Mom Fit Rígido, Semicampana o Falda Prenses"
    : garment;

  const details = cleanDetails(body.details);
  const prompt = [
    "Create a polished, photorealistic fashion editorial outfit inspiration image for a Colombian women's denim fashion brand.",
    "Show one adult woman model, full body, in a tasteful contemporary studio or lifestyle setting.",
    "The main garment should be: " + garmentNames + ".",
    "Occasion: " + occasionNames[occasion] + ".",
    "Styling mood: " + vibeNames[vibe] + ".",
    "Style the denim with coordinated top, shoes and accessories. Keep the clothing tasteful, wearable and realistic.",
    "Soft flattering lighting, refined fashion-campaign composition, natural anatomy, realistic fabric texture, no text, no logos, no watermark.",
    "This is an illustrative styling concept, not an exact reproduction of an existing catalog SKU.",
    details ? "Additional styling preference: " + details + "." : ""
  ].filter(Boolean).join(" ");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    let upstream;
    try {
      upstream = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-image-2.5-flare",
          prompt,
          size: "1024x1536",
          quality: "medium",
          output_format: "webp",
          output_compression: 85,
          n: 1
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("OpenAI image API error:", upstream.status, result.error?.type || "unknown");
      if (upstream.status === 401) return res.status(502).json({ error: "La clave de OpenAI no es válida. Revisa la configuración del servidor." });
      if (upstream.status === 429) return res.status(503).json({ error: "El servicio de imágenes está ocupado o alcanzó su límite. Inténtalo más tarde." });
      return res.status(502).json({ error: "El servicio de imágenes no pudo completar la solicitud." });
    }

    const image = result.data?.[0]?.b64_json;
    if (!image) return res.status(502).json({ error: "El servicio no devolvió una imagen." });
    return res.status(200).json({ image, format: "webp" });
  } catch (error) {
    console.error("Image generation failed:", error.name || "Error");
    return res.status(502).json({
      error: error.name === "AbortError"
        ? "La generación tardó demasiado. Inténtalo nuevamente."
        : "No fue posible conectar con el servicio de imágenes."
    });
  }
}

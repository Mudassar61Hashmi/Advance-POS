import { Router } from "express";

const router = Router();

/**
 * POST /api/ai/brand-theme
 * Body: { brandName: string, primaryColor?: string }
 * Returns: { accent, accentSoft, accentAlt, description }
 *
 * Uses the Gemini REST API directly (no @google/generative-ai package required).
 */
router.post("/brand-theme", async (req, res) => {
  const { brandName, primaryColor } = req.body;

  if (!brandName || typeof brandName !== "string" || !brandName.trim()) {
    return res.status(400).json({ message: "brandName is required." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: "GEMINI_API_KEY is not configured on the server." });
  }

  const colorHint = primaryColor
    ? `and a primary color '${primaryColor}'`
    : "without a specific primary color";

  const prompt =
    `You are a brand design expert. Given the brand name '${brandName.trim()}' ` +
    `${colorHint}, suggest 3 hex color values for a POS system theme: ` +
    `accent (primary CTA color), accentSoft (secondary/lighter variant), and ` +
    `accentAlt (tertiary/complementary color). ` +
    `Respond ONLY with valid JSON: { "accent": "#hexcolor", "accentSoft": "#hexcolor", "accentAlt": "#hexcolor", "description": "brief description of the palette" }`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 256,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[ai/brand-theme] Gemini API error:", geminiRes.status, errText);
      return res.status(502).json({ message: "Gemini API returned an error.", detail: errText });
    }

    const geminiData = await geminiRes.json();

    // Extract the text from the first candidate
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Strip markdown code fences if present (```json ... ```)
    const jsonText = rawText.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

    let palette;
    try {
      palette = JSON.parse(jsonText);
    } catch {
      console.error("[ai/brand-theme] Failed to parse Gemini response as JSON:", rawText);
      return res.status(500).json({
        message: "Gemini returned a non-JSON response.",
        raw: rawText,
      });
    }

    // Validate expected keys are present
    const required = ["accent", "accentSoft", "accentAlt", "description"];
    const missing = required.filter((k) => !(k in palette));
    if (missing.length) {
      return res.status(500).json({
        message: `Gemini response missing expected keys: ${missing.join(", ")}`,
        raw: palette,
      });
    }

    return res.json(palette);
  } catch (err) {
    console.error("[ai/brand-theme] Unexpected error:", err);
    return res.status(500).json({ message: "Internal server error.", detail: err.message });
  }
});

/**
 * POST /api/ai/scan-product
 * Body: { imageBase64: string }  — full data-URL or raw base64
 * Returns: { name, category, barcode, estimatedPrice, description }
 *
 * Uses Gemini 1.5 Flash multimodal (vision) to identify the product.
 */
router.post("/scan-product", async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return res.status(400).json({ message: "imageBase64 is required." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: "GEMINI_API_KEY is not configured on the server." });
  }

  // Strip data-URL prefix and detect MIME type
  const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  const mimeType  = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

  const prompt =
    `You are a product recognition expert for a retail POS system. ` +
    `Analyze this product image carefully and extract product details.\n\n` +
    `Respond with ONLY a valid JSON object — no markdown, no code fences, no extra text:\n` +
    `{\n` +
    `  "name": "specific product name including brand and variant if visible",\n` +
    `  "category": "pick the best match from: Beverages, Dairy, Snacks, Bakery, Produce, Meat, Frozen, Electronics, Clothing, Health & Beauty, Household, Stationery, Toys, Sports, Other",\n` +
    `  "barcode": "barcode or UPC digits if clearly visible in the image, otherwise null",\n` +
    `  "estimatedPrice": 0.00,\n` +
    `  "description": "one concise sentence describing the product"\n` +
    `}\n\n` +
    `For estimatedPrice: replace 0.00 with a reasonable retail price number (e.g. 2.99). Use null if you truly cannot estimate.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt },
          ],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[ai/scan-product] Gemini API error:", geminiRes.status, errText);
      return res.status(502).json({ message: "Gemini API returned an error.", detail: errText });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonText = rawText.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

    let product;
    try {
      product = JSON.parse(jsonText);
    } catch {
      console.error("[ai/scan-product] Failed to parse Gemini response:", rawText);
      return res.status(500).json({ message: "AI returned a non-JSON response.", raw: rawText });
    }

    return res.json(product);
  } catch (err) {
    console.error("[ai/scan-product] Unexpected error:", err);
    return res.status(500).json({ message: "Internal server error.", detail: err.message });
  }
});

export default router;

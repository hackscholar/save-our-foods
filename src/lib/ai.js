import { GoogleGenerativeAI } from "@google/generative-ai";

const globalForAI = globalThis;
const DEFAULT_MODEL = "gemini-2.5-flash";

function ensureGeminiClient() {
  if (!globalForAI.__geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing required environment variable: GEMINI_API_KEY");
    }
    globalForAI.__geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return globalForAI.__geminiClient;
}

function sanitizeJsonText(text) {
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith("```")) {
      const content = trimmed.replace(/```(json)?/gi, "").trim();
      return content.replace(/```$/, "").trim();
    }
    return trimmed;
  } catch {
    return text;
  }
}

function parseModelResponse(text) {
  const cleaned = sanitizeJsonText(text);
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // fallthrough
  }
  return {};
}

async function downloadImageAsBase64(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { data: base64, mimeType: contentType };
}

export async function generateItemMetadataFromImage(imageUrl, options = {}) {
  if (!imageUrl) {
    throw new Error("imageUrl is required to generate AI metadata.");
  }

  const { dateOfPurchase } = options;
  const aiClient = ensureGeminiClient();
  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const model = aiClient.getGenerativeModel({ model: modelName });
  const { data, mimeType } = await downloadImageAsBase64(imageUrl);

  const purchaseContext = dateOfPurchase
    ? `\nDate of purchase: ${dateOfPurchase}. Estimate an expiry/best-before date based on typical shelf life relative to this purchase date.`
    : "";

  const prompt = `
You analyze grocery images. Return JSON like:
{
  "name": "string|null",
  "expiryDate": "YYYY-MM-DD|null",
  "confidence": 0-1,
  "notes": "string|null"
}
- Guess the item name (concise).
- Estimate expiry date only if label/date info exists; otherwise null.
- Do not invent impossible values.${purchaseContext}
  `.trim();

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { data, mimeType } },
        ],
      },
    ],
  });

  const response = await result.response;
  const text = response.text();
  const parsed = parseModelResponse(text);

  return {
    name: parsed.name ?? null,
    expiryDate: parsed.expiryDate ?? parsed.expiry_date ?? null,
    confidence: parsed.confidence ?? null,
    notes: parsed.notes ?? null,
    raw: parsed,
  };
}

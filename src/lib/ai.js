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
  "quantity": number|null,
  "confidence": 0-1,
  "notes": "string|null"
}
- Guess the item name (concise).
- Estimate how many whole items/servings are visible as an integer (or null if uncertain).
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
    quantity: parsed.quantity ?? null,
    confidence: parsed.confidence ?? null,
    notes: parsed.notes ?? null,
    raw: parsed,
  };
}

export async function generateIngredientsFromImage(imageUrl, options = {}) {
  if (!imageUrl) {
    throw new Error("imageUrl is required to infer ingredients.");
  }

  const aiClient = ensureGeminiClient();
  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const model = aiClient.getGenerativeModel({ model: modelName });
  const { data, mimeType } = await downloadImageAsBase64(imageUrl);

  const inventoryNames = Array.isArray(options?.inventoryNames) ? options.inventoryNames : [];
  const inventoryPrompt =
    inventoryNames.length > 0
      ? `\nOnly choose ingredient names from this list (if none match, respond with an empty array): ${inventoryNames.join(", ")}.`
      : "";

  const additionalNotes = options?.notes
    ? `\nAdditional context from user: ${options.notes}`
    : "";

  const prompt = `
You analyze photos of cooked dishes or grocery hauls.
Return JSON like:
{
  "ingredients": [
    { "name": "string", "quantity": "string|null" }
  ],
  "confidence": 0-1,
  "notes": "string|null"
}
- Only include ingredients you can reasonably infer.
- Provide human-friendly quantity estimates (e.g., "2 cups", "1 bunch") or null if unsure.
- List at most 12 ingredients, most visually obvious first.
- If uncertain, return an empty array and explain in notes.${inventoryPrompt}${additionalNotes}
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
  const parsed = parseModelResponse(response.text());
  const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];

  return {
    ingredients: ingredients.map((entry) => ({
      name: entry?.name ?? null,
      quantity: entry?.quantity ?? null,
    })),
    confidence: parsed.confidence ?? null,
    notes: parsed.notes ?? null,
    raw: parsed,
  };
}

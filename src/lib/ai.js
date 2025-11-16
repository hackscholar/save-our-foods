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

export async function generatePriceSuggestion({
  name,
  quantity,
  expiryDate,
  dateOfPurchase,
}) {
  if (!name) {
    throw new Error("Item name is required to estimate price.");
  }

  const aiClient = ensureGeminiClient();
  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const model = aiClient.getGenerativeModel({ model: modelName });

  const prompt = `
You estimate listing prices for pre-owned groceries/ingredients.
Return JSON:
{
  "price": number,
  "explanation": "string"
}
Input details:
- name: "${name}"
- quantity: "${quantity ?? "unknown"}"
- expiryDate: "${expiryDate ?? "unknown"}"
- dateOfPurchase: "${dateOfPurchase ?? "unknown"}"

Assume USD prices. Reference typical online prices, then discount for freshness and proximity to expiry.
Explain your reasoning briefly (include expiry impact or market comparison). If unsure, give best estimate.
  `.trim();

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  const parsed = parseModelResponse(result.response.text());
  if (parsed.price === undefined || parsed.price === null) {
    throw new Error("AI could not estimate a price.");
  }

  return {
    price: Number(parsed.price),
    explanation: parsed.explanation ?? "Estimated using comparable online prices and freshness.",
    raw: parsed,
  };
}

export async function generateRecipeFromInventory({ items = [], notes = null } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one pantry item is required to suggest a recipe.");
  }

  const aiClient = ensureGeminiClient();
  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const model = aiClient.getGenerativeModel({ model: modelName });

  const pantryLines = items
    .map((item, index) => {
      const qty = item.quantity ?? "unknown";
      const expiry = item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : "no-expiry";
      return `${index + 1}. ${item.name} — qty: ${qty}, expires: ${expiry}`;
    })
    .join("\n");

  const prompt = `
You curate recipe recommendations. Using the pantry items below (ordered by urgency), suggest **one existing online recipe** that uses as many of them as reasonable, prioritizing ingredients expiring soonest.
Pantry:
${pantryLines}
Extra notes: ${notes ?? "none"}.

Return strict JSON:
{
  "title": "string",
  "url": "https://recipe-link"
}
- Reply with only the recipe name and a publicly accessible recipe URL.
- If no perfect recipe exists, choose the best match; if absolutely nothing fits, set url to "https://www.saveourfoods.com/pantry-tips".
`.trim();

  const response = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  const parsed = parseModelResponse(response.response.text());
  return {
    title: parsed.title ?? "Pantry Inspiration",
    url: parsed.url ?? "https://www.saveourfoods.com/pantry-tips",
    raw: parsed,
  };
}

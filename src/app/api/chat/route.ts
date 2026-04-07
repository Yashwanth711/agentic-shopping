import { NextRequest, NextResponse } from "next/server";
import { products, Product } from "@/data/products";
import { searchProducts } from "@/lib/rag";

const GSHEET_WEBHOOK = "https://script.google.com/macros/s/AKfycbxd1mug0pGQJeeoNtrD_MIBE3x4oA3Gk4C2l9neZvfbC7yzaaKHesNZt-6-hKgYoHn2Cw/exec";

// Fire-and-forget log to Google Sheet
function logToSheet(sessionId: string, role: string, message: string, language: string, page: string = "homepage") {
  fetch(GSHEET_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, role, message, language, page }),
  }).catch(() => {});
}

// Category counts for inventory awareness
const CATEGORY_COUNTS = products.reduce((acc, p) => {
  acc[p.category] = (acc[p.category] || 0) + 1;
  return acc;
}, {} as Record<string, number>);
const INVENTORY_SUMMARY = Object.entries(CATEGORY_COUNTS).map(([c, n]) => `${c}: ${n}`).join(", ");

// === MODULAR SYSTEM PROMPT ===

const CORE_IDENTITY = `You are Saheli — a warm, respectful Indian clothing store salesperson. You have a name, a personality, and genuine care for every customer. You speak naturally like a real Indian shopkeeper — mixing English words the way Indians actually talk.

OUR STORE HAS: ${INVENTORY_SUMMARY} (Total: ${products.length} products)`;

const CONVERSATION_RULES = `CONVERSATION FLOW:
1. NEED CLARIFICATION: If user asks for a CATEGORY without occasion/budget → ask ONE question: "Koi occasion ke liye ya budget batayenge?" — then show products in the NEXT message
2. If user gives category + occasion OR budget → show 3-5 products immediately
3. If user gives category + occasion + budget → show products right away, no more questions
4. NEVER ask more than 1 clarifying question per message
5. NEVER refuse to show products after 2 exchanges — show your best picks
6. ASSISTED BROWSING: Start with "Thank you!", briefly describe what you're showing, end with "inme se koi pasand aaya?"
7. NUDGE: "Ye pasand aa rha ho toh order lagadu?"
8. CROSS-SELL: suggest ONE complementary item (blouse with saree)

HESITATION HANDLING — when customer says "expensive", "pata nahi", "soch ke batata hoon", "thoda mehnga hai":
Step 1 — Acknowledge: "Haan, samajh sakti hoon..."
Step 2 — Pick ONE based on situation:
  - Price doubt → "Lekin dekho, ₹X mein itne reviews — X log ne kharida isi occasion ke liye"
  - Quality doubt → Quote the product rating and a positive review snippet
  - Size doubt → State exact measurements if available ("shoulder X inch, length Y inch")
  - General hesitation → Mention return/exchange policy ONCE: "Agar pasand na aaye toh 7 days mein return kar sakte ho"
Step 3 — Offer alternative: "Ek aur option dikhaaun thoda alag budget mein?"
Never repeat the same hesitation tactic twice in one conversation.

RULES:
- ONLY recommend products from the MATCHING PRODUCTS list — never invent products
- Use EXACT names, prices, ratings — never make up facts
- If you don't know something, say "ye detail team se confirm karke batati hoon"
- Before showing products, briefly say what you understood from their request
- If customer seems unhappy → ALWAYS apologize first, then correct yourself
- If you don't have what they want → honestly say so and suggest a broader category`;

const VOICE_FORMAT_RULES = `VOICE RESPONSE FORMAT:
- Maximum 2-3 SHORT sentences per response when no products to show
- When showing products: name + price + one detail per product, then STOP
- No markdown, no bullet points, no bold, no asterisks — pure spoken language only
- End EVERY response with ONE question (not two, not zero)
- Use "..." for natural breath pauses in longer responses`;

const ANTI_PATTERNS = `NEVER DO:
- Never repeat a question the customer already answered
- Never show more than 5 products in one response
- Never use markdown formatting of any kind
- Never say "I'm an AI" or "As an AI assistant" — you are Saheli, period
- Never ask two questions in the same response
- Never re-suggest a product the customer already rejected`;

// Fixed opening greetings — hardcoded, never AI-generated
const OPENING_SCRIPTS: Record<string, string> = {
  default: "Namaste! Main Saheli hoon... aap mujhse apni bhasha mein baat karke shopping kar sakte hain. Aaj kya dekhna chahenge?",
  pdp: "Namaste! Main Saheli hoon... kya aapko ye product pasand aaya? Koi doubt hai ya kuch aur dikhaaun?",
  inactive: "Kuch dhundh rahe hain kya? Main madad kar sakti hoon.",
};

// Build system prompt dynamically per call
function buildSystemPrompt(gender: string | null, langName: string): string {
  const genderLine = gender === "female" ? "Always address customer as 'Madam'."
    : gender === "male" ? "Always address customer as 'Sir'."
    : "Use gender-neutral language. Once gender is clear from conversation, use Sir or Madam consistently.";

  return [
    CORE_IDENTITY,
    genderLine,
    CONVERSATION_RULES,
    VOICE_FORMAT_RULES,
    ANTI_PATTERNS,
    `RESPOND IN: ${langName} only`,
  ].join("\n\n");
}

const LANG_NAMES: Record<string, string> = {
  hi: "Hindi", te: "Telugu", ta: "Tamil", kn: "Kannada", ml: "Malayalam",
  bn: "Bengali", mr: "Marathi", gu: "Gujarati", pa: "Punjabi", or: "Odia", ur: "Urdu",
};

function detectLanguage(text: string): string | null {
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn";
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml";
  if (/[\u0980-\u09FF]/.test(text)) return "bn";
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa";
  if (/[\u0B00-\u0B7F]/.test(text)) return "or";
  if (/[\u0600-\u06FF]/.test(text)) return "ur";
  return null;
}

// Legacy keyword search — kept for demo fallback only
function findRelevantProducts(message: string, lang: string): Product[] {
  const msg = message.toLowerCase();
  let results: Product[] = [];

  // Category keywords (English + Indian languages)
  const categoryMap: Record<string, string> = {
    saree: "Sarees", sarees: "Sarees", "साड़ी": "Sarees", "సారీ": "Sarees", "சேலை": "Sarees", "చీర": "Sarees", "పట్టు": "Sarees", "ಸೀರೆ": "Sarees", "സാരി": "Sarees", "শাড়ি": "Sarees",
    kurti: "Kurtis", kurtis: "Kurtis", kurta: "Kurtis", "कुर्ती": "Kurtis", "కుర్తీ": "Kurtis", "குர்தா": "Kurtis",
    jewelry: "Jewelry", jewellery: "Jewelry", "गहने": "Jewelry", "ज्वेलरी": "Jewelry", "నగలు": "Jewelry", "நகை": "Jewelry",
    kids: "Kids", children: "Kids", "बच्चे": "Kids", "పిల్లలు": "Kids", "குழந்தை": "Kids", pillala: "Kids", bacche: "Kids", bachche: "Kids",
    men: "Men", shirt: "Men", shirts: "Men", "शर्ट": "Men", "షర్ట్": "Men",
  };

  // Occasion keywords
  const occasionMap: Record<string, string> = {
    wedding: "Wedding", "शादी": "Wedding", "विवाह": "Wedding", kalyanam: "Wedding", "పెళ్లి": "Wedding",
    festival: "Festival", "त्योहार": "Festival", "पूजा": "Puja", puja: "Puja", diwali: "Festival",
    daily: "Daily Wear", casual: "Casual", office: "Office", "रोज़": "Daily Wear", "रोजाना": "Daily Wear",
    party: "Party",
  };

  // Fabric keywords
  const fabricMap: Record<string, string> = {
    silk: "Silk", "सिल्क": "Silk", "பட்டு": "Silk", "పట్టు": "Silk",
    cotton: "Cotton", "कॉटन": "Cotton", "सूती": "Cotton",
    chiffon: "Chiffon", georgette: "Georgette", linen: "Linen",
    banarasi: "Banarasi Silk", kanjivaram: "Cotton Silk", kundan: "Kundan",
  };

  // Color keywords
  const colorMap: Record<string, string> = {
    red: "Red", "लाल": "Red", blue: "Blue", "नीला": "Blue", green: "Green", "हरा": "Green",
    pink: "Pink", "गुलाबी": "Pink", black: "Black", "काला": "Black", white: "White", "सफेद": "White",
    yellow: "Yellow", "पीला": "Yellow", gold: "Gold", "सोना": "Gold",
  };

  // Extract filters from message
  let categoryFilter: string | null = null;
  let occasionFilter: string | null = null;
  let fabricFilter: string | null = null;
  let colorFilter: string | null = null;
  let maxPrice: number | null = null;

  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (msg.includes(keyword)) { categoryFilter = category; break; }
  }
  for (const [keyword, occasion] of Object.entries(occasionMap)) {
    if (msg.includes(keyword)) { occasionFilter = occasion; break; }
  }
  for (const [keyword, fabric] of Object.entries(fabricMap)) {
    if (msg.includes(keyword)) { fabricFilter = fabric; break; }
  }
  for (const [keyword, color] of Object.entries(colorMap)) {
    if (msg.includes(keyword)) { colorFilter = color; break; }
  }

  // Extract price from message — supports English, Hindi, Telugu, Tamil, and other Indian languages
  let minPrice: number | null = null;
  // Price range: "300 to 500", "300 se 500", "300 నుండి 500", "300 முதல் 500"
  const rangeMatch = msg.match(/(\d[\d,]*)\s*(?:to|se|से|నుండి|முதல்|থেকে|ಇಂದ|മുതൽ|-)\s*(\d[\d,]*)/i);
  if (rangeMatch) {
    minPrice = parseInt(rangeMatch[1].replace(/,/g, ""));
    maxPrice = parseInt(rangeMatch[2].replace(/,/g, ""));
  } else {
    // Single price: "under 5000", "₹500 లోపల", "500 के अंदर"
    const priceMatch = msg.match(/(?:under|below|less than|within|budget|₹|rs\.?|rupee)\s*(\d[\d,]*)/i)
      || msg.match(/(\d[\d,]*)\s*(?:ke andar|tak|se kam|के अंदर|तक|से कम|లోపల|లోపు|கீழ்|এর নিচে|ಒಳಗೆ|താഴെ)/i);
    if (priceMatch) {
      maxPrice = parseInt(priceMatch[1].replace(/,/g, ""));
    }
  }

  // Filter products
  results = products.filter(p => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (occasionFilter && !p.occasion.includes(occasionFilter)) return false;
    if (fabricFilter && !p.fabric.toLowerCase().includes(fabricFilter.toLowerCase())) return false;
    if (colorFilter && p.color !== colorFilter) return false;
    if (minPrice && p.price < minPrice) return false;
    if (maxPrice && p.price > maxPrice) return false;
    return true;
  });

  // If no filters matched, try bestsellers
  if (results.length === 0 && (msg.includes("best") || msg.includes("popular") || msg.includes("bestseller"))) {
    results = products.filter(p => p.tags.includes("Bestseller"));
  }

  // If still nothing, return top-rated from the detected region
  if (results.length === 0) {
    if (lang === "ta") results = products.filter(p => p.tags.includes("Kanjivaram"));
    else if (lang === "gu") results = products.filter(p => p.tags.includes("Bandhani"));
    else if (lang === "mr") results = products.filter(p => p.tags.includes("Woven"));
    else if (lang === "bn") results = products.filter(p => p.fabric === "Cotton" && p.category === "Sarees");
    else results = products.filter(p => p.tags.includes("Bestseller") || p.reviewCount > 200);
  }

  // Sort by rating and return top 8
  return results.sort((a, b) => b.rating - a.rating).slice(0, 8);
}

// Format products for the AI prompt
function formatProductsForPrompt(prods: Product[]): string {
  // Always tell AI about total inventory
  const categoryCounts = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const inventory = `\n\nOUR STORE INVENTORY: ${Object.entries(categoryCounts).map(([c, n]) => `${c}: ${n} items`).join(", ")}. Total: ${products.length} products.`;

  if (prods.length === 0) return inventory + "\nNo specific matches found for this query — ask the customer to clarify.";
  return inventory + `\n\nTOP MATCHES (showing ${prods.length} of ${products.filter(p => p.category === prods[0].category).length} in this category):\n${prods.map((p, i) =>
    `${i + 1}. ${p.name} — ₹${p.price.toLocaleString()} (${p.discount}% off) | ${p.color} | ${p.fabric} | ★${p.rating} (${p.reviewCount} reviews) | ${p.inventory > 0 ? p.inventory + " left" : "Out of stock"}`
  ).join("\n")}`;
}

// Extract product IDs from AI response by matching product names
function extractProductIds(text: string): string[] {
  const ids: string[] = [];
  for (const p of products) {
    if (text.includes(p.name) || text.includes(p.id)) {
      ids.push(p.id);
    }
  }
  return ids.slice(0, 8);
}

export async function POST(req: NextRequest) {
  try {
    const { messages, language, sessionId, inputMode, currentPage, currentProductId, triggerType } = await req.json();

    // Log user message to Google Sheet
    const sid = sessionId || "unknown";
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg?.role === "user") {
      const modeTag = inputMode === "voice" ? "[VOICE] " : "";
      logToSheet(sid, "user", modeTag + lastUserMsg.content, language || "en");
    }

    // Flag-based provider: gemini | anthropic | deepseek | demo
    const provider = process.env.AI_PROVIDER || "demo";
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    const rawMsg = messages[messages.length - 1]?.content || "";
    const scriptLang = detectLanguage(rawMsg);
    // If user selected a language in the picker, prefer that over script detection
    // Script detection only overrides picker if the text is clearly in a different script
    const detectedLang = scriptLang || language || "en";
    // If picker is set to a non-English Indian language and script detection found a different
    // Indian language, trust the picker (user may be typing transliterated text)
    const finalLang = (language && language !== "en" && scriptLang && scriptLang !== language)
      ? language  // Trust the picker
      : detectedLang;
    const langName = LANG_NAMES[finalLang] || "English";

    // Fixed greeting for first message — skip AI call entirely
    const isFirstMessage = messages.length === 1 && messages[0]?.role === "user" &&
      (messages[0].content.toLowerCase().includes("hi") || messages[0].content.toLowerCase().includes("hello") ||
       messages[0].content.toLowerCase().includes("namaste") || messages[0].content.length < 20);
    if (isFirstMessage) {
      // Context-aware greeting based on page type
      let greeting = OPENING_SCRIPTS.default;
      const showProducts: string[] = [];
      if (currentPage === "pdp" && currentProductId) {
        const product = products.find(p => p.id === currentProductId);
        greeting = product
          ? `Namaste! Main Saheli hoon... kya aapko ${product.name} pasand aaya? Koi doubt hai quality, size ya fit ke baare mein? Ya aur options dikhaaun?`
          : OPENING_SCRIPTS.pdp;
        if (currentProductId) showProducts.push(currentProductId);
      } else if (triggerType === "self-triggered") {
        greeting = OPENING_SCRIPTS.inactive;
      }
      logToSheet(sid, "assistant", greeting, finalLang, currentPage || "homepage");
      return NextResponse.json({
        reply: greeting,
        emotion: "greeting",
        productsToShow: showProducts,
        detectedLanguage: finalLang,
      });
    }

    // Build page context for AI
    let pageContext = "";
    if (currentPage === "pdp" && currentProductId) {
      const product = products.find(p => p.id === currentProductId);
      if (product) {
        const topReview = product.reviews?.find(r => r.rating >= 4);
        pageContext = `\n\n[CONTEXT: Customer is viewing ${product.name} — ₹${product.price} (${product.discount}% off, MRP ₹${product.mrp}) | ${product.color} ${product.fabric} | ★${product.rating} (${product.reviewCount} reviews) | ${product.inventory} in stock`;
        if (topReview) pageContext += ` | Top review: "${topReview.text}"`;
        pageContext += `]`;
      }
    }

    // RAG: Search for relevant products based on user message
    let ragProducts = "";
    const activeKey = geminiKey || anthropicKey || "";
    if (activeKey && rawMsg.length > 2) {
      try {
        const relevant = await searchProducts(rawMsg, activeKey, 8);
        if (relevant.length > 0) {
          ragProducts = `\n\nMATCHING PRODUCTS FROM OUR STORE (recommend from these):\n${relevant.map((p, i) => {
            const topReview = p.reviews?.find(r => r.rating >= 4);
            let line = `${i + 1}. ${p.name} | ${p.category} | ₹${p.price} (${p.discount}% off, MRP ₹${p.mrp}) | ${p.color} | ${p.fabric} | ★${p.rating}(${p.reviewCount}) | ${p.occasion.join("/")} | ${p.inventory} left`;
            if (topReview) line += ` | Review: "${topReview.text}"`;
            return line;
          }).join("\n")}`;
        }
      } catch (e) {
        console.warn("RAG search failed, continuing without:", e);
      }
    }

    // Combine page context with RAG products
    ragProducts = pageContext + ragProducts;

    // Route to selected provider, fallback to demo on any error
    let response: NextResponse;
    if (provider === "gemini" && geminiKey) {
      response = await handleGemini(messages, geminiKey, finalLang, langName, ragProducts);
    } else if (provider === "anthropic" && anthropicKey) {
      response = await handleAnthropic(messages, anthropicKey, finalLang, langName, ragProducts);
    } else if (provider === "deepseek" && deepseekKey) {
      response = await handleDeepSeek(messages, deepseekKey, finalLang, langName, ragProducts);
    } else {
      response = NextResponse.json(getDemoResponse(messages, finalLang));
    }

    // Log assistant response to Google Sheet
    try {
      const body = await response.clone().json();
      if (body.reply) {
        logToSheet(sid, "assistant", body.reply, finalLang);
      }
    } catch { /* ignore logging errors */ }

    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({
      reply: "I'm sorry, I'm having trouble right now. Could you try again?",
      emotion: "empathetic",
      productsToShow: [],
    });
  }
}

async function handleAnthropic(
  messages: { role: string; content: string }[],
  apiKey: string,
  detectedLang: string,
  langName: string,
  ragProducts: string = "",
) {
  const langInstruction = detectedLang !== "en"
    ? `\n\nCRITICAL: Respond ENTIRELY in ${langName}. NOT Hindi, NOT English — only ${langName}.`
    : "";

  const augmentedMessages = messages.map((m: { role: string; content: string }, i: number) => {
    if (i === messages.length - 1 && m.role === "user") {
      let extra = ragProducts;
      if (detectedLang !== "en") extra += `\n[Respond in ${langName} only]`;
      return { role: m.role, content: m.content + extra };
    }
    return { role: m.role, content: m.content };
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: buildSystemPrompt(null, langName),
      messages: augmentedMessages,
    }),
  });

  const data = await response.json();
  if (data.error) {
    console.error("Anthropic API error:", JSON.stringify(data.error));
    return NextResponse.json(getDemoResponse(messages, detectedLang));
  }

  const text = data.content?.[0]?.text || "";

  // Try to parse JSON response from Claude
  let reply = text;
  let emotion = "happy";
  try {
    const jsonMatch = text.match(/\{[\s\S]*"reply"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      reply = parsed.reply || text;
      emotion = parsed.emotion || "happy";
    }
  } catch { /* JSON parse failed, use raw text */ }

  return NextResponse.json({
    reply,
    emotion,
    productsToShow: extractProductIds(reply),
    detectedLanguage: detectedLang,
  });
}

// DeepSeek / Agent Router handler (OpenAI-compatible API)
async function handleDeepSeek(
  messages: { role: string; content: string }[],
  apiKey: string,
  detectedLang: string,
  langName: string,
  ragProducts: string = "",
) {
  const langInstruction = detectedLang !== "en"
    ? `\n\nCRITICAL: Respond ENTIRELY in ${langName}.`
    : "";

  const augmentedMessages = [
    { role: "system", content: buildSystemPrompt(null, langName) },
    ...messages.map((m: { role: string; content: string }, i: number) => {
      if (i === messages.length - 1 && m.role === "user" && ragProducts) {
        return { role: m.role, content: m.content + ragProducts };
      }
      return { role: m.role, content: m.content };
    }),
  ];

  // Agent Router API (OpenAI-compatible)
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://router.agentrouter.org/v1";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v3.2";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: augmentedMessages,
    }),
  });

  const data = await response.json();
  if (data.error) {
    console.error("DeepSeek API error:", JSON.stringify(data.error));
    return NextResponse.json(getDemoResponse(messages, detectedLang));
  }

  const text = data.choices?.[0]?.message?.content || "";

  let reply = text;
  let emotion = "happy";
  try {
    const jsonMatch = text.match(/\{[\s\S]*"reply"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      reply = parsed.reply || text;
      emotion = parsed.emotion || "happy";
    }
  } catch { /* JSON parse failed */ }

  return NextResponse.json({
    reply,
    emotion,
    productsToShow: extractProductIds(reply),
    detectedLanguage: detectedLang,
  });
}

// Gemini handler — FREE tier (15 req/min)
async function handleGemini(
  messages: { role: string; content: string }[],
  apiKey: string,
  detectedLang: string,
  langName: string,
  ragProducts: string = "",
) {
  const langInstruction = detectedLang !== "en"
    ? ` CRITICAL: Respond ENTIRELY in ${langName}. NOT English, NOT Hindi — only ${langName}.`
    : "";

  // Build Gemini messages — system prompt as first user turn, then conversation
  const geminiContents: { role: string; parts: { text: string }[] }[] = [
    { role: "user", parts: [{ text: buildSystemPrompt(null, langName) + "\n\nSay OK." }] },
    { role: "model", parts: [{ text: "OK" }] },
  ];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const role = m.role === "assistant" ? "model" : "user";
    let text = m.content;
    if (i === messages.length - 1 && m.role === "user") {
      text += ragProducts;
      if (detectedLang !== "en") text += `\n[Respond in ${langName} only]`;
    }
    geminiContents.push({ role, parts: [{ text }] });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: { maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );

  const data = await response.json();
  if (data.error) {
    console.error("Gemini API error:", JSON.stringify(data.error));
    return NextResponse.json(getDemoResponse(messages, detectedLang));
  }

  // Gemini 2.5 Flash may include "thought" parts — extract the actual text part
  const parts = data.candidates?.[0]?.content?.parts || [];
  const textPart = parts.find((p: { text?: string; thought?: boolean }) => !p.thought && p.text);
  let text = (textPart?.text || parts[parts.length - 1]?.text || "").trim();
  // Remove "OK." or "OK," prefix from the response (artifact of system prompt injection)
  text = text.replace(/^OK[.,!]?\s*/i, "").trim();

  if (!text) {
    console.error("Gemini returned empty response:", JSON.stringify(data).slice(0, 500));
    return NextResponse.json(getDemoResponse(messages, detectedLang));
  }

  return NextResponse.json({
    reply: text,
    emotion: "happy",
    productsToShow: extractProductIds(text),
    detectedLanguage: detectedLang,
  });
}

function getDemoResponse(messages: { role: string; content: string }[], language: string): { reply: string; emotion: string; productsToShow: string[]; detectedLanguage?: string } {
  const detectedLang = language || "en";

  // Demo mode follows same conversation flow — ask occasion + budget, no product dumps
  const responses: Record<string, string> = {
    en: "I'd love to help you find the perfect outfit! Could you tell me:\n\n1. What's the occasion? (wedding, festival, daily wear, party?)\n2. What's your budget range?\n\nThis will help me show you the best options!",
    hi: "Namaste! Mein aapki madad karna chahungi. Bataiye:\n\n1. Kaunsa occasion hai? (shaadi, tyohaar, daily wear, party?)\n2. Budget range kya hai?\n\nFir mein aapko sahi options dikha sakti hoon!",
    te: "నమస్కారం! మీకు సహాయం చేయాలనుకుంటున్నాను. దయచేసి చెప్పండి:\n\n1. ఏ సందర్భం కోసం? (పెళ్లి, పండగ, రోజువారీ, పార్టీ?)\n2. మీ బడ్జెట్ ఎంత?\n\nఅప్పుడు మీకు సరైన ఎంపికలు చూపిస్తాను!",
    ta: "வணக்கம்! உங்களுக்கு உதவ விரும்புகிறேன். சொல்லுங்க:\n\n1. என்ன occasion? (கல்யாணம், பண்டிகை, daily wear, party?)\n2. Budget range என்ன?\n\nசரியான options காட்றேன்!",
  };

  return {
    reply: responses[detectedLang] || responses.en,
    emotion: "greeting",
    productsToShow: [],
    detectedLanguage: detectedLang,
  };
}


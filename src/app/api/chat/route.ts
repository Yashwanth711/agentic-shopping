import { NextRequest, NextResponse } from "next/server";
import { products, Product } from "@/data/products";

// Build compact product catalog for AI — one line per product, ~3KB total
const PRODUCT_CATALOG = products.map(p =>
  `${p.id}|${p.name}|${p.category}|₹${p.price}|${p.color}|${p.fabric}|${p.tags[0]}|★${p.rating}(${p.reviewCount})|${p.occasion.join("/")}|${p.inventory}left`
).join("\n");

const SYSTEM_PROMPT = `You are Priya, a warm Indian shopping assistant at Sundari Silks.

PERSONALITY: Warm, patient, honest — like a trusted Indian family shopkeeper. Speak the customer's language.

PRODUCT CATALOG (${products.length} products):
${PRODUCT_CATALOG}

CRITICAL RULES:
- NEVER make up facts about the store (age, location, policies, return policy, etc.)
- ONLY state what you know from the product catalog below
- If asked something you don't know, say "I'm not sure about that, let me check with the team"

HOW TO RECOMMEND:
- Pick 3-5 BEST matching products from the catalog above based on what the customer asks
- Use EXACT names, prices, ratings from the catalog — never make up products
- Understand context: "blue" after "saree" means blue sarees, "kids" means switch to kids category
- Be honest about stock and ratings
- Keep responses concise (2-3 short paragraphs max)
- Always end with a follow-up question
- Respond in the customer's language

RESPONSE FORMAT:
- Before recommending products, briefly tell the customer what you understood from their request in a natural way. Example: "I'm looking for blue silk sarees under ₹500 for you" or "పిల్లల పార్టీ డ్రెస్సులు చూస్తున్నాను" — so they know what filters you applied
- Then your natural conversational response mentioning products by their exact names with **bold** formatting
- End with a follow-up question`;

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

// Smart product search — finds relevant products based on user message
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
    const { messages, language } = await req.json();

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

    // Route to selected provider, fallback to demo on any error
    if (provider === "gemini" && geminiKey) {
      return await handleGemini(messages, geminiKey, finalLang, langName);
    } else if (provider === "anthropic" && anthropicKey) {
      return await handleAnthropic(messages, anthropicKey, finalLang, langName);
    } else if (provider === "deepseek" && deepseekKey) {
      return await handleDeepSeek(messages, deepseekKey, finalLang, langName);
    }
    return NextResponse.json(getDemoResponse(messages, finalLang));
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
) {
  const langInstruction = detectedLang !== "en"
    ? `\n\nCRITICAL: Respond ENTIRELY in ${langName}. NOT Hindi, NOT English — only ${langName}.`
    : "";

  const augmentedMessages = messages.map((m: { role: string; content: string }, i: number) => {
    if (i === messages.length - 1 && m.role === "user" && detectedLang !== "en") {
      return { role: m.role, content: m.content + `\n[Respond in ${langName} only]` };
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
      system: SYSTEM_PROMPT + langInstruction,
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
) {
  const langInstruction = detectedLang !== "en"
    ? `\n\nCRITICAL: Respond ENTIRELY in ${langName}.`
    : "";

  const augmentedMessages = [
    { role: "system", content: SYSTEM_PROMPT + langInstruction },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role, content: m.content,
    })),
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
) {
  const langInstruction = detectedLang !== "en"
    ? ` CRITICAL: Respond ENTIRELY in ${langName}. NOT English, NOT Hindi — only ${langName}.`
    : "";

  // Build Gemini messages — system prompt as first user turn, then conversation
  const geminiContents: { role: string; parts: { text: string }[] }[] = [
    { role: "user", parts: [{ text: SYSTEM_PROMPT + langInstruction + "\n\nAcknowledge briefly." }] },
    { role: "model", parts: [{ text: "Ready to help!" }] },
  ];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const role = m.role === "assistant" ? "model" : "user";
    let text = m.content;
    if (i === messages.length - 1 && m.role === "user" && detectedLang !== "en") {
      text += `\n[Respond in ${langName} only]`;
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
  const rawMsg = messages[messages.length - 1]?.content || "";
  // Trust the passed language (from picker) — don't re-detect from script
  const detectedLang = language || detectLanguage(rawMsg) || "en";

  // Find relevant products
  const relevant = findRelevantProducts(rawMsg, detectedLang);

  const greetings: Record<string, { hello: string; help: string; occasion: string; budget: string }> = {
    hi: { hello: "नमस्ते", help: "मैं आपकी मदद करना चाहूंगी", occasion: "आप किस अवसर के लिए खरीदारी कर रहे हैं? (शादी, त्योहार, रोज़ का?)", budget: "आपका बजट क्या है?" },
    gu: { hello: "નમસ્તે", help: "હું તમને મદદ કરવા માંગુ છું", occasion: "તમે કયા પ્રસંગ માટે ખરીદી કરો છો? (લગ્ન, તહેવાર, રોજિંદા?)", budget: "તમારું બજેટ શું છે?" },
    te: { hello: "నమస్కారం", help: "నేను మీకు సహాయం చేయాలనుకుంటున్నాను", occasion: "మీరు ఏ సందర్భం కోసం షాపింగ్ చేస్తున్నారు?", budget: "మీ బడ్జెట్ ఎంత?" },
    ta: { hello: "வணக்கம்", help: "நான் உங்களுக்கு உதவ விரும்புகிறேன்", occasion: "நீங்கள் எந்த நிகழ்விற்காக ஷாப்பிங் செய்கிறீர்கள்?", budget: "உங்கள் பட்ஜெட் என்ன?" },
    kn: { hello: "ನಮಸ್ಕಾರ", help: "ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ಬಯಸುತ್ತೇನೆ", occasion: "ನೀವು ಯಾವ ಸಂದರ್ಭಕ್ಕಾಗಿ ಶಾಪಿಂಗ್ ಮಾಡುತ್ತಿದ್ದೀರಿ?", budget: "ನಿಮ್ಮ ಬಜೆಟ್ ಎಷ್ಟು?" },
    ml: { hello: "നമസ്കാരം", help: "ഞാൻ നിങ്ങളെ സഹായിക്കാൻ ആഗ്രഹിക്കുന്നു", occasion: "ഏത് അവസരത്തിനാണ് ഷോപ്പിംഗ്?", budget: "നിങ്ങളുടെ ബജറ്റ് എത്ര?" },
    bn: { hello: "নমস্কার", help: "আমি আপনাকে সাহায্য করতে চাই", occasion: "আপনি কোন উপলক্ষে কেনাকাটা করছেন?", budget: "আপনার বাজেট কত?" },
    mr: { hello: "नमस्कार", help: "मला तुम्हाला मदत करायला आवडेल", occasion: "तुम्ही कोणत्या प्रसंगासाठी खरेदी करत आहात?", budget: "तुमचे बजेट काय आहे?" },
    pa: { hello: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", help: "ਮੈਂ ਤੁਹਾਡੀ ਮਦਦ ਕਰਨਾ ਚਾਹੁੰਦੀ ਹਾਂ", occasion: "ਤੁਸੀਂ ਕਿਸ ਮੌਕੇ ਲਈ ਖਰੀਦਦਾਰੀ ਕਰ ਰਹੇ ਹੋ?", budget: "ਤੁਹਾਡਾ ਬਜਟ ਕੀ ਹੈ?" },
    or: { hello: "ନମସ୍କାର", help: "ମୁଁ ଆପଣଙ୍କୁ ସାହାଯ୍ୟ କରିବାକୁ ଚାହେଁ", occasion: "ଆପଣ କେଉଁ ଉତ୍ସବ ପାଇଁ ଖରୀଦ କରୁଛନ୍ତି?", budget: "ଆପଣଙ୍କ ବଜେଟ କେତେ?" },
    ur: { hello: "آداب", help: "میں آپ کی مدد کرنا چاہتی ہوں", occasion: "آپ کس موقع کے لیے خریداری کر رہے ہیں؟", budget: "آپ کا بجٹ کیا ہے؟" },
  };

  // If non-English, respond in that language with products
  if (detectedLang !== "en" && greetings[detectedLang]) {
    const g = greetings[detectedLang];
    const prods = relevant.length > 0 ? relevant : products.sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 3);
    return {
      reply: `${g.hello}! ${g.help}.\n\n${prods.map((p, i) => `${i + 1}. **${p.name}** — ₹${p.price.toLocaleString()} (★${p.rating}, ${p.reviewCount} reviews)\n   ${p.color} | ${p.fabric} | ${p.tags[0]}`).join("\n\n")}\n\n${g.occasion}`,
      emotion: "greeting",
      productsToShow: prods.map(p => p.id),
      detectedLanguage: detectedLang,
    };
  }

  // English — use smart product search
  if (relevant.length > 0) {
    return {
      reply: `Great choice! Here are some options I found for you:\n\n${relevant.slice(0, 5).map((p, i) => `${i + 1}. **${p.name}** — ₹${p.price.toLocaleString()} (★${p.rating}, ${p.reviewCount} reviews)\n   ${p.color} ${p.fabric} | ${p.tags[0]} | ${p.occasion.join(", ")}\n   ${p.inventory > 0 ? `${p.inventory} left` : "Out of stock"} | ${p.discount}% off`).join("\n\n")}\n\nWould you like to see any of these in detail? I can also help with different options!`,
      emotion: "excited",
      productsToShow: relevant.slice(0, 5).map(p => p.id),
      detectedLanguage: detectedLang,
    };
  }

  // Default
  return {
    reply: "I'd love to help you find the perfect product!\n\nCould you tell me:\n1. What are you looking for? (saree, kurti, jewelry, kids, men's shirts?)\n2. What's the occasion? (wedding, festival, daily wear?)\n3. Any preference? (color, fabric, budget?)\n\nOr just browse our categories above and I'll guide you!",
    emotion: "patient",
    productsToShow: [],
    detectedLanguage: detectedLang,
  };
}

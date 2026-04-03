import { NextRequest, NextResponse } from "next/server";
import { products } from "@/data/products";

// For MVP: Use a simple prompt-based approach
// Replace with Anthropic SDK when you have an API key
const SYSTEM_PROMPT = `You are Priya, a warm and knowledgeable saree shopping assistant at Sundari Silks.

PERSONALITY:
- You are like a trusted family shopkeeper — warm, patient, honest
- You speak the customer's language (auto-detect and respond in same language)
- You never lie about products, reviews, or stock
- You remember the conversation context
- You understand Indian occasions, traditions, and regional saree preferences

CONVERSATION FLOW:
1. Greet warmly, ask about occasion
2. Understand budget, fabric preference, style
3. Show 3-5 curated options (not 50)
4. Compare honestly — share both pros and cons
5. Suggest complementary items if appropriate
6. Handle objections with empathy and alternatives

PRODUCT KNOWLEDGE:
You have access to ${products.length} sarees across these categories:
${[...new Set(products.map(p => p.tags[0]))].join(", ")}

Price range: ₹${Math.min(...products.map(p => p.price)).toLocaleString()} to ₹${Math.max(...products.map(p => p.price)).toLocaleString()}
Fabrics: ${[...new Set(products.map(p => p.fabric))].join(", ")}

REGIONAL KNOWLEDGE:
- Tamil speakers → suggest Kanjivaram first
- Hindi speakers → suggest Banarasi first
- Bengali → Tant, Baluchari, Jamdani
- Gujarati → Patola, Bandhani
- Marathi → Paithani
- Kannada → Mysore Silk

RULES:
- NEVER fabricate reviews or ratings
- NEVER create false urgency unless stock is genuinely low
- ALWAYS be transparent about product quality
- When recommending, mention 2-3 specific products with prices
- If customer speaks Hindi/Tamil/etc., respond in that language
- Keep responses concise (2-3 short paragraphs max)
- Use emojis sparingly but warmly

When recommending products, format like:
1. **Product Name** — ₹Price (★Rating, Reviews count)
   Brief description of why this suits them

Respond with JSON: { "reply": "your message", "emotion": "greeting|excited|happy|thinking|empathetic|conspiratorial|proud|patient|celebratory", "productsToShow": ["product_id1"] }`;

const LANG_NAMES: Record<string, string> = {
  hi: "Hindi", te: "Telugu", ta: "Tamil", kn: "Kannada", ml: "Malayalam",
  bn: "Bengali", mr: "Marathi", gu: "Gujarati", pa: "Punjabi", or: "Odia", ur: "Urdu",
};

// Detect language from text using Unicode ranges
function detectLanguage(text: string): string | null {
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu"; // Gujarati
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Devanagari (Hindi/Marathi)
  if (/[\u0C00-\u0C7F]/.test(text)) return "te"; // Telugu
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta"; // Tamil
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn"; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml"; // Malayalam
  if (/[\u0980-\u09FF]/.test(text)) return "bn"; // Bengali
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa"; // Punjabi
  if (/[\u0B00-\u0B7F]/.test(text)) return "or"; // Odia
  if (/[\u0600-\u06FF]/.test(text)) return "ur"; // Urdu/Arabic
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, language } = await req.json();

    // Flag-based provider selection: anthropic | sarvam | demo
    const provider = process.env.AI_PROVIDER || "demo";
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const sarvamKey = process.env.SARVAM_API_KEY;

    // Detect language from latest message
    const rawMsg = messages[messages.length - 1]?.content || "";
    const detectedLang = detectLanguage(rawMsg) || language || "en";
    const langName = LANG_NAMES[detectedLang] || "English";

    // Route to provider
    if (provider === "anthropic" && anthropicKey) {
      return await handleAnthropic(messages, anthropicKey, detectedLang, langName);
    } else if (provider === "sarvam" && sarvamKey) {
      // TODO: Implement Sarvam AI integration
      // For now, fall through to demo
      return NextResponse.json(getDemoResponse(messages, detectedLang));
    } else if (anthropicKey) {
      // If no provider set but key exists, use Anthropic
      return await handleAnthropic(messages, anthropicKey, detectedLang, langName);
    } else {
      return NextResponse.json(getDemoResponse(messages, detectedLang));
    }
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
    ? `\n\nIMPORTANT: The customer is speaking in ${langName}. You MUST respond in ${langName}. Do NOT respond in English unless they switch to English.`
    : "";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      system: SYSTEM_PROMPT + langInstruction,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  const data = await response.json();
  if (data.error) {
    console.error("Anthropic API error:", JSON.stringify(data.error));
    return NextResponse.json({
      reply: `API Error: ${data.error?.message || "Unknown error"}. Using demo mode.`,
      emotion: "empathetic",
      productsToShow: [],
    });
  }
  const text = data.content?.[0]?.text || "I'm sorry, could you repeat that?";

  // Try to parse JSON response
  try {
    const parsed = JSON.parse(text);
    return NextResponse.json({ ...parsed, detectedLanguage: detectedLang });
  } catch {
    return NextResponse.json({
      reply: text,
      emotion: "happy",
      productsToShow: [],
      detectedLanguage: detectedLang,
    });
  }
}

function getDemoResponse(messages: { role: string; content: string }[], language: string): { reply: string; emotion: string; productsToShow: string[]; detectedLanguage?: string } {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
  const rawMsg = messages[messages.length - 1]?.content || "";

  // Detect language from typed text (Unicode script detection)
  const detectedLang = detectLanguage(rawMsg) || language || "en";

  // Language-specific greetings and responses
  const greetings: Record<string, { hello: string; help: string; occasion: string; budget: string }> = {
    hi: { hello: "नमस्ते", help: "मैं आपकी मदद करना चाहूंगी", occasion: "आप किस अवसर के लिए खरीदारी कर रहे हैं? (शादी, त्योहार, रोज़ का?)", budget: "आपका बजट क्या है?" },
    gu: { hello: "નમસ્તે", help: "હું તમને મદદ કરવા માંગુ છું", occasion: "તમે કયા પ્રસંગ માટે ખરીદી કરો છો? (લગ્ન, તહેવાર, રોજિંદા?)", budget: "તમારું બજેટ શું છે?" },
    te: { hello: "నమస్కారం", help: "నేను మీకు సహాయం చేయాలనుకుంటున్నాను", occasion: "మీరు ఏ సందర్భం కోసం షాపింగ్ చేస్తున్నారు? (పెళ్లి, పండుగ, రోజువారీ?)", budget: "మీ బడ్జెట్ ఎంత?" },
    ta: { hello: "வணக்கம்", help: "நான் உங்களுக்கு உதவ விரும்புகிறேன்", occasion: "நீங்கள் எந்த நிகழ்விற்காக ஷாப்பிங் செய்கிறீர்கள்? (திருமணம், பண்டிகை, தினசரி?)", budget: "உங்கள் பட்ஜெட் என்ன?" },
    kn: { hello: "ನಮಸ್ಕಾರ", help: "ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ಬಯಸುತ್ತೇನೆ", occasion: "ನೀವು ಯಾವ ಸಂದರ್ಭಕ್ಕಾಗಿ ಶಾಪಿಂಗ್ ಮಾಡುತ್ತಿದ್ದೀರಿ?", budget: "ನಿಮ್ಮ ಬಜೆಟ್ ಎಷ್ಟು?" },
    ml: { hello: "നമസ്കാരം", help: "ഞാൻ നിങ്ങളെ സഹായിക്കാൻ ആഗ്രഹിക്കുന്നു", occasion: "ഏത് അവസരത്തിനാണ് ഷോപ്പിംഗ്?", budget: "നിങ്ങളുടെ ബജറ്റ് എത്ര?" },
    bn: { hello: "নমস্কার", help: "আমি আপনাকে সাহায্য করতে চাই", occasion: "আপনি কোন উপলক্ষে কেনাকাটা করছেন?", budget: "আপনার বাজেট কত?" },
    mr: { hello: "नमस्कार", help: "मला तुम्हाला मदत करायला आवडेल", occasion: "तुम्ही कोणत्या प्रसंगासाठी खरेदी करत आहात?", budget: "तुमचे बजेट काय आहे?" },
    pa: { hello: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", help: "ਮੈਂ ਤੁਹਾਡੀ ਮਦਦ ਕਰਨਾ ਚਾਹੁੰਦੀ ਹਾਂ", occasion: "ਤੁਸੀਂ ਕਿਸ ਮੌਕੇ ਲਈ ਖਰੀਦਦਾਰੀ ਕਰ ਰਹੇ ਹੋ?", budget: "ਤੁਹਾਡਾ ਬਜਟ ਕੀ ਹੈ?" },
    or: { hello: "ନମସ୍କାର", help: "ମୁଁ ଆପଣଙ୍କୁ ସାହାଯ୍ୟ କରିବାକୁ ଚାହେଁ", occasion: "ଆପଣ କେଉଁ ଉତ୍ସବ ପାଇଁ ଖରୀଦ କରୁଛନ୍ତି?", budget: "ଆପଣଙ୍କ ବଜେଟ କେତେ?" },
    ur: { hello: "آداب", help: "میں آپ کی مدد کرنا چاہتی ہوں", occasion: "آپ کس موقع کے لیے خریداری کر رہے ہیں؟", budget: "آپ کا بجٹ کیا ہے؟" },
  };

  // If non-English language detected, respond in that language
  if (detectedLang !== "en" && greetings[detectedLang]) {
    const g = greetings[detectedLang];
    const best = products.sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 3);
    return {
      reply: `${g.hello}! ${g.help}.\n\n${g.occasion}\n\n${best.map((p, i) => `${i + 1}. **${p.name}** — ₹${p.price.toLocaleString()} (★${p.rating})`).join("\n")}\n\n${g.budget}`,
      emotion: "greeting",
      productsToShow: best.map(p => p.id),
      detectedLanguage: detectedLang,
    };
  }

  // Simple keyword matching for demo
  if (lastMsg.includes("wedding") || lastMsg.includes("शादी") || lastMsg.includes("kalyanam")) {
    const wedding = products.filter(p => p.occasion.includes("Wedding") && p.price > 5000).slice(0, 3);
    return {
      reply: `Congratulations! 🎉 Here are my top wedding saree picks:\n\n${wedding.map((p, i) => `${i + 1}. **${p.name}** — ₹${p.price.toLocaleString()} (★${p.rating}, ${p.reviewCount} reviews)\n   ${p.fabric} | ${p.tags[0]} | ${p.color}`).join("\n\n")}\n\nWould you like to see any of these in detail? I can also suggest matching blouse options! 😊`,
      emotion: "excited",
      productsToShow: wedding.map(p => p.id),
    };
  }

  if (lastMsg.includes("silk") || lastMsg.includes("सिल्क") || lastMsg.includes("பட்டு")) {
    const silk = products.filter(p => p.fabric.includes("Silk")).slice(0, 3);
    return {
      reply: `Great choice! Silk sarees are timeless. Here are some beautiful options:\n\n${silk.map((p, i) => `${i + 1}. **${p.name}** — ₹${p.price.toLocaleString()} (★${p.rating})\n   ${p.tags[0]} | ${p.color} | ${p.style}`).join("\n\n")}\n\nWhat's your budget range? That'll help me narrow down the perfect one for you! 🙏`,
      emotion: "proud",
      productsToShow: silk.map(p => p.id),
    };
  }

  if (lastMsg.includes("cheap") || lastMsg.includes("budget") || lastMsg.includes("under") || lastMsg.includes("sasta") || lastMsg.includes("सस्ता")) {
    const budget = products.filter(p => p.price < 3000).sort((a, b) => b.rating - a.rating).slice(0, 3);
    return {
      reply: `I have beautiful options that are easy on the pocket! 😊\n\n${budget.map((p, i) => `${i + 1}. **${p.name}** — ₹${p.price.toLocaleString()} (★${p.rating}, ${p.discount}% off!)\n   ${p.fabric} | ${p.tags[0]}`).join("\n\n")}\n\nThese are great value for money. The ${budget[0]?.tags[0]} ones are especially popular for daily wear!`,
      emotion: "conspiratorial",
      productsToShow: budget.map(p => p.id),
    };
  }

  if (lastMsg.includes("bestseller") || lastMsg.includes("popular") || lastMsg.includes("best")) {
    const best = products.sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 3);
    return {
      reply: `Here are our most loved sarees! ⭐\n\n${best.map((p, i) => `${i + 1}. **${p.name}** — ₹${p.price.toLocaleString()} (★${p.rating}, ${p.reviewCount} reviews)\n   "${p.reviews[0]?.text}"`).join("\n\n")}\n\nThese are customer favorites. Would you like to know more about any of them?`,
      emotion: "proud",
      productsToShow: best.map(p => p.id),
    };
  }

  if (lastMsg.includes("daily") || lastMsg.includes("casual") || lastMsg.includes("office") || lastMsg.includes("रोज़")) {
    const daily = products.filter(p => p.occasion.includes("Daily Wear") || p.occasion.includes("Office")).sort((a, b) => a.price - b.price).slice(0, 3);
    return {
      reply: `For daily wear, comfort is key! Here are some lovely options:\n\n${daily.map((p, i) => `${i + 1}. **${p.name}** — ₹${p.price.toLocaleString()} (★${p.rating})\n   ${p.fabric} | ${p.fabric} weight | Easy to maintain`).join("\n\n")}\n\nCotton and linen are best for daily wear — breathable and easy to wash. Want me to show more? 😊`,
      emotion: "happy",
      productsToShow: daily.map(p => p.id),
    };
  }

  // Default response
  return {
    reply: "I'd love to help you find the perfect saree! 🙏\n\nCould you tell me:\n1. What's the occasion? (wedding, festival, daily wear?)\n2. Any fabric preference? (silk, cotton, chiffon?)\n3. What's your budget range?\n\nOr just browse our categories above and I'll guide you! 😊",
    emotion: "patient",
    productsToShow: [],
  };
}

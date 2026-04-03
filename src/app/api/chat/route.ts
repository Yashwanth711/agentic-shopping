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

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    // Check for Anthropic API key
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Fallback: Simple rule-based responses for demo without API key
      return NextResponse.json(getDemoResponse(messages));
    }

    // Call Claude API
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
        system: SYSTEM_PROMPT,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "I'm sorry, could you repeat that?";

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(text);
      return NextResponse.json(parsed);
    } catch {
      // If not JSON, wrap it
      return NextResponse.json({
        reply: text,
        emotion: "happy",
        productsToShow: [],
      });
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

function getDemoResponse(messages: { role: string; content: string }[]): { reply: string; emotion: string; productsToShow: string[] } {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";

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

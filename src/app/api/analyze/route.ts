import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { conversation } = await req.json();
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

    const prompt = `Analyze this shopping conversation. Give a brief seller report:

${conversation}

Respond in this format:
INTENT: What customer wanted (1 line)
LIKED: What they liked (1 line)
CONCERNS: Hesitations or doubts (1 line)
OUTCOME: Did they buy? If not, why? (1 line)
ACTION: What seller should do (1 line)
SATISFACTION: Rate 1-5`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );

    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 });

    const parts = data.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p: { text?: string; thought?: boolean }) => !p.thought && p.text);
    const analysis = (textPart?.text || "Analysis failed").replace(/^OK[.,]?\s*/i, "").trim();

    return NextResponse.json({ analysis });
  } catch {
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

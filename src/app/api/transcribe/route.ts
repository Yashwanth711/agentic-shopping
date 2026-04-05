import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const language = formData.get("language") as string || "en";

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: "No API key configured" }, { status: 500 });
    }

    // Convert audio file to base64
    const audioBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");

    // Determine MIME type
    const mimeType = audioFile.type || "audio/webm";

    // Send to Gemini for transcription
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Audio,
                },
              },
              {
                text: `Transcribe this audio exactly as spoken. The speaker is likely speaking in ${language}. Output ONLY the transcription text, nothing else. If you cannot hear anything or the audio is silent, respond with exactly: [EMPTY]`,
              },
            ],
          }],
          generationConfig: { maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error("Gemini transcription error:", JSON.stringify(data.error));
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p: { text?: string; thought?: boolean }) => !p.thought && p.text);
    const transcript = (textPart?.text || "").trim();

    if (!transcript || transcript === "[EMPTY]") {
      return NextResponse.json({ transcript: "", empty: true });
    }

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}

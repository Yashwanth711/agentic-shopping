"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { products } from "@/data/products";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
  emotion?: string;
  productsToShow?: string[];
  language?: string;
  timestamp?: number;
}

const LANG_CODES: Record<string, { speech: string; name: string; greeting: string }> = {
  en: { speech: "en-IN", name: "English", greeting: "Hello" },
  hi: { speech: "hi-IN", name: "Hindi", greeting: "Namaste" },
  te: { speech: "te-IN", name: "Telugu", greeting: "Namaskaram" },
  ta: { speech: "ta-IN", name: "Tamil", greeting: "Vanakkam" },
  kn: { speech: "kn-IN", name: "Kannada", greeting: "Namaskara" },
  ml: { speech: "ml-IN", name: "Malayalam", greeting: "Namaskaram" },
  bn: { speech: "bn-IN", name: "Bengali", greeting: "Nomoshkar" },
  mr: { speech: "mr-IN", name: "Marathi", greeting: "Namaskar" },
  gu: { speech: "gu-IN", name: "Gujarati", greeting: "Namaste" },
  pa: { speech: "pa-IN", name: "Punjabi", greeting: "Sat Sri Akal" },
  or: { speech: "or-IN", name: "Odia", greeting: "Namaskar" },
  ur: { speech: "ur-IN", name: "Urdu", greeting: "Aadaab" },
};

// Render clickable product links
function RenderMessage({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        const m = part.match(/^\*\*(.+)\*\*$/);
        if (m) {
          const p = products.find(x => m[1].toLowerCase().includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(m[1].toLowerCase()));
          if (p) return <Link key={i} href={`/product/${p.id}`} className="font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2">{m[1]}</Link>;
          return <strong key={i} className="text-white">{m[1]}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function formatTime(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Avatar SVG — Indian woman illustration
function Avatar({ size = 120 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-600/30 to-orange-600/30" style={{ padding: 4 }}>
        <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-700 to-orange-800 flex items-center justify-center text-white overflow-hidden border-2 border-amber-500/50">
          <span style={{ fontSize: size * 0.55 }}>🙏</span>
        </div>
      </div>
      <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-950" />
    </div>
  );
}

export default function AgentPanel({ onNavigate, context }: {
  onNavigate?: (productIds: string | string[]) => void;
  context?: "homepage" | "pdp" | "search";
}) {
  // States
  const [mode, setMode] = useState<"closed" | "voice" | "chat">("closed");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedLang, setSelectedLang] = useState("en");
  const [langChosen, setLangChosen] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});
  const [micReady, setMicReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [waveBars, setWaveBars] = useState<number[]>([3,5,8,4,7,9,5,3,6,8,4,7]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const sessionIdRef = useRef("");
  const lastTranscriptRef = useRef("");

  // Animate waveform when listening
  useEffect(() => {
    if (!isListening) return;
    const interval = setInterval(() => {
      setWaveBars(prev => prev.map(() => Math.floor(Math.random() * 10) + 2));
    }, 150);
    return () => clearInterval(interval);
  }, [isListening]);

  // Session ID
  useEffect(() => {
    const saved = localStorage.getItem("saheli_session_id");
    if (saved) { sessionIdRef.current = saved; }
    else {
      const id = "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
      sessionIdRef.current = id;
      localStorage.setItem("saheli_session_id", id);
    }
  }, []);

  // Restore session
  useEffect(() => {
    try {
      const savedMsgs = localStorage.getItem("saheli_messages");
      const savedLang = localStorage.getItem("saheli_lang");
      if (savedMsgs) { const p = JSON.parse(savedMsgs); if (p.length > 0) { setMessages(p); setLangChosen(true); } }
      if (savedLang) { setSelectedLang(savedLang); setLangChosen(true); }
    } catch {}
    setRestored(true);
  }, []);

  // Save messages
  useEffect(() => { if (restored && messages.length > 0) localStorage.setItem("saheli_messages", JSON.stringify(messages)); }, [messages, restored]);
  useEffect(() => { if (restored && langChosen) localStorage.setItem("saheli_lang", selectedLang); }, [selectedLang, langChosen, restored]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Visibility
  useEffect(() => {
    const h = () => { if (document.hidden) { window.speechSynthesis.cancel(); setIsSpeaking(false); if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); } } };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [isListening]);

  // Speech Recognition
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    rec.onresult = (e: any) => {
      setMicReady(true);
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setInput(t);
      if (stopTimer) clearTimeout(stopTimer);
      if (e.results[e.results.length - 1].isFinal) {
        lastTranscriptRef.current = t;
        stopTimer = setTimeout(() => { try { rec.stop(); } catch {} }, 3000);
      }
    };
    rec.onerror = (e: any) => {
      if (stopTimer) clearTimeout(stopTimer);
      // Don't flash on "no-speech" or "aborted" errors — these are normal
      if (e.error !== "no-speech" && e.error !== "aborted") console.error("Speech error:", e.error);
      setIsListening(false);
    };
    rec.onend = () => {
      if (stopTimer) clearTimeout(stopTimer);
      setIsListening(false); setMicReady(false);
      // Only auto-send if we actually got a real transcript
      const transcript = lastTranscriptRef.current.trim();
      if (transcript && transcript.length > 0) {
        setTimeout(() => window.dispatchEvent(new CustomEvent("saheli-voice-done")), 150);
      }
    };
    recognitionRef.current = rec;
  }, []);

  useEffect(() => { if (recognitionRef.current) recognitionRef.current.lang = LANG_CODES[selectedLang]?.speech || "en-IN"; }, [selectedLang]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop(); setIsListening(false);
    } else {
      if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
      setInput(""); lastTranscriptRef.current = ""; setMicReady(false);
      recognitionRef.current.lang = LANG_CODES[selectedLang]?.speech || "en-IN";
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        // Already started or browser blocked — ignore silently
        console.warn("Mic start failed:", e);
      }
    }
  }, [isListening, selectedLang, isSpeaking]);

  const speakText = useCallback((text: string, lang: string = selectedLang) => {
    if (!("speechSynthesis" in window)) return;
    if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); }
    window.speechSynthesis.cancel();
    const clean = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").replace(/\*\*/g, "").replace(/\*/g, "").trim();
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = LANG_CODES[lang]?.speech || "en-IN"; u.rate = 0.9; u.pitch = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.lang.startsWith(lang) && v.name.toLowerCase().includes("female")) || voices.find(v => v.lang.startsWith(LANG_CODES[lang]?.speech.split("-")[0] || "en"));
    if (v) u.voice = v;
    u.onstart = () => setIsSpeaking(true); u.onend = () => setIsSpeaking(false); u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [selectedLang, isListening]);

  // Language select
  const handleLangSelect = useCallback((lang: string) => {
    setSelectedLang(lang); setLangChosen(true); setShowLangPicker(false);
    const greetings: Record<string, string> = {
      en: "Namaste! I'm Saheli, your style guide. Tell me, what's the occasion? I'll find you the perfect outfit!",
      hi: "Namaste! Mein Saheli hu, aapki style guide. Bataiye, kaunsa occasion hai? Mein aapke liye perfect outfit dhundh lungi!",
      te: "Namaskaram! Nenu Saheli, mee style guide. Cheppandi, occasion emiti? Meeku perfect outfit chupisthanu!",
      ta: "Vanakkam! Naan Saheli, ungal style guide. Sollunga, enna occasion? Ungalukku perfect outfit kandupidikkiren!",
    };
    const msg = greetings[lang] || greetings.en;
    setMessages([{ role: "assistant", content: msg, emotion: "greeting", timestamp: Date.now() }]);
    setMode("voice");
    setTimeout(() => speakText(msg, lang), 500);
  }, [speakText]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const wasVoice = lastTranscriptRef.current.trim() === input.trim() && lastTranscriptRef.current.trim() !== "";
    const userMsg: Message = { role: "user", content: input.trim(), language: selectedLang, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput(""); lastTranscriptRef.current = ""; setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })), language: selectedLang, sessionId: sessionIdRef.current, inputMode: wasVoice ? "voice" : "text" }),
      });
      const data = await res.json();
      const aMsg: Message = { role: "assistant", content: data.reply, emotion: data.emotion || "happy", productsToShow: data.productsToShow, language: data.detectedLanguage || selectedLang, timestamp: Date.now() };
      setMessages(prev => [...prev, aMsg]);
      if (data.detectedLanguage && data.detectedLanguage !== selectedLang) setSelectedLang(data.detectedLanguage);
      // Switch to chat mode after 2 exchanges so user can see full conversation
      const userMsgCount = [...messages, userMsg].filter(m => m.role === "user").length;
      if (mode === "voice" && userMsgCount >= 2) setMode("chat");
      speakText(data.reply, data.detectedLanguage || selectedLang);
      if (data.productsToShow?.length && onNavigate) onNavigate(data.productsToShow);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong!", timestamp: Date.now() }]);
    } finally { setIsLoading(false); }
  };

  // Listen for voice-done event to auto-send
  // Use ref to always have latest sendMessage without stale closure
  const sendRef = useRef<typeof sendMessage>(sendMessage);
  useEffect(() => { sendRef.current = sendMessage; });
  useEffect(() => {
    const handler = () => {
      // Small delay to ensure React state has updated from setInput
      setTimeout(() => { if (sendRef.current) sendRef.current(); }, 100);
    };
    window.addEventListener("saheli-voice-done", handler);
    return () => window.removeEventListener("saheli-voice-done", handler);
  }, []);

  const logFeedback = (idx: number, rating: "up" | "down") => {
    setFeedback(prev => ({ ...prev, [idx]: rating }));
    const msg = messages[idx];
    const userMsg = messages.slice(0, idx).reverse().find(m => m.role === "user");
    fetch("https://script.google.com/macros/s/AKfycbxd1mug0pGQJeeoNtrD_MIBE3x4oA3Gk4C2l9neZvfbC7yzaaKHesNZt-6-hKgYoHn2Cw/exec", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionIdRef.current, role: "feedback", message: `${rating === "up" ? "LIKED" : "DISLIKED"} | User asked: "${userMsg?.content || ""}" | Saheli replied: "${msg?.content?.slice(0, 200) || ""}"`, language: selectedLang, page: "feedback" }),
    }).catch(() => {});
  };

  const clearChat = () => { setMessages([]); setLangChosen(false); setMode("closed"); localStorage.removeItem("saheli_messages"); localStorage.removeItem("saheli_lang"); };

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");

  // ===================== CLOSED STATE — Floating CTA =====================
  if (mode === "closed") {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-end gap-3 sm:bottom-6 sm:right-6">
        {/* Greeting bubble */}
        <div className="bg-gray-900/95 backdrop-blur text-white rounded-2xl rounded-br-sm shadow-2xl p-3 max-w-[200px] sm:max-w-[240px] border border-amber-500/20">
          <p className="text-xs sm:text-sm leading-relaxed">
            {context === "pdp" ? "Kya aapko ye product pasand aaya?" : "Namaste! Need help?"}
          </p>
        </div>
        {/* Avatar button */}
        <button onClick={() => {
            if (langChosen) {
              setMode(messages.length > 2 ? "chat" : "voice");
            } else {
              setShowLangPicker(true);
            }
          }}
          className="relative flex-shrink-0">
          <Avatar size={56} />
        </button>

        {/* Language picker popup */}
        {showLangPicker && (
          <div className="absolute bottom-20 right-0 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-4 w-[280px] sm:w-[320px] z-50">
            <p className="text-white text-sm font-semibold mb-1 text-center">Choose your language</p>
            <p className="text-gray-500 text-xs mb-3 text-center">Apni bhasha chunein</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(LANG_CODES).map(([code, lang]) => (
                <button key={code} onClick={() => handleLangSelect(code)}
                  className="py-2.5 px-1 rounded-xl border border-gray-700 hover:border-amber-500 hover:bg-amber-500/10 text-center transition-all">
                  <span className="block text-sm">{lang.greeting}</span>
                  <span className="text-[10px] text-gray-500">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===================== VOICE MODE — Full Screen =====================
  if (mode === "voice") {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Live Assistant</span>
          </div>
          <div className="relative">
            <button onClick={() => setShowLangPicker(!showLangPicker)}
              className="text-xs text-gray-400 bg-gray-800 px-3 py-1 rounded-full hover:bg-gray-700">
              {LANG_CODES[selectedLang]?.name} ▾
            </button>
            {showLangPicker && (
              <div className="absolute top-8 right-0 bg-gray-800 rounded-xl shadow-2xl p-2 grid grid-cols-3 gap-1 w-64 border border-gray-700 z-50">
                {Object.entries(LANG_CODES).map(([code, lang]) => (
                  <button key={code} onClick={() => { setSelectedLang(code); setShowLangPicker(false); }}
                    className={`text-xs px-2 py-1.5 rounded-lg hover:bg-gray-700 ${selectedLang === code ? "bg-amber-500/20 text-amber-400" : "text-gray-300"}`}>
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Avatar + Status */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <Avatar size={160} />
          <h2 className="text-white text-2xl font-bold mt-4">Saheli</h2>
          <p className="text-amber-500 text-xs font-semibold uppercase tracking-widest mt-1">Your Style Guide</p>

          {/* Status */}
          <div className="mt-8 text-center">
            {isListening ? (
              <>
                <p className="text-gray-400 text-sm mb-3">{input ? `"${input}"` : "Listening to you..."}</p>
                {/* Waveform */}
                <div className="flex items-end justify-center gap-1 h-10">
                  {waveBars.map((h, i) => (
                    <div key={i} className="w-1.5 bg-amber-500 rounded-full transition-all duration-150" style={{ height: `${h * 3}px` }} />
                  ))}
                </div>
                <p className="text-red-400 text-xs mt-3 flex items-center justify-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  TAP TO RESPOND
                </p>
              </>
            ) : isSpeaking ? (
              <>
                <p className="text-amber-400 text-sm mb-3">Speaking...</p>
                <div className="flex items-end justify-center gap-1 h-10">
                  {waveBars.map((h, i) => (
                    <div key={i} className="w-1.5 bg-amber-500/60 rounded-full transition-all duration-150" style={{ height: `${h * 2.5}px` }} />
                  ))}
                </div>
              </>
            ) : isLoading ? (
              <div className="flex gap-2">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Tap the mic to speak</p>
            )}
          </div>

          {/* Last message bubble */}
          {lastAssistantMsg && (
            <div className="mt-8 mx-4 bg-gray-900/80 border border-gray-800 rounded-2xl px-5 py-3 max-w-sm">
              <p className="text-gray-300 text-sm text-center leading-relaxed whitespace-pre-wrap">
                <RenderMessage text={lastAssistantMsg.content.length > 200 ? lastAssistantMsg.content.slice(0, 200) + "..." : lastAssistantMsg.content} />
              </p>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-center gap-8 pb-8 pt-4 px-6">
          {/* Exit */}
          <div className="flex flex-col items-center gap-1">
            <button onClick={() => { if (isListening) { recognitionRef.current?.stop(); setIsListening(false); } window.speechSynthesis.cancel(); setIsSpeaking(false); setMode("closed"); }}
              className="w-12 h-12 sm:w-14 sm:h-14 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors">
              <span className="text-xl">✕</span>
            </button>
            <span className="text-[10px] text-gray-600">Exit</span>
          </div>

          {/* Mic — big center button */}
          <button onClick={() => { if (isListening && input.trim()) { recognitionRef.current?.stop(); } else { toggleListening(); } }}
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isListening && input.trim()
                ? "bg-green-500 text-white"
                : isListening
                ? "bg-amber-600 text-white ring-4 ring-amber-500/30 animate-pulse"
                : "bg-gradient-to-br from-amber-600 to-orange-700 text-white hover:from-amber-500 hover:to-orange-600"
            }`}>
            <span className="text-2xl sm:text-3xl">{isListening && input.trim() ? "➤" : "🎤"}</span>
          </button>

          {/* Switch to chat */}
          <div className="flex flex-col items-center gap-1">
            <button onClick={() => setMode("chat")}
              className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-800 text-gray-400 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors">
              <span className="text-xl">💬</span>
            </button>
            <span className="text-[10px] text-gray-600">Type</span>
          </div>
        </div>
      </div>
    );
  }

  // ===================== CHAT MODE — Translucent Overlay =====================
  return (
    <div className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="bg-gray-900/95 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar size={36} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Saheli</h3>
            <p className="text-[10px] text-gray-500">{isLoading ? "typing..." : "Your Style Guide"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLangPicker(!showLangPicker)}
            className="text-[10px] text-gray-400 bg-gray-800 px-2 py-1 rounded-full">{LANG_CODES[selectedLang]?.name}</button>
          {showLangPicker && (
            <div className="absolute top-14 right-4 bg-gray-800 rounded-xl shadow-2xl p-2 grid grid-cols-3 gap-1 w-64 border border-gray-700 z-50">
              {Object.entries(LANG_CODES).map(([code, lang]) => (
                <button key={code} onClick={() => { setSelectedLang(code); setShowLangPicker(false); }}
                  className={`text-xs px-2 py-1.5 rounded-lg hover:bg-gray-700 ${selectedLang === code ? "bg-amber-500/20 text-amber-400" : "text-gray-300"}`}>
                  {lang.name}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setMode("voice")} className="text-gray-500 hover:text-amber-400 text-lg">🎤</button>
          <button onClick={() => setMode("closed")} className="text-gray-400 hover:text-white text-xl ml-1">✕</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === "user"
                ? "bg-amber-600 text-white rounded-br-sm"
                : "bg-gray-800/90 text-gray-200 border border-gray-700/50 rounded-bl-sm"
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">
                {msg.role === "assistant" ? <RenderMessage text={msg.content} /> : msg.content}
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-gray-500">{formatTime(msg.timestamp)}</span>
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => speakText(msg.content, msg.language || selectedLang)}
                      className="text-[10px] text-gray-500 hover:text-amber-400">🔊</button>
                    {!feedback[i] ? (
                      <>
                        <button onClick={() => logFeedback(i, "up")} className="text-[10px] text-gray-600 hover:text-green-400">👍</button>
                        <button onClick={() => logFeedback(i, "down")} className="text-[10px] text-gray-600 hover:text-red-400">👎</button>
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-600">{feedback[i] === "up" ? "👍" : "👎"}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800/90 rounded-2xl rounded-bl-sm px-4 py-3 border border-gray-700/50">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Listening indicator */}
      {isListening && (
        <div className="px-4 py-2 bg-gray-900/80 border-t border-gray-800">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">{input ? `"${input}"` : "Speak now..."}</span>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 bg-gray-900/95 border-t border-gray-800">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <button onClick={() => { if (isListening && input.trim()) { recognitionRef.current?.stop(); } else { toggleListening(); } }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
              isListening && input.trim() ? "bg-green-500 text-white" : isListening ? "bg-red-500 text-white animate-pulse" : "bg-gray-800 text-gray-400 hover:text-amber-400"
            }`}>
            {isListening && input.trim() ? "➤" : "🎤"}
          </button>
          <input ref={inputRef} type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Message Saheli...`}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            disabled={isLoading || !langChosen} />
          <button id="saheli-send-btn" onClick={sendMessage} disabled={isLoading || !input.trim()}
            className="w-10 h-10 bg-amber-600 text-white rounded-full flex items-center justify-center hover:bg-amber-500 disabled:opacity-30 transition-colors flex-shrink-0">
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

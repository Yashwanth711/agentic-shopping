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
}

// Language codes for Web Speech API
const LANG_CODES: Record<string, { speech: string; name: string; greeting: string }> = {
  en: { speech: "en-IN", name: "English", greeting: "Hello" },
  hi: { speech: "hi-IN", name: "हिन्दी", greeting: "नमस्ते" },
  te: { speech: "te-IN", name: "తెలుగు", greeting: "నమస్కారం" },
  ta: { speech: "ta-IN", name: "தமிழ்", greeting: "வணக்கம்" },
  kn: { speech: "kn-IN", name: "ಕನ್ನಡ", greeting: "ನಮಸ್ಕಾರ" },
  ml: { speech: "ml-IN", name: "മലയാളം", greeting: "നമസ്കാരം" },
  bn: { speech: "bn-IN", name: "বাংলা", greeting: "নমস্কার" },
  mr: { speech: "mr-IN", name: "मराठी", greeting: "नमस्कार" },
  gu: { speech: "gu-IN", name: "ગુજરાતી", greeting: "નમસ્તે" },
  pa: { speech: "pa-IN", name: "ਪੰਜਾਬੀ", greeting: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ" },
  or: { speech: "or-IN", name: "ଓଡ଼ିଆ", greeting: "ନମସ୍କାର" },
  ur: { speech: "ur-IN", name: "اردو", greeting: "آداب" },
};

function detectDefaultLang(): string {
  if (typeof navigator === "undefined") return "en";
  const browserLang = navigator.language?.split("-")[0]?.toLowerCase() || "en";
  const mapping: Record<string, string> = {
    hi: "hi", te: "te", ta: "ta", kn: "kn", ml: "ml",
    bn: "bn", mr: "mr", gu: "gu", pa: "pa", or: "or", ur: "ur",
  };
  return mapping[browserLang] || "en";
}

// Render message with clickable product links
function RenderMessage({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        const boldMatch = part.match(/^\*\*(.+)\*\*$/);
        if (boldMatch) {
          const name = boldMatch[1];
          const product = products.find(p =>
            name.toLowerCase().includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().includes(name.toLowerCase())
          );
          if (product) {
            return (
              <Link key={i} href={`/product/${product.id}`}
                className="font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2">
                {name}
              </Link>
            );
          }
          return <strong key={i} className="text-white">{name}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export default function AgentPanel({ onNavigate, context }: {
  onNavigate?: (productIds: string | string[]) => void;
  context?: "homepage" | "pdp" | "search";
}) {
  const detectedLang = detectDefaultLang();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedLang, setSelectedLang] = useState(detectedLang);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [langChosen, setLangChosen] = useState(false);
  const [restored, setRestored] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});
  const [micReady, setMicReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const sessionIdRef = useRef<string>("");

  // Generate or restore session ID
  useEffect(() => {
    const saved = localStorage.getItem("saheli_session_id");
    if (saved) {
      sessionIdRef.current = saved;
    } else {
      const id = "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
      sessionIdRef.current = id;
      localStorage.setItem("saheli_session_id", id);
    }
  }, []);

  // Restore session from localStorage
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem("saheli_messages");
      const savedLang = localStorage.getItem("saheli_lang");
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        if (parsed.length > 0) {
          setMessages(parsed);
          setLangChosen(true);
        }
      }
      if (savedLang) {
        setSelectedLang(savedLang);
        setLangChosen(true);
      }
    } catch { /* ignore */ }
    setRestored(true);
  }, []);

  // Save messages
  useEffect(() => {
    if (restored && messages.length > 0) {
      localStorage.setItem("saheli_messages", JSON.stringify(messages));
    }
  }, [messages, restored]);

  // Save language
  useEffect(() => {
    if (restored && langChosen) {
      localStorage.setItem("saheli_lang", selectedLang);
    }
  }, [selectedLang, langChosen, restored]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Stop voice on tab switch
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        if (isListening && recognitionRef.current) {
          recognitionRef.current.stop();
          setIsListening(false);
        }
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [isListening]);

  // Speech Recognition — simple and reliable
  const lastTranscriptRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;

    let stopTimer: ReturnType<typeof setTimeout> | null = null;

    recognition.onresult = (event: any) => {
      setMicReady(true);
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setInput(transcript);

      // Every time we get new words, reset the silence timer
      if (stopTimer) clearTimeout(stopTimer);

      if (event.results[event.results.length - 1].isFinal) {
        lastTranscriptRef.current = transcript;
        // Wait 3 seconds of silence after final result, then auto-stop
        stopTimer = setTimeout(() => {
          try { recognition.stop(); } catch {}
        }, 3000);
      }
    };

    recognition.onerror = () => {
      if (stopTimer) clearTimeout(stopTimer);
      setIsListening(false);
    };
    recognition.onend = () => {
      if (stopTimer) clearTimeout(stopTimer);
      setIsListening(false);
      setMicReady(false);
      if (lastTranscriptRef.current.trim()) {
        setTimeout(() => {
          const btn = document.getElementById("saheli-send-btn");
          if (btn) btn.click();
        }, 200);
      }
    };

    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    if (recognitionRef.current) recognitionRef.current.lang = LANG_CODES[selectedLang]?.speech || "en-IN";
  }, [selectedLang]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) { alert("Speech not supported. Use Chrome or Edge."); return; }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
      setInput("");
      lastTranscriptRef.current = "";
      setMicReady(false);
      recognitionRef.current.lang = LANG_CODES[selectedLang]?.speech || "en-IN";
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening, selectedLang, isSpeaking]);

  const speakText = useCallback((text: string, lang: string = selectedLang) => {
    if (!("speechSynthesis" in window)) return;
    if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .replace(/\*\*/g, "").replace(/\*/g, "").replace(/#{1,}/g, "").trim();
    if (!cleanText) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = LANG_CODES[lang]?.speech || "en-IN";
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const langVoice = voices.find(v => v.lang.startsWith(lang) && v.name.toLowerCase().includes("female"))
      || voices.find(v => v.lang.startsWith(LANG_CODES[lang]?.speech.split("-")[0] || "en"));
    if (langVoice) utterance.voice = langVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [selectedLang, isListening]);

  const stopSpeaking = useCallback(() => { window.speechSynthesis.cancel(); setIsSpeaking(false); }, []);

  // Language selection + context-aware greeting
  const handleLangSelect = useCallback((lang: string) => {
    setSelectedLang(lang);
    setLangChosen(true);

    // Context-aware opening per Ketan's spec
    const greetings: Record<string, Record<string, string>> = {
      homepage: {
        en: "Namaste! I'm Saheli, your personal shopping assistant. You can talk to me in your language and shop easily!\n\nWhat would you like to see today?",
        hi: "नमस्ते! मैं साहेली हूँ, आप मुझसे अपनी भाषा में बात करके आसानी से शॉपिंग कर सकते हैं!\n\nआज आप क्या देखना चाहेंगे?",
        te: "నమస్కారం! నేను సహేలి, మీరు మీ భాషలో మాట్లాడి సులభంగా షాపింగ్ చేయవచ్చు!\n\nఈరోజు మీరు ఏమి చూడాలనుకుంటున్నారు?",
        ta: "வணக்கம்! நான் சஹேலி, நீங்கள் உங்கள் மொழியில் பேசி எளிதாக ஷாப்பிங் செய்யலாம்!\n\nஇன்று என்ன பார்க்க விரும்புகிறீர்கள்?",
      },
      pdp: {
        en: "Hi! Did you like this product? Any doubts, or shall I show you more options?",
        hi: "नमस्ते! क्या आपको ये प्रोडक्ट पसंद आया? कोई doubts हैं या और दिखाऊँ?",
        te: "నమస్కారం! మీకు ఈ ప్రొడక్ట్ నచ్చిందా? ఏమైనా doubts ఉన్నాయా, లేదా ఇంకా చూపించమంటారా?",
        ta: "வணக்கம்! இந்த பொருள் பிடித்ததா? ஏதாவது doubts இருக்கா, அல்லது வேற காட்டவா?",
      },
    };

    const ctx = context || "homepage";
    const ctxGreetings = greetings[ctx] || greetings.homepage;
    const greeting = ctxGreetings[lang] || ctxGreetings.en || ctxGreetings.hi;

    setMessages([{ role: "assistant", content: greeting, emotion: "greeting" }]);
  }, [context]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    // Track if this message came from voice
    const wasVoice = lastTranscriptRef.current.trim() === input.trim() && lastTranscriptRef.current.trim() !== "";
    const userMessage: Message = { role: "user", content: input.trim(), language: selectedLang };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    lastTranscriptRef.current = "";
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
          language: selectedLang,
          sessionId: sessionIdRef.current,
          inputMode: wasVoice ? "voice" : "text",
        }),
      });
      const data = await res.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
        emotion: data.emotion || "happy",
        productsToShow: data.productsToShow,
        language: data.detectedLanguage || selectedLang,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.detectedLanguage && data.detectedLanguage !== selectedLang) {
        setSelectedLang(data.detectedLanguage);
      }
      if (messages.length > 1) {
        speakText(data.reply, data.detectedLanguage || selectedLang);
      }
      if (data.productsToShow?.length && onNavigate) {
        onNavigate(data.productsToShow);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again!", emotion: "empathetic" }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Log feedback to Google Sheet
  const logFeedback = (msgIndex: number, rating: "up" | "down") => {
    setFeedback(prev => ({ ...prev, [msgIndex]: rating }));
    const msg = messages[msgIndex];
    if (!msg) return;
    // Find the user message before this assistant message
    const userMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === "user");
    fetch("https://script.google.com/macros/s/AKfycbxd1mug0pGQJeeoNtrD_MIBE3x4oA3Gk4C2l9neZvfbC7yzaaKHesNZt-6-hKgYoHn2Cw/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionIdRef.current,
        role: "feedback",
        message: `${rating === "up" ? "LIKED" : "DISLIKED"} | User asked: "${userMsg?.content || ""}" | Saheli replied: "${msg.content.slice(0, 200)}"`,
        language: selectedLang,
        page: "feedback",
      }),
    }).catch(() => {});
  };

  const clearChat = () => {
    setMessages([]);
    setLangChosen(false);
    localStorage.removeItem("saheli_messages");
    localStorage.removeItem("saheli_lang");
  };

  // --- FLOATING ICON (closed state) ---
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <div className="bg-gray-900 text-white rounded-2xl rounded-br-md shadow-xl p-4 max-w-[260px] animate-bounce-slow">
          <p className="text-sm mb-2">
            {detectedLang === "hi" ? "Namaste! Mein Saheli hu, shopping mein help karu?" : "Hi! I'm Saheli, need help shopping?"}
          </p>
          <button onClick={() => setIsOpen(true)}
            className="text-sm bg-amber-500 text-black font-semibold px-4 py-2 rounded-full hover:bg-amber-400 transition-colors w-full">
            {detectedLang === "hi" ? "Baat karein" : "Start Shopping"}
          </button>
        </div>
        <button onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-full shadow-xl flex items-center justify-center text-2xl hover:scale-110 transition-transform ring-4 ring-amber-500/30">
          🛍️
        </button>
      </div>
    );
  }

  // --- FULL SCREEN TAKEOVER (open state) ---
  return (
    <div className="fixed inset-0 z-50 bg-gray-950/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xl shadow-lg">
            🛍️
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Saheli</h3>
            <p className="text-xs text-gray-400">Your Shopping Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Language Picker */}
          <div className="relative">
            <button onClick={() => setShowLangPicker(!showLangPicker)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 ${isListening ? "bg-amber-500 text-black animate-pulse" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
              🌐 {LANG_CODES[selectedLang]?.name || "English"} ▾
            </button>
            {showLangPicker && (
              <div className="absolute top-10 right-0 bg-gray-800 text-gray-200 rounded-xl shadow-2xl z-50 p-2 grid grid-cols-3 gap-1 w-72 border border-gray-700">
                {Object.entries(LANG_CODES).map(([code, lang]) => (
                  <button key={code} onClick={() => { setSelectedLang(code); setShowLangPicker(false); }}
                    className={`text-xs px-2 py-1.5 rounded-lg text-left hover:bg-gray-700 ${selectedLang === code ? "bg-amber-500/20 text-amber-400 font-medium" : ""}`}>
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isSpeaking && (
            <button onClick={stopSpeaking} className="text-gray-400 hover:text-white text-sm bg-gray-800 px-2 py-1 rounded-lg">
              🔇
            </button>
          )}
          <button onClick={clearChat} className="text-gray-500 hover:text-gray-300 text-xs">Clear</button>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white text-2xl ml-1">✕</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {/* Language Selection */}
        {!langChosen && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 max-w-md mx-auto">
            <p className="text-white font-semibold text-center mb-1">Welcome to Sundari Silks!</p>
            <p className="text-gray-400 text-sm text-center mb-5">Choose your language to start shopping</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(LANG_CODES).map(([code, lang]) => (
                <button key={code} onClick={() => handleLangSelect(code)}
                  className="py-3 px-2 rounded-xl border border-gray-700 hover:border-amber-500 hover:bg-amber-500/10 transition-all text-center group">
                  <span className="block text-lg mb-0.5 group-hover:scale-110 transition-transform">{lang.greeting}</span>
                  <span className="text-xs text-gray-500 group-hover:text-amber-400">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-amber-500 text-black rounded-br-sm font-medium"
                : "bg-gray-900 text-gray-200 border border-gray-800 rounded-bl-sm"
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">
                {msg.role === "assistant" ? <RenderMessage text={msg.content} /> : msg.content}
              </p>
              {msg.role === "assistant" && (
                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => speakText(msg.content, msg.language || selectedLang)}
                    className="text-xs text-gray-500 hover:text-amber-400 flex items-center gap-1">
                    🔊 Listen
                  </button>
                  {/* Feedback buttons — subtle, non-intrusive */}
                  {!feedback[i] ? (
                    <div className="flex items-center gap-1 ml-auto">
                      <button onClick={() => logFeedback(i, "up")}
                        className="text-gray-600 hover:text-green-400 transition-colors p-1 rounded hover:bg-green-400/10"
                        title="Helpful">
                        <span className="text-xs">👍</span>
                      </button>
                      <button onClick={() => logFeedback(i, "down")}
                        className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-400/10"
                        title="Not helpful">
                        <span className="text-xs">👎</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600 ml-auto">
                      {feedback[i] === "up" ? "👍 Thanks!" : "👎 Noted"}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-900 rounded-2xl rounded-bl-sm px-4 py-3 border border-gray-800">
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

      {/* Quick Actions */}
      {langChosen && messages.length <= 2 && (
        <div className="px-4 py-2 flex gap-2 flex-wrap justify-center border-t border-gray-800 bg-gray-950">
          {["Wedding Saree", "Daily Wear", "Under ₹500", "Kids Dresses", "Show Bestsellers"].map((q) => (
            <button key={q} onClick={() => setInput(q)}
              className="text-xs bg-gray-800 text-amber-400 px-4 py-2 rounded-full hover:bg-gray-700 transition-colors border border-gray-700">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div className="p-4 border-t border-gray-800 bg-gray-900">
        {isListening && (
          <div className={`flex items-center justify-center gap-2 mb-3 py-3 rounded-xl border ${input.trim() ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
            <span className={`w-3 h-3 rounded-full animate-pulse ${input.trim() ? "bg-green-500" : "bg-red-500"}`} />
            <span className={`text-sm font-medium ${input.trim() ? "text-green-400" : "text-red-400"}`}>
              {input.trim() ? `"${input}" — tap 🎤 to send` : "Speak now..."}
            </span>
            <button onClick={toggleListening} className="text-xs text-gray-500 underline ml-2">Cancel</button>
          </div>
        )}
        <div className="flex gap-2 max-w-3xl mx-auto">
          <button onClick={() => {
              if (isListening && input.trim()) {
                // Stop and send
                if (recognitionRef.current) recognitionRef.current.stop();
              } else {
                toggleListening();
              }
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all text-lg ${
              isListening && input.trim()
                ? "bg-green-500 text-white"
                : isListening
                ? "bg-red-500 text-white animate-pulse"
                : "bg-gray-800 text-gray-400 hover:bg-amber-500/20 hover:text-amber-400"
            }`}>
            {isListening && input.trim() ? "➤" : "🎤"}
          </button>
          <input ref={inputRef} type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={langChosen ? `Type or speak in ${LANG_CODES[selectedLang]?.name}...` : "Choose a language first..."}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-5 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            disabled={isLoading || !langChosen}
          />
          <button id="saheli-send-btn" onClick={sendMessage} disabled={isLoading || !input.trim() || !langChosen}
            className="w-12 h-12 bg-amber-500 text-black rounded-full flex items-center justify-center hover:bg-amber-400 disabled:opacity-30 transition-colors text-lg font-bold">
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  emotion?: string;
  productsToShow?: string[];
  language?: string;
}

const EMOTIONS: Record<string, string> = {
  greeting: "🙏", excited: "😊", happy: "😄", thinking: "🤔",
  empathetic: "😌", conspiratorial: "😉", proud: "🤩",
  patient: "🙂", celebratory: "🎉", farewell: "🙏",
};

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

export default function AgentPanel({ onNavigate }: { onNavigate?: (productId: string) => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Namaste! 🙏 Welcome to Sundari Silks! I'm Priya, your personal shopping assistant.\n\nAre you looking for something special today — a wedding saree, daily wear, or something for a festival?\n\n🎤 You can also speak to me in any Indian language!",
      emotion: "greeting",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [currentEmotion, setCurrentEmotion] = useState("greeting");
  const [isListening, setIsListening] = useState(false);
  const [selectedLang, setSelectedLang] = useState("en");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join("");
          setInput(transcript);

          // If final result, auto-send
          if (event.results[event.results.length - 1].isFinal) {
            setIsListening(false);
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  // Update recognition language when selected language changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = LANG_CODES[selectedLang]?.speech || "en-IN";
    }
  }, [selectedLang]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser. Please use Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput("");
      recognitionRef.current.lang = LANG_CODES[selectedLang]?.speech || "en-IN";
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening, selectedLang]);

  // Text-to-Speech for agent responses
  const speakText = useCallback((text: string, lang: string = selectedLang) => {
    if (!("speechSynthesis" in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean text — remove emojis and markdown
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#{1,}/g, "")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = LANG_CODES[lang]?.speech || "en-IN";
    utterance.rate = 0.9;
    utterance.pitch = 1.1; // Slightly higher pitch for female voice

    // Try to find a female voice for the language
    const voices = window.speechSynthesis.getVoices();
    const langVoice = voices.find(
      (v) => v.lang.startsWith(lang) && v.name.toLowerCase().includes("female")
    ) || voices.find(
      (v) => v.lang.startsWith(LANG_CODES[lang]?.speech.split("-")[0] || "en")
    );
    if (langVoice) utterance.voice = langVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [selectedLang]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim(), language: selectedLang };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setCurrentEmotion("thinking");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          language: selectedLang,
        }),
      });

      const data = await res.json();
      const emotion = data.emotion || "happy";
      setCurrentEmotion(emotion);

      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
        emotion,
        productsToShow: data.productsToShow,
        language: data.detectedLanguage || selectedLang,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Auto-detect language from response
      if (data.detectedLanguage && data.detectedLanguage !== selectedLang) {
        setSelectedLang(data.detectedLanguage);
      }

      // Auto-speak the response
      speakText(data.reply, data.detectedLanguage || selectedLang);

      if (data.productsToShow?.length && onNavigate) {
        onNavigate(data.productsToShow[0]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I had trouble responding. Please try again!", emotion: "empathetic" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-pink-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-pink-700 transition-colors z-50 animate-bounce"
      >
        🙏
      </button>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-2xl transition-all duration-300">
              {EMOTIONS[currentEmotion] || "🙏"}
            </div>
            <div>
              <h3 className="font-semibold">Priya</h3>
              <p className="text-xs text-pink-100">Your Shopping Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSpeaking && (
              <button onClick={stopSpeaking} className="text-white/80 hover:text-white text-sm bg-white/20 px-2 py-1 rounded">
                🔇 Mute
              </button>
            )}
            <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white text-xl">✕</button>
          </div>
        </div>

        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setShowLangPicker(!showLangPicker)}
            className="text-xs bg-white/20 px-3 py-1 rounded-full hover:bg-white/30 transition-colors flex items-center gap-1"
          >
            🌐 {LANG_CODES[selectedLang]?.name || "English"} ▾
          </button>
          {showLangPicker && (
            <div className="absolute top-8 left-0 bg-white text-gray-800 rounded-lg shadow-lg z-50 p-2 grid grid-cols-3 gap-1 w-72">
              {Object.entries(LANG_CODES).map(([code, lang]) => (
                <button
                  key={code}
                  onClick={() => { setSelectedLang(code); setShowLangPicker(false); }}
                  className={`text-xs px-2 py-1.5 rounded text-left hover:bg-pink-50 ${selectedLang === code ? "bg-pink-100 text-pink-700 font-medium" : ""}`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === "user"
                ? "bg-pink-600 text-white rounded-br-md"
                : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md"
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === "assistant" && (
                <button
                  onClick={() => speakText(msg.content, msg.language || selectedLang)}
                  className="text-xs text-gray-400 hover:text-pink-500 mt-1 flex items-center gap-1"
                >
                  🔊 Listen
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 flex gap-2 flex-wrap border-t border-gray-100 bg-white">
          {["Wedding Saree", "Daily Wear", "Under ₹5000", "Silk Sarees", "Show Bestsellers"].map((q) => (
            <button
              key={q}
              onClick={() => { setInput(q); }}
              className="text-xs bg-pink-50 text-pink-600 px-3 py-1.5 rounded-full hover:bg-pink-100 transition-colors border border-pink-200"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white">
        {/* Voice indicator */}
        {isListening && (
          <div className="flex items-center justify-center gap-2 mb-2 py-2 bg-red-50 rounded-lg">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-red-600 font-medium">
              Listening in {LANG_CODES[selectedLang]?.name}...
            </span>
            <button onClick={toggleListening} className="text-xs text-red-500 underline">Stop</button>
          </div>
        )}

        <div className="flex gap-2">
          {/* Voice Button */}
          <button
            onClick={toggleListening}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? "bg-red-500 text-white animate-pulse"
                : "bg-gray-100 text-gray-600 hover:bg-pink-100 hover:text-pink-600"
            }`}
            title={`Speak in ${LANG_CODES[selectedLang]?.name}`}
          >
            🎤
          </button>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Type or speak in ${LANG_CODES[selectedLang]?.name}...`}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-pink-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-pink-700 disabled:opacity-50 transition-colors"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

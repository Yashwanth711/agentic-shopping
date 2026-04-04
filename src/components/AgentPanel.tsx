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

// Detect default language from browser locale
function detectDefaultLang(): string {
  if (typeof navigator === "undefined") return "en";
  const browserLang = navigator.language?.split("-")[0]?.toLowerCase() || "en";
  // Map browser locale to our supported languages
  const mapping: Record<string, string> = {
    hi: "hi", te: "te", ta: "ta", kn: "kn", ml: "ml",
    bn: "bn", mr: "mr", gu: "gu", pa: "pa", or: "or", ur: "ur",
  };
  return mapping[browserLang] || "en"; // Default to English, user can switch via picker
}

export default function AgentPanel({ onNavigate }: { onNavigate?: (productId: string) => void }) {
  const detectedLang = detectDefaultLang();
  const greeting = LANG_CODES[detectedLang]?.greeting || "Namaste";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [currentEmotion, setCurrentEmotion] = useState("greeting");
  const [isListening, setIsListening] = useState(false);
  const [selectedLang, setSelectedLang] = useState(detectedLang);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [langChosen, setLangChosen] = useState(false);
  const [restored, setRestored] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem("priya_messages");
      const savedLang = localStorage.getItem("priya_lang");
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

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (restored && messages.length > 0) {
      localStorage.setItem("priya_messages", JSON.stringify(messages));
    }
  }, [messages, restored]);

  // Save language choice
  useEffect(() => {
    if (restored && langChosen) {
      localStorage.setItem("priya_lang", selectedLang);
    }
  }, [selectedLang, langChosen, restored]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Stop voice when user switches tab or minimizes window
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        if (isListening && recognitionRef.current) {
          recognitionRef.current.stop();
          setIsListening(false);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isListening]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        let silenceTimer: ReturnType<typeof setTimeout> | null = null;

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join("");
          setInput(transcript);

          // Reset silence timer on every result — wait 3 seconds of silence before stopping
          if (silenceTimer) clearTimeout(silenceTimer);
          if (event.results[event.results.length - 1].isFinal) {
            silenceTimer = setTimeout(() => {
              recognition.stop();
            }, 3000);
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          if (silenceTimer) clearTimeout(silenceTimer);
          setIsListening(false);
        };

        recognition.onend = () => {
          if (silenceTimer) clearTimeout(silenceTimer);
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
      // Stop agent speech when user starts speaking
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      setInput("");
      recognitionRef.current.lang = LANG_CODES[selectedLang]?.speech || "en-IN";
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening, selectedLang, isSpeaking]);

  // Text-to-Speech for agent responses
  const speakText = useCallback((text: string, lang: string = selectedLang) => {
    if (!("speechSynthesis" in window)) return;

    // Stop listening when agent speaks (avoid feedback loop)
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

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

  // Handle language selection from the initial prompt
  const LANG_GREETINGS: Record<string, string> = {
    en: "Hello! I'm Priya, your personal shopping assistant at Sundari Silks.\n\nWhat are you looking for today — a wedding saree, daily wear, or something for a festival?",
    hi: "नमस्ते! मैं प्रिया हूँ, सुंदरी सिल्क्स में आपकी शॉपिंग असिस्टेंट।\n\nआज आप क्या ढूंढ रहे हैं — शादी की साड़ी, रोज़ की पहनावट, या त्योहार के लिए कुछ?",
    te: "నమస్కారం! నేను ప్రియ, సుందరీ సిల్క్స్ లో మీ షాపింగ్ అసిస్టెంట్.\n\nమీరు ఈరోజు ఏమి వెతుకుతున్నారు — పెళ్లి చీర, రోజువారీ దుస్తులు, లేదా పండగ కోసం?",
    ta: "வணக்கம்! நான் பிரியா, சுந்தரி சில்க்ஸ் கடையில் உங்கள் ஷாப்பிங் உதவியாளர்.\n\nஇன்று என்ன தேடுகிறீர்கள் — திருமண சேலை, தினசரி உடை, அல்லது பண்டிகைக்கா?",
    kn: "ನಮಸ್ಕಾರ! ನಾನು ಪ್ರಿಯಾ, ಸುಂದರಿ ಸಿಲ್ಕ್ಸ್ ನಲ್ಲಿ ನಿಮ್ಮ ಶಾಪಿಂಗ್ ಅಸಿಸ್ಟೆಂಟ್.\n\nಇಂದು ಏನು ಹುಡುಕುತ್ತಿದ್ದೀರಿ — ಮದುವೆ ಸೀರೆ, ದೈನಂದಿನ ಉಡುಗೆ, ಅಥವಾ ಹಬ್ಬಕ್ಕಾಗಿ?",
    ml: "നമസ്കാരം! ഞാൻ പ്രിയ, സുന്ദരി സിൽക്സിലെ നിങ്ങളുടെ ഷോപ്പിംഗ് അസിസ്റ്റന്റ്.\n\nഇന്ന് എന്താണ് തേടുന്നത് — വിവാഹ സാരി, ദൈനംദിന വസ്ത്രം, അല്ലെങ്കിൽ ആഘോഷത്തിന്?",
    bn: "নমস্কার! আমি প্রিয়া, সুন্দরী সিল্কসে আপনার শপিং অ্যাসিস্ট্যান্ট।\n\nআজ কী খুঁজছেন — বিয়ের শাড়ি, দৈনন্দিন পোশাক, না উৎসবের জন্য?",
    mr: "नमस्कार! मी प्रिया, सुंदरी सिल्क्स मधील तुमची शॉपिंग असिस्टंट.\n\nआज काय शोधत आहात — लग्नाची साडी, रोजची पोशाख, किंवा सणासाठी?",
    gu: "નમસ્તે! હું પ્રિયા, સુંદરી સિલ્ક્સમાં તમારી શોપિંગ આસિસ્ટન્ટ.\n\nઆજે શું શોધો છો — લગ્નની સાડી, રોજની પોશાક, કે તહેવાર માટે?",
    pa: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਪ੍ਰਿਆ ਹਾਂ, ਸੁੰਦਰੀ ਸਿਲਕਸ ਵਿੱਚ ਤੁਹਾਡੀ ਸ਼ਾਪਿੰਗ ਅਸਿਸਟੈਂਟ।\n\nਅੱਜ ਕੀ ਲੱਭ ਰਹੇ ਹੋ — ਵਿਆਹ ਦੀ ਸਾੜੀ, ਰੋਜ਼ਾਨਾ ਪਹਿਰਾਵਾ, ਜਾਂ ਤਿਉਹਾਰ ਲਈ?",
    or: "ନମସ୍କାର! ମୁଁ ପ୍ରିୟା, ସୁନ୍ଦରୀ ସିଲ୍କସରେ ଆପଣଙ୍କ ଶପିଂ ଆସିଷ୍ଟାଣ୍ଟ।\n\nଆଜି କଣ ଖୋଜୁଛନ୍ତି — ବିବାହ ଶାଢ଼ୀ, ଦୈନନ୍ଦିନ ପୋଷାକ, କି ପର୍ବ ପାଇଁ?",
    ur: "آداب! میں پریا ہوں، سندری سلکس میں آپ کی شاپنگ اسسٹنٹ۔\n\nآج کیا ڈھونڈ رہے ہیں — شادی کی ساڑی، روزمرہ لباس، یا تہوار کے لیے؟",
  };

  const handleLangSelect = useCallback((lang: string) => {
    setSelectedLang(lang);
    setLangChosen(true);
    setMessages([
      {
        role: "assistant",
        content: LANG_GREETINGS[lang] || LANG_GREETINGS.en,
        emotion: "greeting",
      },
    ]);
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

      // Only speak if user has interacted (not auto-triggered)
      if (messages.length > 1) {
        speakText(data.reply, data.detectedLanguage || selectedLang);
      }

      if (data.productsToShow?.length && onNavigate) {
        onNavigate(data.productsToShow);
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
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Greeting bubble */}
        <div className="bg-white rounded-2xl rounded-br-md shadow-lg border border-gray-200 p-4 max-w-xs animate-fade-in">
          <button onClick={() => setIsOpen(true)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm">✕</button>
          <p className="text-sm text-gray-800 mb-2">
            {greeting}! {detectedLang === "hi" ? "Hum aapke AI shopping assistant hai. Aapko kharidi mein madad kar sakte hai." : "I'm your AI shopping assistant. I can help you find the perfect product."}
          </p>
          <button
            onClick={() => setIsOpen(true)}
            className="text-sm bg-pink-600 text-white px-4 py-2 rounded-full hover:bg-pink-700 transition-colors w-full"
          >
            {detectedLang === "hi" ? "Baat karein" : "Start Shopping"}
          </button>
        </div>
        {/* Avatar button */}
        <button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform"
        >
          🙏
        </button>
      </div>
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
            className={`text-xs px-3 py-1 rounded-full hover:bg-white/30 transition-colors flex items-center gap-1 ${isListening ? "bg-white/40 animate-pulse ring-2 ring-white" : "bg-white/20"}`}
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
        {/* Language Selection — shown first before any conversation */}
        {!langChosen && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-800 font-medium mb-1">Welcome to Sundari Silks!</p>
            <p className="text-xs text-gray-500 mb-4">Choose your language to get started:</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(LANG_CODES).map(([code, lang]) => (
                <button
                  key={code}
                  onClick={() => handleLangSelect(code)}
                  className="text-xs px-2 py-2.5 rounded-lg border border-gray-200 hover:border-pink-400 hover:bg-pink-50 transition-all text-center"
                >
                  <span className="block text-base mb-0.5">{lang.greeting}</span>
                  <span className="text-gray-500">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
      {langChosen && messages.length <= 2 && (
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
            disabled={isLoading || !langChosen}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || !langChosen}
            className="bg-pink-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-pink-700 disabled:opacity-50 transition-colors"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

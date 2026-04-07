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

// Mini product card for chat
function ChatProductCard({ product, onAddToCart }: { product: typeof products[0]; onAddToCart: (id: string) => void }) {
  return (
    <div className="inline-block w-36 sm:w-40 flex-shrink-0 bg-gray-800 rounded-xl overflow-hidden border border-gray-700/50">
      <Link href={`/product/${product.id}`} onClick={() => window.dispatchEvent(new CustomEvent("saheli-close"))}>
        <div className="h-36 sm:h-40 bg-gray-700 overflow-hidden">
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      </Link>
      <div className="p-2">
        <p className="text-[11px] text-gray-300 line-clamp-2 leading-tight mb-1">{product.name}</p>
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-sm font-bold text-white">₹{product.price.toLocaleString()}</span>
          {product.discount > 10 && <span className="text-[10px] text-green-400">{product.discount}% off</span>}
        </div>
        <div className="flex items-center gap-1 mb-2">
          <span className="text-[10px] bg-green-600 text-white px-1 rounded">★{product.rating}</span>
          <span className="text-[10px] text-gray-500">({product.reviewCount})</span>
        </div>
        <button onClick={() => onAddToCart(product.id)}
          className="w-full text-[10px] bg-amber-600 text-white py-1.5 rounded-lg font-medium hover:bg-amber-500 transition-colors">
          Add to Cart
        </button>
      </div>
    </div>
  );
}

// Extract product IDs mentioned in message and render cards
function MessageWithCards({ text, productIds, onAddToCart }: { text: string; productIds?: string[]; onAddToCart: (id: string) => void }) {
  // Use API-provided product IDs first, then fallback to name matching
  let matchedProducts: typeof products[0][] = [];

  if (productIds && productIds.length > 0) {
    // Use IDs from API response (most reliable)
    matchedProducts = productIds
      .map(id => products.find(p => p.id === id))
      .filter((p): p is typeof products[0] => !!p);
  }

  // Also try name matching as fallback
  if (matchedProducts.length === 0) {
    const textLower = text.toLowerCase();
    products.forEach(p => {
      if (textLower.includes(p.name.toLowerCase())) matchedProducts.push(p);
    });
  }

  // Render text — make product names clickable (with or without bold markers)
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const renderedText = (
    <span>
      {parts.map((part, i) => {
        const m = part.match(/^\*\*(.+)\*\*$/);
        if (m) {
          const p = products.find(x => m[1].toLowerCase().includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(m[1].toLowerCase()));
          if (p) return <Link key={i} href={`/product/${p.id}`} onClick={() => window.dispatchEvent(new CustomEvent("saheli-close"))} className="font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2">{m[1]}</Link>;
          return <strong key={i} className="text-white">{m[1]}</strong>;
        }
        // Also linkify product names that appear without bold markers
        let segment = part;
        for (const p of matchedProducts) {
          if (segment.toLowerCase().includes(p.name.toLowerCase())) {
            const idx = segment.toLowerCase().indexOf(p.name.toLowerCase());
            const actualName = segment.slice(idx, idx + p.name.length);
            segment = segment.replace(actualName, `{{PRODUCT:${p.id}:${actualName}}}`);
          }
        }
        // Render segments with product links
        const subParts = segment.split(/({{PRODUCT:[^}]+}})/g);
        return <span key={i}>{subParts.map((sp, j) => {
          const pm = sp.match(/{{PRODUCT:([^:]+):(.+)}}/);
          if (pm) return <Link key={j} href={`/product/${pm[1]}`} onClick={() => window.dispatchEvent(new CustomEvent("saheli-close"))} className="font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2">{pm[2]}</Link>;
          return <span key={j}>{sp}</span>;
        })}</span>;
      })}
    </span>
  );

  return (
    <>
      <p className="whitespace-pre-wrap leading-relaxed">{renderedText}</p>
      {matchedProducts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1 -mx-1 px-1">
          {matchedProducts.slice(0, 8).map(p => (
            <ChatProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
          ))}
        </div>
      )}
    </>
  );
}

function formatTime(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Avatar — Saheli illustration
function Avatar({ size = 120 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full overflow-hidden shadow-lg ring-2 ring-amber-400/30 bg-gray-200">
        <img src="/saheli-avatar.jpg" alt="Saheli" className="w-full h-full object-cover" />
      </div>
      <div className="absolute bottom-0 right-0 bg-green-500 rounded-full border-2 border-gray-950"
        style={{ width: Math.max(size * 0.18, 10), height: Math.max(size * 0.18, 10) }} />
    </div>
  );
}

export default function AgentPanel({ onNavigate, context, productId }: {
  onNavigate?: (productIds: string | string[]) => void;
  context?: "homepage" | "pdp" | "search" | "menu" | "cart";
  productId?: string;
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
  const [cart, setCart] = useState<string[]>([]);
  const [cartToast, setCartToast] = useState("");
  const [showCart, setShowCart] = useState(false);

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

  // Cart functions
  const addToCart = useCallback((productId: string) => {
    setCart(prev => {
      if (prev.includes(productId)) return prev;
      const updated = [...prev, productId];
      localStorage.setItem("saheli_cart", JSON.stringify(updated));
      return updated;
    });
    const p = products.find(x => x.id === productId);
    setCartToast(p ? `${p.name} added!` : "Added to cart!");
    setTimeout(() => setCartToast(""), 2000);
  }, []);

  // Restore cart
  useEffect(() => {
    try {
      const saved = localStorage.getItem("saheli_cart");
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);

  // Location-based language detection — runs once, no API cost
  useEffect(() => {
    // Skip if language already chosen
    if (langChosen || localStorage.getItem("saheli_lang")) return;

    if (typeof window === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // Map Indian regions to languages by approximate lat/lng bounding boxes
        const regionLangs: { minLat: number; maxLat: number; minLng: number; maxLng: number; lang: string }[] = [
          // Andhra Pradesh + Telangana (Telugu)
          { minLat: 12.5, maxLat: 19.5, minLng: 77, maxLng: 84.5, lang: "te" },
          // Tamil Nadu (Tamil)
          { minLat: 8, maxLat: 13.5, minLng: 76, maxLng: 80.5, lang: "ta" },
          // Karnataka (Kannada)
          { minLat: 11.5, maxLat: 18.5, minLng: 74, maxLng: 78.5, lang: "kn" },
          // Kerala (Malayalam)
          { minLat: 8, maxLat: 12.8, minLng: 74.5, maxLng: 77.5, lang: "ml" },
          // West Bengal (Bengali)
          { minLat: 21.5, maxLat: 27, minLng: 86.5, maxLng: 89.5, lang: "bn" },
          // Maharashtra (Marathi)
          { minLat: 15.5, maxLat: 22, minLng: 72.5, maxLng: 80.5, lang: "mr" },
          // Gujarat (Gujarati)
          { minLat: 20, maxLat: 24.5, minLng: 68.5, maxLng: 74.5, lang: "gu" },
          // Punjab (Punjabi)
          { minLat: 29.5, maxLat: 32.5, minLng: 73.5, maxLng: 77, lang: "pa" },
          // Odisha (Odia)
          { minLat: 17.5, maxLat: 22.5, minLng: 81.5, maxLng: 87.5, lang: "or" },
          // UP + Bihar + MP + Rajasthan + Delhi (Hindi) — broad central/north India
          { minLat: 22, maxLat: 31, minLng: 73, maxLng: 88, lang: "hi" },
        ];

        let detectedLang = "hi"; // Default to Hindi for India
        for (const region of regionLangs) {
          if (latitude >= region.minLat && latitude <= region.maxLat &&
              longitude >= region.minLng && longitude <= region.maxLng) {
            detectedLang = region.lang;
            break;
          }
        }

        // Only pre-select if not already chosen
        if (!langChosen) {
          setSelectedLang(detectedLang);
          localStorage.setItem("saheli_detected_lang", detectedLang);
        }
      },
      () => { /* Permission denied or error — silently ignore */ },
      { timeout: 5000, maximumAge: 600000 } // Cache for 10 min
    );
  }, [langChosen]);

  // Auto-trigger — open Saheli on first visit after 5 seconds
  useEffect(() => {
    const hasVisited = localStorage.getItem("saheli_visited");
    if (!hasVisited && mode === "closed") {
      const timer = setTimeout(() => {
        if (mode === "closed" && !langChosen) {
          setShowLangPicker(true);
        }
        localStorage.setItem("saheli_visited", "true");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [mode, langChosen]);

  // Close panel when product link is clicked
  useEffect(() => {
    const handler = () => setMode("closed");
    window.addEventListener("saheli-close", handler);
    return () => window.removeEventListener("saheli-close", handler);
  }, []);

  // Visibility
  useEffect(() => {
    const h = () => {
      if (document.hidden) {
        window.speechSynthesis.cancel(); setIsSpeaking(false);
        if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
        if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
        setIsListening(false);
      }
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [isListening]);

  // Detect if Web Speech API actually works (not just exists)
  // iPhone has webkitSpeechRecognition but it doesn't work — detect by checking for iOS
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const hasNativeSpeech = !isIOS && typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Native Speech Recognition — for Android/Desktop Chrome (free, instant)
  useEffect(() => {
    if (typeof window === "undefined" || !hasNativeSpeech) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
        stopTimer = setTimeout(() => { try { rec.stop(); } catch {} }, 1200);
      }
    };
    rec.onerror = () => { if (stopTimer) clearTimeout(stopTimer); setIsListening(false); };
    rec.onend = () => {
      if (stopTimer) clearTimeout(stopTimer);
      setIsListening(false); setMicReady(false);
      if (lastTranscriptRef.current.trim()) {
        setTimeout(() => window.dispatchEvent(new CustomEvent("saheli-voice-done")), 150);
      }
    };
    recognitionRef.current = rec;
  }, [hasNativeSpeech]);

  useEffect(() => { if (recognitionRef.current) recognitionRef.current.lang = LANG_CODES[selectedLang]?.speech || "en-IN"; }, [selectedLang]);

  // Voice Recording via MediaRecorder — fallback for iPhone (uses Gemini transcription)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const analyserRef = useRef<AnalyserNode | null>(null);

  const startRecording = useCallback(async () => {
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio analyser for live waveform
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);
        analyserRef.current = analyser;
      } catch {}

      // Pick a supported mime type — iPhone only supports mp4/m4a
      let mimeType = "audio/webm";
      if (typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
        else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
        else if (MediaRecorder.isTypeSupported("audio/aac")) mimeType = "audio/aac";
        else mimeType = ""; // Let browser choose default
      }
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        if (blob.size < 1000) { setIsListening(false); return; } // Too short, ignore
        // Send to transcription API
        setIsTranscribing(true);
        setInput("Transcribing...");
        try {
          const langName = LANG_CODES[selectedLang]?.name || "English";
          const formData = new FormData();
          formData.append("audio", blob, "recording." + (recorder.mimeType.includes("webm") ? "webm" : "mp4"));
          formData.append("language", langName);
          const res = await fetch("/api/transcribe", { method: "POST", body: formData });
          const data = await res.json();
          if (data.transcript && !data.empty) {
            setInput(data.transcript);
            lastTranscriptRef.current = data.transcript;
            // Auto-send after short delay
            setTimeout(() => window.dispatchEvent(new CustomEvent("saheli-voice-done")), 300);
          } else {
            setInput("");
          }
        } catch {
          setInput("");
        } finally {
          setIsTranscribing(false);
          setIsListening(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsListening(true);
      setInput("");
      lastTranscriptRef.current = "";
    } catch {
      alert("Please allow microphone access to use voice input.");
    }
  }, [isSpeaking, selectedLang]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      // Stop
      if (hasNativeSpeech && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      } else {
        stopRecording();
      }
    } else {
      // Start
      if (hasNativeSpeech && recognitionRef.current) {
        if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
        setInput(""); lastTranscriptRef.current = ""; setMicReady(false);
        recognitionRef.current.lang = LANG_CODES[selectedLang]?.speech || "en-IN";
        try { recognitionRef.current.start(); setIsListening(true); } catch {}
      } else {
        startRecording();
      }
    }
  }, [isListening, hasNativeSpeech, startRecording, stopRecording, isSpeaking, selectedLang]);

  // Flag: use server-side TTS for natural Indian voice (set to false to revert to browser TTS)
  const USE_SERVER_TTS = true;

  const speakText = useCallback((text: string, lang: string = selectedLang) => {
    if (isListening) {
      if (hasNativeSpeech && recognitionRef.current) recognitionRef.current.stop();
      else if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      setIsListening(false);
    }

    const clean = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").replace(/\*\*/g, "").replace(/\*/g, "").trim();
    if (!clean) return;

    if (USE_SERVER_TTS) {
      // Server-side TTS — natural Indian voice
      setIsSpeaking(true);
      fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, language: lang }),
      })
        .then(res => {
          if (!res.ok) throw new Error("TTS failed");
          return res.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
          audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
          audio.play().catch(() => setIsSpeaking(false));
        })
        .catch(() => {
          // Fallback to browser TTS if server fails
          setIsSpeaking(false);
          browserSpeak(clean, lang);
        });
    } else {
      browserSpeak(clean, lang);
    }
  }, [selectedLang, isListening]);

  // Browser TTS fallback
  const browserSpeak = useCallback((clean: string, lang: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    const speechLang = LANG_CODES[lang]?.speech || "en-IN";
    u.lang = speechLang; u.rate = 0.85; u.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = speechLang.split("-")[0];
    const v = voices.find(v => v.lang === speechLang)
      || voices.find(v => v.lang.startsWith(langPrefix) && (v.name.includes("India") || v.name.includes(" IN")))
      || voices.find(v => v.lang.startsWith(langPrefix) && !v.lang.includes("US"))
      || voices.find(v => v.lang.startsWith(langPrefix));
    if (v) u.voice = v;
    u.onstart = () => setIsSpeaking(true); u.onend = () => setIsSpeaking(false); u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  // Language select
  const handleLangSelect = useCallback((lang: string) => {
    setSelectedLang(lang); setLangChosen(true); setShowLangPicker(false);
    // Context-aware greeting based on current page
    let msg: string;
    const productName = productId ? products.find(p => p.id === productId)?.name : null;

    if (context === "pdp" && productName) {
      const pdpGreetings: Record<string, string> = {
        en: `Namaste! I'm Saheli. Do you like ${productName}? Any doubts about quality, size or fit? Or shall I show more options?`,
        hi: `Namaste! Main Saheli hoon... kya aapko ${productName} pasand aaya? Koi doubt hai quality, size ya fit ke baare mein? Ya aur options dikhaaun?`,
        te: `Namaskaram! Nenu Saheli. ${productName} meeku nachinda? Quality, size gurinchi emannina doubts unnaya? Leda inka options chupinchana?`,
        ta: `Vanakkam! Naan Saheli. ${productName} ungalukku pudichuda? Quality, size pathi enna doubt? Vera options venuma?`,
        kn: `Namaskara! Naanu Saheli. ${productName} nimge ishta aayitha? Quality, size bagge yavude doubt ide? Bere options toorsnaa?`,
        ml: `Namaskaram! Njan Saheli. ${productName} ishtamaayo? Quality, size kurichu enkilum samsayam undo? Verey options kaanikkatte?`,
        bn: `Nomoshkar! Ami Saheli. ${productName} apnar pochondo hoyeche? Quality, size niye kono proshno ache? Aro options dekhaben?`,
        mr: `Namaskar! Mi Saheli. ${productName} tumhala aavadla? Quality, size baaddal kahi shanka aahe? Aankhi options dakhvu?`,
        gu: `Namaste! Hu Saheli chhu. ${productName} tamne gamyu? Quality, size vishe koi doubt chhe? Bija options batavu?`,
        pa: `Sat Sri Akal! Main Saheli haan. ${productName} tuhanoo pasand aaya? Quality, size baare koi doubt? Hor options dikhaavan?`,
        or: `Namaskar! Mu Saheli. ${productName} apananku bhala lagila? Quality, size baare kichu doubt achhi? Aau options dekhibe?`,
        ur: `Aadaab! Main Saheli hoon. ${productName} pasand aaya? Quality, size ke baare mein koi sawaal? Ya aur options dikhaaun?`,
      };
      msg = pdpGreetings[lang] || pdpGreetings.en;
    } else {
      const greetings: Record<string, string> = {
        en: "Namaste! I'm Saheli... you can talk to me in your language and shop easily. What would you like to see?",
        hi: "Namaste! Main Saheli hoon... aap mujhse apni bhasha mein baat karke shopping kar sakte hain. Aaj kya dekhna chahenge?",
        te: "Namaskaram! Nenu Saheli. Mee bhashaloni naatho maatlaadi shopping cheyavachchu. Emi chudaalanukunnarru?",
        ta: "Vanakkam! Naan Saheli. Ungal mozhiyil ennudan pesi shopping seyyalaam. Enna paarkanum?",
        kn: "Namaskara! Naanu Saheli. Nimma bhaasheyalli naanu maathaadi shopping maadbahudu. Enu nodbekku?",
        ml: "Namaskaram! Njan Saheli. Ningalude bhaashayil ennod samsaarikku, shopping cheyyaam. Entha kaanikkatte?",
        bn: "Nomoshkar! Ami Saheli. Apnar bhaashay aamar sathe kotha bole shopping korte parben. Ki dekhben?",
        mr: "Namaskar! Mi Saheli. Tumchya bhashet majhyashi bola ani shopping kara. Kay baghayche aahe?",
        gu: "Namaste! Hu Saheli chhu. Tamari bhaasha ma mari sathe vaat kari ne shopping kari shako chho. Shu jovanu chhe?",
        pa: "Sat Sri Akal! Main Saheli haan. Apni boli vich mere naal gall karo te shopping karo. Ki dekhna chahoge?",
        or: "Namaskar! Mu Saheli. Apana bhasare mora sathe katha karantu ebam shopping karantu. Kana dekhibe?",
        ur: "Aadaab! Main Saheli hoon. Aap apni zuban mein mujhse baat karke shopping kar sakte hain. Aaj kya dekhna chahenge?",
      };
      msg = greetings[lang] || greetings.en;
    }
    setMessages([{ role: "assistant", content: msg, emotion: "greeting", timestamp: Date.now() }]);
    setMode("voice");
    setTimeout(() => speakText(msg, lang), 500);
  }, [speakText]);

  const isSendingRef = useRef(false);
  const sendMessage = async () => {
    // Prevent double-send
    if (isSendingRef.current) return;
    // Use transcript ref if available (voice), otherwise use input state
    const textToSend = lastTranscriptRef.current.trim() || input.trim();
    if (!textToSend || textToSend === "Transcribing..." || isLoading) return;
    isSendingRef.current = true;
    const wasVoice = lastTranscriptRef.current.trim() !== "";
    const userMsg: Message = { role: "user", content: textToSend, language: selectedLang, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput(""); lastTranscriptRef.current = ""; setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })), language: selectedLang, sessionId: sessionIdRef.current, inputMode: wasVoice ? "voice" : "text", currentPage: context || "homepage", currentProductId: productId, triggerType: "user-initiated" }),
      });
      const data = await res.json();
      const aMsg: Message = { role: "assistant", content: data.reply, emotion: data.emotion || "happy", productsToShow: data.productsToShow, language: data.detectedLanguage || selectedLang, timestamp: Date.now() };
      setMessages(prev => [...prev, aMsg]);
      if (data.detectedLanguage && data.detectedLanguage !== selectedLang) setSelectedLang(data.detectedLanguage);
      // Switch to chat mode after 2 exchanges so user can see full conversation
      const userMsgCount = [...messages, userMsg].filter(m => m.role === "user").length;
      if (mode === "voice" && (userMsgCount >= 2 || (data.productsToShow && data.productsToShow.length > 0))) setMode("chat");
      speakText(data.reply, data.detectedLanguage || selectedLang);
      if (data.productsToShow?.length && onNavigate) onNavigate(data.productsToShow);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong!", timestamp: Date.now() }]);
    } finally { setIsLoading(false); isSendingRef.current = false; }
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
        <div className={`bg-gray-900/95 backdrop-blur text-white rounded-2xl rounded-br-sm shadow-2xl p-3 max-w-[200px] sm:max-w-[240px] border border-amber-500/20 ${showLangPicker ? "" : "animate-bounce"}`}
          style={{ animationIterationCount: 3, animationDuration: "1s" }}>
          <p className="text-xs sm:text-sm leading-relaxed">
            {context === "pdp" ? "Kya aapko ye product pasand aaya?" : "Namaste! Need help shopping?"}
          </p>
          {cart.length > 0 && <p className="text-[10px] text-amber-400 mt-1">🛒 {cart.length} items in cart</p>}
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
            <p className="text-gray-500 text-xs mb-3 text-center">
              {selectedLang !== "en" ? `We detected ${LANG_CODES[selectedLang]?.name} — tap to confirm or choose another` : "Apni bhasha chunein"}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(LANG_CODES).map(([code, lang]) => (
                <button key={code} onClick={() => handleLangSelect(code)}
                  className={`py-2.5 px-1 rounded-xl border text-center transition-all ${selectedLang === code ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500" : "border-gray-700 hover:border-amber-500 hover:bg-amber-500/10"}`}>
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
            {isTranscribing ? (
              <>
                <p className="text-amber-400 text-sm mb-3">Transcribing your voice...</p>
                <div className="flex gap-2 justify-center">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </>
            ) : isListening ? (
              <>
                <p className="text-gray-300 text-sm mb-3 max-w-xs mx-auto">
                  {input ? `"${input}"` : "Listening to you..."}
                </p>
                {/* Waveform */}
                <div className="flex items-end justify-center gap-1 h-10">
                  {waveBars.map((h, i) => (
                    <div key={i} className="w-1.5 bg-amber-500 rounded-full transition-all duration-150" style={{ height: `${h * 3}px` }} />
                  ))}
                </div>
                <p className="text-red-400 text-xs mt-3 flex items-center justify-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  TAP WHEN DONE
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
                {lastAssistantMsg.content.length > 200 ? lastAssistantMsg.content.slice(0, 200) + "..." : lastAssistantMsg.content}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-center gap-8 pb-8 pt-4 px-6">
          {/* Exit */}
          <div className="flex flex-col items-center gap-1">
            <button onClick={() => { if (isListening) { toggleListening(); } window.speechSynthesis.cancel(); setIsSpeaking(false); setMode("closed"); }}
              className="w-12 h-12 sm:w-14 sm:h-14 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors">
              <span className="text-xl">✕</span>
            </button>
            <span className="text-[10px] text-gray-600">Exit</span>
          </div>

          {/* Mic — big center button */}
          <div className="flex flex-col items-center gap-1">
          <button onClick={() => toggleListening()}
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isListening
                ? "bg-red-500 text-white ring-4 ring-red-500/30 animate-pulse"
                : isTranscribing
                ? "bg-amber-600 text-white opacity-50"
                : "bg-gradient-to-br from-amber-600 to-orange-700 text-white hover:from-amber-500 hover:to-orange-600"
            }`}
            disabled={isTranscribing || isLoading}>
            <span className="text-2xl sm:text-3xl">{isListening ? "⏹" : "🎤"}</span>
          </button>
            <span className="text-[10px] text-gray-600">{isTranscribing ? "Processing..." : isListening ? "Tap to stop" : "Speak"}</span>
          </div>

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
          {cart.length > 0 && (
            <button onClick={() => setShowCart(!showCart)} className="text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded-full hover:bg-amber-500 transition-colors">🛒 {cart.length}</button>
          )}
          <button onClick={() => setMode("voice")} className="text-gray-500 hover:text-amber-400 text-lg">🎤</button>
          <button onClick={() => setMode("closed")} className="text-gray-400 hover:text-white text-xl ml-1">✕</button>
        </div>
      </div>

      {/* Cart Drawer */}
      {showCart && cart.length > 0 && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 max-h-64 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-white">🛒 Cart ({cart.length} items)</span>
            <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-white text-xs">✕</button>
          </div>
          {cart.map(id => {
            const p = products.find(x => x.id === id);
            if (!p) return null;
            return (
              <div key={id} className="flex items-center gap-2 py-1.5 border-b border-gray-700/50">
                <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-200 truncate">{p.name}</p>
                  <p className="text-[11px] text-amber-400 font-bold">₹{p.price.toLocaleString()}</p>
                </div>
                <button onClick={() => { setCart(prev => { const updated = prev.filter(x => x !== id); localStorage.setItem("saheli_cart", JSON.stringify(updated)); return updated; }); }}
                  className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
              </div>
            );
          })}
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700">
            <span className="text-sm text-white font-bold">Total: ₹{cart.reduce((sum, id) => { const p = products.find(x => x.id === id); return sum + (p?.price || 0); }, 0).toLocaleString()}</span>
            <button onClick={() => { alert("Order placed! 🎉 (demo)"); setCart([]); localStorage.removeItem("saheli_cart"); setShowCart(false); }}
              className="bg-green-600 text-white text-xs px-4 py-1.5 rounded-lg font-medium hover:bg-green-500">Order Now</button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === "user"
                ? "bg-amber-600 text-white rounded-br-sm"
                : "bg-gray-800/90 text-gray-200 border border-gray-700/50 rounded-bl-sm"
            }`}>
              {msg.role === "assistant"
                ? <MessageWithCards text={msg.content} productIds={msg.productsToShow} onAddToCart={addToCart} />
                : <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              }
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

      {/* Listening / Transcribing indicator */}
      {(isListening || isTranscribing) && (
        <div className="px-4 py-2 bg-gray-900/80 border-t border-gray-800">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">
              {isTranscribing ? "Transcribing..." : "Recording... tap mic when done"}
            </span>
          </div>
        </div>
      )}

      {/* Cart Toast */}
      {cartToast && (
        <div className="px-4 py-2 bg-green-500/20 border-t border-green-500/30 text-center">
          <span className="text-xs text-green-400 font-medium">✓ {cartToast}</span>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 bg-gray-900/95 border-t border-gray-800">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <button onClick={() => toggleListening()}
            disabled={isTranscribing || isLoading}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
              isListening ? "bg-red-500 text-white animate-pulse" : isTranscribing ? "bg-amber-600 text-white opacity-50" : "bg-gray-800 text-gray-400 hover:text-amber-400"
            }`}>
            {isListening ? "⏹" : "🎤"}
          </button>
          <input ref={inputRef} type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Message Saheli...`}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            disabled={isLoading || !langChosen} />
          <button id="saheli-send-btn" onClick={sendMessage} disabled={isLoading || isTranscribing || (!input.trim() && !lastTranscriptRef.current.trim())}
            className="w-10 h-10 bg-amber-600 text-white rounded-full flex items-center justify-center hover:bg-amber-500 disabled:opacity-30 transition-colors flex-shrink-0">
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

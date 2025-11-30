import React, { useEffect, useRef, useState } from 'react';
import { 
  Mic, MicOff, Globe, BookOpen, Star, 
  Stethoscope, Briefcase, Coffee, Plane,
  Zap, MessageCircle, BarChart, ChevronLeft, Award, Sparkles
} from 'lucide-react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { AudioVisualizer } from './components/AudioVisualizer';

// --- Configuration Types ---
type SessionMode = 'chat' | 'roleplay' | 'challenge';

interface PersonaConfig {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  color: string;
  systemInstruction: string;
  initialPrompt?: string;
}

// --- Prompts ---
const CORRECTION_RULE = `
IMPORTANT CORRECTION RULE:
If the user makes a grammar, vocabulary, or pronunciation mistake, you MUST start your response with a correction formatted EXACTLY like this:
*Correction: [The Corrected Sentence]*
Then, continue the conversation naturally on a new line. Do not lecture, just correct and continue.
`;

const BASE_INSTRUCTION = `
You are "Teacher Kamala", a warm, friendly, and patient English tutor for a Sri Lankan student. 
Your goal is to help the user improve their spoken English skills through real-time conversation.

Core Behaviors:
1. **Conversational Practice:** Chat about daily topics to get the student speaking.
2. **Sinhala Support:** You are fluent in Sinhala. If the user speaks Sinhala, explain in Sinhala but encourage them to speak English.
3. **Pacing:** Keep responses short (1-3 sentences).
${CORRECTION_RULE}
`;

const ROLEPLAY_BASE = `
You are participating in a roleplay scenario. 
1. Act convincingly as the specified character.
2. If the user struggles or asks for help in Sinhala, briefly break character to explain in Sinhala, then resume the role.
3. Keep the conversation moving.
${CORRECTION_RULE}
`;

const CHALLENGE_INSTRUCTION = `
You are an English Examiner. 
1. Present the speaking challenge topic clearly.
2. Listen to the user's response.
3. After they finish speaking about the topic (or if they stop for a while), provide a structured feedback report.
4. Start the report with "FEEDBACK:".
5. Rate them on: Pronunciation, Grammar, and Vocabulary (use 1-5 stars).
6. Give 1 specific tip for improvement.
`;

// --- Data ---
const PERSONAS: PersonaConfig[] = [
  {
    id: 'doctor',
    name: 'Dr. Perera',
    role: 'Doctor Consultation',
    icon: <Stethoscope size={24} />,
    color: 'bg-blue-100 text-blue-600',
    systemInstruction: `${ROLEPLAY_BASE} You are a helpful Doctor. The user is a patient describing symptoms. Ask clarifying questions.`,
  },
  {
    id: 'interview',
    name: 'Ms. Silva',
    role: 'Job Interview',
    icon: <Briefcase size={24} />,
    color: 'bg-purple-100 text-purple-600',
    systemInstruction: `${ROLEPLAY_BASE} You are an HR Manager conducting a job interview. Ask professional questions about experience and strengths.`,
  },
  {
    id: 'cafe',
    name: 'Barista',
    role: 'Ordering Coffee',
    icon: <Coffee size={24} />,
    color: 'bg-amber-100 text-amber-700',
    systemInstruction: `${ROLEPLAY_BASE} You are a barista at a cafe. Take the user's order, ask about preferences (sugar, milk), and be friendly.`,
  },
  {
    id: 'travel',
    name: 'Tourist Guide',
    role: 'Travel Info',
    icon: <Plane size={24} />,
    color: 'bg-emerald-100 text-emerald-600',
    systemInstruction: `${ROLEPLAY_BASE} You are a tourist guide in Sri Lanka. Help the user plan a trip or give directions.`,
  },
];

const DAILY_CHALLENGE = {
  title: "Morning Routine",
  description: "Describe what you do every morning in 3-4 sentences.",
  instruction: `${CHALLENGE_INSTRUCTION} The topic is 'Morning Routine'. Ask the user to describe their morning.`,
};

const App: React.FC = () => {
  const { 
    connected, 
    connect, 
    disconnect, 
    sendTextMessage,
    volumeLevel, 
    transcripts,
    error 
  } = useGeminiLive();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'home' | 'session'>('home');
  const [activeConfig, setActiveConfig] = useState<PersonaConfig | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // --- Actions ---

  const startSession = (config: PersonaConfig) => {
    setActiveConfig(config);
    setView('session');
    connect({
      systemInstruction: config.systemInstruction,
      voiceName: 'Kore'
    });
  };

  const startFreeChat = () => {
    startSession({
      id: 'teacher',
      name: 'Teacher Kamala',
      role: 'Friendly Tutor',
      icon: <BookOpen size={24} />,
      color: 'bg-emerald-100 text-emerald-600',
      systemInstruction: BASE_INSTRUCTION
    });
  };

  const startChallenge = () => {
    startSession({
      id: 'challenge',
      name: 'Speaking Coach',
      role: 'Daily Challenge',
      icon: <Award size={24} />,
      color: 'bg-orange-100 text-orange-600',
      systemInstruction: DAILY_CHALLENGE.instruction
    });
  };

  const handleEndSession = () => {
    disconnect();
    setView('home');
    setActiveConfig(null);
  };

  const requestAnalysis = () => {
    // Send a hidden text message to the model to trigger feedback
    sendTextMessage("Pause the conversation. Provide a 'Speaking Scorecard' based on my speech so far. \n1. Rate Pronunciation, Grammar, and Fluency (1-5 stars).\n2. List 1-2 specific mistakes I made and how to fix them.\n3. Give one tip to sound more natural.\nStart the response with 'FEEDBACK:'.");
  };

  // --- Helper to Render Text with Corrections ---
  const renderMessageText = (text: string) => {
    // Looks for patterns like *Correction: ...* and highlights them
    // Also handles formatting for Feedback reports
    
    // Split by correction pattern
    const parts = text.split(/(\*Correction:.*?\*)/g);
    
    return parts.map((part, index) => {
      // Handle Correction Box
      if (part.startsWith('*Correction:') && part.endsWith('*')) {
        const content = part.replace(/\*/g, ''); // Remove asterisks
        return (
          <div key={index} className="my-2 bg-rose-50 border-l-4 border-rose-400 p-2 rounded-r text-xs text-rose-800 font-medium shadow-sm">
             <div className="flex items-center gap-1 mb-1 text-rose-600 font-bold uppercase tracking-wider text-[10px]">
                <Sparkles size={10} /> Improved Version
             </div>
             {content.replace('Correction:', '').trim()}
          </div>
        );
      }
      
      // Handle normal text (with basic newline handling)
      return (
        <span key={index}>
          {part.split('\n').map((line, i) => (
             <React.Fragment key={i}>
                {line}
                {i < part.split('\n').length - 1 && <br />}
             </React.Fragment>
          ))}
        </span>
      );
    });
  };

  // --- Views ---

  if (view === 'home') {
    return (
      <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 rounded-b-[2rem] shadow-xl mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">FluentSpeak</h1>
              <p className="text-emerald-100 text-sm font-medium">Your Personal AI English Tutor</p>
            </div>
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md border border-white/10 shadow-lg">
              <Globe size={24} className="text-white" />
            </div>
          </div>
          
          {/* Daily Challenge Card */}
          <div className="bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur-md shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Award size={80} />
            </div>
            <div className="flex items-center gap-2 mb-2 text-orange-200">
              <Zap size={18} fill="currentColor" />
              <span className="text-xs font-bold uppercase tracking-wider">Today's Challenge</span>
            </div>
            <h3 className="text-xl font-bold mb-2">{DAILY_CHALLENGE.title}</h3>
            <p className="text-sm text-emerald-50 mb-4 pr-8 opacity-90">{DAILY_CHALLENGE.description}</p>
            <button 
              onClick={startChallenge}
              className="w-full bg-white text-emerald-800 font-bold py-3 rounded-xl text-sm hover:bg-emerald-50 transition-colors shadow-sm"
            >
              Start Speaking Challenge
            </button>
          </div>
        </div>

        <div className="px-6 pb-8 space-y-8">
          {/* Quick Start */}
          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <MessageCircle size={20} className="text-emerald-600" />
              Free Practice
            </h2>
            <button 
              onClick={startFreeChat}
              className="w-full bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-emerald-400 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-emerald-100 text-emerald-600 p-4 rounded-full group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Mic size={24} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-slate-800 text-lg">Talk with Teacher Kamala</h3>
                  <p className="text-sm text-slate-500">Casual chat • Instant corrections • Sinhala help</p>
                </div>
              </div>
              <div className="text-emerald-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                Start &rarr;
              </div>
            </button>
          </section>

          {/* Roleplay Grid */}
          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Star size={20} className="text-purple-600" />
              Roleplay Scenarios
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {PERSONAS.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => startSession(persona)}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center gap-4 hover:shadow-md hover:border-purple-300 transition-all text-center group"
                >
                  <div className={`p-4 rounded-full ${persona.color} group-hover:scale-110 transition-transform`}>
                    {persona.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 mb-1">{persona.role}</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">{persona.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // --- Session View ---
  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Session Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-10 sticky top-0">
        <button 
          onClick={handleEndSession}
          className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="font-bold text-slate-800 text-sm">{activeConfig?.role}</h2>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full mt-0.5">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             Live Session
          </div>
        </div>
        <div className="w-8" /> {/* Spacer */}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Transcript */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 scroll-smooth" 
          ref={scrollRef}
        >
          {transcripts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-6">
              <div className={`p-8 rounded-full bg-white shadow-lg ${activeConfig?.color} animate-pulse`}>
                {activeConfig?.icon}
              </div>
              <div className="text-center space-y-2">
                <p className="font-medium text-slate-600">Start speaking...</p>
                <p className="text-xs text-slate-400">Say "Hello" to begin the lesson</p>
              </div>
            </div>
          )}

          {transcripts.map((t, i) => (
            <div 
              key={i} 
              className={`flex w-full ${t.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm transition-all duration-300
                  ${t.isAnalysis 
                    ? 'bg-amber-50 border border-amber-200 text-slate-800 w-full shadow-md' 
                    : t.isUser 
                      ? 'bg-emerald-600 text-white rounded-tr-none shadow-emerald-200' 
                      : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                  }
                `}
              >
                {!t.isUser && !t.isAnalysis && (
                  <div className="flex items-center gap-2 mb-1.5 opacity-50">
                    <span className="text-[10px] font-bold uppercase tracking-wider">{activeConfig?.name}</span>
                  </div>
                )}
                
                {t.isAnalysis && (
                  <div className="flex items-center gap-2 mb-3 text-amber-700 font-bold border-b border-amber-200 pb-2">
                    <BarChart size={18} />
                    <span>Speaking Scorecard</span>
                  </div>
                )}

                {/* Content Render with Highlighted Corrections */}
                <div className="whitespace-pre-wrap">
                  {renderMessageText(t.text)}
                </div>
              </div>
            </div>
          ))}
          <div className="h-4" />
        </div>

        {/* Visualizer Area */}
        <div className="flex-none bg-white border-t border-slate-100 p-4 pb-8 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] z-20 rounded-t-3xl">
            {/* Feedback Button */}
            {connected && activeConfig?.id !== 'challenge' && (
               <div className="flex justify-center mb-6">
                 <button 
                   onClick={requestAnalysis}
                   className="text-xs font-medium bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full flex items-center gap-2 hover:bg-indigo-100 transition-colors border border-indigo-100 shadow-sm"
                 >
                   <BarChart size={14} />
                   Analyze my speaking
                 </button>
               </div>
            )}

            <div className="flex items-center justify-between gap-6 max-w-sm mx-auto px-4">
              {/* Visualizer */}
              <div className="flex-1 flex justify-center h-12">
                 <AudioVisualizer isConnected={connected} volume={volumeLevel} />
              </div>

              {/* Mic Control */}
              <button
                onClick={connected ? disconnect : () => connect({ systemInstruction: activeConfig?.systemInstruction || BASE_INSTRUCTION })}
                className={`
                  flex-none w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 duration-200
                  ${connected 
                    ? 'bg-rose-500 text-white ring-4 ring-rose-100 hover:bg-rose-600' 
                    : 'bg-emerald-600 text-white ring-4 ring-emerald-100 hover:bg-emerald-700'
                  }
                `}
              >
                {connected ? <MicOff size={28} /> : <Mic size={28} />}
              </button>
            </div>
        </div>

        {/* Error Toast */}
        {error && (
          <div className="absolute bottom-32 left-4 right-4 bg-red-50 text-red-800 p-4 rounded-xl text-sm border border-red-200 shadow-xl text-center animate-bounce flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            {error}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
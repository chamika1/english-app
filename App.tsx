import React, { useEffect, useRef, useState } from 'react';
import { 
  Mic, MicOff, Globe, BookOpen, Star, 
  Stethoscope, Briefcase, Coffee, Plane,
  Zap, MessageCircle, BarChart, ChevronLeft, Award, Sparkles, Lightbulb,
  ShoppingBag, Smartphone, Home, Plus, X, Trash2, User
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
  isCustom?: boolean;
}

// --- Prompts ---
const CORRECTION_RULE = `
IMPORTANT CORRECTION RULE:
If the user makes a grammar, vocabulary, or pronunciation mistake, you MUST start your response with a correction formatted EXACTLY like this:
*Correction: [The Corrected Sentence]*
`;

const BASE_INSTRUCTION = `
You are "Teacher Kamala", a proactive, inquisitive, and friendly English tutor.
IMPORTANT: You are NOT a customer service agent. NEVER ask "How can I help you?" or "What can I do for you?".

Your Approach:
1. **Lead the Conversation:** Treat the user like a friend you are teaching. Start by asking a personal question like "How was your day?", "What did you eat for breakfast?", or "Do you have any exciting plans?".
2. **Teach the Lesson:** When the user makes a mistake, first provide the *Correction: ...*, and then BRIEFLY EXPLAIN the grammar rule or why it was wrong (a mini-lesson).
3. **Keep it Going:** Always end your turn with a follow-up question to keep the user speaking.
4. **English Only:** Speak ONLY in English.

${CORRECTION_RULE}
`;

const ROLEPLAY_BASE = `
You are participating in a roleplay scenario. 
1. Act convincingly as the specified character.
2. Speak ONLY in English. Do NOT speak Sinhala. Even if the user speaks another language, reply only in English to maintain immersion.
3. Keep the conversation moving.
${CORRECTION_RULE}
After the correction, simply continue the roleplay character's dialogue naturally. Do NOT stop to explain the grammar rule unless the user asks, just keep the flow.
`;

const CHALLENGE_INSTRUCTION = `
You are an English Examiner. 
1. Present the speaking challenge topic clearly.
2. Speak ONLY in English.
3. Listen to the user's response.
4. After they finish speaking about the topic (or if they stop for a while), provide a structured feedback report.
5. Start the report with "FEEDBACK:".
6. Rate them on: Pronunciation, Grammar, and Vocabulary (use 1-5 stars).
7. Give 1 specific tip for improvement.
`;

// --- Data ---
const PRESET_PERSONAS: PersonaConfig[] = [
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
  {
    id: 'shopping',
    name: 'Sales Associate',
    role: 'Clothes Shopping',
    icon: <ShoppingBag size={24} />,
    color: 'bg-pink-100 text-pink-600',
    systemInstruction: `${ROLEPLAY_BASE} You are a sales associate in a clothing store. Help the user find sizes, colors, and styles.`,
  },
  {
    id: 'tech',
    name: 'Tech Support',
    role: 'IT Help Desk',
    icon: <Smartphone size={24} />,
    color: 'bg-cyan-100 text-cyan-600',
    systemInstruction: `${ROLEPLAY_BASE} You are a tech support agent. The user has a problem with their device. Guide them through troubleshooting steps.`,
  },
  {
    id: 'estate',
    name: 'Real Estate Agent',
    role: 'House Hunting',
    icon: <Home size={24} />,
    color: 'bg-indigo-100 text-indigo-600',
    systemInstruction: `${ROLEPLAY_BASE} You are a real estate agent showing an apartment. Discuss rent, amenities, and lease terms.`,
  },
];

const CHALLENGE_TEMPLATES = [
  { title: "Morning Routine", description: "Describe your typical morning routine in detail. What do you do first?", topic: "Morning Routine" },
  { title: "Dream Vacation", description: "Talk about a place you have always wanted to visit and why.", topic: "Dream Vacation" },
  { title: "Favorite Movie", description: "Tell me about your favorite movie. What is the story and why do you like it?", topic: "Favorite Movie" },
  { title: "Healthy Living", description: "What do you do to stay healthy? Discuss your diet and exercise habits.", topic: "Healthy Living" },
  { title: "Future Goals", description: "Where do you see yourself in 5 years? What are your career goals?", topic: "Future Goals" },
  { title: "A Memorable Meal", description: "Describe the best meal you've ever had. What did it taste like?", topic: "A Memorable Meal" },
  { title: "Technology", description: "How has technology changed your daily life recently?", topic: "Technology Impact" },
  { title: "My Hobby", description: "Teach me about a hobby you enjoy. How did you get started?", topic: "My Hobby" },
  { title: "Weather & Seasons", description: "Describe the weather today and tell me about your favorite season.", topic: "Weather & Seasons" },
  { title: "Family Traditions", description: "Talk about a tradition your family follows during holidays.", topic: "Family Traditions" },
];

export const App: React.FC = () => {
  const { 
    connected, 
    connect, 
    disconnect, 
    volumeLevel, 
    transcripts,
    error 
  } = useGeminiLive();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'home' | 'session'>('home');
  const [activeConfig, setActiveConfig] = useState<PersonaConfig | null>(null);
  
  // Custom Scenario State
  const [customPersonas, setCustomPersonas] = useState<PersonaConfig[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newScenario, setNewScenario] = useState({ title: '', role: '', description: '' });

  // Random Daily Challenge State
  const [dailyChallenge] = useState(() => {
    const randomIndex = Math.floor(Math.random() * CHALLENGE_TEMPLATES.length);
    const template = CHALLENGE_TEMPLATES[randomIndex];
    return {
      title: template.title,
      description: template.description,
      instruction: `${CHALLENGE_INSTRUCTION} The topic is '${template.topic}'. Ask the user to describe: ${template.description}.`
    };
  });

  // Load custom scenarios from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('customPersonas');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // We need to re-attach the icon component since JSON doesn't store functions/components
        const rehydrated = parsed.map((p: any) => ({
          ...p,
          icon: <User size={24} />
        }));
        setCustomPersonas(rehydrated);
      } catch (e) {
        console.error("Failed to load custom personas", e);
      }
    }
  }, []);

  // Save custom scenarios
  const saveCustomPersonas = (updated: PersonaConfig[]) => {
    setCustomPersonas(updated);
    // Strip the icon component before saving to avoid circular structure issues
    const toSave = updated.map(({ icon, ...rest }) => rest);
    localStorage.setItem('customPersonas', JSON.stringify(toSave));
  };

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
      systemInstruction: dailyChallenge.instruction
    });
  };

  const handleCreateCustom = () => {
    if (!newScenario.title || !newScenario.role || !newScenario.description) return;

    const newPersona: PersonaConfig = {
      id: `custom-${Date.now()}`,
      name: newScenario.role,
      role: newScenario.title,
      icon: <User size={24} />,
      color: 'bg-slate-200 text-slate-700',
      isCustom: true,
      systemInstruction: `${ROLEPLAY_BASE} You are acting as: ${newScenario.role} in a scenario about: ${newScenario.title}. 
      Context/Situation: ${newScenario.description}.
      Engage the user in this specific scenario.`,
    };

    saveCustomPersonas([...customPersonas, newPersona]);
    setShowCreateModal(false);
    setNewScenario({ title: '', role: '', description: '' });
  };

  const deleteCustom = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = customPersonas.filter(p => p.id !== id);
    saveCustomPersonas(updated);
  };

  const handleEndSession = () => {
    disconnect();
    setView('home');
    setActiveConfig(null);
  };

  // --- Helper to Render Text with Corrections ---
  const renderMessageText = (text: string) => {
    const parts = text.split(/(\*Correction:.*?\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('*Correction:') && part.endsWith('*')) {
        const content = part.replace(/\*/g, '');
        return (
          <div key={index} className="my-2 bg-rose-50 border-l-4 border-rose-400 p-2 rounded-r text-xs text-rose-800 font-medium shadow-sm">
             <div className="flex items-center gap-1 mb-1 text-rose-600 font-bold uppercase tracking-wider text-[10px]">
                <Sparkles size={10} /> Improved Version
             </div>
             {content.replace('Correction:', '').trim()}
          </div>
        );
      }
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
      <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900 overflow-y-auto relative">
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
            <h3 className="text-xl font-bold mb-2">{dailyChallenge.title}</h3>
            <p className="text-sm text-emerald-50 mb-4 pr-8 opacity-90">{dailyChallenge.description}</p>
            <button 
              onClick={startChallenge}
              className="w-full bg-white text-emerald-800 font-bold py-3 rounded-xl text-sm hover:bg-emerald-50 transition-colors shadow-sm"
            >
              Start Speaking Challenge
            </button>
          </div>
        </div>

        <div className="px-6 pb-24 space-y-8">
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
                  <p className="text-sm text-slate-500">Interactive lessons • Explains mistakes • English Only</p>
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
              {/* Create Custom Button */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-slate-100 border-2 border-dashed border-slate-300 p-5 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-200 hover:border-slate-400 transition-all group h-full min-h-[140px]"
              >
                <div className="p-3 bg-white rounded-full shadow-sm text-slate-500 group-hover:scale-110 transition-transform">
                  <Plus size={24} />
                </div>
                <span className="text-sm font-bold text-slate-600">Create Custom</span>
              </button>

              {/* Render Presets */}
              {PRESET_PERSONAS.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => startSession(persona)}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center gap-4 hover:shadow-md hover:border-purple-300 transition-all text-center group relative overflow-hidden"
                >
                  <div className={`p-4 rounded-full ${persona.color} group-hover:scale-110 transition-transform`}>
                    {persona.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 mb-1 leading-tight">{persona.role}</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold truncate max-w-[100px] mx-auto">{persona.name}</p>
                  </div>
                </button>
              ))}

              {/* Render Custom Scenarios */}
              {customPersonas.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => startSession(persona)}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center gap-4 hover:shadow-md hover:border-purple-300 transition-all text-center group relative overflow-hidden"
                >
                  <div 
                    onClick={(e) => deleteCustom(e, persona.id)}
                    className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
                  >
                    <Trash2 size={14} />
                  </div>
                  <div className={`p-4 rounded-full ${persona.color} group-hover:scale-110 transition-transform`}>
                    {persona.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 mb-1 leading-tight">{persona.role}</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold truncate max-w-[100px] mx-auto">{persona.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Modal for Creating Custom Scenario */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">Create Scenario</h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Scenario Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Negotiating Salary"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={newScenario.title}
                    onChange={(e) => setNewScenario({...newScenario, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teacher's Role</label>
                  <input 
                    type="text" 
                    placeholder="e.g. My Boss"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={newScenario.role}
                    onChange={(e) => setNewScenario({...newScenario, role: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Situation / Goal</label>
                  <textarea 
                    placeholder="e.g. I want to ask for a raise because I finished a big project."
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 h-24 resize-none"
                    value={newScenario.description}
                    onChange={(e) => setNewScenario({...newScenario, description: e.target.value})}
                  />
                </div>
              </div>

              <div className="p-6 pt-2 bg-slate-50 rounded-b-2xl border-t border-slate-100">
                <button 
                  onClick={handleCreateCustom}
                  disabled={!newScenario.title || !newScenario.role || !newScenario.description}
                  className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Create & Start
                </button>
              </div>
            </div>
          </div>
        )}
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
                <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-xl text-xs max-w-[200px] mx-auto border border-blue-100">
                  <span className="font-bold block mb-1">💡 Tip:</span>
                  Ask "How was my speaking?" anytime to get a full scorecard.
                </div>
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

          {/* Spacer for bottom controls */}
          <div className="h-24" />
        </div>

        {/* Controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4">
          <div className="bg-white rounded-[2rem] shadow-2xl p-2 pl-6 flex items-center justify-between border border-slate-100">
            {/* Visualizer */}
            <div className="h-12 flex items-center gap-1 w-24">
              <AudioVisualizer isConnected={connected} volume={volumeLevel} />
            </div>

            {/* Error Message */}
            {error && (
               <div className="absolute -top-16 left-0 right-0 mx-4 p-3 bg-red-100 text-red-700 text-xs rounded-xl text-center border border-red-200 shadow-lg">
                 {error}
               </div>
            )}

            {/* Mic Button */}
            <button
              onClick={() => connected ? disconnect() : connect({
                 systemInstruction: activeConfig?.systemInstruction || BASE_INSTRUCTION
              })}
              className={`
                w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform hover:scale-105
                ${connected 
                  ? 'bg-red-500 text-white shadow-red-200 hover:bg-red-600' 
                  : 'bg-emerald-500 text-white shadow-emerald-200 hover:bg-emerald-600'
                }
              `}
            >
              {connected ? <MicOff size={28} /> : <Mic size={28} />}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

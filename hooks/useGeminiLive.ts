import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decodeAudioData, decode } from '../utils/audioUtils';

export interface TranscriptItem {
  isUser: boolean;
  text: string;
  isAnalysis?: boolean; // New flag for rating/feedback messages
}

export interface ConnectConfig {
    systemInstruction: string;
    voiceName?: string;
}

export const useGeminiLive = () => {
  const [connected, setConnected] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs for audio context and state
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const currentInputTransRef = useRef<string>('');
  const currentOutputTransRef = useRef<string>('');
  
  const disconnect = useCallback(async () => {
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session", e);
      }
    }
    
    sourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();

    if (inputContextRef.current) {
        await inputContextRef.current.close();
        inputContextRef.current = null;
    }
    if (outputContextRef.current) {
        await outputContextRef.current.close();
        outputContextRef.current = null;
    }

    setConnected(false);
    sessionPromiseRef.current = null;
    nextStartTimeRef.current = 0;
    setVolumeLevel(0);
  }, []);

  const sendTextMessage = useCallback(async (text: string) => {
      if (!sessionPromiseRef.current) return;
      const session = await sessionPromiseRef.current;
      session.send({ parts: [{ text }] }, true); // true = end of turn
  }, []);

  const connect = useCallback(async (config: ConnectConfig) => {
    setError(null);
    setTranscripts([]); // Clear previous transcripts on new connection
    
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key not found");

      const ai = new GoogleGenAI({ apiKey });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            throw new Error("Microphone permission denied. Please allow access to use the tutor.");
        }
        throw err;
      }
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: config.systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName || 'Kore' } },
          },
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Connection opened");
            setConnected(true);
            
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (!sessionPromiseRef.current) return;
              
              const inputData = e.inputBuffer.getChannelData(0);
              
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setVolumeLevel(Math.min(rms * 5, 1));

              const pcmBlob = createBlob(inputData);
              sessionPromiseRef.current.then(session => {
                 session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
                currentOutputTransRef.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
                currentInputTransRef.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
                const userText = currentInputTransRef.current.trim();
                const aiText = currentOutputTransRef.current.trim();

                if (userText || aiText) {
                    setTranscripts(prev => [
                        ...prev, 
                        ...(userText ? [{ isUser: true, text: userText }] : []),
                        ...(aiText ? [{ 
                            isUser: false, 
                            text: aiText,
                            isAnalysis: aiText.includes("RATING:") || aiText.includes("FEEDBACK:") 
                        }] : [])
                    ]);
                }
                
                currentInputTransRef.current = '';
                currentOutputTransRef.current = '';
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputContextRef.current) {
                const ctx = outputContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    ctx,
                    24000,
                    1
                );
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                const gainNode = ctx.createGain();
                source.connect(gainNode);
                gainNode.connect(ctx.destination);
                
                source.addEventListener('ended', () => {
                    sourcesRef.current.delete(source);
                });
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                currentOutputTransRef.current = '';
            }
          },
          onclose: () => {
            setConnected(false);
          },
          onerror: (e) => {
            console.error("Live API Error", e);
            setError("Connection lost. Please try again.");
            disconnect();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect.");
      setConnected(false);
    }
  }, [disconnect]);

  useEffect(() => {
      return () => {
          disconnect();
      }
  }, [disconnect]);

  return {
    connected,
    connect,
    disconnect,
    sendTextMessage,
    volumeLevel,
    transcripts,
    error
  };
};
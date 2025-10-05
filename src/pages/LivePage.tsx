
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { useLocalization } from '../hooks/useLocalization';
import { CONFIG } from '../lib/config';
import { Mic, MicOff, Bot, BrainCircuit, Loader2 } from 'lucide-react';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';
type SpeakingStatus = 'idle' | 'listening' | 'speaking';

interface TranscriptionEntry {
  speaker: 'user' | 'assistant';
  text: string;
}

// --- Audio Encoding/Decoding Helpers ---
// These functions are required for handling raw audio data for the Gemini Live API.
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}


const LivePage: React.FC = () => {
  const { t } = useLocalization();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [speakingStatus, setSpeakingStatus] = useState<SpeakingStatus>('idle');
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionEntry[]>([]);
  
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const audioResourcesRef = useRef<{
    stream: MediaStream;
    inputAudioContext: AudioContext;
    outputAudioContext: AudioContext;
    scriptProcessor: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
  } | null>(null);

  const transcriptionContainerRef = useRef<HTMLDivElement>(null);
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const nextStartTimeRef = useRef(0);
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    // Scroll to bottom of transcription
    if (transcriptionContainerRef.current) {
      transcriptionContainerRef.current.scrollTop = transcriptionContainerRef.current.scrollHeight;
    }
  }, [transcriptionHistory]);
  
  const cleanupAudio = useCallback(() => {
    if (audioResourcesRef.current) {
      audioResourcesRef.current.stream.getTracks().forEach(track => track.stop());
      audioResourcesRef.current.scriptProcessor.disconnect();
      audioResourcesRef.current.source.disconnect();
      audioResourcesRef.current.inputAudioContext.close();
      audioResourcesRef.current.outputAudioContext.close();
      audioResourcesRef.current = null;
    }
    outputSourcesRef.current.forEach(source => source.stop());
    outputSourcesRef.current.clear();
  }, []);

  const handleEndSession = useCallback(() => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => session.close());
      sessionPromiseRef.current = null;
    }
    cleanupAudio();
    setConnectionStatus('idle');
    setSpeakingStatus('idle');
  }, [cleanupAudio]);
  
  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      handleEndSession();
    };
  }, [handleEndSession]);

  const handleStartSession = async () => {
    setConnectionStatus('connecting');
    setTranscriptionHistory([]);
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // FIX: Cast window to `any` to allow access to the prefixed `webkitAudioContext` for older browser compatibility.
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      // FIX: Cast window to `any` to allow access to the prefixed `webkitAudioContext` for older browser compatibility.
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const sessionPromise = ai.live.connect({
        model: CONFIG.GEMINI_LIVE_CONFIG.MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: CONFIG.GEMINI_LIVE_CONFIG.SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: () => {
            setConnectionStatus('connected');
            setSpeakingStatus('listening');
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              setSpeakingStatus('speaking');
              currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              setSpeakingStatus('listening');
              currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }
            
            if (message.serverContent?.turnComplete) {
                const fullInput = currentInputTranscriptionRef.current.trim();
                const fullOutput = currentOutputTranscriptionRef.current.trim();

                setTranscriptionHistory(prev => {
                    const newHistory = [...prev];
                    if (fullInput) newHistory.push({ speaker: 'user', text: fullInput });
                    if (fullOutput) newHistory.push({ speaker: 'assistant', text: fullOutput });
                    return newHistory;
                });

                currentInputTranscriptionRef.current = '';
                currentOutputTranscriptionRef.current = '';
                setSpeakingStatus('listening');
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const currentTime = outputAudioContext.currentTime;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
              
              const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
              const source = outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioContext.destination);

              source.addEventListener('ended', () => {
                outputSourcesRef.current.delete(source);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              outputSourcesRef.current.add(source);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Gemini Live API Error:', e);
            setConnectionStatus('error');
            cleanupAudio();
          },
          onclose: () => {
             // Session closed by server or via handleEndSession
          },
        },
      });
      sessionPromiseRef.current = sessionPromise;

      const source = inputAudioContext.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);

      scriptProcessor.onaudioprocess = (audioEvent) => {
        const inputData = audioEvent.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData);
        sessionPromise.then((session) => {
          if (session) { // Ensure session is still active
            session.sendRealtimeInput({ media: pcmBlob });
          }
        });
      };
      
      source.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContext.destination);
      
      audioResourcesRef.current = { stream, inputAudioContext, outputAudioContext, scriptProcessor, source };

    } catch (err) {
      console.error('Failed to start session:', err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        alert(t('mic_permission_denied'));
      }
      setConnectionStatus('error');
    }
  };

  const statusMap = {
    idle: { text: t('status_idle'), color: 'bg-gray-500', icon: <MicOff size={18} /> },
    connecting: { text: t('status_connecting'), color: 'bg-yellow-500', icon: <Loader2 size={18} className="animate-spin" /> },
    connected: { text: t('status_connected'), color: 'bg-green-500', icon: <Mic size={18} /> },
    error: { text: t('status_error'), color: 'bg-red-500', icon: <MicOff size={18} /> },
  };
  const currentStatus = statusMap[connectionStatus];

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4">
          <BrainCircuit className="text-brand-cyan" size={48} />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_live')}</h1>
        <p className="text-lg text-gray-300 max-w-3xl mx-auto">{t('live_intro')}</p>
      </div>
      
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-brand-dark-blue p-4 rounded-lg border border-brand-light-blue/50 mb-6">
           <div className="flex items-center gap-3">
              <span className={`w-4 h-4 rounded-full ${currentStatus.color} transition-colors`}></span>
              <span className="font-bold text-lg">{currentStatus.text}</span>
           </div>
           {connectionStatus === 'connected' && (
              <div className="flex items-center gap-2 text-brand-cyan font-semibold">
                {speakingStatus === 'listening' ? <span>{t('listening')}</span> : <span>{t('speaking')}</span>}
                <div className="w-2 h-2 bg-brand-cyan rounded-full animate-pulse"></div>
              </div>
           )}
           <button
             onClick={connectionStatus === 'connected' ? handleEndSession : handleStartSession}
             disabled={connectionStatus === 'connecting'}
             className={`px-6 py-3 font-bold rounded-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait ${connectionStatus === 'connected' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-brand-cyan hover:bg-white text-brand-dark'}`}
           >
              {currentStatus.icon}
              {connectionStatus === 'connected' ? t('end_session') : t('start_session')}
           </button>
        </div>

        <div 
          ref={transcriptionContainerRef}
          className="bg-brand-dark-blue border border-brand-light-blue/50 rounded-lg p-6 h-96 overflow-y-auto space-y-6"
        >
          {transcriptionHistory.map((entry, index) => (
             <div key={index} className={`flex gap-4 items-start ${entry.speaker === 'user' ? 'justify-end' : ''}`}>
               {entry.speaker === 'assistant' && (
                 <div className="flex-shrink-0 w-10 h-10 bg-brand-light-blue rounded-full flex items-center justify-center">
                    <Bot className="text-brand-cyan" />
                 </div>
               )}
               <div className={`p-4 rounded-lg max-w-sm ${entry.speaker === 'user' ? 'bg-brand-cyan/20 text-white rounded-br-none' : 'bg-brand-light-blue rounded-bl-none'}`}>
                 <p className="font-bold mb-1 text-brand-cyan">{entry.speaker === 'user' ? t('you') : t('assistant')}</p>
                 <p className="whitespace-pre-wrap">{entry.text}</p>
               </div>
             </div>
          ))}
          {connectionStatus === 'connected' && transcriptionHistory.length === 0 && (
            <div className="flex justify-center items-center h-full text-gray-400">
              <p>Start speaking to see the live transcription.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LivePage;

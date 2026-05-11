"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Language, LANGUAGES, LANGUAGE_CODES } from "@/types";
import { translateText, fetchCloudVoices, speakCloud, CloudVoice } from "@/lib/api";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import CloudVoiceSelector from "@/components/CloudVoiceSelector";
import SpeechCorrectionCard from "@/components/SpeechCorrectionCard";
import Flag from "@/components/Flag";

export default function TranslatePage() {
  const [fromLang, setFromLang] = useState<Language>("English");
  const [toLang, setToLang] = useState<Language>("Spanish");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [correctedText, setCorrectedText] = useState("");
  const [corrections, setCorrections] = useState<
    { original: string; corrected: string; explanation: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlayingCorrection, setIsPlayingCorrection] = useState(false);

  const speech = useSpeechRecognition();

  const [fromVoices, setFromVoices] = useState<CloudVoice[]>([]);
  const [toVoices, setToVoices] = useState<CloudVoice[]>([]);
  const [fromVoice, setFromVoice] = useState<CloudVoice | null>(null);
  const [toVoice, setToVoice] = useState<CloudVoice | null>(null);

  const loadVoices = useCallback(async (lang: Language, setter: (v: CloudVoice[]) => void) => {
    try {
      const code = LANGUAGE_CODES[lang].split("-")[0];
      const voices = await fetchCloudVoices(code);
      setter(voices);
    } catch {
      setter([]);
    }
  }, []);

  useEffect(() => {
    loadVoices(fromLang, setFromVoices);
    setFromVoice(null);
  }, [fromLang, loadVoices]);

  useEffect(() => {
    loadVoices(toLang, setToVoices);
    setToVoice(null);
  }, [toLang, loadVoices]);

  const handleSwapLanguages = () => {
    setFromLang(toLang);
    setToLang(fromLang);
    setInputText(outputText);
    setOutputText(inputText);
    setCorrectedText("");
    setCorrections([]);
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await translateText(inputText, fromLang, toLang);
      setOutputText(result.translated_text);
      setCorrectedText(result.corrected_text);
      setCorrections(result.corrections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = async (text: string, voice: CloudVoice | null, language: Language) => {
    if (!text) return;
    if (voice) {
      try {
        await speakCloud(text, voice.id);
      } catch {
        // Fallback to browser TTS
        browserSpeak(text, language);
      }
    } else {
      browserSpeak(text, language);
    }
  };

  const browserSpeak = (text: string, language: Language) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANGUAGE_CODES[language];
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const handleMicToggle = () => {
    if (speech.isListening) {
      speech.stopListening();
      return;
    }
    speech.startListening(fromLang, (transcript) => {
      setInputText((prev) => (prev ? prev + " " + transcript : transcript));
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">Speakly</h1>
          <div className="flex gap-4 text-sm">
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              Practice
            </Link>
            <Link
              href="/translate"
              className="text-blue-600 font-medium"
            >
              Translate
            </Link>
            <Link
              href="/news"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              News
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Language selectors */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
            <Flag language={fromLang} size={22} />
            <select
              value={fromLang}
              onChange={(e) => setFromLang(e.target.value as Language)}
              className="text-sm bg-transparent focus:outline-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSwapLanguages}
            className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </button>

          <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
            <Flag language={toLang} size={22} />
            <select
              value={toLang}
              onChange={(e) => setToLang(e.target.value as Language)}
              className="text-sm bg-transparent focus:outline-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Translation boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Input */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Type in ${fromLang}...`}
              className="w-full h-40 resize-none text-gray-800 focus:outline-none text-sm"
            />
            {speech.interimTranscript && (
              <p className="text-xs text-gray-400 italic px-1">{speech.interimTranscript}</p>
            )}
            {speech.isCheckingGrammar && (
              <p className="text-xs text-gray-400 italic px-1 mt-1">
                Checking your {fromLang}…
              </p>
            )}
            {speech.speechCorrection && (
              <div className="mt-2">
                <SpeechCorrectionCard
                  correction={speech.speechCorrection}
                  onUseCorrected={(corrected) => {
                    setInputText(corrected);
                    speech.clearSpeechCorrection();
                  }}
                  onDismiss={speech.clearSpeechCorrection}
                  isPlayingListen={isPlayingCorrection}
                  onListen={async () => {
                    if (!speech.speechCorrection) return;
                    setIsPlayingCorrection(true);
                    try {
                      await handleSpeak(
                        speech.speechCorrection.corrected,
                        fromVoice,
                        speech.speechCorrection.language
                      );
                    } finally {
                      setIsPlayingCorrection(false);
                    }
                  }}
                />
              </div>
            )}
            <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-2">
              <div className="flex gap-2">
                {/* Listen button */}
                <button
                  onClick={() => handleSpeak(inputText, fromVoice, fromLang)}
                  disabled={!inputText.trim()}
                  className="text-gray-400 hover:text-blue-500 disabled:opacity-30 transition-colors"
                  title="Listen"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </button>
                {/* Clear button */}
                {inputText && (
                  <button
                    onClick={() => { setInputText(""); setOutputText(""); setCorrectedText(""); setCorrections([]); }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Clear"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-300">{inputText.length}</span>
            </div>
            {fromVoices.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400">Voice:</span>
                <CloudVoiceSelector voices={fromVoices} selectedVoice={fromVoice} onSelect={setFromVoice} />
              </div>
            )}
          </div>

          {/* Output */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <div className="w-full h-40 text-sm text-gray-800 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <svg className="w-6 h-6 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : outputText ? (
                <p className="whitespace-pre-wrap">{outputText}</p>
              ) : (
                <p className="text-gray-300">Translation will appear here...</p>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handleSpeak(outputText, toVoice, toLang)}
                  disabled={!outputText}
                  className="text-gray-400 hover:text-blue-500 disabled:opacity-30 transition-colors"
                  title="Listen"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleCopy(outputText)}
                  disabled={!outputText}
                  className="text-gray-400 hover:text-blue-500 disabled:opacity-30 transition-colors"
                  title="Copy"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            {toVoices.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400">Voice:</span>
                <CloudVoiceSelector voices={toVoices} selectedVoice={toVoice} onSelect={setToVoice} />
              </div>
            )}
          </div>
        </div>

        {/* Mic button centered below boxes */}
        {speech.isSupported && (
          <div className="flex flex-col items-center mt-4">
            <button
              onClick={handleMicToggle}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                speech.isListening
                  ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/50"
                  : "bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg"
              }`}
              title={speech.isListening ? "Stop listening" : "Speak"}
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
            <p className="text-xs text-gray-400 mt-1">
              {speech.isListening ? "Listening... tap to stop" : "Tap to speak"}
            </p>
          </div>
        )}

        {/* Grammar corrections */}
        {corrections.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl shadow-sm border border-amber-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="font-medium text-gray-800">Grammar & Spelling Corrections</h3>
            </div>

            {correctedText && correctedText !== inputText && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-green-600 font-medium mb-1">Corrected text:</p>
                  <button
                    onClick={() => handleSpeak(correctedText, fromVoice, fromLang)}
                    className="text-green-500 hover:text-green-700 transition-colors"
                    title="Listen to corrected text"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-green-800">{correctedText}</p>
              </div>
            )}

            <div className="space-y-3">
              {corrections.map((c, i) => (
                <div key={i} className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="line-through text-red-500">{c.original}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-green-700">{c.corrected}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">{c.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm text-center mt-4">{error}</p>
        )}

        {/* Translate button */}
        <div className="flex justify-center mt-6">
          <button
            onClick={handleTranslate}
            disabled={!inputText.trim() || isLoading}
            className="px-8 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {isLoading ? "Translating..." : "Translate"}
          </button>
        </div>
      </div>
    </div>
  );
}

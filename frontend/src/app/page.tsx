"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { fetchCloudVoices, speakCloud, CloudVoice } from "@/lib/api";
import { LANGUAGE_CODES } from "@/types";
import LanguageSelector from "@/components/LanguageSelector";
import ChatWindow from "@/components/ChatWindow";
import SpeechCorrectionCard from "@/components/SpeechCorrectionCard";

export default function Home() {
  const chat = useChat();
  const speech = useSpeechRecognition();
  const [cloudVoices, setCloudVoices] = useState<CloudVoice[]>([]);
  const [selectedCloudVoice, setSelectedCloudVoice] = useState<CloudVoice | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pendingVoiceText, setPendingVoiceText] = useState<string | null>(null);
  const pendingVoiceTextRef = useRef<string | null>(null);

  useEffect(() => {
    if (!chat.targetLanguage) return;
    const code = LANGUAGE_CODES[chat.targetLanguage].split("-")[0];
    fetchCloudVoices(code)
      .then(setCloudVoices)
      .catch(() => setCloudVoices([]));
    setSelectedCloudVoice(null);
  }, [chat.targetLanguage]);

  const speakReply = useCallback(
    async (text: string) => {
      if (!text) return;
      setIsSpeaking(true);
      try {
        const voiceId = selectedCloudVoice?.id;
        if (voiceId) {
          await speakCloud(text, voiceId);
        } else if (chat.targetLanguage) {
          // fallback to browser TTS
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = LANGUAGE_CODES[chat.targetLanguage];
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
        }
      } catch {
        // silent fail
      } finally {
        setIsSpeaking(false);
      }
    },
    [selectedCloudVoice, chat.targetLanguage]
  );

  const sendChatMessage = useCallback(
    async (text: string) => {
      const reply = await chat.sendMessage(text);
      if (reply) {
        speakReply(reply);
      }
    },
    [chat, speakReply]
  );

  const handleMicToggle = useCallback(() => {
    if (speech.isListening) {
      speech.stopListening();
      return;
    }

    if (!chat.targetLanguage) return;

    speech.startListening(chat.targetLanguage, (transcript) => {
      // Don't auto-send yet — wait for grammar check.
      // The effect below will auto-send if no correction is suggested,
      // or surface the correction card so the user can choose.
      pendingVoiceTextRef.current = transcript;
      setPendingVoiceText(transcript);
    });
  }, [speech, chat.targetLanguage]);

  // After voice transcription + grammar check completes:
  //   - if no correction was suggested → send the original transcript automatically
  //   - if a correction WAS suggested → leave it; the card will let the user pick
  useEffect(() => {
    if (!pendingVoiceText) return;
    if (speech.isCheckingGrammar) return;
    if (speech.speechCorrection) return; // wait for user to pick
    sendChatMessage(pendingVoiceText);
    pendingVoiceTextRef.current = null;
    setPendingVoiceText(null);
  }, [pendingVoiceText, speech.isCheckingGrammar, speech.speechCorrection, sendChatMessage]);

  const handleSendOriginalVoice = useCallback(() => {
    const text = pendingVoiceTextRef.current;
    speech.clearSpeechCorrection();
    pendingVoiceTextRef.current = null;
    setPendingVoiceText(null);
    if (text) sendChatMessage(text);
  }, [speech, sendChatMessage]);

  const handleSendCorrectedVoice = useCallback(
    (corrected: string) => {
      speech.clearSpeechCorrection();
      pendingVoiceTextRef.current = null;
      setPendingVoiceText(null);
      if (corrected) sendChatMessage(corrected);
    },
    [speech, sendChatMessage]
  );

  const handleSendText = useCallback(
    async (text: string) => {
      const reply = await chat.sendMessage(text);
      if (reply) {
        speakReply(reply);
      }
    },
    [chat, speakReply]
  );

  const handleChangeLanguage = useCallback(() => {
    chat.resetLanguages();
    window.speechSynthesis?.cancel();
  }, [chat]);

  if (!chat.nativeLanguage || !chat.targetLanguage) {
    return <LanguageSelector onSelect={chat.setLanguages} />;
  }

  return (
    <>
      <ChatWindow
        messages={chat.messages}
        nativeLanguage={chat.nativeLanguage}
        targetLanguage={chat.targetLanguage}
        isListening={speech.isListening}
        isLoading={chat.isLoading}
        isSpeaking={isSpeaking}
        isSupported={speech.isSupported}
        interimTranscript={speech.interimTranscript}
        error={chat.error}
        micError={speech.error}
        availableVoices={cloudVoices}
        selectedVoice={selectedCloudVoice}
        onVoiceSelect={setSelectedCloudVoice}
        onMicToggle={handleMicToggle}
        onChangeLanguage={handleChangeLanguage}
        onSendText={handleSendText}
      />

      {(speech.isCheckingGrammar || speech.speechCorrection) && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-md">
          {speech.isCheckingGrammar && !speech.speechCorrection && (
            <div className="rounded-xl bg-white border border-gray-200 shadow-lg px-4 py-2.5 text-xs text-gray-500 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
              Checking your {chat.targetLanguage}…
            </div>
          )}

          {speech.speechCorrection && (
            <div className="bg-white rounded-xl shadow-lg">
              <SpeechCorrectionCard
                correction={speech.speechCorrection}
                onUseCorrected={handleSendCorrectedVoice}
                onDismiss={handleSendOriginalVoice}
                isPlayingListen={isSpeaking}
                onListen={() =>
                  speech.speechCorrection &&
                  speakReply(speech.speechCorrection.corrected)
                }
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

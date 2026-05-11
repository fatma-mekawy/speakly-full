"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { LANGUAGE_CODES, Language } from "@/types";
import { transcribeAudio, checkGrammar, GrammarCheckResult } from "@/lib/api";

export interface SpeechCorrection extends GrammarCheckResult {
  language: Language;
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [speechCorrection, setSpeechCorrection] = useState<SpeechCorrection | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onResultRef = useRef<((text: string) => void) | null>(null);
  const languageRef = useRef<Language | null>(null);
  const mimeRef = useRef<string>("");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof window.MediaRecorder === "undefined"
    ) {
      setIsSupported(false);
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Stop & release the stream if the component using this hook unmounts mid-record.
  useEffect(() => {
    return () => {
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          // ignore
        }
      }
      cleanupStream();
    };
  }, [cleanupStream]);

  const startListening = useCallback(
    async (language: Language, onResult: (text: string) => void) => {
      if (!isSupported) return;
      setError(null);
      onResultRef.current = onResult;
      languageRef.current = language;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const candidates = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/ogg;codecs=opus",
        ];
        const mimeType =
          candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
        mimeRef.current = mimeType;

        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onerror = (e) => {
          console.error("MediaRecorder error", e);
          setError("Recording failed");
          cleanupStream();
          setIsListening(false);
        };

        recorder.onstop = async () => {
          cleanupStream();
          setIsListening(false);

          if (chunksRef.current.length === 0) return;
          const blob = new Blob(chunksRef.current, {
            type: mimeRef.current || "audio/webm",
          });
          chunksRef.current = [];

          if (blob.size < 500) {
            // Probably silent / cancelled too fast.
            return;
          }

          setIsTranscribing(true);
          let transcribedText = "";
          try {
            const lang = languageRef.current;
            const langCode = lang
              ? LANGUAGE_CODES[lang].split("-")[0]
              : undefined;
            transcribedText = await transcribeAudio(blob, langCode);
          } catch (err) {
            console.error("Transcription failed", err);
            setError(
              err instanceof Error ? err.message : "Transcription failed"
            );
          } finally {
            setIsTranscribing(false);
          }

          if (!transcribedText) return;

          const lang = languageRef.current;

          // IMPORTANT: mark grammar-check as in-progress BEFORE notifying the
          // consumer, so consumers (e.g. the Practice page) can decide to wait
          // for it before auto-sending. React 18 batches these state updates
          // with whatever the consumer does inside onResult, so by the time
          // their useEffect runs both updates are visible together.
          if (lang) {
            setIsCheckingGrammar(true);
          }

          setTranscript(transcribedText);
          onResultRef.current?.(transcribedText);

          if (lang) {
            try {
              const result = await checkGrammar(transcribedText, lang);
              const hasFixes =
                result.corrections.length > 0 &&
                result.corrected.trim() !== transcribedText.trim();
              if (hasFixes) {
                setSpeechCorrection({ ...result, language: lang });
              }
            } catch (err) {
              console.error("Grammar check failed", err);
            } finally {
              setIsCheckingGrammar(false);
            }
          }
        };

        setTranscript("");
        setSpeechCorrection(null);
        setIsListening(true);
        recorder.start();
      } catch (err) {
        cleanupStream();
        setIsListening(false);
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setError(
            "Microphone access denied. Please allow microphone permission in your browser settings."
          );
        } else {
          setError(
            err instanceof Error ? err.message : "Could not access microphone"
          );
        }
      }
    },
    [isSupported, cleanupStream]
  );

  const stopListening = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      cleanupStream();
      setIsListening(false);
    }
  }, [cleanupStream]);

  const clearSpeechCorrection = useCallback(() => {
    setSpeechCorrection(null);
  }, []);

  return {
    isListening,
    isTranscribing,
    isCheckingGrammar,
    transcript,
    interimTranscript: "", // Whisper doesn't provide interim results — kept for API compat.
    isSupported,
    error,
    speechCorrection,
    clearSpeechCorrection,
    startListening,
    stopListening,
  };
}

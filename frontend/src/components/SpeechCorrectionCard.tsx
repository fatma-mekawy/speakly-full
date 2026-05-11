"use client";

import { SpeechCorrection } from "@/hooks/useSpeechRecognition";

interface Props {
  correction: SpeechCorrection;
  onUseCorrected: (correctedText: string) => void;
  onDismiss: () => void;
  onListen?: () => void;
  isPlayingListen?: boolean;
}

export default function SpeechCorrectionCard({
  correction,
  onUseCorrected,
  onDismiss,
  onListen,
  isPlayingListen,
}: Props) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold uppercase tracking-wide">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h.01a1 1 0 100-2H10V10a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Voice correction
        </div>
        <button
          onClick={onDismiss}
          className="text-amber-700 hover:text-amber-900 text-xs"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-start gap-2">
          <span className="text-xs text-amber-700 font-medium w-12 flex-shrink-0 mt-0.5">
            You said:
          </span>
          <p className="text-gray-700 line-through" dir="auto">
            {correction.original}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-xs text-green-700 font-medium w-12 flex-shrink-0 mt-0.5">
            Better:
          </span>
          <p className="text-gray-900 font-medium flex-1" dir="auto">
            {correction.corrected}
          </p>
          {onListen && (
            <button
              onClick={onListen}
              disabled={isPlayingListen}
              className="flex-shrink-0 mt-0.5 p-1 rounded-full text-amber-700 hover:text-amber-900 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Hear correct pronunciation"
              aria-label="Listen to corrected version"
            >
              {isPlayingListen ? (
                <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M12 4v16M8 8v8M16 8v8M4 11v2M20 11v2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4.03v8.05A4.5 4.5 0 0016.5 12zM14 3.23v2.06a7.001 7.001 0 010 13.42v2.06A9.001 9.001 0 0023 12 9 9 0 0014 3.23z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {correction.corrections.length > 0 && (
        <ul className="space-y-1 pl-2 border-l-2 border-amber-300">
          {correction.corrections.map((c, i) => (
            <li key={i} className="text-xs text-gray-600" dir="auto">
              <span className="line-through text-gray-400">{c.original}</span>{" "}
              → <span className="text-gray-900">{c.corrected}</span>
              {c.explanation && (
                <span className="block text-gray-500 mt-0.5">{c.explanation}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onUseCorrected(correction.corrected)}
          className="flex-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors"
        >
          Use corrected
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-lg border border-amber-300 hover:bg-amber-100 text-amber-800 text-xs font-medium transition-colors"
        >
          Keep original
        </button>
      </div>
    </div>
  );
}

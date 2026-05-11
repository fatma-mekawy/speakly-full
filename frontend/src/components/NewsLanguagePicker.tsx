"use client";

import { Language, LANGUAGES } from "@/types";
import { CloudVoice } from "@/lib/api";
import CloudVoiceSelector from "./CloudVoiceSelector";
import Flag from "./Flag";

interface Props {
  value: Language | null;
  onChange: (lang: Language | null) => void;
  voices: CloudVoice[];
  selectedVoice: CloudVoice | null;
  onVoiceChange: (voice: CloudVoice) => void;
}

export default function NewsLanguagePicker({
  value,
  onChange,
  voices,
  selectedVoice,
  onVoiceChange,
}: Props) {
  return (
    <aside className="w-full md:w-56 md:flex-shrink-0 bg-white border-b md:border-b-0 md:border-r border-gray-200 p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Target Language
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        Pick a language to see translated titles and summaries under each result.
      </p>

      <div className="flex flex-col gap-1.5">
        {LANGUAGES.map((lang) => {
          const active = value === lang;
          return (
            <button
              key={lang}
              onClick={() => onChange(active ? null : lang)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left ${
                active
                  ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                  : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 text-gray-700"
              }`}
            >
              <Flag language={lang} size={20} />
              <span>{lang}</span>
            </button>
          );
        })}
      </div>

      {value && (
        <button
          onClick={() => onChange(null)}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Clear selection
        </button>
      )}

      {value && voices.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Voice
          </h2>
          <p className="text-xs text-gray-400 mb-2">
            Used when you press &ldquo;Listen&rdquo; on a result.
          </p>
          <CloudVoiceSelector
            voices={voices}
            selectedVoice={selectedVoice}
            onSelect={onVoiceChange}
          />
        </div>
      )}
    </aside>
  );
}

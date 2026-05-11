"use client";

import { useState } from "react";
import Link from "next/link";
import { Language, LANGUAGES } from "@/types";
import Flag from "./Flag";

interface Props {
  onSelect: (nativeLanguage: Language, targetLanguage: Language) => void;
}

export default function LanguageSelector({ onSelect }: Props) {
  const [step, setStep] = useState<"native" | "target">("native");
  const [nativeLang, setNativeLang] = useState<Language | null>(null);

  const handleNativeSelect = (lang: Language) => {
    setNativeLang(lang);
    setStep("target");
  };

  const handleTargetSelect = (lang: Language) => {
    if (nativeLang) {
      onSelect(nativeLang, lang);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">Speakly</h1>
          <div className="flex gap-4 text-sm">
            <Link href="/" className="text-blue-600 font-medium">
              Practice
            </Link>
            <Link
              href="/translate"
              className="text-gray-500 hover:text-gray-700 transition-colors"
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

      <div className="flex items-center justify-center px-4 pt-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Speakly</h1>
          <p className="text-gray-500 mt-2">
            Practice any language by speaking with AI
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          {step === "native" ? (
            <>
              <p className="text-sm text-gray-500 mb-4 text-center">
                What language do you speak?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleNativeSelect(lang)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                  >
                    <Flag language={lang} size={28} />
                    <span className="font-medium text-gray-700">{lang}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setStep("native")}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  ← Back
                </button>
                <p className="text-sm text-gray-500 flex items-center gap-1.5">
                  I speak{" "}
                  <span className="font-medium text-blue-600 inline-flex items-center gap-1.5">
                    <Flag language={nativeLang!} size={20} />
                    {nativeLang}
                  </span>
                </p>
              </div>

              <p className="text-sm text-gray-500 mb-4 text-center">
                What language do you want to practice?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {LANGUAGES.filter((lang) => lang !== nativeLang).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleTargetSelect(lang)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all text-left"
                  >
                    <Flag language={lang} size={28} />
                    <span className="font-medium text-gray-700">{lang}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

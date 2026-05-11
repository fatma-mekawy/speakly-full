import { ChatMessage, Correction, ChatNewsArticle } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ChatApiResponse {
  reply: string;
  corrections: Correction[];
  translated_reply: string;
  news_articles: ChatNewsArticle[];
}

export async function sendMessage(
  message: string,
  nativeLanguage: string,
  targetLanguage: string,
  conversationHistory: ChatMessage[]
): Promise<ChatApiResponse> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      native_language: nativeLanguage,
      target_language: targetLanguage,
      conversation_history: conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

interface TranslateCorrection {
  original: string;
  corrected: string;
  explanation: string;
}

interface TranslateApiResponse {
  translated_text: string;
  original_text: string;
  corrected_text: string;
  corrections: TranslateCorrection[];
}

export async function translateText(
  text: string,
  fromLanguage: string,
  toLanguage: string
): Promise<TranslateApiResponse> {
  const response = await fetch(`${API_URL}/api/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      from_language: fromLanguage,
      to_language: toLanguage,
    }),
  });

  if (!response.ok) {
    throw new Error(`Translate error: ${response.status}`);
  }

  return response.json();
}

export interface CloudVoice {
  id: string;
  name: string;
  locale: string;
  gender: string;
}

export async function fetchCloudVoices(lang: string = ""): Promise<CloudVoice[]> {
  const response = await fetch(`${API_URL}/api/voices?lang=${encodeURIComponent(lang)}`);
  if (!response.ok) throw new Error(`Voices error: ${response.status}`);
  return response.json();
}

export interface NewsArticle {
  title: string;
  url: string;
  body: string;
  source: string;
  image: string;
  date: string;
}

interface NewsApiResponse {
  articles: NewsArticle[];
  query: string;
}

export async function searchNews(
  query: string,
  maxResults: number = 10
): Promise<NewsApiResponse> {
  const params = new URLSearchParams({ q: query, max_results: String(maxResults) });
  const response = await fetch(`${API_URL}/api/news?${params}`);
  if (!response.ok) throw new Error(`News error: ${response.status}`);
  return response.json();
}

export interface NewsTranslation {
  translated_title: string;
  summary: string;
}

export async function translateNewsArticle(
  title: string,
  body: string,
  targetLanguage: string
): Promise<NewsTranslation> {
  const response = await fetch(`${API_URL}/api/news/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      body,
      target_language: targetLanguage,
    }),
  });
  if (!response.ok) throw new Error(`News translate error: ${response.status}`);
  return response.json();
}

export async function translateNewsArticlesBatch(
  articles: { title: string; body: string }[],
  targetLanguage: string
): Promise<{ translations: NewsTranslation[] }> {
  const response = await fetch(`${API_URL}/api/news/translate-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      articles,
      target_language: targetLanguage,
    }),
  });
  if (!response.ok) throw new Error(`News batch translate error: ${response.status}`);
  return response.json();
}

export interface GrammarCheckResult {
  original: string;
  corrected: string;
  corrections: Array<{ original: string; corrected: string; explanation: string }>;
}

export async function checkGrammar(
  text: string,
  language: string
): Promise<GrammarCheckResult> {
  const response = await fetch(`${API_URL}/api/check-grammar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });
  if (!response.ok) throw new Error(`Grammar check error: ${response.status}`);
  return response.json();
}

export async function transcribeAudio(audio: Blob, languageCode?: string): Promise<string> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "mp4" : "webm";
  form.append("audio", audio, `speech.${ext}`);
  if (languageCode) form.append("language", languageCode);

  const response = await fetch(`${API_URL}/api/transcribe`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Transcribe error ${response.status}: ${text}`);
  }
  const data = await response.json();
  return (data.text || "").trim();
}

export async function speakCloud(text: string, voice: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) throw new Error(`TTS error: ${response.status}`);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
  audio.onended = () => URL.revokeObjectURL(url);
}

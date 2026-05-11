import json
import logging
import re

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

from app.config import settings
from app.models import (
    ChatRequest, ChatResponse, ChatNewsArticle,
    TranslateRequest, TranslateResponse, TranslateCorrection,
    NewsTranslateRequest, NewsTranslateResponse,
    NewsTranslateBatchRequest, NewsTranslateBatchResponse,
    GrammarCheckRequest, GrammarCheckResponse, Correction,
)
from app.prompts import build_system_prompt
from app.services.search_service import search_web, search_news


client = AsyncOpenAI(
    api_key=settings.groq_api_key,
    base_url="https://api.groq.com/openai/v1",
)

NEWS_KEYWORDS = [
    "news", "latest", "headlines", "what's happening", "current events",
    "breaking", "trending",
    "أخبار", "عاجل", "آخر",
    "noticias", "actualidad",
    "nouvelles", "actualités",
    "nachrichten", "neuigkeiten",
    "notizie",
    "notícias",
    "ニュース", "最新",
    "뉴스", "최신",
    "新闻", "最新",
]

CANT_ANSWER_PHRASES = [
    "i don't have access", "i can't provide real-time", "i don't have real-time",
    "my knowledge", "i'm not able to", "i cannot access",
    "i don't have current", "i can't browse", "i'm unable to",
    "as an ai", "i don't have the ability",
]


def _is_news_request(message: str) -> bool:
    lower = message.lower()
    return any(kw in lower for kw in NEWS_KEYWORDS)


def _needs_web_search(response_text: str, parsed_data: dict | None = None) -> bool:
    """Check if the LLM indicated it needs a web search."""
    if parsed_data and parsed_data.get("needs_search"):
        return True
    lower = response_text.lower()
    return any(phrase in lower for phrase in CANT_ANSWER_PHRASES)


def _parse_json_response(text: str) -> dict:
    """Parse JSON from LLM response, handling possible code fences."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


async def check_grammar(request: GrammarCheckRequest) -> GrammarCheckResponse:
    """Check text for grammar/spelling/word-choice errors in the given language."""
    text = (request.text or "").strip()
    if not text:
        return GrammarCheckResponse(original=text, corrected=text, corrections=[])

    messages = [
        {
            "role": "system",
            "content": f"""You are a {request.language} language teacher. Check the user's text for grammar, spelling, and word-choice errors in {request.language}.

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{{
  "corrected": "the fully corrected version of the text in {request.language}",
  "corrections": [
    {{
      "original": "the wrong part",
      "corrected": "the correct form",
      "explanation": "brief explanation in {request.language} of why it was wrong"
    }}
  ]
}}

If the text has no errors, return an empty corrections array and set corrected to the input unchanged.
Be lenient with informal speech and minor punctuation — only flag real mistakes a learner should know about.""",
        },
        {"role": "user", "content": text},
    ]

    response_text = await _call_llm(messages, max_tokens=1500, json_mode=True)

    try:
        data = _parse_json_response(response_text)
        corrected = (data.get("corrected") or text).strip()
        raw_corrections = data.get("corrections") or []
        corrections = [
            Correction(
                original=(c.get("original") or "").strip(),
                corrected=(c.get("corrected") or "").strip(),
                explanation=(c.get("explanation") or "").strip(),
            )
            for c in raw_corrections
            if c.get("original") and c.get("corrected")
        ]
        return GrammarCheckResponse(original=text, corrected=corrected, corrections=corrections)
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.warning("Grammar check JSON parse failed: %s", e)
        return GrammarCheckResponse(original=text, corrected=text, corrections=[])


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    language: str | None = None,
) -> str:
    """Transcribe audio using Groq Whisper. Returns plain text."""
    kwargs = {
        "file": (filename, audio_bytes),
        "model": settings.whisper_model,
        "response_format": "text",
    }
    if language:
        kwargs["language"] = language

    try:
        response = await client.audio.transcriptions.create(**kwargs)
    except Exception as e:  # noqa: BLE001
        logger.error("Whisper transcription failed: %s", e)
        raise

    # response_format="text" returns a plain string in some SDK versions,
    # an object with .text in others.
    if isinstance(response, str):
        return response.strip()
    return getattr(response, "text", "").strip()


async def _call_llm(
    messages: list[dict],
    max_tokens: int = 1024,
    json_mode: bool = False,
) -> str:
    kwargs: dict = {
        "model": settings.chat_model,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if json_mode:
        # Forces the model to emit a single valid JSON object — eliminates
        # truncation / plain-text replies that break json.loads.
        kwargs["response_format"] = {"type": "json_object"}
    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""


async def get_response(request: ChatRequest) -> ChatResponse:
    articles: list[ChatNewsArticle] = []

    system_prompt = build_system_prompt(request.native_language, request.target_language)

    # Step 1: If user explicitly asks for news, search proactively
    if _is_news_request(request.message):
        raw = await search_news(request.message, max_results=5)
        articles = [ChatNewsArticle(**a) for a in raw]
        if articles:
            summaries = "\n".join(f"- {a.title} ({a.source}): {a.body[:150]}" for a in articles)
            system_prompt += (
                f"\n\n[NEWS RESULTS]\n{summaries}\n\n"
                f"Discuss these news articles naturally in {request.target_language}. "
                f"Still correct any language errors."
            )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.conversation_history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.message})

    # Step 2: First LLM call
    response_text = await _call_llm(messages, max_tokens=1500, json_mode=True)

    parsed = None
    try:
        parsed = _parse_json_response(response_text)
    except (json.JSONDecodeError, KeyError, TypeError):
        pass

    # Step 3: If LLM can't answer, search the web and retry
    if not articles and _needs_web_search(response_text, parsed):
        raw = await search_web(request.message, max_results=5)
        articles = [ChatNewsArticle(**a) for a in raw]

        if articles:
            summaries = "\n".join(f"- {a.title} ({a.source}): {a.body[:200]}" for a in articles)
            web_context = (
                f"\n\n[WEB SEARCH RESULTS for \"{request.message}\"]\n{summaries}\n\n"
                f"Use these web results to answer the user's question in {request.target_language}. "
                f"Be helpful and informative. Still correct any language errors."
            )
            # Rebuild messages with web context
            messages[0] = {"role": "system", "content": system_prompt + web_context}
            response_text = await _call_llm(messages, max_tokens=1500, json_mode=True)

            try:
                parsed = _parse_json_response(response_text)
            except (json.JSONDecodeError, KeyError, TypeError):
                parsed = None

    # Step 4: Build response
    if parsed:
        return ChatResponse(
            reply=parsed.get("reply", response_text),
            corrections=parsed.get("corrections", []),
            translated_reply=parsed.get("translated_reply", ""),
            news_articles=[a.model_dump() for a in articles],
        )
    else:
        return ChatResponse(
            reply=response_text,
            corrections=[],
            translated_reply="",
            news_articles=[a.model_dump() for a in articles],
        )


async def translate_news_articles(request: NewsTranslateBatchRequest) -> NewsTranslateBatchResponse:
    """Translate multiple news articles in a single LLM call to stay under TPM limits."""
    if not request.articles:
        return NewsTranslateBatchResponse(translations=[])

    article_blocks = []
    for i, article in enumerate(request.articles):
        body_excerpt = (article.body or "")[:250]
        article_blocks.append(
            f"Article {i}:\nTITLE: {article.title}\nBODY: {body_excerpt}"
        )
    user_content = "\n\n".join(article_blocks)

    messages = [
        {
            "role": "system",
            "content": f"""You translate and summarize news articles into {request.target_language}.

You will receive a numbered list of articles. For EACH article, produce:
1. A natural translation of the TITLE in {request.target_language}.
2. A short summary (1-3 sentences, max ~50 words) in {request.target_language}, based on the TITLE and BODY.

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{{
  "translations": [
    {{"index": 0, "translated_title": "...", "summary": "..."}},
    {{"index": 1, "translated_title": "...", "summary": "..."}}
  ]
}}

Include one entry for every article, in order. Keep the index field matching the article number.""",
        },
        {"role": "user", "content": user_content},
    ]

    # CJK/Arabic outputs eat tokens fast — give the batch enough room.
    response_text = await _call_llm(messages, max_tokens=3000, json_mode=True)

    fallback = [NewsTranslateResponse(translated_title="", summary="") for _ in request.articles]

    try:
        data = _parse_json_response(response_text)
        items = data.get("translations", [])
        result = list(fallback)
        for item in items:
            idx = item.get("index")
            if isinstance(idx, int) and 0 <= idx < len(result):
                result[idx] = NewsTranslateResponse(
                    translated_title=(item.get("translated_title") or "").strip(),
                    summary=(item.get("summary") or "").strip(),
                )
        return NewsTranslateBatchResponse(translations=result)
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.warning("Failed to parse batch translation JSON: %s", e)
        return NewsTranslateBatchResponse(translations=fallback)


async def translate_news_article(request: NewsTranslateRequest) -> NewsTranslateResponse:
    body_excerpt = (request.body or "")[:600]
    messages = [
        {
            "role": "system",
            "content": f"""You translate and summarize news articles into {request.target_language}.

You will receive a news article TITLE and a short BODY/snippet. Your job:
1. Translate the title into natural {request.target_language}.
2. Write a short, clear summary (1-3 sentences, max ~60 words) of what the article is about, in {request.target_language}. Base the summary on the title and body provided.

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{{
  "translated_title": "the title translated into {request.target_language}",
  "summary": "a concise summary in {request.target_language}"
}}""",
        },
        {
            "role": "user",
            "content": f"TITLE: {request.title}\n\nBODY: {body_excerpt}",
        },
    ]

    response_text = await _call_llm(messages, max_tokens=800, json_mode=True)

    try:
        data = _parse_json_response(response_text)
        return NewsTranslateResponse(
            translated_title=data.get("translated_title", "").strip(),
            summary=data.get("summary", "").strip(),
        )
    except (json.JSONDecodeError, KeyError, TypeError):
        return NewsTranslateResponse(
            translated_title="",
            summary=response_text.strip(),
        )


async def translate_text(request: TranslateRequest) -> TranslateResponse:
    messages = [
        {
            "role": "system",
            "content": f"""You are a translator and grammar checker. The user will provide text in {request.from_language}.

Your job:
1. Check the input text for any grammar, spelling, or syntax errors in {request.from_language}.
2. Translate the text from {request.from_language} to {request.to_language}.

You MUST respond with valid JSON in this exact format (no markdown, no code fences):
{{
  "translated_text": "the translation in {request.to_language}",
  "corrected_text": "the corrected version of the input in {request.from_language} (same as input if no errors)",
  "corrections": [
    {{
      "original": "the incorrect part",
      "corrected": "the correct form",
      "explanation": "brief explanation of the error in {request.to_language}"
    }}
  ]
}}

If there are no errors, return an empty corrections array and set corrected_text to the original input.""",
        },
        {"role": "user", "content": request.text},
    ]

    response_text = await _call_llm(messages, max_tokens=1500, json_mode=True)

    try:
        data = _parse_json_response(response_text)
        return TranslateResponse(
            translated_text=data.get("translated_text", ""),
            original_text=request.text,
            corrected_text=data.get("corrected_text", ""),
            corrections=[TranslateCorrection(**c) for c in data.get("corrections", [])],
        )
    except (json.JSONDecodeError, KeyError, TypeError):
        return TranslateResponse(
            translated_text=response_text.strip(),
            original_text=request.text,
        )

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.config import settings
from app.models import (
    ChatRequest, ChatResponse, TranslateRequest, TranslateResponse,
    NewsResponse, NewsTranslateRequest, NewsTranslateResponse,
    NewsTranslateBatchRequest, NewsTranslateBatchResponse,
    GrammarCheckRequest, GrammarCheckResponse,
)
from app.services.llm_service import (
    get_response, translate_text, translate_news_article, translate_news_articles,
    transcribe_audio, check_grammar,
)
from app.services.tts_service import get_voices, synthesize_speech
from app.services.search_service import search_news

app = FastAPI(title="Speakly API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    return await get_response(request)


@app.post("/api/translate", response_model=TranslateResponse)
async def translate(request: TranslateRequest):
    return await translate_text(request)


@app.get("/api/voices")
async def voices(lang: str = ""):
    return await get_voices(lang)


@app.get("/api/news", response_model=NewsResponse)
async def news(q: str = "latest news", max_results: int = 10):
    articles = await search_news(q, max_results=max_results)
    return NewsResponse(articles=articles, query=q)


@app.post("/api/news/translate", response_model=NewsTranslateResponse)
async def news_translate(request: NewsTranslateRequest):
    return await translate_news_article(request)


@app.post("/api/news/translate-batch", response_model=NewsTranslateBatchResponse)
async def news_translate_batch(request: NewsTranslateBatchRequest):
    return await translate_news_articles(request)


@app.post("/api/check-grammar", response_model=GrammarCheckResponse)
async def check_grammar_endpoint(request: GrammarCheckRequest):
    return await check_grammar(request)


@app.post("/api/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form(""),
):
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload")
    try:
        text = await transcribe_audio(
            audio_bytes,
            filename=audio.filename or "audio.webm",
            language=language or None,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")
    return {"text": text}


@app.post("/api/tts")
async def tts(body: dict):
    text = body.get("text", "")
    voice = body.get("voice", "en-US-AriaNeural")
    if not text:
        return Response(status_code=400, content="Missing text")
    audio = await synthesize_speech(text, voice)
    return Response(content=audio, media_type="audio/mpeg")

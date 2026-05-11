from pydantic import BaseModel


class MessageItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    native_language: str
    target_language: str
    conversation_history: list[MessageItem] = []


class Correction(BaseModel):
    original: str
    corrected: str
    explanation: str


class ChatNewsArticle(BaseModel):
    title: str
    url: str
    body: str
    source: str
    image: str = ""
    date: str = ""


class ChatResponse(BaseModel):
    reply: str
    corrections: list[Correction] = []
    translated_reply: str = ""
    news_articles: list[ChatNewsArticle] = []


class TranslateRequest(BaseModel):
    text: str
    from_language: str
    to_language: str


class TranslateCorrection(BaseModel):
    original: str
    corrected: str
    explanation: str


class TranslateResponse(BaseModel):
    translated_text: str
    original_text: str
    corrected_text: str = ""
    corrections: list[TranslateCorrection] = []


class NewsArticle(BaseModel):
    title: str
    url: str
    body: str
    source: str
    image: str = ""
    date: str = ""


class NewsResponse(BaseModel):
    articles: list[NewsArticle]
    query: str


class NewsTranslateRequest(BaseModel):
    title: str
    body: str = ""
    target_language: str


class NewsTranslateResponse(BaseModel):
    translated_title: str
    summary: str


class NewsArticleInput(BaseModel):
    title: str
    body: str = ""


class NewsTranslateBatchRequest(BaseModel):
    articles: list[NewsArticleInput]
    target_language: str


class NewsTranslateBatchResponse(BaseModel):
    translations: list[NewsTranslateResponse]


class GrammarCheckRequest(BaseModel):
    text: str
    language: str


class GrammarCheckResponse(BaseModel):
    original: str
    corrected: str
    corrections: list[Correction] = []

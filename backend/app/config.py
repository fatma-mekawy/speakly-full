from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    groq_api_key: str
    # Groq model used for chat, translation, grammar-check, news summaries.
    # Override in .env, e.g. CHAT_MODEL="llama-3.3-70b-versatile"
    chat_model: str = "openai/gpt-oss-120b"
    # Groq Whisper variant used for /api/transcribe.
    whisper_model: str = "whisper-large-v3-turbo"
    cors_origins: list[str] = ["http://localhost:3000",
         "https://speakly-full-production.up.railway.app",]

    model_config = {"env_file": ".env"}


settings = Settings()

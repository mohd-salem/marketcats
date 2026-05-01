from pydantic_settings import BaseSettings
from pathlib import Path

# Resolve .env relative to this file, not the process CWD
_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    # AI Provider
    ai_provider: str = "claude"
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Claude model
    claude_model: str = "claude-sonnet-4-5"

    # OpenAI model
    openai_model: str = "gpt-4o"

    # App
    upload_dir: Path = _ENV_FILE.parent / "uploads"
    max_upload_size_mb: int = 50
    sample_size_for_suggestions: int = 30
    categorization_batch_size: int = 10

    class Config:
        env_file = str(_ENV_FILE)
        extra = "ignore"


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)

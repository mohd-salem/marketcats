from functools import lru_cache
from app.config import settings
from .base_provider import AIProvider


@lru_cache(maxsize=1)
def get_ai_provider() -> AIProvider:
    provider = settings.ai_provider.lower()
    if provider == "claude":
        from .claude_provider import ClaudeProvider
        return ClaudeProvider()
    if provider == "openai":
        from .openai_provider import OpenAIProvider
        return OpenAIProvider()
    raise ValueError(f"Unknown AI provider: {provider!r}. Valid options: claude, openai")

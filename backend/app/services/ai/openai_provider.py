"""
Stub OpenAI provider — implement classify_relevance_batch, suggest_dimensions,
and categorize_products_batch when adding OpenAI support.
"""

from typing import Any
from .base_provider import AIProvider


class OpenAIProvider(AIProvider):
    def __init__(self):
        raise NotImplementedError(
            "OpenAI provider is not yet implemented. "
            "Set AI_PROVIDER=claude in your .env file."
        )

    async def classify_relevance_batch(self, products, target_product):
        raise NotImplementedError

    async def suggest_dimensions(self, products_sample, target_product, num_dimensions=5):
        raise NotImplementedError

    async def categorize_products_batch(self, products, dimensions, target_product):
        raise NotImplementedError

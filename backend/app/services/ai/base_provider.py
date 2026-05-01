from abc import ABC, abstractmethod
from typing import Any


class AIProvider(ABC):
    """Abstract base class for all AI provider implementations."""

    # ── Step 1: Relevance classification ─────────────────────────────────────

    @abstractmethod
    async def classify_relevance_batch(
        self,
        products: list[dict[str, Any]],
        target_product: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """
        Classify each product's relevance to the target.

        Returns a list (same order as products) of:
          {
            "relevance": str,        # one of RELEVANCE_LABELS
            "confidence": float,     # 0.0 – 1.0
            "reasoning": str         # one-sentence justification
          }

        AI MUST only use the five fixed RELEVANCE_LABELS.
        """

    # ── Step 2: Dimension suggestions ────────────────────────────────────────

    @abstractmethod
    async def suggest_dimensions(
        self,
        products_sample: list[dict[str, Any]],
        target_product: dict[str, Any] | None,
        num_dimensions: int = 5,
    ) -> list[dict[str, Any]]:
        """
        Suggest categorization dimensions for the kept products.

        Returns:
          [{"name": str, "description": str, "taxonomy_values": list[str]}, ...]

        taxonomy_values must be short, MECE, and include "Unknown" as the last value.
        Maximum 7 values per dimension.
        """

    # ── Step 3: Categorization (locked taxonomy) ──────────────────────────────

    @abstractmethod
    async def categorize_products_batch(
        self,
        products: list[dict[str, Any]],
        dimensions: list[dict[str, Any]],
        target_product: dict[str, Any] | None,
    ) -> list[list[dict[str, Any]]]:
        """
        Assign one taxonomy value per dimension per product.
        AI MUST ONLY use values from dimensions[i]["taxonomy_values"].
        No new values may be created.

        Returns a list per product, each being a list per dimension:
          [
            [
              {"dimension_id": int, "dimension_name": str,
               "value": str, "confidence": float, "reasoning": str},
              ...
            ],
            ...
          ]
        """


"""
Claude Sonnet implementation.

All AI output is validated with Pydantic models before being returned.
Invalid JSON triggers up to MAX_RETRIES retries with an error correction prompt.
AI is never trusted to invent taxonomy values — values are validated against
the approved list and unknown values are coerced to "Unknown".
"""

import json
import logging
from typing import Any

import anthropic
from pydantic import BaseModel, Field, field_validator, ValidationError

from app.config import settings
from app.db.models import RELEVANCE_LABELS
from .base_provider import AIProvider

logger = logging.getLogger(__name__)

MAX_RETRIES = 3

RELEVANT_FIELDS = [
    "Title", "Brand", "Price", "Monthly Revenue", "Monthly Sales",
    "Reviews", "Rating", "Category", "BSR", "Dimensions", "Weight",
    "Size Picture", "Type", "Product Details", "Image URL",
]


# ── Pydantic validation models (server-side "Zod") ────────────────────────────

class RelevanceItem(BaseModel):
    relevance: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str

    @field_validator("relevance")
    @classmethod
    def must_be_valid_label(cls, v: str) -> str:
        if v not in RELEVANCE_LABELS:
            raise ValueError(f"{v!r} is not a valid relevance label")
        return v


class RelevanceBatch(BaseModel):
    items: list[RelevanceItem]


class DimensionSuggestion(BaseModel):
    name: str
    description: str
    taxonomy_values: list[str] = Field(min_length=2, max_length=8)

    @field_validator("taxonomy_values")
    @classmethod
    def last_must_be_unknown(cls, v: list[str]) -> list[str]:
        if v and v[-1].lower() not in ("unknown", "other"):
            v = [*v, "Unknown"]
        return v


class DimensionSuggestionBatch(BaseModel):
    dimensions: list[DimensionSuggestion] = Field(min_length=1)


class CategoryAssignment(BaseModel):
    dimension_id: int
    dimension_name: str
    value: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


class ProductCategoryResult(BaseModel):
    product_index: int
    assignments: list[CategoryAssignment]


class CategorizationBatch(BaseModel):
    results: list[ProductCategoryResult]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _trim_product(product: dict[str, Any]) -> dict[str, Any]:
    trimmed: dict[str, Any] = {}
    for key, value in product.items():
        if value in (None, "", "N/A"):
            continue
        for rf in RELEVANT_FIELDS:
            if rf.lower() in key.lower() or key.lower() in rf.lower():
                trimmed[key] = value
                break
        else:
            if any(k in key.lower() for k in ("asin", "title", "name")):
                trimmed[key] = value
    return trimmed or product


def _target_context(tp: dict[str, Any] | None) -> str:
    if not tp:
        return ""
    parts = []
    if tp.get("asin"):
        parts.append(f"ASIN: {tp['asin']}")
    if tp.get("description"):
        parts.append(f"Description: {tp['description']}")
    if tp.get("main_function"):
        parts.append(f"Main function / niche: {tp['main_function']}")
    if tp.get("exclusion_rules"):
        parts.append(f"Exclusion rules: {'; '.join(tp['exclusion_rules'])}")
    return "\nTarget product context:\n" + "\n".join(parts) if parts else ""


def _build_image_block(tp: dict[str, Any]) -> dict[str, Any] | None:
    """
    Return a Claude vision content block for the target product image, or None.
    Prefers base64 image_data; falls back to image_url.
    """
    if tp.get("image_data"):
        # base64-encoded image stored in DB — detect media type from data URI prefix
        data: str = tp["image_data"]
        media_type = "image/jpeg"  # default
        if data.startswith("data:"):
            header, data = data.split(",", 1)
            mt = header.split(";")[0].replace("data:", "")
            if mt in ("image/jpeg", "image/png", "image/gif", "image/webp"):
                media_type = mt
        return {
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": data},
        }
    if tp.get("image_url"):
        url: str = tp["image_url"]
        # Claude vision requires https URLs; skip http or local paths
        if url.startswith("https://"):
            return {
                "type": "image",
                "source": {"type": "url", "url": url},
            }
        logger.debug("Skipping image_url (not HTTPS): %s", url)
    return None


async def _call_with_retry(
    client: anthropic.AsyncAnthropic,
    model: str,
    system: str,
    user_content: str | list,
    validator_cls: type[BaseModel],
    extract_key: str | None = None,
) -> BaseModel:
    """
    Call Claude, parse JSON, validate with Pydantic.
    Retries up to MAX_RETRIES times on parse/validation failure,
    sending the error back to Claude for self-correction.

    user_content may be a plain string or a list of content blocks
    (e.g. [{"type": "image", ...}, {"type": "text", "text": "..."}])
    to support Claude Vision.
    """
    messages = [{"role": "user", "content": user_content}]
    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        response = await client.messages.create(
            model=model,
            max_tokens=8192,
            system=system,
            messages=messages,
        )
        raw = response.content[0].text.strip()

        # Strip markdown fences if Claude wrapped output anyway
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.rsplit("```", 1)[0].strip()

        try:
            parsed_json = json.loads(raw)
            # Allow top-level list or object with extract_key
            if extract_key and isinstance(parsed_json, list):
                parsed_json = {extract_key: parsed_json}
            elif extract_key and isinstance(parsed_json, dict) and extract_key not in parsed_json:
                lists = [v for v in parsed_json.values() if isinstance(v, list)]
                if lists:
                    parsed_json = {extract_key: lists[0]}
            validated = validator_cls.model_validate(parsed_json)
            return validated
        except (json.JSONDecodeError, ValidationError, Exception) as exc:
            last_error = exc
            logger.warning("Attempt %d/%d failed validation: %s", attempt, MAX_RETRIES, exc)
            if attempt < MAX_RETRIES:
                messages.append({"role": "assistant", "content": raw})
                messages.append({
                    "role": "user",
                    "content": (
                        f"Your response failed validation with this error:\n{exc}\n\n"
                        "Please return ONLY the corrected JSON with no prose or markdown fences."
                    ),
                })

    raise ValueError(f"AI output failed validation after {MAX_RETRIES} attempts: {last_error}")


# ── Claude Provider ────────────────────────────────────────────────────────────

class ClaudeProvider(AIProvider):

    SYSTEM_JSON = (
        "You are a precise AI assistant for Amazon product analysis. "
        "Return ONLY valid JSON — no markdown fences, no prose, no explanation."
    )

    def __init__(self) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.claude_model

    async def classify_relevance_batch(
        self,
        products: list[dict[str, Any]],
        target_product: dict[str, Any],
    ) -> list[dict[str, Any]]:
        ctx = _target_context(target_product)
        trimmed = [_trim_product(p) for p in products]
        labels_str = "\n".join(f"  - {l}" for l in RELEVANCE_LABELS)

        text_prompt = f"""{ctx}

Classify each product's relevance to the target product/niche.

Valid relevance labels (use EXACTLY one of these strings):
{labels_str}

Definitions:
- Exact Target: Same product type, same size/form, directly competes
- Close Target: Same category, slightly different form or audience, likely substitutable
- Functional Alternative: Different product type but solves the same problem
- Related but Different: Adjacent category, cross-sell opportunity but different intent
- Not Relevant: Unrelated, would not be found by the same buyer

Products (indexed 0 to {len(trimmed) - 1}):
{json.dumps(trimmed, ensure_ascii=False, indent=2)}

Return JSON:
{{
  "items": [
    {{"relevance": "<label>", "confidence": <0.0-1.0>, "reasoning": "<one sentence>"}},
    ...
  ]
}}

The "items" array must have exactly {len(trimmed)} elements in the same order as the products."""

        # Build content blocks — include target product image if available (Claude Vision)
        image_block = _build_image_block(target_product)
        if image_block:
            user_content: str | list = [
                image_block,
                {"type": "text", "text": f"This is the target product image (for visual reference).\n\n{text_prompt}"},
            ]
        else:
            user_content = text_prompt

        validated = await _call_with_retry(
            self._client, self._model,
            self.SYSTEM_JSON, user_content,
            RelevanceBatch, "items",
        )
        return [item.model_dump() for item in validated.items]

    async def suggest_dimensions(
        self,
        products_sample: list[dict[str, Any]],
        target_product: dict[str, Any] | None,
        num_dimensions: int = 5,
    ) -> list[dict[str, Any]]:
        ctx = _target_context(target_product)
        trimmed = [_trim_product(p) for p in products_sample]

        prompt = f"""{ctx}

You are helping build a controlled product taxonomy for competitive analysis.

GOAL: Reduce messy product data into a small, controlled, business-useful taxonomy
that analysts can use for pivot tables and dashboards.

Rules:
- Suggest exactly {num_dimensions} categorization dimensions
- Each dimension must have 3–7 mutually exclusive, collectively exhaustive values
- The last value of every dimension must be "Unknown" (catch-all)
- Values must be SHORT labels (1–4 words) — not sentences
- Dimensions should capture meaningful differentiators: physical attributes, use case,
  target audience, market tier, or product form
- AVOID dimensions that would result in most products having the same value
- AVOID overly granular dimensions

Sample products ({len(trimmed)} rows):
{json.dumps(trimmed, ensure_ascii=False, indent=2)}

Return JSON:
{{
  "dimensions": [
    {{
      "name": "<2-4 word label>",
      "description": "<one sentence: what this measures and why it matters>",
      "taxonomy_values": ["<value1>", "<value2>", ..., "Unknown"]
    }}
  ]
}}"""

        validated = await _call_with_retry(
            self._client, self._model,
            self.SYSTEM_JSON, prompt,
            DimensionSuggestionBatch, "dimensions",
        )
        return [d.model_dump() for d in validated.dimensions]

    async def categorize_products_batch(
        self,
        products: list[dict[str, Any]],
        dimensions: list[dict[str, Any]],
        target_product: dict[str, Any] | None,
    ) -> list[list[dict[str, Any]]]:
        ctx = _target_context(target_product) if target_product else ""
        trimmed = [_trim_product(p) for p in products]

        dims_str = json.dumps(
            [{"id": d["id"], "name": d["name"], "valid_values": d["taxonomy_values"]}
             for d in dimensions],
            ensure_ascii=False, indent=2,
        )

        prompt = f"""{ctx}

Categorize each product using the LOCKED taxonomy below.

CRITICAL RULES:
- You MUST use ONLY the values listed in "valid_values" for each dimension
- You MUST NOT invent, abbreviate, or rephrase any value
- If no value fits well, use "Unknown"
- Return a confidence score (0.0–1.0) and one-sentence reasoning per assignment

Locked dimensions and valid values:
{dims_str}

Products (indexed 0 to {len(trimmed) - 1}):
{json.dumps(trimmed, ensure_ascii=False, indent=2)}

Return JSON:
{{
  "results": [
    {{
      "product_index": 0,
      "assignments": [
        {{
          "dimension_id": <int>,
          "dimension_name": "<name>",
          "value": "<exact value from valid_values>",
          "confidence": <0.0-1.0>,
          "reasoning": "<one sentence>"
        }}
      ]
    }}
  ]
}}

The "results" array must have exactly {len(trimmed)} elements."""

        validated = await _call_with_retry(
            self._client, self._model,
            self.SYSTEM_JSON, prompt,
            CategorizationBatch, "results",
        )

        sorted_results = sorted(validated.results, key=lambda r: r.product_index)
        valid_values_map = {d["id"]: set(d["taxonomy_values"]) for d in dimensions}

        output: list[list[dict[str, Any]]] = []
        for result in sorted_results:
            assignments: list[dict[str, Any]] = []
            for assignment in result.assignments:
                dim_id = assignment.dimension_id
                value = assignment.value
                allowed = valid_values_map.get(dim_id, set())
                if allowed and value not in allowed:
                    logger.warning(
                        "AI used invalid value %r for dimension %d — coerced to Unknown",
                        value, dim_id,
                    )
                    value = "Unknown"
                assignments.append({
                    "dimension_id": dim_id,
                    "dimension_name": assignment.dimension_name,
                    "value": value,
                    "confidence": assignment.confidence,
                    "reasoning": assignment.reasoning,
                })
            output.append(assignments)

        return output


"""
Helium 10 CSV / Excel file parser.

Reads the upload, normalises column names where possible,
and returns a list of row dicts plus the raw column list.
"""

import io
from pathlib import Path
from typing import Any

import pandas as pd

# Canonical name → list of known Helium 10 variants (case-insensitive comparison)
H10_COLUMN_MAP: dict[str, list[str]] = {
    "ASIN":             ["asin"],
    "Title":            ["title", "product name", "product title"],
    "Brand":            ["brand"],
    "Price":            ["price", "buy box price", "current price"],
    "Monthly Revenue":  ["monthly revenue", "est. monthly revenue", "revenue"],
    "Monthly Sales":    ["monthly sales", "est. monthly sales", "sales"],
    "Reviews":          ["reviews", "review count", "number of reviews", "# of reviews"],
    "Rating":           ["rating", "average rating", "star rating", "avg rating"],
    "Category":         ["category", "main category", "root category"],
    "BSR":              ["bsr", "best seller rank", "sales rank", "rank"],
    "Image URL":        ["image url", "image", "main image url", "image link"],
    "Weight":           ["weight", "item weight"],
    "Dimensions":       ["dimensions", "product dimensions", "item dimensions", "size"],
    "Size Picture":     ["size picture", "size image"],
    "Type":             ["type", "product type", "item type"],
    "Product Details":  ["product details", "details", "description", "features"],
}


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Attempt to map raw column names to canonical names."""
    rename_map: dict[str, str] = {}
    lowered_cols = {c.lower().strip(): c for c in df.columns}
    for canonical, variants in H10_COLUMN_MAP.items():
        if canonical in df.columns:
            continue  # already correct
        for variant in variants:
            if variant in lowered_cols:
                rename_map[lowered_cols[variant]] = canonical
                break
    return df.rename(columns=rename_map)


def parse_upload(file_path: Path) -> tuple[list[str], list[dict[str, Any]]]:
    """
    Parse a Helium 10 CSV or Excel export.

    Returns:
        columns  – ordered list of column names (after normalisation)
        rows     – list of row dicts {column: value}
    """
    suffix = file_path.suffix.lower()
    if suffix in (".xlsx", ".xls"):
        df = pd.read_excel(file_path, dtype=str)
    elif suffix == ".csv":
        # Try UTF-8 first, fall back to latin-1
        try:
            df = pd.read_csv(file_path, dtype=str, encoding="utf-8-sig")
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, dtype=str, encoding="latin-1")
    else:
        raise ValueError(f"Unsupported file type: {suffix}. Use .csv, .xlsx, or .xls")

    df = _normalise_columns(df)
    # Replace pandas NA / NaN with None
    df = df.where(pd.notna(df), other=None)
    # Strip whitespace from string values
    df = df.apply(lambda col: col.map(lambda v: v.strip() if isinstance(v, str) else v))

    columns = list(df.columns)
    rows = df.to_dict(orient="records")
    return columns, rows


def parse_upload_bytes(data: bytes, filename: str) -> tuple[list[str], list[dict[str, Any]]]:
    """Parse from raw bytes (used in tests or when file is held in memory)."""
    suffix = Path(filename).suffix.lower()
    if suffix in (".xlsx", ".xls"):
        df = pd.read_excel(io.BytesIO(data), dtype=str)
    elif suffix == ".csv":
        try:
            df = pd.read_csv(io.BytesIO(data), dtype=str, encoding="utf-8-sig")
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(data), dtype=str, encoding="latin-1")
    else:
        raise ValueError(f"Unsupported file type: {suffix}")

    df = _normalise_columns(df)
    df = df.where(pd.notna(df), other=None)
    df = df.apply(lambda col: col.map(lambda v: v.strip() if isinstance(v, str) else v))
    return list(df.columns), df.to_dict(orient="records")

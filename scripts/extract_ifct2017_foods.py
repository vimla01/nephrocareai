#!/usr/bin/env python3
"""Extract CKD-relevant nutrient means from IFCT 2017 PDF tables."""

from __future__ import annotations

import csv
import re
import subprocess
import sys
import tempfile
from pathlib import Path


FOOD_CODE = re.compile(r"^[A-S]\d{3}$")
NUMBER = re.compile(r"^<?\d+(?:\.\d+)?(?:±\d+(?:\.\d+)?)?$")

CATEGORIES = {
    "A": "Cereals and millets",
    "B": "Grain legumes",
    "C": "Green leafy vegetables",
    "D": "Other vegetables",
    "E": "Fruits",
    "F": "Roots and tubers",
    "G": "Condiments and spices",
    "H": "Nuts and oil seeds",
    "I": "Sugars",
    "J": "Mushrooms",
    "K": "Miscellaneous foods",
    "L": "Milk and milk products",
    "M": "Egg and egg products",
    "N": "Poultry",
    "O": "Animal meat",
    "P": "Marine fish",
    "Q": "Marine shellfish",
    "R": "Marine mollusks",
    "S": "Freshwater fish and shellfish",
}

ALIASES = {
    "Rice flakes": "Rice flakes (poha)",
    "Wheat flour, atta": "Wheat flour, atta (roti/chapati flour)",
    "Wheat, semolina": "Wheat, semolina (sooji/rava; upma base)",
}


def make_tsv(pdf: Path, first_page: int, last_page: int, output: Path) -> None:
    subprocess.run(
        [
            "pdftotext",
            "-f",
            str(first_page),
            "-l",
            str(last_page),
            "-tsv",
            str(pdf),
            str(output),
        ],
        check=True,
    )


def read_words(path: Path) -> dict[int, list[dict[str, object]]]:
    pages: dict[int, list[dict[str, object]]] = {}
    with path.open(encoding="utf-8") as handle:
        next(handle)
        for line in handle:
            fields = line.rstrip("\n").split("\t", 11)
            if len(fields) != 12 or fields[0] != "5":
                continue
            page = int(fields[1])
            word = {
                "left": float(fields[6]),
                "top": float(fields[7]),
                "width": float(fields[8]),
                "text": fields[11].strip(),
            }
            pages.setdefault(page, []).append(word)
    return pages


def mean_value(text: str) -> float | None:
    cleaned = text.replace(",", "").strip()
    if not NUMBER.match(cleaned):
        return None
    return float(cleaned.lstrip("<").split("±", 1)[0])


def value_at(words: list[dict[str, object]], y: float, x_min: float, x_max: float) -> float | None:
    candidates = [
        word
        for word in words
        if x_min <= float(word["left"]) < x_max
        and abs(float(word["top"]) - y) < 1.5
        and mean_value(str(word["text"])) is not None
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda word: abs(float(word["top"]) - y))
    return mean_value(str(candidates[0]["text"]))


def clean_name(name: str) -> str:
    name = re.sub(r"\s+", " ", name).strip()
    name = name.replace("((", "(").replace("( ", "(").replace(" )", ")")
    name = name.replace("Vigna radiat a)", "Vigna radiata)")
    common_name = re.sub(r"\s*\([^()]*\)\s*$", "", name).strip()
    for source, replacement in ALIASES.items():
        if common_name == source:
            scientific = name[len(common_name) :].strip()
            return f"{replacement} {scientific}".strip()
    return name


def extract_proximate(pages: dict[int, list[dict[str, object]]]) -> dict[str, dict[str, object]]:
    records: dict[str, dict[str, object]] = {}
    for words in pages.values():
        protein_headers = [word for word in words if str(word["text"]) == "PROTCNT"]
        energy_headers = [word for word in words if str(word["text"]) == "ENERC"]
        if not protein_headers or not energy_headers:
            continue
        protein_x = float(protein_headers[0]["left"])
        energy_x = float(energy_headers[0]["left"])
        codes = [word for word in words if FOOD_CODE.match(str(word["text"]))]
        for code_word in codes:
            code = str(code_word["text"])
            y = float(code_word["top"])
            code_x = float(code_word["left"])
            name_words = [
                word
                for word in words
                if code_x + 20 <= float(word["left"]) < min(protein_x - 70, code_x + 205)
                and abs(float(word["top"]) - y) <= 11.5
                and not str(word["text"]).isupper()
            ]
            name_words.sort(
                key=lambda word: (
                    round((float(word["top"]) - y) / 3),
                    float(word["left"]),
                )
            )
            name = clean_name(" ".join(str(word["text"]) for word in name_words))
            protein = value_at(words, y, protein_x - 15, protein_x + 65)
            energy_kj = value_at(words, y, energy_x - 15, energy_x + 65)
            if name and protein is not None and energy_kj is not None:
                records[code] = {
                    "food_name": name,
                    "category": CATEGORIES[code[0]],
                    "protein_g": protein,
                    "energy_kcal": energy_kj / 4.184,
                }
    return records


def extract_minerals(pages: dict[int, list[dict[str, object]]]) -> dict[str, dict[str, float]]:
    records: dict[str, dict[str, float]] = {}
    for page, words in pages.items():
        if page % 2 != 0:
            continue
        for code_word in words:
            code = str(code_word["text"])
            if not FOOD_CODE.match(code):
                continue
            y = float(code_word["top"])
            phosphorus = value_at(words, y, 535, 595)
            potassium = value_at(words, y, 595, 650)
            sodium = value_at(words, y, 700, 760)
            if phosphorus is not None and potassium is not None and sodium is not None:
                records[code] = {
                    "phosphorus_mg": phosphorus,
                    "potassium_mg": potassium,
                    "sodium_mg": sodium,
                }
    return records


def format_number(value: float, decimals: int = 2) -> str:
    return f"{value:.{decimals}f}".rstrip("0").rstrip(".")


def main() -> int:
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} IFCT2017.pdf OUTPUT.csv", file=sys.stderr)
        return 2

    pdf = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="ifct2017-") as temp_dir:
        temp = Path(temp_dir)
        proximate_tsv = temp / "proximate.tsv"
        minerals_tsv = temp / "minerals.tsv"
        make_tsv(pdf, 41, 70, proximate_tsv)
        make_tsv(pdf, 151, 208, minerals_tsv)
        proximate = extract_proximate(read_words(proximate_tsv))
        minerals = extract_minerals(read_words(minerals_tsv))

    rows = []
    seen_names: set[str] = set()
    for code in sorted(set(proximate) & set(minerals)):
        row = {**proximate[code], **minerals[code]}
        normalized_name = str(row["food_name"]).casefold()
        if normalized_name in seen_names:
            continue
        seen_names.add(normalized_name)
        rows.append(
            {
                "food_name": row["food_name"],
                "category": row["category"],
                "protein_g": format_number(float(row["protein_g"])),
                "energy_kcal": format_number(float(row["energy_kcal"])),
                "potassium_mg": format_number(float(row["potassium_mg"])),
                "phosphorus_mg": format_number(float(row["phosphorus_mg"])),
                "sodium_mg": format_number(float(row["sodium_mg"])),
            }
        )

    fieldnames = [
        "food_name",
        "category",
        "protein_g",
        "energy_kcal",
        "potassium_mg",
        "phosphorus_mg",
        "sodium_mg",
    ]
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"proximate={len(proximate)} minerals_complete={len(minerals)} output={len(rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

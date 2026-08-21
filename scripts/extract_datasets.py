#!/usr/bin/env python3
"""Download and prepare the UCI and NHANES CKD research datasets."""

from __future__ import annotations

import argparse
import csv
import math
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"

UCI_URL = "https://archive.ics.uci.edu/static/public/336/chronic+kidney+disease.zip"
NHANES_BASE = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles"
NHANES_FILES = ("P_DEMO", "P_BIOPRO", "P_ALB_CR", "P_CBC", "P_BPXO")

UCI_COLUMNS = [
    "age", "blood_pressure", "specific_gravity", "albumin", "sugar",
    "red_blood_cells", "pus_cell", "pus_cell_clumps", "bacteria",
    "blood_glucose_random", "blood_urea", "serum_creatinine", "sodium",
    "potassium", "hemoglobin", "packed_cell_volume", "white_blood_cell_count",
    "red_blood_cell_count", "hypertension", "diabetes_mellitus",
    "coronary_artery_disease", "appetite", "pedal_edema", "anemia", "class",
]


def download(url: str, destination: Path, force: bool = False) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and not force:
        return destination
    print(f"Downloading {destination.name}...", flush=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "nephrocare-dataset-builder/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response, temporary.open("wb") as output:
        shutil.copyfileobj(response, output)
    temporary.replace(destination)
    return destination


def parse_arff(path: Path) -> pd.DataFrame:
    rows: list[list[str]] = []
    in_data = False
    with path.open(encoding="utf-8", errors="replace") as source:
        for raw_line in source:
            line = raw_line.strip()
            if not line or line.startswith("%"):
                continue
            if not in_data:
                in_data = line.lower() == "@data"
                continue
            row = next(csv.reader([line], skipinitialspace=True))
            if len(row) == len(UCI_COLUMNS) + 1 and row[-1] == "":
                row = row[:-1]
            elif len(row) == len(UCI_COLUMNS) + 1 and row[-1] in {"ckd", "notckd"}:
                row = row[: len(UCI_COLUMNS) - 1] + [row[-1]]
            rows.append(row)
    if not rows:
        raise ValueError(f"No ARFF data found in {path}")
    return pd.DataFrame(rows, columns=UCI_COLUMNS)


def clean_text(series: pd.Series) -> pd.Series:
    return series.astype("string").str.strip().replace({"?": pd.NA, "": pd.NA})


def extract_uci(force: bool = False) -> Path:
    raw_dir = RAW / "uci_ckd"
    archive = download(UCI_URL, raw_dir / "chronic_kidney_disease.zip", force)
    with zipfile.ZipFile(archive) as bundle:
        bundle.extractall(raw_dir)
    arff_files = list(raw_dir.rglob("*.arff"))
    if not arff_files:
        rar_files = list(raw_dir.rglob("*.rar"))
        if rar_files and shutil.which("unrar"):
            subprocess.run(
                ["unrar", "x", "-o+", str(rar_files[0]), str(raw_dir)],
                check=True,
                capture_output=True,
                text=True,
            )
            arff_files = list(raw_dir.rglob("*.arff"))
    if not arff_files:
        raise FileNotFoundError("Could not extract the UCI ARFF file; install the 'unrar' utility")

    arff_files = sorted(arff_files, key=lambda item: ("full" not in item.name.lower(), item.name))
    frame = parse_arff(arff_files[0])
    for column in frame.columns:
        frame[column] = clean_text(frame[column])

    numeric = [
        "age", "blood_pressure", "specific_gravity", "albumin", "sugar",
        "blood_glucose_random", "blood_urea", "serum_creatinine", "sodium",
        "potassium", "hemoglobin", "packed_cell_volume", "white_blood_cell_count",
        "red_blood_cell_count",
    ]
    frame[numeric] = frame[numeric].apply(pd.to_numeric, errors="coerce")
    frame["class"] = frame["class"].str.replace("\t", "", regex=False).str.lower()
    frame["ckd_label"] = frame["class"].map({"ckd": 1, "notckd": 0}).astype("Int64")

    output = PROCESSED / "uci_ckd.csv"
    output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output, index=False)
    return output


def egfr_2021_creatinine(creatinine: float, age: float, female: bool) -> float:
    if pd.isna(creatinine) or pd.isna(age) or creatinine <= 0 or age < 18:
        return math.nan
    kappa = 0.7 if female else 0.9
    alpha = -0.241 if female else -0.302
    sex_factor = 1.012 if female else 1.0
    ratio = creatinine / kappa
    return 142 * min(ratio, 1) ** alpha * max(ratio, 1) ** -1.200 * 0.9938 ** age * sex_factor


def egfr_category(value: float) -> str | pd.NA:
    if pd.isna(value):
        return pd.NA
    if value >= 90:
        return "G1"
    if value >= 60:
        return "G2"
    if value >= 45:
        return "G3a"
    if value >= 30:
        return "G3b"
    if value >= 15:
        return "G4"
    return "G5"


def read_xpt(name: str, force: bool) -> pd.DataFrame:
    path = download(f"{NHANES_BASE}/{name}.xpt", RAW / "nhanes" / f"{name}.xpt", force)
    print(f"Reading {path.name}...", flush=True)
    frame = pd.read_sas(path, format="xport", encoding="utf-8")
    frame.columns = frame.columns.str.upper()
    return frame


def available(frame: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    return frame[[column for column in columns if column in frame.columns]]


def extract_nhanes(force: bool = False) -> Path:
    demo, biopro, urine, cbc, bp = [read_xpt(name, force) for name in NHANES_FILES]

    cohort = available(demo, [
        "SEQN", "RIDAGEYR", "RIAGENDR", "RIDRETH3", "WTMEC4YR", "SDMVSTRA", "SDMVPSU",
    ])
    cohort = cohort[cohort["RIDAGEYR"] >= 18].copy()
    for component, columns in [
        (biopro, ["SEQN", "LBXSCR", "LBXSAL", "LBXSBU", "LBXSGL", "LBXSKSI", "LBXSNASI"]),
        (urine, ["SEQN", "URXUMA", "URXUCR", "URDACT"]),
        (cbc, ["SEQN", "LBXHGB", "LBXHCT", "LBXRBCSI", "LBXWBCSI"]),
        (bp, ["SEQN", "BPXOSY1", "BPXOSY2", "BPXOSY3", "BPXODI1", "BPXODI2", "BPXODI3"]),
    ]:
        cohort = cohort.merge(available(component, columns), on="SEQN", how="left", validate="one_to_one")

    systolic = [column for column in ("BPXOSY1", "BPXOSY2", "BPXOSY3") if column in cohort]
    diastolic = [column for column in ("BPXODI1", "BPXODI2", "BPXODI3") if column in cohort]
    cohort["mean_systolic_bp"] = cohort[systolic].mean(axis=1) if systolic else math.nan
    cohort["mean_diastolic_bp"] = cohort[diastolic].mean(axis=1) if diastolic else math.nan
    cohort["egfr_2021"] = [
        egfr_2021_creatinine(creatinine, age, sex == 2)
        for creatinine, age, sex in zip(cohort["LBXSCR"], cohort["RIDAGEYR"], cohort["RIAGENDR"])
    ]
    cohort["egfr_2021"] = cohort["egfr_2021"].round(1)
    cohort["egfr_category"] = cohort["egfr_2021"].map(egfr_category).astype("string")
    cohort["albuminuria_category"] = pd.cut(
        cohort["URDACT"], bins=[-math.inf, 30, 300, math.inf], right=False, labels=["A1", "A2", "A3"]
    ).astype("string")
    has_screen_data = cohort["egfr_2021"].notna() & ((cohort["egfr_2021"] < 60) | cohort["URDACT"].notna())
    cohort["ckd_screen_positive"] = ((cohort["egfr_2021"] < 60) | (cohort["URDACT"] >= 30)).where(has_screen_data)
    cohort["ckd_stage_screen"] = cohort["egfr_category"].where(cohort["ckd_screen_positive"] == True, "no_ckd_screen")
    cohort.loc[cohort["ckd_screen_positive"].isna(), "ckd_stage_screen"] = pd.NA

    rename = {
        "SEQN": "participant_id", "RIDAGEYR": "age", "RIAGENDR": "sex_code",
        "RIDRETH3": "race_ethnicity_code", "WTMEC4YR": "exam_weight",
        "LBXSCR": "serum_creatinine_mg_dl", "LBXSAL": "serum_albumin_g_dl",
        "LBXSBU": "blood_urea_nitrogen_mg_dl", "LBXSGL": "serum_glucose_mg_dl",
        "LBXSKSI": "potassium_mmol_l", "LBXSNASI": "sodium_mmol_l",
        "URXUMA": "urine_albumin_mg_l", "URXUCR": "urine_creatinine_mg_dl",
        "URDACT": "urine_acr_mg_g", "LBXHGB": "hemoglobin_g_dl",
        "LBXHCT": "hematocrit_percent", "LBXRBCSI": "red_blood_cell_10e6_ul",
        "LBXWBCSI": "white_blood_cell_10e3_ul",
    }
    cohort = cohort.rename(columns=rename)
    drop_readings = [column for column in cohort if column.startswith(("BPXOSY", "BPXODI"))]
    cohort = cohort.drop(columns=drop_readings)

    output = PROCESSED / "nhanes_ckd.csv"
    output.parent.mkdir(parents=True, exist_ok=True)
    cohort.to_csv(output, index=False)
    write_dictionary(cohort)
    return output


def write_dictionary(frame: pd.DataFrame) -> None:
    descriptions = {
        "sex_code": "NHANES code: 1 male, 2 female.",
        "race_ethnicity_code": "NHANES RIDRETH3 code; use the official codebook.",
        "exam_weight": "NHANES 4-year MEC examination sample weight.",
        "egfr_2021": "2021 CKD-EPI creatinine eGFR, mL/min/1.73 m2.",
        "egfr_category": "KDIGO G category based on eGFR (G1, G2, G3a, G3b, G4, G5).",
        "albuminuria_category": "Urine ACR category: A1 <30, A2 30-299, A3 >=300 mg/g.",
        "ckd_screen_positive": "Single-visit screen: eGFR <60 or urine ACR >=30 mg/g.",
        "ckd_stage_screen": "no_ckd_screen or eGFR G category for a positive screen.",
    }
    lines = ["# NHANES processed data dictionary", "", "| Column | Description |", "|---|---|"]
    for column in frame.columns:
        description = descriptions.get(column, column.replace("_", " ").capitalize() + ".")
        lines.append(f"| `{column}` | {description} |")
    lines.extend(["", "Labels are for research screening and do not prove chronicity over three months.", ""])
    (PROCESSED / "data_dictionary.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Redownload existing raw files")
    parser.add_argument("--only", choices=("uci", "nhanes", "all"), default="all")
    args = parser.parse_args()
    if args.only in ("uci", "all"):
        print(f"UCI: {extract_uci(args.force)}")
    if args.only in ("nhanes", "all"):
        print(f"NHANES: {extract_nhanes(args.force)}")


if __name__ == "__main__":
    main()

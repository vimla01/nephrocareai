"""
Prescription parser using NLP for extracting medications, dosages, nutrients, and clinical advice.
"""
import re
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)


class FrequencyPattern(Enum):
    """Medication frequency patterns."""
    ONCE_DAILY = "Once Daily"
    TWICE_DAILY = "Twice Daily"
    THREE_TIMES_DAILY = "Three Times Daily"
    FOUR_TIMES_DAILY = "Four Times Daily"
    EVERY_OTHER_DAY = "Every Other Day"
    TWICE_WEEKLY = "Twice Weekly"
    ONCE_WEEKLY = "Once Weekly"
    AS_NEEDED = "As Needed"
    CUSTOM = "Custom"


@dataclass
class Medication:
    """Extracted medication information."""
    name: str
    dose: Optional[str] = None
    strength: Optional[str] = None
    unit: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    route: str = "oral"
    confidence: float = 0.75


@dataclass
class Nutrient:
    """Extracted nutritional guidance."""
    nutrient: str
    limit: Optional[str] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    confidence: float = 0.75


@dataclass
class ClinicalAdvice:
    """Extracted clinical instructions."""
    advice: str
    category: Optional[str] = None  # diet, activity, monitoring, etc.
    confidence: float = 0.75


class PrescriptionParser:
    """Parses prescription transcripts using NLP and pattern matching."""
    
    # Common medication names and patterns
    COMMON_MEDICATIONS = {
        # ACE Inhibitors
        "lisinopril", "enalapril", "ramipril", "perindopril", "quinapril",
        # ARBs
        "losartan", "valsartan", "irbesartan", "candesartan", "telmisartan",
        # Diuretics
        "furosemide", "bumetanide", "torsemide", "chlorthalidone", "hydrochlorothiazide",
        # Beta blockers
        "metoprolol", "carvedilol", "bisoprolol", "atenolol",
        # Calcium channel blockers
        "amlodipine", "diltiazem", "verapamil",
        # NSAIDs (watch for!)
        "ibuprofen", "naproxen", "aspirin",
        # Diabetes
        "metformin", "insulin", "glimepiride", "sitagliptin",
        # Statins
        "atorvastatin", "rosuvastatin", "pravastatin",
        # Antibiotics
        "penicillin", "amoxicillin", "ciprofloxacin", "azithromycin", "cephalexin", "sulfamethoxazole",
        # Others
        "aspirin", "clopidogrel", "warfarin"
    }
    
    # Nutrient patterns
    NUTRIENTS = {
        "sodium": ["sodium", "salt", "nacl", "na"],
        "potassium": ["potassium", "k+", "k", "potassium"],
        "phosphorus": ["phosphorus", "phosphate", "phos"],
        "protein": ["protein", "protien"],
        "fluids": ["fluid", "fluids", "water", "liquid"],
        "calcium": ["calcium"],
        "magnesium": ["magnesium"]
    }
    
    # Frequency patterns
    FREQUENCY_PATTERNS = {
        r"once\s+daily|one\s+time\s+a\s+day|1x\s*daily": FrequencyPattern.ONCE_DAILY,
        r"twice\s+daily|two\s+times\s+a\s+day|2x\s*daily": FrequencyPattern.TWICE_DAILY,
        r"three\s+times?\s+daily|3x\s*daily|tid": FrequencyPattern.THREE_TIMES_DAILY,
        r"four\s+times?\s+daily|4x\s*daily|qid": FrequencyPattern.FOUR_TIMES_DAILY,
        r"every\s+other\s+day|eod": FrequencyPattern.EVERY_OTHER_DAY,
        r"twice\s+weekly|2x\s*weekly": FrequencyPattern.TWICE_WEEKLY,
        r"once\s+weekly|1x\s*weekly": FrequencyPattern.ONCE_WEEKLY,
        r"as\s+needed|prn|when\s+needed": FrequencyPattern.AS_NEEDED,
    }
    
    # Unit patterns
    UNIT_PATTERNS = {
        r"(\d+\.?\d*)\s*(?:mg|milligram)": "mg",
        r"(\d+\.?\d*)\s*(?:mcg|microgram|μg)": "mcg",
        r"(\d+\.?\d*)\s*(?:g|gram)": "g",
        r"(\d+\.?\d*)\s*(?:ml|milliliter)": "ml",
        r"(\d+\.?\d*)\s*(?:l|liter)": "L",
        r"(\d+\.?\d*)\s*(?:unit|units|iu)": "units",
        r"(\d+\.?\d*)\s*(?:%|percent)": "%",
    }
    

    def __init__(self):
        """Initialize the prescription parser."""
        self.medications_found = []
        self.nutrients_found = []
        self.advice_found = []

    def parse(self, transcript: str) -> Dict:
        """
        Parse prescription transcript.

        Args:
            transcript: Text transcript from speech-to-text

        Returns:
            {
                "medications": [{"name", "dose", "strength", "unit", "frequency", ...}, ...],
                "nutrients": [{"nutrient", "limit", "value", "unit"}, ...],
                "clinical_advice": [{"advice", "category"}, ...],
                "raw_transcript": str,
                "extraction_confidence": float
            }
        """
        transcript_lower = transcript.lower()

        medications = self._extract_medications(transcript_lower)
        nutrients = self._extract_nutrients(transcript_lower)
        advice = self._extract_clinical_advice(transcript_lower)

        all_confidences = (
            [m.confidence for m in medications]
            + [n.confidence for n in nutrients]
            + [a.confidence for a in advice]
        )
        overall_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0.5

        return {
            "medications": [asdict(m) for m in medications],
            "nutrients": [asdict(n) for n in nutrients],
            "clinical_advice": [asdict(a) for a in advice],
            "raw_transcript": transcript,
            "extraction_confidence": overall_confidence,
        }

    def _extract_medications(self, transcript: str) -> List[Medication]:
        """Extract medication names and details."""
        medications = []

        for med_name in self.COMMON_MEDICATIONS:
            # Just look for the medication name with word boundaries
            pattern = rf"\b{med_name}\b"

            matches = re.finditer(pattern, transcript, re.IGNORECASE)
            for match in matches:
                start_pos = max(0, match.start() - 100)
                end_pos = min(len(transcript), match.end() + 100)
                context = transcript[start_pos:end_pos]

                medication = self._parse_medication_context(med_name, context)

                if not any(m.name.lower() == medication.name.lower() for m in medications):
                    medications.append(medication)

        return medications

    def _parse_medication_context(self, med_name: str, context: str) -> Medication:
        """Parse medication details from context."""
        med = Medication(name=med_name.title())

        # Extract dose/strength (e.g., "10 mg", "5-10 mg")
        dose_pattern = r"(\d+(?:-\d+)?\s*(?:mg|mcg|g|units)?)"
        dose_match = re.search(dose_pattern, context, re.IGNORECASE)
        if dose_match:
            med.dose = dose_match.group(1)
            unit_match = re.search(r"(mg|mcg|g|units|iu)", dose_match.group(1), re.IGNORECASE)
            if unit_match:
                med.unit = unit_match.group(1).lower()

        # Extract frequency
        for pattern, freq in self.FREQUENCY_PATTERNS.items():
            if re.search(pattern, context, re.IGNORECASE):
                med.frequency = freq.value
                break

        # Extract route
        routes = {
            "oral": ["by mouth", "po", "orally"],
            "intravenous": ["iv", "injection"],
            "topical": ["skin", "topical", "cream"],
            "inhaled": ["inhale", "inhaler"],
        }
        for route, keywords in routes.items():
            if any(kw in context for kw in keywords):
                med.route = route
                break

        # Extract duration (e.g., "for 7 days", "for 2 weeks")
        duration_pattern = r"for\s+(\d+)\s+(day|week|month|year)s?"
        duration_match = re.search(duration_pattern, context, re.IGNORECASE)
        if duration_match:
            med.duration = f"{duration_match.group(1)} {duration_match.group(2)}s"

        return med

    def _extract_nutrients(self, transcript: str) -> List[Nutrient]:
        """Extract nutritional guidance."""
        nutrients = []

        for nutrient_name, keywords in self.NUTRIENTS.items():
            for keyword in keywords:
                patterns = [
                    rf"(?:keep|limit|reduce|avoid)\s+{keyword}\s+(?:to|below|under)\s+(\d+)\s*(mg|g|ml|units)?",
                    rf"(?:no\s+)?(?:more\s+)?than\s+(\d+)\s*(mg|g|ml)\s+of\s+{keyword}",
                    rf"{keyword}\s+(?:intake\s+)?(?:should\s+)?(?:be\s+)?(?:limited\s+)?(?:to\s+)?(\d+)\s*(mg|g|ml)?",
                ]

                for pattern in patterns:
                    matches = re.finditer(pattern, transcript, re.IGNORECASE)
                    for match in matches:
                        value_str = match.group(1)
                        unit = match.group(2) if match.lastindex >= 2 else "mg"
                        unit = unit or "mg"

                        try:
                            value = float(value_str)
                            nutrient = Nutrient(
                                nutrient=nutrient_name,
                                limit=f"{value_str} {unit}",
                                value=value,
                                unit=unit,
                            )
                            if not any(n.nutrient == nutrient.nutrient for n in nutrients):
                                nutrients.append(nutrient)
                        except ValueError:
                            pass

        return nutrients

    def _extract_clinical_advice(self, transcript: str) -> List[ClinicalAdvice]:
        """Extract general clinical advice and instructions."""
        advice_list = []

        advice_patterns = [
            (r"(?:avoid|don'?t|do not)\s+([^.!?]+)", "precaution"),
            (r"(?:monitor|check|watch)\s+(?:your\s+)?([^.!?]+)", "monitoring"),
            (r"(?:exercise|walk|move)\s+(?:for\s+)?([^.!?]+)", "activity"),
            (r"(?:drink|stay|remain)\s+(?:well\s+)?hydrated", "hydration"),
            (r"(?:follow\s+)?(?:a|your)\s+([^.!?]*diet[^.!?]*)", "diet"),
            (r"(?:contact|call|see)\s+(?:your\s+)?([^.!?]+)", "followup"),
        ]

        for pattern, category in advice_patterns:
            matches = re.finditer(pattern, transcript, re.IGNORECASE)
            for match in matches:
                advice_text = match.group(0) if match.lastindex is None else match.group(1)
                advice_text = advice_text.strip()
                if advice_text and len(advice_text) > 5:
                    advice = ClinicalAdvice(
                        advice=advice_text,
                        category=category,
                        confidence=0.7,
                    )
                    advice_list.append(advice)

        return advice_list

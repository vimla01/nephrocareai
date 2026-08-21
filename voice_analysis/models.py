"""
Data structures for Voice Prescription Analysis feature
Use with your existing patient/database models
"""
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional
from datetime import datetime


@dataclass
class PrescriptionAnalysisResult:
    """Complete analysis result from voice prescription."""
    analysis_id: str
    patient_id: str
    transcript: str
    medications: List[Dict] = field(default_factory=list)
    nutrients: List[Dict] = field(default_factory=list)
    interactions: List[Dict] = field(default_factory=list)
    risk_score: float = 0.0
    risk_category: str = "low"
    critical_alerts: int = 0
    patient_summary: str = ""
    doctor_summary: str = ""
    recommendations: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.utcnow)


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
class DrugInteraction:
    """Detected drug interaction."""
    interaction_type: str  # drug_drug, drug_nutrient, drug_ckd, duplication
    severity: str  # low, moderate, high, critical
    description: str
    recommendation: str
    type: Optional[str] = None
    confidence: float = 1.0

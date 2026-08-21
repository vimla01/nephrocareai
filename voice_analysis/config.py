"""
Voice Prescription Analysis Feature Configuration
Integrate with your existing NephroCare app
"""
import os

# Whisper configuration
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")  # tiny, base, small, medium, large
ALLOWED_AUDIO_FORMATS = {"wav", "mp3", "m4a", "aac", "flac", "ogg"}
MAX_AUDIO_SIZE_MB = 25

# Risk scoring
RISK_SCORE_THRESHOLDS = {
    "low": (0, 25),
    "moderate": (25, 50),
    "high": (50, 75),
    "critical": (75, 100)
}

# CKD Stages (eGFR ml/min/1.73m²)
CKD_STAGES = {
    1: (90, 120),
    2: (60, 89),
    3: (30, 59),
    4: (15, 29),
    5: (0, 14)
}

# Nutrient limits for CKD
NUTRIENT_LIMITS = {
    "sodium": {"max": 2000, "unit": "mg"},
    "potassium": {"max": 2000, "unit": "mg"},
    "phosphorus": {"max": 1000, "unit": "mg"},
    "protein": {"max": 0.8, "unit": "g/kg"},
    "fluids": {"max": 1000, "unit": "ml"}
}

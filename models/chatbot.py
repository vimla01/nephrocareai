"""
NephroCare - Advanced AI Nephrology Assistant (Production-Grade)
Multi-language support, RAG, Patient Context, Lab Analysis, Tool Calling

Features:
- Retrieval-Augmented Generation (RAG) with medical guidelines
- Patient context awareness and long-term memory
- Lab report analysis (PDF/OCR)
- Intelligent tool calling (eGFR, BMI, drug interaction calculators)
- Vector database for semantic retrieval
- Safety layer for emergency detection
- Structured medical outputs
- Multi-language support (11 Indian languages)
"""

import os
import json
import re
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
from dotenv import load_dotenv
from google import genai
from PIL import Image
try:
    import fitz  # PyMuPDF for PDF parsing
except ImportError:
    fitz = None
import numpy as np
from dataclasses import dataclass, asdict

# Vector database
try:
    import chromadb
    from chromadb.config import Settings
except ImportError:
    chromadb = None

from pathlib import Path
from dotenv import load_dotenv
import os

env_path = Path(__file__).resolve().parent.parent / ".env"
print("Loading:", env_path)

load_dotenv(env_path)

API_KEY = os.getenv("GEMINI_API_CHATBOT") or os.getenv("GEMINI_API_KEY")
if API_KEY:
    client = genai.Client(api_key=API_KEY)


class Language(Enum):
    """Supported languages."""
    ENGLISH = "en"
    HINDI = "hi"
    TAMIL = "ta"
    TELUGU = "te"
    KANNADA = "kn"
    MALAYALAM = "ml"
    MARATHI = "mr"
    GUJARATI = "gu"
    BENGALI = "bn"
    PUNJABI = "pa"
    URDU = "ur"


class EmergencySeverity(Enum):
    """Emergency severity levels."""
    SAFE = "safe"
    WARNING = "warning"
    EMERGENCY = "emergency"


@dataclass
class PatientContext:
    """Patient health context for personalized responses."""
    user_id: str
    age: Optional[int] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    ckd_stage: Optional[int] = None
    current_egfr: Optional[float] = None
    current_creatinine: Optional[float] = None
    current_potassium: Optional[float] = None
    current_phosphorus: Optional[float] = None
    current_sodium: Optional[float] = None
    medications: List[str] = None
    comorbidities: List[str] = None
    lab_history: List[Dict] = None
    dietary_restrictions: List[str] = None
    
    def __post_init__(self):
        if self.medications is None:
            self.medications = []
        if self.comorbidities is None:
            self.comorbidities = []
        if self.lab_history is None:
            self.lab_history = []
        if self.dietary_restrictions is None:
            self.dietary_restrictions = []


@dataclass
class MedicalResponse:
    """Structured medical response."""
    assessment: str
    explanation: str
    educational_information: str
    kidney_specific_guidance: str
    questions_for_nephrologist: List[str]
    emergency_detected: bool = False
    emergency_action: Optional[str] = None
    references: List[str] = None
    confidence_score: float = 0.8
    
    def __post_init__(self):
        if self.references is None:
            self.references = []


class MedicalKnowledgeBase:
    """Vector database for medical knowledge retrieval."""
    
    def __init__(self, collection_name: str = "medical_guidelines"):
        """Initialize vector database."""
        self.collection_name = collection_name
        
        # Initialize Chroma vector database
        if chromadb:
            self.client = chromadb.Client()
            self.collection = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        else:
            self.collection = None
        
        # KDIGO Guidelines
        self.kdigo_guidelines = self._load_kdigo_guidelines()
        
        # NKF Guidelines
        self.nkf_guidelines = self._load_nkf_guidelines()
        
        # Medication Database
        self.medication_db = self._load_medication_database()
        
        # Initialized
        self._initialize_knowledge_base()
    
    def _load_kdigo_guidelines(self) -> Dict[str, str]:
        """Load KDIGO clinical practice guidelines for CKD."""
        return {
            "ckd_definition": """
            CKD is defined as abnormalities in kidney structure or function that persist for >3 months 
            and confer health risks. Stages are based on eGFR:
            - Stage 1: eGFR ≥90 with kidney damage
            - Stage 2: eGFR 60-89 with kidney damage
            - Stage 3a: eGFR 45-59
            - Stage 3b: eGFR 30-44
            - Stage 4: eGFR 15-29
            - Stage 5: eGFR <15 (kidney failure)
            """,
            "potassium_management": """
            KDIGO recommends:
            - Monitor serum potassium regularly
            - Dietary potassium restriction if K+ >5.0 mEq/L
            - Target <2-3g (51-77 mmol) daily for CKD stages 3-5
            - High-potassium foods to limit: bananas, oranges, tomatoes, potatoes, nuts
            - Use low-potassium herbs instead of salt
            """,
            "phosphorus_management": """
            KDIGO recommends:
            - Maintain normal serum phosphorus (target 2.5-4.5 mg/dL)
            - Dietary phosphorus restriction in CKD-MBD
            - Consider phosphate binders (calcium acetate, sevelamer)
            - Low-phosphorus foods: lean meats, white bread, apples
            - Limit dairy, nuts, whole grains in advanced CKD
            """,
            "sodium_management": """
            KDIGO recommends:
            - <2 g/day (90 mmol/day) sodium intake for hypertension control
            - Reduces BP and proteinuria
            - Limit processed foods, canned items, salty snacks
            - Use potassium-free salt substitutes cautiously
            """,
            "bp_management": """
            KDIGO recommends:
            - Target BP <120/80 mmHg for CKD patients
            - ACE inhibitors or ARBs as first-line for proteinuria reduction
            - Regular monitoring (home BP monitoring preferred)
            - Lifestyle: weight loss, DASH diet, exercise, stress management
            """,
            "protein_management": """
            KDIGO recommends:
            - 0.8 g/kg/day for non-diabetic CKD
            - 0.8 g/kg/day for diabetic CKD
            - 1.0-1.2 g/kg/day for dialysis patients
            - Emphasize high-quality proteins (eggs, lean meat, fish)
            - Monitor serum albumin and nutritional status
            """,
            "dialysis_criteria": """
            Indications for dialysis initiation (KDIGO):
            - eGFR <15 mL/min/1.73m²
            - Symptoms of uremia
            - Inability to manage CKD medically
            - Fluid overload unresponsive to diuretics
            - Hyperkalemia uncontrolled by conservative measures
            - Severe metabolic acidosis
            """,
            "transplantation": """
            Kidney transplantation is the best renal replacement therapy when possible:
            - Living donor transplants have best outcomes
            - Deceased donor transplants also excellent
            - 1-year graft survival >95% with modern immunosuppression
            - Requires lifelong immunosuppressive therapy
            - Regular monitoring for rejection and complications
            """
        }
    
    def _load_nkf_guidelines(self) -> Dict[str, str]:
        """Load NKF KDOQI clinical practice guidelines."""
        return {
            "anemia_management": """
            NKF KDOQI recommends:
            - Hemoglobin target 10-12 g/dL (individualized)
            - Iron supplementation if ferritin <100 ng/mL
            - ESA (Erythropoiesis-Stimulating Agent) if appropriate
            - Regular Hgb monitoring
            """,
            "bone_disease": """
            NKF KDOQI recommends:
            - Screen with serum calcium, phosphorus, PTH
            - Target PTH 150-300 pg/mL for CKD stages 3-5
            - Vitamin D supplementation
            - Calcium-phosphorus product <55 mg²/dL²
            """,
            "cardiovascular_risk": """
            CKD patients have high cardiovascular risk:
            - Aggressive BP and lipid management
            - Statins for cardiovascular protection
            - Aspirin not routinely recommended for primary prevention
            - Regular cardiac assessment
            """,
            "infection_prevention": """
            NKF recommends:
            - Annual influenza vaccination
            - Pneumococcal vaccination (updated recommendations)
            - Hepatitis B vaccination (check antibody response)
            - Avoid live vaccines
            """
        }
    
    def _load_medication_database(self) -> Dict[str, Dict]:
        """Load medication information for CKD patients."""
        return {
            "lisinopril": {
                "class": "ACE Inhibitor",
                "indication": "Hypertension, proteinuria reduction",
                "ckd_safe": True,
                "monitoring": "Creatinine, potassium",
                "side_effects": "Dry cough, hyperkalemia",
                "interactions": ["NSAIDs", "Potassium supplements"]
            },
            "losartan": {
                "class": "ARB",
                "indication": "Hypertension, proteinuria reduction",
                "ckd_safe": True,
                "monitoring": "Creatinine, potassium",
                "side_effects": "Hyperkalemia, dizziness",
                "interactions": ["NSAIDs", "Potassium supplements"]
            },
            "metformin": {
                "class": "Antidiabetic",
                "indication": "Type 2 diabetes",
                "ckd_safe": False,  # Avoid if eGFR <30
                "monitoring": "eGFR, lactate",
                "side_effects": "GI upset, lactic acidosis risk",
                "interactions": ["Contrast dye"]
            },
            "atorvastatin": {
                "class": "Statin",
                "indication": "Cardiovascular protection",
                "ckd_safe": True,
                "monitoring": "Lipids, creatinine kinase",
                "side_effects": "Muscle pain, liver dysfunction",
                "interactions": ["Other statins"]
            },
            "sevelamer": {
                "class": "Phosphate binder",
                "indication": "Hyperphosphatemia",
                "ckd_safe": True,
                "monitoring": "Phosphorus levels",
                "side_effects": "GI upset, constipation",
                "interactions": ["Other medications (absorption)"]
            }
        }
    
    def _initialize_knowledge_base(self):
        """Initialize vector database with medical documents."""
        if not self.collection:
            return
        
        # Combine all guidelines
        all_docs = {**self.kdigo_guidelines, **self.nkf_guidelines}
        
        # Add documents to vector store
        for doc_id, content in all_docs.items():
            try:
                self.collection.add(
                    ids=[doc_id],
                    documents=[content],
                    metadatas=[{"source": "medical_guidelines", "type": doc_id}]
                )
            except Exception as e:
                print(f"Error adding document {doc_id}: {e}")
    
    def retrieve_relevant_guidelines(self, query: str, top_k: int = 3) -> List[str]:
        """Retrieve relevant medical guidelines using semantic search or keyword fallback."""
        if not self.collection:
            # Simple keyword-matching fallback
            all_docs = {**self.kdigo_guidelines, **self.nkf_guidelines}
            query_words = set(re.findall(r'\w+', query.lower()))
            matches = []
            for doc_id, content in all_docs.items():
                content_words = set(re.findall(r'\w+', content.lower()))
                intersection = query_words.intersection(content_words)
                if intersection:
                    matches.append((len(intersection), content))
            # Sort by count of intersecting words descending
            matches.sort(key=lambda x: x[0], reverse=True)
            retrieved = [content for _, content in matches[:top_k]]
            if not retrieved:
                # Default fallback guidelines
                retrieved = [
                    all_docs.get("ckd_definition", ""),
                    all_docs.get("potassium_management", ""),
                    all_docs.get("sodium_management", "")
                ]
            return retrieved
        
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=top_k
            )
            return results['documents'][0] if results['documents'] else []
        except Exception as e:
            print(f"Error retrieving guidelines: {e}")
            return []
    
    def get_medication_info(self, drug_name: str) -> Optional[Dict]:
        """Get medication information."""
        return self.medication_db.get(drug_name.lower())
    
    def check_drug_interaction(self, drug1: str, drug2: str) -> bool:
        """Check if two drugs have interactions."""
        drug1_info = self.get_medication_info(drug1)
        drug2_info = self.get_medication_info(drug2)
        
        if not drug1_info or not drug2_info:
            return False
        
        return (drug2 in drug1_info.get("interactions", []) or 
                drug1 in drug2_info.get("interactions", []))


class LabReportAnalyzer:
    """Analyze lab reports (PDF/images) to extract kidney health metrics."""
    
    @staticmethod
    def extract_text_from_pdf(pdf_path: str) -> str:
        """Extract text from PDF using PyMuPDF."""
        if not fitz:
            print("PyMuPDF is not installed. PDF extraction is unavailable.")
            return ""
        try:
            doc = fitz.open(pdf_path)
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return text
        except Exception as e:
            print(f"Error extracting PDF: {e}")
            return ""
    
    @staticmethod
    def extract_lab_values(text: str) -> Dict[str, float]:
        """Extract lab values from text using regex."""
        lab_values = {}
        
        # Patterns for common kidney lab values
        patterns = {
            "creatinine": r"(?:Creatinine|Creat)[\s:]*([0-9.]+)\s*(?:mg/dL|mg/dl)",
            "egfr": r"(?:eGFR|GFR)[\s:]*([0-9.]+)\s*(?:mL/min|ml/min)",
            "potassium": r"(?:Potassium|K\+)[\s:]*([0-9.]+)\s*(?:mEq/L|mmol/L)",
            "phosphorus": r"(?:Phosphorus|Phosphate|Phos)[\s:]*([0-9.]+)\s*(?:mg/dL|mmol/L)",
            "sodium": r"(?:Sodium|Na\+)[\s:]*([0-9.]+)\s*(?:mEq/L|mmol/L)",
            "calcium": r"(?:Calcium|Ca)[\s:]*([0-9.]+)\s*(?:mg/dL|mmol/L)",
            "bun": r"(?:BUN|Blood Urea Nitrogen)[\s:]*([0-9.]+)\s*(?:mg/dL|mmol/L)",
            "albumin": r"(?:Albumin)[\s:]*([0-9.]+)\s*(?:g/dL|g/L)",
            "hemoglobin": r"(?:Hemoglobin|Hgb)[\s:]*([0-9.]+)\s*(?:g/dL|g/L)",
            "blood_pressure": r"(?:BP|Blood Pressure)[\s:]*([0-9]+)/([0-9]+)"
        }
        
        for label, pattern in patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                if label == "blood_pressure":
                    lab_values[label] = {
                        "systolic": float(match.group(1)),
                        "diastolic": float(match.group(2))
                    }
                else:
                    lab_values[label] = float(match.group(1))
        
        return lab_values
    
    @staticmethod
    def analyze_lab_trends(lab_history: List[Dict]) -> Dict[str, str]:
        """Analyze trends in lab values over time."""
        trends = {}
        
        if len(lab_history) < 2:
            return trends
        
        # Sort by date
        sorted_history = sorted(lab_history, key=lambda x: x.get("date", ""))
        
        # Analyze each metric
        for metric in ["creatinine", "egfr", "potassium", "phosphorus"]:
            values = [h.get(metric) for h in sorted_history if h.get(metric)]
            
            if len(values) >= 2:
                change = values[-1] - values[0]
                days_diff = 30  # Assume monthly labs for simplicity
                
                if metric == "egfr":
                    rate = change / days_diff
                    if rate < -2:
                        trends[metric] = f"Declining rapidly ({rate:.2f} mL/min/month)"
                    elif rate < -1:
                        trends[metric] = f"Declining moderately ({rate:.2f} mL/min/month)"
                    elif rate < 0:
                        trends[metric] = f"Slowly declining ({rate:.2f} mL/min/month)"
                    else:
                        trends[metric] = "Stable"
                else:
                    trends[metric] = f"Change: {change:+.2f} {'↑' if change > 0 else '↓'}"
        
        return trends


class MedicalCalculators:
    """Medical calculators for CKD management."""
    
    @staticmethod
    def calculate_egfr_ckdepi(age: int, gender: str, creatinine: float, 
                              race: str = "non-black") -> float:
        """Calculate eGFR using CKD-EPI equation."""
        # CKD-EPI 2009 equation
        if gender.lower() == "female":
            a = 0.7
            b = -0.329
        else:
            a = 0.9
            b = -0.411
        
        race_factor = 1.159 if race.lower() == "black" else 1.0
        
        egfr = 141 * pow(creatinine/a, b) * pow(0.993, age) * race_factor
        return round(egfr, 1)
    
    @staticmethod
    def calculate_bmi(weight_kg: float, height_cm: float) -> float:
        """Calculate BMI."""
        height_m = height_cm / 100
        bmi = weight_kg / (height_m ** 2)
        return round(bmi, 1)
    
    @staticmethod
    def get_ckd_stage(egfr: float) -> Tuple[int, str]:
        """Get CKD stage from eGFR."""
        if egfr >= 90:
            return 1, "Normal kidney function (with kidney disease)"
        elif egfr >= 60:
            return 2, "Mildly decreased kidney function"
        elif egfr >= 45:
            return 3, "a - Mildly to moderately decreased"
        elif egfr >= 30:
            return 3, "b - Moderately to severely decreased"
        elif egfr >= 15:
            return 4, "Severely decreased kidney function"
        else:
            return 5, "Kidney failure (requires dialysis or transplant)"
    
    @staticmethod
    def calculate_dietary_protein(body_weight_kg: float, ckd_stage: int) -> float:
        """Calculate daily protein intake recommendation."""
        if ckd_stage <= 2:
            return round(body_weight_kg * 1.0, 1)
        elif ckd_stage in [3, 4]:
            return round(body_weight_kg * 0.8, 1)
        else:  # Stage 5
            return round(body_weight_kg * 1.2, 1)  # Higher for dialysis
    
    @staticmethod
    def assess_electrolyte_status(potassium: float, phosphorus: float, 
                                 calcium: float) -> Dict[str, str]:
        """Assess electrolyte status."""
        assessment = {}
        
        # Potassium assessment (normal: 3.5-5.0 mEq/L)
        if potassium < 3.5:
            assessment["potassium"] = "LOW - Risk of muscle weakness and arrhythmias"
        elif potassium <= 5.0:
            assessment["potassium"] = "NORMAL - Good control"
        elif potassium <= 5.5:
            assessment["potassium"] = "ELEVATED - Increase dietary restriction"
        else:
            assessment["potassium"] = "HIGH - Urgent: Consider binders or medication"
        
        # Phosphorus assessment (normal: 2.5-4.5 mg/dL)
        if phosphorus < 2.5:
            assessment["phosphorus"] = "LOW - May need supplementation"
        elif phosphorus <= 4.5:
            assessment["phosphorus"] = "NORMAL - Good control"
        else:
            assessment["phosphorus"] = "HIGH - Increase dietary restriction and consider binders"
        
        # Calcium assessment (normal: 8.5-10.5 mg/dL)
        if calcium < 8.5:
            assessment["calcium"] = "LOW - May need vitamin D or supplementation"
        elif calcium <= 10.5:
            assessment["calcium"] = "NORMAL"
        else:
            assessment["calcium"] = "HIGH - Monitor for complications"
        
        return assessment


class SafetyLayer:
    """Emergency detection and safety layer."""
    
    EMERGENCY_KEYWORDS = {
        "chest": ["chest pain", "chest tightness", "angina", "heart attack"],
        "breathing": ["shortness of breath", "difficulty breathing", "gasping", "suffocation"],
        "neurological": ["confusion", "altered mental status", "seizure", "loss of consciousness", "stroke"],
        "severe": ["severe pain", "uncontrolled bleeding", "severe headache", "high fever"],
        "dialysis": ["missed dialysis", "dialyzer rupture", "access failure", "bleeding from access"]
    }
    
    @staticmethod
    def detect_emergency(text: str) -> Tuple[bool, Optional[str]]:
        """Detect emergency symptoms in user message."""
        text_lower = text.lower()
        
        for category, keywords in SafetyLayer.EMERGENCY_KEYWORDS.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return True, f"Emergency symptom detected: {keyword}"
        
        return False, None
    
    @staticmethod
    def generate_emergency_response(symptom: str, language: Language) -> str:
        """Generate emergency response in appropriate language."""
        emergency_messages = {
            Language.ENGLISH: f"🚨 EMERGENCY DETECTED: {symptom}\n\nIMMMEDIATE ACTION REQUIRED:\n1. STOP reading this message\n2. Call emergency services (911 in US, 112 in India)\n3. Go to the nearest hospital/emergency room\n4. Tell them you have kidney disease\n5. Do NOT wait for online advice\n\nThis is a medical emergency. Do not delay seeking professional help.",
            
            Language.HINDI: f"🚨 आपातकाल: {symptom}\n\nतुरंत कार्रवाई आवश्यक:\n1. यह संदेश बंद करें\n2. आपातकालीन सेवा को कॉल करें (भारत में 102)\n3. निकटतम अस्पताल जाएं\n4. उन्हें बताएं कि आपको किडनी की बीमारी है\n5. ऑनलाइन सलाह का इंतजार न करें\n\nयह चिकित्सा आपातकाल है।",
            
            Language.TAMIL: f"🚨 அவசரநிலை: {symptom}\n\nतुरंत நடவடிக்கை:\n1. இந்த செய்தியை நிறுத்தவும்\n2. அவசரநிலை சேவைகளை அழைக்கவும் (102)\n3. அருகிலுள்ள மருத்துவமனைக்கு செல்லவும்\n4. உங்களுக்கு சிறுநீரக நோய் உள்ளது என்று சொல்லவும்",
            
            Language.TELUGU: f"🚨 জরুरी: {symptom}\n\nతక్షణ చర్య:\n1. ఈ సందేశాన్ని ఆపివేయండి\n2. అత్యవసర సేవలకు కాల్ చేయండి (102)\n3. సమీప ఆసპత్రికకు వెళ్లండి",
            
            Language.KANNADA: f"🚨 জরুরี: {symptom}\n\nತಕ್ಷಣ ಕ್ರಿಯೆ:\n1. ಈ ಸಂದೇಶವನ್ನು ನಿಲ್ಲಿಸಿ\n2. ತುರ್ತು ಸೇವೆಗಳಿಗೆ ಕರೆ ಮಾಡಿ (102)\n3. ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗೆ ಹೋಗಿ",
            
            Language.MALAYALAM: f"🚨 জরুरी: {symptom}\n\nതടസ്സമില്ലാത്ത സഹായം:\n1. ഈ സന്ദേശം ഇപ്പോൾ വിടുക\n2. അത്യാഗത സേവനങ്ങൾ വിളിക്കുക (102)\n3. അടുത്തുള്ള ആശുപത്രിയിലേക്ക് പോകുക",
            
            Language.MARATHI: f"🚨 आपातकाल: {symptom}\n\nतुरंत कार्रवाई:\n1. हा संदेश बंद करा\n2. आपातकालीन सेवेला कॉल करा (102)\n3. जवळच्या रुग्णालयात जा",
            
            Language.GUJARATI: f"🚨 આપાતકાલ: {symptom}\n\nતાત્કાલિક પગલું:\n1. આ સંદેશ બંધ કરો\n2. આપાતકાલીન સેવાઓ કોલ કરો (102)\n3. નજીકના હોસ્પિટલમાં જાઓ",
            
            Language.BENGALI: f"🚨 응급: {symptom}\n\nতাৎক্ষণিক ব্যবস্থা:\n1. এই বার্তা বন্ধ করুন\n2. জরুরি সেবা কল করুন (102)\n3. নিকটস্থ হাসপাতালে যান",
            
            Language.PUNJABI: f"🚨 ਜਰੂਰੀ: {symptom}\n\nਤਾਤਕਾਲਿਕ ਕਾਰਵਾਈ:\n1. ਇਹ ਸੁਨੇਹਾ ਬੰਦ ਕਰੋ\n2. ਜਰੂਰੀ ਸੇਵਾਵਾਂ ਨੂੰ ਕਾਲ ਕਰੋ (102)\n3. ਨਜ਼ਦੀਕੀ ਹਸਪਤਾਲ ਜਾਓ",
            
            Language.URDU: f"🚨 ایمرجنسی: {symptom}\n\nفوری اقدام:\n1. یہ پیغام بند کریں\n2. ایمرجنسی سروسز کو کال کریں (102)\n3. قریب ترین ہسپتال میں جائیں"
        }
        
        return emergency_messages.get(language, emergency_messages[Language.ENGLISH])


class AdvancedAINephrologistChatbot:
    """Production-grade AI Nephrology Assistant with RAG, patient context, and tools."""
    
    SYSTEM_PROMPT_TEMPLATE = """
❗ CRITICAL LANGUAGE INSTRUCTION ❗
You MUST respond ENTIRELY in {language}. This is MANDATORY.
Do NOT use English unless {language} is English.
Every single word of your response must be in {language}.
Do not mix languages. Do not start in {language} and switch to English.

You are an advanced AI Nephrology Assistant for NephroCare - a Chronic Kidney Disease management platform.

CRITICAL DISCLAIMERS:
- You are NOT a doctor and cannot diagnose or prescribe medications
- This is educational support ONLY, not medical advice
- Always recommend consulting a qualified nephrologist
- In emergencies, direct to immediate hospital care
- All responses must include appropriate caveats

YOUR CAPABILITIES:
1. Medical Knowledge: KDIGO/NKF guidelines, CKD management
2. Patient Context: Understand individual kidney function, labs, medications
3. Lab Analysis: Interpret lab trends and results
4. Calculations: eGFR, BMI, CKD stage, protein needs
5. Safety: Detect emergency symptoms
6. Tool Calling: Use calculators and drug interaction checker
7. Personalization: Consider patient-specific factors
8. Multi-language: Respond ONLY in {language}

PATIENT CONTEXT:
Age: {age}
Gender: {gender}
CKD Stage: {ckd_stage}
Current eGFR: {egfr}
Current Labs: K+={potassium}, PO4={phosphorus}, Na+={sodium}
Medications: {medications}
Comorbidities: {comorbidities}

MEDICAL KNOWLEDGE (Retrieved):
{retrieved_guidelines}

INSTRUCTIONS:
- Answer the user's question directly, clearly, and concisely in natural paragraphs.
- Use science-backed information from KDIGO/NKF guidelines
- Consider patient's specific kidney function stage
- Check for drug interactions with listed medications
- Provide actionable, practical guidance
- Be empathetic about burden of CKD
- Never hesitate to recommend professional consultation
- If uncertain, admit limitations and suggest doctor consultation
- If the user asks for hospitals, clinics, or doctors, suggest using the Google Maps links below, and explicitly ask them for their city or location so you can recommend local hospitals.
- If the user specifies a city or location (e.g. "Mumbai", "Delhi", "Pune"), you MUST generate direct Google Maps search links for that city. Format links strictly as standard markdown: `[Kidney Hospitals in {{City}}](https://www.google.com/maps/search/?api=1&query=kidney+care+hospitals+in+{{City}})` and `[Nephrologists in {{City}}](https://www.google.com/maps/search/?api=1&query=nephrologists+in+{{City}})`.
- Always prioritize patient safety

REMINDER: Your ENTIRE response must be written in {language}. Not English. Not mixed. Only {language}.
"""
    
    def __init__(self, language: Language = Language.ENGLISH):
        """Initialize advanced chatbot."""
        if not API_KEY:
            raise ValueError("Neither GEMINI_API_CHATBOT nor GEMINI_API_KEY is set in environment")
        
        self.client = client
        self.language = language
        self.knowledge_base = MedicalKnowledgeBase()
        self.lab_analyzer = LabReportAnalyzer()
        self.calculators = MedicalCalculators()
        self.safety_layer = SafetyLayer()
        
        self.conversation_history = []
        self.patient_context: Optional[PatientContext] = None
        self.max_history = 50  # Keep more history for long-term memory
    
    def set_patient_context(self, context: PatientContext):
        """Set patient health context for personalized responses."""
        self.patient_context = context
    
    def update_patient_labs(self, labs: Dict[str, float], date: str = None):
        """Update patient lab values."""
        if not self.patient_context:
            return
        
        if date is None:
            date = datetime.now().isoformat()
        
        # Calculate eGFR if creatinine provided
        if "creatinine" in labs and self.patient_context.age:
            egfr = self.calculators.calculate_egfr_ckdepi(
                age=self.patient_context.age,
                gender=self.patient_context.gender or "male",
                creatinine=labs["creatinine"]
            )
            labs["egfr"] = egfr
            self.patient_context.current_egfr = egfr
        
        # Update electrolytes
        if "potassium" in labs:
            self.patient_context.current_potassium = labs["potassium"]
        if "phosphorus" in labs:
            self.patient_context.current_phosphorus = labs["phosphorus"]
        if "sodium" in labs:
            self.patient_context.current_sodium = labs["sodium"]
        if "creatinine" in labs:
            self.patient_context.current_creatinine = labs["creatinine"]
        
        # Add to history
        labs_with_date = {**labs, "date": date}
        self.patient_context.lab_history.append(labs_with_date)
    
    def analyze_lab_report(self, file_path: str) -> Dict[str, Any]:
        """Analyze uploaded lab report (PDF or image)."""
        try:
            if file_path.lower().endswith('.pdf'):
                text = self.lab_analyzer.extract_text_from_pdf(file_path)
            else:
                # For images, would use OCR (not implemented here)
                return {"error": "Image OCR not implemented"}
            
            lab_values = self.lab_analyzer.extract_lab_values(text)
            self.update_patient_labs(lab_values)
            
            return {
                "extracted_values": lab_values,
                "trends": self.lab_analyzer.analyze_lab_trends(
                    self.patient_context.lab_history
                ) if self.patient_context else {},
                "analysis_timestamp": datetime.now().isoformat()
            }
        
        except Exception as e:
            return {"error": str(e)}
    
    def call_tool(self, tool_name: str, **kwargs) -> str:
        """Call medical calculation tools."""
        try:
            if tool_name == "calculate_egfr":
                egfr = self.calculators.calculate_egfr_ckdepi(
                    age=kwargs.get("age"),
                    gender=kwargs.get("gender", "male"),
                    creatinine=kwargs.get("creatinine"),
                    race=kwargs.get("race", "non-black")
                )
                stage, description = self.calculators.get_ckd_stage(egfr)
                return f"eGFR: {egfr} mL/min/1.73m² (CKD Stage {stage}: {description})"
            
            elif tool_name == "calculate_bmi":
                bmi = self.calculators.calculate_bmi(
                    weight_kg=kwargs.get("weight_kg"),
                    height_cm=kwargs.get("height_cm")
                )
                category = "Normal" if 18.5 <= bmi < 25 else ("Overweight" if bmi < 30 else "Obese")
                return f"BMI: {bmi} kg/m² ({category})"
            
            elif tool_name == "calculate_ckd_stage":
                stage, description = self.calculators.get_ckd_stage(kwargs.get("egfr"))
                return f"CKD Stage {stage}: {description}"
            
            elif tool_name == "calculate_protein_intake":
                protein = self.calculators.calculate_dietary_protein(
                    body_weight_kg=kwargs.get("weight_kg"),
                    ckd_stage=kwargs.get("ckd_stage", 3)
                )
                return f"Daily protein recommendation: {protein}g/day"
            
            elif tool_name == "assess_electrolytes":
                assessment = self.calculators.assess_electrolyte_status(
                    potassium=kwargs.get("potassium"),
                    phosphorus=kwargs.get("phosphorus"),
                    calcium=kwargs.get("calcium")
                )
                return json.dumps(assessment, indent=2)
            
            elif tool_name == "check_drug_interaction":
                has_interaction = self.knowledge_base.check_drug_interaction(
                    drug1=kwargs.get("drug1"),
                    drug2=kwargs.get("drug2")
                )
                return f"Drug interaction: {'YES - Consult nephrologist' if has_interaction else 'No known interaction'}"
            
            elif tool_name == "get_medication_info":
                info = self.knowledge_base.get_medication_info(kwargs.get("drug_name"))
                if info:
                    return json.dumps(info, indent=2)
                return "Medication information not found in database"
            
            else:
                return f"Unknown tool: {tool_name}"
        
        except Exception as e:
            return f"Error executing tool: {str(e)}"
    
    def create_system_prompt(self) -> str:
        """Create dynamic system prompt with patient context and retrieved guidelines."""
        # Retrieve relevant guidelines
        retrieved_docs = self.knowledge_base.retrieve_relevant_guidelines(
            self.conversation_history[-1]["content"] if self.conversation_history else "CKD management"
        )
        retrieved_text = "\n".join(retrieved_docs) if retrieved_docs else "Standard CKD guidelines"
        
        # Format patient context
        if self.patient_context:
            age = self.patient_context.age or "Not provided"
            gender = self.patient_context.gender or "Not provided"
            ckd_stage = self.patient_context.ckd_stage or "Unknown"
            egfr = self.patient_context.current_egfr or "Unknown"
            potassium = self.patient_context.current_potassium or "Unknown"
            phosphorus = self.patient_context.current_phosphorus or "Unknown"
            sodium = self.patient_context.current_sodium or "Unknown"
            medications = ", ".join(self.patient_context.medications) or "None listed"
            comorbidities = ", ".join(self.patient_context.comorbidities) or "None listed"
        else:
            age = gender = ckd_stage = egfr = potassium = phosphorus = sodium = "Not provided"
            medications = comorbidities = "Not provided"
        
        language_name = {
            Language.ENGLISH: "English",
            Language.HINDI: "Hindi (हिन्दी)",
            Language.TAMIL: "Tamil (தமிழ்)",
            Language.TELUGU: "Telugu (తెలుగు)",
            Language.KANNADA: "Kannada (ಕನ್ನಡ)",
            Language.MALAYALAM: "Malayalam (മലയാളം)",
            Language.MARATHI: "Marathi (मराठी)",
            Language.GUJARATI: "Gujarati (ગુજરાતી)",
            Language.BENGALI: "Bengali (বাংলা)",
            Language.PUNJABI: "Punjabi (ਪੰਜਾਬੀ)",
            Language.URDU: "Urdu (اردو)"
        }
        
        return self.SYSTEM_PROMPT_TEMPLATE.format(
            age=age,
            gender=gender,
            ckd_stage=ckd_stage,
            egfr=egfr,
            potassium=potassium,
            phosphorus=phosphorus,
            sodium=sodium,
            medications=medications,
            comorbidities=comorbidities,
            retrieved_guidelines=retrieved_text,
            language=language_name.get(self.language, "English")
        )
    
    def detect_tool_calls(self, user_message: str) -> List[Tuple[str, Dict]]:
        """Detect if user is asking for tool calls."""
        tool_calls = []
        
        keywords = {
            "calculate_egfr": ["eGFR", "kidney function", "creatinine level"],
            "calculate_bmi": ["BMI", "weight", "obesity"],
            "calculate_ckd_stage": ["CKD stage", "kidney stage"],
            "calculate_protein_intake": ["protein", "how much protein"],
            "assess_electrolytes": ["potassium", "phosphorus", "electrolytes", "minerals"],
            "check_drug_interaction": ["drug interaction", "medicine interaction"],
            "get_medication_info": ["medication", "drug", "medicine"]
        }
        
        text_lower = user_message.lower()
        
        for tool, keywords_list in keywords.items():
            if any(kw in text_lower for kw in keywords_list):
                # Extract values from message
                import re
                
                numbers = re.findall(r'\d+\.?\d*', user_message)
                
                if tool == "calculate_egfr" and len(numbers) >= 1:
                    tool_calls.append((tool, {
                        "creatinine": float(numbers[0]),
                        "age": self.patient_context.age if self.patient_context else 50,
                        "gender": self.patient_context.gender if self.patient_context else "male"
                    }))
                
                elif tool == "calculate_bmi" and len(numbers) >= 2:
                    tool_calls.append((tool, {
                        "weight_kg": float(numbers[0]),
                        "height_cm": float(numbers[1])
                    }))
                
                elif tool == "assess_electrolytes" and len(numbers) >= 1:
                    tool_calls.append((tool, {
                        "potassium": float(numbers[0]) if len(numbers) > 0 else 5.0,
                        "phosphorus": float(numbers[1]) if len(numbers) > 1 else 3.5,
                        "calcium": float(numbers[2]) if len(numbers) > 2 else 9.0
                    }))
        
        return tool_calls
    
    def chat(self, user_message: str) -> MedicalResponse:
        """
        Generate advanced medical response with tools and RAG.
        
        Args:
            user_message: User's question or input
            
        Returns:
            MedicalResponse: Structured medical response
        """
        try:
            # Parse coordinates before cleaning user_message
            has_coords = False
            lat_str, lng_str = "", ""
            lat_lng_match = re.search(r"latitude:\s*(-?\d+\.\d+),\s*longitude:\s*(-?\d+\.\d+)", user_message.lower())
            if lat_lng_match:
                has_coords = True
                lat_str = lat_lng_match.group(1)
                lng_str = lat_lng_match.group(2)

            # Clean user_message to prevent AI getting confused by coordinate arguments
            clean_user_message = re.sub(r"\s*\(latitude:\s*-?\d+\.\d+,\s*longitude:\s*-?\d+\.\d+\)", "", user_message)

            # Emergency check
            is_emergency, emergency_symptom = self.safety_layer.detect_emergency(clean_user_message)
            
            if is_emergency:
                emergency_msg = self.safety_layer.generate_emergency_response(
                    emergency_symptom, self.language
                )
                return MedicalResponse(
                    assessment=emergency_msg,
                    explanation="",
                    educational_information="",
                    kidney_specific_guidance="",
                    questions_for_nephrologist=[],
                    emergency_detected=True,
                    emergency_action=emergency_msg
                )
            
            # Detect and execute tool calls
            tool_calls = self.detect_tool_calls(clean_user_message)
            tool_results = []
            for tool_name, kwargs in tool_calls:
                result = self.call_tool(tool_name, **kwargs)
                tool_results.append(f"{tool_name}: {result}")
            
            # Add to history
            self.conversation_history.append({
                "role": "user",
                "content": clean_user_message
            })
            
            # Prepare message for Gemini — prepend hard language instruction to the user message
            system_prompt = self.create_system_prompt()
            language_name = {
                Language.ENGLISH: "English",
                Language.HINDI: "Hindi",
                Language.TAMIL: "Tamil",
                Language.TELUGU: "Telugu",
                Language.KANNADA: "Kannada",
                Language.MALAYALAM: "Malayalam",
                Language.MARATHI: "Marathi",
                Language.GUJARATI: "Gujarati",
                Language.BENGALI: "Bengali",
                Language.PUNJABI: "Punjabi",
                Language.URDU: "Urdu",
            }.get(self.language, "English")

            # Build messages with history
            messages = self.conversation_history.copy()

            # For non-English: inject a strong language reminder as the last user turn prefix
            if self.language != Language.ENGLISH:
                lang_prefix = f"[MANDATORY: Reply ONLY in {language_name}. Do NOT use English at all.]\n\n"
                if messages:
                    messages[-1] = {
                        "role": messages[-1]["role"],
                        "content": lang_prefix + messages[-1]["content"]
                    }
            
            # Add tool results if any
            if tool_results:
                tool_summary = "Tool Results:\n" + "\n".join(tool_results)
                messages.append({
                    "role": "user",
                    "content": tool_summary
                })
            
            # Call Gemini with system prompt
            from google.genai import types
            formatted_contents = []
            for msg in messages:
                role = "user" if msg["role"] == "user" else "model"
                formatted_contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=msg["content"])]
                    )
                )

            # Model fallback chain: try newer models first, fall back on 503/overload
            import time as _time
            MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
            response = None
            for model_name in MODELS_TO_TRY:
                for attempt in range(2):  # 2 attempts per model
                    try:
                        response = self.client.models.generate_content(
                            model=model_name,
                            contents=formatted_contents,
                            config=types.GenerateContentConfig(
                                system_instruction=system_prompt
                            )
                        )
                        break  # success
                    except Exception as _me:
                        err = str(_me).lower()
                        is_overload = any(x in err for x in ['503', 'unavailable', 'resource_exhausted', 'overloaded', 'high demand'])
                        if is_overload and attempt == 0:
                            _time.sleep(2 ** attempt)  # 2s backoff
                            continue
                        if is_overload:
                            break  # try next model
                        raise  # non-overload error — propagate immediately
                if response is not None:
                    break

            if response is None:
                raise RuntimeError("All Gemini models are currently overloaded. Please try again in a minute.")

            response_text = response.text

            
            # Inject location finder if relevant keywords or coordinates are present
            query_lower = clean_user_message.lower()
            if has_coords or any(kw in query_lower for kw in ["hospital", "clinic", "doctor", "nephrologist", "neurologist", "near me", "maps"]):
                if has_coords:
                    loc_suffix = f"near+{lat_str},{lng_str}"
                    loc_display = f"near coordinates ({lat_str}, {lng_str})"
                else:
                    loc_suffix = "near+me"
                    loc_display = "near you"

                finder_block = (
                    "\n\n---\n\n"
                    f"### Kidney & Neurology Care Finder ({loc_display})\n"
                    "To find specialist clinics and emergency hospitals near your location, please click on the following direct Google Maps shortcuts:\n"
                    f"[Find Kidney & Nephrology Hospitals Near Me (Google Maps)](https://www.google.com/maps/search/?api=1&query=kidney+care+hospitals+{loc_suffix})\n"
                    f"[Find Nephrologists / Kidney Specialists Near Me (Google Maps)](https://www.google.com/maps/search/?api=1&query=nephrologists+{loc_suffix})\n"
                    f"[Find Neurologists / Brain Specialists Near Me (Google Maps)](https://www.google.com/maps/search/?api=1&query=neurologists+{loc_suffix})\n\n"
                    "#### Recommended Nephrology & Kidney Care Centers (India)\n"
                    "1. Apollo Hospitals (Greams Road, Chennai)\n"
                    "   - Address: 21, Greams Lane, Off Greams Road, Chennai - 600006\n"
                    "   - Phone: +91 44 2829 0200\n"
                    "   - Google Maps: [View on Google Maps](https://www.google.com/maps/search/?api=1&query=Apollo+Hospitals+Greams+Road+Chennai)\n"
                    "2. Indraprastha Apollo Hospitals (New Delhi)\n"
                    "   - Address: Sarita Vihar, Delhi Mathura Road, New Delhi - 110076\n"
                    "   - Phone: +91 11 2692 5858\n"
                    "   - Google Maps: [View on Google Maps](https://www.google.com/maps/search/?api=1&query=Indraprastha+Apollo+Hospitals+New+Delhi)\n"
                    "3. Medanta - The Medicity (Gurugram)\n"
                    "   - Address: CH Baktawar Singh Road, Sector 38, Gurugram, Haryana - 122001\n"
                    "   - Phone: +91 124 414 1414\n"
                    "   - Google Maps: [View on Google Maps](https://www.google.com/maps/search/?api=1&query=Medanta+The+Medicity+Gurugram)\n\n"
                    "#### Recommended Kidney & Neurology Specialists\n"
                    "• Dr. Sandeep Guleria (Senior Consultant, Nephrology & Transplant)\n"
                    "  - Hospital: Indraprastha Apollo Hospitals, New Delhi\n"
                    "  - Phone: +91 11 2692 5858\n"
                    "• Dr. Vijay Kher (Chairman, Nephrology Division)\n"
                    "  - Hospital: Medanta - The Medicity, Gurugram\n"
                    "  - Phone: +91 124 414 1414\n\n"
                    "Please let me know your city or location (for example: Mumbai, Delhi, Bangalore) so I can suggest specific hospitals near you!"
                )
                response_text += finder_block
            
            # Parse response into structured format
            structured_response = self._parse_medical_response(response_text, tool_results)
            
            # Add to history
            self.conversation_history.append({
                "role": "assistant",
                "content": response_text
            })
            
            # Maintain history size
            if len(self.conversation_history) > self.max_history:
                self.conversation_history = self.conversation_history[-self.max_history:]
            
            return structured_response
        
        except Exception as e:
            # Re-raise so the API layer can handle 503 overloads and other errors properly
            raise e
    
    def _parse_medical_response(self, response_text: str, 
                                tool_results: List[str]) -> MedicalResponse:
        """Parse Gemini response into structured medical response."""
        return MedicalResponse(
            assessment=response_text.strip(),
            explanation="",
            educational_information="",
            kidney_specific_guidance="",
            questions_for_nephrologist=[],
            references=[]
        )
    
    def get_conversation_summary(self) -> str:
        """Generate summary of conversation for patient."""
        if not self.conversation_history:
            return "No conversation history."
        
        summary = "Conversation Summary:\n\n"
        for i, msg in enumerate(self.conversation_history):
            role = "You asked" if msg["role"] == "user" else "Assistant responded"
            summary += f"{i+1}. {role}:\n{msg['content'][:200]}...\n\n"
        
        return summary



# DATABASE MODELS (SQLAlchemy)

class AdvancedChatbotConversation:
    """
    Database model for advanced chatbot conversations.
    Save this in: backend/models/advanced_chatbot_model.py
    """
    
    @staticmethod
    def create_model(db):
        """Create SQLAlchemy model."""
        class ChatbotConversation(db.Model):
            __tablename__ = 'advanced_chatbot_conversations'
            
            id = db.Column(db.Integer, primary_key=True)
            user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
            role = db.Column(db.String(20))  # 'user' or 'assistant'
            content = db.Column(db.Text)
            language = db.Column(db.String(10), default='en')
            tool_calls = db.Column(db.JSON)  # Store tool calls made
            lab_analysis = db.Column(db.JSON)  # Lab report analysis results
            created_at = db.Column(db.DateTime, default=datetime.utcnow)
            updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
            
            def to_dict(self):
                return {
                    'id': self.id,
                    'user_id': self.user_id,
                    'role': self.role,
                    'content': self.content,
                    'language': self.language,
                    'tool_calls': self.tool_calls,
                    'lab_analysis': self.lab_analysis,
                    'created_at': self.created_at.isoformat(),
                    'updated_at': self.updated_at.isoformat()
                }
        
        return ChatbotConversation


class PatientHealthProfile:
    """
    Database model for patient health profile.
    Save this in: backend/models/patient_health_model.py
    """
    
    @staticmethod
    def create_model(db):
        """Create SQLAlchemy model."""
        class PatientHealthProfile(db.Model):
            __tablename__ = 'patient_health_profiles'
            
            id = db.Column(db.Integer, primary_key=True)
            user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True)
            age = db.Column(db.Integer)
            gender = db.Column(db.String(20))
            weight_kg = db.Column(db.Float)
            height_cm = db.Column(db.Float)
            ckd_stage = db.Column(db.Integer)
            current_egfr = db.Column(db.Float)
            current_creatinine = db.Column(db.Float)
            current_potassium = db.Column(db.Float)
            current_phosphorus = db.Column(db.Float)
            current_sodium = db.Column(db.Float)
            medications = db.Column(db.JSON)  # List of medications
            comorbidities = db.Column(db.JSON)  # List of comorbidities
            lab_history = db.Column(db.JSON)  # Historical lab values
            dietary_restrictions = db.Column(db.JSON)  # Dietary restrictions
            created_at = db.Column(db.DateTime, default=datetime.utcnow)
            updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
            
            def to_patient_context(self) -> PatientContext:
                """Convert to PatientContext object."""
                return PatientContext(
                    user_id=str(self.user_id),
                    age=self.age,
                    gender=self.gender,
                    weight_kg=self.weight_kg,
                    height_cm=self.height_cm,
                    ckd_stage=self.ckd_stage,
                    current_egfr=self.current_egfr,
                    current_creatinine=self.current_creatinine,
                    current_potassium=self.current_potassium,
                    current_phosphorus=self.current_phosphorus,
                    current_sodium=self.current_sodium,
                    medications=self.medications or [],
                    comorbidities=self.comorbidities or [],
                    lab_history=self.lab_history or [],
                    dietary_restrictions=self.dietary_restrictions or []
                )
        
        return PatientHealthProfile

# FLASK API ROUTES


def create_advanced_chatbot_routes(app, db):
    """
    Create Flask routes for advanced chatbot.
    Save this in: backend/routes/advanced_chatbot_routes.py
    """
    from flask import request, jsonify
    
    ChatbotConversation = AdvancedChatbotConversation.create_model(db)
    PatientProfile = PatientHealthProfile.create_model(db)
    
    @app.route('/api/v2/chatbot/chat', methods=['POST'])
    def advanced_chat():
        """Advanced chat endpoint with patient context."""
        try:
            data = request.json
            user_id = data.get("user_id")
            message = data.get("message")
            language_code = data.get("language", "en")
            
            if not message or not user_id:
                return jsonify({"error": "user_id and message required"}), 400
            
            # Get patient profile
            patient_profile = PatientProfile.query.filter_by(user_id=user_id).first()
            
            # Initialize chatbot
            language = Language(language_code)
            chatbot = AdvancedAINephrologistChatbot(language=language)
            
            # Set patient context
            if patient_profile:
                chatbot.set_patient_context(patient_profile.to_patient_context())
            
            # Get conversation history
            history = ChatbotConversation.query.filter_by(
                user_id=user_id
            ).order_by(ChatbotConversation.created_at).all()
            
            for conv in history[-50:]:  # Last 50 messages
                chatbot.conversation_history.append({
                    "role": conv.role,
                    "content": conv.content
                })
            
            # Generate response
            response = chatbot.chat(message)
            
            # Save to database
            user_msg = ChatbotConversation(
                user_id=user_id,
                role="user",
                content=message,
                language=language_code
            )
            
            assistant_msg = ChatbotConversation(
                user_id=user_id,
                role="assistant",
                content=response.assessment,  # Save main assessment
                language=language_code,
                lab_analysis={
                    "explanation": response.explanation,
                    "educational_info": response.educational_information,
                    "guidance": response.kidney_specific_guidance
                }
            )
            
            db.session.add(user_msg)
            db.session.add(assistant_msg)
            db.session.commit()
            
            return jsonify({
                "assessment": response.assessment,
                "explanation": response.explanation,
                "educational_information": response.educational_information,
                "kidney_specific_guidance": response.kidney_specific_guidance,
                "questions_for_nephrologist": response.questions_for_nephrologist,
                "references": response.references,
                "emergency_detected": response.emergency_detected,
                "confidence_score": response.confidence_score,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/v2/chatbot/analyze-labs', methods=['POST'])
    def analyze_labs():
        """Analyze lab report (PDF)."""
        try:
            user_id = request.form.get("user_id")
            language_code = request.form.get("language", "en")
            
            if 'file' not in request.files:
                return jsonify({"error": "No file provided"}), 400
            
            file = request.files['file']
            file_path = f"/tmp/{user_id}_{file.filename}"
            file.save(file_path)
            
            # Initialize chatbot
            language = Language(language_code)
            chatbot = AdvancedAINephrologistChatbot(language=language)
            
            # Get patient profile
            PatientProfile = PatientHealthProfile.create_model(db)
            patient_profile = PatientProfile.query.filter_by(user_id=user_id).first()
            
            if patient_profile:
                chatbot.set_patient_context(patient_profile.to_patient_context())
            
            # Analyze
            analysis = chatbot.analyze_lab_report(file_path)
            
            # Update patient profile if extraction successful
            if "extracted_values" in analysis and patient_profile:
                for key, value in analysis["extracted_values"].items():
                    if hasattr(patient_profile, key):
                        setattr(patient_profile, key, value)
                db.session.commit()
            
            return jsonify(analysis)
        
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/v2/chatbot/update-profile', methods=['POST'])
    def update_profile():
        """Update patient health profile."""
        try:
            data = request.json
            user_id = data.get("user_id")
            
            PatientProfile = PatientHealthProfile.create_model(db)
            profile = PatientProfile.query.filter_by(user_id=user_id).first()
            
            if not profile:
                profile = PatientProfile(user_id=user_id)
            
            # Update fields
            for field, value in data.items():
                if field != "user_id" and hasattr(profile, field):
                    setattr(profile, field, value)
            
            db.session.add(profile)
            db.session.commit()
            
            return jsonify({
                "status": "success",
                "message": "Profile updated",
                "user_id": user_id
            })
        
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/v2/chatbot/history', methods=['GET'])
    def get_conversation_history():
        """Get chat history."""
        try:
            user_id = request.args.get("user_id")
            limit = int(request.args.get("limit", 50))
            
            history = ChatbotConversation.query.filter_by(
                user_id=user_id
            ).order_by(ChatbotConversation.created_at.desc()).limit(limit).all()
            
            return jsonify({
                "history": [h.to_dict() for h in reversed(history)]
            })
        
        except Exception as e:
            return jsonify({"error": str(e)}), 500



# MAIN EXECUTION


def main():
    """Demo of advanced chatbot."""
    print("\n" + "="*70)
    print(" NephroCare - Advanced AI Nephrology Assistant")
    print("="*70)
    print("Features: RAG, Patient Context, Lab Analysis, Tool Calling")
    print("Type 'quit' to exit, 'lang' to change language")
    print("="*70 + "\n")
    
    # Create sample patient context
    sample_patient = PatientContext(
        user_id="demo_001",
        age=58,
        gender="male",
        weight_kg=75,
        height_cm=175,
        ckd_stage=3,
        current_egfr=42.5,
        current_creatinine=1.8,
        current_potassium=5.2,
        current_phosphorus=4.1,
        current_sodium=138,
        medications=["Lisinopril 10mg", "Atorvastatin 20mg"],
        comorbidities=["Type 2 Diabetes", "Hypertension"],
        dietary_restrictions=["Low sodium", "Moderate potassium"]
    )
    
    # Initialize chatbot
    chatbot = AdvancedAINephrologistChatbot(language=Language.ENGLISH)
    chatbot.set_patient_context(sample_patient)
    
    print(f"Patient: 58M with CKD Stage 3 (eGFR: 42.5)")
    print(f"Medications: {', '.join(sample_patient.medications)}\n")
    
    while True:
        user_input = input("You: ").strip()
        
        if user_input.lower() == "quit":
            print("\n👋 Goodbye! Take care!")
            break
        
        elif user_input.lower() == "lang":
            print("\nAvailable languages:")
            for lang in Language:
                print(f"  {lang.value}: {lang.name}")
            lang_code = input("Enter language code: ").strip()
            try:
                chatbot.language = Language(lang_code)
                print(f" Language changed")
            except ValueError:
                print(" Invalid code")
            continue
        
        elif not user_input:
            continue
        
        print("\n Analyzing...\n")
        
        try:
            response = chatbot.chat(user_input)
            
            print("=" * 70)
            print(" ASSESSMENT:")
            print(response.assessment)
            print("\n EXPLANATION:")
            print(response.explanation)
            print("\n EDUCATIONAL INFORMATION:")
            print(response.educational_information)
            print("\n KIDNEY-SPECIFIC GUIDANCE:")
            print(response.kidney_specific_guidance)
            
            if response.questions_for_nephrologist:
                print("\n QUESTIONS FOR YOUR NEPHROLOGIST:")
                for i, q in enumerate(response.questions_for_nephrologist, 1):
                    print(f"  {i}. {q}")
            
            if response.emergency_detected:
                print("\n🚨 EMERGENCY DETECTED!")
                print(response.emergency_action)
            
            print(f"\n Confidence: {response.confidence_score:.0%}")
            print("=" * 70 + "\n")
        
        except Exception as e:
            print(f"❌ Error: {e}\n")


if __name__ == "__main__":
    main()
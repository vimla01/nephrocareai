"""
Kidney-safe medication database for CKD patients.
Provides comprehensive medication information, safety profiles, and interactions.
"""
from typing import Dict, List, Optional
import json
from functools import lru_cache


class MedicationDatabase:
    """Comprehensive kidney medication database."""
    
    # ACE Inhibitors
    ACE_INHIBITORS = {
        "lisinopril": {
            "generic": "lisinopril",
            "class": "ACE Inhibitor",
            "kidney_safety": "safe",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: True, 5: False},
            "requires_dose_adjustment": True,
            "dose_adjustment": "eGFR-based; reduce dose if eGFR < 30",
            "contraindications": ["pregnancy", "ACE inhibitor allergy", "history of angioedema"],
            "interactions": ["potassium supplements", "NSAIDs", "ARBs", "diuretics"],
            "monitoring": ["potassium", "creatinine", "blood_pressure"],
            "common_effects": ["cough", "dizziness", "hyperkalemia"],
            "benefit": "Slows CKD progression, protects kidney"
        },
        "enalapril": {
            "generic": "enalapril",
            "class": "ACE Inhibitor",
            "kidney_safety": "safe",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: True, 5: False},
            "requires_dose_adjustment": True,
            "contraindications": ["pregnancy", "ACE inhibitor allergy"],
            "interactions": ["potassium supplements", "NSAIDs"],
            "monitoring": ["potassium", "creatinine"],
            "common_effects": ["cough", "dizziness"],
            "benefit": "Kidney protective, reduces proteinuria"
        },
        "ramipril": {
            "generic": "ramipril",
            "class": "ACE Inhibitor",
            "kidney_safety": "safe",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: True, 5: False},
            "requires_dose_adjustment": True,
            "contraindications": ["pregnancy"],
            "interactions": ["potassium supplements", "NSAIDs"],
            "monitoring": ["potassium", "creatinine"],
            "common_effects": ["cough", "hyperkalemia"],
            "benefit": "Cardio-renal protective"
        },
    }
    
    # ARBs (Angiotensin II Receptor Blockers)
    ARBS = {
        "losartan": {
            "generic": "losartan",
            "class": "ARB",
            "kidney_safety": "safe",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: True, 5: True},
            "requires_dose_adjustment": False,
            "contraindications": ["pregnancy", "ARB allergy"],
            "interactions": ["potassium supplements", "NSAIDs", "ACE inhibitors"],
            "monitoring": ["potassium", "creatinine"],
            "common_effects": ["dizziness", "hyperkalemia"],
            "benefit": "Kidney protective without cough"
        },
        "valsartan": {
            "generic": "valsartan",
            "class": "ARB",
            "kidney_safety": "safe",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: True, 5: True},
            "requires_dose_adjustment": False,
            "contraindications": ["pregnancy"],
            "interactions": ["potassium supplements", "NSAIDs"],
            "monitoring": ["potassium", "creatinine"],
            "common_effects": ["dizziness"],
            "benefit": "Reduces proteinuria"
        },
        "irbesartan": {
            "generic": "irbesartan",
            "class": "ARB",
            "kidney_safety": "safe",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: True, 5: True},
            "requires_dose_adjustment": False,
            "contraindications": ["pregnancy"],
            "interactions": ["potassium supplements"],
            "monitoring": ["potassium"],
            "common_effects": ["dizziness"],
            "benefit": "Effective for diabetic kidney disease"
        },
    }
    
    # Diuretics
    DIURETICS = {
        "furosemide": {
            "generic": "furosemide",
            "class": "Loop Diuretic",
            "kidney_safety": "caution",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: True, 5: True},
            "requires_dose_adjustment": True,
            "contraindications": ["allergy to sulfonamides"],
            "interactions": ["NSAIDs", "ACE inhibitors", "ototoxic drugs"],
            "monitoring": ["creatinine", "electrolytes", "hearing"],
            "common_effects": ["hypokalemia", "dehydration", "hyperuricemia"],
            "benefit": "Reduces fluid overload, manages HTN"
        },
        "chlorthalidone": {
            "generic": "chlorthalidone",
            "class": "Thiazide Diuretic",
            "kidney_safety": "caution",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: False, 5: False},
            "requires_dose_adjustment": True,
            "contraindications": ["eGFR < 30"],
            "interactions": ["NSAIDs", "lithium"],
            "monitoring": ["glucose", "lipids", "electrolytes"],
            "common_effects": ["hypokalemia", "hyperglycemia"],
            "benefit": "Effective BP control"
        },
    }
    
    # NSAIDs (Caution/Contraindicated)
    NSAIDS = {
        "ibuprofen": {
            "generic": "ibuprofen",
            "class": "NSAID",
            "kidney_safety": "contraindicated",
            "ckd_suitability": {1: False, 2: False, 3: False, 4: False, 5: False},
            "requires_dose_adjustment": True,
            "contraindications": ["CKD stage 3+"],
            "interactions": ["ACE inhibitors", "ARBs", "diuretics"],
            "monitoring": ["creatinine", "proteinuria"],
            "common_effects": ["acute kidney injury", "hyperkalemia"],
            "benefit": "None for CKD patients",
            "warning": "AVOID - Risk of acute kidney injury"
        },
        "naproxen": {
            "generic": "naproxen",
            "class": "NSAID",
            "kidney_safety": "contraindicated",
            "ckd_suitability": {1: False, 2: False, 3: False, 4: False, 5: False},
            "requires_dose_adjustment": True,
            "contraindications": ["CKD"],
            "interactions": ["ACE inhibitors", "ARBs"],
            "monitoring": ["kidney function"],
            "common_effects": ["acute kidney injury"],
            "benefit": "None",
            "warning": "AVOID - Accelerates CKD progression"
        },
    }
    
    # Antibiotics
    ANTIBIOTICS = {
        "amoxicillin": {
            "generic": "amoxicillin",
            "class": "Beta-lactam Antibiotic",
            "kidney_safety": "safe",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: True, 5: True},
            "requires_dose_adjustment": True,
            "dose_adjustment": "eGFR-based; reduce frequency if eGFR < 30",
            "contraindications": ["allergy to penicillin"],
            "interactions": [],
            "monitoring": ["kidney function"],
            "common_effects": ["diarrhea", "rash"],
            "benefit": "Common antibiotic, kidney-safe with adjustment"
        },
        "ciprofloxacin": {
            "generic": "ciprofloxacin",
            "class": "Fluoroquinolone",
            "kidney_safety": "caution",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: True, 5: False},
            "requires_dose_adjustment": True,
            "contraindications": ["tendon problems"],
            "interactions": ["NSAIDs"],
            "monitoring": ["kidney function"],
            "common_effects": ["nausea", "tendonitis"],
            "benefit": "Broad-spectrum coverage"
        },
        "metronidazole": {
            "generic": "metronidazole",
            "class": "Antimicrobial",
            "kidney_safety": "safe",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: True, 5: True},
            "requires_dose_adjustment": True,
            "contraindications": [],
            "interactions": ["alcohol"],
            "monitoring": [],
            "common_effects": ["metallic taste", "nausea"],
            "benefit": "Anaerobic coverage"
        },
    }
    
    # Diabetes Medications
    DIABETES_MEDS = {
        "metformin": {
            "generic": "metformin",
            "class": "Biguanide",
            "kidney_safety": "caution",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: False, 5: False},
            "requires_dose_adjustment": True,
            "dose_adjustment": "Contraindicated if eGFR < 30; reduce if eGFR 30-45",
            "contraindications": ["eGFR < 30", "acute illness"],
            "interactions": ["contrast dye", "NSAIDs"],
            "monitoring": ["kidney function", "blood glucose"],
            "common_effects": ["GI upset", "lactic acidosis risk"],
            "benefit": "First-line diabetes med, some renal protection"
        },
        "sitagliptin": {
            "generic": "sitagliptin",
            "class": "DPP-4 Inhibitor",
            "kidney_safety": "safe",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: True, 5: True},
            "requires_dose_adjustment": True,
            "dose_adjustment": "Reduce dose if eGFR < 45",
            "contraindications": [],
            "interactions": [],
            "monitoring": ["blood glucose"],
            "common_effects": ["rare"],
            "benefit": "CKD-friendly, minimal hypoglycemia"
        },
        "insulin": {
            "generic": "insulin",
            "class": "Hormone",
            "kidney_safety": "safe",
            "ckd_suitability": {1: True, 2: True, 3: True, 4: True, 5: True},
            "requires_dose_adjustment": True,
            "dose_adjustment": "Reduce dose in advanced CKD",
            "contraindications": [],
            "interactions": ["hypoglycemic drugs"],
            "monitoring": ["blood glucose", "kidney function"],
            "common_effects": ["hypoglycemia"],
            "benefit": "Essential for T1DM, safe in CKD"
        },
    }
    
    # Combine all databases
    DATABASE = {
        **ACE_INHIBITORS,
        **ARBS,
        **DIURETICS,
        **NSAIDS,
        **ANTIBIOTICS,
        **DIABETES_MEDS
    }
    
    @classmethod
    @lru_cache(maxsize=1000)
    def get_medication(cls, name: str) -> Optional[Dict]:
        """Get medication info by name (case-insensitive)."""
        name_lower = name.lower().strip()
        return cls.DATABASE.get(name_lower)
    
    @classmethod
    def search_medications(cls, query: str) -> List[Dict]:
        """Search medications by partial name."""
        query_lower = query.lower()
        results = []
        for med_name, med_info in cls.DATABASE.items():
            if query_lower in med_name:
                results.append({**med_info, "name": med_name})
        return results
    
    @classmethod
    def get_safe_medications_for_ckd_stage(cls, ckd_stage: int) -> List[str]:
        """Get medications safe for specific CKD stage."""
        safe = []
        for med_name, med_info in cls.DATABASE.items():
            if med_info.get("ckd_suitability", {}).get(ckd_stage, False):
                safe.append(med_name)
        return safe
    
    @classmethod
    def has_potential_interaction(cls, med1: str, med2: str) -> bool:
        """Check if two medications might interact."""
        med1_info = cls.get_medication(med1)
        med2_info = cls.get_medication(med2)
        
        if not med1_info or not med2_info:
            return False
        
        interactions1 = med1_info.get("interactions", [])
        interactions2 = med2_info.get("interactions", [])
        
        med2_lower = med2.lower()
        med1_lower = med1.lower()
        
        return (med2_lower in interactions1) or (med1_lower in interactions2)


class InteractionChecker:
    """Detects drug interactions and safety issues."""
    
    def __init__(self):
        self.med_db = MedicationDatabase()
    
    def check_drug_drug_interaction(self, drug1: str, drug2: str) -> Optional[Dict]:
        """Check for drug-drug interactions."""
        if self.med_db.has_potential_interaction(drug1, drug2):
            return {
                "type": "drug_drug",
                "drug1": drug1,
                "drug2": drug2,
                "severity": "high",
                "description": f"{drug1} and {drug2} may interact",
                "recommendation": "Discuss with healthcare provider about timing or alternatives"
            }
        return None
    
    def check_drug_nutrient_interaction(
        self, drug: str, nutrients: List[Dict]
    ) -> List[Dict]:
        """Check drug-nutrient interactions."""
        interactions = []
        drug_info = self.med_db.get_medication(drug)
        
        if not drug_info:
            return interactions
        
        # ACE inhibitor + high potassium
        if drug.lower() in self.med_db.ACE_INHIBITORS:
            for nut in nutrients:
                if nut.get("nutrient", "").lower() == "potassium":
                    if float(nut.get("value", 0)) > 2000:
                        interactions.append({
                            "type": "drug_nutrient",
                            "drug": drug,
                            "nutrient": "potassium",
                            "severity": "high",
                            "description": "ACE inhibitors increase potassium; high intake increases hyperkalemia risk",
                            "recommendation": "Reduce potassium intake; monitor levels regularly"
                        })
        
        # NSAIDs interactions (covered in kidney safety check)
        # Diuretics + sodium
        if drug.lower() in self.med_db.DIURETICS:
            for nut in nutrients:
                if nut.get("nutrient", "").lower() == "sodium":
                    interactions.append({
                        "type": "drug_nutrient",
                        "drug": drug,
                        "nutrient": "sodium",
                        "severity": "moderate",
                        "description": "Monitor sodium with diuretics",
                        "recommendation": "Maintain consistent sodium intake; monitor for dehydration"
                    })
        
        return interactions
    
    def check_ckd_contraindication(self, drug: str, ckd_stage: int) -> Optional[Dict]:
        """Check if drug is safe for patient's CKD stage."""
        drug_info = self.med_db.get_medication(drug)
        
        if not drug_info:
            return None
        
        suitable = drug_info.get("ckd_suitability", {}).get(ckd_stage, False)
        
        if not suitable:
            safety = drug_info.get("kidney_safety", "")
            return {
                "type": "drug_ckd",
                "drug": drug,
                "ckd_stage": ckd_stage,
                "severity": "critical" if safety == "contraindicated" else "high",
                "description": f"{drug} is {safety} for CKD Stage {ckd_stage}",
                "recommendation": f"Avoid or use with caution. Discuss alternatives with nephrologist.",
                "warning": drug_info.get("warning")
            }
        
        return None
    
    def check_duplicate_class(self, medications: List[Dict]) -> List[Dict]:
        """Check for duplicate drug classes."""
        duplicates = []
        classes_seen = {}
        
        for med in medications:
            med_info = self.med_db.get_medication(med.get("name", ""))
            if med_info:
                drug_class = med_info.get("class", "")
                if drug_class:
                    if drug_class in classes_seen:
                        duplicates.append({
                            "type": "duplication",
                            "drug1": classes_seen[drug_class],
                            "drug2": med.get("name"),
                            "class": drug_class,
                            "severity": "high",
                            "description": f"Two medications from same class: {drug_class}",
                            "recommendation": "Verify prescription is intentional; typically one agent per class"
                        })
                    classes_seen[drug_class] = med.get("name")
        
        return duplicates

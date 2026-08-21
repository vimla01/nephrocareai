"""Risk scorer for prescription analysis."""
from typing import Dict, List
from config import RISK_SCORE_THRESHOLDS, CKD_STAGES, NUTRIENT_LIMITS


class RiskScorer:
    """Calculate comprehensive risk scores for prescriptions."""
    
    def score(
        self,
        medications: List[Dict],
        nutrients: List[Dict],
        interactions: List[Dict],
        ckd_stage: int = 3,
        labs: Dict = None
    ) -> Dict:
        """
        Calculate risk score 0-100.
        
        Returns: {
            "score": float (0-100),
            "category": str,
            "factors": [{name, weight, points}, ...],
            "critical_count": int,
            "summary": str
        }
        """
        labs = labs or {}
        
        if not medications and not nutrients:
            return {
                "score": 0.0,
                "category": "low",
                "factors": [],
                "critical_count": 0,
                "summary": "No prescription items detected."
            }
            
        score = 50  # baseline
        factors = []
        critical_count = 0
        
        # Drug safety check
        for med in medications:
            safety_points = self._score_medication_safety(med.get("name", ""), ckd_stage)
            factors.append({"name": f"Medication: {med.get('name')}", "weight": 0.25, "points": safety_points})
            score += safety_points
        
        # Interaction severity
        for interaction in interactions:
            severity = interaction.get("severity", "low")
            if severity == "critical":
                critical_count += 1
                score += 30
            elif severity == "high":
                score += 20
            elif severity == "moderate":
                score += 10
        
        if interactions:
            factors.append({"name": f"Drug interactions", "weight": 0.30, "points": min(30, len(interactions) * 5)})
        
        # Nutrient conflicts
        nutrient_score = self._score_nutrients(nutrients, ckd_stage, labs)
        if nutrient_score:
            factors.append({"name": f"Nutrient limits", "weight": 0.20, "points": nutrient_score})
            score += nutrient_score
        
        # CKD stage consideration
        ckd_risk = self._score_ckd_stage(ckd_stage, medications)
        factors.append({"name": f"CKD stage {ckd_stage}", "weight": 0.15, "points": ckd_risk})
        score += ckd_risk
        
        # Lab abnormalities
        if labs:
            lab_score = self._score_labs(labs, medications)
            factors.append({"name": "Lab abnormalities", "weight": 0.10, "points": lab_score})
            score += lab_score
        
        # Cap score at 100
        score = min(100, max(0, score))
        
        # Determine category
        category = self._get_category(score)
        
        return {
            "score": round(score, 1),
            "category": category,
            "factors": factors,
            "critical_count": critical_count,
            "summary": self._generate_summary(score, critical_count, interactions)
        }
    
    def _score_medication_safety(self, med_name: str, ckd_stage: int) -> float:
        """Score medication safety for CKD stage."""
        from medication_database import MedicationDatabase
        
        med_info = MedicationDatabase.get_medication(med_name)
        if not med_info:
            return 5  # Unknown medication, mild concern
        
        safety = med_info.get("kidney_safety", "safe")
        suitable = med_info.get("ckd_suitability", {}).get(ckd_stage, False)
        
        if safety == "contraindicated":
            return 35
        elif safety == "caution" or not suitable:
            return 20
        else:
            return -5  # Protective
    
    def _score_nutrients(self, nutrients: List[Dict], ckd_stage: int, labs: Dict) -> float:
        """Score nutritional conflicts."""
        score = 0
        
        for nutrient in nutrients:
            nut_name = nutrient.get("nutrient", "").lower()
            limit = nutrient.get("value", 0)
            
            # High potassium with ACE inhibitors is critical
            if nut_name == "potassium" and limit > 2000:
                if labs.get("potassium", 0) > 5.0:  # hyperkalemia
                    score += 30
            
            # High sodium for CKD
            elif nut_name == "sodium" and limit > 2000:
                score += 15
            
            # High phosphorus
            elif nut_name == "phosphorus" and limit > 1000:
                if ckd_stage >= 4:
                    score += 20
        
        return score
    
    def _score_ckd_stage(self, stage: int, medications: List[Dict]) -> float:
        """Score CKD stage risk."""
        base_score = {1: 0, 2: 5, 3: 15, 4: 25, 5: 35}
        
        score = base_score.get(stage, 20)
        
        # Stage 5 with nephrotoxics is critical
        if stage == 5:
            from medication_database import MedicationDatabase
            for med in medications:
                med_info = MedicationDatabase.get_medication(med.get("name", ""))
                if med_info and med_info.get("kidney_safety") == "contraindicated":
                    score += 20
        
        return score
    
    def _score_labs(self, labs: Dict, medications: List[Dict]) -> float:
        """Score abnormal lab values."""
        score = 0
        
        # Hyperkalemia (>5.0 mEq/L)
        if labs.get("potassium", 0) > 5.0:
            score += 25
        
        # Low eGFR
        egfr = labs.get("egfr", 0)
        if egfr < 15:
            score += 20
        elif egfr < 30:
            score += 10
        
        # High creatinine
        if labs.get("creatinine", 0) > 4.0:
            score += 15
        
        # Hyperphosphatemia
        if labs.get("phosphorus", 0) > 4.5:
            score += 10
        
        return score
    
    def _get_category(self, score: float) -> str:
        """Get risk category."""
        for cat, (min_val, max_val) in RISK_SCORE_THRESHOLDS.items():
            if min_val <= score < max_val:
                return cat
        return "critical"
    
    def _generate_summary(self, score: float, critical_count: int, interactions: List[Dict]) -> str:
        """Generate human-readable risk summary."""
        if critical_count > 0:
            return f"⚠ Critical risk detected. {critical_count} critical alert(s) require immediate attention."
        
        if score >= 75:
            return "⚠ High risk. Multiple concerns detected. Discuss with nephrologist."
        elif score >= 50:
            return "Moderate risk. Monitor closely and follow recommendations."
        elif score >= 25:
            return "Low risk with some considerations. Monitor key parameters."
        else:
            return "✓ Low risk. Continue current management."

"""
Voice Prescription Analyzer - Main orchestrator for the feature.
Integrates speech-to-text, NLP parsing, interaction checking, risk scoring, and reporting.
"""
import uuid
from pathlib import Path
from typing import Dict, Optional, List
import logging
from datetime import datetime

from speech_to_text import SpeechRecognizer
from prescription_parser import PrescriptionParser
from medication_database import MedicationDatabase, InteractionChecker
from risk_scorer import RiskScorer
from report_generator import ReportGenerator
from voice_analysis.models import PrescriptionAnalysisResult, Medication, Nutrient, DrugInteraction

logger = logging.getLogger(__name__)


class VoicePrescriptionAnalyzer:
    """Complete voice prescription analysis pipeline."""
    
    def __init__(self):
        """Initialize all components."""
        self.speech_recognizer = SpeechRecognizer()
        self.parser = PrescriptionParser()
        self.med_db = MedicationDatabase()
        self.interaction_checker = InteractionChecker()
        self.risk_scorer = RiskScorer()
        self.report_gen = ReportGenerator()
    
    def analyze(
        self,
        audio_path: Path,
        patient_id: str,
        ckd_stage: int = 3,
        current_labs: Dict = None,
        allergies: List[str] = None
    ) -> PrescriptionAnalysisResult:
        """
        Complete analysis of voice prescription.
        
        Args:
            audio_path: Path to audio file (wav, mp3, m4a, aac, etc.)
            patient_id: Patient identifier
            ckd_stage: CKD stage 1-5 (default 3)
            current_labs: Lab values {potassium, creatinine, egfr, phosphorus, ...}
            allergies: List of patient allergies
            
        Returns:
            PrescriptionAnalysisResult with complete analysis
        """
        analysis_id = str(uuid.uuid4())
        start_time = datetime.utcnow()
        current_labs = current_labs or {}
        allergies = allergies or []
        
        try:
            # Step 1: Speech-to-text
            logger.info(f"[{analysis_id}] Starting transcription...")
            transcription = self.speech_recognizer.transcribe(Path(audio_path))
            
            if not transcription.get("success"):
                raise ValueError(f"Transcription failed: {transcription.get('error')}")
            
            transcript = transcription.get("transcript", "")
            logger.info(f"[{analysis_id}] Transcription complete: {len(transcript)} chars")
            
            # Step 2: NLP Extraction
            logger.info(f"[{analysis_id}] Extracting medications and nutrients...")
            parsed = self.parser.parse(transcript)
            
            medications = [Medication(**m) for m in parsed.get("medications", [])]
            nutrients = [Nutrient(**n) for n in parsed.get("nutrients", [])]
            
            logger.info(f"[{analysis_id}] Extracted {len(medications)} medications, {len(nutrients)} nutrients")
            
            # Step 3: Interaction Detection
            logger.info(f"[{analysis_id}] Checking for interactions...")
            interactions = self._detect_all_interactions(medications, nutrients, ckd_stage, allergies)
            
            logger.info(f"[{analysis_id}] Found {len(interactions)} interactions")
            
            # Step 4: Risk Scoring
            logger.info(f"[{analysis_id}] Calculating risk score...")
            risk_result = self.risk_scorer.score(
                medications=[m.__dict__ for m in medications],
                nutrients=[n.__dict__ for n in nutrients],
                interactions=[i.__dict__ for i in interactions],
                ckd_stage=ckd_stage,
                labs=current_labs
            )
            
            risk_score = risk_result["score"]
            risk_category = risk_result["category"]
            critical_count = risk_result["critical_count"]
            
            logger.info(f"[{analysis_id}] Risk score: {risk_score} ({risk_category})")
            
            # Step 5: Generate Recommendations
            logger.info(f"[{analysis_id}] Generating recommendations...")
            recommendations = self._generate_recommendations(
                medications, interactions, ckd_stage, current_labs
            )
            
            # Step 6: Generate Reports
            logger.info(f"[{analysis_id}] Generating reports...")
            patient_summary = self.report_gen.generate_patient_summary(
                medications=[m.__dict__ for m in medications],
                interactions=[i.__dict__ for i in interactions],
                recommendations=recommendations,
                risk_score=risk_score,
                risk_category=risk_category
            )
            
            doctor_summary = self.report_gen.generate_doctor_summary(
                transcript=transcript,
                medications=[m.__dict__ for m in medications],
                nutrients=[n.__dict__ for n in nutrients],
                interactions=[i.__dict__ for i in interactions],
                risk_score=risk_score,
                risk_category=risk_category,
                patient_ckd_stage=ckd_stage
            )
            
            # Step 7: Build Result
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            result = PrescriptionAnalysisResult(
                analysis_id=analysis_id,
                patient_id=patient_id,
                transcript=transcript,
                medications=[m.__dict__ for m in medications],
                nutrients=[n.__dict__ for n in nutrients],
                interactions=[i.__dict__ for i in interactions],
                risk_score=risk_score,
                risk_category=risk_category,
                critical_alerts=critical_count,
                patient_summary=patient_summary,
                doctor_summary=doctor_summary,
                recommendations=recommendations,
                timestamp=datetime.utcnow()
            )
            
            logger.info(f"[{analysis_id}] Analysis complete in {processing_time:.1f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"[{analysis_id}] Analysis failed: {str(e)}", exc_info=True)
            raise
    
    def _detect_all_interactions(
        self,
        medications: List[Medication],
        nutrients: List[Nutrient],
        ckd_stage: int,
        allergies: List[str]
    ) -> List[DrugInteraction]:
        """Detect all types of interactions."""
        interactions = []
        med_names = [m.name for m in medications]
        nutrient_data = [n.__dict__ for n in nutrients]
        
        # Drug-drug interactions
        for i, med1 in enumerate(med_names):
            for med2 in med_names[i+1:]:
                result = self.interaction_checker.check_drug_drug_interaction(med1, med2)
                if result:
                    interactions.append(DrugInteraction(**result))
        
        # Drug-nutrient interactions
        for med in med_names:
            results = self.interaction_checker.check_drug_nutrient_interaction(med, nutrient_data)
            for result in results:
                interactions.append(DrugInteraction(**result))
        
        # CKD contraindications
        for med in med_names:
            result = self.interaction_checker.check_ckd_contraindication(med, ckd_stage)
            if result:
                interactions.append(DrugInteraction(**result))
        
        # Drug duplication (same class)
        dup_results = self.interaction_checker.check_duplicate_class([{"name": m} for m in med_names])
        for result in dup_results:
            interactions.append(DrugInteraction(**result))
        
        # Allergy checks
        for med in med_names:
            for allergy in allergies:
                if allergy.lower() in med.lower():
                    interactions.append(DrugInteraction(
                        interaction_type="drug_allergy",
                        severity="critical",
                        description=f"Patient allergic to {allergy}; prescribed {med}",
                        recommendation="CONTRAINDICATED - Contact prescriber immediately"
                    ))
        
        return interactions
    
    def _generate_recommendations(
        self,
        medications: List[Medication],
        interactions: List[DrugInteraction],
        ckd_stage: int,
        labs: Dict
    ) -> List[str]:
        """Generate personalized recommendations."""
        recommendations = []
        
        # Critical alerts
        critical = [i for i in interactions if i.severity == "critical"]
        if critical:
            for interaction in critical:
                recommendations.append(f"⚠ URGENT: {interaction.recommendation}")
        
        # Monitoring recommendations
        if ckd_stage >= 4:
            recommendations.append("Monitor potassium and creatinine every 1-3 months")
        else:
            recommendations.append("Monitor kidney function every 3-6 months")
        
        # Medication-specific recommendations
        med_names = [m.name.lower() for m in medications]
        
        if any("ace inhibitor" in self._get_med_class(m) or "arb" in self._get_med_class(m) for m in med_names):
            recommendations.append("Monitor potassium levels closely with ACE inhibitors/ARBs")
        
        if any("diuretic" in self._get_med_class(m) for m in med_names):
            recommendations.append("Stay well-hydrated; monitor for dizziness or dehydration")
        
        if any("statin" in self._get_med_class(m) for m in med_names):
            recommendations.append("Continue current statin therapy - proven kidney protective")
        
        # Dietary recommendations
        if labs.get("potassium", 0) > 5.0:
            recommendations.append("Reduce potassium intake (avoid bananas, oranges, spinach, tomatoes)")
        
        if labs.get("phosphorus", 0) > 4.5 and ckd_stage >= 4:
            recommendations.append("Limit phosphorus-rich foods (dairy, nuts, processed meats)")
        
        # General CKD recommendations
        if ckd_stage >= 3:
            recommendations.append("Limit sodium to <2000 mg/day")
            recommendations.append("Maintain regular exercise and healthy weight")
        
        if ckd_stage >= 4:
            recommendations.append("Consider nephrology follow-up if not already established")
        
        return recommendations
    
    def _get_med_class(self, med_name: str) -> str:
        """Get medication class."""
        med_info = self.med_db.get_medication(med_name)
        return (med_info.get("class", "") if med_info else "unknown").lower()
    
    def generate_report(
        self,
        result: PrescriptionAnalysisResult,
        format: str = "patient"  # patient, doctor, json, csv
    ) -> str:
        """
        Generate report from analysis result.
        
        Args:
            result: PrescriptionAnalysisResult
            format: Report format (patient, doctor, json, csv)
            
        Returns:
            Report content as string
        """
        if format == "patient":
            return result.patient_summary
        elif format == "doctor":
            return result.doctor_summary
        elif format == "json":
            return self.report_gen.generate_json_report(
                analysis_id=result.analysis_id,
                medications=result.medications,
                nutrients=result.nutrients,
                interactions=result.interactions,
                risk_score=result.risk_score,
                risk_category=result.risk_category,
                recommendations=result.recommendations,
                timestamp=result.timestamp
            )
        elif format == "csv":
            return self.report_gen.generate_csv_report(
                medications=result.medications,
                interactions=result.interactions
            )
        else:
            raise ValueError(f"Unknown format: {format}")

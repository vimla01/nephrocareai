"""Report generator for voice prescription analysis."""
from typing import Dict, List
import json
from datetime import datetime


class ReportGenerator:
    """Generate patient and doctor summary reports."""
    
    def generate_patient_summary(
        self,
        medications: List[Dict],
        interactions: List[Dict],
        recommendations: List[str],
        risk_score: float,
        risk_category: str
    ) -> str:
        """Generate plain-language patient summary."""
        lines = []
        
        # Risk indicator
        risk_icons = {"low": "✓", "moderate": "⚠", "high": "⚠", "critical": "🚨"}
        icon = risk_icons.get(risk_category, "")
        
        lines.append(f"PRESCRIPTION ANALYSIS SUMMARY")
        lines.append(f"{icon} Overall Risk Level: {risk_category.upper()} (Score: {risk_score}/100)")
        lines.append("")
        
        # Medications
        if medications:
            lines.append("MEDICATIONS DETECTED:")
            for med in medications:
                name = med.get("name", "").title()
                dose = med.get("dose", "")
                freq = med.get("frequency", "")
                detail = f"{dose} {freq}".strip()
                lines.append(f"  • {name} - {detail}")
            lines.append("")
        
        # Interactions  
        if interactions:
            critical = [i for i in interactions if i.get("severity") == "critical"]
            high = [i for i in interactions if i.get("severity") == "high"]
            
            if critical:
                lines.append("⚠ CRITICAL CONCERNS:")
                for interaction in critical:
                    lines.append(f"  • {interaction.get('description')}")
                lines.append("")
            
            if high:
                lines.append("⚠ IMPORTANT CONSIDERATIONS:")
                for interaction in high:
                    lines.append(f"  • {interaction.get('description')}")
                lines.append("")
        
        # Recommendations
        if recommendations:
            lines.append("RECOMMENDATIONS:")
            for rec in recommendations:
                lines.append(f"  • {rec}")
            lines.append("")
        
        lines.append("Please discuss these findings with your healthcare provider.")
        
        return "\n".join(lines)
    
    def generate_doctor_summary(
        self,
        transcript: str,
        medications: List[Dict],
        nutrients: List[Dict],
        interactions: List[Dict],
        risk_score: float,
        risk_category: str,
        patient_ckd_stage: int
    ) -> str:
        """Generate structured clinician summary."""
        lines = []
        
        lines.append("=" * 70)
        lines.append("VOICE PRESCRIPTION ANALYSIS - CLINICIAN SUMMARY")
        lines.append("=" * 70)
        lines.append(f"Timestamp: {datetime.now().isoformat()}")
        lines.append("")
        
        # Risk Assessment
        lines.append("RISK ASSESSMENT")
        lines.append(f"  Overall Score: {risk_score}/100 ({risk_category.upper()})")
        lines.append("")
        
        # Medications
        if medications:
            lines.append("EXTRACTED MEDICATIONS:")
            for med in medications:
                lines.append(f"  Name: {med.get('name', 'N/A')}")
                lines.append(f"    Dose: {med.get('dose', 'Not specified')}")
                lines.append(f"    Frequency: {med.get('frequency', 'Not specified')}")
                lines.append(f"    Route: {med.get('route', 'oral')}")
                lines.append(f"    Duration: {med.get('duration', 'Not specified')}")
                lines.append(f"    Confidence: {med.get('confidence', 0.75):.0%}")
                lines.append("")
        
        # Nutrients
        if nutrients:
            lines.append("DIETARY GUIDANCE EXTRACTED:")
            for nutrient in nutrients:
                lines.append(f"  {nutrient.get('nutrient').title()}: {nutrient.get('limit', 'Not specified')}")
            lines.append("")
        
        # Interactions
        if interactions:
            lines.append("DETECTED INTERACTIONS/CONCERNS:")
            for interaction in interactions:
                severity = interaction.get("severity", "unknown").upper()
                interaction_type = interaction.get("interaction_type", "unknown").replace("_", " ").title()
                lines.append(f"  [{severity}] {interaction_type}")
                lines.append(f"    Description: {interaction.get('description', 'N/A')}")
                lines.append(f"    Recommendation: {interaction.get('recommendation', 'N/A')}")
                lines.append("")
        
        # Clinical Context
        lines.append("CLINICAL CONTEXT:")
        lines.append(f"  Patient CKD Stage: {patient_ckd_stage}")
        lines.append("")
        
        # Original Transcript
        lines.append("ORIGINAL TRANSCRIPT:")
        lines.append("-" * 70)
        lines.append(transcript)
        lines.append("")
        
        return "\n".join(lines)
    
    def generate_json_report(
        self,
        analysis_id: str,
        medications: List[Dict],
        nutrients: List[Dict],
        interactions: List[Dict],
        risk_score: float,
        risk_category: str,
        recommendations: List[str],
        timestamp: datetime = None
    ) -> str:
        """Generate JSON export of analysis."""
        report = {
            "analysis_id": analysis_id,
            "timestamp": (timestamp or datetime.utcnow()).isoformat(),
            "risk_assessment": {
                "score": risk_score,
                "category": risk_category
            },
            "medications": medications,
            "nutrients": nutrients,
            "interactions": interactions,
            "recommendations": recommendations
        }
        
        return json.dumps(report, indent=2)
    
    def generate_csv_report(
        self,
        medications: List[Dict],
        interactions: List[Dict]
    ) -> str:
        """Generate CSV export for spreadsheet import."""
        lines = []
        
        # Medications CSV
        lines.append("MEDICATIONS")
        lines.append("Name,Dose,Frequency,Duration,Route,Confidence")
        
        for med in medications:
            fields = [
                med.get("name", ""),
                med.get("dose", ""),
                med.get("frequency", ""),
                med.get("duration", ""),
                med.get("route", "oral"),
                str(med.get("confidence", 0.75))
            ]
            lines.append(",".join(f'"{f}"' for f in fields))
        
        lines.append("")
        lines.append("INTERACTIONS")
        lines.append("Type,Severity,Description,Recommendation")
        
        for interaction in interactions:
            fields = [
                interaction.get("interaction_type", ""),
                interaction.get("severity", ""),
                interaction.get("description", ""),
                interaction.get("recommendation", "")
            ]
            lines.append(",".join(f'"{f}"' for f in fields))
        
        return "\n".join(lines)

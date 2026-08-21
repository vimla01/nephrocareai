"""
Example usage and test cases for Voice Prescription Analysis feature.
Copy and modify for your use case.
"""

# ============================================================================
# EXAMPLE 1: Basic Usage - Analyze a Voice Recording
# ============================================================================

from pathlib import Path
from voice_analyzer import VoicePrescriptionAnalyzer

def example_basic_analysis():
    """Analyze a voice prescription recording."""
    
    # Initialize analyzer
    analyzer = VoicePrescriptionAnalyzer()
    
    # Analyze
    result = analyzer.analyze(
        audio_path=Path("patient_prescription.wav"),
        patient_id="patient_123",
        ckd_stage=3,  # Stage 3 CKD
        current_labs={
            "potassium": 5.2,      # mmol/L (normal ~3.5-5.0)
            "creatinine": 2.1,     # mg/dL (elevated, indicates CKD)
            "egfr": 35,            # ml/min/1.73m² (CKD stage 3)
            "phosphorus": 4.2      # mg/dL (high end of normal)
        },
        allergies=["penicillin", "NSAIDs"]
    )
    
    # Print results
    print(f"Analysis ID: {result.analysis_id}")
    print(f"Patient: {result.patient_id}")
    print(f"\n{'='*60}")
    print(f"RISK ASSESSMENT")
    print(f"{'='*60}")
    print(f"Risk Score: {result.risk_score}/100")
    print(f"Risk Category: {result.risk_category.upper()}")
    print(f"Critical Alerts: {result.critical_alerts}")
    
    print(f"\n{'='*60}")
    print(f"MEDICATIONS")
    print(f"{'='*60}")
    for med in result.medications:
        print(f"- {med['name']}: {med['dose']} {med['frequency']}")
    
    print(f"\n{'='*60}")
    print(f"INTERACTIONS")
    print(f"{'='*60}")
    for interaction in result.interactions:
        print(f"[{interaction['severity'].upper()}] {interaction['description']}")
        print(f"  → {interaction['recommendation']}\n")
    
    print(f"\n{'='*60}")
    print(f"RECOMMENDATIONS")
    print(f"{'='*60}")
    for i, rec in enumerate(result.recommendations, 1):
        print(f"{i}. {rec}")
    
    print(f"\n{'='*60}")
    print(f"PATIENT SUMMARY")
    print(f"{'='*60}")
    print(result.patient_summary)


# ============================================================================
# EXAMPLE 2: Generate Different Report Formats
# ============================================================================

def example_report_generation():
    """Generate reports in multiple formats."""
    
    analyzer = VoicePrescriptionAnalyzer()
    
    result = analyzer.analyze(
        audio_path=Path("prescription.wav"),
        patient_id="patient_456",
        ckd_stage=4
    )
    
    # Patient-friendly summary
    patient_report = analyzer.generate_report(result, format="patient")
    print("=== PATIENT REPORT ===")
    print(patient_report)
    
    # Doctor-friendly summary
    doctor_report = analyzer.generate_report(result, format="doctor")
    print("\n=== DOCTOR REPORT ===")
    print(doctor_report)
    
    # JSON export (for EHR integration)
    json_report = analyzer.generate_report(result, format="json")
    print("\n=== JSON EXPORT ===")
    print(json_report)
    
    # CSV export (for spreadsheet analysis)
    csv_report = analyzer.generate_report(result, format="csv")
    print("\n=== CSV EXPORT ===")
    print(csv_report)
    
    # Save to files
    Path("reports").mkdir(exist_ok=True)
    Path("reports/patient_summary.txt").write_text(patient_report)
    Path("reports/doctor_summary.txt").write_text(doctor_report)
    Path("reports/analysis.json").write_text(json_report)
    Path("reports/analysis.csv").write_text(csv_report)
    print("\nReports saved to reports/ directory")


# ============================================================================
# EXAMPLE 3: High-Risk Patient Analysis
# ============================================================================

def example_high_risk_patient():
    """Analyze prescription for high-risk patient (Advanced CKD + Labs)."""
    
    analyzer = VoicePrescriptionAnalyzer()
    
    # CKD Stage 4 with concerning labs
    result = analyzer.analyze(
        audio_path=Path("high_risk_patient.wav"),
        patient_id="patient_789",
        ckd_stage=4,  # Severely decreased kidney function
        current_labs={
            "potassium": 5.8,      # HIGH - hyperkalemia risk
            "creatinine": 4.2,     # HIGH - severe renal impairment
            "egfr": 18,            # LOW - Stage 4 CKD
            "phosphorus": 5.2      # HIGH - hyperphosphatemia
        },
        allergies=["ACE inhibitors", "NSAIDs"]
    )
    
    # Check for critical alerts
    if result.critical_alerts > 0:
        print(f"⚠️  CRITICAL: {result.critical_alerts} critical alert(s) detected!")
        print("\nCritical interactions:")
        critical = [i for i in result.interactions if i['severity'] == 'critical']
        for interaction in critical:
            print(f"  • {interaction['description']}")
            print(f"    ACTION: {interaction['recommendation']}\n")
    
    # Risk assessment
    print(f"\nRisk Score: {result.risk_score}/100 ({result.risk_category.upper()})")
    if result.risk_category == "critical":
        print("⚠️  IMMEDIATE CLINICAL REVIEW REQUIRED")
    
    # Doctor notification content
    print("\n" + "="*60)
    print("DOCTOR NOTIFICATION")
    print("="*60)
    print(result.doctor_summary)


# ============================================================================
# EXAMPLE 4: Database Persistence (SQLAlchemy)
# ============================================================================

from datetime import datetime
from sqlalchemy import create_engine, Column, String, Float, Text, DateTime, JSON, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

Base = declarative_base()

class VoicePrescriptionAnalysisDB(Base):
    """SQLAlchemy model for persisting results."""
    __tablename__ = "voice_prescription_analyses"
    
    id = Column(String(50), primary_key=True)
    patient_id = Column(String(50), nullable=False, index=True)
    transcript = Column(Text, nullable=False)
    risk_score = Column(Float)
    risk_category = Column(String(20))
    critical_alerts = Column(Integer, default=0)
    medications = Column(JSON)
    interactions = Column(JSON)
    recommendations = Column(JSON)
    patient_summary = Column(Text)
    doctor_summary = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


def example_database_persistence():
    """Save analysis results to database."""
    
    # Setup database
    engine = create_engine("sqlite:///voice_prescriptions.db")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Analyze
    analyzer = VoicePrescriptionAnalyzer()
    result = analyzer.analyze(
        audio_path=Path("prescription.wav"),
        patient_id="patient_db_001",
        ckd_stage=3
    )
    
    # Save to database
    db_record = VoicePrescriptionAnalysisDB(
        id=result.analysis_id,
        patient_id=result.patient_id,
        transcript=result.transcript,
        risk_score=result.risk_score,
        risk_category=result.risk_category,
        critical_alerts=result.critical_alerts,
        medications=result.medications,
        interactions=result.interactions,
        recommendations=result.recommendations,
        patient_summary=result.patient_summary,
        doctor_summary=result.doctor_summary,
        created_at=result.timestamp
    )
    
    session.add(db_record)
    session.commit()
    
    print(f"✓ Saved analysis {result.analysis_id} to database")
    
    # Retrieve later
    saved = session.query(VoicePrescriptionAnalysisDB).filter_by(
        patient_id="patient_db_001"
    ).first()
    
    print(f"✓ Retrieved from database: Risk {saved.risk_score}/100 ({saved.risk_category})")
    
    session.close()


# ============================================================================
# EXAMPLE 5: Integration with Web API (Flask)
# ============================================================================

from flask import Flask, request, jsonify
from pathlib import Path

app = Flask(__name__)

@app.route("/api/voice/analyze", methods=["POST"])
def api_analyze():
    """Web API endpoint for voice analysis."""
    
    try:
        # Validate request
        if "audio_file" not in request.files:
            return jsonify({"error": "Missing audio_file"}), 400
        
        file = request.files["audio_file"]
        patient_id = request.form.get("patient_id")
        ckd_stage = int(request.form.get("ckd_stage", 3))
        
        # Save uploaded file
        filepath = Path("uploads") / file.filename
        filepath.parent.mkdir(exist_ok=True)
        file.save(filepath)
        
        # Analyze
        analyzer = VoicePrescriptionAnalyzer()
        result = analyzer.analyze(
            audio_path=filepath,
            patient_id=patient_id,
            ckd_stage=ckd_stage
        )
        
        # Return results as JSON
        return jsonify({
            "success": True,
            "analysis_id": result.analysis_id,
            "transcript": result.transcript,
            "risk_score": result.risk_score,
            "risk_category": result.risk_category,
            "critical_alerts": result.critical_alerts,
            "medications": result.medications,
            "interactions": result.interactions,
            "recommendations": result.recommendations
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================================
# EXAMPLE 6: Batch Processing Multiple Patients
# ============================================================================

import json
from pathlib import Path

def example_batch_processing():
    """Process multiple patient recordings."""
    
    analyzer = VoicePrescriptionAnalyzer()
    
    # Load patient data
    patients = json.loads(Path("patients.json").read_text())
    
    results = []
    
    for patient in patients:
        print(f"Processing {patient['name']}...")
        
        try:
            result = analyzer.analyze(
                audio_path=Path(patient['audio_file']),
                patient_id=patient['id'],
                ckd_stage=patient['ckd_stage'],
                current_labs=patient.get('labs', {}),
                allergies=patient.get('allergies', [])
            )
            
            results.append({
                "patient_id": patient['id'],
                "name": patient['name'],
                "risk_score": result.risk_score,
                "risk_category": result.risk_category,
                "critical_alerts": result.critical_alerts,
                "status": "success"
            })
            
            print(f"  ✓ Risk: {result.risk_score}/100 ({result.risk_category})")
            
        except Exception as e:
            results.append({
                "patient_id": patient['id'],
                "name": patient['name'],
                "status": "failed",
                "error": str(e)
            })
            print(f"  ✗ Failed: {e}")
    
    # Save summary
    summary = Path("batch_results.json")
    summary.write_text(json.dumps(results, indent=2))
    
    # Print statistics
    successful = [r for r in results if r["status"] == "success"]
    print(f"\n{'='*40}")
    print(f"Processed: {len(successful)}/{len(results)} patients")
    
    critical = [r for r in successful if r["risk_category"] == "critical"]
    if critical:
        print(f"Critical cases: {len(critical)}")
        for c in critical:
            print(f"  • {c['name']} ({c['patient_id']})")


# ============================================================================
# UNIT TESTS
# ============================================================================

import unittest

class TestVoicePrescriptionAnalyzer(unittest.TestCase):
    """Test voice prescription analyzer."""
    
    def setUp(self):
        self.analyzer = VoicePrescriptionAnalyzer()
    
    def test_risk_score_range(self):
        """Risk score should be between 0-100."""
        result = self.analyzer.analyze(
            audio_path=Path("test_audio.wav"),
            patient_id="test",
            ckd_stage=3
        )
        self.assertGreaterEqual(result.risk_score, 0)
        self.assertLessEqual(result.risk_score, 100)
    
    def test_risk_category_valid(self):
        """Risk category should be valid."""
        result = self.analyzer.analyze(
            audio_path=Path("test_audio.wav"),
            patient_id="test",
            ckd_stage=3
        )
        valid_categories = ["low", "moderate", "high", "critical"]
        self.assertIn(result.risk_category, valid_categories)
    
    def test_result_structure(self):
        """Result should have all required fields."""
        result = self.analyzer.analyze(
            audio_path=Path("test_audio.wav"),
            patient_id="test",
            ckd_stage=3
        )
        
        required_fields = [
            "analysis_id", "patient_id", "transcript",
            "medications", "nutrients", "interactions",
            "risk_score", "risk_category",
            "recommendations", "patient_summary", "doctor_summary"
        ]
        
        for field in required_fields:
            self.assertTrue(hasattr(result, field))
    
    def test_medications_extracted(self):
        """Should extract medications from transcript."""
        # Assumes test_audio.wav contains clear medication names
        result = self.analyzer.analyze(
            audio_path=Path("test_audio.wav"),
            patient_id="test",
            ckd_stage=3
        )
        self.assertGreater(len(result.medications), 0)


# ============================================================================
# RUN EXAMPLES
# ============================================================================

if __name__ == "__main__":
    import sys
    
    examples = {
        "1": ("Basic Analysis", example_basic_analysis),
        "2": ("Report Generation", example_report_generation),
        "3": ("High-Risk Patient", example_high_risk_patient),
        "4": ("Database Persistence", example_database_persistence),
        "5": ("Web API", lambda: print("See code for Flask integration")),
        "6": ("Batch Processing", example_batch_processing),
    }
    
    if len(sys.argv) > 1 and sys.argv[1] in examples:
        name, func = examples[sys.argv[1]]
        print(f"Running: {name}")
        print("="*60)
        func()
    else:
        print("Usage: python examples.py <example_number>")
        print("\nAvailable examples:")
        for num, (name, _) in examples.items():
            print(f"  {num}. {name}")
        print("\nExample: python examples.py 1")

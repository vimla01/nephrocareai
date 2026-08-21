"""
Flask API endpoints for Voice Prescription Analysis feature.
Integrate into your existing Flask app.
"""
from flask import Blueprint, request, jsonify
from pathlib import Path
import uuid
import logging
from typing import Dict
from werkzeug.utils import secure_filename

from voice_analyzer import VoicePrescriptionAnalyzer
from config import ALLOWED_AUDIO_FORMATS, MAX_AUDIO_SIZE_MB

logger = logging.getLogger(__name__)

# Create blueprint for easy integration
voice_bp = Blueprint("voice_analysis", __name__, url_prefix="/api/voice")

# Initialize analyzer
analyzer = VoicePrescriptionAnalyzer()

# File upload configuration
UPLOAD_FOLDER = Path("./uploads/voice_prescriptions")
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)


@voice_bp.route("/analyze", methods=["POST"])
def analyze_prescription():
    """
    Analyze voice prescription.
    
    Request:
        multipart/form-data:
            - audio_file: audio file (wav, mp3, m4a, etc.)
            - patient_id: string
            - ckd_stage: int (1-5, optional, default 3)
            - potassium: float (mmol/L, optional)
            - creatinine: float (mg/dL, optional)
            - egfr: float (ml/min/1.73m², optional)
            - allergies: json array of strings (optional)
    
    Response:
        {
            "success": bool,
            "analysis_id": str,
            "transcript": str,
            "risk_score": float,
            "risk_category": str,
            "critical_alerts": int,
            "medications": [...],
            "nutrients": [...],
            "interactions": [...],
            "recommendations": [...],
            "patient_summary": str,
            "doctor_summary": str,
            "error": str (if failed)
        }
    """
    try:
        # Validate request
        if "audio_file" not in request.files:
            return jsonify({"success": False, "error": "Missing audio_file"}), 400
        
        patient_id = request.form.get("patient_id")
        if not patient_id:
            return jsonify({"success": False, "error": "Missing patient_id"}), 400
        
        # Get file
        file = request.files["audio_file"]
        if file.filename == "":
            return jsonify({"success": False, "error": "No file selected"}), 400
        
        # Validate format
        filename = secure_filename(file.filename)
        file_ext = Path(filename).suffix.lstrip(".").lower()
        
        if file_ext not in ALLOWED_AUDIO_FORMATS:
            return jsonify({
                "success": False,
                "error": f"Unsupported format: {file_ext}. Allowed: {', '.join(ALLOWED_AUDIO_FORMATS)}"
            }), 400
        
        # Check file size
        file.seek(0, 2)  # Seek to end
        file_size_mb = file.tell() / (1024 * 1024)
        file.seek(0)  # Reset to start
        
        if file_size_mb > MAX_AUDIO_SIZE_MB:
            return jsonify({
                "success": False,
                "error": f"File too large: {file_size_mb:.1f}MB (max {MAX_AUDIO_SIZE_MB}MB)"
            }), 400
        
        # Save file
        unique_id = str(uuid.uuid4())
        filepath = UPLOAD_FOLDER / f"{unique_id}_{filename}"
        file.save(filepath)
        
        # Extract parameters
        ckd_stage = int(request.form.get("ckd_stage", 3))
        allergies = request.form.getlist("allergies[]") or []
        
        # Build labs dict
        labs = {}
        if potassium := request.form.get("potassium"):
            labs["potassium"] = float(potassium)
        if creatinine := request.form.get("creatinine"):
            labs["creatinine"] = float(creatinine)
        if egfr := request.form.get("egfr"):
            labs["egfr"] = float(egfr)
        if phosphorus := request.form.get("phosphorus"):
            labs["phosphorus"] = float(phosphorus)
        
        # Analyze
        logger.info(f"Analyzing voice prescription for patient {patient_id}")
        result = analyzer.analyze(
            audio_path=filepath,
            patient_id=patient_id,
            ckd_stage=ckd_stage,
            current_labs=labs,
            allergies=allergies
        )
        
        # Return result
        return jsonify({
            "success": True,
            "analysis_id": result.analysis_id,
            "transcript": result.transcript,
            "risk_score": result.risk_score,
            "risk_category": result.risk_category,
            "critical_alerts": result.critical_alerts,
            "medications": result.medications,
            "nutrients": result.nutrients,
            "interactions": result.interactions,
            "recommendations": result.recommendations,
            "patient_summary": result.patient_summary,
            "doctor_summary": result.doctor_summary,
            "timestamp": result.timestamp.isoformat()
        }), 200
        
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": "Internal server error"}), 500


@voice_bp.route("/report/<analysis_id>", methods=["GET"])
def get_report(analysis_id: str):
    """
    Get report for analysis.
    
    Query params:
        - format: patient | doctor | json | csv (default: patient)
    
    Response:
        Report content (text/plain or application/json)
    """
    try:
        # In production, retrieve result from database
        # For now, this endpoint shows the pattern
        
        report_format = request.args.get("format", "patient")
        
        if report_format not in ["patient", "doctor", "json", "csv"]:
            return jsonify({"error": "Invalid format"}), 400
        
        # TODO: Retrieve from database
        # result = db.get_prescription_analysis(analysis_id)
        # report = analyzer.generate_report(result, report_format)
        
        return jsonify({
            "error": "Not yet persisted - implement database integration"
        }), 501
        
    except Exception as e:
        logger.error(f"Report generation error: {str(e)}")
        return jsonify({"error": "Failed to generate report"}), 500


@voice_bp.route("/history/<patient_id>", methods=["GET"])
def get_patient_history(patient_id: str):
    """
    Get prescription analysis history for patient.
    
    Query params:
        - limit: number of results (default 10)
        - offset: pagination offset (default 0)
    
    Response:
        {
            "analyses": [
                {
                    "analysis_id": str,
                    "timestamp": str,
                    "risk_score": float,
                    "risk_category": str,
                    "medication_count": int
                },
                ...
            ],
            "total": int
        }
    """
    try:
        limit = int(request.args.get("limit", 10))
        offset = int(request.args.get("offset", 0))
        
        # TODO: Retrieve from database
        # analyses = db.get_patient_prescriptions(patient_id, limit, offset)
        # total = db.count_patient_prescriptions(patient_id)
        
        return jsonify({
            "error": "Not yet persisted - implement database integration"
        }), 501
        
    except Exception as e:
        logger.error(f"History retrieval error: {str(e)}")
        return jsonify({"error": "Failed to retrieve history"}), 500


@voice_bp.route("/chat", methods=["POST"])
def chat_followup():
    """
    Ask follow-up questions about a prescription analysis.
    
    Request:
        {
            "analysis_id": str,
            "question": str
        }
    
    Response:
        {
            "success": bool,
            "answer": str,
            "confidence": float
        }
    """
    try:
        data = request.get_json()
        analysis_id = data.get("analysis_id")
        question = data.get("question")
        
        if not analysis_id or not question:
            return jsonify({"success": False, "error": "Missing required fields"}), 400
        
        # TODO: Implement conversation context management
        # This would maintain conversation history and provide contextual answers
        
        return jsonify({
            "success": False,
            "error": "Conversation feature not yet implemented"
        }), 501
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        return jsonify({"success": False, "error": "Chat failed"}), 500


@voice_bp.route("/export/<analysis_id>", methods=["GET"])
def export_report(analysis_id: str):
    """
    Export analysis as PDF, JSON, or CSV.
    
    Query params:
        - format: pdf | json | csv
    
    Response:
        File download or JSON
    """
    try:
        report_format = request.args.get("format", "json").lower()
        
        if report_format not in ["pdf", "json", "csv"]:
            return jsonify({"error": "Invalid format"}), 400
        
        # TODO: Implement export
        # For JSON/CSV, can use analyzer.generate_report()
        # For PDF, use reportlab or similar
        
        return jsonify({
            "error": "Export not yet implemented"
        }), 501
        
    except Exception as e:
        logger.error(f"Export error: {str(e)}")
        return jsonify({"error": "Export failed"}), 500


# Integration example:
# In your main Flask app:
#
# from flask import Flask
# from api.voice_bp import voice_bp
#
# app = Flask(__name__)
# app.register_blueprint(voice_bp)

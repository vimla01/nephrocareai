import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from PIL import Image

# Load environment variables
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

if API_KEY:
    client = genai.Client(api_key=API_KEY)


def validate_image_file(image_path: str) -> bool:
    """Validate image file exists and is in supported format."""
    path = Path(image_path)
    
    if not path.exists():
        print(f" Image file not found: {image_path}")
        return False
    
    if not path.is_file():
        print(f" Path is not a file: {image_path}")
        return False
    
    supported_formats = {'.jpg', '.jpeg', '.png'}
    if path.suffix.lower() not in supported_formats:
        print(f" Unsupported format. Supported: JPG, JPEG, PNG")
        return False
    
    try:
        img = Image.open(image_path)
        img.verify()
        return True
    except Exception as e:
        print(f" Invalid or corrupted image: {e}")
        return False


def create_verification_prompt() -> str:
    """Create prompt for initial image type verification."""
    return """STEP 1: IMAGE VERIFICATION

Before analysis, verify this is a kidney ultrasound image.

VERIFICATION CHECKLIST:
- Is this an ultrasound image?
- Are kidney structures visible?
- Is image quality sufficient for assessment?

If the image is NOT a kidney ultrasound OR quality is too poor:
Return ONLY:
IMAGE VERIFICATION: FAILED
This does not appear to be a kidney ultrasound image or quality is insufficient.

If image IS a kidney ultrasound with acceptable quality:
Return ONLY:
IMAGE VERIFICATION: PASSED
Continue to analysis in next step."""


def create_analysis_prompt() -> str:
    """Create prompt for educational ultrasound analysis."""
    return """STEP 2: KIDNEY ULTRASOUND EDUCATIONAL ANALYSIS

CRITICAL: This analysis is for EDUCATIONAL PURPOSES ONLY and NOT medical diagnosis.

ANALYSIS GUIDELINES:

1. IMAGE QUALITY ASSESSMENT:
Evaluate: clarity, completeness, artifacts, visibility of anatomy
Assign confidence level:
- High Confidence: Clear, complete image with visible structures
- Moderate Confidence: Acceptable quality with minor limitations
- Low Confidence: Blurry, incomplete, or poor resolution

2. EDUCATIONAL OBSERVATIONS:
Use CAUTIOUS language ONLY:
"Visual characteristics may be consistent with..."
"Possible appearance suggestive of..."
"Image shows areas that could represent..."

NEVER use definitive language:
"Stone detected"
"Cyst detected"
"Patient has..."
"Confirmed..."

3. LOOK FOR (Educational observations only):
- Increased echogenicity
- Possible cortical thinning appearance
- Possible size reduction appearance
- Possible size enlargement appearance
- Possible cystic lesion appearance
- Possible stone-like structure appearance
- Possible fluid collection appearance
- No obvious abnormalities

4. OBSERVATION SEVERITY:
Assess based on complexity and follow-up recommendation urgency
(Low / Moderate / High)

RESPONSE FORMAT (EXACT):

IMAGE QUALITY: [High Confidence / Moderate Confidence / Low Confidence]
[Briefly state why]

OBSERVATIONS:
[List 3-5 educational observations or "No obvious abnormalities identified"]

OBSERVATION SEVERITY: [Low / Moderate / High]

RECOMMENDATION: [Suggest appropriate next steps - emphasize professional consultation]

FINAL REMINDER: This is educational analysis only, not medical diagnosis."""


def verify_image_type(image: Image.Image) -> bool:
    """
    Verify that the image is actually a kidney ultrasound.
    
    Args:
        image: PIL Image object
        
    Returns:
        bool: True if image appears to be a kidney ultrasound
    """
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                image,
                create_verification_prompt()
            ]
        )
        
        response_text = response.text.upper()
        return "PASSED" in response_text
    
    except Exception:
        return False


def parse_gemini_response(response_text: str) -> dict:
    """Parse Gemini response into structured format with robust error handling."""
    result = {
        "image_quality": "Unable to assess",
        "observations": [],
        "severity": "Unknown",
        "recommendation": "Consult a qualified healthcare professional for proper evaluation."
    }
    
    if not response_text or not isinstance(response_text, str):
        return result
    
    lines = response_text.split('\n')
    current_section = None
    
    for line in lines:
        line_stripped = line.strip()
        
        if not line_stripped:
            continue
        
        line_lower = line_stripped.lower()
        
        # Detect sections
        if 'image quality' in line_lower:
            current_section = 'image_quality'
            if ':' in line_stripped:
                content = line_stripped.split(':', 1)[1].strip()
                if content:
                    result['image_quality'] = content
            continue
        
        elif 'observations' in line_lower and ':' in line_lower:
            current_section = 'observations'
            continue
        
        elif 'observation severity' in line_lower or 'severity' in line_lower:
            current_section = 'severity'
            if ':' in line_stripped:
                severity_text = line_stripped.split(':', 1)[1].strip()
                severity_text_lower = severity_text.lower()
                if "high" in severity_text_lower:
                    result["severity"] = "High"
                elif "moderate" in severity_text_lower:
                    result["severity"] = "Moderate"
                elif "low" in severity_text_lower:
                    result["severity"] = "Low"
                else:
                    result["severity"] = "Unknown"
            continue
        
        elif 'recommendation' in line_lower and ':' in line_lower:
            current_section = 'recommendation'
            after_colon = line_stripped.split(':', 1)[1].strip()
            if after_colon:
                result['recommendation'] = after_colon
            continue
        
        # Parse content by section
        if current_section == 'observations':
            # Handle bullet points
            if any(line_stripped.startswith(char) for char in ['*', '-', '•', '◦', '·']):
                observation = line_stripped.lstrip('*-•◦·').strip()
                if observation and observation not in result['observations']:
                    result['observations'].append(observation)
            # Handle numbered items
            elif line_stripped and line_stripped[0].isdigit():
                if len(line_stripped) > 2 and line_stripped[1] in '.).:-':
                    observation = line_stripped[2:].strip()
                    if observation and observation not in result['observations']:
                        result['observations'].append(observation)
        
        elif current_section == 'recommendation':
            # Append continuation
            if line_stripped and not any(keyword in line_lower for keyword in ['image', 'observation', 'severity']):
                if not result['recommendation'].endswith(line_stripped):
                    result['recommendation'] += " " + line_stripped
    
    # Ensure valid observations
    if not result['observations']:
        result['observations'] = ["Image analyzed by AI vision model. Professional radiological interpretation required."]
    
    # Remove duplicates and limit
    seen = set()
    unique = []
    for obs in result['observations']:
        if obs not in seen:
            seen.add(obs)
            unique.append(obs)
    result['observations'] = unique[:5]
    
    result['recommendation'] = result['recommendation'].strip()
    
    return result


def analyze_ultrasound(image_path: str) -> dict:
    """
    Analyze a kidney ultrasound image using Google Gemini Vision.
    
    Provides EDUCATIONAL OBSERVATIONS ONLY - NOT medical diagnosis.
    
    Args:
        image_path: Path to the ultrasound image file
        
    Returns:
        dict: Contains image_quality, observations, severity, recommendation
    """
    
    # Verify API configuration
    if not API_KEY:
        return {
            "image_quality": "Error: API not configured",
            "observations": ["Unable to analyze - API configuration missing."],
            "severity": "Unknown",
            "recommendation": "Configure GEMINI_API_KEY environment variable."
        }
    
    # Validate image file
    if not validate_image_file(image_path):
        return {
            "image_quality": "Error: Invalid image",
            "observations": ["Unable to analyze - invalid image file."],
            "severity": "Unknown",
            "recommendation": "Provide a valid JPG or PNG ultrasound image."
        }
    
    try:
        image = Image.open(image_path)
        
        # Verify image is actually a kidney ultrasound
        if not verify_image_type(image):
            return {
                "image_quality": "Low Confidence",
                "observations": [
                    "Image may not represent a kidney ultrasound.",
                    "Unable to perform meaningful educational assessment."
                ],
                "severity": "Unknown",
                "recommendation": "Upload a clearer kidney ultrasound image for analysis."
            }
        
        # Analyze the ultrasound
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                image,
                create_analysis_prompt()
            ]
        )
        
        return parse_gemini_response(response.text)
    
    except Exception as e:
        return {
            "image_quality": "Error: Analysis failed",
            "observations": ["Unable to complete analysis."],
            "severity": "Unknown",
            "recommendation": "Please try again or consult a healthcare professional."
        }


def display_analysis(result: dict) -> None:
    """Display analysis results in clean, professional format."""
    print("\n" + "=" * 72)
    print(" " * 16 + "KIDNEY ULTRASOUND EDUCATIONAL ANALYSIS")
    print("=" * 72)
    
    # Image Quality
    image_quality = result.get('image_quality', 'Unable to assess')
    print(f"\nImage Quality: {image_quality}")
    
    # Observations
    print("\nObservations:")
    observations = result.get('observations', [])
    for obs in observations:
        print(f"  • {obs}")
    
    # Severity with visual indicator
    severity = result.get('severity', 'Unknown')
    severity_map = {
        'Low': ' Low',
        'Moderate': ' Moderate',
        'High': ' High',
        'Unknown': ' Unknown'
    }
    severity_display = severity_map.get(severity, ' Unknown')
    print(f"\nObservation Severity: {severity_display}")
    
    # Recommendation
    print(f"\nRecommendation: {result.get('recommendation', 'Consult a healthcare professional.')}")
    
    # Disclaimer
    print("\n" + "=" * 72)
    print("DISCLAIMER: Educational Analysis Only")
    print("=" * 72)
    print("• This analysis is for EDUCATIONAL PURPOSES ONLY")
    print("• This is NOT a medical diagnosis")
    print("• This is NOT a professional radiological report")
    print("• Professional medical evaluation is ALWAYS required")
    print("• Consult a qualified nephrologist or radiologist for diagnosis")
    print("=" * 72 + "\n")


def main():
    
    from tkinter import Tk, filedialog

    root = Tk()
    root.withdraw()

    image_path = filedialog.askopenfilename(
        title="Select Kidney Ultrasound Image",
        filetypes=[
            ("Image Files", "*.png *.jpg *.jpeg")
        ]
    )

    if not image_path:
        print("No image selected.")
        return

    result = analyze_ultrasound(image_path)

    display_analysis(result)
    
if __name__ == "__main__":
    main()

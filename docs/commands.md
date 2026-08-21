# NephroCare Commands

## Start FastAPI Backend

Open terminal in project root:

```bash
cd nephrocare
```

Run API:

```bash
uvicorn main:app --reload
```

Expected output:

```text
INFO: Uvicorn running on http://127.0.0.1:8000
```

---

## Open API Documentation

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

API Root:

```text
http://127.0.0.1:8000
```

---

## Install Dependencies

```bash
pip install fastapi uvicorn pandas scikit-learn joblib pydantic
```

---

## Run Model Training Notebook

```bash
jupyter lab
```

Open:

```text
model_train_notebook.ipynb
```

---

## Git Commands

Check status:

```bash
git status
```

Add files:

```bash
git add .
```

Commit:

```bash
git commit -m "your message"
```

Push:

```bash
git push origin main
```

Pull latest:

```bash
git pull origin main
```

---

## Project Structure

```text
nephrocare/
│
├── data/
├── models/
│   ├── ckd_risk_prediction_model.joblib
│   ├── uci_scaler.joblib
│   ├── uci_feature_names.joblib
│   └── uci_encoders.joblib
│
├── results/
├── scripts/
├── tests/
├── main.py
├── requirements.txt
└── model_train_notebook.ipynb
```

---

## Test Prediction API

Use Swagger:

```text
http://127.0.0.1:8000/docs
```

Example request:

```json
{
  "age": 45,
  "blood_pressure": 80,
  "blood_glucose_random": 120,
  "blood_urea": 40,
  "serum_creatinine": 1.2,
  "sodium": 138,
  "potassium": 4.5,
  "hemoglobin": 14,
  "hypertension": 0,
  "diabetes_mellitus": 0
}
```

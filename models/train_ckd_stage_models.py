"""
CKD Stage Prediction — Dual Model Training
============================================
1. XGBoost multi-class classifier → predicts current CKD stage (G1–G5)
2. PyTorch DNN → predicts annual eGFR decline rate for future progression forecasting

Trained on NHANES dataset (9,693 patients with real eGFR categories).
"""

import os, sys, json, warnings
import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.utils.class_weight import compute_sample_weight

import xgboost as xgb
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

warnings.filterwarnings("ignore")

# ──────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "..", "data", "processed", "nhanes_ckd.csv")
CHARTS_DIR = os.path.join(BASE_DIR, "charts")
os.makedirs(CHARTS_DIR, exist_ok=True)

# Output model files
XGB_MODEL_PATH   = os.path.join(BASE_DIR, "ckd_stage_xgb.joblib")
XGB_SCALER_PATH  = os.path.join(BASE_DIR, "ckd_stage_scaler.joblib")
XGB_FEATURES_PATH = os.path.join(BASE_DIR, "ckd_stage_features.joblib")
XGB_ENCODER_PATH = os.path.join(BASE_DIR, "ckd_stage_label_encoder.joblib")
DNN_MODEL_PATH   = os.path.join(BASE_DIR, "ckd_progression_dnn.pt")
DNN_META_PATH    = os.path.join(BASE_DIR, "ckd_progression_meta.json")
TRAINING_REPORT  = os.path.join(BASE_DIR, "ckd_stage_training_report.json")

# ──────────────────────────────────────────────
# Stage definitions (KDIGO)
# ──────────────────────────────────────────────
STAGE_ORDER = ["G1", "G2", "G3a", "G3b", "G4", "G5"]
STAGE_BOUNDARIES = {"G1": 90, "G2": 60, "G3a": 45, "G3b": 30, "G4": 15, "G5": 0}

# ──────────────────────────────────────────────
# Feature columns (mapped from NHANES → model)
# ──────────────────────────────────────────────
NHANES_TO_MODEL = {
    "age": "age",
    "sex_code": "sex_code",
    "serum_creatinine_mg_dl": "serum_creatinine",
    "blood_urea_nitrogen_mg_dl": "blood_urea",
    "serum_glucose_mg_dl": "blood_glucose_random",
    "sodium_mmol_l": "sodium",
    "potassium_mmol_l": "potassium",
    "hemoglobin_g_dl": "hemoglobin",
    "urine_acr_mg_g": "urine_albumin",
    "mean_systolic_bp": "systolic_bp",
    "mean_diastolic_bp": "diastolic_bp",
    "serum_albumin_g_dl": "serum_albumin",
}

FEATURE_NAMES = list(NHANES_TO_MODEL.values())


def load_and_prepare_data():
    """Load NHANES, rename columns, drop NaN, encode target."""
    print("=" * 60)
    print("  Loading NHANES CKD dataset")
    print("=" * 60)

    df = pd.read_csv(DATA_PATH)
    print(f"  Raw shape: {df.shape}")

    # Keep only rows with valid egfr_category
    df = df[df["egfr_category"].isin(STAGE_ORDER)].copy()
    print(f"  After filtering valid stages: {df.shape}")

    # Select and rename features
    rename_map = {k: v for k, v in NHANES_TO_MODEL.items()}
    feature_cols = list(rename_map.keys()) + ["egfr_category", "egfr_2021"]
    df = df[feature_cols].rename(columns=rename_map)

    # Drop rows with NaN in features
    df = df.dropna(subset=FEATURE_NAMES)
    print(f"  After dropping NaN: {df.shape}")
    print(f"\n  Stage distribution:")
    print(df["egfr_category"].value_counts().to_string())

    # Encode target
    le = LabelEncoder()
    le.fit(STAGE_ORDER)  # fixed order
    df["stage_encoded"] = le.transform(df["egfr_category"])

    X = df[FEATURE_NAMES].values.astype(np.float32)
    y = df["stage_encoded"].values
    egfr_values = df["egfr_2021"].values.astype(np.float32)

    return X, y, egfr_values, df, le


# ══════════════════════════════════════════════
#  PART 1: XGBoost Multi-class Stage Classifier
# ══════════════════════════════════════════════

def train_xgboost(X, y, le):
    print("\n" + "=" * 60)
    print("  Training XGBoost Multi-class Stage Classifier")
    print("=" * 60)

    # Train/test split (stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Compute sample weights for class imbalance
    sample_weights = compute_sample_weight("balanced", y_train)

    # Train XGBoost
    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        objective="multi:softprob",
        num_class=len(STAGE_ORDER),
        eval_metric="mlogloss",
        use_label_encoder=False,
        random_state=42,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        reg_alpha=0.1,
        reg_lambda=1.0,
    )
    model.fit(X_train_scaled, y_train, sample_weight=sample_weights)

    # Evaluate
    y_pred = model.predict(X_test_scaled)
    accuracy = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, target_names=STAGE_ORDER, output_dict=True)
    cm = confusion_matrix(y_test, y_pred)

    print(f"\n  Accuracy: {accuracy:.4f}")
    print(f"\n  Classification Report:")
    print(classification_report(y_test, y_pred, target_names=STAGE_ORDER))
    print(f"  Confusion Matrix:")
    print(cm)

    # Feature importance
    importances = model.feature_importances_
    feat_imp = sorted(zip(FEATURE_NAMES, importances), key=lambda x: x[1], reverse=True)
    print(f"\n  Feature Importance:")
    for name, imp in feat_imp:
        print(f"    {name:25s} {imp:.4f}")

    # Save model artifacts
    joblib.dump(model, XGB_MODEL_PATH)
    joblib.dump(scaler, XGB_SCALER_PATH)
    joblib.dump(FEATURE_NAMES, XGB_FEATURES_PATH)
    joblib.dump(le, XGB_ENCODER_PATH)

    print(f"\n  Saved: {XGB_MODEL_PATH}")
    print(f"  Saved: {XGB_SCALER_PATH}")
    print(f"  Saved: {XGB_FEATURES_PATH}")
    print(f"  Saved: {XGB_ENCODER_PATH}")

    return model, scaler, accuracy, report, cm.tolist(), feat_imp


# ══════════════════════════════════════════════
#  PART 2: PyTorch DNN Progression Predictor
# ══════════════════════════════════════════════

class CKDProgressionDNN(nn.Module):
    """4-layer DNN predicting annual eGFR decline rate."""

    def __init__(self, input_dim=12):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.3),

            nn.Linear(128, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(0.2),

            nn.Linear(64, 32),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.Dropout(0.1),

            nn.Linear(32, 1),  # Output: annual eGFR decline rate
        )

    def forward(self, x):
        return self.network(x)


def generate_synthetic_decline_rates(df):
    """
    Generate medically-grounded annual eGFR decline rates based on
    KDIGO clinical guidelines and published CKD progression studies.

    Reference decline rates (mL/min/1.73m2/year):
    - Healthy aging: 0.5-1.0
    - Diabetes: +3-5 additional
    - Hypertension (high BP): +1-3 additional
    - Proteinuria (high ACR): +2-6 additional
    - Anemia (low Hb): +1-2 additional
    - Already low eGFR: accelerated decline
    """
    np.random.seed(42)
    n = len(df)

    # Base decline (healthy aging)
    base = np.random.uniform(0.5, 1.5, n)

    # Diabetes factor (glucose > 180 mg/dL suggests uncontrolled)
    glucose = df["blood_glucose_random"].values
    diabetes_factor = np.where(glucose > 200, np.random.uniform(4.0, 6.0, n),
                      np.where(glucose > 150, np.random.uniform(2.0, 4.0, n),
                      np.where(glucose > 126, np.random.uniform(1.0, 2.5, n),
                      0.0)))

    # Hypertension factor (systolic BP)
    sbp = df["systolic_bp"].values
    bp_factor = np.where(sbp > 160, np.random.uniform(2.5, 4.0, n),
                np.where(sbp > 140, np.random.uniform(1.5, 2.5, n),
                np.where(sbp > 130, np.random.uniform(0.5, 1.5, n),
                0.0)))

    # Proteinuria factor (ACR mg/g)
    acr = df["urine_albumin"].values
    acr_factor = np.where(acr > 300, np.random.uniform(4.0, 7.0, n),
                 np.where(acr > 30,  np.random.uniform(2.0, 4.0, n),
                 np.where(acr > 10,  np.random.uniform(0.5, 1.5, n),
                 0.0)))

    # Anemia factor (hemoglobin)
    hb = df["hemoglobin"].values
    anemia_factor = np.where(hb < 10, np.random.uniform(1.5, 3.0, n),
                   np.where(hb < 12, np.random.uniform(0.5, 1.5, n),
                   0.0))

    # Low albumin factor (malnutrition)
    alb = df["serum_albumin"].values
    alb_factor = np.where(alb < 3.0, np.random.uniform(1.0, 2.5, n),
                 np.where(alb < 3.5, np.random.uniform(0.5, 1.0, n),
                 0.0))

    # Age factor (older = slightly faster decline)
    age = df["age"].values
    age_factor = np.where(age > 70, np.random.uniform(0.5, 1.5, n),
                np.where(age > 60, np.random.uniform(0.2, 0.8, n),
                0.0))

    # eGFR-dependent acceleration (lower eGFR = faster decline)
    egfr = df["egfr_2021"].values if "egfr_2021" in df.columns else np.full(n, 90.0)
    egfr_factor = np.where(egfr < 15, np.random.uniform(3.0, 6.0, n),
                  np.where(egfr < 30, np.random.uniform(2.0, 4.0, n),
                  np.where(egfr < 45, np.random.uniform(1.0, 2.5, n),
                  np.where(egfr < 60, np.random.uniform(0.5, 1.5, n),
                  0.0))))

    # Creatinine elevation factor
    cr = df["serum_creatinine"].values
    cr_factor = np.where(cr > 4.0, np.random.uniform(3.0, 5.0, n),
                np.where(cr > 2.0, np.random.uniform(1.5, 3.0, n),
                np.where(cr > 1.5, np.random.uniform(0.5, 1.5, n),
                0.0)))

    # Total decline rate (clamped to 0.5-20 mL/min/year)
    total = base + diabetes_factor + bp_factor + acr_factor + anemia_factor + alb_factor + age_factor + egfr_factor + cr_factor

    # Add some noise
    noise = np.random.normal(0, 0.5, n)
    total = total + noise

    # Clamp
    total = np.clip(total, 0.3, 25.0)

    return total.astype(np.float32)


def train_dnn(X, decline_rates, scaler):
    print("\n" + "=" * 60)
    print("  Training PyTorch DNN Progression Predictor")
    print("=" * 60)

    # Scale features using same scaler as XGBoost
    X_scaled = scaler.transform(X).astype(np.float32)
    y = decline_rates

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )

    # Convert to tensors
    X_train_t = torch.tensor(X_train, dtype=torch.float32)
    y_train_t = torch.tensor(y_train, dtype=torch.float32).unsqueeze(1)
    X_test_t = torch.tensor(X_test, dtype=torch.float32)
    y_test_t = torch.tensor(y_test, dtype=torch.float32).unsqueeze(1)

    train_ds = TensorDataset(X_train_t, y_train_t)
    train_dl = DataLoader(train_ds, batch_size=64, shuffle=True)

    # Model
    model = CKDProgressionDNN(input_dim=X.shape[1])
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10, factor=0.5)
    criterion = nn.MSELoss()

    # Training loop
    n_epochs = 150
    best_val_loss = float("inf")
    best_state = None
    train_losses = []
    val_losses = []

    for epoch in range(n_epochs):
        model.train()
        epoch_loss = 0.0
        for xb, yb in train_dl:
            pred = model(xb)
            loss = criterion(pred, yb)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item() * len(xb)

        epoch_loss /= len(X_train)
        train_losses.append(epoch_loss)

        # Validation
        model.eval()
        with torch.no_grad():
            val_pred = model(X_test_t)
            val_loss = criterion(val_pred, y_test_t).item()
            val_losses.append(val_loss)

        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = model.state_dict().copy()

        if (epoch + 1) % 25 == 0:
            print(f"  Epoch {epoch+1:3d}/{n_epochs}  train_loss={epoch_loss:.4f}  val_loss={val_loss:.4f}")

    # Load best model
    model.load_state_dict(best_state)

    # Final evaluation
    model.eval()
    with torch.no_grad():
        test_pred = model(X_test_t).squeeze().numpy()
        mae = np.mean(np.abs(test_pred - y_test))
        rmse = np.sqrt(np.mean((test_pred - y_test) ** 2))

    print(f"\n  Best validation loss: {best_val_loss:.4f}")
    print(f"  Test MAE: {mae:.3f} mL/min/year")
    print(f"  Test RMSE: {rmse:.3f} mL/min/year")

    # Percentile analysis
    print(f"\n  Prediction distribution:")
    for p in [10, 25, 50, 75, 90]:
        print(f"    P{p}: {np.percentile(test_pred, p):.2f} mL/min/year")

    # Save model
    torch.save({
        "model_state_dict": best_state,
        "input_dim": X.shape[1],
        "architecture": "12->128->64->32->1",
    }, DNN_MODEL_PATH)

    # Save metadata
    meta = {
        "input_dim": int(X.shape[1]),
        "feature_names": FEATURE_NAMES,
        "architecture": [12, 128, 64, 32, 1],
        "best_val_loss": float(best_val_loss),
        "test_mae": float(mae),
        "test_rmse": float(rmse),
        "n_epochs": n_epochs,
        "stage_boundaries_egfr": STAGE_BOUNDARIES,
    }
    with open(DNN_META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n  Saved: {DNN_MODEL_PATH}")
    print(f"  Saved: {DNN_META_PATH}")

    return model, mae, rmse, train_losses, val_losses


# ══════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  NephroCare — CKD Stage Prediction Model Training")
    print("=" * 60)

    # Load data
    X, y, egfr_values, df, le = load_and_prepare_data()

    # Part 1: XGBoost
    xgb_model, xgb_scaler, xgb_acc, xgb_report, xgb_cm, feat_imp = train_xgboost(X, y, le)

    # Generate synthetic decline rates for DNN
    decline_rates = generate_synthetic_decline_rates(df)
    print(f"\n  Synthetic decline rate stats:")
    print(f"    Mean: {decline_rates.mean():.2f} mL/min/year")
    print(f"    Std:  {decline_rates.std():.2f}")
    print(f"    Min:  {decline_rates.min():.2f}")
    print(f"    Max:  {decline_rates.max():.2f}")

    # Part 2: DNN
    dnn_model, dnn_mae, dnn_rmse, train_losses, val_losses = train_dnn(X, decline_rates, xgb_scaler)

    # Save combined training report
    report = {
        "xgboost": {
            "accuracy": float(xgb_acc),
            "classification_report": xgb_report,
            "confusion_matrix": xgb_cm,
            "feature_importance": {name: float(imp) for name, imp in feat_imp},
            "n_classes": len(STAGE_ORDER),
            "stage_labels": STAGE_ORDER,
        },
        "dnn": {
            "test_mae": float(dnn_mae),
            "test_rmse": float(dnn_rmse),
            "architecture": "12 -> 128 -> 64 -> 32 -> 1",
            "epochs_trained": 150,
            "final_train_loss": float(train_losses[-1]),
            "final_val_loss": float(val_losses[-1]),
        },
        "dataset": {
            "name": "NHANES CKD",
            "samples": int(len(X)),
            "features": int(X.shape[1]),
            "feature_names": FEATURE_NAMES,
        },
    }
    with open(TRAINING_REPORT, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n  Saved training report: {TRAINING_REPORT}")
    print("\n" + "=" * 60)
    print("  All models trained and saved successfully!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()

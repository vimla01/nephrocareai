# NHANES processed data dictionary

| Column | Description |
|---|---|
| `participant_id` | Participant id. |
| `age` | Age. |
| `sex_code` | NHANES code: 1 male, 2 female. |
| `race_ethnicity_code` | NHANES RIDRETH3 code; use the official codebook. |
| `SDMVSTRA` | Sdmvstra. |
| `SDMVPSU` | Sdmvpsu. |
| `serum_creatinine_mg_dl` | Serum creatinine mg dl. |
| `serum_albumin_g_dl` | Serum albumin g dl. |
| `blood_urea_nitrogen_mg_dl` | Blood urea nitrogen mg dl. |
| `serum_glucose_mg_dl` | Serum glucose mg dl. |
| `potassium_mmol_l` | Potassium mmol l. |
| `sodium_mmol_l` | Sodium mmol l. |
| `urine_albumin_mg_l` | Urine albumin mg l. |
| `urine_creatinine_mg_dl` | Urine creatinine mg dl. |
| `urine_acr_mg_g` | Urine acr mg g. |
| `hemoglobin_g_dl` | Hemoglobin g dl. |
| `hematocrit_percent` | Hematocrit percent. |
| `red_blood_cell_10e6_ul` | Red blood cell 10e6 ul. |
| `white_blood_cell_10e3_ul` | White blood cell 10e3 ul. |
| `mean_systolic_bp` | Mean systolic bp. |
| `mean_diastolic_bp` | Mean diastolic bp. |
| `egfr_2021` | 2021 CKD-EPI creatinine eGFR, mL/min/1.73 m2. |
| `egfr_category` | KDIGO G category based on eGFR (G1, G2, G3a, G3b, G4, G5). |
| `albuminuria_category` | Urine ACR category: A1 <30, A2 30-299, A3 >=300 mg/g. |
| `ckd_screen_positive` | Single-visit screen: eGFR <60 or urine ACR >=30 mg/g. |
| `ckd_stage_screen` | no_ckd_screen or eGFR G category for a positive screen. |

Labels are for research screening and do not prove chronicity over three months.

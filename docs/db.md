# NephroCare - PostgreSQL Database Documentation

This document explains what data is stored in the database, how to run queries, and how to inspect and manage the database directly through your terminal.

---

## 1. Database Connection Info

By default, the application connects to the local PostgreSQL instance using:
* **Host**: `localhost`
* **Port**: `5432`
* **Database**: `tracker`
* **User**: `vimla`
* **Connection URL**: `postgresql://vimla@localhost:5432/tracker` (defined in your `.env` file)

---

## 2. Table Schemas & What is Stored

The database contains 7 tables prefixed with `nephrocare_` to keep them isolated.

### `nephrocare_users`
Stores user credential accounts.
* `id` (`VARCHAR(50)`, Primary Key): Hexadecimal unique user identifier.
* `name` (`VARCHAR(255)`): Profile display name of the user.
* `email` (`VARCHAR(255)`, Unique, Index): Registered email address.
* `password_hash` (`VARCHAR(255)`): SHA-256 password hash.
* `created_at` (`TIMESTAMP`): Time of registration.
* `oauth_provider` (`VARCHAR(50)`): OAuth authentication provider (e.g. `google` for Google Sign-In) or NULL for email/password.

### `nephrocare_sessions`
Stores login session tokens.
* `token` (`VARCHAR(255)`, Primary Key): Hexadecimal session token.
* `user_id` (`VARCHAR(50)`, Foreign Key): References `nephrocare_users.id`.
* `email` (`VARCHAR(255)`): Associated user email.
* `created_at` (`TIMESTAMP`): Time of login.

### `nephrocare_user_profiles`
Stores clinical metadata for each patient.
* `user_id` (`VARCHAR(50)`, Primary Key): References `nephrocare_users.id`.
* `phone` (`VARCHAR(50)`): Patient phone number.
* `dob` (`VARCHAR(50)`): Date of Birth.
* `gender` (`VARCHAR(50)`): Gender (`male`/`female`/etc.).
* `ckd_stage` (`VARCHAR(50)`): Current CKD stage (`G1` - `G5`).
* `nephrologist` (`VARCHAR(255)`): Primary care doctor name.
* `blood_type` (`VARCHAR(50)`): Patient blood type.
* `emergency_contact` (`VARCHAR(50)`): Emergency phone number.

### `nephrocare_predictions`
Stores CKD risk prediction calculator inputs and outputs.
* `id` (`SERIAL`, Primary Key): Entry identifier.
* `user_id` (`VARCHAR(50)`): References `nephrocare_users.id`.
* `timestamp` (`TIMESTAMP`): Time prediction was calculated.
* `data` (`JSONB`): Input metrics (potassium, creatinine, BP, etc.) and output risk score percentages.

### `nephrocare_ultrasound_scans`
Stores ultrasound machine learning scan history logs.
* `id` (`SERIAL`, Primary Key): Entry identifier.
* `user_id` (`VARCHAR(50)`): References `nephrocare_users.id`.
* `timestamp` (`TIMESTAMP`): Time of scan.
* `data` (`JSONB`): Quality classification, observations list, medical recommendation text, and base64 preview image.

### `nephrocare_symptom_logs`
Stores symptoms tracked in the patient dashboard.
* `id` (`SERIAL`, Primary Key): Entry identifier.
* `user_id` (`VARCHAR(50)`): References `nephrocare_users.id`.
* `timestamp` (`TIMESTAMP`): Time of log.
* `data` (`JSONB`): Severities for mapped symptoms (fatigue, metallic taste, nausea, shortness of breath, itchy skin, etc.).

### `nephrocare_food_checks`
Stores logged searches and results from the Food Safety analyzer.
* `id` (`SERIAL`, Primary Key): Entry identifier.
* `user_id` (`VARCHAR(50)`): References `nephrocare_users.id`.
* `timestamp` (`TIMESTAMP`): Time food was checked.
* `data` (`JSONB`): Analyzed food item name, category, safety status (`SAFE`/`MODERATE`/`AVOID`), and nutritional metrics.

---

## 3. How to Connect and Query in Terminal

Follow these terminal commands to view the database content.

### Step 1: Connect to the PostgreSQL database
Run the interactive terminal client (`psql`) pointing to the database:
```bash
psql -d tracker
```

### Step 2: List all tables
Once connected, list all the `nephrocare_` prefixed tables:
```sql
\dt nephrocare_*
```

### Step 3: Describe a table structure
To view the columns and data types of any table, use the describe shortcut:
```sql
\d nephrocare_users
```
```sql
\d nephrocare_user_profiles
```

### Step 4: Run example SQL queries

Here are some useful queries you can run in your terminal:

* **View registered users:**
  ```sql
  SELECT id, name, email, oauth_provider, created_at FROM nephrocare_users;
  ```

* **View active login sessions:**
  ```sql
  SELECT s.token, u.name, u.email, s.created_at 
  FROM nephrocare_sessions s 
  JOIN nephrocare_users u ON s.user_id = u.id;
  ```

* **View patients profile details:**
  ```sql
  SELECT user_id, ckd_stage, gender, phone, nephrologist FROM nephrocare_user_profiles;
  ```

* **View user predictions history (JSON query):**
  ```sql
  SELECT id, user_id, timestamp, 
         data->>'risk_percent' as risk, 
         data->>'egfr' as egfr, 
         data->>'stage' as stage 
  FROM nephrocare_predictions;
  ```

* **View user symptom logs:**
  ```sql
  SELECT id, user_id, timestamp, 
         data->>'fatigue' as fatigue, 
         data->>'swelling' as swelling, 
         data->>'nausea' as nausea 
  FROM nephrocare_symptom_logs;
  ```

* **View food safety checks log:**
  ```sql
  SELECT id, timestamp, 
         data->>'food_name' as food, 
         data->>'safety_status' as status 
  FROM nephrocare_food_checks;
  ```

### Step 5: Quit the terminal client
To exit the PostgreSQL terminal prompt, type:
```sql
\q
```

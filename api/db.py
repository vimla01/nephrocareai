import os
import json
import psycopg2
import psycopg2.extras
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

# Load env variables from .env file
load_dotenv()

# Register default JSONB adapter for automatic deserialization
psycopg2.extras.register_default_jsonb()

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://vimla@localhost:5432/tracker")

def get_conn():
    """Establish and return a new PostgreSQL connection. Creates the database if it doesn't exist."""
    try:
        return psycopg2.connect(DATABASE_URL)
    except psycopg2.OperationalError as e:
        err_str = str(e)
        if "does not exist" in err_str or "3D000" in err_str:
            try:
                # Attempt to extract target dbname and base connection string
                parts = DATABASE_URL.rsplit('/', 1)
                base_url = parts[0]
                target_db = parts[1].split('?')[0] # strip query parameters if any
                
                # Connect to maintenance database 'postgres' to run CREATE DATABASE
                maintenance_url = f"{base_url}/postgres"
                temp_conn = psycopg2.connect(maintenance_url)
                temp_conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
                with temp_conn.cursor() as cur:
                    cur.execute(f'CREATE DATABASE "{target_db}";')
                temp_conn.close()
                
                # Re-try connecting to the newly created database
                return psycopg2.connect(DATABASE_URL)
            except Exception as create_exc:
                print(f"Auto-database creation failed: {create_exc}")
        
        # Fallback to local default connection if URL fails
        if "localhost" in DATABASE_URL:
            try:
                return psycopg2.connect(dbname=DATABASE_URL.split("/")[-1])
            except Exception:
                pass
        raise e

def init_db() -> None:
    """Initialize database tables and run schema migrations."""
    queries = [
        """
        CREATE TABLE IF NOT EXISTS nephrocare_users (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            oauth_provider VARCHAR(50)
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS nephrocare_sessions (
            token VARCHAR(255) PRIMARY KEY,
            user_id VARCHAR(50) REFERENCES nephrocare_users(id) ON DELETE CASCADE,
            email VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS nephrocare_user_profiles (
            user_id VARCHAR(50) PRIMARY KEY REFERENCES nephrocare_users(id) ON DELETE CASCADE,
            phone VARCHAR(50),
            dob VARCHAR(50),
            gender VARCHAR(50),
            ckd_stage VARCHAR(50),
            nephrologist VARCHAR(255),
            blood_type VARCHAR(50),
            emergency_contact VARCHAR(50),
            preferences JSONB DEFAULT '{}',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS nephrocare_predictions (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(50) REFERENCES nephrocare_users(id) ON DELETE CASCADE,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data JSONB NOT NULL
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS nephrocare_ultrasound_scans (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(50) REFERENCES nephrocare_users(id) ON DELETE CASCADE,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data JSONB NOT NULL
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS nephrocare_symptom_logs (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(50) REFERENCES nephrocare_users(id) ON DELETE CASCADE,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data JSONB NOT NULL
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS nephrocare_food_checks (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(50) REFERENCES nephrocare_users(id) ON DELETE CASCADE,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data JSONB NOT NULL
        );
        """,
        """
        ALTER TABLE nephrocare_user_profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
        """
    ]
    
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            for q in queries:
                cur.execute(q)
        conn.commit()
        print("Database schema successfully initialized in PostgreSQL with prefix nephrocare_.")
    except Exception as e:
        conn.rollback()
        print(f"Error initializing PostgreSQL schema: {e}")
        raise e
    finally:
        conn.close()

# User details queries
def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, name, email, password_hash, created_at, oauth_provider FROM nephrocare_users WHERE LOWER(email) = LOWER(%s)", (email,))
            row = cur.fetchone()
            if row:
                row['created_at'] = row['created_at'].timestamp()
                return dict(row)
            return None
    finally:
        conn.close()

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, name, email, password_hash, created_at, oauth_provider FROM nephrocare_users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if row:
                row['created_at'] = row['created_at'].timestamp()
                return dict(row)
            return None
    finally:
        conn.close()

def create_user(user_id: str, name: str, email: str, password_hash: str, oauth_provider: Optional[str] = None) -> Dict[str, Any]:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO nephrocare_users (id, name, email, password_hash, oauth_provider)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, name, email, password_hash, created_at, oauth_provider
                """,
                (user_id, name, email.lower(), password_hash, oauth_provider)
            )
            row = cur.fetchone()
            conn.commit()
            row['created_at'] = row['created_at'].timestamp()
            return dict(row)
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def update_user_password(user_id: str, new_hash: str) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE nephrocare_users SET password_hash = %s WHERE id = %s", (new_hash, user_id))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        return False
    finally:
        conn.close()

# Session queries
def create_session(token: str, user_id: str, email: str) -> None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO nephrocare_sessions (token, user_id, email) VALUES (%s, %s, %s)",
                (token, user_id, email.lower())
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_session(token: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT token, user_id, email, created_at FROM nephrocare_sessions WHERE token = %s", (token,))
            row = cur.fetchone()
            if row:
                row['created_at'] = row['created_at'].timestamp()
                return dict(row)
            return None
    finally:
        conn.close()

def delete_session(token: str) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM nephrocare_sessions WHERE token = %s", (token,))
            rows_deleted = cur.rowcount
            conn.commit()
            return rows_deleted > 0
    except Exception:
        conn.rollback()
        return False
    finally:
        conn.close()

# Profiles queries
def get_profile(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT phone, dob, gender, ckd_stage as "ckdStage", nephrologist, 
                       blood_type as "bloodType", emergency_contact as "emergencyContact",
                       preferences
                FROM nephrocare_user_profiles WHERE user_id = %s
                """,
                (user_id,)
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()

def upsert_profile(user_id: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO nephrocare_user_profiles (user_id, phone, dob, gender, ckd_stage, nephrologist, blood_type, emergency_contact, preferences, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) DO UPDATE SET
                    phone = EXCLUDED.phone,
                    dob = EXCLUDED.dob,
                    gender = EXCLUDED.gender,
                    ckd_stage = EXCLUDED.ckd_stage,
                    nephrologist = EXCLUDED.nephrologist,
                    blood_type = EXCLUDED.blood_type,
                    emergency_contact = EXCLUDED.emergency_contact,
                    preferences = EXCLUDED.preferences,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING phone, dob, gender, ckd_stage as "ckdStage", nephrologist, 
                          blood_type as "bloodType", emergency_contact as "emergencyContact", preferences
                """,
                (
                    user_id,
                    profile_data.get("phone", ""),
                    profile_data.get("dob", ""),
                    profile_data.get("gender", ""),
                    profile_data.get("ckdStage", ""),
                    profile_data.get("nephrologist", ""),
                    profile_data.get("bloodType", ""),
                    profile_data.get("emergencyContact", ""),
                    json.dumps(profile_data.get("preferences", {}))
                )
            )
            row = cur.fetchone()
            conn.commit()
            return dict(row)
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

# History queries
def add_prediction(user_id: str, entry: Dict[str, Any]) -> None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO nephrocare_predictions (user_id, data) VALUES (%s, %s)",
                (user_id, psycopg2.extras.Json(entry))
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def add_ultrasound(user_id: str, entry: Dict[str, Any]) -> None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO nephrocare_ultrasound_scans (user_id, data) VALUES (%s, %s)",
                (user_id, psycopg2.extras.Json(entry))
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def add_symptom_log(user_id: str, entry: Dict[str, Any]) -> None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO nephrocare_symptom_logs (user_id, data) VALUES (%s, %s)",
                (user_id, psycopg2.extras.Json(entry))
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def add_food_check(user_id: str, entry: Dict[str, Any]) -> None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO nephrocare_food_checks (user_id, data) VALUES (%s, %s)",
                (user_id, psycopg2.extras.Json(entry))
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_history(user_id: str) -> Dict[str, List[Dict[str, Any]]]:
    conn = get_conn()
    history = {
        "predictions": [],
        "scans": [],
        "symptoms": [],
        "foodChecks": []
    }
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT data FROM nephrocare_predictions WHERE user_id = %s ORDER BY timestamp DESC", (user_id,))
            history["predictions"] = [row["data"] for row in cur.fetchall()]
            
            cur.execute("SELECT data FROM nephrocare_ultrasound_scans WHERE user_id = %s ORDER BY timestamp DESC LIMIT 5", (user_id,))
            history["scans"] = [row["data"] for row in cur.fetchall()]
            
            cur.execute("SELECT data FROM nephrocare_symptom_logs WHERE user_id = %s ORDER BY timestamp DESC", (user_id,))
            history["symptoms"] = [row["data"] for row in cur.fetchall()]
            
            cur.execute("SELECT data FROM nephrocare_food_checks WHERE user_id = %s ORDER BY timestamp DESC LIMIT 5", (user_id,))
            history["foodChecks"] = [row["data"] for row in cur.fetchall()]
            
            return history
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()

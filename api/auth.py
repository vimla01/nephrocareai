"""Simple authentication module for NephroCare API utilizing PostgreSQL."""

import hashlib
import secrets
import time
from typing import Any, Tuple, Optional
try:
    from api import db
except ImportError:
    import db


# Secret key for simple token generation
SECRET_KEY = secrets.token_hex(32)


def hash_password(password: str) -> str:
    """Hash password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()


def generate_token() -> str:
    """Generate a simple token."""
    return secrets.token_hex(32)


def signup(name: str, email: str, password: str) -> Tuple[Optional[dict[str, Any]], str]:
    """Register a new user in the PostgreSQL database.
    
    Returns: (user_dict, token) or (None, error_message)
    """
    # Validate input
    if not name or not email or not password:
        return None, "Missing required fields"
    
    if len(password) < 8:
        return None, "Password must be at least 8 characters"
    
    try:
        # Check if user exists
        existing_user = db.get_user_by_email(email)
        if existing_user:
            return None, "Email already registered"
        
        # Create user
        user_id = secrets.token_hex(8)
        hashed_pwd = hash_password(password)
        
        user_data = db.create_user(
            user_id=user_id,
            name=name,
            email=email,
            password_hash=hashed_pwd
        )
        
        # Create session/token
        token = generate_token()
        db.create_session(token, user_id, email)
        
        return {
            "id": user_data["id"],
            "name": user_data["name"],
            "email": user_data["email"],
        }, token
    except Exception as e:
        return None, f"Signup failed: {str(e)}"


def change_password(user_id: str, new_password: str) -> Tuple[bool, str]:
    if len(new_password) < 8:
        return False, "Password must be at least 8 characters"
    
    hashed_pwd = hash_password(new_password)
    success = db.update_user_password(user_id, hashed_pwd)
    if success:
        return True, "Password updated successfully"
    return False, "Failed to update password"


def login(email: str, password: str) -> Tuple[Optional[dict[str, Any]], str]:
    """Authenticate user with email and password using PostgreSQL database.
    
    Returns: (user_dict, token) or (None, error_message)
    """
    if not email or not password:
        return None, "Missing email or password"
    
    try:
        user = db.get_user_by_email(email)
        if not user:
            return None, "Invalid email or password"
        
        # Verify password
        if user["password_hash"] != hash_password(password):
            return None, "Invalid email or password"
        
        # Create session/token
        token = generate_token()
        db.create_session(token, user["id"], email)
        
        return {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
        }, token
    except Exception as e:
        return None, f"Login failed: {str(e)}"


def verify_token(token: str) -> Optional[dict[str, Any]]:
    """Verify session token and return user data if valid.
    
    Returns: user_dict or None
    """
    try:
        session = db.get_session(token)
        if not session:
            return None
        
        user = db.get_user_by_id(session["user_id"])
        if not user:
            return None
        
        return {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
        }
    except Exception:
        return None


def logout(token: str) -> bool:
    """Invalidate a token in the database."""
    try:
        return db.delete_session(token)
    except Exception:
        return False


def google_login(google_user_info: dict[str, str]) -> Tuple[Optional[dict[str, Any]], str]:
    """Create or update user from Google OAuth data.
    
    Expected google_user_info keys: email, name
    """
    email = google_user_info.get("email", "").lower()
    name = google_user_info.get("name", "")
    
    if not email:
        return None, "Google auth failed: no email"
    
    try:
        # Check if user exists
        user = db.get_user_by_email(email)
        if not user:
            # Create new user from Google data
            user_id = secrets.token_hex(8)
            user = db.create_user(
                user_id=user_id,
                name=name or "Google User",
                email=email,
                password_hash="",
                oauth_provider="google"
            )
        
        # Create session/token
        token = generate_token()
        db.create_session(token, user["id"], email)
        
        return {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
        }, token
    except Exception as e:
        return None, f"Google login failed: {str(e)}"

"""
auth.py — JWT authentication for CyberSentinel AI
Simple implementation with in-memory user store.
For production: replace USERS dict with SQLite database.
"""
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

SECRET_KEY = os.getenv("SECRET_KEY", "cybersentinel_secret_key_change_in_production_2025")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# ── User Store ────────────────────────────────────────────────────────────────
# In production, this would be a database table.
# Password for "admin" is "cybersentinel2025"
USERS = {
    "admin": pwd_context.hash("cybersentinel2025"),
    "yannick": pwd_context.hash("ictuniversity2025"),
}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if plain password matches the hashed version."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """Hash a plain password for storage."""
    return pwd_context.hash(password)


def create_token(username: str) -> str:
    """Create a JWT token for the given username."""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": username,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    FastAPI dependency: verify JWT token from Authorization header.
    Usage: add `username: str = Depends(verify_token)` to any protected route.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token expired or invalid: {str(e)}")

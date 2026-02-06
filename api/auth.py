"""
Authentication helpers for Supabase JWT verification.

Supports both:
- HS256 (symmetric) with SUPABASE_JWT_SECRET
- ES256 (asymmetric) via JWKS endpoint for local Supabase
"""

import os
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt

# Load environment variables from api/.env
env_file = Path(__file__).parent / ("prod.env" if os.getenv("PROD") else ".env")
load_dotenv(env_file)

# JWT configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# Cache for JWKS keys
_jwks_cache: dict = {}

# Security scheme for OpenAPI docs
security = HTTPBearer(auto_error=False)


class AuthError(HTTPException):
    """Authentication error with 401 status."""

    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_jwks() -> dict:
    """Fetch JWKS from Supabase for ES256 verification."""
    global _jwks_cache

    if _jwks_cache:
        return _jwks_cache

    if not SUPABASE_URL:
        raise AuthError("SUPABASE_URL not configured")

    jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

    try:
        response = httpx.get(jwks_url, timeout=10.0)
        response.raise_for_status()
        _jwks_cache = response.json()
        return _jwks_cache
    except Exception as e:
        raise AuthError(f"Failed to fetch JWKS: {e}") from e


def get_signing_key(token: str) -> str:
    """Get the appropriate signing key for the token."""
    # Decode header to check algorithm
    unverified_header = jwt.get_unverified_header(token)
    alg = unverified_header.get("alg", "")

    if alg == "HS256":
        # Symmetric key - use secret
        if not SUPABASE_JWT_SECRET:
            raise AuthError("SUPABASE_JWT_SECRET not configured for HS256")
        return SUPABASE_JWT_SECRET

    elif alg == "ES256":
        # Asymmetric key - get from JWKS
        kid = unverified_header.get("kid")
        jwks_data = get_jwks()

        for key in jwks_data.get("keys", []):
            if key.get("kid") == kid:
                # Convert JWK to PEM format
                public_key = jwk.construct(key)
                return public_key.to_pem().decode("utf-8")

        raise AuthError(f"No matching key found for kid: {kid}")

    else:
        raise AuthError(f"Unsupported algorithm: {alg}")


def decode_jwt(token: str) -> dict:
    """
    Decode and verify a Supabase JWT.

    Supports both HS256 (with secret) and ES256 (with JWKS).

    Args:
        token: The JWT string

    Returns:
        The decoded token payload

    Raises:
        AuthError: If token is invalid or expired
    """
    try:
        # Get the appropriate key based on algorithm
        key = get_signing_key(token)
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256")

        payload = jwt.decode(
            token,
            key,
            algorithms=[alg],
            audience="authenticated",
        )
        return payload
    except AuthError:
        raise
    except JWTError as e:
        raise AuthError(f"Invalid token: {e}") from e


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    FastAPI dependency to get the current authenticated user.

    Usage:
        @app.get("/protected")
        async def protected_route(user: dict = Depends(get_current_user)):
            return {"user_id": user["sub"]}

    Returns:
        Dict with user info including:
        - sub: User UUID
        - email: User email
        - role: User role (authenticated)

    Raises:
        HTTPException 401: If no token or invalid token
    """
    if credentials is None:
        raise AuthError("Missing authorization header")

    payload = decode_jwt(credentials.credentials)

    # Extract user info from token
    user_id = payload.get("sub")
    if not user_id:
        raise AuthError("Token missing user ID")

    return {
        "id": user_id,
        "email": payload.get("email"),
        "role": payload.get("role", "authenticated"),
    }


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    """
    FastAPI dependency to optionally get the current user.

    Returns None if no token provided (instead of raising 401).
    Still raises 401 if token is provided but invalid.

    Usage:
        @app.get("/public")
        async def public_route(
            user: Optional[dict] = Depends(get_optional_user)
        ):
            if user:
                return {"message": f"Hello {user['email']}"}
            return {"message": "Hello guest"}
    """
    if credentials is None:
        return None

    return await get_current_user(credentials)

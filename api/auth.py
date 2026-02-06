"""
Authentication helpers for Supabase JWT verification.
"""

import os
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

# JWT configuration
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
ALGORITHM = "HS256"

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


def decode_jwt(token: str) -> dict:
    """
    Decode and verify a Supabase JWT.

    Args:
        token: The JWT string

    Returns:
        The decoded token payload

    Raises:
        AuthError: If token is invalid or expired
    """
    if not SUPABASE_JWT_SECRET:
        raise AuthError("JWT secret not configured")

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=[ALGORITHM],
            audience="authenticated",
        )
        return payload
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

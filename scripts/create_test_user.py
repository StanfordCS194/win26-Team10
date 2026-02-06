#!/usr/bin/env python3
"""
Create a test user in Supabase for API testing.

This script creates a user via Supabase Auth and ensures they exist in the users table.

Usage:
    python scripts/create_test_user.py

The script will output the user credentials and a JWT token for testing.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
env_file = Path(__file__).parent.parent / "api" / ".env"
load_dotenv(env_file)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Test user credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "testpassword123"


def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in api/.env")
        sys.exit(1)

    # Use service role client for admin operations
    admin_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    print(f"Creating test user: {TEST_EMAIL}")
    print("-" * 50)

    # Try to create the user (or get existing)
    try:
        # First, try to sign up the user
        result = admin_client.auth.admin.create_user({
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "email_confirm": True,  # Auto-confirm email
        })
        user = result.user
        print(f"Created new user: {user.id}")
    except Exception as e:
        if "already been registered" in str(e).lower() or "already exists" in str(e).lower():
            print(f"User already exists, fetching...")
            # Get user by email
            users = admin_client.auth.admin.list_users()
            user = next((u for u in users if u.email == TEST_EMAIL), None)
            if not user:
                print(f"Error: Could not find user with email {TEST_EMAIL}")
                sys.exit(1)
            print(f"Found existing user: {user.id}")
        else:
            print(f"Error creating user: {e}")
            sys.exit(1)

    # Ensure user exists in public.users table
    try:
        existing = admin_client.table("users").select("*").eq("id", str(user.id)).execute()
        if not existing.data:
            print("Creating user record in public.users table...")
            admin_client.table("users").insert({
                "id": str(user.id),
                "email": TEST_EMAIL,
                "type": "student",
            }).execute()
            print("User record created")
        else:
            print(f"User record exists: type={existing.data[0].get('type')}")
    except Exception as e:
        print(f"Warning: Could not create/check users table record: {e}")

    # Now sign in to get a token
    print("\nGenerating access token...")
    
    # Use anon key for sign in (or service role if anon not available)
    auth_key = SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
    auth_client = create_client(SUPABASE_URL, auth_key)
    
    try:
        auth_result = auth_client.auth.sign_in_with_password({
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        
        token = auth_result.session.access_token
        
        print("\n" + "=" * 50)
        print("TEST USER CREDENTIALS")
        print("=" * 50)
        print(f"Email:    {TEST_EMAIL}")
        print(f"Password: {TEST_PASSWORD}")
        print(f"User ID:  {user.id}")
        print("\n" + "=" * 50)
        print("ACCESS TOKEN (use in Authorization header)")
        print("=" * 50)
        print(f"\n{token}\n")
        print("=" * 50)
        
        # Save token to file for easy use
        token_file = Path(__file__).parent / "test_token.txt"
        token_file.write_text(token)
        print(f"\nToken saved to: {token_file}")
        
    except Exception as e:
        print(f"Error signing in: {e}")
        print("\nYou may need to sign in manually or check the user's password.")
        sys.exit(1)


if __name__ == "__main__":
    main()

"""Auth0 Management API utilities for fetching user profile information."""

import os
import json
import requests
import traceback
from functools import lru_cache
from typing import Dict, Any, Optional
import time


class Auth0ManagementClient:
    """Client for Auth0 Management API."""

    def __init__(self):
        self.domain = os.environ.get("AUTH0_DOMAIN")
        self.client_id = os.environ.get("AUTH0_MANAGEMENT_CLIENT_ID", "")
        self.client_secret = os.environ.get("AUTH0_MANAGEMENT_CLIENT_SECRET", "")
        self.audience = f"https://{self.domain}/api/v2/"
        self._token = None
        self._token_expires_at = 0

    def _get_access_token(self) -> str:
        """Get Auth0 Management API access token."""
        # Check if we have a valid cached token
        if self._token and time.time() < self._token_expires_at:
            return self._token

        # If no client credentials are configured, return empty
        if not self.client_id or not self.client_secret:
            print("Auth0ManagementClient - No client credentials configured")
            return ""

        # Request new token
        url = f"https://{self.domain}/oauth/token"
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "audience": self.audience,
            "grant_type": "client_credentials",
        }

        try:
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            data = response.json()

            self._token = data["access_token"]
            # Cache token until 5 minutes before expiry
            self._token_expires_at = time.time() + data.get("expires_in", 86400) - 300

            print("Auth0ManagementClient - Successfully obtained access token")
            return self._token

        except Exception as e:
            print(f"Auth0ManagementClient - Failed to get access token: {e}")
            return ""

    def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user profile from Auth0 Management API.

        Args:
            user_id: Auth0 user ID (e.g., "oauth2|discord|123456")

        Returns:
            User profile dict or None if failed
        """
        token = self._get_access_token()
        if not token:
            return None

        # URL encode the user ID
        encoded_user_id = requests.utils.quote(user_id, safe="")
        url = f"https://{self.domain}/api/v2/users/{encoded_user_id}"

        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            profile = response.json()

            print(f"Auth0ManagementClient - Retrieved profile for {user_id}")
            print(f"Auth0ManagementClient - Profile data: {json.dumps(profile, default=str)}")

            return profile

        except Exception as e:
            print(f"Auth0ManagementClient - Failed to get user profile: {e}")
            return None


def extract_discord_info_from_management_api(profile: Dict[str, Any]) -> Dict[str, str]:
    """Extract Discord information from Auth0 Management API profile.

    Args:
        profile: User profile from Management API

    Returns:
        Dict with discord_username, discord_discriminator, discord_avatar_url
    """
    # Look for Discord identity in identities array
    identities = profile.get("identities", [])
    discord_identity = None

    for identity in identities:
        if identity.get("provider") == "discord":
            discord_identity = identity
            break

    if not discord_identity:
        print("extract_discord_info_from_management_api - No Discord identity found")
        return {
            "discord_username": profile.get("nickname", "Unknown User"),
            "discord_discriminator": None,
            "discord_avatar_url": profile.get("picture", ""),
        }

    # Extract from profileData
    profile_data = discord_identity.get("profileData", {})

    # Discord username might be in username or global_name
    username = profile_data.get("username") or profile_data.get("global_name", "Unknown User")
    discriminator = profile_data.get("discriminator")

    # Build avatar URL if not directly available
    avatar_url = profile_data.get("avatar_url", "")
    if not avatar_url and profile_data.get("avatar"):
        user_id = discord_identity.get("user_id", "")
        avatar_hash = profile_data["avatar"]
        avatar_url = f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.png"

    # Fallback to profile picture
    if not avatar_url:
        avatar_url = profile.get("picture", "")

    print(
        f"extract_discord_info_from_management_api - Extracted: username={username}, discriminator={discriminator}, avatar_url={avatar_url}"
    )

    return {
        "discord_username": username,
        "discord_discriminator": discriminator if discriminator != "0" else None,
        "discord_avatar_url": avatar_url,
    }


# Singleton instance
_management_client = None


def get_management_client() -> Auth0ManagementClient:
    """Get singleton Auth0 Management API client."""
    global _management_client
    if _management_client is None:
        _management_client = Auth0ManagementClient()
    return _management_client


def get_user_info_from_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Auth0 JWTトークンからユーザー情報を取得

    Args:
        token: JWT access token

    Returns:
        User info dict or None if failed
    """
    try:
        # Auth0ドメイン取得
        domain = os.environ.get("AUTH0_DOMAIN")
        if not domain:
            print("get_user_info_from_token - AUTH0_DOMAIN not found in environment")
            return None

        # Auth0のUserInfoエンドポイントを使用（シンプルで確実）
        url = f"https://{domain}/userinfo"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        print(f"get_user_info_from_token - Calling Auth0 userinfo endpoint: {url}")

        response = requests.get(url, headers=headers, timeout=10)
        print(f"get_user_info_from_token - Response status: {response.status_code}")

        if response.status_code == 200:
            user_info = response.json()
            print(f"get_user_info_from_token - Successfully got user info for: {user_info.get('sub', 'unknown')}")
            return user_info
        else:
            print(f"get_user_info_from_token - Auth0 userinfo failed: {response.status_code} - {response.text}")
            return None

    except Exception as e:
        print(f"get_user_info_from_token - Error: {e}")
        traceback.print_exc()
        return None

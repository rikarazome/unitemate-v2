import json
import os
from collections.abc import Callable
from functools import wraps
from typing import Any

import jwt
import requests


class Auth0JWTVerifier:
    """Auth0 JWT token verifier."""

    def __init__(self, domain: str, audience: str) -> None:
        self.domain = domain
        self.audience = audience
        self.issuer = f"https://{domain}/"
        self.jwks_client = Auth0JWKSClient(f"https://{domain}/.well-known/jwks.json")

    def verify_token(self, token: str) -> dict[str, Any]:
        """Verify JWT token and return payload."""
        try:
            unverified_header = jwt.get_unverified_header(token)
            rsa_key = self.jwks_client.get_signing_key(unverified_header["kid"])

            payload = jwt.decode(
                token,
                rsa_key.key,
                algorithms=["RS256"],
                audience=self.audience,
                issuer=self.issuer,
            )
        except jwt.ExpiredSignatureError as e:
            msg = "Token has expired"
            raise ValueError(msg) from e
        except jwt.JWTClaimsError as e:
            msg = "Invalid claims"
            raise ValueError(msg) from e
        except (jwt.InvalidTokenError, jwt.DecodeError) as e:
            msg = f"Invalid token: {e!s}"
            raise ValueError(msg) from e
        else:
            return payload


class Auth0JWKSClient:
    """Auth0 JWKS client for fetching signing keys."""

    def __init__(self, jwks_uri: str) -> None:
        self.jwks_uri = jwks_uri
        self._jwks_cache: dict[str, Any] = {}

    def get_signing_key(self, kid: str) -> Any:
        """Get signing key by key ID."""
        if not self._jwks_cache:
            self._fetch_jwks()

        for key in self._jwks_cache.get("keys", []):
            if key["kid"] == kid:
                return jwt.PyJWK(key)

        msg = f"Unable to find a signing key that matches: '{kid}'"
        raise ValueError(msg)

    def _fetch_jwks(self) -> None:
        response = requests.get(self.jwks_uri, timeout=10)
        response.raise_for_status()
        self._jwks_cache = response.json()


def get_auth0_verifier() -> Auth0JWTVerifier:
    """Get Auth0 JWT verifier instance."""
    domain = os.environ.get("AUTH0_DOMAIN")
    audience = os.environ.get("AUTH0_AUDIENCE")

    if not domain or not audience:
        msg = "AUTH0_DOMAIN and AUTH0_AUDIENCE environment variables must be set"
        raise ValueError(msg)

    return Auth0JWTVerifier(domain, audience)


def extract_token_from_event(event: dict[str, Any]) -> str:
    """Extract JWT token from AWS Lambda event."""
    authorization = event.get("headers", {}).get("Authorization") or event.get("headers", {}).get("authorization")

    if not authorization:
        msg = "Authorization header is required"
        raise ValueError(msg)

    if not authorization.startswith("Bearer "):
        msg = "Authorization header must be Bearer token"
        raise ValueError(msg)

    return authorization[7:]


def jwt_required(f: Callable[..., Any]) -> Callable[..., Any]:
    """JWT authentication decorator for Lambda functions."""

    @wraps(f)
    def decorated(event: dict[str, Any], context: Any) -> dict[str, Any]:
        try:
            token = extract_token_from_event(event)
            verifier = get_auth0_verifier()
            payload = verifier.verify_token(token)

            event["user"] = payload
            return f(event, context)

        except ValueError as e:
            return {
                "statusCode": 401,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,Authorization",
                    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
                },
                "body": json.dumps({"error": str(e)}),
            }
        except Exception:  # noqa: BLE001
            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,Authorization",
                    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
                },
                "body": json.dumps({"error": "Internal server error"}),
            }

    return decorated


def get_user_from_event(event: dict[str, Any]) -> dict[str, Any]:
    """Extract user information from AWS Lambda event."""
    return event.get("user", {})

import json
import os
from collections.abc import Callable
from functools import wraps
from typing import Any

import jwt
import requests


class Auth0JWTVerifier:
    def __init__(self, domain: str, audience: str) -> None:
        self.domain = domain
        self.audience = audience
        self.issuer = f"https://{domain}/"
        self.jwks_client = Auth0JWKSClient(f"https://{domain}/.well-known/jwks.json")

    def verify_token(self, token: str) -> dict[str, Any]:
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
            return payload
        except jwt.ExpiredSignatureError:
            raise ValueError("Token has expired")
        except jwt.JWTClaimsError:
            raise ValueError("Invalid claims")
        except Exception as e:
            raise ValueError(f"Invalid token: {e!s}")


class Auth0JWKSClient:
    def __init__(self, jwks_uri: str) -> None:
        self.jwks_uri = jwks_uri
        self._jwks_cache: dict[str, Any] = {}

    def get_signing_key(self, kid: str) -> Any:
        if not self._jwks_cache:
            self._fetch_jwks()

        for key in self._jwks_cache.get("keys", []):
            if key["kid"] == kid:
                return jwt.PyJWK(key)

        raise ValueError(f"Unable to find a signing key that matches: '{kid}'")

    def _fetch_jwks(self) -> None:
        response = requests.get(self.jwks_uri, timeout=10)
        response.raise_for_status()
        self._jwks_cache = response.json()


def get_auth0_verifier() -> Auth0JWTVerifier:
    domain = os.environ.get("AUTH0_DOMAIN")
    audience = os.environ.get("AUTH0_AUDIENCE")

    if not domain or not audience:
        raise ValueError("AUTH0_DOMAIN and AUTH0_AUDIENCE environment variables must be set")

    return Auth0JWTVerifier(domain, audience)


def extract_token_from_event(event: dict[str, Any]) -> str:
    authorization = event.get("headers", {}).get("Authorization") or event.get("headers", {}).get("authorization")

    if not authorization:
        raise ValueError("Authorization header is required")

    if not authorization.startswith("Bearer "):
        raise ValueError("Authorization header must be Bearer token")

    return authorization[7:]


def jwt_required(f: Callable[..., Any]) -> Callable[..., Any]:
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
        except Exception:
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
    return event.get("user", {})

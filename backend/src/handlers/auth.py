"""AWS API Gateway Lambda Authorizer for Auth0 JWT validation."""

import json
import os
from functools import lru_cache
from typing import Any

import jwt
import requests


@lru_cache(maxsize=1)
def get_jwks() -> dict[str, Any]:
    """JWKSをキャッシュして取得.

    Returns:
        dict[str, Any]: JWKSデータ.
    """
    domain = os.environ["AUTH0_DOMAIN"]
    jwks_url = f"https://{domain}/.well-known/jwks.json"

    print(f"Fetching JWKS from: {jwks_url}")
    response = requests.get(jwks_url, timeout=10)
    response.raise_for_status()
    print("JWKS fetched successfully")
    return response.json()


def get_signing_key(kid: str) -> Any:
    """キーIDに基づく署名キーの取得.

    Args:
        kid (str): キーID.

    Returns:
        Any: PyJWK署名キー.

    Raises:
        ValueError: 指定されたキーIDが見つからない場合.
    """
    jwks = get_jwks()
    for key in jwks.get("keys", []):
        if key["kid"] == kid:
            return jwt.PyJWK(key)
    msg = f"Unable to find signing key for kid: {kid}"
    raise ValueError(msg)


def authorize(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Auth0公式推奨のLambdaオーソライザー実装.

    Args:
        event (dict[str, Any]): API Gateway Lambda Authorizerイベント.
        _context (Any): Lambda実行コンテキスト.

    Returns:
        dict[str, Any]: 認証結果とIAMポリシーまたはHTTP APIレスポンス.
    """
    # HTTP APIでは routeArn を使用、REST APIでは methodArn を使用
    route_arn = event.get("routeArn") or event.get("methodArn", "unknown")
    print(f"AUTH: Starting authorization for event: {route_arn}")

    # トークンの抽出
    token = extract_token(event)
    print(f"AUTH: Token extracted successfully: {token[:20]}...")

    # JWT検証 (ローカル開発時は署名検証のみスキップ)
    payload = verify_jwt_token(token)
    print(f"AUTH: JWT verification successful for user: {payload.get('sub', 'unknown')}")

    # HTTP APIかどうかを判定(routeArnまたはversion 2.0の存在で判定)
    is_http_api = event.get("routeArn") is not None or event.get("version") == "2.0"
    if is_http_api:
        # HTTP API用のレスポンス
        auth_response = generate_http_api_response(
            principal_id=payload["sub"],
            effect="Allow",
            context=payload,
        )
    else:
        # REST API用のレスポンス
        auth_response = generate_policy(
            principal_id=payload["sub"],
            effect="Allow",
            resource=event["methodArn"],
            context=payload,
        )
    print("AUTH: Authorization successful, returning Allow response")
    return auth_response


def extract_token(event: dict[str, Any]) -> str:
    """イベントからJWTトークンを抽出.

    Args:
        event (dict[str, Any]): API Gatewayイベント.

    Returns:
        str: JWTトークン.

    Raises:
        ValueError: Authorizationヘッダーが無効または不足の場合.
    """
    auth_header = event.get("headers", {}).get("Authorization") or event.get("headers", {}).get("authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        msg = "Invalid or missing Authorization header"
        raise ValueError(msg)

    return auth_header[7:]  # "Bearer " を除去


def verify_jwt_token(token: str) -> dict[str, Any]:
    """JWTトークンの検証.

    Args:
        token (str): JWTトークン.

    Returns:
        dict[str, Any]: 検証済みトークンペイロード.

    Raises:
        ValueError: トークンが無効な場合.
    """
    # ローカル開発時は署名検証をスキップして基本的なJWT解析のみ
    if os.environ.get("IS_OFFLINE"):
        # 署名検証なしでペイロードを取得
        payload = jwt.decode(token, options={"verify_signature": False})
        # 最低限の構造チェック
        if "sub" not in payload:
            payload["sub"] = f"local-dev-user-{token[-8:]}"
        if "email" not in payload:
            payload["email"] = "dev@example.com"
        return payload

    # 本番環境では完全なJWT検証
    # ヘッダーの取得
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")

    if not kid:
        msg = "Token header missing 'kid'"
        raise ValueError(msg)

    # 署名キーの取得
    signing_key = get_signing_key(kid)

    # トークンの検証
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=os.environ["AUTH0_AUDIENCE"],
        issuer=f"https://{os.environ['AUTH0_DOMAIN']}/",
    )


def generate_http_api_response(
    principal_id: str,
    effect: str,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """HTTP API用のオーソライザーレスポンス生成.

    Args:
        principal_id (str): プリンシパルID.
        effect (str): 認証結果 ("Allow" または "Deny").
        context (dict[str, Any] | None): 追加のコンテキスト情報.

    Returns:
        dict[str, Any]: HTTP API用のレスポンス.
    """
    # enableSimpleResponses: true の場合のシンプルなレスポンス
    if effect == "Allow":
        response = {
            "isAuthorized": True,
            "context": {},
        }
        # コンテキストの追加 (認証済みユーザー情報)
        if context:
            response["context"] = {
                "user_id": context.get("sub", ""),
                "email": context.get("email", ""),
                "user_info": json.dumps(context),
            }
    else:
        response = {
            "isAuthorized": False,
        }

    return response


def generate_policy(
    principal_id: str,
    effect: str,
    resource: str,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """REST API用のIAMポリシー生成(後方互換性のため保持).

    Args:
        principal_id (str): プリンシパルID.
        effect (str): 認証結果 ("Allow" または "Deny").
        resource (str): リソースARN.
        context (dict[str, Any] | None): 追加のコンテキスト情報.

    Returns:
        dict[str, Any]: REST API用のIAMポリシー.
    """
    policy = {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": resource,
                },
            ],
        },
    }

    # コンテキストの追加 (認証済みユーザー情報)
    if context and effect == "Allow":
        policy["context"] = {
            "user_id": context.get("sub", ""),
            "email": context.get("email", ""),
            "user_info": json.dumps(context),
        }

    return policy

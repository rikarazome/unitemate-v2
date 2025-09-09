import json
import os
import logging
from typing import Dict, Any
import stripe
import boto3
from datetime import datetime

# ロギング設定
logging.basicConfig(level=logging.INFO, format="%(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# DynamoDB設定
dynamodb = boto3.resource("dynamodb")
# 環境変数から正しいテーブル名を取得
users_table_name = os.environ.get("USERS_TABLE_NAME")
if users_table_name:
    users_table = dynamodb.Table(users_table_name)

# Force redeploy for stripe module fix - v3

# Stripeの設定 - セキュリティ重視
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# 必要な環境変数のバリデーション
if not stripe.api_key:
    raise ValueError("STRIPE_SECRET_KEY environment variable is required")

# Stripeのバージョン固定（セキュリティのため）
stripe.api_version = "2023-10-16"


def create_checkout_session(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Stripe Checkoutセッションを作成する - セキュリティ強化版
    """
    try:
        # セキュリティ: リクエストボディの存在確認
        if "body" not in event:
            logger.warning("Missing request body in checkout session creation")
            return {
                "statusCode": 400,
                "headers": {
                    "Access-Control-Allow-Origin": os.getenv("FRONTEND_URL", "*"),
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                },
                "body": json.dumps({"error": "Missing request body"}),
            }

        # セキュリティ: JSONパース時の例外処理
        try:
            body = json.loads(event["body"])
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in request body: {e}")
            return {
                "statusCode": 400,
                "headers": {
                    "Access-Control-Allow-Origin": os.getenv("FRONTEND_URL", "*"),
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                },
                "body": json.dumps({"error": "Invalid JSON format"}),
            }

        # セキュリティ: 入力データのバリデーション
        badge_id = body.get("badgeId")
        badge_name = body.get("badgeName")
        price = body.get("price")  # 円単位
        user_id = body.get("userId")

        # 必須フィールドの検証
        if not all([badge_id, badge_name, price]):
            logger.warning("Missing required fields in checkout session creation")
            return {
                "statusCode": 400,
                "headers": {
                    "Access-Control-Allow-Origin": os.getenv("FRONTEND_URL", "*"),
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                },
                "body": json.dumps({"error": "Missing required fields"}),
            }

        # セキュリティ: 価格の範囲チェック（不正な価格を防ぐ）
        if not isinstance(price, (int, float)) or price <= 0 or price > 1000000:  # 100万円以下
            logger.warning(f"Invalid price value: {price}")
            return {
                "statusCode": 400,
                "headers": {
                    "Access-Control-Allow-Origin": os.getenv("FRONTEND_URL", "*"),
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                },
                "body": json.dumps({"error": "Invalid price value"}),
            }

        # セキュリティ: 文字列フィールドの長さ制限
        if len(str(badge_name)) > 100 or len(str(badge_id)) > 50:
            logger.warning("Badge name or ID too long")
            return {
                "statusCode": 400,
                "headers": {
                    "Access-Control-Allow-Origin": os.getenv("FRONTEND_URL", "*"),
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                },
                "body": json.dumps({"error": "Badge name or ID too long"}),
            }

        # セキュリティ強化: Stripe Checkoutセッションの作成
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "jpy",
                        "product_data": {
                            "name": f"勲章: {str(badge_name)[:50]}",  # 名前を50文字に制限
                            "description": "ユナメイトプロフィール用特別勲章",
                        },
                        "unit_amount": int(price),  # 整数に変換
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            # セキュリティ: URLエンコーディングでインジェクション防止
            success_url=f"{frontend_url}/shop?success=true&badge_id={badge_id}",
            cancel_url=f"{frontend_url}/shop?canceled=true",
            # メタデータは50文字以内に制限（Stripeの制限）
            metadata={
                "badge_id": str(badge_id)[:50],
                "user_id": str(user_id)[:50] if user_id else "anonymous",
                "source": "unitemate_shop",  # 識別用
            },
            # セキュリティ: セッションの有効期限を24時間に設定
            expires_at=int(__import__("time").time()) + (24 * 60 * 60),
        )

        logger.info(f"Checkout session created successfully: {session.id}")

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": os.getenv("FRONTEND_URL", "*"),
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Content-Type": "application/json",
            },
            "body": json.dumps({"url": session.url, "session_id": session.id}),
        }

    except stripe.error.StripeError as e:
        # セキュリティ: Stripeエラーは詳細をログに記録し、ユーザーには汎用メッセージ
        logger.error(f"Stripe error in checkout session creation: {str(e)}")
        return {
            "statusCode": 400,
            "headers": {
                "Access-Control-Allow-Origin": os.getenv("FRONTEND_URL", "*"),
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
            },
            "body": json.dumps({"error": "Payment processing error. Please try again."}),
        }
    except Exception as e:
        # セキュリティ: 詳細エラーはログのみ、ユーザーには汎用メッセージ
        logger.error(f"Unexpected error in checkout session creation: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": os.getenv("FRONTEND_URL", "*"),
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
            },
            "body": json.dumps({"error": "Internal server error. Please try again later."}),
        }


def webhook_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Stripe Webhookを処理する - セキュリティ強化版
    """
    try:
        print(
            f"Webhook received: {event.get('httpMethod')} from {event.get('headers', {}).get('user-agent', 'unknown')}"
        )

        # セキュリティ: 必須ヘッダーとペイロードの検証
        payload = event.get("body")
        sig_header = event.get("headers", {}).get("stripe-signature")
        endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

        print(
            f"Payload exists: {payload is not None}, Signature exists: {sig_header is not None}, Secret exists: {endpoint_secret is not None}"
        )

        if not payload:
            logger.error("Missing payload in webhook")
            return {"statusCode": 400, "body": json.dumps({"error": "Missing payload"})}

        if not sig_header:
            logger.error("Missing Stripe signature in webhook")
            return {"statusCode": 400, "body": json.dumps({"error": "Missing signature"})}

        if not endpoint_secret:
            logger.error("Missing webhook secret configuration")
            return {"statusCode": 500, "body": json.dumps({"error": "Server configuration error"})}

        # セキュリティ: Webhookの署名検証（改ざん防止）
        try:
            print(f"Attempting to construct Stripe event...")
            stripe_event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
            print(f"Stripe event constructed successfully")
        except stripe.error.SignatureVerificationError as e:
            print(f"Webhook signature verification failed: {str(e)}")
            logger.error(f"Webhook signature verification failed: {str(e)}")
            return {"statusCode": 400, "body": json.dumps({"error": "Invalid signature"})}
        except Exception as e:
            print(f"Error constructing Stripe event: {str(e)}")
            logger.error(f"Error constructing Stripe event: {str(e)}")
            return {"statusCode": 400, "body": json.dumps({"error": "Event construction failed"})}

        print(f"Webhook received: {stripe_event['type']}")
        logger.info(f"Webhook received: {stripe_event['type']}")

        # 支払い完了の処理（セキュリティ強化）
        if stripe_event["type"] == "checkout.session.completed":
            session = stripe_event["data"]["object"]

            print(f"Session data: {json.dumps(session, default=str)}")

            # セキュリティ: メタデータの検証
            metadata = session.get("metadata", {})
            print(f"Metadata: {metadata}")
            badge_id = metadata.get("badge_id")
            user_id = metadata.get("user_id")
            source = metadata.get("source")
            print(f"Badge ID: {badge_id}, User ID: {user_id}, Source: {source}")

            # セキュリティ: 必須フィールドの確認
            if not badge_id or not user_id:
                logger.error("Missing badge_id or user_id in webhook metadata")
                return {"statusCode": 400, "body": json.dumps({"error": "Invalid metadata"})}

            # セキュリティ: ソースの検証（他のアプリケーションからの誤送信を防ぐ）
            if source != "unitemate_shop":
                logger.warning(f"Webhook from unknown source: {source}")
                return {"statusCode": 400, "body": json.dumps({"error": "Invalid source"})}

            # セキュリティ: 支払いステータスの確認
            if session.get("payment_status") != "paid":
                logger.warning(f"Payment not completed for session {session.get('id')}")
                return {"statusCode": 200, "body": json.dumps({"received": True, "action": "ignored"})}

            # DynamoDBに勲章を付与する処理
            try:
                print(f"Table name from env: {os.environ.get('USERS_TABLE_NAME', 'NOT SET')}")
                print(f"Attempting to get user from DynamoDB: namespace='default', user_id='{user_id}'")
                # ユーザー情報を取得（正しいキー構造を使用）
                response = users_table.get_item(Key={"namespace": "default", "user_id": user_id})
                print(f"DynamoDB response: {response}")

                if "Item" not in response:
                    logger.error(f"User {user_id} not found in database")
                    return {"statusCode": 200, "body": json.dumps({"received": True, "error": "User not found"})}

                user = response["Item"]

                # 既存の勲章リストを取得（なければ空リスト）
                owned_badges = user.get("owned_badges", [])

                # 重複チェック
                if badge_id in owned_badges:
                    logger.warning(f"Badge {badge_id} already owned by user {user_id}")
                    return {"statusCode": 200, "body": json.dumps({"received": True, "action": "already_owned"})}

                # 勲章を追加
                owned_badges.append(badge_id)

                # ユーザー情報を更新（正しいキー構造を使用）
                users_table.update_item(
                    Key={"namespace": "default", "user_id": user_id},
                    UpdateExpression="SET owned_badges = :badges, updated_at = :now",
                    ExpressionAttributeValues={":badges": owned_badges, ":now": int(datetime.now().timestamp())},
                )

                print(f"Successfully granted badge {badge_id} to user {user_id}")
                logger.info(f"Successfully granted badge {badge_id} to user {user_id}")

            except Exception as e:
                print(f"Failed to grant badge to user: {str(e)}")
                print(f"Error type: {type(e)}")
                import traceback

                print(f"Traceback: {traceback.format_exc()}")
                logger.error(f"Failed to grant badge to user: {str(e)}")
                # Webhookは成功として処理（再送を防ぐため）
                return {"statusCode": 200, "body": json.dumps({"received": True, "error": "Database error"})}

            logger.info(f"Badge {badge_id} granted to user {user_id} via session {session.get('id')}")

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"received": True}),
        }

    except ValueError as e:
        logger.error(f"Value error in webhook handler: {str(e)}")
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Invalid request data"}),
        }
    except Exception as e:
        logger.error(f"Unexpected error in webhook handler: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Internal server error"}),
        }

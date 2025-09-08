"""勲章付与用のAPI（管理者/システム用）"""

import json
import os
import boto3
import logging
from datetime import datetime
from boto3.dynamodb.conditions import Key
from src.utils.response import create_success_response, create_error_response
# from src.utils.auth import get_user_id_from_event  # この関数は存在しないため削除

# ロガー設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# DynamoDB設定
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(os.environ.get("USERS_TABLE_NAME"))

NAMESPACE = "default"


def grant_badge(event, context):
    """ユーザーに勲章を付与（管理者/システム用）"""
    try:
        # リクエストボディを解析
        body = json.loads(event.get("body", "{}"))
        target_user_id = body.get("user_id")
        badge_ids = body.get("badge_ids", [])

        if not target_user_id or not badge_ids:
            return create_error_response(400, "Missing user_id or badge_ids")

        if not isinstance(badge_ids, list):
            badge_ids = [badge_ids]

        # ユーザー情報を取得
        user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": target_user_id})

        if "Item" not in user_response:
            return create_error_response(404, "User not found")

        user = user_response["Item"]
        current_owned_badges = set(user.get("owned_badges", []))

        # 新しい勲章を追加
        new_badges = []
        for badge_id in badge_ids:
            if badge_id not in current_owned_badges:
                current_owned_badges.add(badge_id)
                new_badges.append(badge_id)

        if not new_badges:
            return create_success_response(
                {"message": "No new badges to grant", "owned_badges": list(current_owned_badges)}
            )

        # ユーザーの所持勲章を更新
        users_table.update_item(
            Key={"namespace": NAMESPACE, "user_id": target_user_id},
            UpdateExpression="SET owned_badges = :owned_badges, updated_at = :updated_at",
            ExpressionAttributeValues={
                ":owned_badges": list(current_owned_badges),
                ":updated_at": int(datetime.now().timestamp()),
            },
        )

        logger.info(f"Granted badges to user {target_user_id}: {new_badges}")

        return create_success_response({
            "message": "Badges granted successfully",
            "user_id": target_user_id,
            "granted_badges": new_badges,
            "owned_badges": list(current_owned_badges),
        })

    except Exception as e:
        logger.error(f"Failed to grant badges: {e}")
        return create_error_response(500, "Internal server error")


def revoke_badge(event, context):
    """ユーザーから勲章を剥奪（管理者用）"""
    try:
        # リクエストボディを解析
        body = json.loads(event.get("body", "{}"))
        target_user_id = body.get("user_id")
        badge_ids = body.get("badge_ids", [])

        if not target_user_id or not badge_ids:
            return create_error_response(400, "Missing user_id or badge_ids")

        if not isinstance(badge_ids, list):
            badge_ids = [badge_ids]

        # ユーザー情報を取得
        user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": target_user_id})

        if "Item" not in user_response:
            return create_error_response(404, "User not found")

        user = user_response["Item"]
        current_owned_badges = set(user.get("owned_badges", []))

        # 勲章を削除
        revoked_badges = []
        for badge_id in badge_ids:
            if badge_id in current_owned_badges:
                current_owned_badges.remove(badge_id)
                revoked_badges.append(badge_id)

        if not revoked_badges:
            return create_success_response({"message": "No badges to revoke", "owned_badges": list(current_owned_badges)})

        # 装着中の勲章も削除
        update_expression = "SET owned_badges = :owned_badges, updated_at = :updated_at"
        expression_values = {
            ":owned_badges": list(current_owned_badges),
            ":updated_at": int(datetime.now().timestamp()),
        }

        if user.get("current_badge") in badge_ids:
            update_expression += ", current_badge = :null_badge"
            expression_values[":null_badge"] = None

        if user.get("current_badge_2") in badge_ids:
            update_expression += ", current_badge_2 = :null_badge_2"
            expression_values[":null_badge_2"] = None

        users_table.update_item(
            Key={"namespace": NAMESPACE, "user_id": target_user_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
        )

        logger.info(f"Revoked badges from user {target_user_id}: {revoked_badges}")

        return create_success_response({
            "message": "Badges revoked successfully",
            "user_id": target_user_id,
            "revoked_badges": revoked_badges,
            "owned_badges": list(current_owned_badges),
        })

    except Exception as e:
        logger.error(f"Failed to revoke badges: {e}")
        return create_error_response(500, "Internal server error")


def get_user_badges(event, context):
    """ユーザーの所持勲章を取得"""
    try:
        # HTTP APIの認証情報からauth0_user_idを取得
        # HTTP APIでは authorizer コンテキストが lambda キー内に配置される
        authorizer_context = event.get("requestContext", {}).get("authorizer", {})
        auth0_user_id = authorizer_context.get("lambda", {}).get("user_id")

        if not auth0_user_id:
            return create_error_response(401, "Unauthorized: user_id not found in authorizer context")
            
        # Auth0 user_idからDiscord IDを抽出してuser_idとして使用
        if "|" in auth0_user_id:
            user_id = auth0_user_id.split("|")[-1]  # oauth2|discord|123456789 → 123456789
        else:
            user_id = auth0_user_id

        # ユーザー情報を取得
        user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})

        if "Item" not in user_response:
            return create_error_response(404, "User not found")

        user = user_response["Item"]

        return create_success_response({
            "owned_badges": user.get("owned_badges", []),
            "current_badge": user.get("current_badge"),
            "current_badge_2": user.get("current_badge_2")
        })

    except Exception as e:
        logger.error(f"Failed to get user badges: {e}")
        return create_error_response(500, "Internal server error")


def equip_badges(event, context):
    """勲章を装着"""
    try:
        # HTTP APIの認証情報からauth0_user_idを取得
        # HTTP APIでは authorizer コンテキストが lambda キー内に配置される
        authorizer_context = event.get("requestContext", {}).get("authorizer", {})
        auth0_user_id = authorizer_context.get("lambda", {}).get("user_id")

        if not auth0_user_id:
            return create_error_response(401, "Unauthorized: user_id not found in authorizer context")
            
        # Auth0 user_idからDiscord IDを抽出してuser_idとして使用
        if "|" in auth0_user_id:
            user_id = auth0_user_id.split("|")[-1]  # oauth2|discord|123456789 → 123456789
        else:
            user_id = auth0_user_id

        # リクエストボディを解析
        body = json.loads(event.get("body", "{}"))
        primary_badge = body.get("primary_badge")  # None可
        secondary_badge = body.get("secondary_badge")  # None可

        # 同じ勲章を2つ装着することはできない
        if primary_badge and secondary_badge and primary_badge == secondary_badge:
            return create_error_response(400, "Cannot equip the same badge twice")

        # ユーザー情報を取得
        user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})

        if "Item" not in user_response:
            return create_error_response(404, "User not found")

        user = user_response["Item"]
        owned_badges = set(user.get("owned_badges", []))

        # 所持していない勲章は装着できない
        for badge_id in [primary_badge, secondary_badge]:
            if badge_id and badge_id not in owned_badges:
                return create_error_response(400, f"Badge {badge_id} not owned")

        # 勲章を装着
        users_table.update_item(
            Key={"namespace": NAMESPACE, "user_id": user_id},
            UpdateExpression="SET current_badge = :primary, current_badge_2 = :secondary, updated_at = :updated_at",
            ExpressionAttributeValues={
                ":primary": primary_badge,
                ":secondary": secondary_badge,
                ":updated_at": int(datetime.now().timestamp()),
            },
        )

        logger.info(f"User {user_id} equipped badges: primary={primary_badge}, secondary={secondary_badge}")

        return create_success_response({
            "message": "Badges equipped successfully",
            "current_badge": primary_badge,
            "current_badge_2": secondary_badge,
        })

    except Exception as e:
        logger.error(f"Failed to equip badges: {e}")
        return create_error_response(500, "Internal server error")

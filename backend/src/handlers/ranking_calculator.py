"""Lambda handler for calculating and storing rankings periodically."""

import json
import os
import boto3
import logging
from datetime import datetime
from decimal import Decimal
from boto3.dynamodb.conditions import Key

# ロガー設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# DynamoDB設定
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(os.environ.get("USERS_TABLE_NAME"))
rankings_table = dynamodb.Table(os.environ.get("RANKINGS_TABLE_NAME"))

NAMESPACE = "default"


def calculate_rankings(event, context):
    """定期的にランキングを計算して保存する.

    CloudWatch Events/EventBridgeから10分ごとに実行される。
    """
    try:
        logger.info("Starting ranking calculation")

        # ユーザーデータを取得（rate_indexを使用）
        response = users_table.query(
            IndexName="rate_index",
            KeyConditionExpression=Key("namespace").eq(NAMESPACE),
            ScanIndexForward=False,  # 降順でソート
            Limit=200,  # 上位200人を取得（余裕を持って）
        )

        items = response.get("Items", [])
        logger.info(f"Found {len(items)} users for ranking")

        # 必要なフィールドを取得して整形
        ranking_data = []
        for item in items:
            # 公開可能な情報のみを抽出
            user_data = {
                "user_id": item.get("user_id"),
                "trainer_name": item.get("trainer_name", item.get("user_id")),
                "rate": int(item.get("rate", 1500)),
                "best_rate": int(item.get("best_rate", 1500)),
                "win_rate": Decimal(str(item.get("win_rate", 0))),
                "win_count": int(item.get("win_count", 0)),
                "discord_username": item.get("discord_username"),
                "discord_avatar_url": item.get("discord_avatar_url"),
                "twitter_id": item.get("twitter_id"),
                "current_badge": item.get("current_badge"),
                "current_badge_2": item.get("current_badge_2"),
            }
            ranking_data.append(user_data)

        # レートと勝率でソート
        sorted_data = sorted(ranking_data, key=lambda x: (-x["rate"], -float(x["win_rate"])))

        # 上位100人を選出
        top_rankings = sorted_data[:100]

        # バッチ書き込みの準備
        timestamp = int(datetime.now().timestamp())
        with rankings_table.batch_writer() as batch:
            # 既存のランキングをクリア（オプション）
            # 新しいランキングを書き込み
            for i, user in enumerate(top_rankings):
                rank = i + 1
                item = {
                    "ranking_type": "rate",  # レートランキング
                    "rank": Decimal(rank),
                    "user_id": user["user_id"],
                    "trainer_name": user["trainer_name"],
                    "rate": Decimal(user["rate"]) if isinstance(user["rate"], (int, float)) else user["rate"],
                    "best_rate": Decimal(user["best_rate"]) if isinstance(user["best_rate"], (int, float)) else user["best_rate"],
                    "win_rate": Decimal(str(user["win_rate"])) if isinstance(user["win_rate"], (int, float)) else user["win_rate"],
                    "win_count": Decimal(user["win_count"]) if isinstance(user["win_count"], (int, float)) else user["win_count"],
                    "discord_username": user.get("discord_username"),
                    "discord_avatar_url": user.get("discord_avatar_url"),
                    "twitter_id": user.get("twitter_id"),
                    "current_badge": user.get("current_badge"),
                    "current_badge_2": user.get("current_badge_2"),
                    "updated_at": Decimal(timestamp),
                }
                # DynamoDBのNoneフィールドを削除
                item = {k: v for k, v in item.items() if v is not None}
                batch.put_item(Item=item)

        logger.info(f"Successfully calculated and stored {len(top_rankings)} rankings")

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Rankings calculated successfully",
                    "rankings_count": len(top_rankings),
                    "timestamp": timestamp,
                }
            ),
        }

    except Exception as e:
        logger.error(f"Failed to calculate rankings: {e}")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}

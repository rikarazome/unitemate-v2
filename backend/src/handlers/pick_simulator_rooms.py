# BANPICK シミュレーターツール専用 - P2Pルーム管理ハンドラー
# メインアプリの機能とは完全に独立したツール用のAPI
# ※このファイルはBANPICKシミュレーターツール専用です※

import json
import time
import boto3
import os
from botocore.exceptions import ClientError

# DynamoDB設定（ツール専用テーブル）
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("PICK_SIMULATOR_ROOMS_TABLE_NAME", "pick-simulator-rooms"))


def create_pick_simulator_room(event, context):
    """BANPICKシミュレーター用P2Pルームを作成"""
    try:
        body = json.loads(event["body"]) if event.get("body") else {}
        room_id = body.get("room_id")
        host_offer = body.get("host_offer", "")

        if not room_id:
            return {
                "statusCode": 400,
                "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
                "body": json.dumps({"error": "room_id is required"}),
            }

        # BANPICKシミュレーター用ルームをDynamoDBに保存（TTL: 1時間）
        table.put_item(
            Item={
                "room_id": room_id,
                "host_offer": host_offer,
                "guest_answer": "",
                "created_at": int(time.time()),
                "ttl": int(time.time()) + 3600,  # 1時間後に自動削除
                "tool_type": "banpick_simulator",  # ツール識別用
            }
        )

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
            "body": json.dumps({"room_id": room_id, "message": "BANPICK simulator room created successfully"}),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
            "body": json.dumps({"error": str(e)}),
        }


def check_pick_simulator_room(event, context):
    """BANPICKシミュレーター用ルームの存在確認"""
    try:
        room_id = event["pathParameters"]["room_id"]

        response = table.get_item(Key={"room_id": room_id})

        if "Item" not in response:
            return {
                "statusCode": 404,
                "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
                "body": json.dumps({"exists": False}),
            }

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
            "body": json.dumps({"exists": True, "room": response["Item"]}),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
            "body": json.dumps({"error": str(e)}),
        }


def update_pick_simulator_room_offer(event, context):
    """BANPICKシミュレーター用ルームのホストオファー更新"""
    try:
        room_id = event["pathParameters"]["room_id"]
        body = json.loads(event["body"]) if event.get("body") else {}
        host_offer = body.get("host_offer", "")

        table.update_item(
            Key={"room_id": room_id},
            UpdateExpression="SET host_offer = :offer",
            ExpressionAttributeValues={":offer": host_offer},
            ConditionExpression="attribute_exists(room_id)",
        )

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
            "body": json.dumps({"message": "BANPICK simulator room offer updated successfully"}),
        }

    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return {
                "statusCode": 404,
                "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
                "body": json.dumps({"error": "BANPICK simulator room not found"}),
            }
        raise

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
            "body": json.dumps({"error": str(e)}),
        }


def update_pick_simulator_room_answer(event, context):
    """BANPICKシミュレーター用ルームのゲストアンサー更新"""
    try:
        room_id = event["pathParameters"]["room_id"]
        body = json.loads(event["body"]) if event.get("body") else {}
        guest_answer = body.get("guest_answer", "")

        table.update_item(
            Key={"room_id": room_id},
            UpdateExpression="SET guest_answer = :answer",
            ExpressionAttributeValues={":answer": guest_answer},
            ConditionExpression="attribute_exists(room_id)",
        )

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
            "body": json.dumps({"message": "BANPICK simulator room answer updated successfully"}),
        }

    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return {
                "statusCode": 404,
                "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
                "body": json.dumps({"error": "BANPICK simulator room not found"}),
            }
        raise

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
            "body": json.dumps({"error": str(e)}),
        }


def get_pick_simulator_room_data(event, context):
    """BANPICKシミュレーター用ルームデータを取得（P2P接続用）"""
    try:
        room_id = event["pathParameters"]["room_id"]

        response = table.get_item(Key={"room_id": room_id})

        if "Item" not in response:
            return {
                "statusCode": 404,
                "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
                "body": json.dumps({"error": "BANPICK simulator room not found"}),
            }

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
            "body": json.dumps(response["Item"]),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": True},
            "body": json.dumps({"error": str(e)}),
        }


def pick_simulator_rooms_options_handler(event, context):
    """BANPICKシミュレーター用CORS対応OPTIONSハンドラー"""
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": "",
    }

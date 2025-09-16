#!/usr/bin/env python3
"""
特定ユーザーの違反報告とペナルティ状況を分析するスクリプト（本番環境用）
READ-ONLYで動作し、データベースへの書き込みは一切行いません
"""

import json
import os
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List

import boto3
from dotenv import load_dotenv

# 環境変数の読み込み（本番環境）
load_dotenv(".env.prod")

# DynamoDB設定（読み込み専用）
dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")

# テーブル名（本番環境）
STAGE = "prod"
MATCHES_TABLE_NAME = f"unitemate-v2-matches-{STAGE}"
USERS_TABLE_NAME = f"unitemate-v2-users-{STAGE}"
RECORDS_TABLE_NAME = f"unitemate-v2-records-{STAGE}"

# 分析対象のユーザーID
TARGET_USER_ID = "753912195871670272"


def decimal_default(obj):
    """DecimalをJSONシリアライズ可能に変換"""
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    raise TypeError


def get_user_info(user_id: str) -> Dict[str, Any]:
    """ユーザー情報を取得（READ-ONLY）"""
    try:
        print(f"Fetching user info for {user_id}...")
        table = dynamodb.Table(USERS_TABLE_NAME)
        response = table.get_item(
            Key={
                "namespace": "default",
                "user_id": user_id,
            }
        )
        if "Item" in response:
            user = response["Item"]
            # effective_penalty を正しく計算
            penalty_count = int(user.get("penalty_count", 0))
            penalty_correction = int(user.get("penalty_correction", 0))
            effective_penalty = max(0, penalty_count - penalty_correction)

            return {
                "user_id": user_id,
                "trainer_name": user.get("trainer_name", "unknown"),
                "discord_username": user.get("discord_username", "unknown"),
                "penalty_count": penalty_count,
                "penalty_correction": penalty_correction,
                "effective_penalty": effective_penalty,
                "rate": int(user.get("rate", 1500)) if user.get("rate") else 1500,
                "best_rate": int(user.get("best_rate", 1500)) if user.get("best_rate") else 1500,
                "total_matches": int(user.get("total_matches", 0)) if user.get("total_matches") else 0,
                "win_count": int(user.get("win_count", 0)) if user.get("win_count") else 0,
                "lose_count": int(user.get("lose_count", 0)) if user.get("lose_count") else 0,
            }
    except Exception as e:
        print(f"Error fetching user info: {e}")

    return {"user_id": user_id, "error": "User not found"}


def get_user_records(user_id: str) -> List[Dict[str, Any]]:
    """ユーザーのRecordsを取得してmatch_idのリストを返す（READ-ONLY）"""
    try:
        print(f"Fetching records for user {user_id}...")
        table = dynamodb.Table(RECORDS_TABLE_NAME)

        # user_idをパーティションキーとしてQuery
        response = table.query(
            KeyConditionExpression="user_id = :uid",
            ExpressionAttributeValues={
                ":uid": user_id
            }
        )

        records = response.get("Items", [])
        print(f"Found {len(records)} records for user")

        # ページネーション対応
        while "LastEvaluatedKey" in response:
            response = table.query(
                KeyConditionExpression="user_id = :uid",
                ExpressionAttributeValues={
                    ":uid": user_id
                },
                ExclusiveStartKey=response["LastEvaluatedKey"]
            )
            records.extend(response.get("Items", []))

        return records

    except Exception as e:
        print(f"Error fetching records: {e}")
        return []


def get_match_by_id(match_id: int) -> Dict[str, Any]:
    """特定の試合データを取得（READ-ONLY）"""
    try:
        table = dynamodb.Table(MATCHES_TABLE_NAME)
        response = table.get_item(
            Key={
                "namespace": "default",
                "match_id": Decimal(str(match_id))  # match_idは数値型
            }
        )
        return response.get("Item", {})
    except Exception as e:
        print(f"Error fetching match {match_id}: {e}")
        return {}


def analyze_match_reports(match: Dict[str, Any], target_user_id: str) -> Dict[str, Any]:
    """試合の報告データを分析"""
    match_id = match.get("match_id", "unknown")
    matched_unixtime = match.get("matched_unixtime", 0)

    # 日時を人間が読める形式に変換
    if matched_unixtime:
        timestamp = float(matched_unixtime) if isinstance(matched_unixtime, Decimal) else matched_unixtime
        match_date = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")
    else:
        match_date = "unknown"

    result = {
        "match_id": int(match_id) if isinstance(match_id, Decimal) else match_id,
        "date": match_date,
        "status": match.get("status", "unknown"),
        "result": match.get("result", "unknown"),
        "violation_reports_against_user": [],
        "all_user_reports": match.get("user_reports", []),
        "penalty_players": match.get("penalty_players", []),
        "user_was_penalized": False,
        "user_team": None,
        "user_role": None,
    }

    # ユーザーがどのチームにいたか確認
    teamA = match.get("teamA", [])
    teamB = match.get("teamB", [])

    # チーム内でのユーザー検索を簡素化
    def find_user_in_team(team_members, user_id):
        for member in team_members:
            if isinstance(member, dict):
                # 複数のフィールドをチェック
                player_id = (member.get("user_id") or
                           member.get("player", {}).get("id") or
                           member.get("player", {}).get("user_id") or
                           member.get("id"))
                if str(player_id) == str(user_id):
                    return member.get("role", "unknown")
        return None

    user_role = find_user_in_team(teamA, target_user_id)
    if user_role:
        result["user_team"] = "A"
        result["user_role"] = user_role
    else:
        user_role = find_user_in_team(teamB, target_user_id)
        if user_role:
            result["user_team"] = "B"
            result["user_role"] = user_role

    # user_reportsからviolation_reportを分析
    user_reports = match.get("user_reports", [])

    for report in user_reports:
        if isinstance(report, dict):
            # violation_reportフィールドから通報対象を取得
            violation_report = report.get("violation_report", "") or report.get("vioration_report", "")
            reporter_id = report.get("user_id", "unknown")

            if violation_report and violation_report.strip():
                # カンマ区切りで複数の通報対象をパース
                reported_users = [uid.strip() for uid in str(violation_report).split(",") if uid.strip()]

                # ターゲットユーザーが通報されているかチェック
                if target_user_id in reported_users:
                    result["violation_reports_against_user"].append({
                        "reporter_id": reporter_id,
                        "violation_report": violation_report,
                        "report_reason": report.get("violation_reason", ""),
                        "full_report": report
                    })

    # ペナルティ確認
    penalty_players = result["penalty_players"]
    if isinstance(penalty_players, list) and target_user_id in penalty_players:
        result["user_was_penalized"] = True

    # 報告者のチーム分析
    if result["violation_reports_against_user"] and result["user_team"]:
        same_team_reporters = []
        other_team_reporters = []

        for violation_report in result["violation_reports_against_user"]:
            reporter_id = violation_report["reporter_id"]

            # 報告者のチームを特定
            reporter_team = None
            if find_user_in_team(teamA, reporter_id):
                reporter_team = "A"
            elif find_user_in_team(teamB, reporter_id):
                reporter_team = "B"

            violation_report["reporter_team"] = reporter_team

            if reporter_team == result["user_team"]:
                same_team_reporters.append(violation_report)
            else:
                other_team_reporters.append(violation_report)

        result["same_team_reports"] = len(same_team_reporters)
        result["other_team_reports"] = len(other_team_reporters)
        result["same_team_reporters"] = same_team_reporters
        result["other_team_reporters"] = other_team_reporters
        result["total_reports"] = len(result["violation_reports_against_user"])

        # ペナルティ閾値チェック
        result["should_have_penalty"] = (result["same_team_reports"] >= 4 or result["total_reports"] >= 6)

    return result


def main():
    """メイン処理（READ-ONLY）"""
    print(f"\n=== Violation Report Analysis for User {TARGET_USER_ID} (PRODUCTION) ===\n")
    print("NOTE: This script operates in READ-ONLY mode. No database writes will be performed.\n")

    # 1. ユーザー情報を取得
    user_info = get_user_info(TARGET_USER_ID)
    print(f"User Info: {json.dumps(user_info, indent=2, default=decimal_default)}\n")

    # 2. ユーザーのRecordsを取得
    records = get_user_records(TARGET_USER_ID)

    if not records:
        print("No records found for this user.")
        return

    # 3. match_idのリストを作成
    match_ids = [record.get("match_id") for record in records if "match_id" in record]
    match_ids = sorted(set(match_ids), reverse=True)  # 重複削除と新しい順にソート

    print(f"User has participated in {len(match_ids)} matches\n")

    # 4. 各試合のデータを取得して分析
    analysis_results = {
        "user_info": user_info,
        "total_matches": len(match_ids),
        "matches_with_reports": [],
        "matches_with_penalties": [],
        "summary": {
            "total_reports_received": 0,
            "matches_reported_in": 0,
            "matches_penalized_in": 0,
            "matches_should_have_penalty": 0,
        }
    }

    print("Analyzing matches...\n")

    for i, match_id in enumerate(match_ids):
        if i % 10 == 0:
            print(f"Processing match {i+1}/{len(match_ids)}...")

        # 試合データを取得
        match_data = get_match_by_id(match_id)

        if not match_data:
            continue

        # 報告を分析
        analysis = analyze_match_reports(match_data, TARGET_USER_ID)

        # 報告がある場合
        if analysis["violation_reports_against_user"]:
            analysis_results["matches_with_reports"].append(analysis)
            analysis_results["summary"]["total_reports_received"] += len(analysis["violation_reports_against_user"])
            analysis_results["summary"]["matches_reported_in"] += 1

            if analysis.get("should_have_penalty"):
                analysis_results["summary"]["matches_should_have_penalty"] += 1

        # ペナルティがある場合
        if analysis["user_was_penalized"]:
            analysis_results["matches_with_penalties"].append(analysis)
            analysis_results["summary"]["matches_penalized_in"] += 1

    # 5. 結果をサマリーに追加（コンソール出力はスキップ）
    analysis_results["display_summary"] = {
        "user_name": user_info.get('trainer_name', 'Unknown'),
        "discord_username": user_info.get('discord_username', 'Unknown'),
        "current_rate": user_info.get('rate', 'N/A'),
        "current_effective_penalty": user_info.get('effective_penalty', 0),
        "total_matches_played": len(match_ids),
    }

    # 6. 結果をJSONファイルに保存
    output_filename = f"prod_violation_analysis_{TARGET_USER_ID}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(analysis_results, f, indent=2, ensure_ascii=False, default=decimal_default)

    print(f"Analysis completed. Results saved to: {output_filename}")
    print(f"User: {analysis_results['display_summary']['discord_username']}")
    print(f"Total matches: {analysis_results['summary']['matches_reported_in']} with reports / {len(match_ids)} total")
    print(f"Total violation reports: {analysis_results['summary']['total_reports_received']}")
    print(f"Matches with penalties: {analysis_results['summary']['matches_penalized_in']}")
    print(f"Current effective penalty: {analysis_results['display_summary']['current_effective_penalty']}")


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
特定ユーザーの違反報告とペナルティ状況を分析するスクリプト（全試合対象・本番環境用）
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


def get_all_matches() -> List[Dict[str, Any]]:
    """全試合データを取得（READ-ONLY）"""
    print(f"Fetching all matches from {MATCHES_TABLE_NAME}...")
    table = dynamodb.Table(MATCHES_TABLE_NAME)

    items = []
    last_evaluated_key = None
    page_count = 0

    while True:
        page_count += 1
        print(f"Fetching page {page_count}...")

        if last_evaluated_key:
            response = table.scan(ExclusiveStartKey=last_evaluated_key)
        else:
            response = table.scan()

        page_items = response.get("Items", [])
        items.extend(page_items)
        print(f"Page {page_count}: {len(page_items)} matches, Total: {len(items)}")

        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break

    print(f"Total matches fetched: {len(items)}")
    return items


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
        "user_participated": False,
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
        result["user_participated"] = True
    else:
        user_role = find_user_in_team(teamB, target_user_id)
        if user_role:
            result["user_team"] = "B"
            result["user_role"] = user_role
            result["user_participated"] = True

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
                        "result": report.get("result", "unknown"),
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
    print(f"\n=== Complete Violation Report Analysis for User {TARGET_USER_ID} (PRODUCTION) ===\n")
    print("NOTE: This script operates in READ-ONLY mode. No database writes will be performed.\n")
    print("Analyzing ALL matches (including Invalid matches that don't appear in Records)\n")

    # 1. ユーザー情報を取得
    user_info = get_user_info(TARGET_USER_ID)
    print(f"User Info: {json.dumps(user_info, indent=2, default=decimal_default)}\n")

    # 2. 全試合データを取得
    all_matches = get_all_matches()

    # 3. 各試合のデータを分析
    analysis_results = {
        "user_info": user_info,
        "total_matches_in_database": len(all_matches),
        "matches_user_participated": [],
        "matches_with_reports": [],
        "matches_with_penalties": [],
        "summary": {
            "total_reports_received": 0,
            "matches_reported_in": 0,
            "matches_penalized_in": 0,
            "matches_should_have_penalty": 0,
            "matches_user_participated": 0,
            "invalid_matches_with_reports": 0,
            "valid_matches_with_reports": 0,
        }
    }

    print("Analyzing all matches...\n")

    matches_with_user = []
    matches_with_reports = []

    for i, match_data in enumerate(all_matches):
        if i % 100 == 0:
            print(f"Processing match {i+1}/{len(all_matches)}...")

        # 報告を分析
        analysis = analyze_match_reports(match_data, TARGET_USER_ID)

        # ユーザーが参加していた試合
        if analysis["user_participated"]:
            analysis_results["matches_user_participated"].append(analysis)
            matches_with_user.append(analysis)
            analysis_results["summary"]["matches_user_participated"] += 1

        # 報告がある場合
        if analysis["violation_reports_against_user"]:
            analysis_results["matches_with_reports"].append(analysis)
            matches_with_reports.append(analysis)
            analysis_results["summary"]["total_reports_received"] += len(analysis["violation_reports_against_user"])
            analysis_results["summary"]["matches_reported_in"] += 1

            # Invalid試合かどうかで分類
            if analysis["status"] == "done" and analysis["result"] == "unknown":
                # 試合結果の詳細確認
                user_reports = analysis["all_user_reports"]
                if user_reports:
                    results = [r.get("result", "") for r in user_reports if r.get("result")]
                    if "invalid" in [r.lower() for r in results]:
                        analysis_results["summary"]["invalid_matches_with_reports"] += 1
                    else:
                        analysis_results["summary"]["valid_matches_with_reports"] += 1
                else:
                    analysis_results["summary"]["invalid_matches_with_reports"] += 1
            else:
                analysis_results["summary"]["valid_matches_with_reports"] += 1

            if analysis.get("should_have_penalty"):
                analysis_results["summary"]["matches_should_have_penalty"] += 1

        # ペナルティがある場合
        if analysis["user_was_penalized"]:
            analysis_results["matches_with_penalties"].append(analysis)
            analysis_results["summary"]["matches_penalized_in"] += 1

    # 4. 結果をサマリーに保存（コンソール出力をスキップしてファイル出力のみ）
    analysis_results["display_summary"] = {
        "user_name": user_info.get('trainer_name', 'Unknown'),
        "discord_username": user_info.get('discord_username', 'Unknown'),
        "current_rate": user_info.get('rate', 'N/A'),
        "current_effective_penalty": user_info.get('effective_penalty', 0),
        "penalty_details": {
            "count": user_info.get('penalty_count', 0),
            "correction": user_info.get('penalty_correction', 0)
        },
        "database_statistics": {
            "total_matches_in_database": len(all_matches),
            "matches_user_participated": analysis_results['summary']['matches_user_participated']
        }
    }

    # 5. 結果をJSONファイルに保存
    output_filename = f"complete_violation_analysis_{TARGET_USER_ID}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(analysis_results, f, indent=2, ensure_ascii=False, default=decimal_default)

    print(f"Complete analysis saved to: {output_filename}")
    print(f"Analysis completed for user: {user_info.get('discord_username', 'Unknown')}")
    print(f"Total matches analyzed: {len(all_matches)}")
    print(f"User participated in: {analysis_results['summary']['matches_user_participated']} matches")
    print(f"Violation reports received: {analysis_results['summary']['total_reports_received']} across {analysis_results['summary']['matches_reported_in']} matches")
    print(f"Current effective penalty: {user_info.get('effective_penalty', 0)}")
    print(f"Matches meeting penalty threshold: {analysis_results['summary']['matches_should_have_penalty']}")
    print(f"Actual penalties applied: {analysis_results['summary']['matches_penalized_in']}")


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
特定ユーザーの違反報告とペナルティ状況を分析するスクリプト
"""

import json
import os
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List

import boto3
from dotenv import load_dotenv

# 環境変数の読み込み
load_dotenv(".env.dev")  # または .env.prod を使用

# DynamoDB設定
dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")

# テーブル名（環境に応じて変更してください）
STAGE = "dev"  # または "prod"
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


def get_all_matches() -> List[Dict[str, Any]]:
    """全試合データを取得"""
    print(f"Fetching all matches from {MATCHES_TABLE_NAME}...")
    table = dynamodb.Table(MATCHES_TABLE_NAME)

    items = []
    last_evaluated_key = None

    while True:
        if last_evaluated_key:
            response = table.scan(ExclusiveStartKey=last_evaluated_key)
        else:
            response = table.scan()

        items.extend(response.get("Items", []))

        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break

    print(f"Total matches fetched: {len(items)}")
    return items


def analyze_violations(matches: List[Dict[str, Any]]) -> Dict[str, Any]:
    """違反報告とペナルティを分析"""

    # 結果を格納する辞書
    results = {
        "target_user_id": TARGET_USER_ID,
        "total_matches_analyzed": len(matches),
        "matches_with_reports": [],
        "matches_with_penalties": [],
        "report_summary": {
            "total_reports_against_user": 0,
            "total_matches_reported": 0,
            "reports_by_match": {},
        },
        "penalty_summary": {
            "total_penalties": 0,
            "penalties_by_match": {},
        },
    }

    for match in matches:
        match_id = match.get("match_id", "unknown")
        violation_reports = match.get("violationReports", {})
        penalty_players = match.get("penalty_players", [])
        match_status = match.get("status", "unknown")
        matched_unixtime = match.get("matched_unixtime", 0)

        # 日時を人間が読める形式に変換
        if matched_unixtime:
            # DecimalをFloatに変換
            timestamp = float(matched_unixtime) if isinstance(matched_unixtime, Decimal) else matched_unixtime
            match_date = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")
        else:
            match_date = "unknown"

        # チームメンバーの情報を取得
        team_a = match.get("teamA", [])
        team_b = match.get("teamB", [])

        # ユーザーがどちらのチームにいたか確認
        user_team = None
        for member in team_a:
            if member.get("player", {}).get("id") == TARGET_USER_ID:
                user_team = "A"
                break
        if not user_team:
            for member in team_b:
                if member.get("player", {}).get("id") == TARGET_USER_ID:
                    user_team = "B"
                    break

        # 違反報告の分析
        if TARGET_USER_ID in violation_reports:
            reports = violation_reports[TARGET_USER_ID]
            report_count = len(reports) if isinstance(reports, list) else 0

            # 同じチームからの報告と全体の報告を分離
            same_team_reports = []
            other_team_reports = []

            if isinstance(reports, list) and user_team:
                for reporter_id in reports:
                    reporter_team = None
                    for member in team_a:
                        if member.get("player", {}).get("id") == reporter_id:
                            reporter_team = "A"
                            break
                    if not reporter_team:
                        for member in team_b:
                            if member.get("player", {}).get("id") == reporter_id:
                                reporter_team = "B"
                                break

                    if reporter_team == user_team:
                        same_team_reports.append(reporter_id)
                    else:
                        other_team_reports.append(reporter_id)

            match_info = {
                "match_id": match_id,
                "date": match_date,
                "status": match_status,
                "user_team": user_team,
                "report_count": report_count,
                "reporters": reports if isinstance(reports, list) else [],
                "same_team_reports": len(same_team_reports),
                "other_team_reports": len(other_team_reports),
                "same_team_reporters": same_team_reports,
                "other_team_reporters": other_team_reports,
            }

            results["matches_with_reports"].append(match_info)
            results["report_summary"]["total_reports_against_user"] += report_count
            results["report_summary"]["total_matches_reported"] += 1
            results["report_summary"]["reports_by_match"][str(match_id)] = {
                "count": report_count,
                "date": match_date,
                "same_team": len(same_team_reports),
                "other_team": len(other_team_reports),
            }

        # ペナルティの分析
        if penalty_players and TARGET_USER_ID in penalty_players:
            penalty_info = {
                "match_id": match_id,
                "date": match_date,
                "status": match_status,
                "user_team": user_team,
                "all_penalized_players": penalty_players,
                "violation_reports_in_match": violation_reports,
            }

            # この試合での通報数を確認
            if TARGET_USER_ID in violation_reports:
                reports = violation_reports[TARGET_USER_ID]
                penalty_info["reports_against_user"] = len(reports) if isinstance(reports, list) else 0
            else:
                penalty_info["reports_against_user"] = 0

            results["matches_with_penalties"].append(penalty_info)
            results["penalty_summary"]["total_penalties"] += 1
            results["penalty_summary"]["penalties_by_match"][str(match_id)] = {
                "date": match_date,
                "reports": penalty_info["reports_against_user"],
            }

    # 統計情報を追加
    if results["report_summary"]["total_matches_reported"] > 0:
        results["report_summary"]["average_reports_per_match"] = (
            results["report_summary"]["total_reports_against_user"] /
            results["report_summary"]["total_matches_reported"]
        )

    # ペナルティ発動の分析
    penalty_triggered_matches = []
    for match_info in results["matches_with_reports"]:
        # ペナルティ条件: 同チーム4人以上 または 全体6人以上
        if match_info["same_team_reports"] >= 4 or match_info["report_count"] >= 6:
            penalty_triggered_matches.append({
                "match_id": match_info["match_id"],
                "date": match_info["date"],
                "total_reports": match_info["report_count"],
                "same_team_reports": match_info["same_team_reports"],
                "should_trigger_penalty": True,
                "actual_penalty": match_info["match_id"] in [m["match_id"] for m in results["matches_with_penalties"]],
            })

    results["penalty_analysis"] = {
        "matches_meeting_penalty_threshold": penalty_triggered_matches,
        "threshold_info": "Penalty triggers when: same_team >= 4 OR total >= 6",
    }

    return results


def get_user_info(user_id: str) -> Dict[str, Any]:
    """ユーザー情報を取得"""
    try:
        table = dynamodb.Table(USERS_TABLE_NAME)
        response = table.get_item(
            Key={
                "namespace": "default",
                "user_id": user_id,
            }
        )
        if "Item" in response:
            user = response["Item"]
            return {
                "user_id": user_id,
                "trainer_name": user.get("trainer_name", "unknown"),
                "discord_username": user.get("discord_username", "unknown"),
                "effective_penalty": user.get("effective_penalty", 0),
                "rate": user.get("rate", 1500),
            }
    except Exception as e:
        print(f"Error fetching user info: {e}")

    return {"user_id": user_id, "error": "User not found"}


def main():
    """メイン処理"""
    print(f"\n=== Violation Report Analysis for User {TARGET_USER_ID} ===\n")

    # ユーザー情報を取得
    user_info = get_user_info(TARGET_USER_ID)
    print(f"User Info: {json.dumps(user_info, indent=2)}\n")

    # 全試合データを取得
    matches = get_all_matches()

    # 違反報告とペナルティを分析
    results = analyze_violations(matches)

    # 結果を表示
    print("\n=== Analysis Results ===\n")
    print(f"Total matches analyzed: {results['total_matches_analyzed']}")
    print(f"Matches where user was reported: {results['report_summary']['total_matches_reported']}")
    print(f"Total reports against user: {results['report_summary']['total_reports_against_user']}")
    print(f"Matches where user received penalty: {results['penalty_summary']['total_penalties']}")

    if results['report_summary']['total_matches_reported'] > 0:
        print(f"Average reports per match: {results['report_summary'].get('average_reports_per_match', 0):.2f}")

    print(f"\n=== Matches Meeting Penalty Threshold ===")
    print(f"(Penalty triggers when: same_team >= 4 OR total >= 6)\n")

    for match in results["penalty_analysis"]["matches_meeting_penalty_threshold"]:
        status = "✓ Penalty Applied" if match["actual_penalty"] else "✗ No Penalty"
        print(f"Match {match['match_id']} ({match['date']})")
        print(f"  Reports: Total={match['total_reports']}, Same Team={match['same_team_reports']}")
        print(f"  Status: {status}\n")

    print(f"\n=== Detailed Report by Match ===\n")

    for match in sorted(results["matches_with_reports"], key=lambda x: x["date"], reverse=True):
        print(f"Match ID: {match['match_id']}")
        print(f"  Date: {match['date']}")
        print(f"  Status: {match['status']}")
        print(f"  User Team: {match['user_team']}")
        print(f"  Total Reports: {match['report_count']}")
        print(f"  Same Team Reports: {match['same_team_reports']}")
        print(f"  Other Team Reports: {match['other_team_reports']}")

        # ペナルティチェック
        if match['match_id'] in [m['match_id'] for m in results['matches_with_penalties']]:
            print(f"  ** PENALTY APPLIED **")
        elif match['same_team_reports'] >= 4 or match['report_count'] >= 6:
            print(f"  ** SHOULD HAVE PENALTY (threshold met) **")

        print()

    # 結果をJSONファイルに保存
    output_filename = f"violation_analysis_{TARGET_USER_ID}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    # user_infoを結果に追加
    results["user_info"] = user_info

    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=decimal_default)

    print(f"\nFull analysis saved to: {output_filename}")

    # 全試合データも保存（オプション）
    all_matches_filename = f"all_matches_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(all_matches_filename, "w", encoding="utf-8") as f:
        json.dump(matches, f, indent=2, ensure_ascii=False, default=decimal_default)

    print(f"All matches data saved to: {all_matches_filename}")


if __name__ == "__main__":
    main()
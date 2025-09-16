#!/usr/bin/env python3
"""
不正な試合結果を特定・修正するスクリプト

invalidカウントのバグにより、本来Invalidになるべき試合が
誤ってA-winまたはB-winと判定された試合を特定します。

使用方法:
1. python fix_invalid_matches.py export - 全マッチデータをCSVエクスポート
2. python fix_invalid_matches.py analyze - 問題のある試合を特定
3. python fix_invalid_matches.py fix - 試合結果を修正
"""

import boto3
import csv
import json
import sys
from datetime import datetime
from typing import List, Dict, Any
import os

# DynamoDBクライアント
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
matches_table = dynamodb.Table('unitemate-v2-matches-prod')

def get_correct_result(reports: List[str]) -> str:
    """
    正しいロジックで試合結果を判定
    
    Args:
        reports: 結果報告リスト ["A-win", "B-win", "invalid", ...]
    
    Returns:
        "A-win", "B-win", or "Invalid"
    """
    a_count = reports.count("A-win")
    b_count = reports.count("B-win")
    i_count = reports.count("invalid")  # 小文字のinvalidをカウント
    
    # 1) "A-win" が "B-win"+"invalid" を上回るか？
    if a_count > b_count + i_count:
        return "A-win"
    
    # 2) "B-win" が "A-win"+"invalid" を上回るか？
    if b_count > a_count + i_count:
        return "B-win"
    
    # 3) いずれも過半数に達しない場合はInvalid
    return "Invalid"

def get_old_incorrect_result(reports: List[str]) -> str:
    """
    バグのあった古いロジックで試合結果を判定
    
    Args:
        reports: 結果報告リスト ["A-win", "B-win", "invalid", ...]
    
    Returns:
        "A-win", "B-win", or "Invalid"
    """
    a_count = reports.count("A-win")
    b_count = reports.count("B-win")
    i_count = reports.count("Invalid")  # 大文字のInvalidをカウント（バグ）
    
    # 1) "A-win" が "B-win"+"Invalid" を上回るか？
    if a_count > b_count + i_count:
        return "A-win"
    
    # 2) "B-win" が "A-win"+"Invalid" を上回るか？
    if b_count > a_count + i_count:
        return "B-win"
    
    # 3) いずれも過半数に達しない場合はInvalid
    return "Invalid"

def export_all_matches():
    """Export all match data to JSON"""
    print("Exporting all match data...")
    
    matches = []
    
    # Scan all matches
    response = matches_table.scan()
    matches.extend(response['Items'])
    
    while 'LastEvaluatedKey' in response:
        response = matches_table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        matches.extend(response['Items'])
    
    print(f"Total matches retrieved: {len(matches)}")
    
    # JSONに出力
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"export_matches_{timestamp}.json"
    
    with open(filename, 'w', encoding='utf-8') as jsonfile:
        json.dump(matches, jsonfile, ensure_ascii=False, indent=2, default=str)
    
    print(f"JSON file created: {filename}")
    return filename

def analyze_matches():
    """Analyze problematic matches from JSON data"""
    print("Analyzing problematic matches...")
    
    # 最新のエクスポートファイルを探す
    import glob
    json_files = glob.glob("export_matches_*.json")
    if not json_files:
        print("Export file not found. Please run 'export' first.")
        return
    
    latest_file = max(json_files)
    print(f"Analyzing file: {latest_file}")
    
    with open(latest_file, 'r', encoding='utf-8') as jsonfile:
        matches = json.load(jsonfile)
    
    affected_matches = []
    total_matches = len(matches)
    
    for match in matches:
        # 完了状態でfinal_resultがある試合のみ対象
        if match.get('status') not in ['FINISHED', 'done'] or not match.get('final_result'):
            continue
            
        # user_reportsデータを解析
        user_reports = match.get('user_reports', [])
        if not user_reports:
            continue
            
        reports_list = [report.get('result', '') for report in user_reports]
        
        # 正しいロジックとバグのあった古いロジックで再計算
        correct_result = get_correct_result(reports_list)
        old_incorrect_result = get_old_incorrect_result(reports_list)
        
        # バグのあった古いロジックの結果と正しいロジックの結果が異なる場合
        if old_incorrect_result != correct_result:
            match_data = match.copy()
            match_data['correct_result_recalc'] = correct_result
            match_data['old_incorrect_result_recalc'] = old_incorrect_result
            affected_matches.append(match_data)
            print(f"Affected match: {match.get('match_id')}")
            print(f"  Current DB result: {match.get('final_result')}")
            print(f"  Old buggy logic: {old_incorrect_result}")
            print(f"  Correct logic: {correct_result}")
            print(f"  Reports: {reports_list}")
            print()
    
    print(f"\n=== Analysis Results ===")
    print(f"Total matches analyzed: {total_matches}")
    print(f"Affected matches count: {len(affected_matches)}")
    
    if affected_matches:
        print("\nDetails of affected matches:")
        
        # 結果の分布を表示
        result_changes = {}
        for match in affected_matches:
            change = f"{match['old_incorrect_result_recalc']} → {match['correct_result_recalc']}"
            result_changes[change] = result_changes.get(change, 0) + 1
        
        print("Distribution of result changes:")
        for change, count in result_changes.items():
            clean_change = change.replace('→', '->')
            print(f"  {clean_change}: {count} matches")
    
    # 誤報告者の詳細を表示
    if affected_matches:
        print(f"\n=== Incorrect Reporters ===")
        
        # 影響を受けた試合のIDリスト (Match 128は正しく判定されているので除外)
        incorrect_matches = [m for m in affected_matches if m.get('match_id') not in ['128']]
        
        for match_data in incorrect_matches:
            match_id = match_data.get('match_id')
            final_result = match_data.get('final_result')
            print(f"\nMatch {match_id} ({final_result} -> Should be Invalid)")
            
            user_reports = match_data.get('user_reports', [])
            team_a = match_data.get('team_a', [])
            team_b = match_data.get('team_b', [])
            
            # 全プレイヤーの情報を集める
            all_players = {}
            for player in team_a + team_b:
                user_id = player.get('user_id')
                if user_id:
                    all_players[user_id] = {
                        'trainer_name': player.get('trainer_name', ''),
                        'discord_username': player.get('discord_username', ''),
                        'team': 'A' if player in team_a else 'B'
                    }
            
            # 各報告を確認
            incorrect_reporters = []
            for report in user_reports:
                result = report.get('result', '')
                reporter_id = report.get('user_id', '')
                
                # invalidでない報告をした人を特定
                if result != 'invalid' and reporter_id in all_players:
                    player_info = all_players[reporter_id]
                    incorrect_reporters.append({
                        'user_id': reporter_id,
                        'trainer_name': player_info['trainer_name'],
                        'discord_username': player_info['discord_username'],
                        'team': player_info['team'],
                        'reported_result': result
                    })
            
            if incorrect_reporters:
                for reporter in incorrect_reporters:
                    print(f"  - {reporter['trainer_name']} (@{reporter['discord_username']}) [Team {reporter['team']}] -> {reporter['reported_result']}")
            else:
                print("  - Failed to identify incorrect reporters")
    
    return affected_matches

# def fix_matches(dry_run=True):
#     """試合結果を修正"""
#     # SAFETY: この機能は意図的にコメントアウトされています。
#     # 試合結果の修正には、該当Recordの削除、ユーザーレートの変更など
#     # 複雑な処理が必要なため、別途慎重に実装する必要があります。
#     
#     print("ERROR: 修正機能は安全のため無効化されています。")
#     print("試合結果の修正は複雑な処理が必要なため、別途実装してください。")
#     print("- 該当Recordの削除")
#     print("- ユーザーレートの再計算")
#     print("- 統計データの更新")
#     return

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'export':
        export_all_matches()
    elif command == 'analyze':
        analyze_matches()
    elif command == 'fix':
        print("ERROR: 修正機能は安全のため無効化されています。")
        print("試合結果の修正は複雑な処理が必要なため、別途実装してください。")
        print("- 該当Recordの削除")
        print("- ユーザーレートの再計算") 
        print("- 統計データの更新")
    else:
        print("Invalid command. Please specify one of: export, analyze, fix")
        sys.exit(1)

if __name__ == '__main__':
    main()
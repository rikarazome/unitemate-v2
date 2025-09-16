#!/usr/bin/env python3

import json

# 影響を受けた試合ID一覧
affected_matches = ['39', '159', '180', '186', '276', '284', '318', '372']

# Load the JSON file
with open('export_matches_20250913_095215.json', 'r', encoding='utf-8') as f:
    matches = json.load(f)

print("=== Incorrect Reporters List ===\n")

for match in matches:
    match_id = match.get('match_id')
    if match_id in affected_matches:
        final_result = match.get('final_result')
        print(f"Match {match_id} ({final_result} -> Should be Invalid)")
        
        user_reports = match.get('user_reports', [])
        team_a = match.get('team_a', [])
        team_b = match.get('team_b', [])
        
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
                    'trainer_name': player_info['trainer_name'],
                    'discord_username': player_info['discord_username'],
                    'team': player_info['team'],
                    'reported_result': result
                })
        
        if incorrect_reporters:
            for reporter in incorrect_reporters:
                # ASCII文字のみで出力
                trainer_name = reporter['trainer_name'].encode('ascii', 'replace').decode('ascii')
                discord_username = reporter['discord_username'].encode('ascii', 'replace').decode('ascii')
                print(f"  - {trainer_name} (@{discord_username}) [Team {reporter['team']}] -> {reporter['reported_result']}")
        else:
            print("  - No incorrect reporters found")
        
        print()
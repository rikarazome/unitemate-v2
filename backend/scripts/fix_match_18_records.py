"""Script to manually create Records for Match ID 18."""

import boto3
from datetime import datetime

# DynamoDB設定
dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")
matches_table = dynamodb.Table("unitemate-v2-matches-dev")
records_table = dynamodb.Table("unitemate-v2-records-dev")
users_table = dynamodb.Table("unitemate-v2-users-dev")

def create_records_for_match_18():
    """Match ID 18のRecordを手動作成"""
    
    # Match ID 18のデータを取得
    match_response = matches_table.get_item(
        Key={"namespace": "default", "match_id": 18}
    )
    
    if "Item" not in match_response:
        print("Match ID 18 not found")
        return
    
    match_data = match_response["Item"]
    print(f"Match status: {match_data['status']}")
    print(f"Final result: {match_data['final_result']}")
    
    # 試合結果
    is_a_win = match_data["final_result"] == "A-win"
    
    # 各チームのプレイヤー
    team_a_players = match_data["team_a"]
    team_b_players = match_data["team_b"]
    
    # 試合時刻
    started_date = int(match_data["matched_unixtime"])
    
    # 各プレイヤーのRecordを作成
    for player in team_a_players:
        user_id = player["user_id"]
        rate_before = player["rate"]
        
        # レート変動計算（簡易版）
        if is_a_win:
            rate_delta = 16  # 勝利時の基本レート変動
        else:
            rate_delta = -16  # 敗北時の基本レート変動
        
        # Recordを作成
        record_data = {
            "user_id": user_id,
            "match_id": 18,
            "pokemon": "null",  # ポケモンデータは後で報告から補完される
            "rate_delta": rate_delta,
            "started_date": started_date,
            "winlose": 1 if is_a_win else 0,
        }
        
        try:
            records_table.put_item(Item=record_data)
            print(f"Created record for Team A player {user_id}")
        except Exception as e:
            print(f"Error creating record for {user_id}: {e}")
    
    for player in team_b_players:
        user_id = player["user_id"]
        rate_before = player["rate"]
        
        # レート変動計算（簡易版）
        if not is_a_win:  # Team Bが勝利
            rate_delta = 16
        else:
            rate_delta = -16
        
        # Recordを作成
        record_data = {
            "user_id": user_id,
            "match_id": 18,
            "pokemon": "null",
            "rate_delta": rate_delta,
            "started_date": started_date,
            "winlose": 0 if is_a_win else 1,
        }
        
        try:
            records_table.put_item(Item=record_data)
            print(f"Created record for Team B player {user_id}")
        except Exception as e:
            print(f"Error creating record for {user_id}: {e}")
    
    print("\nRecords creation completed for Match ID 18")
    
    # ユーザーの統計も更新
    print("\nUpdating user statistics...")
    for player in team_a_players + team_b_players:
        user_id = player["user_id"]
        
        # ユーザーデータを取得
        user_response = users_table.get_item(
            Key={"namespace": "default", "user_id": user_id}
        )
        
        if "Item" in user_response:
            user_data = user_response["Item"]
            
            # 勝敗を判定
            if user_id in [p["user_id"] for p in team_a_players]:
                is_winner = is_a_win
                rate_delta = 16 if is_a_win else -16
            else:
                is_winner = not is_a_win
                rate_delta = 16 if not is_a_win else -16
            
            # 統計を更新
            new_rate = int(user_data.get("rate", 1500)) + rate_delta
            new_match_count = int(user_data.get("match_count", 0)) + 1
            new_win_count = int(user_data.get("win_count", 0)) + (1 if is_winner else 0)
            new_win_rate = round((new_win_count / new_match_count) * 100, 1) if new_match_count > 0 else 0.0
            new_max_rate = max(new_rate, int(user_data.get("max_rate", 1500)))
            
            # ユーザーテーブルを更新
            users_table.update_item(
                Key={"namespace": "default", "user_id": user_id},
                UpdateExpression="SET rate = :r, match_count = :mc, win_count = :wc, win_rate = :wr, max_rate = :mr, updated_at = :ua",
                ExpressionAttributeValues={
                    ":r": new_rate,
                    ":mc": new_match_count,
                    ":wc": new_win_count,
                    ":wr": new_win_rate,
                    ":mr": new_max_rate,
                    ":ua": int(datetime.now().timestamp()),
                }
            )
            print(f"Updated stats for {user_id}: rate {new_rate}, matches {new_match_count}, wins {new_win_count}, win_rate {new_win_rate}%")

if __name__ == "__main__":
    create_records_for_match_18()
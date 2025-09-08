#!/usr/bin/env python3
"""
DynamoDBの試合データとメタ情報を調査するスクリプト
"""
import boto3
import json
from decimal import Decimal
from datetime import datetime
import sys

# DynamoDBクライアントを初期化
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')

# テーブル名
MATCHES_TABLE = 'unitemate-v2-matches-dev'
QUEUE_TABLE = 'unitemate-v2-queue-dev'

def decimal_to_int(obj):
    """Decimal型をintに変換"""
    if isinstance(obj, Decimal):
        return int(obj)
    raise TypeError

def investigate_matches():
    """Investigate Matches table"""
    print("=== Matches Table Investigation ===")
    
    table = dynamodb.Table(MATCHES_TABLE)
    
    try:
        # Get all match data
        response = table.scan()
        items = response['Items']
        
        print(f"Total matches: {len(items)}")
        
        if not items:
            print("No match data found.")
            return
        
        # Check match ID=1 data
        match_1_data = [item for item in items if item.get('match_id') == 1]
        
        print(f"\nMatch ID=1 data count: {len(match_1_data)}")
        
        for i, match in enumerate(match_1_data):
            print(f"\n--- Match ID=1 Data {i+1} ---")
            print(f"namespace: {match.get('namespace')}")
            print(f"match_id: {match.get('match_id')}")
            print(f"status: {match.get('status')}")
            print(f"matched_unixtime: {match.get('matched_unixtime')}")
            print(f"created_unixtime: {match.get('created_unixtime')}")
            
            # Convert Unix time to readable format
            if match.get('matched_unixtime'):
                matched_time = datetime.fromtimestamp(int(match['matched_unixtime']))
                print(f"matched_time (readable): {matched_time}")
            
            if match.get('created_unixtime'):
                created_time = datetime.fromtimestamp(int(match['created_unixtime']))
                print(f"created_time (readable): {created_time}")
            
            # user_reports details
            user_reports = match.get('user_reports', [])
            print(f"user_reports count: {len(user_reports)}")
            
            if user_reports:
                print("user_reports details:")
                for j, report in enumerate(user_reports):
                    print(f"  Report {j+1}:")
                    print(f"    user_id: {report.get('user_id')}")
                    print(f"    result: {report.get('result')}")
                    print(f"    pokemon: {report.get('pokemon', 'N/A')}")
        
        # Summary of all matches
        print(f"\n=== All Matches Summary ===")
        for match in items:
            print(f"Match ID: {match.get('match_id')}, Status: {match.get('status')}, Reports: {len(match.get('user_reports', []))}")
        
    except Exception as e:
        print(f"Matches table investigation error: {e}")

def investigate_queue_meta():
    """Investigate Queue table META data"""
    print("\n=== Queue Table META Data Investigation ===")
    
    table = dynamodb.Table(QUEUE_TABLE)
    
    try:
        # Get META data - try both possible keys
        response1 = table.get_item(
            Key={
                'namespace': 'unitemate',
                'user_id': 'META'
            }
        )
        
        response2 = table.get_item(
            Key={
                'namespace': 'default',
                'user_id': '#META#'
            }
        )
        
        meta_data = None
        if 'Item' in response1:
            meta_data = response1['Item']
            print("META data found (unitemate/META):")
        elif 'Item' in response2:
            meta_data = response2['Item']
            print("META data found (default/#META#):")
        
        if meta_data:
            print(json.dumps(meta_data, indent=2, default=decimal_to_int, ensure_ascii=False))
            
            # Extract important items
            ongoing_match_ids = meta_data.get('ongoing_match_ids', [])
            latest_match_id = meta_data.get('latest_match_id')
            
            print(f"\nongoing_match_ids: {ongoing_match_ids}")
            print(f"latest_match_id: {latest_match_id}")
            
        else:
            print("META data not found.")
        
        # Check all queue data
        print(f"\n=== All Queue Data ===")
        response = table.scan()
        items = response['Items']
        print(f"Total queue items: {len(items)}")
        
        for item in items:
            print(f"namespace: {item.get('namespace')}, user_id: {item.get('user_id')}")
    
    except Exception as e:
        print(f"Queue table investigation error: {e}")

def main():
    """Main function"""
    print("Starting DynamoDB data investigation...")
    
    investigate_matches()
    investigate_queue_meta()
    
    print("\n=== Investigation Complete ===")

if __name__ == "__main__":
    main()
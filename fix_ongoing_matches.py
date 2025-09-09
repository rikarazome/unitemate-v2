#!/usr/bin/env python3
"""
ongoing_match_idsに試合ID=1を追加するスクリプト
"""
import boto3
import os

def main():
    # DynamoDB接続
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('unitemate-v2-queue-dev')
    
    try:
        # 現在のMETAデータを確認
        response = table.get_item(Key={'namespace': 'default', 'user_id': '#META#'})
        if 'Item' in response:
            current_ongoing = response['Item'].get('ongoing_match_ids', [])
            print(f"Current ongoing_match_ids: {current_ongoing}")
            
            # ongoing_match_idsに試合ID=1を追加
            if 1 not in current_ongoing:
                new_ongoing = current_ongoing + [1]
                table.update_item(
                    Key={'namespace': 'default', 'user_id': '#META#'},
                    UpdateExpression='SET ongoing_match_ids = :ids',
                    ExpressionAttributeValues={':ids': new_ongoing}
                )
                print(f"✅ Added match ID 1 to ongoing_match_ids: {new_ongoing}")
            else:
                print("Match ID 1 is already in ongoing_match_ids")
        else:
            print("META data not found")
    
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
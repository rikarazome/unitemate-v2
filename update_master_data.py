#!/usr/bin/env python3
import json
import os

def update_master_data_badges():
    """master-data-seed.jsonの勲章データに価格と販売数を追加する"""
    master_data_path = os.path.join('backend', 'migrations', 'master-data-seed.json')
    
    try:
        # master-data-seed.jsonを読み込み
        with open(master_data_path, 'r', encoding='utf-8') as f:
            master_data = json.load(f)
        
        updated_count = 0
        
        # マスターデータの各アイテムを処理
        for item in master_data:
            # data_typeがBADGEの場合のみ処理
            if item.get('data_type') == 'BADGE':
                badge_id = item.get('id', '')
                display = item.get('display', '')
                
                # 価格と販売数の項目を追加（既存の場合はスキップ）
                if 'price' not in item:
                    # 価格設定ロジック
                    if any(x in display for x in ['[S1]1st', '[S1]2nd', '[S1]3rd']) or \
                       any(x in display for x in ['1st[ポケアリS1]', '2nd[ポケアリS1]', '3rd[ポケアリS1]']):
                        item['price'] = 0  # 上位勲章は無料
                    else:
                        item['price'] = 100  # 通常勲章は100コイン
                    updated_count += 1
                
                if 'max_sales' not in item:
                    item['max_sales'] = 0  # デフォルトは無制限
                    updated_count += 1
                
                if 'current_sales' not in item:
                    item['current_sales'] = 0  # 初期販売数は0
                    updated_count += 1
                
                # typeフィールドも追加（存在しない場合）
                if 'type' not in item:
                    if item.get('image_card'):
                        item['type'] = 'image'
                    elif item.get('start_color') and item.get('end_color'):
                        item['type'] = 'gradient'
                    else:
                        item['type'] = 'basic'
                    updated_count += 1
        
        # master-data-seed.jsonを更新
        with open(master_data_path, 'w', encoding='utf-8') as f:
            json.dump(master_data, f, ensure_ascii=False, indent=2)
        
        badge_count = len([item for item in master_data if item.get('data_type') == 'BADGE'])
        free_badges = len([item for item in master_data if item.get('data_type') == 'BADGE' and item.get('price') == 0])
        paid_badges = len([item for item in master_data if item.get('data_type') == 'BADGE' and item.get('price', 0) > 0])
        
        print(f"Successfully updated master-data-seed.json")
        print(f"- Badge items processed: {badge_count}")
        print(f"- Fields updated: {updated_count}")
        print(f"- Free badges: {free_badges}")
        print(f"- Paid badges: {paid_badges}")
        
    except FileNotFoundError:
        print(f"Error: master-data-seed.json not found at {master_data_path}")
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in master-data-seed.json: {e}")
    except Exception as e:
        print(f"Error updating master-data-seed.json: {e}")

if __name__ == '__main__':
    update_master_data_badges()
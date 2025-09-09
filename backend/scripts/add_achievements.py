#!/usr/bin/env python
"""
Add new achievements workflow automation script
新しいアチーブメントの追加を自動化するスクリプト
"""

import argparse
import subprocess
import sys
import os
from pathlib import Path


def run_command(command, description):
    """コマンドを実行し、結果を表示"""
    print(f"\n{description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✓ {description} 完了")
        if result.stdout.strip():
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ {description} 失敗")
        if e.stdout:
            print("STDOUT:", e.stdout)
        if e.stderr:
            print("STDERR:", e.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description="新しいアチーブメント追加の自動化スクリプト")
    parser.add_argument("--stage", default="dev", help="デプロイステージ (dev, prd, etc.)")
    parser.add_argument("--prod", action="store_true", help="本番環境にも反映する")
    parser.add_argument("--dry-run", action="store_true", help="実際の更新は行わず、手順のみ表示")
    parser.add_argument("--master-only", action="store_true", help="METAデータを変更せずマスターデータのみ更新")

    args = parser.parse_args()

    print("=" * 60)
    print("Unitemate V2 - アチーブメント追加自動化スクリプト")
    print(f"ステージ: {args.stage}")
    if args.prod:
        print("本番環境への反映: 有効")
    if args.master_only:
        print("マスターデータのみ更新: 有効（METAデータは変更しません）")
    if args.dry_run:
        print("DRY RUN モード（実際の更新は行いません）")
    print("=" * 60)

    # プロジェクトルートディレクトリの確認
    project_root = Path(__file__).parent.parent
    os.chdir(project_root)

    print(f"\n作業ディレクトリ: {project_root}")

    # achievements.csvの存在確認
    achievements_csv = project_root.parent / "achievements.csv"
    if not achievements_csv.exists():
        print(f"✗ achievements.csvが見つかりません: {achievements_csv}")
        sys.exit(1)

    print(f"✓ achievements.csv確認: {achievements_csv}")

    if args.dry_run:
        print("\n【DRY RUN】以下の手順が実行されます:")
        print("1. achievements.csvからmaster-data-seed.jsonを生成")
        if args.master_only:
            print(f"2. {args.stage}環境のマスターデータのみを更新（METAデータは変更せず）")
            if args.prod:
                print("3. 本番環境のマスターデータのみを更新")
        else:
            print(f"2. {args.stage}環境のマスターデータを更新（METAデータも初期化）")
            if args.prod:
                print("3. 本番環境のマスターデータを更新（METAデータも初期化）")
        print("4. 更新結果の確認")
        return

    print("\n手順1: master-data-seed.json生成")
    scripts_dir = project_root / "scripts"
    if not run_command(
        f"cd {scripts_dir} && python convert_achievements.py", "achievements.csvからmaster-data-seed.json生成"
    ):
        sys.exit(1)

    print(f"\n手順2: {args.stage}環境マスターデータ更新")
    if args.master_only:
        if not run_command(
            f"cd {project_root} && python scripts/update_master_data.py --stage {args.stage} --yes",
            f"{args.stage}環境マスターデータ更新（METAデータは変更せず）",
        ):
            sys.exit(1)
    else:
        if not run_command(
            f"cd {project_root} && python scripts/initialize_data.py --stage {args.stage} --yes",
            f"{args.stage}環境マスターデータ更新",
        ):
            sys.exit(1)

    if args.prod:
        print("\n手順3: 本番環境マスターデータ更新")
        confirm = input("本番環境に反映しますか？ (y/N): ")
        if confirm.lower() == "y":
            if args.master_only:
                if not run_command(
                    f"cd {project_root} && python scripts/update_master_data.py --stage prd --yes",
                    "本番環境マスターデータ更新（METAデータは変更せず）",
                ):
                    sys.exit(1)
            else:
                if not run_command(
                    f"cd {project_root} && python scripts/initialize_data.py --stage prd --yes",
                    "本番環境マスターデータ更新",
                ):
                    sys.exit(1)
        else:
            print("本番環境への反映をスキップしました")

    print("\n" + "=" * 60)
    print("✓ アチーブメント追加処理が完了しました！")
    print("=" * 60)
    print("\n次の確認を行ってください:")
    print("- DynamoDBのマスターデータテーブルでBADGE項目数を確認")
    print("- フロントエンドでバッジが正常に表示されることを確認")
    print("- 必要に応じてバッジ取得条件のロジックを実装")


if __name__ == "__main__":
    main()

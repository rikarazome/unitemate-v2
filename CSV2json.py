#!/usr/bin/env python
# csv_to_json.py
#
# 使い方:
#   python csv_to_json.py input.csv [output.json]
#   └─ output.json を省略すると input.csv ➜ input.json という名前で保存されます。

import csv
import json
import pathlib
import sys


def csv_to_json(csv_path: str, json_path: str | None = None, *, encoding: str = "utf-8") -> None:
    """CSV を JSON (配列-オブジェクト形式) に変換して保存する。"""
    csv_path = pathlib.Path(csv_path)
    json_path = pathlib.Path(json_path) if json_path else csv_path.with_suffix(".json")

    # CSV → list[dict]
    with csv_path.open(newline="", encoding=encoding) as f:
        reader = csv.DictReader(f)  # 1 行目がヘッダーになっている前提
        data = list(reader)

    # JSON として書き出し
    with json_path.open("w", encoding=encoding) as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(data)} records -> {json_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        script = pathlib.Path(sys.argv[0]).name
        print(f"Usage:  python {script} input.csv [output.json]")
        sys.exit(1)

    csv_to_json(*sys.argv[1:])

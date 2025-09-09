#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, 'backend/src')
os.environ['DUMMY_JWT_SECRET'] = 'dummy-secret-for-testing-only'

from handlers.dummy_auth import validate_dummy_token

# 実際のダミートークンを貼り付けてテスト
# フロントエンドのログから取得したトークンを使用
test_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # ここに実際のトークンを貼り付ける

result = validate_dummy_token(test_token)
print(f"Validation result: {result}")
#!/usr/bin/env python3

# Test hash generation for dummy users
for i in range(1, 11):
    dummy_id = f'dummy_user_{i}'
    discord_id = str(abs(hash(dummy_id)) % 1000000000000000000)
    print(f'{dummy_id} -> {discord_id}')
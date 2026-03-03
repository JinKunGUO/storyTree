#!/usr/bin/env python3
import subprocess
import sys

# Add all files
subprocess.run(['git', 'add', '-A'], check=True)

# Read commit message
with open('.git-commit-msg-email.txt', 'r', encoding='utf-8') as f:
    msg = f.read()

# Commit
result = subprocess.run(['git', 'commit', '-m', msg], capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print(result.stderr, file=sys.stderr)

# Show commit info
if result.returncode == 0:
    print("\n✅ Commit successful!")
    subprocess.run(['git', 'log', '-1', '--stat'])
else:
    print("\n❌ Commit failed!")
    sys.exit(result.returncode)


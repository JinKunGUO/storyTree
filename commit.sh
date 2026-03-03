#!/bin/bash

cd /Users/jinkun/storytree

echo "Adding all changes to git..."
git add -A

echo ""
echo "Committing changes..."
git commit -F .git-commit-msg-email.txt

echo ""
echo "Showing commit info..."
git log -1 --stat

echo ""
echo "✅ Done! Commit completed successfully."


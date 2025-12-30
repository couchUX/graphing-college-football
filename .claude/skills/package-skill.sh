#!/bin/bash

# Package the CFB Analysis skill for upload to Claude.ai
# Usage: ./package-skill.sh

cd "$(dirname "$0")"

echo "📦 Packaging CFB Analysis skill..."

# Remove old zip if it exists
rm -f cfb-analysis.zip

# Create new zip
zip -r cfb-analysis.zip cfb-analysis/ -x "*.DS_Store" "*/\.*"

echo "✅ Created cfb-analysis.zip"
echo ""
echo "Next steps:"
echo "1. Go to claude.ai → Settings → Skills"
echo "2. Upload cfb-analysis.zip"
echo "3. Start using the skill in your chats!"
echo ""
echo "Location: $(pwd)/cfb-analysis.zip"

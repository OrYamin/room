#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  npm install
fi

# Bundle everything EXCEPT the Claude Agent SDK and its peer (zod).
# The SDK relies on import.meta.url at runtime to locate its own cli.js,
# wasm files, and vendored assets — those must stay on disk.
npx --yes esbuild src/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --external:@anthropic-ai/claude-agent-sdk \
  --external:zod \
  --outfile=dist/room.js

DEST="$HOME/.claude/skills/room"
mkdir -p "$DEST"

cp skill/SKILL.md "$DEST/SKILL.md"
cp dist/room.js   "$DEST/room.js"

# Ship a minimal package.json + the two externalized packages so node can
# resolve them when room.js runs from the install dir.
cat > "$DEST/package.json" <<'EOF'
{
  "name": "room-installed",
  "private": true,
  "version": "0.0.0",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "*",
    "zod": "*"
  }
}
EOF

mkdir -p "$DEST/node_modules/@anthropic-ai"
rm -rf "$DEST/node_modules/@anthropic-ai/claude-agent-sdk"
cp -R "node_modules/@anthropic-ai/claude-agent-sdk" "$DEST/node_modules/@anthropic-ai/claude-agent-sdk"

if [ -d "node_modules/zod" ]; then
  rm -rf "$DEST/node_modules/zod"
  cp -R "node_modules/zod" "$DEST/node_modules/zod"
fi

echo "Room skill installed at $DEST"

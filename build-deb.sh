#!/usr/bin/env bash
# 构建重设计版 .deb（需要 libwebkit2gtk-4.1-dev 等系统依赖）
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/apps/desktop"

if [ ! -d node_modules ]; then
  npm ci
fi

npm run build
npx tauri build --bundles deb

echo
echo "产物："
ls -lh "$ROOT/target/release/bundle/deb/"*.deb 2>/dev/null || true

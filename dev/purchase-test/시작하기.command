#!/bin/bash
# 매입 시험 시작(맥): 이 파일을 더블클릭하세요. 처음 한 번은 오른쪽 클릭 → 열기.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  for c in /opt/homebrew/bin/node /usr/local/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do [ -x "$c" ] && PATH="$(dirname "$c"):$PATH" && break; done
fi
if ! command -v node >/dev/null 2>&1; then
  echo ""; echo "  Node.js가 필요해요. https://nodejs.org 에서 'LTS'를 내려받아 설치한 뒤 다시 더블클릭해 주세요."; echo ""
  open "https://nodejs.org/ko" 2>/dev/null; read -r -p "  엔터를 누르면 닫힙니다." _; exit 1
fi
(sleep 1.5; open "http://localhost:4219"; open "http://localhost:4219/__fake/") &
node serve-test.mjs

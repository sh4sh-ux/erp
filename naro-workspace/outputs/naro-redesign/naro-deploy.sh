#!/bin/bash
# NARO Biz 배포 — 맥에서 `naro-deploy` 한 단어로 실행한다.
# feature/naro-redesign 브랜치의 최신 커밋을 받아 사전 점검(읽기 전용) → y 입력 시에만 배포.
# Firebase 로그인 정보는 이 맥에만 있고 스크립트는 그 정보를 읽거나 옮기지 않는다.
set -uo pipefail
R=~/Documents/Codex/2026-09-06/https-sh4sh-ux-github-io-erp
FB="$R/work/erp/dev/firebase"; LOG="$R/outputs/naro-redesign-deploy"; BRANCH=feature/naro-redesign
[ -f "$FB/node_modules/firebase-tools/lib/api.js" ] || { echo "STOP: firebase-tools 없음 ($FB)"; exit 1; }
[ -f ~/.config/configstore/firebase-tools.json ] || { echo "STOP: Firebase 로그인 정보 없음"; exit 1; }
NODE=$(command -v node || true)
if [ -z "$NODE" ]; then for c in /opt/homebrew/bin/node /usr/local/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do [ -x "$c" ] && { NODE=$c; break; }; done; fi
[ -z "$NODE" ] && NODE=$(find /Applications/Codex.app "$HOME/.codex" "$HOME/Library/Application Support/Codex" -name node -type f -perm -u+x 2>/dev/null | head -1)
if [ -z "$NODE" ]; then
  A=$(uname -m); [ "$A" = arm64 ] || A=x64; V=v22.11.0; T=/tmp/naro-node; mkdir -p $T; cd $T
  curl -fsSLO https://nodejs.org/dist/$V/node-$V-darwin-$A.tar.gz && curl -fsSLO https://nodejs.org/dist/$V/SHASUMS256.txt \
   && grep " node-$V-darwin-$A.tar.gz\$" SHASUMS256.txt | shasum -a 256 -c - >/dev/null && tar xzf node-$V-darwin-$A.tar.gz && NODE=$T/node-$V-darwin-$A/bin/node \
   || { echo "STOP: node 준비 실패"; exit 1; }
fi
URL=$(git -C "$R/work/erp-login-shell-v186-release" remote get-url origin); W=/tmp/naro-deploy-$(date +%H%M%S)
git clone -q --branch "$BRANCH" "$URL" "$W" || { echo "STOP: 브랜치 받기 실패"; exit 1; }
COMMIT=$(git -C "$W" rev-parse HEAD)
echo "== 배포할 버전: ${COMMIT:0:7} — $(git -C "$W" log -1 --format='%s (%cr)')"
D="$W/naro-workspace/outputs/naro-redesign"; mkdir -p "$LOG"; cp "$D/rollback.mjs" "$LOG/"
cd "$D"; export NARO_FIREBASE_DIR="$FB" NARO_DEPLOY_LOG_DIR="$LOG"
echo "== 사전 점검 (읽기 전용)"; "$NODE" deploy.mjs | tee /tmp/naro-preflight.json | "$NODE" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s.trim().split("\n").pop());if(j.status!=="PREFLIGHT_PASS"){console.log("STOP",j.stage,j.code);process.exit(1)}console.log("파일 "+j.files+"개 · 운영과 다른 파일 "+j.changedVsLive+"개\n현재 운영 버전: "+j.previousVersion+" ("+j.previousReleaseTime+")")})' || exit 1
read -r -p "실제 배포할까요? 진행하려면 y 입력: " ans < /dev/tty
[ "$ans" = "y" ] || { echo "배포하지 않았습니다."; exit 0; }
echo "== 배포 중"; "$NODE" deploy.mjs --deploy | tail -1
echo "== 되돌리기(필요할 때만): cd \"$LOG\" && NARO_FIREBASE_DIR=\"$FB\" NARO_DEPLOY_LOG_DIR=\"$LOG\" \"$NODE\" rollback.mjs"

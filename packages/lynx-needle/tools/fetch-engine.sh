#!/usr/bin/env bash
# Fetches the prebuilt Needle engine (needle.h + libneedle.a) from Hugging Face.
#
# Usage:
#   tools/fetch-engine.sh                 # all supported targets
#   tools/fetch-engine.sh android-arm64 ios-arm64 ...
#
# Engine version: 2.0.3 (needle/agent/fetch.py ENGINE_VERSION). The .a and the
# .cact weights format are both tied to this version — bump deliberately.
set -euo pipefail

HF_BASE="https://huggingface.co/Cactus-Compute/needle2/resolve/main"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT}/third_party/needle"

ALL_PLATFORMS=(android-arm64 android-armv7 ios-arm64 ios-sim-arm64 macos-arm64)
PLATFORMS=("$@")
if [ ${#PLATFORMS[@]} -eq 0 ]; then
  PLATFORMS=("${ALL_PLATFORMS[@]}")
fi

fetch() {
  local url="$1" dest="$2"
  if [ -s "${dest}" ]; then
    echo "skip (exists): ${dest}"
    return 0
  fi
  mkdir -p "$(dirname "${dest}")"
  echo "fetch: ${url}"
  curl -fL --retry 3 -o "${dest}.tmp" "${url}"
  mv "${dest}.tmp" "${dest}"
}

# Header is identical across platform folders; take the android-arm64 copy.
fetch "${HF_BASE}/android-arm64/needle.h" "${OUT_DIR}/include/needle.h"

for platform in "${PLATFORMS[@]}"; do
  fetch "${HF_BASE}/${platform}/libneedle.a" "${OUT_DIR}/${platform}/libneedle.a"
done

echo "---"
find "${OUT_DIR}" -type f \( -name '*.a' -o -name '*.h' \) -exec ls -lh {} \;
echo "Done. Engine artifacts pinned to needle2 @ ENGINE_VERSION 2.0.3."

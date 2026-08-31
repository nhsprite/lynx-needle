#!/usr/bin/env bash
# Builds the needle addon for Android (arm64-v8a + armeabi-v7a).
# Requires: Android NDK (set ANDROID_NDK or have $ANDROID_HOME/ndk installed).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${ANDROID_NDK:-}" ]; then
  ANDROID_NDK="$(ls -d "${ANDROID_HOME:-$HOME/Library/Android/sdk}/ndk/"* 2>/dev/null | sort -V | tail -1)"
fi
[ -n "${ANDROID_NDK}" ] || { echo "ANDROID_NDK not set and no NDK found"; exit 1; }

for abi in armeabi-v7a arm64-v8a; do
  cmake -S "${ROOT}" -B "${ROOT}/build/android-${abi}" \
    -DCMAKE_TOOLCHAIN_FILE="${ANDROID_NDK}/build/cmake/android.toolchain.cmake" \
    -DANDROID_ABI="${abi}" \
    -DANDROID_PLATFORM=android-24 \
    -DCMAKE_BUILD_TYPE=Release
  cmake --build "${ROOT}/build/android-${abi}"
done
ls -lh "${ROOT}"/android/src/main/jniLibs/*/libneedle.so

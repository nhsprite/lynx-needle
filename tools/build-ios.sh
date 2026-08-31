#!/usr/bin/env bash
# Builds the needle addon for iOS (device + simulator) and packages the
# Darwin xcframework + podspec into ios/.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cmake -S "${ROOT}" -B "${ROOT}/build/ios-device" -G Xcode \
  -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_OSX_SYSROOT=iphoneos \
  -DCMAKE_OSX_ARCHITECTURES=arm64
cmake --build "${ROOT}/build/ios-device" --config Release

cmake -S "${ROOT}" -B "${ROOT}/build/ios-sim" -G Xcode \
  -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_OSX_SYSROOT=iphonesimulator \
  -DCMAKE_OSX_ARCHITECTURES=arm64
cmake --build "${ROOT}/build/ios-sim" --config Release

(cd "${ROOT}" && npm run package:darwin)

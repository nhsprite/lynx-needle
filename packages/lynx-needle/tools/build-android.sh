#!/usr/bin/env bash
# Builds the AutoLink Android library module (arm64-v8a + armeabi-v7a).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT}/../.." && pwd)"

if command -v /usr/libexec/java_home >/dev/null 2>&1; then
  JDK17_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
  if [ -n "${JDK17_HOME}" ]; then
    export JAVA_HOME="${JDK17_HOME}"
  fi
fi

(cd "${REPO_ROOT}/examples/android-host" && npm install)
(cd "${REPO_ROOT}/examples/android-host" && ./gradlew :lynx_library_lynx_needle:assembleRelease)
ls -lh "${ROOT}"/android/src/main/jniLibs/*/libNeedle.so

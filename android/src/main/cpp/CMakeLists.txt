cmake_minimum_required(VERSION 3.22)
project(lynx_napi_addon_loader CXX)
set(CMAKE_CXX_STANDARD 17)

# android/src/main/cpp -> repo root (4 levels up)
get_filename_component(REPO_ROOT "${CMAKE_CURRENT_LIST_DIR}/../../../../" ABSOLUTE)
set(SHARED_DIR "${REPO_ROOT}/cpp")
set(WEAK_NAPI_HEADERS "${REPO_ROOT}/node_modules/@lynx-js/weak-node-api/headers")
if(NOT EXISTS "${WEAK_NAPI_HEADERS}/node_api.h")
  message(FATAL_ERROR "weak-node-api headers not found at ${WEAK_NAPI_HEADERS}; run npm install at the repo root first.")
endif()

add_library(lynx_napi_addon_loader SHARED LynxNodeAPIJNI.cc "${SHARED_DIR}/LynxNodeAPI.cc")
target_include_directories(lynx_napi_addon_loader PRIVATE "${SHARED_DIR}" "${WEAK_NAPI_HEADERS}")

# Extracted from org.lynxsdk.lynx:primjs:3.9.0-alpha.1 by scripts/fetch-libs.mjs
add_library(napi_adapter SHARED IMPORTED)
set_target_properties(napi_adapter PROPERTIES
  IMPORTED_LOCATION "${REPO_ROOT}/vendor/android/${ANDROID_ABI}/libnapi_adapter.so")

target_link_libraries(lynx_napi_addon_loader PRIVATE log napi_adapter)

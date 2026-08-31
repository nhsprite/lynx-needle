cmake_minimum_required(VERSION 3.22)
project(needle LANGUAGES C CXX)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)
option(USE_WEAK_SUFFIX_NAPI "Enable weak suffix remapping for Node-API" OFF)
set(_WEAK_NODE_API_CONFIG "${CMAKE_CURRENT_LIST_DIR}/node_modules/@lynx-js/weak-node-api/weak-node-api-config.cmake")
if(NOT EXISTS "${_WEAK_NODE_API_CONFIG}")
  message(FATAL_ERROR "weak-node-api-config.cmake not found: ${_WEAK_NODE_API_CONFIG}. Run npm install first.")
endif()
include("${_WEAK_NODE_API_CONFIG}")

function(_lynx_set_output_dir target property value)
  set_target_properties(${target} PROPERTIES ${property} "${value}")
  foreach(_cfg Debug Release RelWithDebInfo MinSizeRel)
    string(TOUPPER "${_cfg}" _cfg_upper)
    set_target_properties(${target} PROPERTIES ${property}_${_cfg_upper} "${value}")
  endforeach()
endfunction()

set(_LYNX_ADDON_LIBRARY_TYPE SHARED)
if(APPLE)
  set(_LYNX_ADDON_LIBRARY_TYPE STATIC)
endif()
add_library(needle ${_LYNX_ADDON_LIBRARY_TYPE} cpp/addon.cc cpp/addon.h cpp/addon_use.h)
if(ANDROID AND ANDROID_ABI STREQUAL "armeabi-v7a")
  # Prebuilt engine needs std::__ndk1::__hash_memory, absent from modern NDKs.
  target_sources(needle PRIVATE cpp/shim_hash_memory.cc)
endif()
target_include_directories(needle PUBLIC "${CMAKE_CURRENT_LIST_DIR}/cpp")
target_link_libraries(needle PUBLIC weak-node-api-headers)
target_compile_definitions(needle PRIVATE NAPI_VERSION=8)

# --- Needle inference engine (prebuilt static library, fetched by
# --- tools/fetch-engine.sh into third_party/needle/<platform>/libneedle.a)
set(NEEDLE_ENGINE_DIR "${CMAKE_CURRENT_LIST_DIR}/third_party/needle")
set(_NEEDLE_PLATFORM "")
if(ANDROID)
  if(ANDROID_ABI STREQUAL "arm64-v8a")
    set(_NEEDLE_PLATFORM "android-arm64")
  elseif(ANDROID_ABI STREQUAL "armeabi-v7a")
    set(_NEEDLE_PLATFORM "android-armv7")
  endif()
elseif(CMAKE_SYSTEM_NAME STREQUAL "iOS" OR CMAKE_OSX_SYSROOT MATCHES "iphone")
  if(CMAKE_OSX_SYSROOT MATCHES "simulator")
    set(_NEEDLE_PLATFORM "ios-sim-arm64")
  else()
    set(_NEEDLE_PLATFORM "ios-arm64")
  endif()
elseif(APPLE)
  set(_NEEDLE_PLATFORM "macos-arm64")
endif()
if(NOT _NEEDLE_PLATFORM)
  message(FATAL_ERROR "No prebuilt needle engine for this target. Supported: Android arm64-v8a/armeabi-v7a, iOS arm64 (+sim), macOS arm64.")
endif()
set(_NEEDLE_ENGINE_LIB "${NEEDLE_ENGINE_DIR}/${_NEEDLE_PLATFORM}/libneedle.a")
if(NOT EXISTS "${_NEEDLE_ENGINE_LIB}")
  message(FATAL_ERROR "needle engine not found: ${_NEEDLE_ENGINE_LIB}. Run tools/fetch-engine.sh first.")
endif()
target_include_directories(needle PRIVATE "${NEEDLE_ENGINE_DIR}/include")
target_link_libraries(needle PRIVATE "${_NEEDLE_ENGINE_LIB}")
message(STATUS "Linking needle engine: ${_NEEDLE_ENGINE_LIB}")
set(_LYNX_ENABLE_WEAK_SUFFIX ${USE_WEAK_SUFFIX_NAPI})
if(CMAKE_SYSTEM_NAME STREQUAL "OHOS")
  set(_LYNX_ENABLE_WEAK_SUFFIX ON)
endif()
if(APPLE AND NOT CMAKE_SYSTEM_NAME STREQUAL "iOS" AND NOT CMAKE_OSX_SYSROOT MATCHES "iphone")
  set(_LYNX_ENABLE_WEAK_SUFFIX ON)
endif()
if(_LYNX_ENABLE_WEAK_SUFFIX)
  target_compile_definitions(needle PRIVATE USE_WEAK_SUFFIX_NAPI)
endif()
if(ANDROID)
  # Output straight into the Android library module's jniLibs, so no sync
  # step is needed between the addon build and the AAR build.
  set(_LYNX_PLATFORM_OUT_DIR "${CMAKE_CURRENT_LIST_DIR}/android/src/main/jniLibs/${ANDROID_ABI}")
  # fetch-libs.mjs only extracts the arm64-v8a adapter; pull the per-ABI copy
  # out of the downloaded primjs AAR ourselves.
  set(_NAPI_ADAPTER "${CMAKE_CURRENT_LIST_DIR}/vendor/android/${ANDROID_ABI}/libnapi_adapter.so")
  if(NOT EXISTS "${_NAPI_ADAPTER}")
    # Fetch at configure time so the imported-library path exists before
    # generate; a custom target's BYPRODUCTS is not a file rule for Make.
    execute_process(
      COMMAND node "${CMAKE_CURRENT_LIST_DIR}/scripts/fetch-libs.mjs"
              --platform android --abi ${ANDROID_ABI}
              --out "${CMAKE_CURRENT_LIST_DIR}/vendor/android"
      WORKING_DIRECTORY "${CMAKE_CURRENT_LIST_DIR}"
      RESULT_VARIABLE _fetch_rc)
    if(NOT _fetch_rc EQUAL 0)
      message(FATAL_ERROR "failed to fetch libnapi_adapter.so for ${ANDROID_ABI}")
    endif()
  endif()
  add_library(napi_adapter SHARED IMPORTED)
  set_target_properties(napi_adapter PROPERTIES IMPORTED_LOCATION "${_NAPI_ADAPTER}")
  target_link_libraries(needle PRIVATE napi_adapter)
  set_target_properties(needle PROPERTIES PREFIX "lib" SUFFIX ".so")
  _lynx_set_output_dir(needle LIBRARY_OUTPUT_DIRECTORY "${_LYNX_PLATFORM_OUT_DIR}")
  _lynx_set_output_dir(needle RUNTIME_OUTPUT_DIRECTORY "${_LYNX_PLATFORM_OUT_DIR}")
  # Stage the weak-NAPI dispatcher next to the addon in jniLibs.
  add_custom_command(TARGET needle POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${_NAPI_ADAPTER}" "${_LYNX_PLATFORM_OUT_DIR}/libnapi_adapter.so"
  )
elseif(CMAKE_SYSTEM_NAME STREQUAL "OHOS")
  set(_LYNX_OHOS_ARCH "${OHOS_ARCH}")
  if(NOT _LYNX_OHOS_ARCH)
    set(_LYNX_OHOS_ARCH "unknown")
  endif()
  set(_LYNX_PLATFORM_OUT_DIR "${CMAKE_CURRENT_BINARY_DIR}/out")
  add_custom_target(fetch_napi_adapter ALL
    COMMAND ${CMAKE_COMMAND} -E make_directory "${CMAKE_CURRENT_LIST_DIR}/vendor/harmony"
    COMMAND node "${CMAKE_CURRENT_LIST_DIR}/scripts/fetch-libs.mjs" --platform harmony --out "${CMAKE_CURRENT_LIST_DIR}/vendor/harmony"
    BYPRODUCTS "${CMAKE_CURRENT_LIST_DIR}/vendor/harmony/libnapi_adapter.so"
    WORKING_DIRECTORY "${CMAKE_CURRENT_LIST_DIR}"
  )
  add_library(napi_adapter SHARED IMPORTED)
  set_target_properties(napi_adapter PROPERTIES IMPORTED_LOCATION "${CMAKE_CURRENT_LIST_DIR}/vendor/harmony/libnapi_adapter.so")
  target_link_libraries(needle PRIVATE napi_adapter)
  set_target_properties(needle PROPERTIES PREFIX "lib" SUFFIX ".so")
  _lynx_set_output_dir(needle LIBRARY_OUTPUT_DIRECTORY "${_LYNX_PLATFORM_OUT_DIR}")
  _lynx_set_output_dir(needle RUNTIME_OUTPUT_DIRECTORY "${_LYNX_PLATFORM_OUT_DIR}")
elseif(WIN32)
  message(FATAL_ERROR "Windows support is coming soon.")
elseif(APPLE)
  # Darwin artifacts stay in the cmake build dir; scripts/package-darwin.mjs
  # picks them up from here and uses cpp/ as the public-headers source.
  set(_LYNX_PLATFORM_OUT_DIR "${CMAKE_CURRENT_BINARY_DIR}/out")
  _lynx_set_output_dir(needle ARCHIVE_OUTPUT_DIRECTORY "${_LYNX_PLATFORM_OUT_DIR}")
  # Static addon archives do not absorb their link dependencies: merge the
  # needle engine objects in, so the xcframework slice is self-contained and
  # the host app does not need to link the engine archive separately.
  add_custom_command(TARGET needle POST_BUILD
    COMMAND xcrun libtool -static -o
            "${_LYNX_PLATFORM_OUT_DIR}/libneedle.merged.a"
            "$<TARGET_FILE:needle>" "${_NEEDLE_ENGINE_LIB}"
    COMMAND ${CMAKE_COMMAND} -E rename
            "${_LYNX_PLATFORM_OUT_DIR}/libneedle.merged.a"
            "${_LYNX_PLATFORM_OUT_DIR}/libneedle.a"
  )
else()
  message(FATAL_ERROR "Unsupported platform for this scaffold. Use Android, OHOS, iOS, or macOS toolchains. Windows support is coming soon.")
endif()

message(STATUS "Addon artifacts will be written under: ${_LYNX_PLATFORM_OUT_DIR}")

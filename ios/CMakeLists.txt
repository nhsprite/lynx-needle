cmake_minimum_required(VERSION 3.22)

project(LynxNeedleAddonIOS LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

get_filename_component(
  LYNX_LIBRARY_PACKAGE_ROOT
  "${CMAKE_CURRENT_SOURCE_DIR}/.."
  ABSOLUTE
)

set(WEAK_NODE_API_HEADERS
  "${LYNX_LIBRARY_PACKAGE_ROOT}/node_modules/@lynx-js/weak-node-api/headers"
)
if(NOT EXISTS "${WEAK_NODE_API_HEADERS}/napi.h")
  message(FATAL_ERROR "Missing weak-node-api headers. Run npm install first.")
endif()

if(CMAKE_OSX_SYSROOT MATCHES "simulator")
  set(NEEDLE_ENGINE_PLATFORM "ios-sim-arm64")
else()
  set(NEEDLE_ENGINE_PLATFORM "ios-arm64")
endif()

set(NEEDLE_ENGINE_LIB
  "${LYNX_LIBRARY_PACKAGE_ROOT}/third_party/needle/${NEEDLE_ENGINE_PLATFORM}/libneedle.a"
)
if(NOT EXISTS "${NEEDLE_ENGINE_LIB}")
  message(FATAL_ERROR
    "Needle engine not found: ${NEEDLE_ENGINE_LIB}. Run npm run fetch-engine first.")
endif()

add_library(Needle STATIC
  generated/NeedleNapiWrapper.cc
)

target_include_directories(Needle PRIVATE
  "${LYNX_LIBRARY_PACKAGE_ROOT}"
  "${LYNX_LIBRARY_PACKAGE_ROOT}/third_party/needle/include"
  "${WEAK_NODE_API_HEADERS}"
)

target_compile_definitions(Needle PRIVATE
  NAPI_VERSION=8
  NAPI_CPP_CUSTOM_NAMESPACE=needle_node_api
  LYNX_LIBRARY_MANUAL_NAPI_REGISTRATION=1
  LYNX_LIBRARY_USE_PRIMJS_NAPI_MODULE=1
)

set_target_properties(Needle PROPERTIES
  OUTPUT_NAME "Needle"
  ARCHIVE_OUTPUT_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/out"
)

foreach(_config Debug Release RelWithDebInfo MinSizeRel)
  string(TOUPPER "${_config}" _config_upper)
  set_target_properties(Needle PROPERTIES
    ARCHIVE_OUTPUT_DIRECTORY_${_config_upper} "${CMAKE_CURRENT_BINARY_DIR}/out"
  )
endforeach()

add_custom_command(TARGET Needle POST_BUILD
  COMMAND xcrun libtool -static -o
    "${CMAKE_CURRENT_BINARY_DIR}/out/libNeedle.merged.a"
    "$<TARGET_FILE:Needle>"
    "${NEEDLE_ENGINE_LIB}"
  COMMAND ${CMAKE_COMMAND} -E rename
    "${CMAKE_CURRENT_BINARY_DIR}/out/libNeedle.merged.a"
    "${CMAKE_CURRENT_BINARY_DIR}/out/libNeedle.a"
)

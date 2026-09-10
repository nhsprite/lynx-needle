cmake_minimum_required(VERSION 3.18.1)

project(LynxNeedleAddonAndroid LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

get_filename_component(
  LYNX_LIBRARY_PACKAGE_ROOT
  "${CMAKE_CURRENT_SOURCE_DIR}/.."
  ABSOLUTE
)

set(LYNX_LIBRARY_PLATFORM "android")
set(LYNX_LIBRARY_NODE_API_WEAK_SUFFIX OFF CACHE BOOL "Use weak suffix NAPI symbols")
set(LYNX_LIBRARY_USE_PRIMJS_NAPI_MODULE ON CACHE BOOL "Register NAPI modules through standard napi_module_register" FORCE)
set(LYNX_SHARED_BUILD_ELEMENTS OFF CACHE BOOL "Do not build element sources for Android addon" FORCE)

set(NEEDLE_ENGINE_DIR "${LYNX_LIBRARY_PACKAGE_ROOT}/third_party/needle")
if(ANDROID_ABI STREQUAL "arm64-v8a")
  set(NEEDLE_ENGINE_PLATFORM "android-arm64")
elseif(ANDROID_ABI STREQUAL "armeabi-v7a")
  set(NEEDLE_ENGINE_PLATFORM "android-armv7")
else()
  message(FATAL_ERROR "No prebuilt Needle engine for Android ABI ${ANDROID_ABI}.")
endif()

set(NEEDLE_ENGINE_LIB "${NEEDLE_ENGINE_DIR}/${NEEDLE_ENGINE_PLATFORM}/libneedle.a")
if(NOT EXISTS "${NEEDLE_ENGINE_LIB}")
  message(FATAL_ERROR "Needle engine not found: ${NEEDLE_ENGINE_LIB}. Run npm run fetch-engine first.")
endif()

if(NOT LYNX_PRIMJS_JNI_DIR)
  message(FATAL_ERROR "LYNX_PRIMJS_JNI_DIR is required. Build through the generated Gradle project.")
endif()

set(LYNX_PRIMJS_ABI_DIR "${LYNX_PRIMJS_JNI_DIR}/${ANDROID_ABI}")

add_library(lynx_primjs_napi SHARED IMPORTED)
set_target_properties(lynx_primjs_napi PROPERTIES
  IMPORTED_LOCATION "${LYNX_PRIMJS_ABI_DIR}/libnapi.so"
)

add_library(lynx_primjs_napi_adapter SHARED IMPORTED)
set_target_properties(lynx_primjs_napi_adapter PROPERTIES
  IMPORTED_LOCATION "${LYNX_PRIMJS_ABI_DIR}/libnapi_adapter.so"
)

add_subdirectory(
  "${LYNX_LIBRARY_PACKAGE_ROOT}/shared"
  "${CMAKE_CURRENT_BINARY_DIR}/shared"
)

target_include_directories(${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET} PRIVATE
  "${NEEDLE_ENGINE_DIR}/include"
)
target_compile_definitions(${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET} PRIVATE
  NAPI_VERSION=8
  NAPI_CPP_CUSTOM_NAMESPACE=needle_node_api
)
if(ANDROID_ABI STREQUAL "armeabi-v7a")
  target_sources(${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET} PRIVATE
    "${LYNX_LIBRARY_PACKAGE_ROOT}/cpp/shim_hash_memory.cc"
  )
endif()

add_library(LynxNeedleAddon SHARED
  $<TARGET_OBJECTS:${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET}>
)

if(ANDROID_ABI STREQUAL "arm64-v8a" OR ANDROID_ABI STREQUAL "x86_64")
  target_link_options(LynxNeedleAddon PRIVATE
    "-Wl,-z,max-page-size=16384"
    "-Wl,-z,common-page-size=16384"
  )
endif()

target_link_libraries(LynxNeedleAddon PRIVATE
  ${LYNX_SHARED_PLATFORM_LINK_LIBRARIES}
  "${NEEDLE_ENGINE_LIB}"
  lynx_primjs_napi_adapter
  lynx_primjs_napi
  log
)

set_target_properties(LynxNeedleAddon PROPERTIES
  OUTPUT_NAME "Needle"
)

foreach(_output_property LIBRARY_OUTPUT_DIRECTORY RUNTIME_OUTPUT_DIRECTORY)
  set_target_properties(LynxNeedleAddon PROPERTIES
    ${_output_property}
      "${LYNX_LIBRARY_PACKAGE_ROOT}/android/src/main/jniLibs/${ANDROID_ABI}"
  )
  foreach(_config Debug Release RelWithDebInfo MinSizeRel)
    string(TOUPPER "${_config}" _config_upper)
    set_target_properties(LynxNeedleAddon PROPERTIES
      ${_output_property}_${_config_upper}
        "${LYNX_LIBRARY_PACKAGE_ROOT}/android/src/main/jniLibs/${ANDROID_ABI}"
    )
  endforeach()
endforeach()

add_custom_command(TARGET LynxNeedleAddon POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_if_different
    "${LYNX_PRIMJS_ABI_DIR}/libnapi_adapter.so"
    "${LYNX_LIBRARY_PACKAGE_ROOT}/android/src/main/jniLibs/${ANDROID_ABI}/libnapi_adapter.so"
  COMMAND ${CMAKE_COMMAND} -E copy_if_different
    "${LYNX_PRIMJS_ABI_DIR}/libnapi.so"
    "${LYNX_LIBRARY_PACKAGE_ROOT}/android/src/main/jniLibs/${ANDROID_ABI}/libnapi.so"
)

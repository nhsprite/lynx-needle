Pod::Spec.new do |s|
  s.name = 'lynx-needle'
  s.version = '0.1.0'
  s.summary = 'Lynx AutoLink NAPI addon embedding Cactus Needle 2 for Android and iOS.'
  s.homepage = 'https://github.com/nhsprite/lynx-needle'
  s.license = { :type => 'MIT' }
  s.author = 'lynx-needle'
  s.source = { :path => '..' }
  s.platform = :ios, '12.0'
  s.vendored_frameworks = 'lynx-needle.xcframework'
  s.source_files = 'addon_use.h'
  s.public_header_files = 'addon_use.h'
  s.preserve_paths = 'lynx-needle.xcframework', 'addon_use.h'
  s.libraries = "c++"
  s.dependency 'LynxWeakNodeAPI/core'
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'CLANG_CXX_LIBRARY' => 'libc++',
    'HEADER_SEARCH_PATHS' => '$(inherited) "${PODS_ROOT}/LynxWeakNodeAPI/packages/weak-node-api/headers" "${PODS_TARGET_SRCROOT}/../third_party/needle/include"',
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) NAPI_VERSION=8 NAPI_CPP_CUSTOM_NAMESPACE=needle_node_api LYNX_LIBRARY_MANUAL_NAPI_REGISTRATION=1 LYNX_LIBRARY_USE_PRIMJS_NAPI_MODULE=1'
  }
end

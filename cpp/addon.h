#pragma once

#include <napi.h>
#if defined(USE_WEAK_SUFFIX_NAPI)
#include "weak_napi_defines.h"
#endif

namespace needle_addon {

// The name the Lynx host uses to locate this addon:
//   Android: dlopen("libneedle.so")
//   JS:      NativeModules.LynxNodeAPI.requireNodeAddon("needle")
constexpr const char* kAddonName = "needle";

Napi::Object Init(Napi::Env env, Napi::Object exports);

}  // namespace needle_addon

#if defined(USE_WEAK_SUFFIX_NAPI)
#include "weak_napi_undefs.h"
#endif

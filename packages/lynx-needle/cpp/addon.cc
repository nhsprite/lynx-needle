#include "addon.h"

#include <algorithm>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <string>
#include <vector>

#include "needle.h"

#if defined(USE_WEAK_SUFFIX_NAPI)
#include "weak_napi_defines.h"
#endif

namespace needle_addon {

namespace {

// Matches the engine revision fetched by tools/fetch-engine.sh
// (needle/agent/fetch.py ENGINE_VERSION in cactus-compute/needle).
constexpr const char* kEngineVersion = "2.0.3";

// Python reference wrapper uses 65536; we grow once if the engine reports
// failure, since its truncation signalling is not part of the public ABI.
constexpr size_t kInitialOutCapacity = 65536;
constexpr size_t kMaxOutCapacity = 1 << 20;  // 1 MiB

// The engine keeps process-global single-session state and documents no
// thread-safety, so every call is serialized here. `complete` additionally
// runs on an AsyncWorker thread, so this mutex is what actually protects it.
std::mutex g_engine_mutex;

// This node-addon-api variant has no Napi::JSON; go through the JS global.
Napi::Value JsonStringify(Napi::Env env, Napi::Value value) {
  Napi::Object json = env.Global().Get("JSON").As<Napi::Object>();
  return json.Get("stringify").As<Napi::Function>().Call(json, {value});
}

Napi::Value JsonParse(Napi::Env env, const char* data, size_t len) {
  Napi::Object json = env.Global().Get("JSON").As<Napi::Object>();
  return json.Get("parse").As<Napi::Function>().Call(
      json, {Napi::String::New(env, data, len)});
}

// init(system, tools, toolIndexPath?)
//   system:        string (may be "")
//   tools:         array of tool schema objects, or a pre-serialized JSON string
//   toolIndexPath: optional string; omit/undefined -> NULL
Napi::Value InitBinding(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsString()) {
    Napi::TypeError::New(env, "init(system: string, tools: array|string, toolIndexPath?: string)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string system = info[0].As<Napi::String>().Utf8Value();

  std::string tools_json;
  if (info[1].IsString()) {
    tools_json = info[1].As<Napi::String>().Utf8Value();
  } else if (info[1].IsArray()) {
    Napi::Value stringified = JsonStringify(env, info[1].As<Napi::Array>());
    if (env.IsExceptionPending()) return env.Null();
    tools_json = stringified.As<Napi::String>().Utf8Value();
  } else {
    Napi::TypeError::New(env, "tools must be an array of schemas or a JSON string")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string tool_index_path;
  const char* tool_index_ptr = nullptr;
  if (info.Length() >= 3 && info[2].IsString()) {
    tool_index_path = info[2].As<Napi::String>().Utf8Value();
    tool_index_ptr = tool_index_path.c_str();
  }

  std::lock_guard<std::mutex> lock(g_engine_mutex);
  int rc = needle_init(system.c_str(), tools_json.c_str(), tool_index_ptr);
  if (rc < 0) {
    Napi::Error::New(env, "needle_init failed (code " + std::to_string(rc) + ")")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  return env.Undefined();
}

// Runs needle_complete off the JS thread and resolves with the parsed
// response envelope object.
class CompleteWorker : public Napi::AsyncWorker {
 public:
  CompleteWorker(Napi::Env env, std::string input, int max_new_tokens,
                 Napi::Promise::Deferred deferred)
      : Napi::AsyncWorker(env),
        input_(std::move(input)),
        max_new_tokens_(max_new_tokens),
        deferred_(deferred) {}

  void Execute() override {
    std::lock_guard<std::mutex> lock(g_engine_mutex);
    size_t capacity = kInitialOutCapacity;
    for (;;) {
      out_.resize(capacity);
      int rc = needle_complete(input_.c_str(), max_new_tokens_, out_.data(),
                               static_cast<int>(capacity));
      if (rc >= 0) {
        out_len_ = strnlen(out_.data(), out_.size());
        return;
      }
      if (capacity >= kMaxOutCapacity) {
        SetError("needle_complete failed (code " + std::to_string(rc) +
                 ", buffer " + std::to_string(capacity) + ")");
        return;
      }
      capacity = kMaxOutCapacity;  // single grow-and-retry
    }
  }

  void OnOK() override {
    Napi::Env env = Env();
    Napi::Value parsed = JsonParse(env, out_.data(), out_len_);
    if (env.IsExceptionPending()) {
      deferred_.Reject(Napi::String::New(
          env, "engine returned an unparseable envelope (engine bug)"));
      return;
    }
    deferred_.Resolve(parsed);
  }

  void OnError(const Napi::Error& error) override {
    deferred_.Reject(error.Value());
  }

 private:
  std::string input_;
  int max_new_tokens_;
  Napi::Promise::Deferred deferred_;
  std::vector<char> out_;
  size_t out_len_ = 0;
};

// complete(input, maxNewTokens?) -> Promise<object>
Napi::Value CompleteBinding(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "complete(input: string, maxNewTokens?: number)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  std::string input = info[0].As<Napi::String>().Utf8Value();
  int max_new_tokens = 256;
  if (info.Length() >= 2 && info[1].IsNumber()) {
    max_new_tokens = info[1].As<Napi::Number>().Int32Value();
  }

  Napi::Promise::Deferred deferred = Napi::Promise::Deferred::New(env);
  CompleteWorker* worker =
      new CompleteWorker(env, std::move(input), max_new_tokens, deferred);
  worker->Queue();
  return deferred.Promise();
}

Napi::Value ResetBinding(const Napi::CallbackInfo& info) {
  std::lock_guard<std::mutex> lock(g_engine_mutex);
  needle_reset();
  return info.Env().Undefined();
}

// load(cactPath) — reads a tuned .cact archive into memory and binds it.
// One-way: the engine cannot unload weights for the process lifetime.
Napi::Value LoadBinding(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "load(cactPath: string)").ThrowAsJavaScriptException();
    return env.Null();
  }
  std::string path = info[0].As<Napi::String>().Utf8Value();

  FILE* file = fopen(path.c_str(), "rb");
  if (!file) {
    Napi::Error::New(env, "cannot open weights file: " + path)
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  fseek(file, 0, SEEK_END);
  long size = ftell(file);
  fseek(file, 0, SEEK_SET);
  if (size <= 0) {
    fclose(file);
    Napi::Error::New(env, "empty weights file: " + path).ThrowAsJavaScriptException();
    return env.Null();
  }
  std::vector<unsigned char> blob(static_cast<size_t>(size));
  size_t read = fread(blob.data(), 1, blob.size(), file);
  fclose(file);
  if (read != blob.size()) {
    Napi::Error::New(env, "failed to read weights file: " + path)
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::lock_guard<std::mutex> lock(g_engine_mutex);
  int rc = needle_load(blob.data(), static_cast<unsigned long long>(blob.size()));
  if (rc != 0) {
    std::string msg =
        "needle_load failed (code " + std::to_string(rc) +
        ") - the .cact format is tied to the engine version (this addon pins " +
        kEngineVersion + "); re-export with a matching cactus-needle";
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
    return env.Null();
  }
  return env.Undefined();
}

Napi::Value EngineVersionBinding(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(), kEngineVersion);
}

}  // namespace

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("init", Napi::Function::New(env, InitBinding));
  exports.Set("complete", Napi::Function::New(env, CompleteBinding));
  exports.Set("reset", Napi::Function::New(env, ResetBinding));
  exports.Set("load", Napi::Function::New(env, LoadBinding));
  exports.Set("engineVersion", Napi::Function::New(env, EngineVersionBinding));
  return exports;
}

}  // namespace needle_addon

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  return needle_addon::Init(env, exports);
}

#if defined(_MSC_VER)
#define LYNX_NAPI_MODULE_EXPORT __declspec(dllexport)
#define LYNX_NAPI_C_CTOR(fn)               \
  extern "C" void fn(void);                \
  namespace {                              \
  struct fn##_runner {                     \
    fn##_runner() { fn(); }                \
  };                                       \
  static fn##_runner fn##_runner_instance; \
  }                                        \
  extern "C" void fn(void)
#else
#define LYNX_NAPI_MODULE_EXPORT __attribute__((visibility("default"), weak))
#define LYNX_NAPI_C_CTOR(fn)                             \
  extern "C" void fn(void) __attribute__((constructor)); \
  extern "C" void fn(void)
#endif

#define LYNX_NAPI_AUTO_REGISTER_MODULE(modname, addon_name, regfunc)        \
  EXTERN_C_START                                                            \
  static napi_module _napi_module_##modname = {                             \
      NAPI_MODULE_VERSION, 0, __FILE__, regfunc, addon_name, NULL, {NULL}}; \
  EXTERN_C_END                                                              \
  LYNX_NAPI_C_CTOR(_napi_register_xx_##modname) {                           \
    napi_module_register(&_napi_module_##modname);                          \
  }

static napi_value RegisterNodeApiModule(napi_env env, napi_value exports) {
  return Napi::RegisterModule(env, exports, Init);
}

EXTERN_C_START
LYNX_NAPI_MODULE_EXPORT int32_t NAPI_CDECL
NODE_API_MODULE_GET_API_VERSION(void) {
  return NAPI_VERSION;
}

LYNX_NAPI_MODULE_EXPORT napi_value NAPI_CDECL
NAPI_MODULE_INITIALIZER(napi_env env, napi_value exports) {
  return RegisterNodeApiModule(env, exports);
}
EXTERN_C_END

LYNX_NAPI_AUTO_REGISTER_MODULE(needle,
                               needle_addon::kAddonName,
                               RegisterNodeApiModule)

#if defined(USE_WEAK_SUFFIX_NAPI)
#include "weak_napi_undefs.h"
#endif

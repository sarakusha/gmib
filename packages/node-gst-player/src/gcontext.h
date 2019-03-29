#include <utility>

//
// Created by Andrei Sarakeev on 18/09/2018.
//

#ifndef NODE_GST_PLAYER_GCONTEXT_H
#define NODE_GST_PLAYER_GCONTEXT_H

#include <functional>
#include <condition_variable>
#include <cassert>
#include <mutex>
#include <glib.h>
#include <napi.h>
#include <algorithm>
#include <variant>
#include <gtk/gtk.h>
#include <string_view>
#include <gst/gstinfo.h>

#include <node_api.h>

GST_DEBUG_CATEGORY_EXTERN (context_debug);

#ifdef MACOSX
#define SINGLE_THREADED
#endif

typedef std::function<void()> Lambda;

#ifdef SINGLE_THREADED
#define CHECK_CONTEXT()
#else
#define CHECK_CONTEXT() GContextWorker::Check();

gboolean sourceFunction(gpointer user_data);
extern bool exited;
#endif

extern bool exiting;

typedef std::variant<std::string, int, double, bool> JSArg;
napi_value ValueFromJSArg(napi_env env, const JSArg &arg);

class AsyncMethod {
 public:
  AsyncMethod(Napi::Env env, Napi::Object receiver, const std::string&  method = "emit");
  virtual ~AsyncMethod();
  AsyncMethod(AsyncMethod &&other) {
    _tf_func =  other._tf_func;
    other._tf_func = nullptr;
    _recv = std::move(other._recv);
  }

  AsyncMethod &operator=(AsyncMethod &&other) {
    _tf_func = other._tf_func;
    other._tf_func = nullptr;
    _recv = std::move(other._recv);
    return *this;
  }
  AsyncMethod(AsyncMethod &other) = delete;
  AsyncMethod &operator=(AsyncMethod &other) = delete;
  operator napi_threadsafe_function() const {
    return _tf_func;
  }
  template<typename ...Args>
  void Call(std::string &&event, Args&&... args) {
    if (exiting) return;
    auto *data = new JSData{std::move(event), {std::forward<Args>(args)...}};
    auto status = napi_call_threadsafe_function(_tf_func, data, napi_tsfn_nonblocking);
    assert(status == napi_ok);
  }
 private:
  struct JSData {
    std::string event;
    std::vector<JSArg> args;
  };
  static void CallIntoJS(napi_env env, napi_value callback, void *ctx, void *data);
//  static void Finalize(napi_env env, void *data, void *ctx);

  napi_threadsafe_function _tf_func;
  Napi::ObjectReference _recv;
};

class AsyncDeferred {
 public:
  typedef void* AsyncData;
  typedef std::function<napi_value(napi_env)> ResolveLambda;
  AsyncDeferred(napi_env env, napi_value callback = nullptr);
  Napi::Value Promise() const {
//    GST_CAT_LEVEL_LOG (context_debug, GST_LEVEL_DEBUG, NULL, "ENV %p, Promise: %p", _env, _promise);
    return Napi::Promise(_env, _promise);
  }


  static void Resolve(AsyncData data, ResolveLambda &&resolve);
  static void Reject(AsyncData data);
  AsyncData Data() const {
    return _data;
  }

 private:
  static void CallbackJS(napi_env env, napi_value callback, void *ctx, void *data);
  napi_env _env;
  napi_value _promise;
  AsyncData _data;
};

void GtkContextInit(Napi::Function &callback);
void GtkContextClose();
inline void GtkContextInvoke(Lambda &&lambda) {
#ifdef SINGLE_THREADED
  lambda();
#else
  if (!exited) {
    g_main_context_invoke(nullptr, sourceFunction, new Lambda(std::move(lambda)));
  } else {
    GST_CAT_LEVEL_LOG (context_debug, GST_LEVEL_WARNING, NULL, "GtkContext has closed");
  }
#endif
}


#ifndef SINGLE_THREADED
 class GContextWorker : public Napi::AsyncWorker {
 private:
  static GContextWorker *worker;
  GMainLoop *loop;
#ifdef DEBUG
  GThread *loop_thread;
#endif

 public:
  static void Init(Napi::Function &callback);
  static void Close();
  static void Check();
  static GMainContext* GetMainContext();

 private:
  GContextWorker(const Napi::Function &callback): ready(false), AsyncWorker(callback, "GtkContext") {}
  std::mutex lock;
  std::condition_variable check;
  bool ready;

 protected:
  void Execute() override;
};
#endif

#endif //NODE_GST_PLAYER_GCONTEXT_H

//
// Created by Andrei Sarakeev on 04/10/2018.
//

#include "gcontext.h"
#include <vector>
#include <gstreamermm/init.h>
#include <glibmm/init.h>
#include <giomm/init.h>
#include <pangomm/wrap_init.h>
#ifdef GTKMM_ATKMM_ENABLED
#include <atkmm/wrap_init.h>
#endif //GTKMM_ATKMM_ENABLED
#include <gdkmm/wrap_init.h>
#include <gtkmm/wrap_init.h>

namespace X11 {
#include <X11/Xlib.h>
}

GST_DEBUG_CATEGORY (context_debug);
#define GST_CAT_DEFAULT context_debug

std::vector<napi_threadsafe_function> tf_collections;

bool exiting = false;
bool exited = false;

#ifdef SINGLE_THREADED
#include <uv.h>

uv_timer_t timer;
Napi::FunctionReference callback_;

void iterate_main_loop(uv_timer_t *handle) {
  if (!exiting) {
    g_main_context_iteration(g_main_context_default(), FALSE);
  } else {
    uv_timer_stop(handle);
    uv_close((uv_handle_t *) &timer, nullptr);
    GST_DEBUG("stop timer");
  }
}

#else
GContextWorker *GContextWorker::worker = nullptr;

gboolean sourceFunction(gpointer user_data) {
  Lambda *l = static_cast<Lambda *>(user_data);
  (*l)();
  delete l;
  return FALSE;
}
#endif

AsyncMethod::AsyncMethod(Napi::Env env, Napi::Object receiver, const std::string &method) {
  _recv = Napi::Weak(receiver);
  auto func = receiver.Get(method).As<Napi::Function>();
  assert(func.IsFunction());
  napi_status status = napi_create_threadsafe_function(
      env, func, nullptr, Napi::String::New(env, method), 0, 1,
      nullptr, nullptr,
      this, AsyncMethod::CallIntoJS, &_tf_func);
//  assert(status == napi_ok);
  tf_collections.push_back(_tf_func);
  if (status != napi_ok) {
    const napi_extended_error_info *info = nullptr;
    if (napi_get_last_error_info(env, &info) == napi_ok) {
      g_error("ThreadSafeFunction error: %s", info->error_message);
    }
  }
}

AsyncMethod::~AsyncMethod() {
}

void AsyncMethod::CallIntoJS(napi_env env, napi_value callback, void *ctx, void *data) {
  auto self = static_cast<AsyncMethod *>(ctx);
  auto jsData = static_cast<JSData *>(data);
  if (env != nullptr && callback != nullptr && !self->_recv.IsEmpty()) {
    Napi::Function func(env, callback);
    std::vector<napi_value> args;
    args.resize(jsData->args.size() + 1);
    args[0] = Napi::String::New(env, jsData->event);
    std::transform(begin(jsData->args),
                   end(jsData->args),
                   args.begin() + 1,
                   [env](const JSArg &arg) { return ValueFromJSArg(env, arg); });
    func.Call(self->_recv.Value(), args);
  }
  delete jsData;
}

//void ThreadSafeFunction::Finalize(napi_env env, void *data, void *ctx) {
//  auto self = static_cast<ThreadSafeFunction *>(ctx);
//  self->_recv.Unref();
//}

void GtkContextInit(Napi::Function &callback) {
  GST_DEBUG_CATEGORY_INIT (context_debug, "avs_context", 2, "node_gst_player");
  Glib::init();
  Gio::init();

  // Populate the map of GTypes to C++ wrap_new() functions.
  Pango::wrap_init();
#ifdef GTKMM_ATKMM_ENABLED
  Atk::wrap_init();
#endif //GTKMM_ATKMM_ENABLED
  Gdk::wrap_init();
  Gtk::wrap_init();

  // Shall gtk_init() set the global C locale to the user's preferred locale?
//  if (!Glib::get_init_to_users_preferred_locale())
//    gtk_disable_setlocale();

  bool initialized = Gst::init_check();
  g_info("gstreamer %s initialized %s", Gst::version_string().c_str(), initialized ? "Ok" : "FAILED");
#ifndef SINGLE_THREADED
  GContextWorker::Init(callback);
#else
  // It is only necessary to call this function if multiple threads might use Xlib concurrently.
  // If all calls to Xlib functions are protected by some other access mechanism
  // Xlib thread initialization is not required.

  X11::XInitThreads();

  gdk_init(nullptr, nullptr);
  gtk_init(nullptr, nullptr);
  uv_timer_init(uv_default_loop(), &timer);
  uv_timer_start(&timer, iterate_main_loop, 10, 10);
  callback_ = Napi::Persistent(callback);
#endif
}

void GtkContextClose() {
  exiting = true;
  for (auto tf : tf_collections) {
    napi_release_threadsafe_function(tf, napi_tsfn_release);
  }
  tf_collections.clear();
#ifdef SINGLE_THREADED
  if (callback_) {
    callback_.Call(std::initializer_list<napi_value>{});
    callback_.Reset();
  }
#else
  GContextWorker::Close();
#endif
}

napi_value ValueFromJSArg(napi_env env, const JSArg &arg) {
  switch (arg.index()) {
    case 0:return Napi::Value::From(env, std::get<0>(arg));
    case 1:return Napi::Value::From(env, std::get<1>(arg));
    case 2:return Napi::Value::From(env, std::get<2>(arg));
    case 3:return Napi::Value::From(env, std::get<3>(arg));
    default:GST_WARNING("Unknown type of variant arg");
      return Napi::Value();
  }
}

#ifndef SINGLE_THREADED
void GContextWorker::Init(Napi::Function &callback) {
  if (worker) return;
  worker = new GContextWorker(callback);
  worker->Queue();
  std::unique_lock locker(worker->lock);
  while (!worker->ready) {
    worker->check.wait(locker);
  }
  GST_DEBUG("ready");
}

void GContextWorker::Close() {
  if (!worker || !worker->loop) return;
  GMainLoop *loop = nullptr;
  std::swap(worker->loop, loop);

  GtkContextInvoke([loop] {
    g_main_loop_quit(loop);
    g_main_loop_unref(loop);
    exited = true;
  });
}

GMainContext* GContextWorker::GetMainContext() {
  if (worker == nullptr) {
    GST_DEBUG("GtkContext is not initialized");
    return nullptr;
  }
  return g_main_loop_get_context(worker->loop);
}

void GContextWorker::Execute() {
  // It is only necessary to call this function if multiple threads might use Xlib concurrently.
  // If all calls to Xlib functions are protected by some other access mechanism
  // Xlib thread initialization is not required.

  X11::XInitThreads();

  gdk_init(nullptr, nullptr);
  gtk_init(nullptr, nullptr);

#ifdef DEBUG
  loop_thread = g_thread_self();
  GST_DEBUG("Main Loop Thread: %p", loop_thread);
#endif
  loop = g_main_loop_new(nullptr, FALSE);
  {
    std::lock_guard locker(lock);
    ready = true;
    check.notify_one();
  }
  g_main_loop_run(loop);
}
void GContextWorker::Check() {
#ifdef DEBUG
  g_assert_true(worker != nullptr);
  g_assert_true(worker->ready && worker->loop_thread == g_thread_self());
#endif
}

#endif

void noop(const Napi::CallbackInfo &info) {}

struct DeferredData {
  napi_deferred deferred;
  napi_threadsafe_function tsf;
};

AsyncDeferred::AsyncDeferred(napi_env env, napi_value callback) : _data{nullptr}, _promise{nullptr}, _env{env} {
//  auto func =  Napi::Function::New(env, noop);

  Napi::Function func(env, callback);
  if (func.IsEmpty()) {
    GST_DEBUG("DEFAULT FUNC");
    func = Napi::Function::New(env, noop);
  }
  auto data = new DeferredData{};
  auto status = napi_create_promise(env, &data->deferred, &_promise);
  assert(status == napi_ok);
  status = napi_create_threadsafe_function(env, func, nullptr, Napi::String::New(env, "AsyncPromise"), 0, 1,
                                         nullptr, nullptr, data, AsyncDeferred::CallbackJS, &data->tsf);
  assert(status == napi_ok);
  _data = data;
}

void AsyncDeferred::Resolve(AsyncData data, AsyncDeferred::ResolveLambda &&resolve) {
  auto deferredData = static_cast<DeferredData *>(data);
  assert(deferredData && deferredData->deferred && deferredData->tsf);
  auto status = napi_call_threadsafe_function(deferredData->tsf,
                                       new AsyncDeferred::ResolveLambda(std::move(resolve)),
                                       napi_tsfn_nonblocking);
  assert(status == napi_ok);
}

void AsyncDeferred::Reject(AsyncData data) {

}

void AsyncDeferred::CallbackJS(napi_env environment, napi_value callback, void *ctx, void *data) {
  Napi::Env env(environment);
  Napi::HandleScope handleScope(env);
  Napi::AsyncContext context(env, "AsyncPromise");
  Napi::CallbackScope scope(env, context);
  auto deferredData = static_cast<DeferredData *>(ctx);
  AsyncDeferred::ResolveLambda *getResult = static_cast<AsyncDeferred::ResolveLambda *>(data);
  Napi::Function func(env, callback);
  auto result = (*getResult)(env);
  delete getResult;
  func.MakeCallback(env.Global(), std::initializer_list<napi_value>{env.Null(), result}, context);
  auto status = napi_resolve_deferred(env, deferredData->deferred, result);
  delete deferredData;
  assert(status == napi_ok);
}

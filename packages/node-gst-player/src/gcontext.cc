//
// Created by Andrei Sarakeev on 04/10/2018.
//

#include "gcontext.h"
#include <vector>
#include <gstreamermm/init.h>
#include <assert.h>
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

std::vector<napi_threadsafe_function> tf_collections;

GContextWorker *GContextWorker::worker = nullptr;

ThreadSafeFunction::ThreadSafeFunction(Napi::Env env, Napi::Object receiver, std::string method) {
  _recv = Napi::Weak(receiver);
  auto func = receiver.Get(method).As<Napi::Function>();
  napi_status status = napi_create_threadsafe_function(
      env, func, nullptr, Napi::String::New(env, method), 0, 1,
      nullptr, nullptr,
      this, ThreadSafeFunction::CallIntoJS, &_tf_func);
  tf_collections.push_back(_tf_func);
  assert(status == napi_ok);
}

ThreadSafeFunction::~ThreadSafeFunction() {
}

void ThreadSafeFunction::Call(std::string event, std::string propName) {
  auto *data = new JSData{std::move(event), std::move(propName)};
  auto status = napi_call_threadsafe_function(_tf_func, data, napi_tsfn_nonblocking);
  assert(status == napi_ok);
}

void ThreadSafeFunction::CallIntoJS(napi_env env, napi_value callback, void *ctx, void *data) {
  auto self = static_cast<ThreadSafeFunction *>(ctx);
  auto jsData = static_cast<JSData *>(data);
  if (!(env == nullptr || callback == nullptr || self->_recv.IsEmpty())) {
    Napi::Function func(env, callback);
    func.Call(self->_recv.Value(), {Napi::String::New(env, jsData->event), Napi::String::New(env, jsData->propName)});
  }
  delete jsData;
}

//void ThreadSafeFunction::Finalize(napi_env env, void *data, void *ctx) {
//  auto self = static_cast<ThreadSafeFunction *>(ctx);
//  self->_recv.Unref();
//}

void GContextWorker::Init(Napi::Function &callback) {
  if (worker) return;
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
  g_debug("gstreamer initialized %s", initialized ? "Ok" : "FAILED");
  worker = new GContextWorker(callback);
  worker->Queue();
//  std::unique_lock<std::mutex> locker(worker->lock);
//  while (!worker->ready) {
//    g_debug("wait");
//    worker->check.wait(locker);
//    g_debug("check");
//  }
//  g_debug("ready");
}

void GContextWorker::Close() {
  if (!worker || !worker->loop) return;
  for(auto tf : tf_collections) {
    napi_release_threadsafe_function(tf, napi_tsfn_release);
  }
  GMainLoop *loop = nullptr;
  std::swap(worker->loop, loop);

  GContextInvoke([loop] {
    g_main_loop_quit(loop);
    g_main_loop_unref(loop);
  });
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
#endif
  loop = g_main_loop_new(nullptr, FALSE);
//  {
//    std::unique_lock<std::mutex> locker(lock);
//    ready = true;
//    check.notify_one();
//  }
  g_main_loop_run(loop);
}
void GContextWorker::Check() {
#ifdef DEBUG
  g_debug("CHECK_CONTEXT");
  g_assert_true(worker != nullptr && worker->loop_thread == g_thread_self());
#endif
}

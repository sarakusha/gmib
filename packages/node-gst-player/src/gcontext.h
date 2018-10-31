#include <utility>

//
// Created by Andrei Sarakeev on 18/09/2018.
//

#ifndef NODE_GST_PLAYER_GCONTEXT_H
#define NODE_GST_PLAYER_GCONTEXT_H

#include <functional>
#include <condition_variable>
#include <mutex>
#include <glib.h>
#include <napi.h>
#include <algorithm>
#include <gtk/gtk.h>

#include <node_api.h>

typedef std::function<void()> Lambda;

#define CHECK_CONTEXT() GContextWorker::Check();

inline void GContextInvoke(Lambda &&lambda) {
  gpointer func = new Lambda(std::forward<Lambda>(lambda));
  g_main_context_invoke(nullptr, [](gpointer user_data) -> gboolean {
    Lambda *l = static_cast<Lambda *>(user_data);
    (*l)();
    delete l;
    return FALSE;
  }, func);
}

class ThreadSafeFunction {
 public:
  ThreadSafeFunction(Napi::Env env, Napi::Object receiver, std::string method = "emit");
  virtual ~ThreadSafeFunction();
  ThreadSafeFunction(ThreadSafeFunction &&other) {
    _tf_func =  other._tf_func;
    other._tf_func = nullptr;
    _recv = std::move(other._recv);
  }

  ThreadSafeFunction &operator=(ThreadSafeFunction &&other) {
    _tf_func = other._tf_func;
    other._tf_func = nullptr;
    _recv = std::move(other._recv);
    return *this;
  }
  ThreadSafeFunction(ThreadSafeFunction &other) = delete;
  ThreadSafeFunction &operator=(ThreadSafeFunction &other) = delete;
  operator napi_threadsafe_function() const {
    return _tf_func;
  }
  void Call(std::string event, std::string propName);
 private:
  struct JSData {
    std::string event;
    std::string propName;
  };
  static void CallIntoJS(napi_env env, napi_value callback, void *ctx, void *data);
//  static void Finalize(napi_env env, void *data, void *ctx);

  napi_threadsafe_function _tf_func;
  Napi::ObjectReference _recv;
};

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

 private:
  GContextWorker(const Napi::Function &callback): /* ready(false), */ AsyncWorker(callback, "GtkContext") {}
//  std::mutex lock;
//  std::condition_variable check;
//  bool ready;

 protected:
  void Execute() override;
};

#endif //NODE_GST_PLAYER_GCONTEXT_H

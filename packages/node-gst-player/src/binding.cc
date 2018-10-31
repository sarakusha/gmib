//
// Created by Andrei Sarakeev on 18/09/2018.
//
#include <napi.h>
#include "gstplayer.h"
#include "gcontext.h"
#include "screen.h"
#include "xrandr.h"

bool isInitialized = false;

void GContextInit(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (isInitialized) {
    Napi::Error::New(env, "Re-initialize").ThrowAsJavaScriptException();
    return;
  }
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return;
  }

  if (!info[0].IsFunction()) {
    Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
    return;
  }

  Napi::Function cb = info[0].As<Napi::Function>();

  GContextWorker::Init(cb);
  ScreenInit();
  isInitialized = true;
}

void GContextClose(const Napi::CallbackInfo &info) {
//  GContextInvoke([]() { XrandrClose(); });
  GContextWorker::Close();
}


Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "init"), Napi::Function::New(env, GContextInit));
  exports.Set(Napi::String::New(env, "close"), Napi::Function::New(env, GContextClose));
  XrandrInit(env, exports);
  GstPlayer::Init(env, exports);
  return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
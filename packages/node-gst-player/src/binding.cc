//
// Created by Andrei Sarakeev on 18/09/2018.
//
#include <napi.h>
#include <gst/gstinfo.h>
#include "player.h"
#include "gcontext.h"
#include "screen.h"
#include "xrandr.h"

bool isInitialized = false;
GST_DEBUG_CATEGORY (avs_debug);
#define GST_CAT_DEFAULT avs_debug

void Initialize(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
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

  GtkContextInit(cb);
  ScreenInit();
  isInitialized = true;
}

void Close(const Napi::CallbackInfo &info) {
  Napi::HandleScope scope(info.Env());
  GtkContextClose();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  GST_DEBUG_CATEGORY_INIT (avs_debug, "avs", 0, "node-avs-player");
  exports.Set(Napi::String::New(env, "init"), Napi::Function::New(env, Initialize));
  exports.Set(Napi::String::New(env, "close"), Napi::Function::New(env, Close));
  XrandrInit(env, exports);
  Player::Init(env, exports);
  return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
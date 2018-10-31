//
// Created by Andrei Sarakeev on 03/10/2018.
//
#include "gstplayer.h"
#include "xrandr.h"
#include "screen.h"
#include <condition_variable>
#include <utility>
#include <gstreamermm/elementfactory.h>
#include <gstreamermm/parse.h>
#include <gstreamermm/discoverer.h>
#include <gstreamermm/discovererinfo.h>
#include <gstreamermm/bus.h>
#include <gstreamermm/videooverlay.h>
#include <cairomm/refptr.h>
#include <cairomm/context.h>
#include <gdk/gdk.h>

#if defined (GDK_WINDOWING_X11)
using namespace X11;
#include <gdk/gdkx.h>
#elif defined (GDK_WINDOWING_WIN32)
#include <gdk/gdkwin32.h>
#elif defined (GDK_WINDOWING_QUARTZ)
#include <gdk/gdkquartz.h>
using namespace X11;
#endif

static Glib::RefPtr<Gst::VideoOverlay> find_overlay(Glib::RefPtr<Gst::Element> element)
{
  g_debug("find2 vo in %s", element->get_name().c_str());
  auto overlay = Glib::RefPtr<Gst::VideoOverlay>::cast_dynamic(element);

  if (overlay)
    return overlay;

  auto bin = Glib::RefPtr<Gst::Bin>::cast_dynamic(element);

  if (!bin)
    return overlay;

  for (auto e : bin->get_children())
  {
    overlay = find_overlay(e);
    if (overlay)
      break;
  }

  return overlay;
}

Napi::FunctionReference GstPlayer::constructor;

bool onBlackDraw(const Cairo::RefPtr<Cairo::Context> &context) {
  g_debug("onBlackDraw");
  if (context) context->set_source_rgba(0, 0, 0, 1);
  return false;
}

Napi::Object GstPlayer::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "GstPlayer", {
      InstanceAccessor("playlist", &GstPlayer::GetPlaylist, &GstPlayer::SetPlaylist),
      InstanceAccessor("screen", &GstPlayer::GetScreen, &GstPlayer::SetScreen),
      InstanceAccessor("width", &GstPlayer::GetWidth, &GstPlayer::SetWidth),
      InstanceAccessor("height", &GstPlayer::GetHeight, &GstPlayer::SetHeight),
      InstanceAccessor("left", &GstPlayer::GetLeft, &GstPlayer::SetLeft),
      InstanceAccessor("top", &GstPlayer::GetTop, &GstPlayer::SetTop),
      InstanceAccessor("output", &GstPlayer::GetOutput, &GstPlayer::SetOutput),
      InstanceAccessor("preferredOutputModel", &GstPlayer::GetPreferredOutputModel, &GstPlayer::SetPreferredOutputModel),
      InstanceAccessor("current", &GstPlayer::GetCurrent, &GstPlayer::SetCurrent),
      InstanceMethod("show", &GstPlayer::Show),
      InstanceMethod("hide", &GstPlayer::Hide),
      InstanceMethod("play", &GstPlayer::Play)
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("GstPlayer", func);
  return exports;
}

GstPlayer::GstPlayer(const Napi::CallbackInfo &info) :
    Napi::ObjectWrap<GstPlayer>(info),
    output("auto"),
    screenNumber(DefaultScreen(getDisplay())),
    needUpdateLayout(false),
    show(true),
    letterBoxing(false),
    left(0),
    top(0),
    width(320),
    height(240),
    emit(info.Env(), this->Value()) {
  auto env = info.Env();
  Napi::HandleScope scope(env);
  if (info.Length() > 0) {
    if (!info[0].IsString()) {
      Napi::TypeError::New(env, "output name expected").ThrowAsJavaScriptException();
      return;
    }
    output = info[0].As<Napi::String>().Utf8Value();
    if (info.Length() > 1 && !info[1].IsNumber()) {
      Napi::TypeError::New(env, "screen number expected").ThrowAsJavaScriptException();
      return;
    }
    screenNumber = info[1].As<Napi::Number>().Int32Value();
  }
  auto emptyArray = Napi::Array::New(env, 0);
  _playlistRef.Reset(emptyArray);
  auto playbin = Gst::ElementFactory::create_element("playbin");
  _playbin = Glib::RefPtr<Gst::Pipeline>::cast_static(playbin);
  if (!playbin) {
    Napi::Error::New(env, "Cannot find playbin element").ThrowAsJavaScriptException();
    return;
  }
  string
  videoSinkDescription =
      "videoconvert "
      #ifdef AVS_PICTURE
      "! avspicture name=avspicture"
      #endif
      "! aspectratiocrop name=aspect "
      "! progressreport silent=true update-freq=1 do-query=false "
      #ifdef MACOSX
      "! glimagesink name=renderer";
#else
  "! xvimagesink name=renderer";
#endif

  try {
    auto videoSink = Gst::Parse::create_bin(videoSinkDescription, true);
    if (!videoSink) {
      Napi::Error::New(env, "Cannot create pipeline").ThrowAsJavaScriptException();
      return;
    }
    _playbin->set_property("video-sink", videoSink);
    aspect = Glib::RefPtr<Gst::Bin>::cast_dynamic(_playbin)->get_element("aspect");
  } catch (Gst::ParseError &err) {
    Napi::Error::New(env, err.what()).ThrowAsJavaScriptException();
    return;
  }
  auto bus = _playbin->get_bus();
  bus->enable_sync_message_emission();
  bus->signal_sync_message().connect(sigc::mem_fun(*this, &GstPlayer::OnBusMessageSync));


  GContextInvoke([this]() {
    video = Gtk::manage(new Gtk::DrawingArea());
    video->set_sensitive(false);
    video->set_can_focus(false);
    video->set_double_buffered(false);
    video->set_halign(Gtk::ALIGN_START);
    video->set_valign(Gtk::ALIGN_START);
    video->set_no_show_all(true);
    video->signal_draw().connect(sigc::ptr_fun(&onBlackDraw));
    UpdateLayout();
  });
}

void GstPlayer::AsyncEmit(std::string event, std::string propName) {
  emit.Call(std::move(event), std::move(propName));
}

void GstPlayer::Emit(const Napi::CallbackInfo &info, string event, string propName) {
  auto env = info.Env();
  auto self = info.This();
  self.As<Napi::Object>().Get("emit")
      .As<Napi::Function>().Call(self,
                                 {Napi::String::New(env, event),
                                  Napi::String::New(env, propName)});
}

GstPlayer::~GstPlayer() {
//  if (_playbin) {
//    auto bus = _playbin->get_bus();
//    if (bus) {
//      bus->remove_signal_watch();
//    }
//  }
}

void GstPlayer::SetPlaylist(const Napi::CallbackInfo &info, const Napi::Value &value) {
  auto env = info.Env();
  Napi::HandleScope scope(env);
  if (!value.IsArray()) {
    Napi::TypeError::New(env, "array expected").ThrowAsJavaScriptException();
    return;
  }

  auto array = value.As<Napi::Array>();
  auto size = array.Length();
  Playlist playlist;
  playlist.reserve(size);
  auto playlistValue = Napi::Array::New(env, size);

  auto discovered = [this](const Glib::RefPtr<Gst::DiscovererInfo> &info, const Glib::Error &error) {
    if (error.gobj() != nullptr) {
      g_warning("error while discover %s: %s", info->get_uri().c_str(), error.what().c_str());
      return;
    }
    g_debug("%s has duration %llus", info->get_uri().c_str(), info->get_duration() / Gst::SECOND);
    _info.emplace(info->get_uri(), info);
  };

  mutex lock;
  condition_variable check;
  bool isFinished = false;

  auto finished = [this, &playlist, &check, &lock, &isFinished]() {
    unique_lock<mutex> locker(lock);
    isFinished = true;
    check.notify_one();
  };

  if (size > 0) {
#ifdef MACOSX
    auto discoverer = Gst::Discoverer::create((unsigned long) Gst::SECOND);
#else
    auto discoverer = Gst::Discoverer::create(Gst::SECOND);
#endif
    discoverer->signal_discovered().connect(discovered);
    discoverer->signal_finished().connect(finished);
    discoverer->start();
    for (uint32_t i = 0; i < size; i++) {
      auto uriValue = array.Get(i);
      if (!uriValue.IsString()) {
        g_warning("string expected in playlist");
        continue;
      }
      playlistValue.Set(i, uriValue);
      auto uri = uriValue.As<Napi::String>().Utf8Value();
      playlist.push_back(uri);
      static const auto offset = sizeof("file://") - 1;
      const auto file = uri.c_str() + offset;
      if (access(file, F_OK) == -1) {
        g_warning("file %s not found", file);
      } else {
        auto it = _info.find(uri);
        if (it == _info.end() || !it->second) {
          discoverer->discover_uri_async(uri);
        }
      }
    }
    unique_lock<mutex> locker(lock);
    while (!isFinished) check.wait(locker);
  }

  {
    unique_lock<mutex> locker(_lock);
    swap(_playlist, playlist);
  }

  UpdateTotal();

  _playlistRef.Reset(playlistValue, 1);
}

Napi::Value GstPlayer::GetPlaylist(const Napi::CallbackInfo &info) {
  return _playlistRef.Value();
}

void GstPlayer::UpdateTotal() {

}

void GstPlayer::OnBusMessageSync(const Glib::RefPtr<Gst::Message> &message) {
  switch (message->get_message_type()) {
    case Gst::MESSAGE_ELEMENT: {
      g_debug("message: %s", message->get_structure().to_string().c_str());
      if (gst_is_video_overlay_prepare_window_handle_message(message->gobj())) {
        /* Retrieve window handler from GDK */
        guintptr window_handle;
        GdkWindow *window = video->get_window()->gobj();
#if defined (GDK_WINDOWING_WIN32)
        window_handle = (guintptr)GDK_WINDOW_HWND (window);
#elif defined (GDK_WINDOWING_QUARTZ)
        window_handle = (guintptr) gdk_quartz_window_get_nsview(window);
#elif defined (GDK_WINDOWING_X11)
        window_handle = GDK_WINDOW_XID (window);
#endif
        auto xoverlay =  find_overlay(Glib::RefPtr<Gst::Element>::cast_dynamic(message->get_source()));
        if (xoverlay) {
          g_debug("FOUND XOVERLAY");
          xoverlay->set_window_handle(window_handle);
        } else {
          auto source = message->get_source()->gobj();
          if (GST_IS_VIDEO_OVERLAY(source)) {
            g_debug("WINDOW_HANDLE %lu", window_handle);
            gst_video_overlay_set_window_handle(GST_VIDEO_OVERLAY (source), window_handle);
          }
        }
      }
    }
    default:return;
  }
}
Napi::Value GstPlayer::GetScreen(const Napi::CallbackInfo &info) {
  return Napi::Number::New(info.Env(), screenNumber);
}

void GstPlayer::SetScreen(const Napi::CallbackInfo &info, const Napi::Value &value) {
  auto env = info.Env();
  if (!value.IsNumber()) {
    Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
    return;
  }

  int32_t screenVal = value.As<Napi::Number>();
  AsyncLayout([this, screenVal]() {
    screenNumber = screenVal;
  });
  Emit(info, "changed", "screen");
}
void GstPlayer::AsyncLayout(Lambda &&lambda) {
  unique_lock<mutex> locker(_lock);
  lambda();
  if (!needUpdateLayout) {
    needUpdateLayout = true;
    GContextInvoke([this]() { UpdateLayout(); });
  }
}

void GstPlayer::UpdateLayout() {
  CHECK_CONTEXT();
  unique_lock<mutex> locker(_lock);
  video->set_size_request(width, height);

  if (aspect) {
    int nom = letterBoxing ? 0 : width;
    int denom = letterBoxing ? 1 : height;
    Glib::Value<Gst::Fraction> value;
    value.init(Glib::Value<Gst::Fraction>::value_type());
    value.set(Gst::Fraction(nom, denom));
    aspect->set_property_value("aspect-ratio", value);
  }
  SetWindowOutput(video, left, top, output, preferredOutputModel, screenNumber);
  needUpdateLayout = false;
}

bool CheckPositiveEvenNumber(const Napi::CallbackInfo &info, const Napi::Value value) {
  auto env = info.Env();
  if (!value.IsNumber()) {
    Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
    return false;
  }
  int widthVal = value.As<Napi::Number>();
  if (widthVal <= 0) {
    Napi::RangeError::New(env, "Value must be greater than zero").ThrowAsJavaScriptException();
    return false;
  }
  if (widthVal % 2 != 0) {
    Napi::RangeError::New(env, "Value must be even").ThrowAsJavaScriptException();
    return false;
  }
  return true;
}

Napi::Value GstPlayer::GetWidth(const Napi::CallbackInfo &info) {
  return Napi::Number::New(info.Env(), width);
}

void GstPlayer::SetWidth(const Napi::CallbackInfo &info, const Napi::Value &value) {
  if (!CheckPositiveEvenNumber(info, value)) return;

  int32_t widthVal = value.As<Napi::Number>();
  AsyncLayout([widthVal, this] () {
    width = widthVal;
  });
  Emit(info, "changed", "width");
}

Napi::Value GstPlayer::GetHeight(const Napi::CallbackInfo &info) {
  return Napi::Number::New(info.Env(), height);
}

void GstPlayer::SetHeight(const Napi::CallbackInfo &info, const Napi::Value &value) {
  if (!CheckPositiveEvenNumber(info, value)) return;

  int32_t heightVal = value.As<Napi::Number>();
  AsyncLayout([heightVal, this] () {
    height = heightVal;
  });
  Emit(info, "changed", "height");
}

Napi::Value GstPlayer::GetLeft(const Napi::CallbackInfo &info) {
  return Napi::Number::New(info.Env(), left);
}

void GstPlayer::SetLeft(const Napi::CallbackInfo &info, const Napi::Value &value) {
  if (!CheckPositiveEvenNumber(info, value)) return;
  int32_t leftVal = value.As<Napi::Number>();
  AsyncLayout([leftVal, this] () {
    left = leftVal;
  });
  Emit(info, "changed", "left");
}

Napi::Value GstPlayer::GetTop(const Napi::CallbackInfo &info) {
  return Napi::Number::New(info.Env(), top);
}

void GstPlayer::SetTop(const Napi::CallbackInfo &info, const Napi::Value &value) {
  if (!CheckPositiveEvenNumber(info, value)) return;

  int32_t topVal = value.As<Napi::Number>();
  AsyncLayout([topVal, this] () {
    top = topVal;
  });
  Emit(info, "changed", "top");
}

Napi::Value GstPlayer::GetOutput(const Napi::CallbackInfo &info) {
  return Napi::String::New(info.Env(), output);
}

void GstPlayer::SetOutput(const Napi::CallbackInfo &info, const Napi::Value &value) {
  auto env = info.Env();
  if (!value.IsString()) {
    Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
    return;
  }

  string outputVal = value.As<Napi::String>();
  AsyncLayout([outputVal, this] () {
    output = outputVal;
  });
  Emit(info, "changed", "output");

}

Napi::Value GstPlayer::GetPreferredOutputModel(const Napi::CallbackInfo &info) {
  return Napi::String::New(info.Env(), preferredOutputModel);
}

void GstPlayer::SetPreferredOutputModel(const Napi::CallbackInfo &info, const Napi::Value &value) {
  auto env = info.Env();
  if (!value.IsString()) {
    Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
    return;
  }
  string modelVal = value.As<Napi::String>();
  AsyncLayout([modelVal, this] () {
    preferredOutputModel = modelVal;
  });
  Emit(info, "changed", "preferredOutputModel");
}

void GstPlayer::Show(const Napi::CallbackInfo &info) {
  GContextInvoke([this] () {
    video->show();
  });
}

void GstPlayer::Hide(const Napi::CallbackInfo &info) {
  GContextInvoke([this] () {
    video->hide();
  });
}

void GstPlayer::Play(const Napi::CallbackInfo &info) {
  _playbin->set_state(Gst::STATE_PLAYING);
}

void GstPlayer::Pause(const Napi::CallbackInfo &info) {

}

void GstPlayer::Stop(const Napi::CallbackInfo &info) {

}
Napi::Value GstPlayer::GetCurrent(const Napi::CallbackInfo &info) {
  Glib::ustring current;
  _playbin->get_property("current_uri", current);
  return Napi::String::New(info.Env(), current);
}
void GstPlayer::SetCurrent(const Napi::CallbackInfo &info, const Napi::Value &value) {
  if (!value.IsNumber()) {
    Napi::TypeError::New(info.Env(), "Number expected").ThrowAsJavaScriptException();
    return;
  }
  int32_t index = value.As<Napi::Number>();
  if (index < 0 || _playlist.size() <= index) {
    Napi::RangeError::New(info.Env(), "Index is out of range").ThrowAsJavaScriptException();
    return;
  }
#ifdef MACOSX
  _playbin->set_property("uri", _playlist[index]);
#else
  _playbin->set_property("uri", _playlist[index == 0 ? 1 : index]);
#endif
}

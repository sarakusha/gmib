//
// Created by Andrei Sarakeev on 03/10/2018.
//
#include "player.h"
#include "xrandr.h"
#include "screen.h"
#include <cassert>
#include <gst/player/gstplayer.h>
#include <gst/player/gstplayer-video-overlay-video-renderer.h>
#include "generic-signal.h"
#include "utils.h"

#if defined (GDK_WINDOWING_X11)
using namespace X11;
#include <gdk/gdkx.h>
#elif defined (GDK_WINDOWING_WIN32)
#include <gdk/gdkwin32.h>
#elif defined (GDK_WINDOWING_QUARTZ)
#include <gdk/gdkquartz.h>
using namespace X11;
#endif

GST_DEBUG_CATEGORY (player_debug);
#define GST_CAT_DEFAULT player_debug

static const Glib::SignalProxyInfo GstPlayer_signal_end_of_stream_info =
    {
        "end-of-stream",
        (GCallback) &Glib::SignalProxyNormal::slot0_void_callback,
        (GCallback) &Glib::SignalProxyNormal::slot0_void_callback
    };

#if 0
static Glib::RefPtr<Gst::VideoOverlay> find_overlay(Glib::RefPtr<Gst::Element> element) {
  GST_DEBUG("find2 vo in %s", element->get_name().c_str());
  auto overlay = Glib::RefPtr<Gst::VideoOverlay>::cast_dynamic(element);

  if (overlay)
    return overlay;

  auto bin = Glib::RefPtr<Gst::Bin>::cast_dynamic(element);

  if (!bin)
    return overlay;

  for (auto e : bin->get_children()) {
    overlay = find_overlay(e);
    if (overlay)
      break;
  }

  return overlay;
}
#endif

Napi::FunctionReference Player::_constructor;

bool onBlackDraw(const Cairo::RefPtr<Cairo::Context> &context) {
  if (context) {
    context->set_source_rgba(0, 0, 0, 1);
    context->paint();
  }
  return false;
}

Napi::Object Player::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  GST_DEBUG_CATEGORY_INIT (player_debug, "avs_player", 1, "node_gst_player");

  Napi::Function func = DefineClass(env, "Player", {
      StaticMethod("discover", &Player::Discover),
      InstanceAccessor("playlist", &Player::GetPlaylist, &Player::SetPlaylist),
      InstanceAccessor("screen", &Player::GetScreen, &Player::SetScreen),
      InstanceAccessor("width", &Player::GetWidth, &Player::SetWidth),
      InstanceAccessor("height", &Player::GetHeight, &Player::SetHeight),
      InstanceAccessor("left", &Player::GetLeft, &Player::SetLeft),
      InstanceAccessor("top", &Player::GetTop, &Player::SetTop),
      InstanceAccessor("output", &Player::GetOutput, &Player::SetOutput),
      InstanceAccessor("preferredOutputModel",
                       &Player::GetPreferredOutputModel,
                       &Player::SetPreferredOutputModel),
      InstanceAccessor("loop", &Player::GetLoop, &Player::SetLoop),
      InstanceAccessor("currentUri", &Player::GetCurrentUri, nullptr),
      InstanceAccessor("current", &Player::GetCurrent, &Player::SetCurrent),
      InstanceAccessor("volume", &Player::GetVolume, &Player::SetVolume),
      InstanceAccessor("mute", &Player::GetMute, &Player::SetMute),
      InstanceAccessor("state", &Player::GetState, nullptr),
      InstanceAccessor("position", &Player::GetPosition, nullptr),
      InstanceAccessor("accurateSeek", &Player::GetAccurateSeek, &Player::SetAccurateSeek),
      InstanceAccessor("duration", &Player::GetDuration, nullptr),
      InstanceAccessor("audioEnabled", &Player::GetAudioEnabled, &Player::SetAudioEnabled),
      InstanceAccessor("subtitleEnabled", &Player::GetSubtitleEnabled, &Player::SetSubtitleEnabled),
      InstanceAccessor("letterboxing", &Player::GetLetterboxing, &Player::SetLetterboxing),
      InstanceAccessor("origin", &Player::GetOrigin, nullptr),
      InstanceMethod("show", &Player::Show),
      InstanceMethod("hide", &Player::Hide),
      InstanceMethod("play", &Player::Play),
      InstanceMethod("pause", &Player::Pause),
      InstanceMethod("stop", &Player::Stop),
      InstanceMethod("seek", &Player::Seek)
  });

  _constructor = Napi::Persistent(func);
  _constructor.SuppressDestruct();

  exports.Set("Player", func);
  return exports;
}

Player::Player(const Napi::CallbackInfo &info) :
    Napi::ObjectWrap<Player>(info),
    output("auto"),
    screenNumber(DefaultScreen(getDisplay())),
    needUpdateLayout(false),
    show(true),
    _letterBoxing(false),
    _left(0),
    _top(0),
    _width(320),
    _height(240),
    _loop(true),
    _current(0),
    _state{PlayerState::Stopped},
    _skipped{false},
    _audioEnabled{false},
    _subtitleEnabled{false},
    _emit(info.Env(), this->Value()) {
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
  _playlistRef.Reset(Napi::Array::New(env, 0));
  _usePlaybin = getenv("NODE_GST_PLAYER_USE_PLAYBIN") || getenv("USE_PLAYBIN3");
  auto playbin = Gst::ElementFactory::create_element("playbin");
  _playbin = Glib::RefPtr<Gst::Pipeline>::cast_static(playbin);
  if (!playbin) {
    Napi::Error::New(env, "Cannot find playbin element").ThrowAsJavaScriptException();
    return;
  }

  string
  sink = getenv("NODE_GST_PLAYER_USE_XVIMAGESINK")
         ? "xvimagesink name=renderer"
         : "autovideosink name=renderer";

  string
  scale = getenv("NODE_GST_PLAYER_USE_SCALE")
          ? "videoscale ! capsfilter name=filter ! "
          : "";

  string
  videoSinkDescription =
//      "videoconvert ! "
      "avspicture name=avspicture ! "
      "aspectratiocrop name=aspect ! "
      //      "! progressreport silent=true update-freq=1 do-query=false "

      #ifdef MACOSX
      "glimagesink name=renderer";
#else
  + scale
  + sink;
#endif //MACOSX

  try {
    auto videoSink = Gst::Parse::create_bin(videoSinkDescription, true);
    if (_usePlaybin) {
      _playbin->set_property("video-sink", videoSink);
    } else {
      _renderer = gst_player_video_overlay_video_renderer_new_with_sink(nullptr, videoSink->gobj());
    }
    aspect = Glib::RefPtr<Gst::Bin>::cast_dynamic(videoSink)->get_element("aspect");
    _filter = Glib::RefPtr<Gst::Bin>::cast_static(videoSink)->get_element("filter");
  } catch (Gst::ParseError &err) {
    Napi::Error::New(env, err.what()).ThrowAsJavaScriptException();
    return;
  }

  if (_usePlaybin) {
    auto bus = _playbin->get_bus();
    bus->enable_sync_message_emission();
    bus->signal_sync_message().connect(sigc::mem_fun(*this, &Player::OnBusMessageSync));
    bus->add_watch(sigc::mem_fun(*this, &Player::OnBusMessage));
  } else {
#ifdef MACOSX
    GstPlayerSignalDispatcher *dispatcher = gst_player_g_main_context_signal_dispatcher_new(g_main_context_default());
#else
    GstPlayerSignalDispatcher *dispatcher = gst_player_g_main_context_signal_dispatcher_new(GContextWorker::GetMainContext());
#endif
    _player = Glib::wrap(GST_OBJECT(gst_player_new(_renderer, dispatcher)));
    Glib::SignalProxy<void>(_player.get(), &GstPlayer_signal_end_of_stream_info)
        .connect(sigc::mem_fun(*this, &Player::OnEOS));
    signal_callback<void(GError *)> signal_error_wrapper;
    signal_error_wrapper("error", _player).connect(sigc::mem_fun(*this, &Player::OnError));
    signal_callback<void(GError *)> signal_warning_wrapper;
    signal_warning_wrapper("warning", _player).connect([this](GError *error) {
      Glib::Error err(error);
      GST_WARNING("Warning: %s", err.what().c_str());
      AsyncEmit("warning", err.what());
    });
    auto config = gst_player_get_config(GST_PLAYER(_player->gobj()));
    gst_player_config_set_position_update_interval(config, 1000);
    gst_player_set_config(GST_PLAYER(_player->gobj()), config);

    signal_callback<void(guint64)> signal_position_update_wrapper;
    signal_position_update_wrapper("position-updated", _player).connect([this](guint64 position) {
      auto duration = gst_player_get_duration(GST_PLAYER(_player->gobj()));
      AsyncEmit("position",
                ((double) position / GST_SECOND),
                static_cast<int>(std::round(100.0 * position / duration)));
    });
    signal_callback<void(guint64)> signal_duration_changed_wrapper;
    signal_duration_changed_wrapper("duration-changed", _player).connect([this](guint64) {
      AsyncEmit("changed", "duration"s);
    });
    signal_callback<void(guint64)> signal_seek_done_wrapper;
    signal_seek_done_wrapper("seek-done", _player).connect([this](guint64 position) {
      AsyncEmit("seek-done", (double) position / GST_SECOND);
    });
    signal_callback<void(GstPlayerState)> signal_state_wrapper;
    signal_state_wrapper("state-changed", _player).connect([this](GstPlayerState state) {
      AsyncEmit("state-changed", std::string(gst_player_state_get_name(state)));
      if (state == GST_PLAYER_STATE_STOPPED && _state == PlayerState::Stopped) {
        _video->queue_draw();
      }
    });
    signal_callback<void(gchar *)> signal_loaded_wrapper;
    signal_loaded_wrapper("uri-loaded", _player).connect([this](gchar *uri) {
      gchar *filename = g_filename_from_uri(uri, nullptr, nullptr);
      AsyncEmit("uri-loaded", std::string{filename});
      g_free(filename);
    });
  }

  GtkContextInvoke([this]() {
    _video = Gtk::manage(new Gtk::DrawingArea());
    _video->set_sensitive(false);
    _video->set_can_focus(false);
    _video->set_double_buffered(false);
    _video->set_halign(Gtk::ALIGN_START);
    _video->set_valign(Gtk::ALIGN_START);
    _video->set_no_show_all(true);
    _video->signal_draw().connect(sigc::ptr_fun(&onBlackDraw));
    if (!_usePlaybin) {
      _video->signal_realize().connect(sigc::mem_fun(*this, &Player::OnVideoRealise));
    }
    UpdateLayout();
  });
}

Player::~Player() {
  if (_renderer) {
    gst_object_unref(_renderer);
  }
}

void Player::SetPlaylist(const Napi::CallbackInfo &info, const Napi::Value &value) {
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
      GST_WARNING("error while discover %s: %s", info->get_uri().c_str(), error.what().c_str());
      return;
    }
    GST_DEBUG("%s has duration %"
                  G_GUINT64_FORMAT
                  "s", info->get_uri().c_str(), info->get_duration() / Gst::SECOND);
    _info.emplace(info->get_uri(), info);
  };

#ifndef SINGLE_THREADED
  mutex lock;
  condition_variable check;
  bool isFinished = false;

  auto finished = [this, &playlist, &check, &lock, &isFinished]() {
    lock_guard locker(lock);
    isFinished = true;
    check.notify_one();
  };
#endif

  if (size > 0) {
#ifdef MACOSX
    auto discoverer = Gst::Discoverer::create((unsigned long) Gst::SECOND);
#else
    auto discoverer = Gst::Discoverer::create(Gst::SECOND);
#endif
    discoverer->signal_discovered().connect(discovered);
#ifndef SINGLE_THREADED
    discoverer->signal_finished().connect(finished);
#endif
    discoverer->start();
    for (uint32_t i = 0; i < size; i++) {
      auto uriValue = array.Get(i);
      if (!uriValue.IsString()) {
        GST_WARNING("string expected in playlist");
        continue;
      }
      auto uri = uriValue.As<Napi::String>().Utf8Value();
      if (!gst_uri_is_valid(uri.c_str())) {
        auto gsturi = gst_filename_to_uri(uri.c_str(), nullptr);
        uri = gsturi;
        g_free(gsturi);
      }
      playlistValue.Set(i, Napi::String::New(env, uri));
      playlist.push_back(uri);
      auto file = g_filename_from_uri(uri.c_str(), nullptr, nullptr);
      if (access(file, F_OK) == -1) {
        GST_WARNING("file %s not found", file);
      } else {
        auto it = _info.find(uri);
        if (it == _info.end() || !it->second) {
          discoverer->discover_uri_async(uri);
        }
      }
      g_free(file);
    }
#ifndef SINGLE_THREADED
    unique_lock locker(lock);
    while (!isFinished) check.wait(locker);
#endif
  }

  {
#ifndef DISABLE_LOCK
    lock_guard locker(_lock);
#endif
    swap(_playlist, playlist);
  }

  UpdateTotal();

  _playlistRef.Reset(playlistValue, 1);
}

Napi::Value Player::GetPlaylist(const Napi::CallbackInfo &info) {
  return _playlistRef.Value();
}

void Player::UpdateTotal() {

}

void Player::OnBusMessageSync(const Glib::RefPtr<Gst::Message> &message) {
  switch (message->get_message_type()) {
    case Gst::MESSAGE_ELEMENT: {
      auto structure = message->get_structure();
      if (structure) GST_DEBUG("message: %s", structure.to_string().c_str());
      if (gst_is_video_overlay_prepare_window_handle_message(message->gobj()) && _video && _video->get_realized()) {
        /* Retrieve window handler from GDK */
        guintptr window_handle;
        GdkWindow *window = _video->get_window()->gobj();
#if defined (GDK_WINDOWING_WIN32)
        window_handle = (guintptr)GDK_WINDOW_HWND (window);
#elif defined (GDK_WINDOWING_QUARTZ)
        window_handle = (guintptr) gdk_quartz_window_get_nsview(window);
#elif defined (GDK_WINDOWING_X11)
        window_handle = GDK_WINDOW_XID (window);
#endif
        auto source = message->get_source()->gobj();
        if (GST_IS_VIDEO_OVERLAY(source)) {
          gst_video_overlay_set_window_handle(GST_VIDEO_OVERLAY (source), window_handle);
          GST_DEBUG("SET OVERLAY");
        } else {
          GST_WARNING("overlay not found");
        }
      }
    }
    default:return;
  }
}

// This function is used to receive asynchronous messages from play_bin's bus
bool Player::OnBusMessage(const Glib::RefPtr<Gst::Bus> & /* bus */,
                          const Glib::RefPtr<Gst::Message> &message) {
  switch (message->get_message_type()) {
    case Gst::MESSAGE_EOS: {
      _playbin->set_state(Gst::STATE_NULL);
      GST_DEBUG("EOS playbin");
      AsyncEmit("EOS");
      _playbin->set_property("uri", _playlist[0]);
//      auto overlay = _playbin->get_element(GST_TYPE_VIDEO_OVERLAY);
//      assert(overlay);
//      gst_video_overlay_expose(GST_VIDEO_OVERLAY(overlay->gobj()));
//      GtkContextInvoke([this]() {
//        video->get_window()->invalidate(true);
//      });
      _playbin->set_state(Gst::STATE_PLAYING);
      break;
    }
    case Gst::MESSAGE_ERROR: {
      Glib::RefPtr<Gst::MessageError> msg_error = Glib::RefPtr<Gst::MessageError>::cast_static(message);
      if (msg_error) {
        Glib::Error err = msg_error->parse_error();
        GST_WARNING("Error: %s", err.what().c_str());
//        GST_WARNING("Error: %s", msg_error->parse_debug().c_str());
        AsyncEmit("error", err.what());
      } else {
        GST_WARNING(" Bus Error.");
      }
      break;
    }
    default: {
      auto structure = message->get_structure();
      if (structure) g_info("bus unhandled async message=%s", structure.to_string().c_str());
    }
  }
  return true;
}

Napi::Value Player::GetScreen(const Napi::CallbackInfo &info) {
  return Napi::Number::New(info.Env(), screenNumber);
}

void Player::SetScreen(const Napi::CallbackInfo &info, const Napi::Value &value) {
  auto env = info.Env();
  if (!value.IsNumber()) {
    Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
    return;
  }

  int32_t screenVal = value.As<Napi::Number>();
  AsyncLayout([this, screenVal]() {
    screenNumber = screenVal;
    if (_monitorChanged.connected()) {
      _monitorChanged.disconnect();
    }
  });
  Emit(info, "changed", "screen");
}

void Player::AsyncLayout(Lambda &&lambda) {
#ifndef DISABLE_LOCK
  lock_guard locker(_lock);
#endif
  lambda();
  if (!needUpdateLayout) {
    needUpdateLayout = true;
    GtkContextInvoke([this]() { UpdateLayout(); });
  }
}

void Player::UpdateLayout() {
  CHECK_CONTEXT();
#ifndef DISABLE_LOCK
  lock_guard locker(_lock);
#endif
  if (!GST_IS_OBJECT(_player->gobj())) {
    GST_WARNING("Invalid player");
    return;
  }
  if (!GST_IS_OBJECT(aspect->gobj())) {
    GST_WARNING("Invalid aspect object");
    return;
  }
  GST_DEBUG("%d,%d:%dx%d", _left, _top, _width, _height);
  if (_monitorChanged.empty()) {
    auto screen = getScreen(screenNumber);
    _monitorChanged = screen->signal_monitors_changed().connect([this]() {
      GST_DEBUG("monitor-changed");
      // Добавим задержку
      Glib::signal_timeout().connect_seconds_once(sigc::mem_fun(*this, &Player::UpdateLayout), 4);
    });
  }

  if (GST_IS_OBJECT(aspect->gobj())) {
    int nom = _letterBoxing ? 0 : _width;
    int denom = _letterBoxing ? 1 : _height;
    aspect->set_property("aspect-ratio", Gst::Fraction(nom, denom));
  }
  if (_filter) {
    auto caps = Gst::Caps::create_simple("video/x-raw", "width", _width);
    _filter->set_property("caps", caps);
  }
  SetWindowOutput(_video, _left, _top, output, preferredOutputModel, screenNumber);
  _video->set_size_request(_width, _height);
  if (_video->get_realized()) {
    auto window = _video->get_window();
    window->resize(_width, _height);
    int x, y;
    window->get_origin(x, y);
    if (x >= 0 && y >= 0) {
      auto origin = string_format("%s.%d+%d,%d", get_display_without_screen().c_str(), screenNumber, x, y);
      GST_DEBUG("origin %s", origin.c_str());
      _origin.swap(origin);
      AsyncEmit("changed", "origin"s);
    }
  }

  if (!_usePlaybin) {
#ifdef GDK_WINDOWING_QUARTZ
    gst_player_video_overlay_video_renderer_set_render_rectangle(GST_PLAYER_VIDEO_OVERLAY_VIDEO_RENDERER(_renderer),
                                                                 _left,
                                                                 900 - _top,
                                                                 _width,
                                                                 _height);
#endif
    gst_player_video_overlay_video_renderer_expose(GST_PLAYER_VIDEO_OVERLAY_VIDEO_RENDERER(_renderer));
  } else {
    auto overlay = _playbin->get_element(GST_TYPE_VIDEO_OVERLAY);
    assert(overlay);
    gst_video_overlay_expose(GST_VIDEO_OVERLAY(overlay->gobj()));
//        GST_VIDEO_OVERLAY(gst_bin_get_by_interface(GST_BIN(playbin_), GST_TYPE_VIDEO_OVERLAY));
//    if (overlay) {
//      gst_video_overlay_expose(overlay);
//      gst_object_unref(overlay);
//
  }
  if (show) {
    _video->show();
  } else {
    _video->hide();
  }
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

Napi::Value Player::GetWidth(const Napi::CallbackInfo &info) {
  return Napi::Number::New(info.Env(), _width);
}

void Player::SetWidth(const Napi::CallbackInfo &info, const Napi::Value &value) {
  if (!CheckPositiveEvenNumber(info, value)) return;

  int32_t widthVal = value.As<Napi::Number>();
  AsyncLayout([widthVal, this]() {
    _width = widthVal;
  });
  Emit(info, "changed", "width");
}

Napi::Value Player::GetHeight(const Napi::CallbackInfo &info) {
  return Napi::Number::New(info.Env(), _height);
}

void Player::SetHeight(const Napi::CallbackInfo &info, const Napi::Value &value) {
  if (!CheckPositiveEvenNumber(info, value)) return;

  int32_t heightVal = value.As<Napi::Number>();
  AsyncLayout([heightVal, this]() {
    _height = heightVal;
  });
  Emit(info, "changed", "height");
}

Napi::Value Player::GetLeft(const Napi::CallbackInfo &info) {
  return Napi::Number::New(info.Env(), _left);
}

void Player::SetLeft(const Napi::CallbackInfo &info, const Napi::Value &value) {
  auto env = info.Env();
  if (!value.IsNumber()) {
    Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
    return;
  }
  int32_t leftVal = value.As<Napi::Number>();
  AsyncLayout([leftVal, this]() {
    _left = leftVal;
  });
  Emit(info, "changed", "left");
}

Napi::Value Player::GetTop(const Napi::CallbackInfo &info) {
  return Napi::Number::New(info.Env(), _top);
}

void Player::SetTop(const Napi::CallbackInfo &info, const Napi::Value &value) {
  auto env = info.Env();
  if (!value.IsNumber()) {
    Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
    return;
  }

  int32_t topVal = value.As<Napi::Number>();
  AsyncLayout([topVal, this]() {
    _top = topVal;
  });
  Emit(info, "changed", "top");
}

Napi::Value Player::GetOutput(const Napi::CallbackInfo &info) {
  return Napi::String::New(info.Env(), output);
}

void Player::SetOutput(const Napi::CallbackInfo &info, const Napi::Value &value) {
  auto env = info.Env();
  if (!value.IsString()) {
    Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
    return;
  }

  string
  outputVal = value.As<Napi::String>();
  AsyncLayout([outputVal, this]() {
    output = outputVal;
  });
  Emit(info, "changed", "output");

}

Napi::Value Player::GetPreferredOutputModel(const Napi::CallbackInfo &info) {
  return Napi::String::New(info.Env(), preferredOutputModel);
}

void Player::SetPreferredOutputModel(const Napi::CallbackInfo &info, const Napi::Value &value) {
  auto env = info.Env();
  if (!value.IsString()) {
    Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
    return;
  }
  string
  modelVal = value.As<Napi::String>();
  AsyncLayout([modelVal, this]() {
    preferredOutputModel = modelVal;
  });
  Emit(info, "changed", "preferredOutputModel");
}

void Player::Show(const Napi::CallbackInfo &info) {
  GtkContextInvoke([this]() {
    _video->show();
  });
}

void Player::Hide(const Napi::CallbackInfo &info) {
  GtkContextInvoke([this]() {
    _video->hide();
  });
}

void Player::Play(const Napi::CallbackInfo &info) {
  if (_usePlaybin) {
    _playbin->set_state(Gst::STATE_PLAYING);
  } else {
    gst_player_play(GST_PLAYER(_player->gobj()));
  }
  setState(PlayerState::Playing);
}

void Player::Pause(const Napi::CallbackInfo &info) {
  gst_player_pause(GST_PLAYER(_player->gobj()));
  setState(PlayerState::Paused);
}

void Player::Stop(const Napi::CallbackInfo &info) {
  gst_player_stop(GST_PLAYER(_player->gobj()));
  _current = 0;
  setState(PlayerState::Stopped);
}

Napi::Value Player::GetCurrentUri(const Napi::CallbackInfo &info) {
  Glib::ustring current;

  if (_usePlaybin) {
    _playbin->get_property("current-uri", current);
  } else {
    _player->get_property("uri", current);
  }
  return Napi::String::New(info.Env(), current);
}

Napi::Value Player::GetVolume(const Napi::CallbackInfo &info) {
  double volume;
  if (_usePlaybin) {
    _playbin->get_property("volume", volume);
  } else {
    _player->get_property("volume", volume);
  }
  return Napi::Number::New(info.Env(), volume);
}

void Player::SetVolume(const Napi::CallbackInfo &info, const Napi::Value &value) {
  auto env = info.Env();
  if (!value.IsNumber()) {
    Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
    return;
  }
  double dVal = value.As<Napi::Number>();
  if (dVal < 0 || 10.0 > dVal) {
    Napi::RangeError::New(env, "0..10").ThrowAsJavaScriptException();
    return;
  }
  if (_usePlaybin) {
    _playbin->set_property("volume", value);
  } else {
    _player->set_property("volume", value);
  }
}

Napi::Value Player::GetMute(const Napi::CallbackInfo &info) {
  gboolean isMute;
  if (_usePlaybin) {
    _playbin->get_property("mute", isMute);
  } else {
    _player->get_property("mute", isMute);
  }
  return Napi::Boolean::New(info.Env(), isMute != 0);
}

void Player::SetMute(const Napi::CallbackInfo &info, const Napi::Value &value) {
  gboolean isMute = value.ToBoolean() ? TRUE : FALSE;
  if (_usePlaybin) {
    _playbin->set_property("mute", isMute);
  } else {
    _player->set_property("mute", isMute);
  }
}

Napi::Value Player::GetLoop(const Napi::CallbackInfo &info) {
  return Napi::Boolean::New(info.Env(), _loop);
}

void Player::SetLoop(const Napi::CallbackInfo &info, const Napi::Value &value) {
  _loop = value.ToBoolean();
}

void Player::tryNext() {
  if (!_player) {
    GST_WARNING("Not implemented");
    setState(PlayerState::Stopped);
    return;
  };

  if (_playlist.empty()) {
    GST_WARNING("Playlist is empty");
    setState(PlayerState::Stopped);
    return;
  }

  auto next = _current + 1;
  if (next >= _playlist.size()) {
    next = 0;
    if (!_loop) {
      AsyncEmit("EOP");
      setState(PlayerState::Stopped);
      return;
    }
  }

  setCurrentImpl(next);
}

Napi::Value Player::GetCurrent(const Napi::CallbackInfo &info) {
  return Napi::Number::New(info.Env(), _current);
}

void Player::SetCurrent(const Napi::CallbackInfo &info, const Napi::Value &value) {
  auto env = info.Env();
  if (!value.IsNumber()) {
    Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
    return;
  }
  if (!setCurrentImpl(value.As<Napi::Number>())) {
    Napi::RangeError::New(env, "Index is out of range").ThrowAsJavaScriptException();
  }
}

bool Player::setCurrentImpl(int32_t index) {
  if (index < 0 || _playlist.size() <= index) {
    GST_WARNING("Index is out of range");
    return false;
  }
  auto uri = _playlist[index];
  auto file = g_filename_from_uri(uri.c_str(), nullptr, nullptr);
  auto exists = access(file, F_OK) != -1;
  g_free(file);
  _current = index;
  if (!exists) {
    GST_INFO("file %s not found, skipped", uri.c_str());
    tryNext();
    return true;
  }

  if (_usePlaybin) {
    _playbin->set_property("uri", uri);
  } else {
    _player->set_property("uri", uri);
    gst_player_set_audio_track_enabled(GST_PLAYER(_player->gobj()), _audioEnabled);
    gst_player_set_subtitle_track_enabled(GST_PLAYER(_player->gobj()), _subtitleEnabled);
  }
  AsyncEmit("changed", "current"s);
  if (_state == PlayerState::Playing) {
    gst_player_play(GST_PLAYER(_player->gobj()));
  }
  return true;
}

void Player::setState(PlayerState value) {
  _state = value;
  AsyncEmit("changed", "state"s);
}

Napi::Value Player::GetState(const Napi::CallbackInfo &info) {
  auto env = info.Env();
  switch (_state) {
    case PlayerState::Stopped: return Napi::String::New(env, "stopped");
    case PlayerState::Paused: return Napi::String::New(env, "paused");
    case PlayerState::Playing: return Napi::String::New(env, "playing");
  }
}

void Player::OnError(GError *error) {
  Glib::Error err(error);
  GST_ERROR("Error: %s", err.what().c_str());
  AsyncEmit("bus-error", err.what());
  tryNext();
}

void Player::OnEOS() {
  AsyncEmit("EOS");
  tryNext();
}

void Player::OnVideoRealise() {
  gpointer window_handle;
  GdkWindow *window = _video->get_window()->gobj();
#if defined (GDK_WINDOWING_WIN32)
  window_handle = (gpointer)GDK_WINDOW_HWND (window);
#elif defined (GDK_WINDOWING_QUARTZ)
  window_handle = (gpointer) gdk_quartz_window_get_nsview(window);
#elif defined (GDK_WINDOWING_X11)
  window_handle = GUINT_TO_POINTER(GDK_WINDOW_XID (window));
#endif
  GST_DEBUG("set overlay %p", window_handle);
  auto videoOverlay = GST_PLAYER_VIDEO_OVERLAY_VIDEO_RENDERER(_renderer);
  gst_player_video_overlay_video_renderer_set_window_handle(videoOverlay, window_handle);
#ifdef GDK_WINDOWING_QUARTZ
  gst_player_video_overlay_video_renderer_set_render_rectangle(videoOverlay, 0, 0, _width, _height);
#endif
  gst_player_video_overlay_video_renderer_expose(videoOverlay);
}

Napi::Value Player::GetPosition(const Napi::CallbackInfo &info) {
  assert(_player);
  auto position = gst_player_get_position(GST_PLAYER(_player->gobj()));
  return Napi::Number::New(info.Env(), position / (double) GST_SECOND);
}

Napi::Value Player::GetAccurateSeek(const Napi::CallbackInfo &info) {
  auto env = info.Env();
//  Napi::HandleScope scope(env);
  auto player = GST_PLAYER(_player->gobj());
  auto config = Glib::wrap(gst_player_get_config(player));
  return Napi::Boolean::From(info.Env(), gst_player_config_get_seek_accurate(config.gobj()) != 0);
}

void Player::SetAccurateSeek(const Napi::CallbackInfo &info, const Napi::Value &value) {
  auto env = info.Env();
//  Napi::HandleScope scope(env);
  auto player = GST_PLAYER(_player->gobj());
  auto config = Glib::wrap(gst_player_get_config(player));
  gst_player_config_set_seek_accurate(config.gobj(), value.ToBoolean() ? TRUE : FALSE);
  if (!gst_player_set_config(player, config.gobj())) {
    Napi::Error::New(env, "Player must be stopped").ThrowAsJavaScriptException();
  }
}

Napi::Value Player::GetDuration(const Napi::CallbackInfo &info) {
  auto duration = gst_player_get_duration(GST_PLAYER(_player->gobj()));
  return Napi::Number::New(info.Env(), duration / (double) GST_SECOND);
}

void Player::Seek(const Napi::CallbackInfo &info) {
  auto env = info.Env();
//  Napi::HandleScope scope(env);
  GstClockTime position;
  if (info.Length() > 0) {
    if (!info[0].IsNumber()) {
      Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
      return;
    }
    double pos = info[0].As<Napi::Number>();
    if (pos < 0) {
      Napi::TypeError::New(env, "Value should not be negative").ThrowAsJavaScriptException();
      return;
    }
    position = static_cast<GstClockTime>(pos * GST_SECOND);
  }
  gst_player_seek(GST_PLAYER(_player->gobj()), position);
}

Napi::Value Player::GetAudioEnabled(const Napi::CallbackInfo &info) {
  return Napi::Boolean::New(info.Env(), _audioEnabled);
}

void Player::SetAudioEnabled(const Napi::CallbackInfo &info, const Napi::Value &value) {
  _audioEnabled = value.ToBoolean();
  gst_player_set_audio_track_enabled(GST_PLAYER(_player->gobj()), _audioEnabled ? TRUE : FALSE);
  Emit(info, "changed", "audioEnabled");
}

Napi::Value Player::GetSubtitleEnabled(const Napi::CallbackInfo &info) {
  return Napi::Boolean::New(info.Env(), _subtitleEnabled);
}

void Player::SetSubtitleEnabled(const Napi::CallbackInfo &info, const Napi::Value &value) {
  _subtitleEnabled = value.ToBoolean();
  gst_player_set_subtitle_track_enabled(GST_PLAYER(_player->gobj()), _subtitleEnabled ? TRUE : FALSE);
  Emit(info, "changed", "subtitleEnabled");
}

Napi::Value Player::GetLetterboxing(const Napi::CallbackInfo &info) {
  return Napi::Boolean::New(info.Env(), _letterBoxing);
}

void Player::SetLetterboxing(const Napi::CallbackInfo &info, const Napi::Value &value) {
  bool letterBoxingVal = value.ToBoolean();
  AsyncLayout([this, letterBoxingVal]() {
    _letterBoxing = letterBoxingVal;
  });
  Emit(info, "changed", "letterboxing");
}

Napi::Value Player::GetOrigin(const Napi::CallbackInfo &info) {
  return Napi::String::New(info.Env(), _origin);
}

Napi::Value Player::Discover(const Napi::CallbackInfo &info) {
  auto env = info.Env();
//  Нельзя использовать scope? Napi::HandleScope handleScope(env);
  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  if (!info[0].IsArray()) {
    Napi::TypeError::New(env, "array expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  auto array = info[0].As<Napi::Array>();
  auto size = array.Length();

  if (info.Length() > 1 && !info[1].IsFunction()) {
    Napi::TypeError::New(env, "callback function expected").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  typedef std::map<std::string, std::string> Discovered;
  typedef std::shared_ptr<Discovered> DiscoveredPtr;
  DiscoveredPtr list = std::make_shared<Discovered>();
  auto discovered = [list](const Glib::RefPtr<Gst::DiscovererInfo> &info, const Glib::Error &err) {
    if (err.gobj() != nullptr) {
      GST_DEBUG("Error in %s: %s", info->get_uri().c_str(), err.what().c_str());
      list->emplace(info->get_uri(), err.what());
    } else {
      list->emplace(info->get_uri(), "ok");
    }
  };
  auto finished = [list](AsyncDeferred::AsyncData data) {
    auto resolve = [list](napi_env env) -> napi_value {
      auto result = Napi::Object::New(env);
      for (auto &item: *list) {
        result.Set(item.first, item.second);
      }
      return result;
    };
    AsyncDeferred::Resolve(data, std::move(resolve));
  };
#ifdef MACOSX
  auto discoverer = Gst::Discoverer::create((unsigned long) Gst::SECOND);
#else
  auto discoverer = Gst::Discoverer::create(Gst::SECOND);
#endif
  discoverer->signal_discovered().connect(discovered);
  AsyncDeferred promise(env, info.Length() > 1 ? info[1].As<Napi::Function>() : (napi_value)nullptr);
  discoverer->signal_finished().connect(sigc::bind<AsyncDeferred::AsyncData>(finished, promise.Data()));
  discoverer->start();
  for (uint32_t i = 0; i < size; i++) {
    auto uriValue = array.Get(i);
    if (!uriValue.IsString()) {
      GST_WARNING("string expected in playlist");
      continue;
    }
    auto uri = uriValue.As<Napi::String>().Utf8Value();
    if (!gst_uri_is_valid(uri.c_str())) {
      auto gsturi = gst_filename_to_uri(uri.c_str(), nullptr);
      uri = gsturi;
      g_free(gsturi);
    }
    auto file = g_filename_from_uri(uri.c_str(), nullptr, nullptr);
    if (access(file, F_OK) == -1) {
      list->emplace(uri, "not found");
      GST_WARNING("file %s not found", file);
    } else {
      discoverer->discover_uri_async(uri);
    }
    g_free(file);
  }

  return promise.Promise();
}

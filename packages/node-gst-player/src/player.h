#include <utility>

//
// Created by Andrei Sarakeev on 03/10/2018.
//

#ifndef NODE_GST_PLAYER_GSTPLAYER_H
#define NODE_GST_PLAYER_GSTPLAYER_H

#include <napi.h>
#include <string>
#include <vector>
#include <map>
#include <mutex>
#include <glibmm.h>
#include <gstreamermm/pipeline.h>
#include <gtkmm/drawingarea.h>
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
#include <gstreamermm.h>
#pragma GCC diagnostics pop
#include "gcontext.h"
#include <gst/player/gstplayer-g-main-context-signal-dispatcher.h>
#include <gst/player/gstplayer-video-renderer.h>
#include <gtkmm/fixed.h>

#ifdef SINGLE_THREADED
#define DISABLE_LOCK
#endif

using namespace std;
namespace Gst {
class DiscovererInfo;
}
typedef vector<string> Playlist;
typedef map<string, Glib::RefPtr<Gst::DiscovererInfo>> MediaInfo;
typedef MediaInfo::value_type MediaInfoItem;

enum class PlayerState { Stopped, Paused, Playing };

template<typename ...Args>
struct has_pchar : std::disjunction<std::is_same<char *, std::decay_t<Args>> ...,
                                    std::is_same<const char *, std::decay_t<Args>> ...> {
};

class Player : public Napi::ObjectWrap<Player> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  Player(const Napi::CallbackInfo &info);

  template<typename ...Args>
  void Emit(const Napi::CallbackInfo &info, const string &&event, Args &&...args) {
    auto env = info.Env();
    auto self = info.This();
    self.As<Napi::Object>().Get("emit")
        .As<Napi::Function>()
        .Call(self, {Napi::String::New(env, std::move(event)), Napi::Value::From(env, std::forward<Args>(args))...});
  }

  template<typename ...Args>
  void AsyncEmit(std::string &&event, Args &&...args) {
    static_assert(!has_pchar<Args...>());
    _emit.Call(std::move(event), std::forward<Args>(args)...);
  }

  void AsyncLayout(Lambda &&lambda);
  virtual ~Player();

 private:
  Napi::Value GetPlaylist(const Napi::CallbackInfo &info);
  void SetPlaylist(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetCurrentUri(const Napi::CallbackInfo &info);
  Napi::Value GetVolume(const Napi::CallbackInfo &info);
  void SetVolume(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetMute(const Napi::CallbackInfo &info);
  void SetMute(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetLoop(const Napi::CallbackInfo &info);
  void SetLoop(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetWidth(const Napi::CallbackInfo &info);
  void SetWidth(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetHeight(const Napi::CallbackInfo &info);
  void SetHeight(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetLeft(const Napi::CallbackInfo &info);
  void SetLeft(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetTop(const Napi::CallbackInfo &info);
  void SetTop(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetOutput(const Napi::CallbackInfo &info);
  void SetOutput(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetScreen(const Napi::CallbackInfo &info);
  void SetScreen(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetPreferredOutputModel(const Napi::CallbackInfo &info);
  void SetPreferredOutputModel(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetCurrent(const Napi::CallbackInfo &info);
  void SetCurrent(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetState(const Napi::CallbackInfo &info);
  Napi::Value GetPosition(const Napi::CallbackInfo &info);
  Napi::Value GetAccurateSeek(const Napi::CallbackInfo &info);
  void SetAccurateSeek(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetDuration(const Napi::CallbackInfo &info);
  Napi::Value GetTotal(const Napi::CallbackInfo &info);
  Napi::Value GetAudioEnabled(const Napi::CallbackInfo &info);
  void SetAudioEnabled(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetSubtitleEnabled(const Napi::CallbackInfo &info);
  void SetSubtitleEnabled(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetLetterboxing(const Napi::CallbackInfo &info);
  void SetLetterboxing(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetOrigin(const Napi::CallbackInfo &info);
  void Show(const Napi::CallbackInfo &info);
  void Hide(const Napi::CallbackInfo &info);
  void Play(const Napi::CallbackInfo &info);
  void Pause(const Napi::CallbackInfo &info);
  void Stop(const Napi::CallbackInfo &info);
  void Seek(const Napi::CallbackInfo &info);
  void UpdateCurrent(const Napi::CallbackInfo &info);
  static Napi::Value Discover(const Napi::CallbackInfo &info);

  void OnBusMessageSync(const Glib::RefPtr<Gst::Message> &message);
  bool OnBusMessage(const Glib::RefPtr<Gst::Bus> &bus, const Glib::RefPtr<Gst::Message> &message);
  void OnError(GError *error);
  void OnEOS();
  void OnVideoRealise();

  static Napi::FunctionReference _constructor;
  AsyncMethod _emit;

  void UpdateTotal(const Napi::CallbackInfo &info);
  void UpdateLayout();

  void tryNext();
  bool setCurrentImpl(int32_t index);
  void setState(PlayerState value);
  void shrinkMedia();

  std::string output;
  int32_t screenNumber;
  int32_t _left;
  int32_t _top;
  int32_t _width;
  int32_t _height;
  int32_t _current;
  uint64_t _total;
  gint64 _lastShrink;

  bool _loop;
  bool show;
  bool _letterBoxing;
  bool _audioEnabled;
  bool _subtitleEnabled;
  std::string preferredOutputModel;
  Playlist _playlist;
  Napi::Reference<Napi::Array> _playlistRef;
  MediaInfo _media;
#ifndef DISABLE_LOCK
  mutex _lock;
#endif
  bool needUpdateLayout;
  Glib::RefPtr<Gst::Object> _player;
  GstPlayerVideoRenderer *_renderer;
  Glib::RefPtr<Gst::Element> aspect;
  Glib::RefPtr<Gst::Element> _filter;
  Glib::RefPtr<Gst::Pipeline> _playbin;
  bool _skipped;
  bool _usePlaybin;
  Gtk::DrawingArea *_video;
  PlayerState _state;
  std::string _origin;
  sigc::connection _monitorChanged;
};

#endif //NODE_GST_PLAYER_GSTPLAYER_H

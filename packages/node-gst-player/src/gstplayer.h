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
#include <gstreamermm.h>
#include "gcontext.h"

using namespace std;
namespace Gst {
class DiscovererInfo;
}
typedef vector<string> Playlist;
typedef map<string, Glib::RefPtr<Gst::DiscovererInfo>> MediaInfo;
typedef MediaInfo::value_type MediaInfoItem;

class GstPlayer : public Napi::ObjectWrap<GstPlayer> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  GstPlayer(const Napi::CallbackInfo &info);
  void Emit(const Napi::CallbackInfo &info, string event, string propName);
  void AsyncEmit(std::string event, std::string propName);
  void AsyncLayout(Lambda &&lambda);
  virtual ~GstPlayer();

 private:
  Napi::Value GetPlaylist(const Napi::CallbackInfo &info);
  void SetPlaylist(const Napi::CallbackInfo &info, const Napi::Value &value);
  Napi::Value GetCurrent(const Napi::CallbackInfo &info);
  void SetCurrent(const Napi::CallbackInfo &info, const Napi::Value &value);
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
  void Show(const Napi::CallbackInfo &info);
  void Hide(const Napi::CallbackInfo &info);
  void Play(const Napi::CallbackInfo &info);
  void Pause(const Napi::CallbackInfo &info);
  void Stop(const Napi::CallbackInfo &info);

  void OnBusMessageSync(const Glib::RefPtr<Gst::Message> &message);

  static Napi::FunctionReference constructor;
  ThreadSafeFunction emit;

  void UpdateTotal();
  void UpdateLayout();

  std::string output;
  int32_t screenNumber;
  int32_t left;
  int32_t top;
  int32_t width;
  int32_t height;
  bool show;
  bool letterBoxing;
  std::string preferredOutputModel;
  Playlist _playlist;
  Reference<Napi::Array> _playlistRef;
  MediaInfo _info;
  mutex _lock;
  bool needUpdateLayout;

  Glib::RefPtr<Gst::Pipeline> _playbin;
  Glib::RefPtr<Gst::Element> aspect;
  Gtk::DrawingArea *video;
};

#endif //NODE_GST_PLAYER_GSTPLAYER_H

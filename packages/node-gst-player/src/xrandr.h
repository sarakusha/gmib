//
// Created by Andrei Sarakeev on 25/09/2018.
//

#ifndef NODE_GST_PLAYER_XRANDR_H
#define NODE_GST_PLAYER_XRANDR_H

#include <napi.h>
#include <unordered_map>
#include <memory>

namespace X11 {
//#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <X11/extensions/Xrandr.h>
}

template <typename T>
using ScreenData = std::pair<T, int>;

typedef std::shared_ptr<X11::XRROutputInfo> OutputInfoPtr;
typedef std::unordered_map<X11::RROutput, OutputInfoPtr> OutputMap;
typedef ScreenData<OutputMap> Outputs;

typedef std::shared_ptr<X11::XRRCrtcInfo> CrtcInfoPtr;
typedef std::unordered_map<X11::RRCrtc, CrtcInfoPtr> CrtcMap;
typedef ScreenData<CrtcMap> Crtcs;

typedef std::shared_ptr<X11::XRRModeInfo> ModeInfoPtr;
typedef std::unordered_map<X11::RRMode, ModeInfoPtr> ModeMap;
typedef ScreenData<ModeMap> Modes;

typedef std::shared_ptr<X11::XRRScreenResources> ScreenResourcesPtr;
typedef ScreenData<ScreenResourcesPtr> ScreenResources;

Napi::Object XrandrInit(Napi::Env env, Napi::Object exports);

ScreenResources getScreenResources(int screen_number = -1);
Outputs getOutputs(ScreenResources res);
Crtcs getCrtcs(ScreenResources res);
Modes getModes(ScreenResources res);
X11::Display* getDisplay();
void XrandrClose();

template<class T>
inline typename T::iterator
findByName(T &map, const char *name) {
  return std::find_if(std::begin(map), std::end(map), [name](typename T::value_type &item) -> bool {
    return strcmp(item.second->name, name) == 0;
  });
}

std::unordered_map<std::string, std::string> getOutputParams(X11::RROutput xid);
void transformLayout(const char *output, int &left, int &top, int &width, int &height);
#endif //NODE_GST_PLAYER_XRANDR_H

//
// Created by Andrei Sarakeev on 08/10/2018.
//

#ifndef NODE_GST_PLAYER_SCREEN_H
#define NODE_GST_PLAYER_SCREEN_H

#include <napi.h>
#include <string>
#include <gtkmm/window.h>
#include <gstreamermm/videosink.h>

using namespace std;

void ScreenInit();
//Gtk::Window VideoWindowCreate(string output, const Gst::VideoRectangle &rect, string model, int screen);
void SetWindowOutput(Gtk::Widget *window, int left, int top, const string &output, const string &modelName, int screen_number);

template<class T>
inline typename T::iterator
findByName(const T &map, const char *name) {
  find_if(begin(map), end(map), [name](const typename T::value_type &item) -> bool {
    return strcmp(item.second->name, name) == 0;
  });
}






#endif //NODE_GST_PLAYER_SCREEN_H

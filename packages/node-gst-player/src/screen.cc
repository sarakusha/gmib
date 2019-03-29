//
// Created by Andrei Sarakeev on 08/10/2018.
//

#include "screen.h"
#include "xrandr.h"
#include "utils.h"
#include "gcontext.h"

#include <algorithm>
#include <memory>
#include <unordered_map>
#include <unordered_set>
#include <gdkmm/screen.h>
#include <gdkmm/displaymanager.h>
#include <gtkmm/fixed.h>
#include <gtkmm/cssprovider.h>
#include <gtkmm/stylecontext.h>
#include <glibmm/init.h>
#include <assert.h>
#include <gst/gstinfo.h>

GST_DEBUG_CATEGORY (screen_debug);
#define GST_CAT_DEFAULT screen_debug

struct Monitor;
typedef shared_ptr<Monitor> MonitorItem;
typedef unordered_map<string, MonitorItem> Monitors;

unordered_set<string> outputNames;
using namespace X11;

Monitors monitors;

/**
 * Поиск предпочтительного монтора в режиме auto в порядке приоритета,
 * если найдено несколько устройств, будет использоваться первое:
 *   Если задана модель и устройство подключено - оно будет использоваться
 *   Если найдено подключенное устройство с именем вендора NIN (Nata-INfo) - оно будет использоваться
 *   Если есть подключенный цифровой монитор, не являющийся основным - он будет использоваться
 *   Если есть подключенный цифровой монитор - он будет использоваться.
 *   Если есть основной монитор - он будет использоваться
 */
static string
getPreferredOutput(const string &modelName, int screen_number) {
  auto dpy = getDisplay();
  auto root = RootWindow (dpy, screen_number);
  auto primary = XRRGetOutputPrimary(dpy, root);
  string nin, best, digital, first;
  auto res = getScreenResources(screen_number);
  Outputs outputs = getOutputs(res);
  for (auto item : outputs.first) {
    auto xid = item.first;
    auto output = item.second;
    if (output->connection != RR_Connected) { continue; }
    if (first.empty()) first = output->name;
    auto params = getOutputParams(xid);
    if (!modelName.empty() && params["model"] == modelName) {
      return output->name;
    }
    if (params["vendor"] == "NIN") {
      nin = output->name;
    }
    if (params["display"] == "digital") {
      if (digital.empty()) {
        digital = output->name;
      }
      if (best.empty() && xid != primary) {
        best = output->name;
      }
    }
  }

  return !nin.empty() ? nin : (!best.empty() ? best : (!digital.empty() ? digital : (primary
                                                                                     ? outputs.first[primary]->name
                                                                                     : first)));
}

Glib::RefPtr<Gdk::Screen>
getScreen(int screen_number) {
  auto manager = Gdk::DisplayManager::get();
#ifdef MACOSX
  return manager->get_default_display()->get_default_screen();
#else
  if (screen_number == -1) {
    return manager->get_default_display()->get_default_screen();
  }

  auto list = manager->list_displays();
  auto name = get_display_without_screen() + "." + std::to_string(screen_number);
  GST_DEBUG("find display: %s", name.c_str());
  // TODO: Проверить
  auto it =
      std::find_if(begin(list), end(list), [name, screen_number](const Glib::RefPtr<Gdk::Display> &display) -> bool {
        auto currentName = display->get_name();
        GST_DEBUG("DISPLAY FOUND: %s", currentName.c_str());
        return currentName == name || (screen_number == 0 && currentName == ":0");
      });

  Glib::RefPtr<Gdk::Display> display;

  if (it == end(list)) {
    GST_DEBUG("open DISPLAY %s", name.c_str());
    display = Gdk::Display::open(name);
  } else {
    display = *it;
  }
  auto screen = display->get_default_screen();
  if (!screen) {
    g_error ("Gtk3+ not initalized");
  }
  return screen;
#endif
}

struct Monitor {
  Monitor(const Monitor &) = delete;
  Monitor &operator=(const Monitor &) = delete;
  explicit Monitor(const string &output, int screen_number)
#ifndef MACOSX
  : main(Gtk::WINDOW_POPUP)
#endif
  {
    auto screen = getScreen(screen_number);
    main.set_screen(screen);
    main.set_title("gstplayer-" + output);
    main.set_sensitive(false);
    main.set_can_focus(false);
    main.set_skip_taskbar_hint(true);
    main.set_skip_pager_hint(true);
    main.set_accept_focus(false);
    main.set_focus_on_map(false);
    main.set_has_resize_grip(false);
    auto provider = Gtk::CssProvider::create();
    provider->load_from_data(
        "* {\n"
        "  background-color: black;\n"
        "}\n");
    main.get_style_context()->add_provider(provider, GTK_STYLE_PROVIDER_PRIORITY_USER);

#ifndef MACOSX
    main.set_decorated(false);
#endif

    container.set_name("container");
    container.set_sensitive(false);
    container.set_can_focus(false);
    container.set_halign(Gtk::ALIGN_FILL);
    container.set_valign(Gtk::ALIGN_FILL);

    main.add(container);
    assert(screen);
    main.signal_realize().connect([this, screen]() {
      assert(main.get_window());
      assert(screen);
      main.get_window()->set_cursor(Gdk::Cursor::create(screen->get_display(), Gdk::BLANK_CURSOR));
//      int width, height;
//      container.get_size_request(width, height);
    });


    auto res = getScreenResources(screen_number);
    auto outputs = getOutputs(res).first;
    auto crtcs = getCrtcs(res).first;

    auto it = findByName(outputs, output.c_str());
    assert(it != outputs.end() && it->second->crtc);
    update(crtcs[it->second->crtc]);
    GST_DEBUG("%s monitor was created", output.c_str());
  }

  void update(const CrtcInfoPtr &crtcInfo) {
    main.show_all();
    main.set_keep_above(true);
    if (!crtcInfo) {
      // Двигаем за край экрана
      auto screen = container.get_screen();
      auto width = screen->get_width();
      auto height = screen->get_height();
      main.move(width, height);
      return;
    }
    GST_DEBUG("%d,%d:%dx%d", crtcInfo->x, crtcInfo->y, crtcInfo->width, crtcInfo->height);
    main.move(crtcInfo->x, crtcInfo->y);
    container.set_size_request(crtcInfo->width, crtcInfo->height);
    if (container.get_realized())
      container.get_window()->resize(crtcInfo->width, crtcInfo->height);
    main.fullscreen();
  }

  Gtk::Window main;
  Gtk::Fixed container;
};

string getOutputName(string output, int screen_number) {
  if (output.find(':') != string::npos) {
    return output;
  }
  return to_string(screen_number) + ":" + output;
}

MonitorItem getMonitor(string output, const string &modelName, int &screen_number) {
  if (screen_number == -1) {
    screen_number = DefaultScreen(getDisplay());
  }
//  static int providers = 0;
//  // TODO: Проверить на -1
//  int check = 1 << screen_number;
//  if (!(providers & check)) {
//    auto provider = Gtk::CssProvider::create();
//    Gtk::StyleContext::add_provider_for_screen(getScreen(screen_number), provider, GTK_STYLE_PROVIDER_PRIORITY_USER);
//    auto result1 = provider->load_from_data(
//        "#container,  GtkWindow {\n"
//        "  background-color: black;\n"
//        "}\n");
//    GST_DEBUG("css provider %s", result1 ? "loaded" : "failed");
//    GST_DEBUG("css: %s", provider->to_string().c_str());
//    providers |= check;
//  }
  if (output == "auto") {
    output = getPreferredOutput(modelName, screen_number);
  }

//  GST_DEBUG("output %s", output.c_str());

  string fullName = getOutputName(output, screen_number);
  if (outputNames.find(fullName) == outputNames.end() && output != "none") {
    GST_WARNING("Invalid output name: %s, screen: %d", output.c_str(), screen_number);
  }

  auto it = monitors.find(fullName);
  if (it != monitors.end()) {
    return it->second;
  }

  auto monitor = make_shared<Monitor>(output, screen_number);
  monitors.insert({fullName, monitor});
  return monitor;
}

void ScreenInit() {
  GST_DEBUG_CATEGORY_INIT (screen_debug, "avs_screen", 3, "node_gst_player");
  int screenCount = ScreenCount(getDisplay());
  for (int screen_number = 0; screen_number < screenCount; screen_number++) {
    auto res = getScreenResources(screen_number);
    if (!res.first) {
      GST_DEBUG("screen resources is not available");
      return;
    }
    auto outputs = getOutputs(res);
    for (auto output: outputs.first) {
      outputNames.emplace(getOutputName(output.second->name, screen_number));
    }
  }
}

void SetWindowOutput(Gtk::Widget *window,
                     int left,
                     int top,
                     const string &output,
                     const string &modelName,
                     int screen_number) {
  auto monitor = getMonitor(output, modelName, screen_number);
  sigc::connection connection;
  auto reparent = [&monitor, window, &connection, left, top]() -> void {
    if (window->get_parent()) {
      window->reparent(monitor->container);
      monitor->container.move(*window, left, top);
    } else {
      monitor->container.put(*window, left, top);
    }

    { // Иначе окно может пропасть (ХЗ)
      int width, height;
      monitor->container.get_size_request(width, height);
      monitor->container.get_window()->resize(width, height);
//    GST_DEBUG("w: %d, h: %d", width, height);
    }

    if (connection) {
      connection.disconnect();
    }
  };

  if (monitor->container.get_realized()) {
    reparent();
  } else {
    connection = monitor->container.signal_realize().connect(reparent);
  }
}

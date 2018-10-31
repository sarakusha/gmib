//
// Created by Andrei Sarakeev on 26/09/2018.
//

#include <glib.h>
#include <cstring>
#include <cmath>
#include <algorithm>

#include "xrandr.h"
#include "utils.h"

using namespace std;
using namespace X11;

Display *dpy = nullptr;

typedef unsigned char byte;

typedef struct {
  int x1, y1, x2, y2;
} box_t;

typedef struct {
  int x, y;
} point_t;

struct Vendor {
  const char vendor_id[4];
  const char vendor_name[28];
};

static const char *directions[4] = {
    "normal",
    "left",
    "inverted",
    "right"
};

static const char *reflections[4] = {
    "none",
    "x",
    "y",
    "xy",
};

/* This list of vendor codes derived from lshw
 *
 * http://ezix.org/project/wiki/HardwareLiSter
 *
 * Note: we now prefer to use data coming from hwdata (and shipped with
 * gnome-desktop). See
 * http://git.fedorahosted.org/git/?p=hwdata.git;a=blob_plain;f=pnp.ids;hb=HEAD
 * All contributions to the list of vendors should go there.
 */
static const Vendor vendors[] =
    {
        {"NIN", "Nata-Info"},
        {"AIC", "AG Neovo"},
        {"ACR", "Acer"},
        {"DEL", "DELL"},
        {"SAM", "SAMSUNG"},
        {"SNY", "SONY"},
        {"SEC", "Epson"},
        {"WAC", "Wacom"},
        {"NEC", "NEC"},
        {"CMO", "CMO"},        /* Chi Mei */
        {"BNQ", "BenQ"},

        {"ABP", "Advansys"},
        {"ACC", "Accton"},
        {"ACE", "Accton"},
        {"ADP", "Adaptec"},
        {"ADV", "AMD"},
        {"AIR", "AIR"},
        {"AMI", "AMI"},
        {"ASU", "ASUS"},
        {"ATI", "ATI"},
        {"ATK", "Allied Telesyn"},
        {"AZT", "Aztech"},
        {"BAN", "Banya"},
        {"BRI", "Boca Research"},
        {"BUS", "Buslogic"},
        {"CCI", "Cache Computers Inc."},
        {"CHA", "Chase"},
        {"CMD", "CMD Technology, Inc."},
        {"CMN", "Chimei Innolux Corporation"},
        {"COG", "Cogent"},
        {"CPQ", "Compaq"},
        {"CRS", "Crescendo"},
        {"CSC", "Crystal"},
        {"CSI", "CSI"},
        {"CTL", "Creative Labs"},
        {"DBI", "Digi"},
        {"DEC", "Digital Equipment"},
        {"DBK", "Databook"},
        {"EGL", "Eagle Technology"},
        {"ELS", "ELSA"},
        {"ESS", "ESS"},
        {"FAR", "Farallon"},
        {"FDC", "Future Domain"},
        {"HWP", "Hewlett-Packard"},
        {"IBM", "IBM"},
        {"INT", "Intel"},
        {"ISA", "Iomega"},
        {"LEN", "Lenovo"},
        {"MDG", "Madge"},
        {"MDY", "Microdyne"},
        {"MET", "Metheus"},
        {"MIC", "Micronics"},
        {"MLX", "Mylex"},
        {"NVL", "Novell"},
        {"OLC", "Olicom"},
        {"PRO", "Proteon"},
        {"RII", "Racal"},
        {"RTL", "Realtek"},
        {"SCM", "SCM"},
        {"SKD", "SysKonnect"},
        {"SGI", "SGI"},
        {"SMC", "SMC"},
        {"SNI", "Siemens Nixdorf"},
        {"STL", "Stallion Technologies"},
        {"SUN", "Sun"},
        {"SUP", "SupraExpress"},
        {"SVE", "SVEC"},
        {"TCC", "Thomas-Conrad"},
        {"TCI", "Tulip"},
        {"TCM", "3Com"},
        {"TCO", "Thomas-Conrad"},
        {"TEC", "Tecmar"},
        {"TRU", "Truevision"},
        {"TOS", "Toshiba"},
        {"TYN", "Tyan"},
        {"UBI", "Ungermann-Bass"},
        {"USC", "UltraStor"},
        {"VDM", "Vadem"},
        {"VMI", "Vermont"},
        {"WDC", "Western Digital"},
        {"ZDS", "Zeos"},

        /* From http://faydoc.tripod.com/structures/01/0136.htm */
        {"ACT", "Targa"},
        {"ADI", "ADI"},
        {"AOC", "AOC Intl"},
        {"API", "Acer America"},
        {"APP", "Apple Computer"},
        {"ART", "ArtMedia"},
        {"AST", "AST Research"},
        {"CPL", "Compal"},
        {"CTX", "Chuntex Electronic Co."},
        {"DPC", "Delta Electronics"},
        {"DWE", "Daewoo"},
        {"ECS", "ELITEGROUP"},
        {"EIZ", "EIZO"},
        {"FCM", "Funai"},
        {"GSM", "LG Electronics"},
        {"GWY", "Gateway 2000"},
        {"HEI", "Hyundai"},
        {"HIT", "Hitachi"},
        {"HSL", "Hansol"},
        {"HTC", "Hitachi"},
        {"ICL", "Fujitsu ICL"},
        {"IVM", "Idek Iiyama"},
        {"KFC", "KFC Computek"},
        {"LKM", "ADLAS"},
        {"LNK", "LINK Tech"},
        {"LTN", "Lite-On"},
        {"MAG", "MAG InnoVision"},
        {"MAX", "Maxdata"},
        {"MEI", "Panasonic"},
        {"MEL", "Mitsubishi"},
        {"MIR", "miro"},
        {"MTC", "MITAC"},
        {"NAN", "NANAO"},
        {"NOK", "Nokia"},
        {"OQI", "OPTIQUEST"},
        {"PBN", "Packard Bell"},
        {"PGS", "Princeton"},
        {"PHL", "Philips"},
        {"REL", "Relisys"},
        {"SDI", "Samtron"},
        {"SMI", "Smile"},
        {"SPT", "Sceptre"},
        {"SRC", "Shamrock Technology"},
        {"STP", "Sceptre"},
        {"TAT", "Tatung"},
        {"TRL", "Royal Information Company"},
        {"TSB", "Toshiba, Inc."},
        {"UNM", "Unisys"},
        {"VSC", "ViewSonic"},
        {"WTC", "Wen Tech"},
        {"ZCM", "Zenith Data Systems"},

        {"???", "Unknown"},
    };

static const char *
directionName(Rotation rotation) {
  if ((rotation & 0xf) == 0) {
    return "normal";
  }
  for (int i = 0; i < 4; i++) {
    if (rotation & (1 << i)) {
      return directions[i];
    }
  }

  return "invalid rotation";
}

static const char *
reflectionName(Rotation rotation) {
  rotation &= (RR_Reflect_X | RR_Reflect_Y);
  switch (rotation) {
    case RR_Reflect_X:return "x";
    case RR_Reflect_Y:return "y";
    case RR_Reflect_X | RR_Reflect_Y:return "xy";
    default:return "none";
  }
  return "invalid reflection";
}

static const char *
find_vendor(const char *pnp_id) {
  guint i;

  for (i = 0; i < G_N_ELEMENTS (vendors); i++) {
    if (g_strcmp0(vendors[i].vendor_id, pnp_id) == 0)
      return vendors[i].vendor_name;
  }

  return pnp_id;
}

template<size_t SIZE>
static int getPosition(const char *(&arr)[SIZE], const char *str) {
  for (size_t i = 0; i < SIZE; i++) {
    if (strcmp(arr[i], str) == 0) {
      return static_cast<int>(i);
    }
  }
  return -1;
}

static double
modeRate(const XRRModeInfo *mode_info) {
  double rate;
  double vTotal = mode_info->vTotal;

  if (mode_info->modeFlags & RR_DoubleScan) {
    /* doublescan doubles the number of lines */
    vTotal *= 2;
  }

  if (mode_info->modeFlags & RR_Interlace) {
    /* interlace splits the frame into two fields */
    /* the field rate is what is typically reported by monitors */
    vTotal /= 2;
  }

  if (mode_info->hTotal && vTotal > 0)
    rate = ((double) mode_info->dotClock /
        ((double) mode_info->hTotal * vTotal));
  else {
    rate = 0;
  }
  return rate;
}

void
XrandrClose() {
  XCloseDisplay(dpy);
  dpy = nullptr;
}

ScreenResources
getScreenResources(int screen_number) {
  if (screen_number == -1) {
    screen_number = DefaultScreen(dpy);
  }
  Window root = RootWindow (dpy, screen_number);
//  g_debug("screen %d, dpy, dpy: %p, root: %lu", screen_number, dpy, root);
//  auto r = XRRGetScreenResources(d, root);
//  g_debug("res: %p", r);
//  XRRFreeScreenResources(r);

  ScreenResourcesPtr res(XRRGetScreenResources(dpy, root), XRRFreeScreenResources);
  return make_pair(res, screen_number);
}

Outputs
getOutputs(ScreenResources res) {
  Outputs::first_type outputs;
  auto resData = res.first;
  for (int o = 0; o < resData->noutput; o++) {
    OutputInfoPtr outputInfo(XRRGetOutputInfo(dpy, resData.get(), resData->outputs[o]), XRRFreeOutputInfo);
    if (!outputInfo) {
      g_warning ("could not get output 0x%lx information", resData->outputs[o]);
      continue;
    }
    outputs.insert({resData->outputs[o], outputInfo});
  }
  return make_pair(outputs, res.second);
}

Crtcs
getCrtcs(ScreenResources res) {
  Crtcs::first_type crtcs;
  auto resData = res.first;
  for (int c = 0; c < resData->ncrtc; c++) {
    CrtcInfoPtr crtcInfo(XRRGetCrtcInfo(dpy, resData.get(), resData->crtcs[c]), XRRFreeCrtcInfo);
    if (!crtcInfo) {
      g_warning ("could not get crtc 0x%lx information", resData->crtcs[c]);
      continue;
    }
    // g_debug("CRTC: 0x%lx", res->crtcs[c]);
    // g_debug("\tsize: %dx%d", crtcInfo->width, crtcInfo->height);
    // g_debug("\torigin: %d, %d", crtcInfo->x, crtcInfo->y);
    // g_debug("\tmode: 0x%lx", crtcInfo->mode);
    // g_debug("\toutput[0]: 0x%lx", crtcInfo->noutput > 0 ? crtcInfo->outputs[0] : 0);
    crtcs.insert({resData->crtcs[c], crtcInfo});
  }
  return make_pair(crtcs, res.second);
}

static ModeInfoPtr
cloneModeInfo(XRRModeInfo *origin) {
  if (!origin) { return nullptr; }
  ModeInfoPtr clone(XRRAllocModeInfo(origin->name, origin->nameLength), XRRFreeModeInfo);
  if (!clone) { return clone; }
  memcpy(clone.get(), origin, sizeof(XRRModeInfo));
  clone->name = (char *) (clone.get() + 1);
  return clone;
}

Modes
getModes(ScreenResources res) {
  Modes::first_type modes;
  auto resData = res.first;
  for (int m = 0; m < resData->nmode; m++) {
    ModeInfoPtr modeInfo = cloneModeInfo(&resData->modes[m]);
    if (!modeInfo) {
      g_warning ("out of memory");
      continue;
    }
    modes.insert({modeInfo->id, modeInfo});
  }
  return make_pair(modes, res.second);
}

static pair<double, double>
getScale(const XTransform &transform) {
  pair<double, double> scale = make_pair(0.0, 0.0);
  for (int k = 0; k < 2; k++) {
    for (int l = 0; l < 2; l++) {
      if ((k == l && transform.matrix[k][l] == 0) || (k != l && transform.matrix[k][l] != 0)) {
        g_warning("Transformation is not scaling");
        return scale;
      }
    }
  }

  scale.first = XFixedToDouble(transform.matrix[0][0]);
  scale.second = XFixedToDouble(transform.matrix[1][1]);
  return scale;
}

static int
modeHeight(XRRModeInfo *modeInfo, Rotation rotation) {
  switch (rotation & 0xf) {
    case RR_Rotate_0:
    case RR_Rotate_180:return modeInfo->height;
    case RR_Rotate_90:
    case RR_Rotate_270:return modeInfo->width;
    default:return 0;
  }
}

static int
modeWidth(XRRModeInfo *modeInfo, Rotation rotation) {
  switch (rotation & 0xf) {
    case RR_Rotate_0:
    case RR_Rotate_180:return modeInfo->width;
    case RR_Rotate_90:
    case RR_Rotate_270:return modeInfo->height;
    default:return 0;
  }
}

static bool
transformPoint(XTransform *transform, double *xp, double *yp) {
  double vector[3];
  double result[3];
  int i, j;
  double v;

  vector[0] = *xp;
  vector[1] = *yp;
  vector[2] = 1;
  for (j = 0; j < 3; j++) {
    v = 0;
    for (i = 0; i < 3; i++) {
      v += (XFixedToDouble (transform->matrix[j][i]) * vector[i]);
    }
    result[j] = v;
  }

  if (!result[2]) {
    g_warning("invalid transfomation");
    return false;
  }
  for (j = 0; j < 2; j++) {
    vector[j] = result[j] / result[2];
    if (vector[j] > 32767 || vector[j] < -32767) {
      return false;
    }
  }
  *xp = vector[0];
  *yp = vector[1];
  return true;
}

static bool
pathBounds(XTransform *transform, point_t *points, int npoints, box_t *box) {
  int i;
  box_t point;

  for (i = 0; i < npoints; i++) {
    double x, y;
    x = points[i].x;
    y = points[i].y;
    if (!transformPoint(transform, &x, &y)) {
      return false;
    }
    point.x1 = static_cast<int>(floor(x));
    point.y1 = static_cast<int>(floor(y));
    point.x2 = static_cast<int>(ceil(x));
    point.y2 = static_cast<int>(ceil(y));
    if (i == 0) {
      *box = point;
    } else {
      if (point.x1 < box->x1) { box->x1 = point.x1; }
      if (point.y1 < box->y1) { box->y1 = point.y1; }
      if (point.x2 > box->x2) { box->x2 = point.x2; }
      if (point.y2 > box->y2) { box->y2 = point.y2; }
    }
  }
  return true;
}

static bool
modeGeometry(XRRModeInfo *modeInfo, Rotation rotation, XTransform *transform, box_t *bounds) {
  point_t rect[4];
  int width = modeWidth(modeInfo, rotation);
  int height = modeHeight(modeInfo, rotation);

  rect[0].x = 0;
  rect[0].y = 0;
  rect[1].x = width;
  rect[1].y = 0;
  rect[2].x = width;
  rect[2].y = height;
  rect[3].x = 0;
  rect[3].y = height;
  return pathBounds(transform, rect, 4, bounds);
}

static bool
updateScreenSize(Napi::Env env, Outputs &outputs, Crtcs crtcs, Modes &modes) {
  if (outputs.second != crtcs.second || crtcs.second != modes.second) {
    g_warning("different screens");
    return false;
  }
  Window root = RootWindow (dpy, outputs.second);

  int minWidth, maxWidth, minHeight, maxHeight;
  XRRGetScreenSizeRange(dpy, root, &minWidth, &minHeight, &maxWidth, &maxHeight);

  int width = 0, height = 0;
  for (auto output : outputs.first) {
    auto curOutput = output.second;
    auto curCrtc = crtcs.first[curOutput->crtc];
    auto curMode = curCrtc ? modes.first[curCrtc->mode] : ModeInfoPtr();
    if (!curMode) { continue; }
    box_t bounds;
    XRRCrtcTransformAttributes *attr = nullptr;
    XRRGetCrtcTransform(dpy, curOutput->crtc, &attr);
    bool ret = modeGeometry(curMode.get(), curCrtc->rotation, attr ? &attr->currentTransform : nullptr, &bounds);
    if (attr) {
      XFree(attr);
    }
    if (!ret) { return false; }

    int x = curCrtc->x + bounds.x1;
    int y = curCrtc->y + bounds.y1;
    int w = bounds.x2 - bounds.x1;
    int h = bounds.y2 - bounds.y1;
    if (x + w > width) {
      width = x + w;
    }
    if (y + h > height) {
      height = y + h;
    }
  }

  if (width > maxWidth || height > maxHeight) {
    auto msg =
        string_format("screen cannot be larger than %dx%d (desired size %dx%d)\n", maxWidth, maxHeight, width, height);
    Napi::Error::New(env, msg.c_str()).ThrowAsJavaScriptException();
    return false;
  }
  if (width < minWidth) { width = minWidth; }
  if (height < minHeight) { height = minHeight; }

  /*
   * Compute physical screen size
   */
  // if (width != DisplayWidth (dpy, screen) || height != DisplayHeight (dpy, screen)) {
  double dpi = (25.4 * DisplayHeight (dpy, outputs.second)) / DisplayHeightMM(dpy, outputs.second);

  int width_mm = static_cast<int>((25.4 * width) / dpi);
  int height_mm = static_cast<int>((25.4 * height) / dpi);

  XRRSetScreenSize(dpy, root, width, height, width_mm, height_mm);
  // }
  g_debug("screen size: %dx%d", width, height);

  return true;
}

static void
disableCrtcs(XRRScreenResources *res) {
  for (int c = 0; c < res->ncrtc; c++) {
    XRRSetCrtcConfig(dpy, res, res->crtcs[c], CurrentTime, 0, 0, 0, RR_Rotate_0, nullptr, 0);
  }
}

static void
screenRevert() {
  int screen = DefaultScreen (dpy);
  Window root = RootWindow (dpy, screen);
  XRRSetScreenSize(dpy, root,
                   DisplayWidth (dpy, screen),
                   DisplayHeight (dpy, screen),
                   DisplayWidthMM (dpy, screen),
                   DisplayHeightMM (dpy, screen));
}

static void
revert(XRRScreenResources *res, Crtcs &crtcs) {
  disableCrtcs(res);
  screenRevert();
  for (auto crtc : crtcs.first) {
    XRRSetCrtcConfig(dpy, res, crtc.first, CurrentTime,
                     crtc.second->x, crtc.second->y,
                     crtc.second->mode, crtc.second->rotation,
                     crtc.second->outputs, crtc.second->noutput);
  }
}

static ModeInfoPtr
findModeForOutput(Modes &modes, XRROutputInfo *output, const char *name, double rate) {
  bool automatic = strcmp(name, "auto") == 0;
  ModeInfoPtr best;
  double bestDist = 100000.0;
  for (int m = 0; m < output->nmode; m++) {
    auto mode = modes.first[output->modes[m]];
    if (!mode) { continue; }
    if (automatic && m < output->npreferred) {
      return mode;
    }
    if (strcmp(mode->name, name) == 0) {
      double dist = 0;
      /* Stay away from doublescan modes unless refresh rate is specified. */
      if (!rate && (mode->modeFlags & RR_DoubleScan)) { continue; }
      if (rate) {
        dist = std::abs(modeRate(mode.get()) - rate);
      }
      if (!best || dist < bestDist) {
        bestDist = dist;
        best = mode;
      }
    }
  }
  return best;
}

static void
updateCrtcTransform(Napi::Env env, Napi::Object output, RRCrtc crtc) {
  XRRCrtcTransformAttributes *attr;
  if (XRRGetCrtcTransform(dpy, crtc, &attr) && attr) {
    auto scale = getScale(attr->currentTransform);
    if (scale.first != 1.0 || scale.second != 1.0) {
      if (scale.first == 0.0 || scale.second == 0.0) {
        auto transform = Napi::Array::New(env, 9);
        output.Set("transform", transform);
        uint32_t i = 0;
        for (int k = 0; k < 2; k++) {
          for (int l = 0; l < 2; l++) {
            transform.Set(i++, XFixedToDouble(attr->currentTransform.matrix[k][l]));
          }
        }
      } else {
        output.Set("scaleX", scale.first);
        output.Set("scaleY", scale.second);
      }
      if (attr->currentFilter) {
        output.Set("filter", attr->currentFilter);
      }
    }
    XFree(attr);
  }
}

static Napi::Value
getPropertyValue(Napi::Env env, Atom value_type, int value_format, const void *value_bytes) {
  if (value_type == XA_ATOM && value_format == 32) {
    const Atom *val = static_cast<const Atom *>(value_bytes);
    char *str = XGetAtomName(dpy, *val);
    if (str == nullptr) { return env.Null(); }
    auto value = Napi::String::New(env, str);
    XFree(str);
    return value;
  }

  if (value_type == XA_INTEGER) {
    switch (value_format) {
      case 8:return Napi::Number::New(env, *static_cast<const int8_t *>(value_bytes));
      case 16:return Napi::Number::New(env, *static_cast<const int16_t *>(value_bytes));
      case 32:return Napi::Number::New(env, *static_cast<const int32_t *>(value_bytes));
      default:g_warning("Unknown format");
        return env.Undefined();
    }
  }

  if (value_type == XA_CARDINAL) {
    switch (value_format) {
      case 8:return Napi::Number::New(env, *static_cast<const uint8_t *>(value_bytes));
      case 16:return Napi::Number::New(env, *static_cast<const uint16_t *>(value_bytes));
      case 32:return Napi::Number::New(env, *static_cast<const uint32_t *>(value_bytes));
      default:g_warning("Unknown format");
        return env.Undefined();
    }
  }

  g_warning("Unknown property type");
  return env.Undefined();
}

static Napi::Value
getPropertyArray(Napi::Env env, uint32_t nitems, Atom value_type, int value_format, const void *value_bytes) {
  if (value_type == XA_ATOM && value_format == 32) {
    uint32_t len = nitems / 4;
    auto values = Napi::Array::New(env, len);
    const Atom *val = static_cast<const Atom *>(value_bytes);
    for (uint32_t i = 0; i < len; i++) {
      char *str = XGetAtomName(dpy, val[i]);
      if (str == nullptr) {
        values.Set(i, env.Null());
      } else {
        values.Set(i, str);
      }
      XFree(str);
    }
    return values;
  }

  if (value_type != XA_INTEGER && value_type != XA_CARDINAL) {
    return env.Undefined();
  }

  auto buffer = Napi::ArrayBuffer::New(env, const_cast<void *>(value_bytes), nitems);

  if (value_type == XA_INTEGER) {
    switch (value_format) {
      case 8:return Napi::Int8Array::New(env, nitems, buffer, 0);
      case 16:return Napi::Int16Array::New(env, nitems / 2, buffer, 0);
      case 32:return Napi::Int32Array::New(env, nitems / 4, buffer, 0);
      default:g_warning("Unknown format");
        return env.Undefined();
    }
  }

  // (value_type == XA_CARDINAL)
  switch (value_format) {
    case 8:return Napi::Uint8Array::New(env, nitems, buffer, 0);
    case 16:return Napi::Uint16Array::New(env, nitems / 2, buffer, 0);
    case 32:return Napi::Uint32Array::New(env, nitems / 4, buffer, 0);
    default:g_warning("Unknown format");
      return env.Undefined();
  }
}

static inline char
convertToChar(int ch) {
  return static_cast<char>(ch + 'A' - 1);
}

static void
parseEDID(Napi::Env env, Napi::Object obj, int size, const byte *edid) {
  int i;
  int j;
  byte sum = 0;
  char modelname[13] = {};

  //check the checksum
  for (i = 0; i < 128; i++) {
    sum += edid[i];
  }
  if (sum) {
    g_warning ("EDID Checksum failed");
  }

  //check header
  for (i = 0; i < 8; i++) {
    if (!(((i == 0 || i == 7) && edid[i] == 0x00) || (edid[i] == 0xff))) { //0x00 0xff 0xff 0xff 0xff 0xff 0x00
      g_warning("Header incorrect. Probably not an edid");
    }
  }

  //Product Identification
  /* Model Name: Only thing I do out of order of edid, to comply with X standards... */
  for (i = 0x36; i < 0x7E; i += 0x12) { //read through descriptor blocks...
    if (edid[i] == 0x00) { //not a timing descriptor
      if (edid[i + 3] == 0xfc) { //Model Name tag
        for (j = 0; j < 13; j++) {
          if (edid[i + 5 + j] == 0x0a) {
            modelname[j] = 0x00;
          } else {
            modelname[j] = edid[i + 5 + j];
          }
        }
      }
    }
  }

  obj.Set("modelName", modelname);

  /* Vendor Name: 3 characters, standardized by microsoft, somewhere.
   * bytes 8 and 9: f e d c b a 9 8  7 6 5 4 3 2 1 0
   * Character 1 is e d c b a
   * Character 2 is 9 8 7 6 5
   * Character 3 is 4 3 2 1 0
   * Those values start at 0 (0x00 is 'A', 0x01 is 'B', 0x19 is 'Z', etc.)
   */
  char vendorName[4] = {
      convertToChar(edid[8] >> 2 & 0x1f),
      convertToChar(((edid[8] & 0x3) << 3) | ((edid[9] & 0xe0) >> 5)),
      convertToChar(edid[9] & 0x1f),
      0
  };

  obj.Set("vendorName", find_vendor(vendorName));


  /* Skip Product ID and Serial Number. */
  /* Week and Year: not required, but do it for fun. */
  auto manufactured = Napi::Object::New(env);
  obj.Set("manufactured", manufactured);
  if (edid[0x10] <= 54) {
    manufactured.Set("week", (int) (edid[0x10]));
  }
  manufactured.Set("year", ((int) (edid[0x11])) + 1990);

  obj.Set("version", string_format("%i.%i", (int) (edid[0x12]), (int) (edid[0x13])));

  //Basic Display Parameter
  /* Digital or not? */
  if (edid[0x14] & 0x80) {
    obj.Set("display", "digital");
  } else {
    obj.Set("display", "analog");
    if (edid[0x14] & 0x02) { //sync on green.
      obj.Set("syncOnGreen", true);
    }
  }
  /* Ignore video input definitions, because X doesn't care. */

  /* Size parameters: H and V, in centimeters. Projectors put 0 here.
   * DiplaySize is in millimeters, so multiply by 10
   * If 0x16 is 0, but not 0x15, you really should do aspect ratio... */
  if (edid[0x15] && edid[0x16]) {
    obj.Set("width", ((int) (edid[0x15])) * 10);
    obj.Set("height", ((int) (edid[0x16])) * 10);
  }

  /* Gamma. Divide by 100, add 1. Defaults to 1, so if 0, it'll be 1 anyway. */
  if (edid[0x17] != 0xff) {
    obj.Set("gamma", (((float) edid[0x17]) / 100) + 1);
  }

  /* DPMS. Simple yes or no. */
  obj.Set("DPMS", (edid[0x18] & 0xE0) ? true : false);
}

static Atom
updatePropertyValue(Napi::Env env, Napi::Object property, RROutput xid, Atom propItem) {
  shared_ptr<char> atom_name(XGetAtomName(dpy, propItem), XFree);
  unsigned char *prop;
  unsigned long nitems, bytes_after;
  Atom actual_type;
  int actual_format;
  XRRGetOutputProperty(dpy, xid, propItem,
                       0, 100, 0, 0,
                       AnyPropertyType,
                       &actual_type, &actual_format,
                       &nitems, &bytes_after, &prop);

  if (strcmp(atom_name.get(), "EDID") == 0 && actual_format == 8 && actual_type == XA_INTEGER && nitems >= 128) {
    parseEDID(env, property, nitems, prop);
    XFree(prop);
    return actual_type;
  }

  property.Set("value", nitems == 1
                        ? getPropertyValue(env, actual_type, actual_format, prop)
                        : getPropertyArray(env, nitems, actual_type, actual_format, prop)
  );
  XFree(prop);
  return actual_type;
}

static Napi::Value
getRange(Napi::Env env, Atom value_type, const long *values) {
  auto range = Napi::Array::New(env, 2);
  range.Set((uint32_t) 0, getPropertyValue(env, value_type, 32, &values[0]));
  range.Set(1, getPropertyValue(env, value_type, 32, &values[1]));
  return range;
}

static void
updateOutputProperties(Napi::Env env, Napi::Object output, RROutput xid) {
  int nprop = 0;
  Atom *props = XRRListOutputProperties(dpy, xid, &nprop);
  if (nprop == 0) { return; }

  auto properties = Napi::Object::New(env);
  output.Set("properties", properties);
  for (uint32_t i = 0; i < nprop; i++) {
    auto property = Napi::Object::New(env);
    char *atom_name = XGetAtomName(dpy, props[i]);
    properties.Set(atom_name, property);
    XFree(atom_name);
    Atom actual_type = updatePropertyValue(env, property, xid, props[i]);
    XRRPropertyInfo *propinfo = XRRQueryOutputProperty(dpy, xid, props[i]);
    if (propinfo->range && propinfo->num_values > 0) {
      auto nranges = static_cast<uint32_t>(propinfo->num_values / 2);
      if (nranges == 1) {
        property.Set("range", getRange(env, actual_type, propinfo->values));
      } else {
        auto ranges = Napi::Array::New(env, nranges);
        property.Set("range", ranges);
        for (uint32_t k = 0; k < nranges; k++) {
          ranges.Set(k, getRange(env, actual_type, &propinfo->values[k * 2]));
        }
      }
    } else if (!propinfo->range && propinfo->num_values > 0) {
      property.Set("supported", getPropertyArray(env,
                                                 static_cast<uint32_t>(propinfo->num_values * 4),
                                                 actual_type,
                                                 32,
                                                 propinfo->values));
    }
    XFree(propinfo);
  }
  XFree(props);
}

void
transformLayout(const char *output, int &left, int &top, int &width, int &height) {
  char *pend = nullptr;
  auto screen_number = static_cast<int>(strtol(output, &pend, 10));
  output = pend + 1;
  auto res = getScreenResources(screen_number);
//  g_debug(">transformLayout %s, %d,%d %dx%d, screen: %d", output, left, top, width, height, screen_number);

  auto outputs = getOutputs(res);
  auto crtcs = getCrtcs(res);
  auto it = findByName(outputs.first, output);
  if (it == end(outputs.first)) return;

  auto outputInfo = it->second;
  auto crtcInfo = crtcs.first[outputInfo->crtc];
  if (!crtcInfo) return;

  int temp;
  switch (crtcInfo->rotation & 0xf) {
    case RR_Rotate_0:break;
    case RR_Rotate_180:g_debug("transform invert");
      left = crtcInfo->width - width - left;
      top = crtcInfo->height - height - top;
      break;
    case RR_Rotate_90:swap(width, height);
      temp = left;
      left = crtcInfo->width - width - top;
      top = temp;
      break;
    case RR_Rotate_270:swap(width, height);
      temp = top;
      top = crtcInfo->height - height - left;
      left = temp;
      break;
    default:g_warning("unknown rotation");
      break;
  }
  if (crtcInfo->rotation & RR_Reflect_X) {
    left = crtcInfo->width - width - left;
  }

  if (crtcInfo->rotation & RR_Reflect_Y) {
    top = crtcInfo->height - height - top;
  }

  // g_debug("<transformLayout %s, %d,%d %dx%d", output, left, top, width, height);
}

unordered_map<string, string>
getOutputParams(RROutput xid) {
  unordered_map<string, string> params;
  int nprop = 0;
  Atom *props = XRRListOutputProperties(dpy, xid, &nprop);
  bool edid = false;
  for (int p = 0; p < nprop && !edid; p++) {
    char *atom_name = XGetAtomName(dpy, props[p]);
    unsigned char *prop;
    unsigned long nitems, bytes_after;
    Atom actual_type;
    int actual_format;
    XRRGetOutputProperty(dpy, xid, props[p],
                         0, 100, 0, 0,
                         AnyPropertyType,
                         &actual_type, &actual_format,
                         &nitems, &bytes_after, &prop);
    if (strcmp(atom_name, "EDID") == 0 && actual_format == 8 && actual_type == XA_INTEGER && nitems >= 128) {
      edid = true;
      char modelname[13] = {};
      for (int i = 0x36; i < 0x7E; i += 0x12) { //read through descriptor blocks...
        if (prop[i] == 0x00) { //not a timing descriptor
          if (prop[i + 3] == 0xfc) { //Model Name tag
            for (int j = 0; j < 13; j++) {
              if (prop[i + 5 + j] == 0x0a) {
                modelname[j] = 0x00;
              } else {
                modelname[j] = prop[i + 5 + j];
              }
            }
          }
        }
      }
      char vendorName[4] = {
          convertToChar(prop[8] >> 2 & 0x1f),
          convertToChar(((prop[8] & 0x3) << 3) | ((prop[9] & 0xe0) >> 5)),
          convertToChar(prop[9] & 0x1f),
          0
      };
      params.insert({"vendor", vendorName});
      params.insert({"model", modelname});
      params.insert({"display", (prop[0x14] & 0x80) ? "digital" : "analog"});
    }
    XFree(prop);
    XFree(atom_name);
  }
  XFree(props);
  return params;
}

Napi::Array
getArrayOutputs(Napi::Env env, ScreenResources res) {
  Window root = RootWindow (dpy, res.second);
  RROutput primary = XRRGetOutputPrimary(dpy, root);
  auto modes = getModes(res).first;
  auto crtcs = getCrtcs(res).first;
  auto outputs = getOutputs(res).first;
  g_debug("modes %lu", modes.size());
  g_debug("crtcs %lu", crtcs.size());
  g_debug("outputs %lu", outputs.size());

  auto result = Napi::Array::New(env, outputs.size());
  uint32_t i = 0;
  for (auto item : outputs) {
    RROutput xid = item.first;
    auto curOutput = item.second;
    auto output = Napi::Object::New(env);
    result.Set(i++, output);
    output.Set("xid", xid);
    output.Set("name", curOutput->name);
    output.Set("connected", curOutput->connection == RR_Connected);
    if (xid == primary) {
      output.Set("primary", true);
    }
    auto curCrtc = crtcs[curOutput->crtc];
    auto curMode = curCrtc ? modes[curCrtc->mode] : ModeInfoPtr();
    if (curCrtc) {
      output.Set("width", curCrtc->width);
      output.Set("height", curCrtc->height);
      output.Set("x", curCrtc->x);
      output.Set("y", curCrtc->y);
      output.Set("direction", directionName(curCrtc->rotation));
      output.Set("reflection", reflectionName(curCrtc->rotation));
      if (curMode) {
        output.Set("mode", curCrtc->mode);
        output.Set("rate", modeRate(curMode.get()));
      }
      updateCrtcTransform(env, output, curOutput->crtc);
      // g_debug("timestamp %" PRIu64 ", %" PRIu64, curOutput->timestamp, curCrtc->timestamp);
      output.Set("timestamp", std::max(curOutput->timestamp, curCrtc->timestamp));
    } else {
      output.Set("timestamp", curOutput->timestamp);
    }
    updateOutputProperties(env, output, xid);
    auto validModes = Napi::Array::New(env, curOutput->nmode);
    output.Set("modes", validModes);
    for (int j = 0; j < curOutput->nmode; j++) {
      auto mode = Napi::Object::New(env); // Nan::New<Napi::Object>();
      validModes.Set(j, mode);
      auto modeInfo = modes[curOutput->modes[j]];
      if (!modeInfo) { continue; }
      mode.Set("id", modeInfo->id);
      mode.Set("name", modeInfo->name);
      mode.Set("rate", modeRate(modeInfo.get()));
      if (j < curOutput->npreferred) {
        mode.Set("preferred", true);
      }
      if (modeInfo == curMode) {
        mode.Set("active", true);
      }
    }
  }
  return result;
}

Napi::Value GetOutputs(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (dpy == nullptr) {
    Napi::Error::New(env, "Can't open default display.").ThrowAsJavaScriptException();
    return env.Null();
  }

  int event_base, error_base;
  int major, minor;
  if (!XRRQueryExtension(dpy, &event_base, &error_base) || !XRRQueryVersion(dpy, &major, &minor)) {
    Napi::Error::New(env, "RandR extension missing").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (major < 1 || (major == 1 && minor < 3)) {
    Napi::Error::New(env, "Server RandR version before 1.3").ThrowAsJavaScriptException();
    return env.Null();
  }

  int count = ScreenCount(dpy);
  auto retValue = Napi::Array::New(env, count);

  g_debug("ScreenCount %d", count);
  for (uint32_t screen_number = 0; screen_number < count; screen_number++) {
    auto res = getScreenResources(screen_number);
    if (!res.first) continue;
    retValue.Set(screen_number, getArrayOutputs(env, res));
  }
  return retValue;
}

Napi::Value SetMode(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (info.Length() < 2) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  int screen_number = DefaultScreen (dpy);
  if (info.Length() > 2 && info[2].IsNumber()) {
    screen_number = info[2].As<Napi::Number>().Int32Value();
  }
  Window root = RootWindow (dpy, screen_number);
  auto res = getScreenResources(screen_number);

  auto crtcs = getCrtcs(res);
  auto crtcMap = crtcs.first;
  auto outputs = getOutputs(res);
  auto outputsMap = outputs.first;
  auto modes = getModes(res);
  typename Outputs::first_type::iterator itOutput;
  if (info[0].IsNumber()) {
    RROutput xid = static_cast<RROutput>(info[0].As<Napi::Number>().Int32Value());
    itOutput = outputsMap.find(xid);
  } else if (info[0].IsString()) {
    std::string str(info[0].As<Napi::String>());
    itOutput = findByName(outputsMap, str.c_str());
  }

  if (itOutput == end(outputsMap)) {
    Napi::Error::New(env, "could not find output").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  RROutput xid = itOutput->first;
  auto curOutput = itOutput->second;
  auto curCrtc = crtcMap[curOutput->crtc];
  RRCrtc crtcXid = curOutput->crtc;
  vector<RROutput> tempOutputs;
  RROutput *poutputs;
  int noutput;
  if (!curCrtc) {
    auto checkCrtc = [&](typename Crtcs::first_type::value_type &value) -> bool {
      auto crtc = value.second;
      RRCrtc _crtcXid = value.first;
      int c;
      for (c = 0; c < curOutput->ncrtc; c++) {
        if (_crtcXid == curOutput->crtcs[c])
          break;
      }
      if (c == curOutput->ncrtc) return false;
      for (auto _itOutput: outputsMap) {
        auto other = _itOutput.second;
        RROutput otherXid = _itOutput.first;
        if (other == curOutput || !other->crtc || other->crtc != _crtcXid)
          continue;
        /* see if the curOutput connected to the crtc can clone to this curOutput */
        int l;
        for (l = 0; l < curOutput->nclone; l++) {
          if (curOutput->clones[l] == otherXid)
            break;
        }
        if (l == curOutput->nclone) return false;
      }

      if (crtc->noutput) {
        int m;
        for (m = 0; m < curOutput->nmode; m++) {
          if (curOutput->modes[m] == crtc->mode)
            break;
        }
        if (m == curOutput->nmode) return false;
      } else {
        crtc->x = 0;
        crtc->y = 0;
        crtc->rotation = RR_Rotate_0;
      }
      return true;
    };

    auto itCrtc = find_if(begin(crtcMap), end(crtcMap), checkCrtc);
    if (itCrtc == end(crtcMap)) {
      Napi::Error::New(env, "Cannot find crtc for output").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    g_debug("Found crtc 0x%lx for output %s", itCrtc->first, curOutput->name);
    curCrtc = itCrtc->second;
    crtcXid = itCrtc->first;
    tempOutputs.assign(curCrtc->outputs, curCrtc->outputs + curCrtc->noutput);
    tempOutputs.push_back(xid);
    noutput = static_cast<int>(tempOutputs.size());
    poutputs = tempOutputs.data();
  } else {
    noutput = curCrtc->noutput;
    poutputs = curCrtc->outputs;
  }

  RRMode mode = curCrtc->mode;
  int x = curCrtc->x, y = curCrtc->y;
  Rotation rotation = curCrtc->rotation;
  double rate = 0.0;
  string strMode;
  bool primary = false;

  if (info[1].IsNumber()) {
    mode = static_cast<RRMode>(info[1].As<Napi::Number>().Int32Value());
  } else if (info[1].IsString()) {
    strMode = info[1].As<Napi::String>();
  } else if (info[1].IsObject()) {
    auto options = info[1].As<Napi::Object>();
    if (options.Has("x")) {
      x = options.Get("x").ToNumber().Int32Value();
    }
    if (options.Has("y")) {
      y = options.Get("y").ToNumber().Int32Value();
    }
    string direction(directionName(curCrtc->rotation));
    if (options.Has("direction")) {
      direction = options.Get("direction").ToString();
    }
    string reflection(reflectionName(curCrtc->rotation));
    if (options.Has("reflection")) {
      reflection = options.Get("reflection").ToString();
    }
    int dir = getPosition(directions, direction.c_str());
    if (dir == -1) {
      Napi::Error::New(env, "Invalid direction. Supported: normal, left, inverted, right").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    int refl = getPosition(reflections, reflection.c_str());
    if (refl == -1) {
      Napi::Error::New(env, "Invalid reflection. Supported: none, x, y, xy").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    rotation &= ~0xf;
    rotation |= 1 << dir;
    rotation &= ~(RR_Reflect_X | RR_Reflect_Y);
    rotation |= refl * RR_Reflect_X;

    if (options.Has("mode")) {
      Napi::Value vMode = options.Get("mode");
      if (vMode.IsNumber()) {
        mode = static_cast<RRMode>(vMode.As<Napi::Number>().Int32Value());
      } else {
        strMode = vMode.ToString();
      }
    }
    if (options.Has("rate")) {
      rate = options.Get("rate").ToNumber().Int32Value();
    }
    if (options.Has("primary")) {
      primary = options.Get("primary").ToBoolean();
    }
    double scaleX = 0.0;
    if (options.Has("scaleX")) {
      scaleX = options.Get("scaleX").ToNumber();
    }
    double scaleY = 0.0;
    if (options.Has("scaleY")) {
      scaleY = options.Get("scaleY").ToNumber();
    }
    if (scaleX != 0.0 || scaleY != 0.0) {
      if (scaleX == 0.0) {
        scaleX = 1.0;
      }
      if (scaleY == 0.0) {
        scaleY = 1.0;
      }
      XTransform transform = {0};
      transform.matrix[0][0] = XDoubleToFixed(scaleX);
      transform.matrix[1][1] = XDoubleToFixed(scaleY);
      transform.matrix[2][2] = XDoubleToFixed(1.0);
      XRRSetCrtcTransform(dpy,
                          crtcXid,
                          &transform,
                          scaleX != 1.0 || scaleY != 1.0 ? "bilinear" : "nearest",
                          nullptr,
                          0);
    }
  }
  if (rate && strMode.empty()) {
    strMode = modes.first[mode]->name;
  }
  if (!strMode.empty()) {
    auto best = findModeForOutput(modes, curOutput.get(), strMode.c_str(), rate);
    if (!best) {
      Napi::Error::New(env, "invalid mode").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    mode = best->id;
  }

  if (find(curOutput->modes, curOutput->modes + curOutput->nmode, mode) == curOutput->modes + curOutput->nmode) {
    Napi::Error::New(env, "invalid mode").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  Status s = XRRSetCrtcConfig(dpy, res.first.get(), crtcXid, CurrentTime, x, y, mode, rotation, poutputs, noutput);
  if (s != RRSetConfigSuccess || !updateScreenSize(env, outputs, getCrtcs(res), modes)) {
    revert(res.first.get(), crtcs);
  } else if (primary) {
    XRRSetOutputPrimary(dpy, root, xid);
  }
  XSync(dpy, 0);
  return Napi::Boolean::New(env, s == RRSetConfigSuccess);
}

Display *getDisplay() {
  return dpy;
}

Napi::Object XrandrInit(Napi::Env env, Napi::Object exports) {
  auto xrandr = Napi::Object::New(env);
  dpy = XOpenDisplay(nullptr);
  xrandr.Set("getOutputs", Napi::Function::New(env, GetOutputs));
  xrandr.Set("setOutputMode", Napi::Function::New(env, SetMode));
  exports.Set("xrandr", xrandr);
  return exports;
}

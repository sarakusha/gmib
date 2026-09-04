#include <stdint.h>
#include <stdlib.h>

struct wlr_buffer;
struct wlr_cursor;
struct wlr_surface;
struct wlr_xcursor_manager;

extern void wlr_cursor_unset_image(struct wlr_cursor *cursor);

__attribute__((constructor))
static void clear_preload_for_children(void) {
  unsetenv("LD_PRELOAD");
}

void wlr_cursor_set_xcursor(
    struct wlr_cursor *cursor,
    struct wlr_xcursor_manager *manager,
    const char *name) {
  (void)manager;
  (void)name;
  wlr_cursor_unset_image(cursor);
}

void wlr_cursor_set_surface(
    struct wlr_cursor *cursor,
    struct wlr_surface *surface,
    int32_t hotspot_x,
    int32_t hotspot_y) {
  (void)surface;
  (void)hotspot_x;
  (void)hotspot_y;
  wlr_cursor_unset_image(cursor);
}

void wlr_cursor_set_buffer(
    struct wlr_cursor *cursor,
    struct wlr_buffer *buffer,
    int32_t hotspot_x,
    int32_t hotspot_y,
    float scale) {
  (void)buffer;
  (void)hotspot_x;
  (void)hotspot_y;
  (void)scale;
  wlr_cursor_unset_image(cursor);
}

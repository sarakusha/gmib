#include <memory>

#include <stdarg.h>  // For va_start, etc.
#include <memory>    // For std::unique_ptr
#include <string>
#include <cstring>

std::string string_format(const std::string fmt_str, ...) {
  long final_n, n = ((long) fmt_str.size()) * 2; /* Reserve two times as much as the length of the fmt_str */
  std::string str;
  std::unique_ptr<char[]> formatted;
  va_list ap;
  while (1) {
    formatted = std::make_unique<char[]>(n); /* Wrap the plain char array into the unique_ptr */
    strcpy(&formatted[0], fmt_str.c_str());
    va_start(ap, fmt_str);
    final_n = vsnprintf(&formatted[0], n, fmt_str.c_str(), ap);
    va_end(ap);
    if (final_n < 0 || final_n >= n) {
      n += std::abs(final_n - n + 1);
    } else {
      break;
    }
  }
  return std::string(formatted.get());
}

std::string get_display_without_screen() {
  std::string display(getenv("DISPLAY"));
  auto colon = display.find(':');
  if (colon != std::string::npos) {
    auto dot_pos = display.find('.', colon);
    if (dot_pos != std::string::npos) {
      display.erase(dot_pos);
    }
  }
  return display;
}

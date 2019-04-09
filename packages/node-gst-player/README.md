# Установка

## Ubuntu
1. cmake (pip install --upgrade cmake)
2. ninja (sudo apt-get install ninja-build)
3. libx11-dev
4. libgtk-3-dev
5. gstreamer. если из исходников, то Cerbero
  - Python3 
  - pip3 (sudo apt-get install python3-pip)
  - setuptools3 (pip3 install setuptools)
  - git clone --depth 1 --single-branch --branch master https://gitlab.freedesktop.org/gstreamer/cerbero
6. gstreamer-1.0 gstreamer-base-1.0 gstreamer-video-1.0 gstreamer-plugins-base-1.0 gstreamer-plugins-bad-1.0 gstreamer-player-1.0
  ```bash
  sudo apt install libgstreamer-plugins-bad1.0-dev libgstreamer-plugins-base1.0-dev libgstreamermm-1.0-dev libgtkmm-3.0-dev
  ```
7. gstreamermm-1.0
8. gtkmm-3.0


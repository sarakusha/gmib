# Install
## linuxbrew
```bash
rm -rf ~/.cmake-js/
brew install ninja

```

## gstreamer-1.0

### gtk-build

  - #### Ubuntu 16.04
  v1.14
  ```bash
  git clone https://gitlab.freedesktop.org/gstreamer/gst-build.git
  cd gst-build
  git checkout 1.14
  mkdir build/ && meson build && ninja -C build/
  
  ```

### node-gst-player
  - ### Ubuntu 16.04
  ```bash
  sudo apt-get install gstreamermm-1.0-dev gtkmm-3.0-dev
  ```
  c++17 (variant)
  ```bash
  sudo add-apt-repository ppa:jonathonf/gcc-7.1
  sudo apt-get update
  sudo apt-get install gcc-7 g++-7
  sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-7 10
  sudo update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-7 10
  
  ```

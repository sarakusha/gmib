#!/usr/bin/env bash
set -euo pipefail

KIOSK_USER="${SUDO_USER:-}"
KIOSK_TTY="tty1"
GMIB_EXECUTABLE="/opt/gmib/gmib.AppImage"
START_SERVICE=true

usage() {
  cat <<'EOF'
Usage: sudo scripts/setup-linux-kiosk.sh [options]

Options:
  --user USER          Linux user that owns the GMIB configuration.
  --executable PATH    GMIB AppImage or unpacked executable.
  --tty ttyN           Virtual terminal used by Cage. Default: tty1.
  --no-start           Install files without replacing the current getty.
  -h, --help           Show this help.
EOF
}

while (($# > 0)); do
  case "$1" in
    --user)
      KIOSK_USER="${2:-}"
      shift 2
      ;;
    --executable)
      GMIB_EXECUTABLE="${2:-}"
      shift 2
      ;;
    --tty)
      KIOSK_TTY="${2:-}"
      shift 2
      ;;
    --no-start)
      START_SERVICE=false
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 1
fi
if [[ -z "$KIOSK_USER" ]] || ! id "$KIOSK_USER" >/dev/null 2>&1; then
  echo "Unknown kiosk user: ${KIOSK_USER:-<empty>}" >&2
  exit 1
fi
if [[ ! "$KIOSK_TTY" =~ ^tty[0-9]+$ ]]; then
  echo "--tty must look like tty1 or tty7." >&2
  exit 1
fi
if [[ "$GMIB_EXECUTABLE" != /* ]] || [[ "$GMIB_EXECUTABLE" =~ [[:space:]] ]]; then
  echo "--executable must be an absolute path without whitespace." >&2
  exit 1
fi
if [[ ! -x "$GMIB_EXECUTABLE" ]]; then
  echo "GMIB executable does not exist or is not executable: $GMIB_EXECUTABLE" >&2
  exit 1
fi

KIOSK_UID="$(id -u "$KIOSK_USER")"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y \
  binutils \
  cage \
  dbus-user-session \
  ffmpeg \
  gcc \
  libc6-dev \
  libfuse2t64 \
  libgl1-mesa-dri \
  libseat1 \
  mesa-utils \
  seatd \
  vainfo

usermod -aG video,render,dialout "$KIOSK_USER"

install -d -m 0755 /usr/local/lib
cc -shared -fPIC -O2 -Wall -Wextra \
  -o /usr/local/lib/gmib-hide-cursor.so \
  "$SCRIPT_DIR/gmib-hide-cursor.c"
chmod 0755 /usr/local/lib/gmib-hide-cursor.so

install -m 0644 /dev/stdin /etc/pam.d/gmib-cage <<'EOF'
auth           required        pam_unix.so nullok
account        required        pam_unix.so
session        required        pam_unix.so
session        required        pam_systemd.so
EOF

install -m 0644 /dev/stdin /etc/systemd/system/gmib-cage@.service <<EOF
[Unit]
Description=GMIB Cage kiosk on %I
After=systemd-user-sessions.service dbus.socket systemd-logind.service
Wants=dbus.socket systemd-logind.service
Conflicts=getty@%i.service
After=getty@%i.service

[Service]
Type=simple
User=${KIOSK_USER}
SupplementaryGroups=video render dialout
Environment="XDG_RUNTIME_DIR=/run/user/${KIOSK_UID}"
Environment="DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${KIOSK_UID}/bus"
Environment="XDG_SESSION_TYPE=wayland"
Environment="XDG_CURRENT_DESKTOP=wlroots"
Environment="NO_AT_BRIDGE=1"
Environment="LD_PRELOAD=/usr/local/lib/gmib-hide-cursor.so"
ExecStart=/usr/bin/cage -- ${GMIB_EXECUTABLE} --no-sandbox --kiosk-mode --ozone-platform=wayland
Restart=always
RestartSec=2
UtmpIdentifier=%I
UtmpMode=user
TTYPath=/dev/%I
TTYReset=yes
TTYVHangup=yes
TTYVTDisallocate=yes
StandardInput=tty-fail
PAMName=gmib-cage

[Install]
WantedBy=graphical.target
DefaultInstance=tty1
EOF

systemctl daemon-reload
systemctl enable seatd.service >/dev/null
systemctl enable "gmib-cage@${KIOSK_TTY}.service" >/dev/null

if [[ "$START_SERVICE" == true ]]; then
  systemctl disable --now "getty@${KIOSK_TTY}.service" >/dev/null 2>&1 || true
  systemctl restart "gmib-cage@${KIOSK_TTY}.service"
fi

echo "GMIB Cage service installed: gmib-cage@${KIOSK_TTY}.service"

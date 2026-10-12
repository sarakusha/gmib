#!/usr/bin/env bash
set -u

# Cage 0.1.x watches an inherited pipe, not just its primary child's PID. An
# AppImage FUSE/GPU descendant can retain that pipe after Electron exits. Keep a
# direct child whose lifetime is tied to the primary app, then explicitly stop
# this Cage so systemd can clean the whole service cgroup and restart it.
cage_pid="$PPID"
cage_executable="${GMIB_KIOSK_CAGE_EXECUTABLE:-/usr/bin/cage}"
child_pid=""

is_cage_parent() {
  local key value current_parent=""
  [[ -r "/proc/$$/status" && -e "/proc/$cage_pid/exe" ]] || return 1
  while read -r key value; do
    if [[ "$key" == PPid: ]]; then
      current_parent="$value"
      break
    fi
  done <"/proc/$$/status"
  [[ "$current_parent" == "$cage_pid" ]] &&
    [[ "$(readlink -f -- "/proc/$cage_pid/exe")" == "$(readlink -f -- "$cage_executable")" ]]
}

stop_cage() {
  # Recheck ancestry to avoid signaling a reused PID after Cage has exited.
  if is_cage_parent; then
    kill -TERM "$cage_pid" 2>/dev/null || true
  fi
}

# shellcheck disable=SC2329 # Invoked by the signal trap.
stop_app() {
  trap '' TERM INT HUP
  if [[ -n "$child_pid" ]]; then
    kill -TERM "$child_pid" 2>/dev/null || true
  fi
  # Do not wait for an unresponsive child: let systemd stop its entire cgroup.
  stop_cage
  exit 143
}

if (($# == 0)) || ! is_cage_parent; then
  echo "gmib-kiosk-launch must be started by Cage with an application command." >&2
  exit 64
fi

trap stop_app TERM INT HUP
"$@" <&0 &
child_pid=$!
wait "$child_pid"
app_status=$?
child_pid=""
stop_cage
exit "$app_status"

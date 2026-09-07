#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${GMIB_PROVISION_CONFIG:-/etc/gmib/provision.conf}"
STATE_DIR="/var/lib/gmib-provision"
COMPLETE_FILE="$STATE_DIR/complete"
PROFILE_ID_FILE="$STATE_DIR/profile-id"
PROFILE_ARCHIVE=""

cleanup() {
  if [[ -n "$PROFILE_ARCHIVE" && -f "$PROFILE_ARCHIVE" ]]; then
    shred -u "$PROFILE_ARCHIVE" 2>/dev/null || rm -f "$PROFILE_ARCHIVE"
  fi
  unset enrollment_code request_body
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

if [[ ! -r "$CONFIG_FILE" ]]; then
  echo "Cannot read $CONFIG_FILE" >&2
  exit 1
fi

# The configuration contains only public deployment parameters, never an API key.
# shellcheck disable=SC1090
source "$CONFIG_FILE"

: "${BOOTSTRAP_URL:?BOOTSTRAP_URL is required in $CONFIG_FILE}"
BOOTSTRAP_TLS_PIN="${BOOTSTRAP_TLS_PIN:-}"

if [[ "$BOOTSTRAP_URL" != https://* ]]; then
  echo "BOOTSTRAP_URL must use HTTPS." >&2
  exit 1
fi
if [[ -n "$BOOTSTRAP_TLS_PIN" && "$BOOTSTRAP_TLS_PIN" != sha256//* ]]; then
  echo "BOOTSTRAP_TLS_PIN must be a curl sha256 public-key pin." >&2
  exit 1
fi

install -d -m 0700 "$STATE_DIR"
if [[ -f "$COMPLETE_FILE" ]]; then
  exit 0
fi

device_id="$(tr '[:upper:]' '[:lower:]' </sys/class/dmi/id/product_uuid 2>/dev/null || true)"
if [[ -z "$device_id" ]]; then
  device_id="$(cat /etc/machine-id)"
fi
device_suffix="$(printf '%s' "$device_id" | tr -cd 'a-z0-9' | tail -c 9)"
hostnamectl hostname "gmib-${device_suffix}"

mapfile -t mac_addresses < <(
  find /sys/class/net -mindepth 1 -maxdepth 1 ! -name lo -printf '%f\n' |
    while read -r interface; do
      cat "/sys/class/net/$interface/address"
    done |
    sort -u
)
mac_json="$(printf '%s\n' "${mac_addresses[@]}" | jq -Rsc 'split("\n") | map(select(length > 0))')"

profile_connected() {
  local profile_id="$1"
  pritunl-client list --json |
    jq -e --arg id "$profile_id" '.[] | select(.id == $id and .connected == true)' >/dev/null
}

finish_provisioning() {
  local profile_id="$1"
  printf '%s\n' "$profile_id" >"$COMPLETE_FILE"
  chmod 0600 "$COMPLETE_FILE"
  rm -f "$PROFILE_ID_FILE"
  systemctl disable gmib-provision.service >/dev/null
  systemctl enable gmib-cage@tty1.service >/dev/null
  clear
  echo
  echo "VPN подключён. Настройка устройства завершена."
  echo "Устройство будет перезагружено и запустит GMIB."
  sleep 3
  systemctl reboot
}

resume_profile() {
  local profile_id
  [[ -s "$PROFILE_ID_FILE" ]] || return 1
  profile_id="$(<"$PROFILE_ID_FILE")"
  echo "Продолжаю подключение ранее импортированного VPN-профиля..."
  timeout 120 pritunl-client start "$profile_id" --mode=ovpn || return 1
  for _ in {1..30}; do
    if profile_connected "$profile_id"; then
      finish_provisioning "$profile_id"
      return 0
    fi
    sleep 2
  done
  return 1
}

systemctl start pritunl-client.service

clear
echo "GMIB — первичная настройка"
echo "Идентификатор устройства: $device_id"
echo "Раскладка клавиатуры: US (латиница)"
echo

if resume_profile; then
  exit 0
fi

while true; do
  if [[ -s "$PROFILE_ID_FILE" ]]; then
    if resume_profile; then
      exit 0
    fi
    profile_id="$(<"$PROFILE_ID_FILE")"
    echo "VPN пока не подключился. Enter — повторить; R — удалить профиль и ввести новый код."
    read -r retry_action
    if [[ "$retry_action" =~ ^[Rr]$ ]]; then
      pritunl-client remove "$profile_id" || true
      rm -f "$PROFILE_ID_FILE"
    fi
    echo
    continue
  fi

  echo "Получите одноразовый код для этого идентификатора в панели развёртывания."
  read -r -p "Код: " enrollment_code

  if [[ ! "$enrollment_code" =~ ^[A-Za-z0-9-]{4,20}$ ]]; then
    echo "Код должен содержать 4–20 латинских букв, цифр или дефисов."
    echo
    continue
  fi

  PROFILE_ARCHIVE="$(mktemp --tmpdir="$STATE_DIR" profile.XXXXXXXX.tar)"
  chmod 0600 "$PROFILE_ARCHIVE"
  request_body="$(
    jq -cn \
      --arg code "$enrollment_code" \
      --arg device_id "$device_id" \
      --arg hostname "$(hostname)" \
      --argjson mac_addresses "$mac_json" \
      '{code: $code, device_id: $device_id, hostname: $hostname, mac_addresses: $mac_addresses}'
  )"

  echo "Получаю персональный VPN-профиль..."
  curl_args=(
    --fail
    --silent
    --show-error
    --connect-timeout 10
    --max-time 60
  )
  if [[ -n "$BOOTSTRAP_TLS_PIN" ]]; then
    curl_args+=(--pinnedpubkey "$BOOTSTRAP_TLS_PIN")
  fi
  if ! printf '%s' "$request_body" |
    curl "${curl_args[@]}" \
      --header 'Content-Type: application/json' \
      --data-binary @- \
      --output "$PROFILE_ARCHIVE" \
      "$BOOTSTRAP_URL"; then
    echo "Не удалось получить профиль. Проверьте сеть и код, затем повторите."
    cleanup
    PROFILE_ARCHIVE=""
    echo
    continue
  fi
  unset enrollment_code request_body

  if ! tar -tf "$PROFILE_ARCHIVE" >/dev/null 2>&1 ||
    tar -tf "$PROFILE_ARCHIVE" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
    echo "API вернул некорректный архив профиля."
    cleanup
    PROFILE_ARCHIVE=""
    echo
    continue
  fi

  before_ids="$(pritunl-client list --json | jq -r '.[].id' | sort)"
  if ! pritunl-client add "$PROFILE_ARCHIVE"; then
    echo "Pritunl не смог импортировать профиль."
    cleanup
    PROFILE_ARCHIVE=""
    echo
    continue
  fi
  after_ids="$(pritunl-client list --json | jq -r '.[].id' | sort)"
  profile_id="$(comm -13 <(printf '%s\n' "$before_ids") <(printf '%s\n' "$after_ids") | head -n 1)"

  cleanup
  PROFILE_ARCHIVE=""

  if [[ -z "$profile_id" ]]; then
    echo "Не удалось определить импортированный VPN-профиль."
    echo
    continue
  fi

  printf '%s\n' "$profile_id" >"$PROFILE_ID_FILE"
  chmod 0600 "$PROFILE_ID_FILE"
  if resume_profile; then
    exit 0
  fi

  echo "Профиль импортирован, но VPN пока не подключился."
  echo
done

#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${GMIB_PROVISION_CONFIG:-/etc/gmib/provision.conf}"
STATE_DIR="${GMIB_PROVISION_STATE_DIR:-/var/lib/gmib-provision}"
COMPLETE_FILE="$STATE_DIR/complete"
PROFILE_ID_FILE="$STATE_DIR/profile-id"
PENDING_PROFILE_FILE="$STATE_DIR/vpn-profile.pending"
PENDING_ZABBIX_FILE="$STATE_DIR/zabbix.pending.json"
TRANSIENT_SECRET_FILE=""
PRIMARY_PROFILE_SUFFIX="${PRIMARY_PROFILE_SUFFIX:- (main)}"

cleanup() {
  if [[ -n "$TRANSIENT_SECRET_FILE" && -f "$TRANSIENT_SECRET_FILE" ]]; then
    shred -u "$TRANSIENT_SECRET_FILE" 2>/dev/null || rm -f "$TRANSIENT_SECRET_FILE"
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
  # A power loss can occur after the completion marker is committed but before
  # the best-effort deletion of enrollment material.
  for stale_secret in "$PENDING_PROFILE_FILE" "$PENDING_ZABBIX_FILE"; do
    [[ ! -f "$stale_secret" ]] || shred -u "$stale_secret" 2>/dev/null || rm -f "$stale_secret"
  done
  systemctl enable gmib-cage@tty1.service >/dev/null
  systemctl disable gmib-provision.service >/dev/null
  systemctl reboot
  exit 0
fi

device_id="${GMIB_PROVISION_DEVICE_ID:-}"
if [[ -z "$device_id" && -r /sys/class/dmi/id/product_uuid ]]; then
  device_id="$(tr '[:upper:]' '[:lower:]' </sys/class/dmi/id/product_uuid)"
fi
if [[ -z "$device_id" && -r /etc/machine-id ]]; then
  device_id="$(cat /etc/machine-id)"
fi
if [[ -z "$device_id" ]]; then
  echo "Не удалось определить идентификатор устройства." >&2
  exit 1
fi
device_suffix="$(printf '%s' "$device_id" | tr -cd 'a-z0-9' | tail -c 9)"
hostnamectl hostname "gmib-${device_suffix}"

if [[ -n "${GMIB_PROVISION_MAC_ADDRESSES_JSON:-}" ]]; then
  mac_json="$GMIB_PROVISION_MAC_ADDRESSES_JSON"
else
  mapfile -t mac_addresses < <(
    find /sys/class/net -mindepth 1 -maxdepth 1 ! -name lo -printf '%f\n' |
      while read -r interface; do
        cat "/sys/class/net/$interface/address"
      done |
      sort -u
  )
  mac_json="$(printf '%s\n' "${mac_addresses[@]}" | jq -Rsc 'split("\n") | map(select(length > 0))')"
fi

profile_connected() {
  local profile_id="$1"
  pritunl-client list --json |
    jq -e --arg id "$profile_id" '.[] | select(.id == $id and .connected == true)' >/dev/null
}

finish_provisioning() {
  local profile_id="$1"
  # Zabbix is optional. Apply it only after the stable hostname is set and the
  # device VPN is connected; any malformed/unavailable configuration leaves the
  # preinstalled agent disabled and must never block GMIB provisioning.
  if [[ -s "$PENDING_ZABBIX_FILE" ]]; then
    if ! gmib-zabbix-configure apply "$PENDING_ZABBIX_FILE"; then
      echo "Мониторинг Zabbix не настроен; GMIB продолжит работу."
      gmib-zabbix-configure disable || true
    fi
  else
    gmib-zabbix-configure disable || true
  fi
  # Enabling Cage is idempotent and must be durable before committing complete.
  # If power is lost after the marker, the completed recovery path above can
  # clean secrets and reboot into the already-enabled kiosk.
  systemctl enable gmib-cage@tty1.service >/dev/null
  complete_tmp="$(mktemp --tmpdir="$STATE_DIR" complete.XXXXXXXX)"
  printf '%s\n' "$profile_id" >"$complete_tmp"
  chmod 0600 "$complete_tmp"
  mv -f "$complete_tmp" "$COMPLETE_FILE"
  [[ ! -f "$PENDING_ZABBIX_FILE" ]] ||
    shred -u "$PENDING_ZABBIX_FILE" 2>/dev/null || rm -f "$PENDING_ZABBIX_FILE"
  rm -f "$PROFILE_ID_FILE"
  systemctl disable gmib-provision.service >/dev/null
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
      rm -f "$PROFILE_ID_FILE" "$PENDING_ZABBIX_FILE"
    fi
    echo
    continue
  fi

  if [[ ! -s "$PENDING_PROFILE_FILE" ]]; then
    echo "Получите одноразовый код для этого идентификатора в панели развёртывания."
    read -r -p "Код: " enrollment_code

    if [[ ! "$enrollment_code" =~ ^[A-Za-z0-9-]{4,20}$ ]]; then
      echo "Код должен содержать 4–20 латинских букв, цифр или дефисов."
      echo
      continue
    fi

    response_file="$(mktemp --tmpdir="$STATE_DIR" response.XXXXXXXX)"
    chmod 0600 "$response_file"
    TRANSIENT_SECRET_FILE="$response_file"
    request_body="$(
      printf '%s' "$enrollment_code" |
        jq -Rsc \
        --arg device_id "$device_id" \
        --arg hostname "$(hostname)" \
        --argjson mac_addresses "$mac_json" \
        '{code: ., device_id: $device_id, hostname: $hostname, mac_addresses: $mac_addresses}'
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
        --header 'Accept: application/vnd.gmib.enrollment+json' \
        --data-binary @- \
        --output "$response_file" \
        "$BOOTSTRAP_URL"; then
      echo "Не удалось получить профиль. Проверьте сеть и код, затем повторите."
      cleanup
      TRANSIENT_SECRET_FILE=""
      echo
      continue
    fi
    unset enrollment_code request_body

    rm -f "$PENDING_ZABBIX_FILE"
    if jq -e 'type == "object" and .version == 1 and (.vpnProfile | type == "string")' \
      "$response_file" >/dev/null 2>&1; then
      pending_zabbix_tmp="$(mktemp --tmpdir="$STATE_DIR" zabbix.XXXXXXXX.json)"
      chmod 0600 "$pending_zabbix_tmp"
      jq -c '.zabbix // {enabled:false,error:"configuration_unavailable"}' \
        "$response_file" >"$pending_zabbix_tmp"
      mv -f "$pending_zabbix_tmp" "$PENDING_ZABBIX_FILE"
      chmod 0600 "$PENDING_ZABBIX_FILE"

      pending_profile_tmp="$(mktemp --tmpdir="$STATE_DIR" profile.XXXXXXXX)"
      chmod 0600 "$pending_profile_tmp"
      if ! jq -r '.vpnProfile' "$response_file" | base64 --decode >"$pending_profile_tmp"; then
        echo "API вернул некорректный VPN-профиль."
        rm -f "$pending_profile_tmp" "$PENDING_ZABBIX_FILE"
        cleanup
        TRANSIENT_SECRET_FILE=""
        echo
        continue
      fi
      mv -f "$pending_profile_tmp" "$PENDING_PROFILE_FILE"
    else
      # Compatibility with deployed enrollment servers that return the raw
      # OpenVPN profile or profile tar as the response body.
      mv -f "$response_file" "$PENDING_PROFILE_FILE"
      TRANSIENT_SECRET_FILE=""
    fi
    if [[ -n "$TRANSIENT_SECRET_FILE" ]]; then
      cleanup
      TRANSIENT_SECRET_FILE=""
    fi
    chmod 0600 "$PENDING_PROFILE_FILE"
  fi

  archive_is_safe=false
  if tar -tf "$PENDING_PROFILE_FILE" >/dev/null 2>&1 &&
    ! tar -tf "$PENDING_PROFILE_FILE" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
    archive_is_safe=true
  elif grep -aq '^client$' "$PENDING_PROFILE_FILE" && grep -aq '^<ca>$' "$PENDING_PROFILE_FILE"; then
    # New enrollment endpoints return one server-specific OpenVPN profile. Keep accepting the
    # historical multi-profile tar archive so already deployed app-server versions remain usable.
    archive_is_safe=true
  fi
  if [[ "$archive_is_safe" != true ]]; then
    echo "API вернул некорректный VPN-профиль."
    shred -u "$PENDING_PROFILE_FILE" 2>/dev/null || rm -f "$PENDING_PROFILE_FILE"
    rm -f "$PENDING_ZABBIX_FILE"
    echo
    continue
  fi

  before_ids="$(pritunl-client list --json | jq -r '.[].id' | sort)"
  if ! pritunl-client add "$PENDING_PROFILE_FILE"; then
    echo "Pritunl не смог импортировать профиль."
    echo "Enter — повторить импорт; R — удалить ответ и ввести новый код."
    read -r retry_import
    if [[ "$retry_import" =~ ^[Rr]$ ]]; then
      shred -u "$PENDING_PROFILE_FILE" 2>/dev/null || rm -f "$PENDING_PROFILE_FILE"
      rm -f "$PENDING_ZABBIX_FILE"
    fi
    echo
    continue
  fi
  profiles_json="$(pritunl-client list --json)"
  after_ids="$(jq -r '.[].id' <<<"$profiles_json" | sort)"
  mapfile -t new_profile_ids < <(
    comm -13 <(printf '%s\n' "$before_ids") <(printf '%s\n' "$after_ids")
  )
  profile_id=""
  if ((${#new_profile_ids[@]} == 1)); then
    profile_id="${new_profile_ids[0]}"
  fi
  for new_profile_id in "${new_profile_ids[@]}"; do
    profile_name="$(
      jq -r --arg id "$new_profile_id" '.[] | select(.id == $id) | .name' <<<"$profiles_json"
    )"
    if ((${#new_profile_ids[@]} == 1)) || [[ "$profile_name" == *"$PRIMARY_PROFILE_SUFFIX" ]]; then
      profile_id="$new_profile_id"
      continue
    fi

    # An organization can be attached to several servers. Starting all profiles creates
    # overlapping routes (for example main and mikrotik) and breaks return traffic.
    pritunl-client disable "$new_profile_id" || true
    pritunl-client stop "$new_profile_id" || true
  done

  if [[ -z "$profile_id" ]]; then
    echo "В архиве нет основного VPN-профиля с окончанием '$PRIMARY_PROFILE_SUFFIX'."
    shred -u "$PENDING_PROFILE_FILE" 2>/dev/null || rm -f "$PENDING_PROFILE_FILE"
    rm -f "$PENDING_ZABBIX_FILE"
    echo
    continue
  fi

  printf '%s\n' "$profile_id" >"$PROFILE_ID_FILE"
  chmod 0600 "$PROFILE_ID_FILE"
  shred -u "$PENDING_PROFILE_FILE" 2>/dev/null || rm -f "$PENDING_PROFILE_FILE"
  if resume_profile; then
    exit 0
  fi

  echo "Профиль импортирован, но VPN пока не подключился."
  echo
done

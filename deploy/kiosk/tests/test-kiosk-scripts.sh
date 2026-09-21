#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
KIOSK_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
work_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT INT TERM

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local file="$1" expected="$2"
  grep -Fqx -- "$expected" "$file" || fail "$file does not contain: $expected"
}

assert_not_contains() {
  local file="$1" unexpected="$2"
  ! grep -Fq -- "$unexpected" "$file" || fail "$file contains secret/unexpected text: $unexpected"
}

root="$work_dir/root"
stub_bin="$work_dir/bin"
stub_state="$work_dir/stub-state"
mkdir -p "$root" "$stub_bin" "$stub_state"

cat >"$stub_bin/systemctl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$STUB_STATE/systemctl.log"
if [[ -e "$STUB_STATE/provision.log" ]]; then
  printf 'systemctl %s\n' "$*" >>"$STUB_STATE/provision.log"
fi
if [[ "$*" == "is-active --quiet zabbix-agent2.service" ]]; then
  [[ -f "$STUB_STATE/active" ]]
  exit
fi
if [[ -n "${STUB_FAIL_SYSTEMCTL_MATCH:-}" && "$*" == *"$STUB_FAIL_SYSTEMCTL_MATCH"* ]]; then
  exit 1
fi
case "$1" in
  enable)
    touch "$STUB_STATE/active"
    ;;
  disable)
    rm -f "$STUB_STATE/active"
    ;;
esac
EOF
cat >"$stub_bin/zabbix_agent2" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
config="${3:?missing -c config}"
cp "$config" "$STUB_STATE/validated.conf"
[[ -z "${STUB_FAIL_VALIDATE:-}" ]]
EOF
cat >"$stub_bin/getent" <<'EOF'
#!/usr/bin/env bash
[[ "$1" == group && "$2" == zabbix ]]
EOF
cat >"$stub_bin/chown" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat >"$stub_bin/hostname" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' gmib-a1b2c3d4
EOF
chmod 0755 "$stub_bin"/*

export PATH="$stub_bin:$PATH"
export STUB_STATE="$stub_state"
export GMIB_ZABBIX_ROOT="$root"
export GMIB_ZABBIX_SYSTEMCTL="$stub_bin/systemctl"
export GMIB_ZABBIX_AGENT2="$stub_bin/zabbix_agent2"

valid_psk="$work_dir/valid-psk.json"
cat >"$valid_psk" <<'EOF'
{
  "enabled": true,
  "serverActive": "monitor.example:10051",
  "metadata": "gmib kiosk Москва",
  "tlsConnect": "psk",
  "pskIdentity": "gmib-a1b2c3d4",
  "psk": "0123456789abcdef0123456789abcdef"
}
EOF

"$KIOSK_DIR/gmib-zabbix-configure" apply "$valid_psk"
config="$root/etc/zabbix/zabbix_agent2.conf"
psk="$root/etc/zabbix/gmib-agent2.psk"
assert_contains "$config" 'ServerActive=monitor.example:10051'
assert_contains "$config" 'Hostname=gmib-a1b2c3d4'
assert_contains "$config" 'HostMetadata=gmib kiosk Москва'
assert_contains "$config" 'TLSConnect=psk'
assert_contains "$config" 'DenyKey=system.run[*]'
assert_contains "$config" 'TLSPSKFile=/etc/zabbix/gmib-agent2.psk'
! grep -Eq '^Server=' "$config" || fail 'passive Server directive enables TCP/10050'
psk_mode="$(stat -c %a "$psk" 2>/dev/null || stat -f %Lp "$psk")"
[[ "$psk_mode" == 640 ]] || fail 'PSK file mode is not 0640'
assert_contains "$psk" '0123456789abcdef0123456789abcdef'
status="$("$KIOSK_DIR/gmib-zabbix-configure" status)"
jq -e '.enabled and .service == "active" and .tlsConnect == "psk" and .pskConfigured' \
  <<<"$status" >/dev/null
[[ "$status" != *0123456789abcdef* ]] || fail 'status exposed the PSK'

# Invalid values must not replace a working configuration or leak their PSK.
cp "$config" "$work_dir/config.before"
invalid="$work_dir/invalid.json"
cat >"$invalid" <<'EOF'
{"enabled":true,"serverActive":"monitor.example\nInjected=1","metadata":"kiosk","tlsConnect":"psk","pskIdentity":"id","psk":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
EOF
invalid_output="$work_dir/invalid-output"
if "$KIOSK_DIR/gmib-zabbix-configure" apply "$invalid" >"$invalid_output" 2>&1; then
  fail 'newline injection was accepted'
fi
cmp -s "$config" "$work_dir/config.before" || fail 'invalid input replaced the live configuration'
assert_not_contains "$invalid_output" 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

# A validation failure cleans temporary configuration and PSK files.
export STUB_FAIL_VALIDATE=1
if "$KIOSK_DIR/gmib-zabbix-configure" apply "$valid_psk" >/dev/null 2>&1; then
  fail 'agent validation failure was ignored'
fi
unset STUB_FAIL_VALIDATE
if find "$root/etc/zabbix" -maxdepth 1 -name '.gmib-*' -print -quit | grep -q .; then
  fail 'validation failure left a temporary secret file'
fi

# Failure to stop/mask the service aborts before replacing the configuration.
export STUB_FAIL_SYSTEMCTL_MATCH='mask zabbix-agent2.service'
if "$KIOSK_DIR/gmib-zabbix-configure" apply "$valid_psk" >/dev/null 2>&1; then
  fail 'systemctl mask failure was ignored'
fi
unset STUB_FAIL_SYSTEMCTL_MATCH
cmp -s "$config" "$work_dir/config.before" || fail 'service-control failure replaced the configuration'

printf '%s\n' '{"enabled":false,"error":"configuration_unavailable"}' |
  "$KIOSK_DIR/gmib-zabbix-configure" apply -
[[ ! -e "$config" && ! -e "$psk" ]] || fail 'disabled response retained Zabbix credentials'
jq -e '.enabled == false and .service == "inactive"' \
  <<<"$("$KIOSK_DIR/gmib-zabbix-configure" status)" >/dev/null

# Exercise first-boot resume with a previously imported, now connected VPN
# profile. This verifies the crash-safe ordering without network or systemd.
cat >"$stub_bin/pritunl-client" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == list ]]; then
  printf '%s\n' '[{"id":"profile-1","connected":true}]'
fi
EOF
cat >"$stub_bin/gmib-zabbix-configure" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'zabbix %s\n' "$*" >>"$STUB_STATE/provision.log"
EOF
cat >"$stub_bin/hostnamectl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat >"$stub_bin/clear" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat >"$stub_bin/sleep" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat >"$stub_bin/timeout" <<'EOF'
#!/usr/bin/env bash
shift
exec "$@"
EOF
chmod 0755 "$stub_bin"/*

provision_config="$work_dir/provision.conf"
printf '%s\n' "BOOTSTRAP_URL='https://enroll.example.test'" >"$provision_config"
provision_state="$work_dir/provision-state"
mkdir -m 0700 "$provision_state"
printf '%s\n' profile-1 >"$provision_state/profile-id"
printf '%s\n' '{"enabled":false}' >"$provision_state/zabbix.pending.json"
: >"$stub_state/provision.log"
GMIB_PROVISION_CONFIG="$provision_config" GMIB_PROVISION_STATE_DIR="$provision_state" \
  GMIB_PROVISION_DEVICE_ID='01234567-89ab-cdef' GMIB_PROVISION_MAC_ADDRESSES_JSON='[]' \
  "$KIOSK_DIR/first-boot-provision.sh" >/dev/null
[[ -s "$provision_state/complete" ]] || fail 'resumed provisioning did not commit completion'
[[ ! -e "$provision_state/zabbix.pending.json" ]] || fail 'completed provisioning retained Zabbix response'
apply_line="$(grep -n '^zabbix apply ' "$stub_state/provision.log" | cut -d: -f1)"
enable_line="$(grep -n '^systemctl enable gmib-cage@tty1.service$' "$stub_state/provision.log" | cut -d: -f1)"
reboot_line="$(grep -n '^systemctl reboot$' "$stub_state/provision.log" | cut -d: -f1)"
[[ -n "$apply_line" && -n "$enable_line" && -n "$reboot_line" ]] || fail 'provision service ordering was not logged'
((apply_line < enable_line && enable_line < reboot_line)) || fail 'completion was not ordered after Zabbix and Cage setup'

# Simulate power loss after the completion marker but before secret cleanup.
# With no ConditionPathExists gate, the next run must clean and finish recovery.
recovery_state="$work_dir/recovery-state"
mkdir -m 0700 "$recovery_state"
printf '%s\n' profile-1 >"$recovery_state/complete"
printf '%s\n' '{"enabled":true,"psk":"must-not-survive"}' >"$recovery_state/zabbix.pending.json"
GMIB_PROVISION_CONFIG="$provision_config" GMIB_PROVISION_STATE_DIR="$recovery_state" \
  GMIB_PROVISION_DEVICE_ID='01234567-89ab-cdef' GMIB_PROVISION_MAC_ADDRESSES_JSON='[]' \
  "$KIOSK_DIR/first-boot-provision.sh" >/dev/null
[[ ! -e "$recovery_state/zabbix.pending.json" ]] || fail 'completed recovery retained pending secret'
grep -Fqx 'enable gmib-cage@tty1.service' "$stub_state/systemctl.log" || fail 'recovery did not enable Cage'
grep -Fqx 'disable gmib-provision.service' "$stub_state/systemctl.log" || fail 'recovery did not disable itself'

# Exercise a fresh enrollment twice: a raw OpenVPN response must be wrapped in
# the one-file tar expected by Pritunl, while an existing safe tar must pass
# through byte-for-byte unchanged.
cat >"$stub_bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
output=""
while (($# > 0)); do
  case "$1" in
    --output)
      output="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
cat >/dev/null
cp "$STUB_RESPONSE_FILE" "$output"
EOF
cat >"$stub_bin/pritunl-client" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  list)
    if [[ -f "$STUB_STATE/profile-added" ]]; then
      connected=false
      [[ ! -f "$STUB_STATE/profile-connected" ]] || connected=true
      printf '[{"id":"profile-new","name":"gmib test (main)","connected":%s}]\n' "$connected"
    else
      printf '%s\n' '[]'
    fi
    ;;
  add)
    cp "$2" "$STUB_STATE/imported-profile"
    touch "$STUB_STATE/profile-added"
    ;;
  start)
    touch "$STUB_STATE/profile-connected"
    ;;
  disable | stop | remove)
    ;;
  *)
    exit 2
    ;;
esac
EOF
chmod 0755 "$stub_bin/curl" "$stub_bin/pritunl-client"

run_enrollment_import() {
  local response="$1" state="$2"
  rm -f \
    "$stub_state/profile-added" \
    "$stub_state/profile-connected" \
    "$stub_state/imported-profile"
  mkdir -m 0700 "$state"
  printf '%s\n' TEST-CODE |
    STUB_RESPONSE_FILE="$response" \
      GMIB_PROVISION_CONFIG="$provision_config" GMIB_PROVISION_STATE_DIR="$state" \
      GMIB_PROVISION_DEVICE_ID='01234567-89ab-cdef' GMIB_PROVISION_MAC_ADDRESSES_JSON='[]' \
      "$KIOSK_DIR/first-boot-provision.sh" >/dev/null
  [[ -s "$state/complete" ]] || fail 'fresh enrollment did not complete'
  [[ -s "$stub_state/imported-profile" ]] || fail 'fresh enrollment did not import a profile'
}

raw_profile="$work_dir/raw.ovpn"
cat >"$raw_profile" <<'EOF'
client
dev tun
remote vpn.example.test 1194 udp
<ca>
TEST-CA
</ca>
EOF
run_enrollment_import "$raw_profile" "$work_dir/raw-import-state"
mapfile -t wrapped_names < <(tar -tf "$stub_state/imported-profile")
[[ ${#wrapped_names[@]} -eq 1 && "${wrapped_names[0]}" == gmib.ovpn ]] ||
  fail 'raw OpenVPN profile was not wrapped as one safe gmib.ovpn tar member'
wrapped_extract="$work_dir/wrapped-extract"
mkdir "$wrapped_extract"
tar -xf "$stub_state/imported-profile" -C "$wrapped_extract"
cmp -s "$raw_profile" "$wrapped_extract/gmib.ovpn" || fail 'wrapped OpenVPN payload changed'

existing_tar_dir="$work_dir/existing-tar"
mkdir "$existing_tar_dir"
cp "$raw_profile" "$existing_tar_dir/main.ovpn"
printf '%s\n' 'secondary profile marker' >"$existing_tar_dir/secondary.ovpn"
existing_tar="$work_dir/existing-profile.tar"
tar --format=ustar -cf "$existing_tar" -C "$existing_tar_dir" main.ovpn secondary.ovpn
run_enrollment_import "$existing_tar" "$work_dir/tar-import-state"
cmp -s "$existing_tar" "$stub_state/imported-profile" ||
  fail 'existing safe Pritunl tar was rewritten before import'

# Static integration checks cover service ordering, response negotiation, and
# both layers of Cyrillic tty support (UTF-8 decoding and console glyphs).
assert_contains "$KIOSK_DIR/gmib-provision.service" 'EnvironmentFile=-/etc/default/locale'
grep -Eq '^After=.*console-setup\.service' "$KIOSK_DIR/gmib-provision.service" ||
  fail 'first-boot tty starts before the Cyrillic console font is loaded'
grep -Eq '^After=.*systemd-modules-load\.service' "$KIOSK_DIR/gmib-provision.service" ||
  fail 'first-boot tty starts before early kernel modules are loaded'
assert_contains "$KIOSK_DIR/gmib-provision.service" 'ExecStartPre=-/usr/bin/udevadm settle --timeout=30'
assert_contains "$KIOSK_DIR/gmib-provision.service" 'ExecStartPre=/usr/bin/setupcon --force'
! grep -Fq 'ConditionPathExists=' "$KIOSK_DIR/gmib-provision.service" ||
  fail 'completion recovery is blocked by a systemd path condition'
grep -Fq "Accept: application/vnd.gmib.enrollment+json" "$KIOSK_DIR/first-boot-provision.sh" ||
  fail 'versioned enrollment Accept header is missing'
! grep -Fq -- '--arg code' "$KIOSK_DIR/first-boot-provision.sh" || fail 'enrollment code is exposed in argv'
grep -Fq 'CODESET="CyrSlav"' "$KIOSK_DIR/install-target.sh" || fail 'Cyrillic console font is missing'
grep -Fq 'update-locale LANG=ru_RU.UTF-8' "$KIOSK_DIR/install-target.sh" || fail 'UTF-8 locale is not selected'
grep -Fq 'systemctl mask zabbix-agent2.service' "$KIOSK_DIR/install-target.sh" ||
  fail 'Zabbix is not masked during installation'

echo 'kiosk script tests passed'

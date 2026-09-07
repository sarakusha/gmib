#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

BASE_ISO=""
BASE_ISO_SHA256=""
APPIMAGE=""
GMIB_VERSION=""
PRITUNL_DEB=""
BOOTSTRAP_URL=""
BOOTSTRAP_TLS_PIN=""
SSH_KEY_FILE=""
OUTPUT_ISO=""
TARGET_SELECTOR="largest"
TARGET_VALUE=""
ADMIN_USER="admin"
KIOSK_USER="gmib"
HOSTNAME="gmib-kiosk"

usage() {
  cat <<'EOF'
Usage: deploy/kiosk/build-autoinstall-iso.sh [options]

Required:
  --base-iso PATH             Ubuntu 24.04 live-server amd64 ISO.
  --base-iso-sha256 SHA256    Expected SHA-256 of the Ubuntu ISO.
  --appimage PATH             Release gmib x86_64 AppImage.
  --gmib-version VERSION      GMIB version embedded in the image name and metadata.
  --pritunl-deb PATH          Pinned amd64 pritunl-client Debian package.
  --bootstrap-url URL         HTTPS endpoint returning a Pritunl profile tar.
  --ssh-authorized-key PATH   Public SSH key for the admin account.
  --output PATH               Output ISO path.

Optional:
  --bootstrap-tls-pin PIN     curl public-key pin, formatted sha256//BASE64.
  --target-disk PATH          Select the installation disk by Linux device path.
  --target-model GLOB         Select the installation disk by udev model glob.
  --target-serial GLOB        Select the installation disk by udev serial glob.
  --admin-user USER           SSH administrator. Default: admin.
  --kiosk-user USER           Unprivileged GMIB account. Default: gmib.
  --hostname HOSTNAME         Temporary hostname. Default: gmib-kiosk.
  -h, --help                  Show this help.

By default, the installer selects the largest disk that is not the installation
media. The generated installer erases that disk without confirmation and powers
off when complete. Remove the USB drive before the first boot.
EOF
}

while (($# > 0)); do
  case "$1" in
    --base-iso)
      BASE_ISO="${2:-}"
      shift 2
      ;;
    --base-iso-sha256)
      BASE_ISO_SHA256="${2:-}"
      shift 2
      ;;
    --appimage)
      APPIMAGE="${2:-}"
      shift 2
      ;;
    --gmib-version)
      GMIB_VERSION="${2:-}"
      shift 2
      ;;
    --pritunl-deb)
      PRITUNL_DEB="${2:-}"
      shift 2
      ;;
    --bootstrap-url)
      BOOTSTRAP_URL="${2:-}"
      shift 2
      ;;
    --bootstrap-tls-pin)
      BOOTSTRAP_TLS_PIN="${2:-}"
      shift 2
      ;;
    --ssh-authorized-key)
      SSH_KEY_FILE="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT_ISO="${2:-}"
      shift 2
      ;;
    --target-disk)
      if [[ "$TARGET_SELECTOR" != largest ]]; then
        echo "Use only one target disk selector." >&2
        exit 2
      fi
      TARGET_SELECTOR="path"
      TARGET_VALUE="${2:-}"
      shift 2
      ;;
    --target-model)
      if [[ "$TARGET_SELECTOR" != largest ]]; then
        echo "Use only one target disk selector." >&2
        exit 2
      fi
      TARGET_SELECTOR="model"
      TARGET_VALUE="${2:-}"
      shift 2
      ;;
    --target-serial)
      if [[ "$TARGET_SELECTOR" != largest ]]; then
        echo "Use only one target disk selector." >&2
        exit 2
      fi
      TARGET_SELECTOR="serial"
      TARGET_VALUE="${2:-}"
      shift 2
      ;;
    --admin-user)
      ADMIN_USER="${2:-}"
      shift 2
      ;;
    --kiosk-user)
      KIOSK_USER="${2:-}"
      shift 2
      ;;
    --hostname)
      HOSTNAME="${2:-}"
      shift 2
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

for command in awk dpkg-deb file xorriso sha256sum openssl sed; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

for value_name in BASE_ISO BASE_ISO_SHA256 APPIMAGE GMIB_VERSION PRITUNL_DEB BOOTSTRAP_URL \
  SSH_KEY_FILE OUTPUT_ISO; do
  if [[ -z "${!value_name}" ]]; then
    echo "Missing required option for $value_name" >&2
    usage >&2
    exit 1
  fi
done
if [[ ! "$GMIB_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "--gmib-version must be a semantic version such as 5.4.1." >&2
  exit 1
fi

for input_file in "$BASE_ISO" "$APPIMAGE" "$PRITUNL_DEB" "$SSH_KEY_FILE"; do
  if [[ ! -f "$input_file" ]]; then
    echo "Input file does not exist: $input_file" >&2
    exit 1
  fi
done
if ! file "$APPIMAGE" | grep -Eq 'ELF 64-bit.*x86-64'; then
  echo "--appimage must be an x86_64 AppImage." >&2
  exit 1
fi
if [[ "$(dpkg-deb --field "$PRITUNL_DEB" Package)" != pritunl-client ]] ||
  [[ "$(dpkg-deb --field "$PRITUNL_DEB" Architecture)" != amd64 ]]; then
  echo "--pritunl-deb must be the amd64 pritunl-client package." >&2
  exit 1
fi
if [[ -e "$OUTPUT_ISO" ]]; then
  echo "Output already exists: $OUTPUT_ISO" >&2
  exit 1
fi
if [[ ! "$BASE_ISO_SHA256" =~ ^[a-fA-F0-9]{64}$ ]]; then
  echo "--base-iso-sha256 must contain 64 hexadecimal characters." >&2
  exit 1
fi
if [[ "$BOOTSTRAP_URL" != https://* ]] || [[ "$BOOTSTRAP_URL" =~ [[:space:]\'] ]]; then
  echo "--bootstrap-url must be an HTTPS URL without whitespace or single quotes." >&2
  exit 1
fi
if [[ -n "$BOOTSTRAP_TLS_PIN" ]] &&
  { [[ "$BOOTSTRAP_TLS_PIN" != sha256//* ]] || [[ "$BOOTSTRAP_TLS_PIN" =~ [[:space:]\'] ]]; }; then
  echo "Invalid --bootstrap-tls-pin." >&2
  exit 1
fi
case "$TARGET_SELECTOR" in
  largest)
    storage_match="        size: largest"
    ;;
  path)
    if [[ ! "$TARGET_VALUE" =~ ^/dev/[a-zA-Z0-9._-]+$ ]]; then
      echo "Invalid --target-disk path." >&2
      exit 1
    fi
    storage_match="        path: '$TARGET_VALUE'"
    ;;
  model | serial)
    if [[ -z "$TARGET_VALUE" ]] || [[ "$TARGET_VALUE" =~ [[:space:]\'] ]]; then
      echo "The target $TARGET_SELECTOR glob must not contain whitespace or single quotes." >&2
      exit 1
    fi
    storage_match="        $TARGET_SELECTOR: '$TARGET_VALUE'"
    ;;
esac
if [[ ! "$ADMIN_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] ||
  [[ ! "$KIOSK_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]; then
  echo "Invalid Linux user name." >&2
  exit 1
fi
if [[ ! "$HOSTNAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}$ ]]; then
  echo "Invalid hostname." >&2
  exit 1
fi

actual_base_iso_sha256="$(sha256sum "$BASE_ISO" | awk '{print tolower($1)}')"
if [[ "$actual_base_iso_sha256" != "${BASE_ISO_SHA256,,}" ]]; then
  echo "Ubuntu ISO checksum mismatch." >&2
  exit 1
fi

ssh_key="$(tr -d '\r\n' <"$SSH_KEY_FILE")"
if [[ ! "$ssh_key" =~ ^(ssh-(ed25519|rsa)|ecdsa-sha2-nistp(256|384|521))[[:space:]] ]]; then
  echo "The SSH public key has an unsupported format." >&2
  exit 1
fi
if [[ "$ssh_key" == *\'* ]]; then
  echo "The SSH public key comment must not contain a single quote." >&2
  exit 1
fi

work_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT INT TERM

xorriso -osirrox on -indev "$BASE_ISO" -extract /.disk/info "$work_dir/iso-info" >/dev/null 2>&1
if ! grep -Eq 'Ubuntu-Server 24\.04(\.[0-9]+)* LTS.*amd64' "$work_dir/iso-info"; then
  echo "The base image is not an Ubuntu Server 24.04 amd64 ISO." >&2
  exit 1
fi
ubuntu_version="$(sed -nE 's/^Ubuntu-Server ([0-9]+\.[0-9]+(\.[0-9]+)?) LTS.*$/\1/p' "$work_dir/iso-info")"
if [[ -z "$ubuntu_version" ]]; then
  echo "Could not determine the Ubuntu version from the base ISO." >&2
  exit 1
fi
expected_output_name="gmib-kiosk-${GMIB_VERSION}-ubuntu-${ubuntu_version}-amd64.iso"
if [[ "$(basename "$OUTPUT_ISO")" != "$expected_output_name" ]]; then
  echo "Output filename must be: $expected_output_name" >&2
  exit 1
fi

payload_dir="$work_dir/gmib-installer"
install -d -m 0755 "$payload_dir"
install -m 0755 "$APPIMAGE" "$payload_dir/gmib.AppImage"
install -m 0644 "$PRITUNL_DEB" "$payload_dir/pritunl-client.deb"
install -m 0755 "$SCRIPT_DIR/first-boot-provision.sh" "$payload_dir/"
install -m 0644 "$SCRIPT_DIR/gmib-provision.service" "$payload_dir/"
install -m 0755 "$SCRIPT_DIR/install-target.sh" "$payload_dir/"
install -m 0755 "$REPO_ROOT/scripts/setup-linux-kiosk.sh" "$payload_dir/"
install -m 0644 "$REPO_ROOT/scripts/gmib-hide-cursor.c" "$payload_dir/"

cat >"$payload_dir/image-release" <<EOF
GMIB_VERSION='$GMIB_VERSION'
UBUNTU_VERSION='$ubuntu_version'
IMAGE_NAME='$expected_output_name'
ARCHITECTURE='amd64'
EOF
chmod 0644 "$payload_dir/image-release"

cat >"$payload_dir/provision.conf" <<EOF
BOOTSTRAP_URL='$BOOTSTRAP_URL'
BOOTSTRAP_TLS_PIN='$BOOTSTRAP_TLS_PIN'
EOF
chmod 0644 "$payload_dir/provision.conf"

random_password="$(openssl rand -base64 32)"
password_hash="$(openssl passwd -6 "$random_password")"
unset random_password

cat >"$work_dir/autoinstall.yaml" <<EOF
#cloud-config
autoinstall:
  version: 1
  source:
    id: ubuntu-server-minimal
  locale: ru_RU.UTF-8
  keyboard:
    layout: us
  network:
    version: 2
    ethernets:
      wired:
        match:
          name: "e*"
        dhcp4: true
        optional: true
  identity:
    hostname: '$HOSTNAME'
    username: '$ADMIN_USER'
    password: '$password_hash'
  ssh:
    install-server: true
    allow-pw: false
    authorized-keys:
      - '$ssh_key'
  storage:
    layout:
      name: direct
      match:
$storage_match
  packages:
    - ca-certificates
    - curl
    - ffmpeg
    - jq
    - openssh-server
  late-commands:
    - mkdir -p /target/usr/local/libexec/gmib-installer
    - cp -a /cdrom/gmib-installer/. /target/usr/local/libexec/gmib-installer/
    - curtin in-target -- env GMIB_ADMIN_USER='$ADMIN_USER' GMIB_KIOSK_USER='$KIOSK_USER' /usr/local/libexec/gmib-installer/install-target.sh
  shutdown: poweroff
EOF

printf '%s\n' 'instance-id: gmib-kiosk-installer' >"$work_dir/meta-data"

xorriso -osirrox on -indev "$BASE_ISO" -extract /boot/grub/grub.cfg "$work_dir/grub.cfg" >/dev/null 2>&1
sed -E '/^[[:space:]]*linux[[:space:]]/ { /[[:space:]]autoinstall([[:space:]]|$)/! s/[[:space:]]---([[:space:]]*)$/ autoinstall ---\1/; }' \
  "$work_dir/grub.cfg" >"$work_dir/grub.cfg.patched"
mv "$work_dir/grub.cfg.patched" "$work_dir/grub.cfg"
if ! grep -Eq '^[[:space:]]*linux[[:space:]].*[[:space:]]autoinstall([[:space:]]|$)' "$work_dir/grub.cfg"; then
  echo "Could not add the autoinstall kernel argument to GRUB." >&2
  exit 1
fi

manifest="$payload_dir/SHA256SUMS"
(
  cd "$payload_dir"
  sha256sum \
    first-boot-provision.sh \
    gmib-hide-cursor.c \
    gmib-provision.service \
    gmib.AppImage \
    image-release \
    install-target.sh \
    pritunl-client.deb \
    provision.conf \
    setup-linux-kiosk.sh
) >"$manifest"

xorriso \
  -indev "$BASE_ISO" \
  -outdev "$OUTPUT_ISO" \
  -map "$work_dir/autoinstall.yaml" /autoinstall.yaml \
  -map "$work_dir/meta-data" /meta-data \
  -map "$payload_dir" /gmib-installer \
  -map "$work_dir/grub.cfg" /boot/grub/grub.cfg \
  -volid GMIB_KIOSK_2404 \
  -boot_image any replay

(
  cd "$(dirname "$OUTPUT_ISO")"
  sha256sum "$(basename "$OUTPUT_ISO")"
) >"$OUTPUT_ISO.sha256"
echo "Created $OUTPUT_ISO"
echo "Checksum: $OUTPUT_ISO.sha256"

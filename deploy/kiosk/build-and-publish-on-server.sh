#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

BUILD_ROOT="${GMIB_APPLIANCE_BUILD_ROOT:-/home/user/appliance-build}"
GMIB_VERSION=""
BASE_ISO=""
PRITUNL_DEB=""
SSH_KEY=""
PUBLIC_DIR="${GMIB_APPLIANCE_PUBLIC_DIR:-/home/user/src/app-server/public/downloads/gmib-kiosk}"
PUBLIC_BASE_URL="${GMIB_APPLIANCE_PUBLIC_URL:-https://app.nata-info.ru/downloads/gmib-kiosk}"
BOOTSTRAP_URL="${GMIB_BOOTSTRAP_URL:-https://app.nata-info.ru/api/vpn/enroll/gmib}"
REPLACE_CURRENT=false

usage() {
  cat <<'EOF'
Usage: deploy/kiosk/build-and-publish-on-server.sh [options]

Build and publish a GMIB kiosk ISO directly on the Linux app-server host. The
script downloads only the release AppImage; cached Ubuntu and Pritunl inputs are
reused. By default, the GMIB version is read from the repository package.json.

Options:
  --gmib-version VERSION    GMIB release version. Default: package.json version.
  --build-root PATH         Private build directory. Default: /home/user/appliance-build.
  --base-iso PATH           Cached Ubuntu ISO.
  --pritunl-deb PATH        Cached amd64 Pritunl Client package.
  --ssh-authorized-key PATH Public SSH key embedded for the admin account.
  --public-dir PATH         App-server GMIB kiosk download directory.
  --public-base-url URL     Public URL corresponding to --public-dir.
  --bootstrap-url URL       Device enrollment endpoint.
  --replace-current        If space is insufficient, unpublish the current GMIB
                           kiosk image before building its replacement.
  -h, --help               Show this help.

Without --replace-current, the script never removes the published image before
the replacement has been built and published successfully.
EOF
}

while (($# > 0)); do
  case "$1" in
    --gmib-version)
      GMIB_VERSION="${2:-}"
      shift 2
      ;;
    --build-root)
      BUILD_ROOT="${2:-}"
      shift 2
      ;;
    --base-iso)
      BASE_ISO="${2:-}"
      shift 2
      ;;
    --pritunl-deb)
      PRITUNL_DEB="${2:-}"
      shift 2
      ;;
    --ssh-authorized-key)
      SSH_KEY="${2:-}"
      shift 2
      ;;
    --public-dir)
      PUBLIC_DIR="${2:-}"
      shift 2
      ;;
    --public-base-url)
      PUBLIC_BASE_URL="${2:-}"
      shift 2
      ;;
    --bootstrap-url)
      BOOTSTRAP_URL="${2:-}"
      shift 2
      ;;
    --replace-current)
      REPLACE_CURRENT=true
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

if [[ "$(uname -s)" != Linux ]]; then
  echo "This script must run on the Linux app-server host." >&2
  exit 1
fi
for command in awk curl df dpkg-deb file find grep jq mktemp openssl sed sha256sum stat tr xorriso; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

if [[ -z "$GMIB_VERSION" ]]; then
  GMIB_VERSION="$(jq -er '.version' "$REPO_ROOT/package.json")"
fi
if [[ ! "$GMIB_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid GMIB version: $GMIB_VERSION" >&2
  exit 1
fi
if [[ "$PUBLIC_DIR" != /* ]] || [[ "$BUILD_ROOT" != /* ]] ||
  [[ "$PUBLIC_BASE_URL" != https://* ]] || [[ "$BOOTSTRAP_URL" != https://* ]]; then
  echo "Build and public directories must be absolute; public URLs must use HTTPS." >&2
  exit 1
fi

BASE_ISO="${BASE_ISO:-$BUILD_ROOT/input/ubuntu-24.04.4-live-server-amd64.iso}"
PRITUNL_DEB="${PRITUNL_DEB:-$BUILD_ROOT/input/pritunl-client.deb}"
SSH_KEY="${SSH_KEY:-$BUILD_ROOT/input/id_ed25519.pub}"
APPIMAGE="$BUILD_ROOT/input/gmib-$GMIB_VERSION-x86_64.AppImage"
OUTPUT_DIR="$BUILD_ROOT/output"
OUTPUT="$OUTPUT_DIR/gmib-kiosk-$GMIB_VERSION-ubuntu-24.04.4-amd64.iso"
BASE_ISO_SHA256=e907d92eeec9df64163a7e454cbc8d7755e8ddc7ed42f99dbc80c40f1a138433

for input in "$BASE_ISO" "$PRITUNL_DEB" "$SSH_KEY"; do
  if [[ ! -f "$input" ]]; then
    echo "Missing cached input: $input" >&2
    exit 1
  fi
done
mkdir -p "$BUILD_ROOT/input" "$OUTPUT_DIR" "$PUBLIC_DIR"

# Validate every cached input before --replace-current is allowed to remove the
# published image. The builder repeats these checks before writing the new ISO.
actual_base_iso_sha256="$(sha256sum "$BASE_ISO" | awk '{print tolower($1)}')"
if [[ "$actual_base_iso_sha256" != "$BASE_ISO_SHA256" ]]; then
  echo "Ubuntu ISO checksum mismatch: $BASE_ISO" >&2
  exit 1
fi
if [[ "$(dpkg-deb --field "$PRITUNL_DEB" Package)" != pritunl-client ]] ||
  [[ "$(dpkg-deb --field "$PRITUNL_DEB" Architecture)" != amd64 ]]; then
  echo "Cached Pritunl package is not pritunl-client for amd64: $PRITUNL_DEB" >&2
  exit 1
fi
ssh_key="$(tr -d '\r\n' <"$SSH_KEY")"
if [[ ! "$ssh_key" =~ ^(ssh-(ed25519|rsa)|ecdsa-sha2-nistp(256|384|521))[[:space:]] ]]; then
  echo "Cached SSH public key has an unsupported format: $SSH_KEY" >&2
  exit 1
fi
if [[ "$(stat -c %d "$OUTPUT_DIR")" != "$(stat -c %d "$PUBLIC_DIR")" ]]; then
  echo "Build output and public directory must be on the same filesystem." >&2
  exit 1
fi

release_api="https://api.github.com/repos/sarakusha/gmib/releases/tags/v$GMIB_VERSION"
appimage_url="https://github.com/sarakusha/gmib/releases/download/v$GMIB_VERSION/gmib-x86_64.AppImage"
appimage_sha256="$(
  curl -fsSL --retry 3 "$release_api" |
    jq -er '.assets[] | select(.name == "gmib-x86_64.AppImage") | .digest | sub("^sha256:"; "")'
)"
if [[ ! "$appimage_sha256" =~ ^[a-f0-9]{64}$ ]]; then
  echo "GitHub did not return a SHA-256 digest for GMIB $GMIB_VERSION." >&2
  exit 1
fi

if [[ -f "$APPIMAGE" ]] &&
  [[ "$(sha256sum "$APPIMAGE" | awk '{print $1}')" == "$appimage_sha256" ]]; then
  echo "Using verified cached AppImage: $APPIMAGE"
else
  echo "Downloading GMIB $GMIB_VERSION AppImage directly from GitHub..."
  curl -fL --retry 3 "$appimage_url" -o "$APPIMAGE.part"
  printf '%s  %s\n' "$appimage_sha256" "$APPIMAGE.part" | sha256sum -c -
  mv "$APPIMAGE.part" "$APPIMAGE"
fi
if ! file "$APPIMAGE" | grep -Eq 'ELF 64-bit.*x86-64'; then
  echo "Downloaded release asset is not an x86_64 AppImage: $APPIMAGE" >&2
  exit 1
fi

if [[ -e "$OUTPUT" || -e "$OUTPUT.sha256" ]]; then
  echo "Build output already exists: $OUTPUT" >&2
  echo "Publish or remove that exact output before retrying." >&2
  exit 1
fi

base_size="$(stat -c %s "$BASE_ISO")"
appimage_size="$(stat -c %s "$APPIMAGE")"
pritunl_size="$(stat -c %s "$PRITUNL_DEB")"
reserve_bytes=$((2 * 1024 * 1024 * 1024))
overhead_bytes=$((64 * 1024 * 1024))
required_bytes=$((base_size + appimage_size + pritunl_size + overhead_bytes + reserve_bytes))
available_bytes="$(df -PB1 "$OUTPUT_DIR" | awk 'NR == 2 {print $4}')"

unpublish_current_image() {
  echo "Insufficient space for an atomic replacement. Unpublishing the current GMIB kiosk image..."
  find "$PUBLIC_DIR" -maxdepth 1 -type f -name 'gmib-kiosk-*.iso.json' -print -delete
  find "$PUBLIC_DIR" -maxdepth 1 -type f -name 'gmib-kiosk-*.iso.sha256' -print -delete
  find "$PUBLIC_DIR" -maxdepth 1 -type f \
    \( -name 'gmib-kiosk-*.iso' -o -name 'gmib-kiosk-*.iso.part' -o \
       -name 'gmib-kiosk-*.iso.sha256.part' -o -name 'gmib-kiosk-*.iso.json.part' \) \
    -print -delete
}

if ((available_bytes < required_bytes)); then
  if [[ "$REPLACE_CURRENT" == false ]]; then
    printf 'Insufficient free space: need %.1f GiB, have %.1f GiB.\n' \
      "$(awk -v value="$required_bytes" 'BEGIN {print value / 1024 / 1024 / 1024}')" \
      "$(awk -v value="$available_bytes" 'BEGIN {print value / 1024 / 1024 / 1024}')" >&2
    echo "Free space or rerun with --replace-current to remove only the old GMIB kiosk image." >&2
    exit 1
  fi
  unpublish_current_image
  available_bytes="$(df -PB1 "$OUTPUT_DIR" | awk 'NR == 2 {print $4}')"
  if ((available_bytes < required_bytes)); then
    echo "There is still not enough space after removing the old GMIB kiosk image." >&2
    exit 1
  fi
fi

"$SCRIPT_DIR/build-autoinstall-iso.sh" \
  --base-iso "$BASE_ISO" \
  --base-iso-sha256 "$BASE_ISO_SHA256" \
  --appimage "$APPIMAGE" \
  --gmib-version "$GMIB_VERSION" \
  --pritunl-deb "$PRITUNL_DEB" \
  --bootstrap-url "$BOOTSTRAP_URL" \
  --ssh-authorized-key "$SSH_KEY" \
  --output "$OUTPUT"

"$SCRIPT_DIR/publish-image.sh" \
  --local \
  --iso "$OUTPUT" \
  --remote-dir "$PUBLIC_DIR" \
  --public-base-url "$PUBLIC_BASE_URL"

published_url="$PUBLIC_BASE_URL/$(basename "$OUTPUT")"
http_status="$(curl -fsS --range 0-0 --output /dev/null --write-out '%{http_code}' "$published_url")"
if [[ "$http_status" != 206 ]]; then
  echo "Published image did not pass the HTTP Range check: status $http_status" >&2
  exit 1
fi

echo "GMIB kiosk $GMIB_VERSION is published and passed the HTTP Range check."

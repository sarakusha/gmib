#!/usr/bin/env bash
set -euo pipefail

ISO=""
SERVER="user@app.nata-info.ru"
PRODUCT="auto"
REMOTE_DIR=""
PUBLIC_BASE_URL=""
LOCAL=false

usage() {
  cat <<'EOF'
Usage: deploy/kiosk/publish-image.sh --iso PATH [options]

Required:
  --iso PATH             Versioned GMIB or GGS ISO and adjacent .sha256 file.

Optional:
  --server USER@HOST     SSH/rsync destination. Default: user@app.nata-info.ru.
  --product PRODUCT      auto, gmib-kiosk, or ggs. Default: auto from filename.
  --remote-dir PATH      App-server public download directory.
  --public-base-url URL  Public URL matching the remote directory.
  --local                Publish on this host without SSH or rsync. The ISO and
                         destination must be on the same filesystem.
  -h, --help             Show this help.

The ISO name must match:
  gmib-kiosk-GMIB_VERSION-ubuntu-UBUNTU_VERSION-amd64.iso
or:
  ggs-GGS_VERSION-ubuntu-UBUNTU_VERSION-amd64.iso

Files are first uploaded with a .part suffix. After atomic publication, older
ISO, checksum, manifest, and partial files for the same product are deleted.
EOF
}

while (($# > 0)); do
  case "$1" in
    --iso)
      ISO="${2:-}"
      shift 2
      ;;
    --server)
      SERVER="${2:-}"
      shift 2
      ;;
    --product)
      PRODUCT="${2:-}"
      shift 2
      ;;
    --remote-dir)
      REMOTE_DIR="${2:-}"
      shift 2
      ;;
    --public-base-url)
      PUBLIC_BASE_URL="${2:-}"
      shift 2
      ;;
    --local)
      LOCAL=true
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

required_commands=(awk jq sha256sum stat)
if [[ "$LOCAL" == false ]]; then
  required_commands+=(rsync ssh)
fi
for command in "${required_commands[@]}"; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done
if [[ ! -f "$ISO" || ! -f "$ISO.sha256" ]]; then
  echo "The ISO and its adjacent .sha256 file are required." >&2
  exit 1
fi
if { [[ "$LOCAL" == false ]] && [[ ! "$SERVER" =~ ^[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+$ ]]; } ||
  [[ ! "$PRODUCT" =~ ^(auto|gmib-kiosk|ggs)$ ]]; then
  echo "Invalid server or product." >&2
  exit 1
fi

filename="$(basename "$ISO")"
if [[ "$filename" =~ ^gmib-kiosk-([0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?)-ubuntu-([0-9]+\.[0-9]+(\.[0-9]+)?)-amd64\.iso$ ]]; then
  detected_product=gmib-kiosk
  product_version="${BASH_REMATCH[1]}"
  ubuntu_version="${BASH_REMATCH[3]}"
elif [[ "$filename" =~ ^ggs-([0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?)-ubuntu-([0-9]+\.[0-9]+(\.[0-9]+)?)-amd64\.iso$ ]]; then
  detected_product=ggs
  product_version="${BASH_REMATCH[1]}"
  ubuntu_version="${BASH_REMATCH[3]}"
else
  echo "Invalid versioned ISO filename: $filename" >&2
  exit 1
fi
if [[ "$PRODUCT" != auto && "$PRODUCT" != "$detected_product" ]]; then
  echo "Filename does not match --product $PRODUCT." >&2
  exit 1
fi
PRODUCT="$detected_product"
REMOTE_DIR="${REMOTE_DIR:-/home/user/src/app-server/public/downloads/$PRODUCT}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://app.nata-info.ru/downloads/$PRODUCT}"
if [[ ! "$REMOTE_DIR" =~ ^/[A-Za-z0-9_./-]+$ ]] ||
  [[ "$PUBLIC_BASE_URL" != https://* ]] || [[ "$PUBLIC_BASE_URL" =~ [[:space:]] ]]; then
  echo "Invalid remote directory or public URL." >&2
  exit 1
fi

expected_sha256="$(awk 'NR == 1 { print tolower($1) }' "$ISO.sha256")"
actual_sha256="$(sha256sum "$ISO" | awk '{ print tolower($1) }')"
if [[ ! "$expected_sha256" =~ ^[a-f0-9]{64}$ ]] || [[ "$actual_sha256" != "$expected_sha256" ]]; then
  echo "ISO checksum mismatch." >&2
  exit 1
fi

if size_bytes="$(stat -f %z "$ISO" 2>/dev/null)"; then
  :
else
  size_bytes="$(stat -c %s "$ISO")"
fi

work_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT INT TERM

sidecar="$work_dir/$filename.sha256"
printf '%s  %s\n' "$actual_sha256" "$filename" >"$sidecar"
manifest="$work_dir/$filename.json"
jq -n \
  --arg filename "$filename" \
  --arg product "$PRODUCT" \
  --arg productVersion "$product_version" \
  --arg ubuntuVersion "$ubuntu_version" \
  --arg architecture amd64 \
  --arg sha256 "$actual_sha256" \
  --arg publishedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson size "$size_bytes" \
  '{filename: $filename, product: $product, productVersion: $productVersion,
    architecture: $architecture, size: $size, sha256: $sha256, publishedAt: $publishedAt}' \
  >"$manifest"

# Preserve the field consumed by the existing dynamic GMIB catalog.
if [[ "$PRODUCT" == gmib-kiosk ]]; then
  temporary_manifest="$work_dir/manifest.json"
  jq --arg gmibVersion "$product_version" '. + {gmibVersion: $gmibVersion}' \
    "$manifest" >"$temporary_manifest"
  mv "$temporary_manifest" "$manifest"
fi

remote_retention_find="find '$REMOTE_DIR' -maxdepth 1 -type f \
  \( -name '$PRODUCT-*.iso' -o -name '$PRODUCT-*.iso.sha256' -o \
     -name '$PRODUCT-*.iso.json' -o -name '$PRODUCT-*.iso.part' -o \
     -name '$PRODUCT-*.iso.sha256.part' -o -name '$PRODUCT-*.iso.json.part' \) \
  ! -name '$filename' ! -name '$filename.sha256' ! -name '$filename.json' -delete"

if [[ "$LOCAL" == true ]]; then
  if [[ "$(uname -s)" != Linux ]]; then
    echo "--local publication is supported only on Linux." >&2
    exit 1
  fi
  mkdir -p "$REMOTE_DIR"
  if [[ "$(stat -c %d "$ISO")" != "$(stat -c %d "$REMOTE_DIR")" ]]; then
    echo "With --local, the ISO and destination must be on the same filesystem." >&2
    exit 1
  fi
  available_kib="$(df -Pk "$REMOTE_DIR" | awk 'NR == 2 { print $4 }')"
  if [[ ! "$available_kib" =~ ^[0-9]+$ ]] || ((available_kib < 2 * 1024 * 1024)); then
    echo "The server must retain at least 2 GiB of free space after the ISO build." >&2
    exit 1
  fi

  mv "$ISO" "$REMOTE_DIR/$filename.part"
  mv "$sidecar" "$REMOTE_DIR/$filename.sha256.part"
  mv "$manifest" "$REMOTE_DIR/$filename.json.part"
  mv "$REMOTE_DIR/$filename.part" "$REMOTE_DIR/$filename"
  mv "$REMOTE_DIR/$filename.sha256.part" "$REMOTE_DIR/$filename.sha256"
  mv "$REMOTE_DIR/$filename.json.part" "$REMOTE_DIR/$filename.json"
  find "$REMOTE_DIR" -maxdepth 1 -type f \
    \( -name "$PRODUCT-*.iso" -o -name "$PRODUCT-*.iso.sha256" -o \
       -name "$PRODUCT-*.iso.json" -o -name "$PRODUCT-*.iso.part" -o \
       -name "$PRODUCT-*.iso.sha256.part" -o -name "$PRODUCT-*.iso.json.part" \) \
    ! -name "$filename" ! -name "$filename.sha256" ! -name "$filename.json" -delete
else
  # All interpolated values are restricted to the safe character sets validated above.
  # shellcheck disable=SC2029
  ssh "$SERVER" "mkdir -p '$REMOTE_DIR'"
  # shellcheck disable=SC2029
  available_kib="$(ssh "$SERVER" "df -Pk '$REMOTE_DIR' | awk 'NR == 2 { print \$4 }'")"
  required_kib="$(((size_bytes + 1023) / 1024 + 2 * 1024 * 1024))"
  if [[ ! "$available_kib" =~ ^[0-9]+$ ]] || ((available_kib < required_kib)); then
    echo "The server must have enough room for the ISO plus 2 GiB of free space." >&2
    exit 1
  fi

  rsync --partial --progress "$ISO" "$SERVER:$REMOTE_DIR/$filename.part"
  rsync "$sidecar" "$SERVER:$REMOTE_DIR/$filename.sha256.part"
  rsync "$manifest" "$SERVER:$REMOTE_DIR/$filename.json.part"
  # shellcheck disable=SC2029
  ssh "$SERVER" \
    "mv '$REMOTE_DIR/$filename.part' '$REMOTE_DIR/$filename' &&
     mv '$REMOTE_DIR/$filename.sha256.part' '$REMOTE_DIR/$filename.sha256' &&
     mv '$REMOTE_DIR/$filename.json.part' '$REMOTE_DIR/$filename.json' &&
     $remote_retention_find"
fi

echo "Published $PUBLIC_BASE_URL/$filename"
echo "Catalog: $PUBLIC_BASE_URL/$filename.json"

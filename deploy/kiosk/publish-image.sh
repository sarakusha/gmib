#!/usr/bin/env bash
set -euo pipefail

ISO=""
SERVER="user@app.nata-info.ru"
REMOTE_DIR="/home/user/src/app-server/public/downloads/gmib-kiosk"
PUBLIC_BASE_URL="https://app.nata-info.ru/downloads/gmib-kiosk"

usage() {
  cat <<'EOF'
Usage: deploy/kiosk/publish-image.sh --iso PATH [options]

Required:
  --iso PATH             Versioned GMIB kiosk ISO and adjacent .sha256 file.

Optional:
  --server USER@HOST     SSH/rsync destination. Default: user@app.nata-info.ru.
  --remote-dir PATH      App-server public download directory.
  --public-base-url URL  Public URL matching the remote directory.
  -h, --help             Show this help.

The ISO name must match:
  gmib-kiosk-GMIB_VERSION-ubuntu-UBUNTU_VERSION-amd64.iso
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
    --remote-dir)
      REMOTE_DIR="${2:-}"
      shift 2
      ;;
    --public-base-url)
      PUBLIC_BASE_URL="${2:-}"
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

for command in awk jq rsync sha256sum ssh stat; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done
if [[ ! -f "$ISO" || ! -f "$ISO.sha256" ]]; then
  echo "The ISO and its adjacent .sha256 file are required." >&2
  exit 1
fi
if [[ ! "$SERVER" =~ ^[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+$ ]] ||
  [[ ! "$REMOTE_DIR" =~ ^/[A-Za-z0-9_./-]+$ ]] ||
  [[ "$PUBLIC_BASE_URL" != https://* ]] || [[ "$PUBLIC_BASE_URL" =~ [[:space:]] ]]; then
  echo "Invalid server, remote directory, or public URL." >&2
  exit 1
fi

filename="$(basename "$ISO")"
if [[ ! "$filename" =~ ^gmib-kiosk-([0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?)-ubuntu-([0-9]+\.[0-9]+(\.[0-9]+)?)-amd64\.iso$ ]]; then
  echo "Invalid versioned ISO filename: $filename" >&2
  exit 1
fi
gmib_version="${BASH_REMATCH[1]}"
ubuntu_version="${BASH_REMATCH[3]}"

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
  --arg gmibVersion "$gmib_version" \
  --arg ubuntuVersion "$ubuntu_version" \
  --arg architecture amd64 \
  --arg sha256 "$actual_sha256" \
  --arg publishedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson size "$size_bytes" \
  '{filename: $filename, gmibVersion: $gmibVersion, ubuntuVersion: $ubuntuVersion,
    architecture: $architecture, size: $size, sha256: $sha256, publishedAt: $publishedAt}' \
  >"$manifest"

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
   mv '$REMOTE_DIR/$filename.json.part' '$REMOTE_DIR/$filename.json'"

echo "Published $PUBLIC_BASE_URL/$filename"
echo "Catalog: $PUBLIC_BASE_URL/$filename.json"

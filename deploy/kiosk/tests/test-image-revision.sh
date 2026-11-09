#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PUBLISHER="$SCRIPT_DIR/../publish-image.sh"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT INT TERM
mkdir -p "$work_dir/bin" "$work_dir/public" "$work_dir/input"
# Exercise actual publishing/checksum/manifest logic, replacing only the SSH transport.
cat >"$work_dir/bin/ssh" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
shift
if [[ "$*" == *"/home/user/src/app-server/public/downloads/"* ]]; then
  printf '%s\n' "$*" >"$TEST_DEFAULT_PUBLICATION_CALL"
  exit 83
elif [[ "$*" == df\ -Pk* ]]; then
  echo 99999999
else
  bash -c "$*"
fi
STUB
cat >"$work_dir/bin/rsync" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
while [[ "$1" == --* ]]; do shift; done
cp "$1" "${2#*:}"
STUB
# The remote host is Linux; model its realpath -m on macOS test hosts too.
cat >"$work_dir/bin/realpath" <<'STUB'
#!/usr/bin/env python3
from pathlib import Path
import sys
assert sys.argv[1] == '-m'
print(Path(sys.argv[2]).resolve())
STUB
chmod +x "$work_dir/bin/ssh" "$work_dir/bin/rsync" "$work_dir/bin/realpath"
export TEST_DEFAULT_PUBLICATION_CALL="$work_dir/default-call"
export PATH="$work_dir/bin:$PATH"

publish() {
  local version="$1" revision="$2"
  local filename="gmib-kiosk-${version}${revision:+-$revision}-ubuntu-24.04.4-amd64.iso"
  printf 'synthetic ISO\n' >"$work_dir/input/$filename"
  sha256sum "$work_dir/input/$filename" >"$work_dir/input/$filename.sha256"
  bash "$PUBLISHER" --iso "$work_dir/input/$filename" --image-revision "$revision" \
    --server test@example.test --remote-dir "$work_dir/public" \
    --public-base-url https://example.test/downloads/gmib-kiosk "${@:3}" >/dev/null
  jq -e --arg version "$version" --arg revision "$revision" --arg filename "$filename" \
    '.product == "gmib-kiosk" and .gmibVersion == $version and .productVersion == $version and .filename == $filename and
      (if $revision == "" then has("imageRevision") | not else .imageRevision == $revision end)' \
    "$work_dir/public/$filename.json" >/dev/null
  (cd "$work_dir/public" && sha256sum -c "$filename.sha256" >/dev/null)
}

publish 5.6.6 ''
publish 5.6.6 patch1
publish 5.6.6 patch2
publish 5.7.0-rc.1 patch1
# Existing prerelease names must not be reinterpreted as installer revisions.
publish 5.6.6-patch1 ''

# Explicit retention preserves the previous ISO and its checksum/manifest.
previous_name=gmib-kiosk-5.6.6-patch1-ubuntu-24.04.4-amd64.iso
publish 5.7.6 client1 --keep-existing
for suffix in '' .sha256 .json; do
  [[ -f "$work_dir/public/$previous_name$suffix" ]]
done
publish 5.7.6 client2
[[ ! -e "$work_dir/public/$previous_name" ]]

for revision in patch2 '../patch1' 'patch1;touch injected'; do
  if bash "$PUBLISHER" --iso "$work_dir/input/gmib-kiosk-5.6.6-patch1-ubuntu-24.04.4-amd64.iso" \
    --image-revision "$revision" --server test@example.test --remote-dir "$work_dir/public" \
    >"$work_dir/error" 2>&1; then
    echo "Unexpectedly accepted invalid/mismatched revision: $revision" >&2
    exit 1
  fi
done
# Standalone clone publication auto-detects the reserved revision even without
# --image-revision, retains ordinary artifacts, and refuses namespace aliases.
clone_dir="$work_dir/gmib-kiosk-clone"
mkdir -p "$clone_dir"
ordinary_name=gmib-kiosk-5.6.9-ubuntu-24.04.4-amd64.iso
printf 'ordinary sentinel\n' >"$clone_dir/$ordinary_name"
for revision in clone1 clone2.patch1; do
  clone_name="gmib-kiosk-5.7.6-$revision-ubuntu-24.04.4-amd64.iso"
  printf 'synthetic clone ISO\n' >"$work_dir/input/$clone_name"
  sha256sum "$work_dir/input/$clone_name" >"$work_dir/input/$clone_name.sha256"
  bash "$PUBLISHER" --iso "$work_dir/input/$clone_name" --server test@example.test \
    --remote-dir "$clone_dir" >"$work_dir/clone-output"
  jq -e --arg revision "$revision" '.gmibVersion == "5.7.6" and .imageRevision == $revision' \
    "$clone_dir/$clone_name.json" >/dev/null
  [[ -f "$clone_dir/$ordinary_name" ]]
  grep -q 'https://app.nata-info.ru/downloads/gmib-kiosk-clone/' "$work_dir/clone-output"
done
[[ ! -f "$clone_dir/gmib-kiosk-5.7.6-clone1-ubuntu-24.04.4-amd64.iso" ]]

# No explicit destination: observe the first remote call, refuse to execute it.
if bash "$PUBLISHER" --iso "$work_dir/input/$clone_name" --server test@example.test >"$work_dir/error" 2>&1; then
  echo 'Default-destination transport should stop before touching real paths' >&2
  exit 1
fi
grep -q "realpath -m '/home/user/src/app-server/public/downloads/gmib-kiosk-clone'" "$TEST_DEFAULT_PUBLICATION_CALL"

mkdir -p "$work_dir/alias"
ln -s "$work_dir/public" "$work_dir/alias/gmib-kiosk-clone"
for mode in remote local; do
  mode_args=(--server test@example.test)
  [[ "$mode" != local ]] || mode_args=(--local)
  for destination in "$work_dir/public" "$work_dir/alias/gmib-kiosk-clone"; do
    if bash "$PUBLISHER" --iso "$work_dir/input/$clone_name" "${mode_args[@]}" \
      --remote-dir "$destination" >"$work_dir/error" 2>&1; then
      echo "Clone publication unexpectedly accepted $destination ($mode)" >&2
      exit 1
    fi
    grep -q 'Clone publication' "$work_dir/error"
    [[ -f "$work_dir/input/$clone_name" ]]
  done
done
# The unified image defaults to the regular catalog and cannot prune legacy images.
publish 5.7.6 patch1
unified_iso="$work_dir/input/gmib-kiosk-5.7.6-patch1-ubuntu-24.04.4-amd64.iso"
if bash "$PUBLISHER" --iso "$unified_iso" --image-revision patch1 --server test@example.test \
  >"$work_dir/error" 2>&1; then
  echo 'Default-destination transport should stop before touching real paths' >&2
  exit 1
fi
grep -q "realpath -m '/home/user/src/app-server/public/downloads/gmib-kiosk'" "$TEST_DEFAULT_PUBLICATION_CALL"
ln -s "$clone_dir" "$work_dir/alias/gmib-kiosk"
for destination in "$clone_dir" "$work_dir/alias/gmib-kiosk"; do
  if bash "$PUBLISHER" --iso "$unified_iso" --image-revision patch1 --server test@example.test \
    --remote-dir "$destination" >"$work_dir/error" 2>&1; then
    echo "Unified image publication unexpectedly accepted $destination" >&2
    exit 1
  fi
  grep -q 'legacy' "$work_dir/error"
  [[ -f "$clone_dir/$clone_name" ]]
done
if [[ "$(uname -s)" == Linux ]]; then
  local_dir="$work_dir/local-public"
  mkdir -p "$local_dir"
  for revision in client1 client2; do
    local_name="gmib-kiosk-5.7.6-$revision-ubuntu-24.04.4-amd64.iso"
    printf 'synthetic local ISO\n' >"$work_dir/input/$local_name"
    sha256sum "$work_dir/input/$local_name" >"$work_dir/input/$local_name.sha256"
    bash "$PUBLISHER" --local --keep-existing --iso "$work_dir/input/$local_name" \
      --image-revision "$revision" --remote-dir "$local_dir" >/dev/null
  done
  for suffix in '' .sha256 .json; do
    [[ -f "$local_dir/gmib-kiosk-5.7.6-client1-ubuntu-24.04.4-amd64.iso$suffix" ]]
  done
fi
printf 'Image revision tests passed.\n'

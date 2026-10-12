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
if [[ "$*" == df\ -Pk* ]]; then
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
chmod +x "$work_dir/bin/ssh" "$work_dir/bin/rsync"
export PATH="$work_dir/bin:$PATH"

publish() {
  local version="$1" revision="$2"
  local filename="gmib-kiosk-${version}${revision:+-$revision}-ubuntu-24.04.4-amd64.iso"
  printf 'synthetic ISO\n' >"$work_dir/input/$filename"
  sha256sum "$work_dir/input/$filename" >"$work_dir/input/$filename.sha256"
  bash "$PUBLISHER" --iso "$work_dir/input/$filename" --image-revision "$revision" \
    --server test@example.test --remote-dir "$work_dir/public" \
    --public-base-url https://example.test/downloads/gmib-kiosk >/dev/null
  jq -e --arg version "$version" --arg revision "$revision" --arg filename "$filename" \
    '.gmibVersion == $version and .productVersion == $version and .filename == $filename and
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

for revision in patch2 '../patch1' 'patch1;touch injected'; do
  if bash "$PUBLISHER" --iso "$work_dir/input/gmib-kiosk-5.6.6-patch1-ubuntu-24.04.4-amd64.iso" \
    --image-revision "$revision" --server test@example.test --remote-dir "$work_dir/public" \
    >"$work_dir/error" 2>&1; then
    echo "Unexpectedly accepted invalid/mismatched revision: $revision" >&2
    exit 1
  fi
done
printf 'Image revision tests passed.\n'

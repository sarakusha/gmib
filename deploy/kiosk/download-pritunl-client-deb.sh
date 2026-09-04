#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:-.}"
VERSION="${PRITUNL_CLIENT_VERSION:-}"

for command in apt-get curl dpkg-deb gpg; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done
if [[ "$(dpkg --print-architecture)" != amd64 ]]; then
  echo "Run this script on an amd64 Ubuntu builder." >&2
  exit 1
fi
if [[ ! -d "$OUTPUT_DIR" ]]; then
  echo "Output directory does not exist: $OUTPUT_DIR" >&2
  exit 1
fi

work_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT INT TERM

install -d -m 0755 "$work_dir/lists/partial" "$work_dir/cache/archives/partial" "$work_dir/download"
curl --fail --silent --show-error --location \
  https://raw.githubusercontent.com/pritunl/pgp/master/pritunl_repo_pub.asc \
  --output "$work_dir/pritunl.asc"
gpg --batch --yes --dearmor --output "$work_dir/pritunl.gpg" "$work_dir/pritunl.asc"
printf '%s\n' \
  "deb [arch=amd64 signed-by=$work_dir/pritunl.gpg] https://repo.pritunl.com/unstable/apt noble main" \
  >"$work_dir/pritunl.list"

apt_options=(
  -o "Dir::Etc::sourcelist=$work_dir/pritunl.list"
  -o "Dir::Etc::sourceparts=-"
  -o "Dir::Etc::trusted=$work_dir/pritunl.gpg"
  -o "Dir::Etc::trustedparts=-"
  -o "Dir::State::lists=$work_dir/lists"
  -o "Dir::Cache=$work_dir/cache"
)
apt-get "${apt_options[@]}" update

package="pritunl-client:amd64"
if [[ -n "$VERSION" ]]; then
  package="pritunl-client:amd64=$VERSION"
fi
(
  cd "$work_dir/download"
  apt-get "${apt_options[@]}" download "$package"
)

shopt -s nullglob
packages=("$work_dir"/download/pritunl-client_*.deb)
if ((${#packages[@]} != 1)); then
  echo "Expected one downloaded pritunl-client package, found ${#packages[@]}." >&2
  exit 1
fi

deb="${packages[0]}"
if [[ "$(dpkg-deb --field "$deb" Package)" != pritunl-client ]] ||
  [[ "$(dpkg-deb --field "$deb" Architecture)" != amd64 ]]; then
  echo "Downloaded package metadata is invalid." >&2
  exit 1
fi

version="$(dpkg-deb --field "$deb" Version)"
safe_version="${version//:/_}"
output="$OUTPUT_DIR/pritunl-client_${safe_version}_amd64.deb"
install -m 0644 "$deb" "$output"
sha256sum "$output" >"$output.sha256"

echo "Downloaded $output"
echo "Version: $version"
echo "Checksum: $output.sha256"

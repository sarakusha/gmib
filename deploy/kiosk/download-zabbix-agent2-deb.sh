#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:-.}"
# Pin image builds to a reviewed Zabbix 7.4 package. Override only to reproduce or
# deliberately update an image after reviewing the new package.
VERSION="${ZABBIX_AGENT2_VERSION:-1:7.4.14-1+ubuntu24.04}"
REPOSITORY_BASE="https://repo.zabbix.com/zabbix/7.4/stable/ubuntu"
KEY_URL="https://repo.zabbix.com/zabbix-official-repo.key"

for command in apt-get curl dpkg dpkg-deb gpg sha256sum; do
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
if [[ ! "$VERSION" =~ ^1:7\.4\.[0-9]+-[0-9]+\+ubuntu24\.04$ ]]; then
  echo "ZABBIX_AGENT2_VERSION must be an exact Zabbix 7.4 Ubuntu 24.04 version." >&2
  exit 1
fi

work_dir="$(mktemp -d)"
chmod 0755 "$work_dir"
cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT INT TERM

install -d -m 0755 "$work_dir/lists/partial" "$work_dir/cache/archives/partial" "$work_dir/download"
curl --fail --silent --show-error --location "$KEY_URL" --output "$work_dir/zabbix.asc"
gpg --batch --yes --dearmor --output "$work_dir/zabbix.gpg" "$work_dir/zabbix.asc"
printf '%s\n' \
  "deb [arch=amd64 signed-by=$work_dir/zabbix.gpg] $REPOSITORY_BASE noble main" \
  >"$work_dir/zabbix.list"

apt_options=(
  -o "Dir::Etc::sourcelist=$work_dir/zabbix.list"
  -o "Dir::Etc::sourceparts=-"
  -o "Dir::Etc::trusted=$work_dir/zabbix.gpg"
  -o "Dir::Etc::trustedparts=-"
  -o "Dir::State::lists=$work_dir/lists"
  -o "Dir::Cache=$work_dir/cache"
)
apt-get "${apt_options[@]}" update
(
  cd "$work_dir/download"
  apt-get "${apt_options[@]}" download "zabbix-agent2:amd64=$VERSION"
)

shopt -s nullglob
packages=("$work_dir"/download/zabbix-agent2_*.deb)
if ((${#packages[@]} != 1)); then
  echo "Expected one downloaded zabbix-agent2 package, found ${#packages[@]}." >&2
  exit 1
fi

deb="${packages[0]}"
if [[ "$(dpkg-deb --field "$deb" Package)" != zabbix-agent2 ]] ||
  [[ "$(dpkg-deb --field "$deb" Architecture)" != amd64 ]] ||
  [[ "$(dpkg-deb --field "$deb" Version)" != "$VERSION" ]]; then
  echo "Downloaded package metadata is invalid." >&2
  exit 1
fi

safe_version="${VERSION//:/_}"
output="$OUTPUT_DIR/zabbix-agent2_${safe_version}_amd64.deb"
install -m 0644 "$deb" "$output"
sha256sum "$output" >"$output.sha256"

echo "Downloaded $output"
echo "Version: $VERSION"
echo "Checksum: $output.sha256"

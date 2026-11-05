#!/usr/bin/env bash
# Validate a public-key list and emit unique, comment-free keys for YAML embedding.
set -euo pipefail
if [[ $# != 1 || ! -f "$1" ]]; then
  echo 'Usage: read-ssh-public-keys.sh PUBLIC_KEYS_FILE' >&2
  exit 1
fi
command -v ssh-keygen >/dev/null 2>&1 || {
  echo 'Missing required command: ssh-keygen' >&2
  exit 1
}
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
keys=()
line_number=0
while IFS= read -r line || [[ -n "$line" ]]; do
  line_number=$((line_number + 1))
  line="${line%$'\r'}"
  [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
  read -r key_type key_data comment <<<"$line"
  if [[ ! "$key_type" =~ ^(ssh-(ed25519|rsa)|ecdsa-sha2-nistp(256|384|521))$ ]] ||
    [[ ! "$key_data" =~ ^[A-Za-z0-9+/]+={0,2}$ ]]; then
    echo "Invalid SSH public key at line $line_number (expected a bare public key)." >&2
    exit 1
  fi
  key="$key_type $key_data"
  printf '%s\n' "$key" >"$work_dir/key.pub"
  if ! ssh-keygen -l -f "$work_dir/key.pub" >/dev/null 2>&1; then
    echo "Invalid SSH public key data at line $line_number." >&2
    exit 1
  fi
  duplicate=false
  for existing in "${keys[@]}"; do
    [[ "$existing" != "$key" ]] || duplicate=true
  done
  [[ "$duplicate" == true ]] || keys+=("$key")
done <"$1"
if ((${#keys[@]} == 0)); then
  echo 'At least one SSH public key is required.' >&2
  exit 1
fi
printf '%s\n' "${keys[@]}"

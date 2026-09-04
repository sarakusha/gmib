#!/usr/bin/env bash
set -euo pipefail

PAYLOAD_DIR="${1:-/usr/local/libexec/gmib-installer}"
ADMIN_USER="${GMIB_ADMIN_USER:-admin}"
KIOSK_USER="${GMIB_KIOSK_USER:-gmib}"

if [[ ${EUID} -ne 0 ]]; then
  echo "install-target.sh must run as root in the installed system." >&2
  exit 1
fi
if [[ "$PAYLOAD_DIR" != /usr/local/libexec/gmib-installer ]]; then
  echo "Unexpected payload directory: $PAYLOAD_DIR" >&2
  exit 1
fi

for required_file in \
  gmib.AppImage \
  pritunl-client.deb \
  provision.conf \
  first-boot-provision.sh \
  gmib-provision.service \
  setup-linux-kiosk.sh \
  gmib-hide-cursor.c; do
  if [[ ! -f "$PAYLOAD_DIR/$required_file" ]]; then
    echo "Missing payload file: $PAYLOAD_DIR/$required_file" >&2
    exit 1
  fi
done

if ! id "$ADMIN_USER" >/dev/null 2>&1; then
  echo "Autoinstall did not create the admin user: $ADMIN_USER" >&2
  exit 1
fi
if ! id "$KIOSK_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$KIOSK_USER"
fi
passwd --lock "$KIOSK_USER" >/dev/null

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y \
  ca-certificates \
  curl \
  jq \
  openssh-server \
  "$PAYLOAD_DIR/pritunl-client.deb"

install -d -m 0755 /opt/gmib
install -m 0755 "$PAYLOAD_DIR/gmib.AppImage" /opt/gmib/gmib.AppImage

install -d -m 0755 /usr/local/libexec/gmib-kiosk
install -m 0644 "$PAYLOAD_DIR/gmib-hide-cursor.c" /usr/local/libexec/gmib-kiosk/
install -m 0755 "$PAYLOAD_DIR/setup-linux-kiosk.sh" /usr/local/libexec/gmib-kiosk/
/usr/local/libexec/gmib-kiosk/setup-linux-kiosk.sh \
  --user "$KIOSK_USER" \
  --executable /opt/gmib/gmib.AppImage \
  --no-start

install -d -m 0755 /etc/gmib
install -m 0644 "$PAYLOAD_DIR/provision.conf" /etc/gmib/provision.conf
install -m 0755 "$PAYLOAD_DIR/first-boot-provision.sh" /usr/local/sbin/gmib-first-boot-provision
install -m 0644 "$PAYLOAD_DIR/gmib-provision.service" /etc/systemd/system/gmib-provision.service

install -d -m 0750 /etc/sudoers.d
printf '%s ALL=(ALL:ALL) NOPASSWD: ALL\n' "$ADMIN_USER" >/etc/sudoers.d/90-gmib-admin
chmod 0440 /etc/sudoers.d/90-gmib-admin
visudo --check --file=/etc/sudoers.d/90-gmib-admin >/dev/null

systemctl daemon-reload
systemctl enable ssh.service pritunl-client.service gmib-provision.service >/dev/null
systemctl disable gmib-cage@tty1.service >/dev/null 2>&1 || true
systemctl disable getty@tty1.service >/dev/null 2>&1 || true

rm -rf "$PAYLOAD_DIR"

echo "GMIB kiosk payload installed. VPN enrollment will run on tty1 after first boot."

# GMIB kiosk image

This directory builds an Ubuntu Server 24.04 amd64 installer for dedicated GMIB players. The image
contains the GMIB AppImage and a pinned Pritunl Client package. Installation erases one explicitly
selected disk, installs the Cage service, and powers the computer off.

On the first boot, `gmib-provision.service` owns `tty1` and asks the operator for a short one-time
enrollment code. It exchanges the code for a device-specific Pritunl profile over pinned HTTPS,
imports and starts the profile, erases the downloaded archive, and reboots into the GMIB Cage
kiosk. The image and installed computer never contain the bootstrap API key.

## Security model

- Do not encrypt a permanent API key with a short shared password. Anyone with the ISO can copy the
  ciphertext and brute-force that password offline.
- Put only the bootstrap URL, its TLS public-key pin, and an SSH public key in the image. None of
  these values are secret.
- Use single-use enrollment codes with at least 40 random bits (for example, eight unambiguous
  Base32 characters), a 10-minute lifetime, and limits of five attempts per code, device, and source
  address.
- Bind a code to the device ID shown on its screen before giving the code to the installer. Redeem it
  atomically so simultaneous requests cannot both succeed.
- Generate a separate Pritunl identity for every device. A shared fleet VPN profile turns one stolen
  player into a fleet-wide credential leak.
- Keep the imported VPN identity in `/var/lib/pritunl-client`; it is required for reconnecting. The
  temporary profile archive and the enrollment code are not retained.

The administrator account accepts only the SSH public key embedded at image-build time. Its random
password is discarded, and it has passwordless sudo. The unprivileged `gmib` account owns the GMIB
configuration and cannot use sudo.

## Bootstrap API contract

The image sends an HTTPS request whose server public key must match the configured curl pin:

```http
POST /v1/enroll/pritunl HTTP/1.1
Content-Type: application/json

{
  "code": "7K4M-P9TX",
  "device_id": "lowercase-dmi-product-uuid",
  "hostname": "gmib-identifier",
  "mac_addresses": ["00:11:22:33:44:55"]
}
```

A successful response is the Pritunl profile tar archive accepted by
`pritunl-client add profile.tar`. Recommended error responses are `403` for an invalid or expired
code, `409` for a redeemed or differently bound code, and `429` with `Retry-After` when throttled.
Do not return a Pritunl URI in JSON: an archive avoids putting the secret URI in a process argument.

Generate the pin from the bootstrap server certificate:

```bash
openssl s_client -connect bootstrap.example.com:443 -servername bootstrap.example.com </dev/null 2>/dev/null \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary \
  | openssl base64
```

Prefix the result with `sha256//`. Plan certificate rotation with overlapping pins or rebuild the
image before the server key changes.

## Build

Build the x86_64 AppImage in the manual `Release` workflow with `dry-run` enabled and `platforms`
set to `linux`. Download the `gmib-linux-x64-*` artifact. The x64 job deliberately runs on Ubuntu
22.04 so native modules remain compatible with Ubuntu 22.04 and 24.04 targets.

Download and pin the amd64 `pritunl-client` Debian package from the official Pritunl Noble
repository on an Ubuntu builder. This helper uses an isolated temporary APT configuration and does
not add the repository to the builder permanently:

```bash
deploy/kiosk/download-pritunl-client-deb.sh dist
```

Set `PRITUNL_CLIENT_VERSION` to an exact APT version when reproducing an older image. The helper
writes the package SHA-256 next to the Debian file.

Then build the installation ISO on Linux with `xorriso` installed:

```bash
sudo apt-get install xorriso

deploy/kiosk/build-autoinstall-iso.sh \
  --base-iso ubuntu-24.04.4-live-server-amd64.iso \
  --base-iso-sha256 eebf1e8df31b1e3e5cdb20d5468f6478f1f896dc0848c993aa35d7ea811d0948 \
  --appimage gmib-x86_64.AppImage \
  --pritunl-deb pritunl-client_amd64.deb \
  --bootstrap-url https://bootstrap.example.com/v1/enroll/pritunl \
  --bootstrap-tls-pin 'sha256//BASE64_SPKI_HASH' \
  --ssh-authorized-key id_ed25519.pub \
  --target-disk /dev/nvme0n1 \
  --output gmib-kiosk-24.04.iso
```

The build verifies the Ubuntu ISO checksum and writes `gmib-kiosk-24.04.iso.sha256`. Every embedded
payload file also has an entry in `/gmib-installer/SHA256SUMS` on the ISO.

## Installation

Writing this ISO to USB and booting it starts an unattended install that **erases the selected target
disk without confirmation**. The HIPER NUG test system uses `/dev/nvme0n1`; verify every hardware
revision before reusing that rule.

The installer powers the computer off when complete. Remove the USB drive, power it on, and enter a
one-time enrollment code on the provisioning screen. After the VPN connects, the machine reboots and
starts the GMIB kiosk automatically.

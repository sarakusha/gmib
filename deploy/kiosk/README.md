# GMIB kiosk image

This directory builds an Ubuntu Server 24.04 amd64 installer for dedicated GMIB players. The image
contains the GMIB AppImage and a pinned Pritunl Client package. Installation erases one explicitly
selected disk, installs the Cage service, and powers the computer off.

On the first boot, `gmib-provision.service` owns `tty1` and asks the operator for a short one-time
enrollment code. It exchanges the code for a device-specific Pritunl profile over HTTPS, imports
and starts the profile, erases the downloaded archive, and reboots into the GMIB Cage kiosk. The
image and installed computer never contain the bootstrap API key.

If the Pritunl organization is attached to multiple VPN servers, provisioning enables only the
profile whose name ends in `(main)`. Other imported profiles are disabled because running `main`
and `mikrotik` together creates overlapping routes. Publish all required remote networks as routes
of the primary Pritunl server instead.

See [`README.ru.md`](README.ru.md) for the Russian build and installation guide.

## Security model

- Do not encrypt a permanent API key with a short shared password. Anyone with the ISO can copy the
  ciphertext and brute-force that password offline.
- Put only the bootstrap URL, an optional TLS public-key pin, and an SSH public key in the image.
  None of these values are secret.
- Use single-use enrollment codes with at least 40 random bits (for example, eight unambiguous
  Base32 characters), a 10-minute lifetime, and limits of five attempts per code, device, and source
  address.
- Scope each code to its product. The server atomically binds it to the first device that redeems
  it, so simultaneous requests cannot both succeed.
- Generate a separate Pritunl identity for every device. A shared fleet VPN profile turns one stolen
  player into a fleet-wide credential leak.
- Keep the imported VPN identity in `/var/lib/pritunl-client`; it is required for reconnecting. The
  temporary profile archive and the enrollment code are not retained.

The administrator account accepts only the SSH public key embedded at image-build time. Its random
password is discarded, and it has passwordless sudo. The unprivileged `gmib` account owns the GMIB
configuration and cannot use sudo.

## Bootstrap API contract

The image sends this HTTPS request. When an optional curl pin is configured, the server public key
must also match it:

```http
POST /api/vpn/enroll/gmib HTTP/1.1
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

Then build the installation ISO on Linux or macOS. On Ubuntu install `xorriso`; on macOS install
`xorriso`, `dpkg`, GNU coreutils, and OpenSSL 3 with Homebrew:

```bash
sudo apt-get install xorriso
# or: brew install xorriso dpkg coreutils openssl@3

deploy/kiosk/build-autoinstall-iso.sh \
  --base-iso ubuntu-24.04.4-live-server-amd64.iso \
  --base-iso-sha256 e907d92eeec9df64163a7e454cbc8d7755e8ddc7ed42f99dbc80c40f1a138433 \
  --appimage gmib-x86_64.AppImage \
  --gmib-version 5.4.1 \
  --pritunl-deb pritunl-client_amd64.deb \
  --bootstrap-url https://app.nata-info.ru/api/vpn/enroll/gmib \
  --ssh-authorized-key id_ed25519.pub \
  --output gmib-kiosk-5.4.1-ubuntu-24.04.4-amd64.iso
```

The build verifies the Ubuntu ISO checksum and writes `gmib-kiosk-24.04.iso.sha256`. Every embedded
payload file also has an entry in `/gmib-installer/SHA256SUMS` on the ISO.

Normal public-CA HTTPS validation is used by default. `--bootstrap-tls-pin` can add a curl SPKI pin
when the endpoint has a deliberately stable TLS private key. Do not pin an ordinary rotating
Let's Encrypt key: an installer kept in storage would stop enrolling after certificate renewal.

## Installation

Writing this ISO to USB and booting it starts an unattended install that **erases the selected target
disk without confirmation**. By default, Autoinstall selects the largest disk that is not the
installation medium. This works for a player with one internal SATA, NVMe, or eMMC disk and does not
depend on its reported capacity being accurate. Do not use the default image on a computer with
multiple internal disks: build that batch with `--target-disk`, `--target-model`, or
`--target-serial` instead.

The installer powers the computer off when complete. Remove the USB drive, power it on, and enter a
one-time enrollment code on the provisioning screen. After the VPN connects, the machine reboots and
starts the GMIB kiosk automatically.

## Publishing

Publish the versioned ISO and its checksum to app-server with:

```bash
deploy/kiosk/publish-image.sh \
  --iso gmib-kiosk-5.4.1-ubuntu-24.04.4-amd64.iso
```

The public catalog is `https://app.nata-info.ru/gmib/kiosk`. The publisher validates the checksum,
uploads atomically, and refuses an upload that would leave less than 2 GiB free on the server. It
does not delete older releases automatically.

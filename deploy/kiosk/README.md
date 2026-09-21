# GMIB kiosk image

This directory builds an Ubuntu Server 24.04 amd64 installer for dedicated GMIB players. The image
contains the GMIB AppImage plus pinned Pritunl Client and Zabbix Agent 2 7.4 packages. Installation erases one explicitly
selected disk, installs the Cage service, and powers the computer off.

On the first boot, `gmib-provision.service` owns `tty1` and asks the operator for a short one-time
enrollment code. It exchanges the code for a device-specific Pritunl profile over HTTPS, imports
and starts the profile, erases the downloaded archive, and reboots into the GMIB Cage kiosk. The
image and installed computer never contain the bootstrap API key. Zabbix is installed masked and
disabled; it is enabled only after the stable hostname and VPN identity are established. The
generated configuration uses active checks only, so the agent does not listen on TCP port 10050.
Normal kiosk boots hide kernel and systemd status messages while retaining them in `journalctl`.
The Ubuntu installer remains verbose so installation failures are visible.
The installed system uses Ubuntu's `ffmpeg` package and provides `/usr/bin/ffmpeg` and
`/usr/bin/ffprobe` for GMIB media conversion and inspection.
The system locale, provisioning tty, and Cage/GMIB service use `ru_RU.UTF-8`. A Unicode Cyrillic
console font is configured separately: the locale controls byte decoding, while the font provides
the decoded glyphs on tty1.
The installer also grants the kiosk user access to serial ports and direct `libusb` access to the
supported FTDI adapters `0403:6001` and `0403:6015` through `udev` rules.
NovaStar Taurus USB connections appear as RNDIS network adapters. The kiosk requests an address over
DHCP and falls back to IPv4 link-local when DHCP is unavailable. It ignores RNDIS-provided gateways
and DNS servers so the controller cannot take over the primary internet route.

If the Pritunl organization is attached to multiple VPN servers, provisioning enables only the
profile whose name ends in `(main)`. Other imported profiles are disabled because running `main`
and `mikrotik` together creates overlapping routes. Publish all required remote networks as routes
of the primary Pritunl server instead.

See [`README.ru.md`](README.ru.md) for the Russian build and installation guide.

## Quick server release

On the prepared app-server, the normal release is deliberately short:

```bash
cd /home/user/appliance-build/gmib-repo
git pull --ff-only
deploy/kiosk/build-and-publish-on-server.sh --replace-current
```

The flag is required only on a small disk. It permits the script to unpublish the previous GMIB
kiosk image when there is not enough room to build both versions side by side. It never removes the
cached Ubuntu ISO or a GGS image. The one-time server preparation and input filenames are documented
in [`README.ru.md`](README.ru.md#быстрый-выпуск-образа-на-app-server).

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
  enrollment code and Zabbix PSK are never logged. Pending response files are root-only and erased
  after provisioning; the installed PSK is readable only by root and the `zabbix` service group.

The administrator account accepts only the SSH public key embedded at image-build time. Its random
password is discarded, and it has passwordless sudo. The unprivileged `gmib` account owns the GMIB
configuration and cannot use sudo.

## Bootstrap API contract

The image sends this HTTPS request. When an optional curl pin is configured, the server public key
must also match it:

```http
POST /api/vpn/enroll/gmib HTTP/1.1
Content-Type: application/json
Accept: application/vnd.gmib.enrollment+json

{
  "code": "7K4M-P9TX",
  "device_id": "lowercase-dmi-product-uuid",
  "hostname": "gmib-identifier",
  "mac_addresses": ["00:11:22:33:44:55"]
}
```

A successful versioned response is JSON. `vpnProfile` is base64 of the raw OpenVPN profile or
Pritunl profile tar accepted by `pritunl-client add`:

```json
{
  "version": 1,
  "vpnProfile": "BASE64",
  "zabbix": {
    "enabled": true,
    "serverActive": "zabbix.internal:10051",
    "metadata": "gmib kiosk",
    "tlsConnect": "psk",
    "pskIdentity": "gmib-device-id",
    "psk": "32-or-more-hex-characters"
  }
}
```

For an unencrypted active connection, use `tlsConnect: "unencrypted"` and omit both PSK fields.
Disabled monitoring is `{"enabled":false}`; temporary absence may additionally use
`"error":"configuration_unavailable"`. Invalid optional monitoring data never blocks VPN or GMIB.
The legacy raw VPN response body remains supported during rollout. Recommended HTTP errors are
`403`, `409`, and `429` with `Retry-After`. Do not put codes, profiles, or PSKs in URLs or argv.

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

Download the pinned official Zabbix Agent 2 7.4 package from Zabbix's signed Noble repository. The
reviewed default is `1:7.4.14-1+ubuntu24.04`:

```bash
deploy/kiosk/download-zabbix-agent2-deb.sh dist
```

Both helpers use isolated APT state and do not add repositories to the builder.

Then build the installation ISO on Linux or macOS. On Ubuntu install `xorriso`; on macOS install
`xorriso`, `dpkg`, GNU coreutils, and OpenSSL 3 with Homebrew:

```bash
sudo apt-get install xorriso
# or: brew install xorriso dpkg coreutils openssl@3

deploy/kiosk/build-autoinstall-iso.sh \
  --base-iso ubuntu-24.04.4-live-server-amd64.iso \
  --base-iso-sha256 e907d92eeec9df64163a7e454cbc8d7755e8ddc7ed42f99dbc80c40f1a138433 \
  --appimage gmib-x86_64.AppImage \
  --gmib-version 5.6.1 \
  --pritunl-deb pritunl-client_amd64.deb \
  --zabbix-agent2-deb zabbix-agent2_1_7.4.14-1+ubuntu24.04_amd64.deb \
  --bootstrap-url https://app.nata-info.ru/api/vpn/enroll/gmib \
  --ssh-authorized-key id_ed25519.pub \
  --output gmib-kiosk-5.6.1-ubuntu-24.04.4-amd64.iso
```

The build verifies the Ubuntu ISO checksum and writes `gmib-kiosk-24.04.iso.sha256`. Every embedded
payload file also has an entry in `/gmib-installer/SHA256SUMS` on the ISO.

### Building directly on app-server

For a slow upload link, build on app-server and reuse the verified Ubuntu ISO kept in
`/home/user/appliance-build/input`. The server script downloads only the approximately 150 MB
AppImage and verifies the asset digest returned by the GitHub API.

Keep at least 6 GiB free before starting: approximately 3.5 GiB for the new ISO and 2 GiB of reserve.
After the one-time setup, update the server clone and run
`deploy/kiosk/build-and-publish-on-server.sh`. It reads the version from `package.json`, downloads and
verifies the matching release AppImage, builds the ISO, publishes it locally, and checks HTTP Range.
Use `--replace-current` explicitly on a small disk; that mode unpublishes only the old GMIB kiosk
image when there is not enough room for both versions. Keep the cached Ubuntu ISO for subsequent
GMIB and GGS builds.

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

Use `sudo gmib-zabbix-configure status` for sanitized monitoring state or
`sudo gmib-zabbix-configure disable` to stop, mask, and remove its managed credentials. Feed an
updated JSON object through stdin or a root-only file; never put a PSK on the command line.

## Publishing

Publish the versioned ISO and its checksum to app-server with:

```bash
deploy/kiosk/publish-image.sh \
  --iso gmib-kiosk-5.6.1-ubuntu-24.04.4-amd64.iso
```

The public catalog is `https://app.nata-info.ru/gmib/kiosk`. The publisher validates the checksum,
uploads atomically, and refuses an upload that would leave less than 2 GiB free on the server. It
removes superseded files only after the new image and manifest have been published successfully.
App-server discovers manifests and streams versioned files at request time, so publishing another
image does not require rebuilding or restarting the application.

When images are built on app-server to avoid a slow multi-gigabyte upload, keep the verified official
Ubuntu ISO in a private build directory. It can be reused for later GMIB and GGS builds; only replace
it when the chosen Ubuntu release changes, and always retain its expected SHA-256 check.

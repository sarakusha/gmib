# macOS Code Signing

gmib uses Squirrel.Mac through `electron-updater`. macOS auto-update cannot work
reliably with ad-hoc signatures: Squirrel validates the downloaded app against
the installed app's designated requirement, and ad-hoc requirements are tied to
one concrete `cdhash`.

The public Apple-approved setup is a paid Apple Developer Program membership
with a `Developer ID Application` certificate and notarization. Without that,
use one stable self-signed code signing certificate for every macOS release.
This does not make Gatekeeper trust the app, but it gives Squirrel.Mac a stable
certificate requirement between releases.

Users who already installed an ad-hoc signed gmib build need to install the
first self-signed release manually. Auto-update starts working only after the
installed app and the next update are signed with this same certificate.

## Create a self-signed certificate

Run this once on a Mac and keep the generated private key safe:

```bash
mkdir -p /tmp/gmib-codesign
cd /tmp/gmib-codesign

cat > openssl.cnf <<'EOF'
[ req ]
distinguished_name = dn
x509_extensions = codesign_ext
prompt = no

[ dn ]
CN = gmib Self-Signed Code Signing

[ codesign_ext ]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
subjectKeyIdentifier = hash
EOF

openssl req -newkey rsa:2048 -nodes -x509 -days 3650 \
  -config openssl.cnf \
  -keyout gmib-codesign.key \
  -out gmib-codesign.crt

openssl pkcs12 -legacy -export \
  -inkey gmib-codesign.key \
  -in gmib-codesign.crt \
  -name "gmib Self-Signed Code Signing" \
  -out gmib-codesign.p12
```

Use a strong export password when `openssl` asks for one.

## Configure GitHub Actions

Add these repository secrets:

- `MACOS_CODESIGN_CERTIFICATE_BASE64`: base64 of `gmib-codesign.p12`
- `MACOS_CODESIGN_CERTIFICATE_PASSWORD`: the `.p12` export password
- `GMIB_MAC_CODESIGN_IDENTITY`: `gmib Self-Signed Code Signing`

Create the base64 value with:

```bash
base64 -i gmib-codesign.p12 | pbcopy
```

The release workflow imports the `.p12` into a temporary keychain, trusts the
certificate for code signing on the GitHub macOS runner, and fails the macOS job
if the produced app is still signed ad-hoc.

## Local release builds

For local macOS release builds, import the same `.p12` into Keychain Access and
trust the certificate for code signing. Then run:

```bash
export GMIB_MAC_CODESIGN_IDENTITY="gmib Self-Signed Code Signing"
pnpm run dist:darwin
```

## Limitations

Self-signed signing is only a workaround for Squirrel.Mac update validation.
Users still need to bypass Gatekeeper on first install. To remove that warning
for normal public distribution, use an Apple `Developer ID Application`
certificate and notarize the app.
